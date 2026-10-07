import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CachedMetadata } from "obsidian";
import { createHash } from "node:crypto";
import { MarkdownChunker } from "./markdownChunker";
import type { ChunkingOptions, ChunkingStrategy, MarkdownChunkInput } from "./types";
import { preparePair } from "../decisions/preparePair";
import { decisionsBody, OpenRouterDecisionsProvider } from "../decisions/openRouterDecisions";
import type { DecisionsTransport } from "../decisions/openRouterDecisions";
import { DEFAULT_DECISIONS_SETTINGS } from "../decisions/types";
import { OverlapSession } from "../decisions/overlapSession";
import { prepareRerankCandidates } from "../rerank/prepareCandidates";
import { OpenRouterRerankProvider, rerankBody } from "../rerank/openRouterRerank";
import type { RerankTransport } from "../rerank/openRouterRerank";
import { DEFAULT_RERANK_SETTINGS } from "../rerank/types";
import { refinedSearch } from "../rerank/refinedSearch";
import { IndexingService } from "../indexing/indexingService";
import { LocalVectorStore } from "../vectorStore/localVectorStore";
import type { VectorStorePersistence } from "../vectorStore/types";
import legacy from "../tests/fixtures/outbound-legacy-index.json";
import type { SemanticDuplicatePair } from "../semantic/types";

vi.mock("obsidian", () => ({ getLanguage: () => "en", requestUrl: () => { throw Error("No real transport in privacy tests"); } }));
beforeAll(() => vi.stubGlobal("window", { setTimeout, clearTimeout }));
afterAll(() => vi.unstubAllGlobals());
const decisionSettings = { ...DEFAULT_DECISIONS_SETTINGS, enabled: true, apiKey: "fake-only" };
const rerankSettings = { ...DEFAULT_RERANK_SETTINGS, enabled: true, apiKey: "fake-only" };
type RerankBody = { documents: string[] };
type DecisionsBody = { state: { fragmentA: string; fragmentB: string } };
const answer = { answers: { overlap: { type: "choice", choice: "partial_overlap", confidence: 1,
  probabilities: { same_information: 0, partial_overlap: 1, related_distinct: 0, unrelated: 0, insufficient_context: 0 } } } };
const setextCache = { headings: [{ heading: "Authored title", level: 1,
  position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 1, col: 4, offset: 19 } } }] } as CachedMetadata;
interface Fixture { name: string; document: MarkdownChunkInput; expected?: string[]; options?: Partial<ChunkingOptions> }
const fixtures: Fixture[] = [
  { name: "headerless", document: { path: "Private-folder/Unique-headerless-name.md", content: "Ordinary body." }, expected: ["Ordinary body."] },
  { name: "introduction", document: { path: "Private-folder/Unique-introduction-name.md", content: "Opening paragraph.\n\n# Authored\n\nSection body." }, expected: ["Opening paragraph.", "Authored\n\nSection body."] },
  { name: "empty heading", document: { path: "Private-folder/Unique-empty-heading.md", content: "#\n\nBody under empty heading." }, expected: ["Body under empty heading."] },
  { name: "authored basename heading", document: { path: "Private-folder/Authored.md", content: "# Authored\n\nBody." }, expected: ["Authored\n\nBody."] },
  { name: "authored path in body", document: { path: "Private-folder/Literal.md", content: "The author wrote Private-folder/Literal.md and Literal here." }, expected: ["The author wrote Private-folder/Literal.md and Literal here."] },
  { name: "long Unicode filename BOM CRLF", document: { path: `Папка/${"Уникальный😀".repeat(30)}.md`, content: "\uFEFFОбычный текст.\r\nСледующая строка." }, options: { targetChars: 120, maxChars: 160, overlapChars: 0 }, expected: ["\uFEFFОбычный текст.\nСледующая строка."] },
  { name: "nested and empty headings", document: { path: "Private-folder/Unique-nested.md", content: "# Parent\n\nOne.\n\n##\n\nTwo.\n\n### Child\n\nThree." }, expected: ["Parent\n\nOne.", "Parent\n\nTwo.", "Parent > Child\n\nThree."] },
  { name: "cached Setext", document: { path: "Private-folder/Unique-setext.md", content: "Authored title\n====\n\nBody.", cache: setextCache }, expected: ["Authored title\n\nBody."] },
  { name: "code list overlap", document: { path: "Private-folder/Unique-blocks.md", content: "Opening words are content.\n\n```md\n# A code heading\nPrivate-folder/Unique-blocks.md\n```\n\n- first item\n- second item\n\n" + "A longer ordinary paragraph. ".repeat(14) }, options: { targetChars: 120, maxChars: 180, overlapChars: 40 } },
  { name: "empty", document: { path: "Private-folder/Unique-empty.md", content: "" }, expected: [] },
  { name: "frontmatter only", document: { path: "Private-folder/Unique-frontmatter.md", content: "\uFEFF---\r\nsecret: excluded\r\n---\r\n" }, expected: [] },
  { name: "frontmatter and body", document: { path: "Private-folder/Unique-frontmatter-body.md", content: "---\nsecret: excluded\n---\n\nVisible body." }, expected: ["Visible body."] },
];

function harness(document: MarkdownChunkInput, options?: Partial<ChunkingOptions>) {
  const chunker = new MarkdownChunker(options);
  const documents = [document, { path: "Other-private-folder/Second-unique-name.md", content: "Second ordinary body." }];
  const chunks = documents.map(input => chunker.chunk(input));
  const matches = chunks.map(items => items.map(chunk => ({ ...chunk, preview: "NOT A TEXT SOURCE", score: 0.7 })));
  const pair: SemanticDuplicatePair = { leftPath: documents[0].path, rightPath: documents[1].path, score: 0.7,
    leftMatches: matches[0], rightMatches: matches[1] };
  const source = { readAll: vi.fn(), readPaths: vi.fn(async (paths: readonly string[]) => ({ documents: documents.filter(d => paths.includes(d.path)), missingPaths: [] })) };
  const decisionTransport = vi.fn<DecisionsTransport>(async () => ({ status: 200, text: JSON.stringify(answer) }));
  const rerankTransport = vi.fn<RerankTransport>(async request => ({ status: 200, text: JSON.stringify({ model: rerankSettings.model, results:
    (JSON.parse(request.body as string) as RerankBody).documents.map((_, index) => ({ index, relevance_score: index })) }) }));
  const prepare = (current: () => boolean) => preparePair(pair, source, chunker, current, () => true);
  const session = new OverlapSession(documents.map(d => d.path), { prepare, settings: () => decisionSettings,
    stamp: () => "stable", available: () => true, release: vi.fn(), provider: settings => new OpenRouterDecisionsProvider(settings, decisionTransport) });
  return { chunker, documents, chunks, pair, source, decisionTransport, rerankTransport, prepare, session };
}

describe("outbound provenance through production preparation, serializers and fake HTTP", () => {
  it.each(["Decisions", "Rerank"])("%s headerless final payload excludes filename-derived text", async capability => {
    const h = harness(fixtures[0].document);
    let body: string;
    if (capability === "Decisions") {
      await h.session.prepare(); await h.session.run();
      body = h.decisionTransport.mock.calls[0][0].body as string;
    } else {
      const prepared = await prepareRerankCandidates(h.documents.map((d, i) => ({ path: d.path, score: 0.7,
        matches: i === 0 ? h.pair.leftMatches : h.pair.rightMatches })), h.source, h.chunker, () => true);
      await new OpenRouterRerankProvider(rerankSettings, h.rerankTransport).rank("synthetic query", prepared.map(p => p.text), new AbortController().signal);
      body = h.rerankTransport.mock.calls[0][0].body as string;
    }
    expect(body).not.toContain("Unique-headerless-name");
    expect(body).toContain("Ordinary body.");
  });
  it.each(fixtures)("$name: Decisions preview and both final JSON bodies contain only authored context", async fixture => {
    const h = harness(fixture.document, fixture.options);
    const actual: string[] = [];
    if (!h.chunks[0].length) {
      await h.session.prepare(); await h.session.run();
      expect(h.session.view.stage).toBe("stale"); expect(h.decisionTransport).not.toHaveBeenCalled();
      expect(await prepareRerankCandidates([{ path: fixture.document.path, score: 0.7, matches: [] }], h.source, h.chunker, () => true)).toEqual([]);
    }
    for (const match of h.chunks[0]) {
      h.pair.leftMatches = [{ ...match, score: 0.7 }];
      await h.session.prepare();
      const preview = h.session.view.preview!;
      expect(preview).toBeDefined();
      const before = h.decisionTransport.mock.calls.length;
      await h.session.run();
      expect(h.session.view.stage).toBe("result");
      expect(h.decisionTransport.mock.calls).toHaveLength(before + 1);
      const decisionJSON = h.decisionTransport.mock.calls.at(-1)![0].body as string;
      expect(decisionJSON).toBe(decisionsBody(decisionSettings.model, { fragmentA: preview.a.text, fragmentB: preview.b.text }));
      const prepared = await prepareRerankCandidates(h.documents.map((d, i) => ({ path: d.path, score: 0.7,
        matches: i === 0 ? h.pair.leftMatches : h.pair.rightMatches })), h.source, h.chunker, () => true);
      await new OpenRouterRerankProvider(rerankSettings, h.rerankTransport).rank("synthetic query", prepared.map(p => p.text), new AbortController().signal);
      const rerankJSON = h.rerankTransport.mock.calls.at(-1)![0].body as string;
      expect(rerankJSON).toBe(rerankBody(rerankSettings.model, "synthetic query", prepared.map(p => p.text)));
      expect((JSON.parse(rerankJSON) as RerankBody).documents).toEqual([preview.a.text, preview.b.text]);
      expect(preview.a.match.id).toBe(match.id); expect(preview.a.match.contentHash).toBe(match.contentHash);
      expect(prepared[0].chunkId).toBe(match.id); expect(prepared[0].document.score).toBe(0.7);
      expect(preview.b.text).toBe("Second ordinary body.");
      expect(decisionJSON + rerankJSON).not.toMatch(/Second-unique-name|Other-private-folder|NOT A TEXT SOURCE|secret: excluded/);
      if (!fixture.document.content.includes(fixture.document.path) && !fixture.document.content.includes("# Authored")) {
        expect(decisionJSON + rerankJSON).not.toContain(fixture.document.path.split("/").at(-1)!.slice(0, -3));
      }
      actual.push(preview.a.text);
    }
    if (fixture.expected) expect(actual).toEqual(fixture.expected);
    else {
      // The body was composed from these exact legacy blocks, including overlap; only the synthetic prefix differs.
      expect(actual).toEqual(h.chunks[0].map(c => c.text.slice(c.text.indexOf("\n\n") + 2)));
      expect(actual.join("\n")).toContain("# A code heading\nPrivate-folder/Unique-blocks.md");
      expect(actual.join("\n")).toContain("- first item\n- second item");
      expect(h.chunks[0].some((c, i, all) => i > 0 && c.source.startOffset < all[i - 1].source.endOffset)).toBe(true);
    }
  });
  it("two paths keep distinct local identities but send the same short authored body", async () => {
    const first = harness({ path: "Secret-folder/One-private-name.md", content: "Same authored text." });
    const second = harness({ path: "Different-folder/Two-private-name.md", content: "Same authored text." });
    const a = await first.prepare(() => true), b = await second.prepare(() => true);
    expect(a.a.text).toBe("Same authored text."); expect(a.a.text).toBe(b.a.text);
    expect(a.a.match.id).not.toBe(b.a.match.id);
  });
  it("removes synthetic context before the 4000-code-point limit and preserves preview/send equality", async () => {
    const h = harness({ path: `Private/${"Long-name😀".repeat(200)}.md`, content: "😀".repeat(4500) },
      { targetChars: 12000, maxChars: 12000, overlapChars: 0 });
    await h.session.prepare();
    const shown = h.session.view.preview!;
    expect(shown.a.text).toBe("😀".repeat(4000)); expect(shown.a.truncated).toBe(true);
    await h.session.run();
    const body = JSON.parse(h.decisionTransport.mock.calls[0][0].body as string) as DecisionsBody;
    expect(body.state).toEqual({ fragmentA: shown.a.text, fragmentB: shown.b.text });
    const prepared = await prepareRerankCandidates(h.documents.map((d, i) => ({ path: d.path, score: 0.7,
      matches: i ? h.pair.rightMatches : h.pair.leftMatches })), h.source, h.chunker, () => true);
    await new OpenRouterRerankProvider(rerankSettings, h.rerankTransport).rank("query", prepared.map(p => p.text), new AbortController().signal);
    expect((JSON.parse(h.rerankTransport.mock.calls[0][0].body as string) as RerankBody).documents).toEqual([shown.a.text, shown.b.text]);
  });
  it.each(["missing method", "missing provenance", "empty", "throws", "copied chunk"])("fails closed on %s, without falling back to enriched text", async reason => {
    const h = harness(fixtures[0].document);
    const chunker: ChunkingStrategy = { chunk: input => h.chunker.chunk(input) };
    if (reason !== "missing method") chunker.outboundText = chunk => {
      if (reason === "throws") throw Error("synthetic preparation failure");
      if (reason === "empty") return " ";
      if (reason === "copied chunk") return h.chunker.outboundText({ ...chunk });
      return undefined;
    };
    await expect(preparePair(h.pair, h.source, chunker, () => true, () => true)).rejects.toMatchObject({ code: "stale" });
    const search = vi.fn(async () => [{ path: h.documents[0].path, score: 0.7, matches: h.pair.leftMatches },
      { path: h.documents[1].path, score: 0.6, matches: h.pair.rightMatches }]);
    const result = await refinedSearch({ query: "query", settings: rerankSettings, signal: new AbortController().signal,
      search, prepare: results => prepareRerankCandidates(results, h.source, chunker, () => true),
      allowed: () => true, isCurrent: () => true, publish: vi.fn(), provider: new OpenRouterRerankProvider(rerankSettings, h.rerankTransport) });
    expect(result).toMatchObject({ stage: "skipped", reason: "insufficient" });
    expect(result.results.map(r => r.score)).toEqual([0.7, 0.6]); expect(search).toHaveBeenCalledOnce();
    expect(h.rerankTransport).not.toHaveBeenCalled(); expect(h.decisionTransport).not.toHaveBeenCalled();
  });
  it.each(["id", "hash", "changed", "deleted", "excluded"])("%s source is rejected before obtaining outbound text", async reason => {
    const h = harness(fixtures[0].document);
    const outbound = vi.spyOn(h.chunker, "outboundText");
    if (reason === "id") h.pair.leftMatches[0].id = "old-id";
    if (reason === "hash") h.pair.leftMatches[0].contentHash = "old-hash";
    if (reason === "changed") h.documents[0] = { ...h.documents[0], content: "Changed body." };
    if (reason === "deleted" || reason === "excluded") h.documents.shift();
    await expect(h.prepare(() => true)).rejects.toMatchObject({ code: "stale" });
    expect(await prepareRerankCandidates([{ path: h.pair.leftPath, score: 0.7, matches: h.pair.leftMatches }], h.source, h.chunker, () => true)).toEqual([]);
    expect(outbound).not.toHaveBeenCalled();
  });
});

describe("legacy chunk representation frozen before the fix", () => {
  it.each(fixtures)("$name: every serialized legacy field remains byte-identical", fixture => {
    const chunks = new MarkdownChunker(fixture.options).chunk(fixture.document);
    // Captures text, ids/hashes, heading path, source coordinates, ordinal, grouping and overlap, with no giant text snapshot.
    expect({ count: chunks.length, sha256: createHash("sha256").update(JSON.stringify(chunks)).digest("hex") }).toMatchSnapshot();
  });
  it("reads the frozen serialized index without rebuild or writes; unchanged documents do not re-embed", async () => {
    const text = new Map(Object.entries(legacy.text));
    const binary = new Map(Object.entries(legacy.binary).map(([path, base64]) => [path, Uint8Array.from(Buffer.from(base64, "base64")).buffer]));
    const writeText = vi.fn(async () => { throw Error("Unexpected index write"); });
    const writeBinary = vi.fn(async () => { throw Error("Unexpected index write"); });
    const persistence: VectorStorePersistence = { exists: async path => text.has(path) || binary.has(path),
      readText: async path => text.get(path)!, readBinary: async path => binary.get(path)!,
      writeText, writeBinary,
      createDirectory: vi.fn(), remove: vi.fn(), rename: vi.fn() };
    const chunker = new MarkdownChunker();
    const embed = vi.fn(async (texts: string[]) => texts.map(() => new Float32Array([1, 0, 0])));
    let store!: LocalVectorStore;
    const indexing = new IndexingService({ chunker, embeddingProvider: { id: "openai-compatible", model: "fixture", dimensions: async () => 3, embed },
      embeddingSpace: { providerId: "openai-compatible", model: "fixture", baseUrl: "http://localhost:1/v1" },
      vectorStoreFactory: options => (store = new LocalVectorStore({ ...options, basePath: "vectors", persistence })) });
    await indexing.initialize();
    expect(legacy.documents.flatMap(d => chunker.chunk(d))).toEqual(legacy.chunks);
    expect(await indexing.indexDocuments(legacy.documents)).toMatchObject({ documentsUnchanged: 2, chunksEmbedded: 0, generationBefore: 1, generationAfter: 1 });
    expect(embed).not.toHaveBeenCalled(); expect(writeText).not.toHaveBeenCalled(); expect(writeBinary).not.toHaveBeenCalled();
    expect(Object.fromEntries(text)).toEqual(legacy.text);
    expect(Object.fromEntries([...binary].map(([path, value]) => [path, Buffer.from(value).toString("base64")]))).toEqual(legacy.binary);
    expect((await store.search(new Float32Array([1, 0, 0]), { limit: 10 })).length).toBe(3);
    const source = { readAll: vi.fn(), readPaths: async (paths: readonly string[]) => ({ documents: legacy.documents.filter(d => paths.includes(d.path)), missingPaths: [] }) };
    const matches = store.listMetadata().map(m => ({ ...m, score: 0.7 }));
    const results = legacy.documents.map(d => ({ path: d.path, score: 0.7, matches: matches.filter(m => m.path === d.path) }));
    expect((await prepareRerankCandidates(results, source, chunker, () => true)).map(p => p.text)).toEqual(["Synthetic body.", "Intro."]);
    expect((await preparePair({ leftPath: results[0].path, rightPath: results[1].path, leftMatches: results[0].matches,
      rightMatches: results[1].matches, score: 0.7 }, source, chunker, () => true, () => true)).a.text).toBe("Synthetic body.");
    for (const chunk of chunker.chunk(legacy.documents[0])) {
      expect(Object.keys(chunk)).not.toContain("outboundText");
      expect(chunker.outboundText({ ...chunk })).toBeUndefined();
    }
  });
});
