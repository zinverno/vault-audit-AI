import type { SemanticChunkMatch } from "../semantic/types";

export interface DecisionsSettings {
  enabled: boolean;
  provider: "openrouter";
  model: string;
  apiKey: string;
}
export const DEFAULT_DECISIONS_SETTINGS: DecisionsSettings = {
  enabled: false, provider: "openrouter", model: "typesafe/jev-1.13", apiKey: "",
};
export function mergeDecisionsSettings(stored?: Partial<DecisionsSettings> | null): DecisionsSettings {
  return { enabled: stored?.enabled === true, provider: "openrouter",
    model: typeof stored?.model === "string" ? stored.model : DEFAULT_DECISIONS_SETTINGS.model,
    apiKey: typeof stored?.apiKey === "string" ? stored.apiKey : "" };
}
export const DECISIONS_LIMITS = { fragmentCodePoints: 4000, payloadBytes: 64 * 1024,
  timeoutMs: 15_000, modelLength: 200 } as const;
export const CRITERIA_VERSION = "overlap-v1";
export const OVERLAP_CRITERIA = {
  same_information: "Essentially the same claims and caveats, possibly paraphrased or translated. No substantive addition or contradiction in the supplied text.",
  partial_overlap: "Shared information, but one or both fragments also contain substantial additional information or differences.",
  related_distinct: "Related topic, but different main information. Opposing claims about the same issue belong here, never to same_information.",
  unrelated: "No substantive information overlap or meaningful topical relationship in the supplied text.",
  insufficient_context: "The supplied fragments are too incomplete, unclear or context-dependent to justify a substantive category.",
} as const;
export type OverlapCategory = keyof typeof OVERLAP_CRITERIA;
export const OVERLAP_CATEGORIES = Object.keys(OVERLAP_CRITERIA) as OverlapCategory[];
export interface OverlapState { fragmentA: string; fragmentB: string }
export interface OverlapAnswer {
  choice: OverlapCategory;
  probabilities: Record<OverlapCategory, number>;
  confidence: number;
  tied: OverlapCategory[];
  requestedModel: string;
  resolvedModel?: string;
  criteriaVersion: typeof CRITERIA_VERSION;
}
export interface DecisionsProvider {
  assess(state: OverlapState, signal: AbortSignal): Promise<OverlapAnswer>;
}
export interface PreparedFragment {
  match: SemanticChunkMatch;
  text: string;
  truncated: boolean;
  sourceHash: string;
}
export interface PreparedPair { a: PreparedFragment; b: PreparedFragment }
