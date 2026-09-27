import type { SemanticIndexRevision } from "../health/semanticHealthAnalysisPort";
import type { SemanticIndexState } from "./types";

/** Same readiness and seven-field identity semantics as SemanticHealthAnalysisAdapter. */
export function semanticIndexRevision(state: SemanticIndexState): SemanticIndexRevision | undefined {
  if (state.kind !== "ready" || !Number.isSafeInteger(state.vectorCount) || state.vectorCount <= 0 ||
      !Number.isSafeInteger(state.dimensions) || state.dimensions <= 0 ||
      ![state.vectorGeneration, state.configurationRevision, state.runtimeRevision].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      typeof state.provider !== "string" || !state.provider || typeof state.model !== "string" || !state.model) return undefined;
  return Object.freeze({ vectorGeneration: state.vectorGeneration, vectorCount: state.vectorCount, dimensions: state.dimensions,
    provider: state.provider, model: state.model, configurationRevision: state.configurationRevision, runtimeRevision: state.runtimeRevision });
}
export function sameSemanticIndexRevision(a: SemanticIndexRevision | undefined, b: SemanticIndexRevision | undefined): boolean {
  return Boolean(a && b && a.vectorGeneration === b.vectorGeneration && a.vectorCount === b.vectorCount &&
    a.dimensions === b.dimensions && a.provider === b.provider && a.model === b.model &&
    a.configurationRevision === b.configurationRevision && a.runtimeRevision === b.runtimeRevision);
}
