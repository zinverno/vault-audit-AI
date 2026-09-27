import { describe, expect, it } from "vitest";
import { deriveConnectionComparison } from "./deriveConnectionComparison";
import { semanticMap, topologyMap, rankedSemanticMap, knownTopology } from "./testFixtures";

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
  it.each(["duplicate-semantic-path", "duplicate-topology-path", "duplicate-semantic-pair", "duplicate-topology-edge", "unknown-semantic", "unknown-topology", "self-semantic", "self-topology", "score", "mutual", "neighbor-score", "unknown-neighbor", "duplicate-neighbor", "self-neighbor", "rank-order", "rank-bound", "missing-edge", "link-availability"])("rejects %s without partial results", async kind => {
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
    if (kind === "unknown-neighbor") Object.assign(semantic.nodes[0].neighbors[0], { path: "Unknown.md" });
    if (kind === "duplicate-neighbor") (semantic.nodes[0].neighbors as unknown[]).push(semantic.nodes[0].neighbors[0]);
    if (kind === "self-neighbor") Object.assign(semantic.nodes[0].neighbors[0], { path: "A.md" });
    if (kind === "rank-order") (semantic.nodes[0].neighbors as unknown[]).reverse();
    if (kind === "rank-bound") Object.assign(semantic.nodes[0], { neighbors: Array(6).fill(semantic.nodes[0].neighbors[0]) });
    if (kind === "missing-edge") (semantic.edges as unknown[]).pop();
    if (kind === "link-availability") Object.assign(topology.nodes[0], { linksAvailable: "true" });
    expect(() => deriveConnectionComparison(semantic, topology, 1)).toThrow("Invalid connection comparison input");
  });
});


describe("candidate evidence", () => {
  it("intersects existing top-five lists, canonically sorted, copied and frozen without endpoints", async () => {
    const semantic = rankedSemanticMap({
      "A.md": [["B.md", .99], ["D.md", .9], ["C.md", .8], ["E.md", .7], ["F.md", .6]],
      "B.md": [["A.md", .99], ["D.md", .9], ["C.md", .8], ["X.md", .7], ["Y.md", .6]],
    });
    const result = deriveConnectionComparison(semantic, await knownTopology(semantic), 1);
    const shared = result.pairs.find(p => p.leftPath === "A.md" && p.rightPath === "B.md")!.semantic!.sharedNeighborPaths;
    expect(shared).toEqual(["C.md", "D.md"]); expect(Object.isFrozen(shared)).toBe(true);
    expect(result.pairs.every(p => p.semantic!.sharedNeighborPaths.every(path => path !== p.leftPath && path !== p.rightPath && semantic.nodes.some(n => n.path === path)))).toBe(true);
    Object.assign(semantic.nodes[0].neighbors[1], { path: "Changed.md" }); expect(shared).toEqual(["C.md", "D.md"]);
  });
  it.each([[1, 3, "mutual-top-3"], [2, 5, "mutual-top-5"], [2, undefined, "one-sided-top-5"]] as const)("classifies ranks %s / %s as %s", async (left, right, expected) => {
    const neighbors = (other: string, rank: number | undefined) => rank === undefined ? [] :
      [...Array.from({ length: rank - 1 }, (_, i) => [`Filler${i}.md`, .99 - i * .01] as const), [other, .8] as const];
    const semantic = rankedSemanticMap({ "A.md": neighbors("B.md", left), "B.md": neighbors("A.md", right) });
    const result = deriveConnectionComparison(semantic, await knownTopology(semantic), 1);
    expect(result.pairs.find(p => p.leftPath === "A.md" && p.rightPath === "B.md")!.semantic).toMatchObject({ leftRank: left, rightRank: right, rankClass: expected });
  });
  it("orders by rank class, shared count, exact cosine, then both canonical paths", async () => {
    const lists: Record<string, [string, number][]> = {};
    // Named target pairs have intentionally conflicting score/path/shared-count priorities.
    for (const [name, rank, shared, score] of [["Z", 1, 2, .6], ["Y", 1, 1, .7], ["X", 1, 1, .8], ["W", 1, 0, .9],
      ["V", 5, 0, .95], ["U", 0, 0, .99], ["T", 1, 0, .9]] as const) {
      const a = `${name}/A.md`, b = `${name}/B.md`;
      lists[a] = [[b, score], ...Array.from({ length: shared }, (_, i) => [`${name}/Shared${i}.md`, .1] as [string, number])];
      lists[b] = rank === 0 ? [] : [...Array.from({ length: rank - 1 }, (_, i) => [`${name}/Filler${i}.md`, .999 - i * .001] as [string, number]),
        [a, score], ...Array.from({ length: shared }, (_, i) => [`${name}/Shared${i}.md`, .1] as [string, number])];
    }
    lists["T/A.md"].push(["T/C.md", .9]); lists["T/C.md"] = [["T/A.md", .9]];
    const semantic = rankedSemanticMap(lists), result = deriveConnectionComparison(semantic, await knownTopology(semantic), 1);
    expect(result.pairs.filter(p => p.leftPath.endsWith("/A.md") && /\/[BC]\.md$/.test(p.rightPath)).map(p => [p.leftPath, p.rightPath]))
      .toEqual([["Z/A.md", "Z/B.md"], ["X/A.md", "X/B.md"], ["Y/A.md", "Y/B.md"], ["T/A.md", "T/B.md"], ["T/A.md", "T/C.md"], ["W/A.md", "W/B.md"], ["V/A.md", "V/B.md"], ["U/A.md", "U/B.md"]]);
  });
});
