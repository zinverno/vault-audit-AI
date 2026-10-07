import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));
import { MarkdownChunker } from "../chunking/markdownChunker";
import type { MarkdownDocumentSource } from "../indexing/types";
import type { SemanticDocumentResult } from "../semantic/types";
import { OpenRouterRerankProvider } from "./openRouterRerank";
import { prepareRerankCandidates } from "./prepareCandidates";
import { refinedSearch } from "./refinedSearch";
import type { RefinedSearchUpdate } from "./types";
import type { RefinedSearchOptions } from "./refinedSearch";
import { DEFAULT_RERANK_SETTINGS, RERANK_LIMITS } from "./types";

beforeAll(() => vi.stubGlobal("window", {
  setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
}));
afterAll(() => vi.unstubAllGlobals());
type Body = { model: string; documents: string[]; top_n: number };

function fixture(count = 3) {
  const chunker = new MarkdownChunker();
  const contents = new Map(Array.from({ length: count }, (_, i) => [`note-${i}.md`, `# Heading ${i}\n\nFragment ${i} with text absent from preview.`]));
  const results: SemanticDocumentResult[] = [...contents].map(([path, content], i) => ({ path, score: 1 - i / 100,
    matches: chunker.chunk({ path, content }).map(chunk => ({ ...chunk, text: undefined, score: 1 - i / 100, preview: "tiny" })) }));
  const readPaths = vi.fn<MarkdownDocumentSource["readPaths"]>(async paths => ({
    documents: paths.filter(path => contents.has(path)).map(path => ({ path, content: contents.get(path)! })),
    missingPaths: paths.filter(path => !contents.has(path)),
  }));
  const source = { readAll: vi.fn(async () => []), readPaths };
  const transport = vi.fn(async (request: { body?: string | ArrayBuffer }) => {
    const { documents, model } = JSON.parse(request.body as string) as Body;
    return { status: 200, text: JSON.stringify({ model, results: documents.map((_text: string, index: number) => ({ index, relevance_score: index })) }) };
  });
  const settings = { ...DEFAULT_RERANK_SETTINGS, enabled: true, apiKey: "synthetic-key" };
  const isCurrent = vi.fn(() => true);
  const options = { query: "question", settings, signal: new AbortController().signal,
    search: vi.fn(async (_limit: number) => results),
    prepare: vi.fn((items: readonly SemanticDocumentResult[]) => prepareRerankCandidates(items, source, chunker, isCurrent)),
    allowed: (path: string) => contents.has(path), isCurrent,
    provider: new OpenRouterRerankProvider(settings, transport), publish: vi.fn<(update: RefinedSearchUpdate) => void>(),
  } satisfies RefinedSearchOptions;
  return { options, transport, source, chunker, contents, results };
}

describe("refined search and current chunk reconstruction", () => {
  it("disabled leaves base results intact, with no text reads or rerank HTTP", async () => {
    const f = fixture(); f.options.settings.enabled = false;
    expect((await refinedSearch(f.options)).results).toBe(f.results);
    expect(f.options.search).toHaveBeenCalledExactlyOnceWith(10);
    expect(f.source.readPaths).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
  });
  it("retrieves one expanded pool, publishes originals first, maps indices and keeps semantic scores", async () => {
    const f = fixture(); const before = structuredClone(f.results);
    const result = await refinedSearch(f.options);
    expect(f.options.search).toHaveBeenCalledExactlyOnceWith(30);
    expect(f.options.publish.mock.calls.map(([update]) => update.stage)).toEqual(["semantic", "refining"]);
    expect(f.options.publish.mock.calls[0][0].results).toEqual(before);
    expect(result.results.map(item => [item.path, item.score, item.rerankScore])).toEqual([
      ["note-2.md", 0.98, 2], ["note-1.md", 0.99, 1], ["note-0.md", 1, 0],
    ]);
    expect(f.results).toEqual(before);
    const body = JSON.parse(f.transport.mock.calls[0][0].body as string) as Body;
    expect(body.top_n).toBe(3);
    expect(body.documents[0]).toContain("text absent from preview");
    expect(body.documents.join(" ")).not.toMatch(/tiny|note-\d\.md/);
  });
  it("preserves original order for equal scores despite provider response order", async () => {
    const f = fixture(); f.transport.mockResolvedValue({ status: 200, text: JSON.stringify({ model: "m", results:
      [2, 1, 0].map(index => ({ index, relevance_score: 7 })) }) });
    expect((await refinedSearch(f.options)).results.map(item => item.path)).toEqual(f.results.map(item => item.path));
  });
  it("reads current chunks, verifies both id and hash, uses best usable fragment and retains extra matches", async () => {
    const f = fixture();
    const path = f.results[0].path;
    f.contents.set(path, "# A\n\nOld section\n\n# B\n\nUnchanged section");
    const chunks = f.chunker.chunk({ path, content: f.contents.get(path)! });
    f.results[0].matches = chunks.map((chunk, i) => ({ ...chunk, score: 1 - i / 10 }));
    f.contents.set(path, "# A\n\nChanged section longer\n\nAdditional paragraph\n\n# B\n\nUnchanged section");
    f.results[1].matches[0].id = "stale-id";
    f.results[2].matches[0].contentHash = "stale-hash";
    const prepared = await f.options.prepare(f.results);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].text).toContain("Unchanged section");
    expect(prepared[0].text).not.toContain("Changed section");
    expect(prepared[0].match.source.startLine).toBeGreaterThan(chunks[1].source.startLine);
    expect(prepared[0].document.matches).toHaveLength(2);
  });
  it("never replaces missing or excluded source text by whole note or preview", async () => {
    const f = fixture(5);
    f.contents.delete("note-0.md");
    f.options.allowed = path => path !== "note-1.md" && f.contents.has(path);
    f.contents.set("note-2.md", "Changed entire note");
    const update = await refinedSearch(f.options);
    const body = JSON.parse(f.transport.mock.calls[0][0].body as string) as Body;
    expect(body.documents).toHaveLength(2);
    expect(body.documents.join(" ")).not.toMatch(/Fragment [012]|Changed entire note|tiny/);
    expect(update).toMatchObject({ stage: "reranked", evaluated: 2, candidates: 3 });
    expect(update.results.map(item => item.path)).toEqual(["note-4.md", "note-3.md", "note-2.md"]);
    expect(vi.mocked(f.source.readPaths).mock.calls.flat(2)).not.toContain("note-1.md");
  });
  it("caps candidates at 30, sends all prepared documents, applies final limit locally", async () => {
    const f = fixture(35);
    f.options.search.mockImplementation(async limit => f.results.slice(0, limit));
    const update = await refinedSearch(f.options);
    expect(update.results).toHaveLength(10);
    const body = JSON.parse(f.transport.mock.calls[0][0].body as string) as Body;
    expect(body.documents).toHaveLength(30); expect(body.top_n).toBe(30);
    expect(update.results[0].path).toBe("note-29.md");
  });
  it("deterministically truncates by Unicode code points and bounds escaped UTF-8 JSON", async () => {
    const f = fixture(30);
    const long = "😀\"\\".repeat(2000);
    const customChunker = new MarkdownChunker({ targetChars: 18000, maxChars: 20000, overlapChars: 0 });
    const chunk = { ...customChunker.chunk({ path: f.results[0].path, content: long })[0], score: 0.7 };
    const document = { ...f.results[0], matches: [chunk] };
    f.contents.set(document.path, long);
    const prepared = await prepareRerankCandidates([document], f.source, customChunker, () => true);
    expect(Array.from(prepared[0].text)).toHaveLength(4000);
    expect(prepared[0].text).toBe(Array.from(long).slice(0, 4000).join(""));
    f.options.prepare.mockImplementation(async items => items.map((document, originalOrder) => ({ document, originalOrder, chunkId: "id", match: document.matches[0], text: "😀".repeat(4000) })));
    const update = await refinedSearch(f.options);
    const body = f.transport.mock.calls[0][0].body as string;
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(RERANK_LIMITS.payloadBytes);
    expect((JSON.parse(body) as Body).documents.length).toBeLessThan(30);
    expect(update.evaluated).toBe((JSON.parse(body) as Body).top_n);
  });
  it.each([0, 1])("skips HTTP with %s usable candidates", async count => {
    const f = fixture(count); expect(await refinedSearch(f.options)).toMatchObject({ stage: "skipped", reason: "insufficient" });
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("skips unconfigured rerank without reading source text", async () => {
    const f = fixture(); f.options.settings.apiKey = "";
    expect(await refinedSearch(f.options)).toMatchObject({ stage: "skipped", reason: "configuration" });
    expect(f.source.readPaths).not.toHaveBeenCalled(); expect(f.transport).not.toHaveBeenCalled();
  });
  it("preserves all admissible original results on malformed/partial response without another search", async () => {
    const f = fixture(12); f.options.search.mockImplementation(async limit => f.results.slice(0, limit));
    f.transport.mockResolvedValue({ status: 200, text: '{"model":"m","results":[{"index":1,"relevance_score":4}]}' });
    expect(await refinedSearch(f.options)).toEqual({ stage: "fallback", reason: undefined, results: f.results.slice(0, 10) });
    expect(f.options.search).toHaveBeenCalledOnce();
  });
  it("propagates embedding errors, never labels them successful fallback", async () => {
    const f = fixture(); f.options.search.mockRejectedValue(new Error("embedding failed"));
    await expect(refinedSearch(f.options)).rejects.toThrow("embedding failed");
    expect(f.transport).not.toHaveBeenCalled(); expect(f.options.publish).not.toHaveBeenCalled();
  });
  it("checks snapshot after each text read and before sending", async () => {
    const f = fixture(); vi.mocked(f.source.readPaths).mockImplementation(async () => {
      f.options.isCurrent.mockReturnValue(false);
      return { documents: [], missingPaths: [] };
    });
    expect(await refinedSearch(f.options)).toMatchObject({ stage: "skipped", reason: "obsolete" });
    expect(f.transport).not.toHaveBeenCalled(); expect(f.source.readPaths).toHaveBeenCalledOnce();
  });
  it("rejects changed snapshots and removes excluded/deleted notes even from fallback", async () => {
    const f = fixture(); f.transport.mockImplementation(async () => {
      f.contents.delete("note-0.md"); f.options.allowed = path => path === "note-2.md";
      f.options.isCurrent.mockReturnValue(false);
      return { status: 500, text: "private provider error" };
    });
    const update = await refinedSearch(f.options);
    expect(update).toMatchObject({ stage: "skipped", reason: "obsolete" });
    expect(update.results.map(item => item.path)).toEqual(["note-2.md"]);
  });
});
