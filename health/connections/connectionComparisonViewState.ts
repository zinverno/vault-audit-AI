import type { CandidateRankClass, ConnectionComparisonCategory, ConnectionComparisonPair, ConnectionComparisonSnapshot } from "../connectionComparisonPort";

export type CandidateReview = "useful" | "not-useful" | "unsure";
export interface ConnectionComparisonViewState {
  category: ConnectionComparisonCategory;
  rankFilter: "all" | CandidateRankClass;
  reviewFilter: "all" | "unreviewed" | CandidateReview;
  hideExcalidraw: boolean;
  query: string;
  selectedPair?: string;
  visibleLimit: number;
  reviewByPairId: Map<string, CandidateReview>;
  comparison?: ConnectionComparisonSnapshot;
}
export function newConnectionComparisonViewState(): ConnectionComparisonViewState {
  return { category: "candidate", rankFilter: "all", reviewFilter: "all", hideExcalidraw: false,
    query: "", visibleLimit: 50, reviewByPairId: new Map() };
}
/** Failed refresh/staleness retains the capture. A newly published capture clears its reviews. */
export function syncConnectionComparison(state: ConnectionComparisonViewState, comparison: ConnectionComparisonSnapshot | undefined): void {
  if (!comparison || comparison === state.comparison) return;
  state.comparison = comparison;
  state.reviewByPairId.clear();
}
export function reviewCandidate(state: ConnectionComparisonViewState, id: string, verdict?: CandidateReview): void {
  if (!state.comparison?.pairs.some(pair => pair.id === id && pair.category === "candidate")) return;
  if (verdict) state.reviewByPairId.set(id, verdict);
  else state.reviewByPairId.delete(id);
}
export function candidateReviewSummary(state: ConnectionComparisonViewState): Record<CandidateReview | "reviewed", number> {
  const counts = { reviewed: 0, useful: 0, "not-useful": 0, unsure: 0 };
  for (const pair of state.comparison?.pairs ?? []) {
    const review = state.reviewByPairId.get(pair.id);
    if (pair.category === "candidate" && review) { counts.reviewed++; counts[review]++; }
  }
  return counts;
}
/** A presentation convenience for the observed suffix, not a semantic classification. */
export function isExcalidrawPair(pair: ConnectionComparisonPair): boolean {
  return [pair.leftPath, pair.rightPath].some(path => path.toLowerCase().endsWith(".excalidraw.md"));
}
export function filteredConnectionPairs(state: ConnectionComparisonViewState): readonly ConnectionComparisonPair[] {
  const needle = state.query.trim().toLowerCase();
  return (state.comparison?.pairs ?? []).filter(pair => pair.category === state.category &&
    (state.category === "explicit-only" || state.rankFilter === "all" || pair.semantic?.rankClass === state.rankFilter) &&
    (state.category !== "candidate" || (state.reviewFilter === "all" ||
      (state.reviewFilter === "unreviewed" ? !state.reviewByPairId.has(pair.id) : state.reviewByPairId.get(pair.id) === state.reviewFilter)) &&
      (!state.hideExcalidraw || !isExcalidrawPair(pair))) &&
    [pair.leftBasename, pair.leftPath, pair.rightBasename, pair.rightPath].some(text => text.toLowerCase().includes(needle)));
}
