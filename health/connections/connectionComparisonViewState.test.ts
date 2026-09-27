import { describe, expect, it } from "vitest";
import { deriveConnectionComparison } from "./deriveConnectionComparison";
import { semanticMap, topologyMap } from "./testFixtures";
import { candidateReviewSummary, filteredConnectionPairs, isExcalidrawPair, newConnectionComparisonViewState, reviewCandidate, syncConnectionComparison } from "./connectionComparisonViewState";

async function fixture() {
  const semantic = semanticMap(), topology = await topologyMap(), comparison = deriveConnectionComparison(semantic, topology, 1);
  const state = newConnectionComparisonViewState(); syncConnectionComparison(state, comparison);
  return { state, comparison, semantic, topology, candidate: comparison.pairs.find(p => p.category === "candidate")! };
}
describe("session candidate review", () => {
  it("supports the complete verdict lifecycle without changing product evidence", async () => {
    const f = await fixture(), before = structuredClone([f.comparison, f.semantic, f.topology]);
    expect(f.state.reviewByPairId.size).toBe(0);
    for (const verdict of ["useful", "not-useful", "unsure"] as const) {
      reviewCandidate(f.state, f.candidate.id, verdict);
      expect([...f.state.reviewByPairId]).toEqual([[f.candidate.id, verdict]]);
    }
    reviewCandidate(f.state, f.candidate.id); expect(f.state.reviewByPairId.size).toBe(0);
    for (const id of ["missing", f.comparison.pairs.find(p => p.category === "aligned")!.id]) reviewCandidate(f.state, id, "useful");
    expect(f.state.reviewByPairId.size).toBe(0);
    expect(f.state.comparison).toBe(f.comparison); expect(f.state.comparison!.pairs.find(p => p.id === f.candidate.id)).toBe(f.candidate);
    expect([f.comparison, f.semantic, f.topology]).toEqual(before);
  });
  it("summarizes only current candidates, regardless of filters, and clears on a new capture only", async () => {
    const f = await fixture(), candidates = f.comparison.pairs.filter(p => p.category === "candidate");
    reviewCandidate(f.state, candidates[0].id, "useful"); reviewCandidate(f.state, candidates[1].id, "unsure");
    f.state.reviewByPairId.set("removed", "not-useful"); f.state.reviewByPairId.set(f.comparison.pairs[0].id, "not-useful");
    f.state.reviewFilter = "unreviewed"; f.state.query = "nothing";
    expect(candidateReviewSummary(f.state)).toEqual({ reviewed: 2, useful: 1, "not-useful": 0, unsure: 1 });
    syncConnectionComparison(f.state, f.comparison); syncConnectionComparison(f.state, undefined);
    expect(candidateReviewSummary(f.state).reviewed).toBe(2);
    syncConnectionComparison(f.state, deriveConnectionComparison(f.semantic, f.topology, 2));
    expect(f.state.reviewByPairId.size).toBe(0); expect(f.state.reviewFilter).toBe("unreviewed");
  });
  it("combines category, rank, review, query and suffix filtering before paging", async () => {
    const f = await fixture();
    const pairs = [
      { ...f.candidate, id: "match", leftPath: "Join.md", leftBasename: "Join" },
      { ...f.candidate, id: "reviewed", leftPath: "Join reviewed.md", leftBasename: "Join reviewed" },
      { ...f.candidate, id: "drawing", rightPath: "Join.EXCALIDRAW.MD" },
      { ...f.candidate, id: "other-rank", leftPath: "Join.md", semantic: { ...f.candidate.semantic!, rankClass: "one-sided-top-5" as const } },
      { ...f.candidate, id: "other-query" },
      { ...f.candidate, id: "aligned", leftPath: "Join.md", category: "aligned" as const },
    ];
    syncConnectionComparison(f.state, { ...f.comparison, pairs, candidateCount: 5 });
    reviewCandidate(f.state, "reviewed", "useful");
    Object.assign(f.state, { rankFilter: "mutual-top-3", reviewFilter: "unreviewed", query: "JOIN", hideExcalidraw: true, visibleLimit: 50 });
    expect(filteredConnectionPairs(f.state).map(p => p.id)).toEqual(["match"]);
    expect(f.state.comparison!.candidateCount).toBe(5); expect(f.state.comparison!.pairs).toBe(pairs);
    f.state.reviewFilter = "useful"; expect(filteredConnectionPairs(f.state).map(p => p.id)).toEqual(["reviewed"]);
    f.state.category = "aligned"; expect(filteredConnectionPairs(f.state).map(p => p.id)).toEqual(["aligned"]);
  });
  it.each([['Drawing.excalidraw.md', true], ['Drawing.EXCALIDRAW.MD', true], ['my-excalidraw.md', false], ['Drawing.excalidraw.md.backup.md', false]])("only recognizes the exact suffix: %s", async (path, hidden) => {
    const f = await fixture();
    for (const side of ["leftPath", "rightPath"] as const) {
      const pair = { ...f.candidate, [side]: path };
      syncConnectionComparison(f.state, { ...f.comparison, pairs: [pair], candidateCount: 1 });
      f.state.hideExcalidraw = false; expect(filteredConnectionPairs(f.state)).toEqual([pair]);
      expect(isExcalidrawPair(pair)).toBe(hidden);
      f.state.hideExcalidraw = true; expect(filteredConnectionPairs(f.state)).toHaveLength(hidden ? 0 : 1);
      expect(f.state.comparison!.candidateCount).toBe(1);
    }
  });
});
