import { describe, expect, it, vi } from "vitest";
import type { SemanticGlobalMapPort, SemanticGlobalMapProductSnapshot } from "../semanticGlobalMapPort";
import type { VaultTopologyPort, VaultTopologyProductSnapshot } from "../topology/types";
import { ConnectionComparisonController } from "./connectionComparisonController";
import { semanticMap, topologyMap } from "./testFixtures";

async function fixture(ready = true) {
  const semanticReady: SemanticGlobalMapProductSnapshot = { state: "ready", busy: false, supportedNoteCount: 500, map: semanticMap() };
  const topologyReady: VaultTopologyProductSnapshot = { state: "ready", map: await topologyMap() };
  let semanticSnapshot: SemanticGlobalMapProductSnapshot = ready ? semanticReady : { state: "idle", busy: false, supportedNoteCount: 500 };
  let topologySnapshot: VaultTopologyProductSnapshot = ready ? topologyReady : { state: "idle" };
  const semanticListeners = new Set<() => void>(), topologyListeners = new Set<() => void>();
  const setSemantic = (value: SemanticGlobalMapProductSnapshot) => { semanticSnapshot = value; for (const l of semanticListeners) l(); };
  const setTopology = (value: VaultTopologyProductSnapshot) => { topologySnapshot = value; for (const l of topologyListeners) l(); };
  const semantic = { getSnapshot: () => semanticSnapshot,
    subscribe: l => { semanticListeners.add(l); return () => { semanticListeners.delete(l); }; },
    load: vi.fn(async () => { setSemantic(semanticReady); }), refresh: vi.fn(async () => { setSemantic(semanticReady); }),
    focus: vi.fn(async () => {}), resetFocus: vi.fn(), search: vi.fn(() => ({ nodes: [], total: 0 })), dispose: vi.fn() } satisfies SemanticGlobalMapPort;
  const topology = { getSnapshot: () => topologySnapshot,
    subscribe: l => { topologyListeners.add(l); return () => { topologyListeners.delete(l); }; },
    load: vi.fn(async () => { setTopology(topologyReady); }), refresh: vi.fn(async () => { setTopology(topologyReady); }), dispose: vi.fn() } satisfies VaultTopologyPort;
  const controller = new ConnectionComparisonController(semantic, topology);
  return { controller, semantic, topology, semanticReady, topologyReady, setSemantic, setTopology, semanticListeners, topologyListeners };
}
describe("session comparison ownership", () => {
  it("construction is passive; explicit load coalesces and reuses ready sources", async () => {
    const f = await fixture();
    expect(f.controller.getSnapshot().state).toBe("idle");
    for (const p of [f.semantic, f.topology]) expect(p.load).not.toHaveBeenCalled();
    const first = f.controller.load(); expect(f.controller.load()).toBe(first); await first;
    expect(f.controller.getSnapshot().state).toBe("ready");
    const result = f.controller.getSnapshot(); await f.controller.load(); expect(f.controller.getSnapshot()).toBe(result);
    for (const p of [f.semantic, f.topology]) { expect(p.load).not.toHaveBeenCalled(); expect(p.refresh).not.toHaveBeenCalled(); }
  });
  it("loads absent sources only on explicit action", async () => {
    const f = await fixture(false); await f.controller.load();
    expect(f.controller.getSnapshot().state).toBe("ready");
    for (const p of [f.semantic, f.topology]) expect(p.load).toHaveBeenCalledOnce();
  });
  it.each(["semantic", "topology"] as const)("marks %s stale without auto work and explicitly refreshes both", async source => {
    const f = await fixture(); await f.controller.load(); const result = f.controller.getSnapshot().comparison;
    if (source === "semantic") f.setSemantic({ ...f.semanticReady, state: "stale" });
    else f.setTopology({ ...f.topologyReady, state: "stale" });
    expect(f.controller.getSnapshot()).toMatchObject({ state: "stale", reason: `${source}-stale`, comparison: result });
    await f.controller.load();
    for (const p of [f.semantic, f.topology]) expect(p.refresh).not.toHaveBeenCalled();
    await f.controller.refresh(); expect(f.controller.getSnapshot().state).toBe("ready");
    for (const p of [f.semantic, f.topology]) expect(p.refresh).toHaveBeenCalledOnce();
  });
  it("does not silently refresh an initially stale topology", async () => {
    const f = await fixture(); f.setTopology({ ...f.topologyReady, state: "stale" }); await f.controller.load();
    expect(f.controller.getSnapshot().reason).toBe("topology-stale"); expect(f.topology.load).not.toHaveBeenCalled();
  });
  it("ignores core/focus/reset changes with the same map and revision", async () => {
    const f = await fixture(); await f.controller.load(); const result = f.controller.getSnapshot();
    f.setSemantic({ ...f.semanticReady, busy: true, focusing: true }); expect(f.controller.getSnapshot()).toBe(result);
    f.setSemantic({ ...f.semanticReady, focus: { path: "A.md", scores: [] } }); expect(f.controller.getSnapshot()).toBe(result);
    f.setSemantic(f.semanticReady); expect(f.controller.getSnapshot()).toBe(result);
  });
  it.each(["vectorGeneration", "vectorCount", "dimensions", "provider", "model", "configurationRevision", "runtimeRevision"] as const)("honors semantic revision field %s", async field => {
    const f = await fixture(); await f.controller.load(); const map = f.semanticReady.map!;
    const revision = { ...map.revision, [field]: typeof map.revision[field] === "number" ? Number(map.revision[field]) + 1 : "changed" };
    f.setSemantic({ ...f.semanticReady, map: { ...map, revision } }); expect(f.controller.getSnapshot().state).toBe("stale");
  });
  it.each(["semantic", "topology", "dispose"])("rejects late publication on %s change during derivation", async source => {
    const f = await fixture();
    // A getter schedules the change after derivation, before its publication microtask.
    const map = f.semanticReady.map!;
    let queued = false;
    const raced = { ...map, get nodes() {
      if (!queued) { queued = true; queueMicrotask(() => {
        if (source === "dispose") f.controller.dispose();
        else if (source === "semantic") f.setSemantic({ ...f.semanticReady, map: { ...map, revision: { ...map.revision, vectorGeneration: 2 } } });
        else f.setTopology({ ...f.topologyReady, map: { ...f.topologyReady.map!, revision: { ...f.topologyReady.map!.revision, signature: "changed" } } });
      }); }
      return map.nodes;
    } };
    f.setSemantic({ ...f.semanticReady, map: raced });
    await f.controller.load(); expect(f.controller.getSnapshot().state).toBe(source === "dispose" ? "idle" : "stale");
    expect(f.controller.getSnapshot().comparison).toBeUndefined();
  });
  it("disposes during source load and removes listeners without disposing shared sources", async () => {
    const f = await fixture(false); let resolve!: () => void;
    vi.mocked(f.semantic.load).mockImplementation(() => new Promise<void>(r => { resolve = r; }));
    const pending = f.controller.load(); await Promise.resolve(); f.controller.dispose();
    resolve(); await pending;
    expect(f.controller.getSnapshot().state).toBe("idle"); expect(f.semanticListeners.size + f.topologyListeners.size).toBe(0);
    for (const p of [f.semantic, f.topology]) expect(p.dispose).not.toHaveBeenCalled();
  });
  it("does not establish freshness from incomplete inventory, even with matching revisions", async () => {
    const f = await fixture(); f.setTopology({ ...f.topologyReady, map: { ...f.topologyReady.map!, revision: { ...f.topologyReady.map!.revision, complete: false } } });
    await f.controller.load(); expect(f.controller.getSnapshot().state).toBe("stale");
  });
  it("fails closed on unavailable and malformed source results", async () => {
    const f = await fixture(false);
    vi.mocked(f.semantic.load).mockImplementation(async () => { f.setSemantic({ ...f.semanticReady, state: "unavailable" }); });
    await f.controller.load(); expect(f.controller.getSnapshot().state).toBe("unavailable");
    f.setSemantic({ ...f.semanticReady, map: { ...f.semanticReady.map!, edges: [] } });
    await f.controller.load(); expect(f.controller.getSnapshot().state).toBe("error");
  });
});
