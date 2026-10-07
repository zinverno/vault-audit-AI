import { describe, expect, it, vi } from "vitest";
import { MarkdownChunker } from "../chunking/markdownChunker";
import type { SemanticDuplicatePair } from "../semantic/types";
import { preparePair } from "./preparePair";
import { OverlapSession } from "./overlapSession";
import { DEFAULT_DECISIONS_SETTINGS } from "./types";
import { DecisionsError, validateDecisionsResponse } from "./openRouterDecisions";
vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));
function fixture() {
  const documents = [{ path: "A.md", content: "# A\n\nCurrent alpha text." }, { path: "B.md", content: "# B\n\nCurrent beta text." }];
  const chunker = new MarkdownChunker();
  const matches = documents.map(document => chunker.chunk(document).map(chunk => ({ ...chunk, preview: "STALE PREVIEW", score: 0.7 })));
  const pair: SemanticDuplicatePair = { leftPath: "A.md", rightPath: "B.md", score: 0.8, leftMatches: matches[0], rightMatches: matches[1] };
  const source = { readAll: vi.fn(), readPaths: vi.fn(async (paths: readonly string[]) => ({ documents: documents.filter(d => paths.includes(d.path)), missingPaths: [] })) };
  let current = true; const allowed = new Set(["A.md", "B.md"]);
  const prepare = (isCurrent: () => boolean = () => current) => preparePair(pair, source, chunker, isCurrent, path => allowed.has(path));
  const settings = { ...DEFAULT_DECISIONS_SETTINGS, enabled: true, apiKey: "synthetic" };
  const answer = validateDecisionsResponse({ answers: { overlap: { type: "choice", choice: "same_information", confidence: 1,
    probabilities: { same_information: 1, partial_overlap: 0, related_distinct: 0, unrelated: 0, insufficient_context: 0 } } } }, settings.model);
  const assess = vi.fn(async () => answer);
  let stamp = "1"; const release = vi.fn();
  const session = new OverlapSession([pair.leftPath, pair.rightPath], { settings: () => settings, prepare, provider: () => ({ assess }),
    stamp: () => stamp, available: () => current, release });
  return { documents, chunker, pair, source, prepare, allowed, settings, answer, assess, session, release,
    stop: () => { current = false; }, changeStamp: () => { stamp = "2"; } };
}
describe("pair reconstruction and send boundary", () => {
  it("uses exactly selected current chunks by id/hash, never previews or old offsets", async () => {
    const f = fixture(); f.pair.leftMatches[0].source.startLine = 999;
    const pair = await f.prepare();
    expect(pair.a.text).toContain("Current alpha text"); expect(pair.b.text).toContain("Current beta text");
    expect(pair.a.text).not.toContain("PREVIEW"); expect(pair.a.match.source.startLine).not.toBe(999);
    expect(f.source.readPaths).toHaveBeenNthCalledWith(1, ["A.md"]); expect(f.source.readPaths).toHaveBeenNthCalledWith(2, ["B.md"]);
    expect(f.source.readAll).not.toHaveBeenCalled();
  });
  it.each(["id", "hash", "deleted", "excluded", "cancelled", "same-path", "changed"])("refuses %s sources without substitution", async reason => {
    const f = fixture();
    if (reason === "id") f.pair.leftMatches[0].id = "old";
    if (reason === "hash") f.pair.leftMatches[0].contentHash = "old";
    if (reason === "deleted") f.documents.shift();
    if (reason === "excluded") f.allowed.delete("A.md");
    if (reason === "cancelled") f.stop();
    if (reason === "same-path") f.pair.rightPath = "A.md";
    if (reason === "changed") f.documents[0].content += " additional new text";
    await expect(f.prepare()).rejects.toMatchObject({ code: "stale" });
    expect(f.assess).not.toHaveBeenCalled();
  });
  it("selects the next valid existing match deterministically and truncates Unicode", async () => {
    const f = fixture();
    const document = f.documents[0]; document.content = "😀".repeat(4500);
    const chunker = { chunk: () => [{ ...f.pair.leftMatches[0], text: document.content,
      source: { startOffset: 0, endOffset: document.content.length, startLine: 0, endLine: 0 } }] };
    const chunk = chunker.chunk()[0];
    const pair = { ...f.pair, leftMatches: [{ ...chunk, id: "missing", score: 1 }, chunk] };
    const combined = { chunk: (input: { path: string; content: string }) => input.path === "A.md" ? chunker.chunk() : f.chunker.chunk(input) };
    const result = await preparePair(pair, f.source, combined, () => true, () => true);
    expect(Array.from(result.a.text)).toHaveLength(4000); expect(result.a.text).toBe("😀".repeat(4000)); expect(result.a.truncated).toBe(true);
  });
});
describe("manual overlap session", () => {
  it("opening and rerendering do not call the model; displayed text equals outgoing state", async () => {
    const f = fixture(); await f.session.prepare(); f.session.onChange(); f.session.onChange();
    expect(f.assess).not.toHaveBeenCalled(); const shown = f.session.view.preview!;
    await f.session.run();
    expect(f.assess).toHaveBeenCalledWith({ fragmentA: shown.a.text, fragmentB: shown.b.text }, expect.any(AbortSignal));
    expect(f.session.view.stage).toBe("result"); expect(f.pair.score).toBe(0.8);
  });
  it.each(["disabled", "configuration"])("%s does not read vault or call provider", async stage => {
    const f = fixture(); if (stage === "disabled") f.settings.enabled = false; else f.settings.apiKey = "";
    await f.session.prepare(); await f.session.run(); expect(f.session.view.stage).toBe(stage);
    expect(f.source.readPaths).not.toHaveBeenCalled(); expect(f.assess).not.toHaveBeenCalled();
  });
  it("changed fragment between preview and run requires refreshing the pair, never sends", async () => {
    const f = fixture(); await f.session.prepare(); f.documents[0].content += " changed";
    await f.session.run(); expect(f.session.view.stage).toBe("stale"); expect(f.assess).not.toHaveBeenCalled();
  });
  it("changed hidden source with unchanged evidence updates preview and requires another explicit run", async () => {
    const f = fixture(); await f.session.prepare(); f.documents[0].content += "\n\n# Another section\n\nNew unrelated content";
    await f.session.run(); expect(f.session.view.stage).toBe("refreshed"); expect(f.assess).not.toHaveBeenCalled();
    await f.session.run(); expect(f.assess).toHaveBeenCalledOnce();
  });
  it.each(["close", "source", "settings", "snapshot", "unload"])("ignores late replies after %s and prevents double clicks", async reason => {
    const f = fixture(); let resolve!: () => void;
    f.assess.mockImplementationOnce(() => new Promise(done => { resolve = () => done(f.answer); }));
    await f.session.prepare(); const pending = f.session.run(); await vi.waitFor(() => expect(f.assess).toHaveBeenCalledOnce());
    await f.session.run(); f.session.onChange(); expect(f.assess).toHaveBeenCalledOnce();
    if (reason === "close") f.session.close();
    else if (reason === "snapshot") f.changeStamp();
    else { if (reason === "settings") f.settings.enabled = false; if (reason === "unload") f.stop(); f.session.invalidate(); }
    resolve(); await pending; expect(f.session.view.stage).toBe("stale"); expect(f.session.view.answer).toBeUndefined();
  });
  it("marks an already displayed result stale without rerunning", async () => {
    const f = fixture(); await f.session.prepare(); await f.session.run();
    f.session.invalidate(); expect(f.session.view.stage).toBe("stale"); expect(f.session.view.answer).toBe(f.answer);
    expect(f.assess).toHaveBeenCalledOnce();
  });
  it("revalidates text after HTTP and keeps errors separate from insufficient_context", async () => {
    const f = fixture(); await f.session.prepare(); f.assess.mockImplementationOnce(async () => { f.documents[0].content += "changed"; return f.answer; });
    await f.session.run(); expect(f.session.view.stage).toBe("stale"); expect(f.session.view.answer).toBeUndefined();
    const other = fixture(); await other.session.prepare(); other.assess.mockRejectedValueOnce(new DecisionsError("credits"));
    await other.session.run(); expect(other.session.view).toMatchObject({ stage: "error", error: "credits" }); expect(other.session.view.answer).toBeUndefined();
  });
});
