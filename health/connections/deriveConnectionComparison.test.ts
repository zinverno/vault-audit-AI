import { describe, expect, it } from "vitest";
import { deriveConnectionComparison } from "./deriveConnectionComparison";
import { semanticMap, topologyMap } from "./testFixtures";

describe("connection comparison derivation", () => {
  it("joins canonical pairs with exact ranks, directed links and pair-level coverage", async () => {
    const map = deriveConnectionComparison(semanticMap(), await topologyMap(), 42);
    const pair = (a: string, b: string) => map.pairs.find(p => p.leftPath === a + ".md" && p.rightPath === b + ".md");
    expect(map).toMatchObject({ semanticMappedNoteCount: 7, topologyNoteCount: 7, comparableNoteCount: 5, semanticPairCount: 7,
      candidateCount: 2, alignedCount: 2, explicitOnlyCount: 1, unclassifiedSemanticPairCount: 3, explicitOutsideSemanticMapCount: 1,
      unclassifiedExplicitPairCount: 1, semanticNotesMissingTopologyCount: 1, semanticNotesUnavailableLinksCount: 1 });
    expect(pair("A", "B")).toMatchObject({ category: "candidate", semantic: { score: 0.9, mutualTopK: true, leftRank: 1, rightRank: 1 }, markdown: undefined });
    expect(pair("A", "C")).toMatchObject({ category: "aligned", markdown: { direction: "left-to-right" } });
    expect(pair("B", "C")).toMatchObject({ category: "aligned", markdown: { direction: "reciprocal" } });
    expect(pair("A", "D")).toMatchObject({ category: "explicit-only", markdown: { direction: "right-to-left" }, semantic: undefined });
    expect(pair("C", "D")).toMatchObject({ category: "candidate", semantic: { score: 0.95, mutualTopK: false, leftRank: 1, rightRank: undefined } });
    expect(map.pairs.filter(p => p.category === "candidate").map(p => p.leftPath)).toEqual(["A.md", "C.md"]);
    expect(map.pairs).toHaveLength(5); expect(pair("D", "E")).toBeUndefined(); expect(pair("F", "G")).toBeUndefined();
    expect(Object.isFrozen(map) && Object.isFrozen(map.pairs) && Object.isFrozen(map.semanticRevision)).toBe(true);
    for (const p of map.pairs) expect(Object.isFrozen(p) && (!p.semantic || Object.isFrozen(p.semantic)) && (!p.markdown || Object.isFrozen(p.markdown))).toBe(true);
  });
  it("is deterministic across source node/edge order and preserves inputs", async () => {
    const semantic = semanticMap(), topology = await topologyMap(), before = JSON.stringify([semantic, topology]);
    const result = deriveConnectionComparison(semantic, topology, 1);
    expect(deriveConnectionComparison({ ...semantic, nodes: [...semantic.nodes].reverse(), edges: [...semantic.edges].reverse() },
      { ...topology, nodes: [...topology.nodes].reverse(), edges: [...topology.edges].reverse() }, 1)).toEqual(result);
    expect(JSON.stringify([semantic, topology])).toBe(before);
  });
  it("does not count reciprocal outside-map edges twice, or guess reverse direction with unavailable metadata", async () => {
    const topology = await topologyMap();
    const result = deriveConnectionComparison(semanticMap(), { ...topology, edges: [...topology.edges, { source: "X.md", target: "A.md" }] }, 1);
    expect(result.explicitOutsideSemanticMapCount).toBe(1);
    expect(result.unclassifiedExplicitPairCount).toBe(1);
    expect(result.pairs.some(p => p.rightPath === "E.md")).toBe(false);
  });
  it.each(["duplicate-semantic-path", "duplicate-topology-path", "duplicate-semantic-pair", "duplicate-topology-edge", "unknown-semantic", "unknown-topology", "self-semantic", "self-topology", "score", "mutual", "neighbor-score", "rank-order", "rank-bound", "missing-edge", "link-availability"])("rejects %s without partial results", async kind => {
    const semantic = structuredClone(semanticMap()), topology = structuredClone(await topologyMap());
    if (kind === "duplicate-semantic-path") (semantic.nodes as unknown[]).push(semantic.nodes[0]);
    if (kind === "duplicate-topology-path") (topology.nodes as unknown[]).push(topology.nodes[0]);
    if (kind === "duplicate-semantic-pair") (semantic.edges as unknown[]).push(semantic.edges[0]);
    if (kind === "duplicate-topology-edge") (topology.edges as unknown[]).push(topology.edges[0]);
    if (kind === "unknown-semantic") Object.assign(semantic.edges[0], { right: "Z.md" });
    if (kind === "unknown-topology") Object.assign(topology.edges[0], { target: "Z.md" });
    if (kind === "self-semantic") Object.assign(semantic.edges[0], { right: "A.md" });
    if (kind === "self-topology") Object.assign(topology.edges[0], { target: topology.edges[0].source });
    if (kind === "score") Object.assign(semantic.edges[0], { score: NaN });
    if (kind === "mutual") Object.assign(semantic.edges[0], { mutual: false });
    if (kind === "neighbor-score") Object.assign(semantic.nodes[0].neighbors[0], { score: 0.99 });
    if (kind === "rank-order") (semantic.nodes[0].neighbors as unknown[]).reverse();
    if (kind === "rank-bound") Object.assign(semantic.nodes[0], { neighbors: Array(6).fill(semantic.nodes[0].neighbors[0]) });
    if (kind === "missing-edge") (semantic.edges as unknown[]).pop();
    if (kind === "link-availability") Object.assign(topology.nodes[0], { linksAvailable: "true" });
    expect(() => deriveConnectionComparison(semantic, topology, 1)).toThrow("Invalid connection comparison input");
  });
});
