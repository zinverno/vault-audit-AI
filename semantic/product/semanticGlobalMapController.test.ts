import { describe, expect, it, vi } from "vitest";
import type { SemanticIndexState } from "../types";
import type { GlobalSemanticAnalysis, GlobalSemanticOptions } from "../globalSemanticMap";
import { semanticIndexRevision } from "../semanticIndexRevision";
import { SemanticGlobalMapController } from "./semanticGlobalMapController";
import { projectGlobalSemanticMap } from "./semanticGlobalMapModel";

const ready: SemanticIndexState = { kind: "ready", vectorCount: 600, vectorGeneration: 1, dimensions: 3,
  provider: "ollama", providerLabel: "Ollama", model: "synthetic", configurationRevision: 0, runtimeRevision: 1 };
function analysis(size = 8) {
  const paths = Array.from({ length: size }, (_, i) => `Folder/Note ${String(i).padStart(2, "0")}.md`);
  const nodes = paths.map((path) => ({ path, coreSimilarity: 1, semanticConnectedness: Number(1),
    neighbors: paths.filter((p) => p !== path).slice(0, 5).map((p) => ({ path: p, score: 1 })) }));
  const edges = nodes.flatMap((a, i) => nodes.slice(i + 1).flatMap((b) => {
    const ab = a.neighbors.some((n) => n.path === b.path), ba = b.neighbors.some((n) => n.path === a.path);
    return ab || ba ? [{ left: a.path, right: b.path, score: 1, mutual: ab && ba }] : [];
  }));
  return { state: "ready" as const, indexedNoteCount: size + 2, mappedNoteCount: size, nodes, edges };
}
function fixture() {
  let state = { ...ready }; const listeners = new Set<() => void>();
  const engine = { getCachedIndexState: () => state, subscribeStatus: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    analyzeGlobalSemanticMap: vi.fn(async (_options?: GlobalSemanticOptions): Promise<GlobalSemanticAnalysis> => analysis()) };
  const port = new SemanticGlobalMapController(engine);
  return { port, engine, listeners, update: (patch: Partial<SemanticIndexState>) => { state = { ...state, ...patch }; for (const l of listeners) l(); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

describe("Global map session ownership", () => {
  it("is passive, caches across loads, searches only loaded data and freezes every public layer", async () => {
    const f = fixture(); expect(f.port.getSnapshot().state).toBe("idle"); expect(f.port.search("").total).toBe(0);
    expect(f.engine.analyzeGlobalSemanticMap).not.toHaveBeenCalled();
    f.engine.analyzeGlobalSemanticMap.mockResolvedValue(analysis(35)); await f.port.load(); await f.port.load();
    expect(f.engine.analyzeGlobalSemanticMap).toHaveBeenCalledOnce();
    expect(f.port.search(" FOLDER/nOtE ").nodes).toHaveLength(20); expect(f.port.search("Note 32").nodes[0].basename).toBe("Note 32");
    const map = f.port.getSnapshot().map!;
    for (const value of [map, map.revision, map.nodes, map.edges, map.nodes[0], map.nodes[0].neighbors, map.nodes[0].neighbors[0], map.edges[0]]) expect(Object.isFrozen(value)).toBe(true);
    f.port.dispose(); expect(f.listeners.size).toBe(0); expect(f.port.search("").total).toBe(0);
  });
  it.each(["vectorGeneration", "vectorCount", "dimensions", "provider", "model", "configurationRevision", "runtimeRevision"] as const)("invalidates %s without recomputing; explicit refresh owns R2", async (field) => {
    const f = fixture(); await f.port.load(); const first = f.port.getSnapshot().map;
    f.update({ [field]: typeof ready[field] === "number" ? Number(ready[field]) + 1 : "changed" });
    expect(f.port.getSnapshot().state).toBe("stale"); await f.port.load(); expect(f.engine.analyzeGlobalSemanticMap).toHaveBeenCalledOnce();
    expect(f.port.getSnapshot().map).toBe(first); await f.port.refresh();
    expect(f.port.getSnapshot().state).toBe("ready"); expect(f.port.getSnapshot().map?.revision[field]).not.toBe(first?.revision[field]); f.port.dispose();
  });
  it.each([true, false])("does not publish R1 after R2, even without status notification (%s)", async (notify) => {
    const f = fixture(); const gate = deferred<GlobalSemanticAnalysis>(); f.engine.analyzeGlobalSemanticMap.mockReturnValueOnce(gate.promise);
    const run = f.port.load(); expect(f.port.refresh()).toBe(run); await Promise.resolve();
    if (!notify) f.listeners.clear(); f.update({ vectorGeneration: 2 }); gate.resolve(analysis()); await run;
    expect(f.port.getSnapshot()).toMatchObject({ state: "stale", busy: false, reason: "changed" }); expect(f.port.getSnapshot().map).toBeUndefined();
    await f.port.refresh(); expect(f.port.getSnapshot().map?.revision.vectorGeneration).toBe(2); f.port.dispose();
  });
  it("aborts disposal and prevents late progress, publication and listener leaks", async () => {
    const f = fixture(); const gate = deferred<GlobalSemanticAnalysis>(); f.engine.analyzeGlobalSemanticMap.mockReturnValueOnce(gate.promise);
    const listener = vi.fn(); f.port.subscribe(listener); const run = f.port.load(); await Promise.resolve();
    const options = f.engine.analyzeGlobalSemanticMap.mock.calls[0][0]!;
    options.onProgress?.({ completedPairs: 10, totalPairs: 28 }); expect(f.port.getSnapshot().progress?.completedPairs).toBe(10);
    f.port.dispose(); const before = f.port.getSnapshot(), calls = listener.mock.calls.length;
    options.onProgress?.({ completedPairs: 28, totalPairs: 28 }); gate.resolve(analysis()); await run;
    expect(options.signal?.aborted).toBe(true); expect(f.port.getSnapshot()).toBe(before); expect(listener).toHaveBeenCalledTimes(calls); expect(f.listeners.size).toBe(0);
  });
  it("publishes controlled limits/core failure, hides raw errors, and refuses unavailable index", async () => {
    const f = fixture();
    for (const [state, count] of [["too-large", 501], ["core-unavailable", 8]] as const) {
      f.engine.analyzeGlobalSemanticMap.mockResolvedValueOnce({ state, indexedNoteCount: count, mappedNoteCount: count }); await f.port.refresh();
      expect(f.port.getSnapshot()).toMatchObject({ state: "unavailable", reason: state, mappedNoteCount: count }); expect(f.port.getSnapshot().map).toBeUndefined();
    }
    f.engine.analyzeGlobalSemanticMap.mockRejectedValueOnce(Error("secret transport details")); await f.port.refresh();
    expect(f.port.getSnapshot()).toMatchObject({ state: "error", reason: "failed" }); expect(JSON.stringify(f.port.getSnapshot())).not.toContain("secret");
    f.update({ kind: "disabled" }); await f.port.refresh(); expect(f.engine.analyzeGlobalSemanticMap).toHaveBeenCalledTimes(3); f.port.dispose();
  });
});

describe("Global map validation", () => {
  const corruptions: Array<[string, (r: ReturnType<typeof analysis>) => void]> = [
    ["duplicate path", r => { r.nodes[1].path = r.nodes[0].path; }], ["noncanonical path", r => { r.nodes[0].path = "../bad.md"; }],
    ["unknown neighbor", r => { r.nodes[0].neighbors[0].path = "Missing.md"; }], ["self neighbor", r => { r.nodes[0].neighbors[0].path = r.nodes[0].path; }],
    ["duplicate neighbor", r => { r.nodes[0].neighbors[1] = r.nodes[0].neighbors[0]; }], ["too many neighbors", r => { r.nodes[0].neighbors.push(r.nodes[0].neighbors[0]); }],
    ["missing neighbor", r => { r.nodes[0].neighbors.pop(); }], ["unsorted ranks", r => { r.nodes[0].neighbors.reverse(); }],
    ["NaN core", r => { r.nodes[0].coreSimilarity = NaN; }], ["infinite connectedness", r => { r.nodes[0].semanticConnectedness = Infinity; }],
    ["invalid mean", r => { r.nodes[0].semanticConnectedness = 0.5; }], ["invalid score", r => { r.nodes[0].neighbors[0].score = -1.01; }],
    ["null mean", r => { Object.assign(r.nodes[0], { semanticConnectedness: null }); }], ["invalid count", r => { r.indexedNoteCount = 1; }],
    ["fractional count", r => { r.mappedNoteCount = 8.5; }], ["sparse nodes", r => { r.nodes.length += 1; r.mappedNoteCount += 1; r.indexedNoteCount += 1; }],
    ["duplicate edge", r => { r.edges[1] = r.edges[0]; }], ["inconsistent mutual", r => { r.edges[0].mutual = !r.edges[0].mutual; }],
    ["edge score", r => { r.edges[0].score = 0.8; }], ["missing edge", r => { r.edges.pop(); }],
    ["noncanonical edge", r => { [r.edges[0].left, r.edges[0].right] = [r.edges[0].right, r.edges[0].left]; }],
  ];
  it.each(corruptions)("rejects the whole map: %s", async (_name, corrupt) => {
    const f = fixture(); const result = analysis(); corrupt(result); f.engine.analyzeGlobalSemanticMap.mockResolvedValueOnce(result); await f.port.load();
    expect(f.port.getSnapshot()).toMatchObject({ state: "error", reason: "invalid" }); expect(f.port.getSnapshot().map).toBeUndefined(); f.port.dispose();
  });
  it("copies fields and discards unexpected engine payloads", () => {
    const result = analysis(); Object.assign(result.nodes[0], { privateVector: new Float32Array([1]) });
    const map = projectGlobalSemanticMap(result, semanticIndexRevision(ready)!, 42)!; result.nodes[0].neighbors[0].score = 0;
    expect(map.nodes[0].neighbors[0].score).toBe(1); expect(JSON.stringify(map)).not.toContain("privateVector");
  });
});
