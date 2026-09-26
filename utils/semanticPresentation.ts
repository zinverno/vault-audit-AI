export function formatSemanticScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(3) : "—";
}
