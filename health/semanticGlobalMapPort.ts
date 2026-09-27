import type { SemanticIndexRevision } from "./semanticHealthAnalysisPort";

export interface SemanticGlobalNode {
  readonly id: string;
  readonly path: string;
  readonly basename: string;
  readonly coreSimilarity: number;
  readonly semanticConnectedness: number | null;
  readonly neighbors: readonly Readonly<{ path: string; score: number }>[];
}
export interface SemanticGlobalEdge {
  readonly left: string;
  readonly right: string;
  readonly score: number;
  readonly mutual: boolean;
}
export interface SemanticGlobalMap {
  readonly revision: Readonly<SemanticIndexRevision>;
  readonly indexedNoteCount: number;
  readonly mappedNoteCount: number;
  readonly nodes: readonly SemanticGlobalNode[];
  readonly edges: readonly SemanticGlobalEdge[];
  readonly capturedAt: number;
}
export interface SemanticGlobalMapProductSnapshot {
  readonly state: "idle" | "loading" | "ready" | "stale" | "unavailable" | "error";
  readonly busy: boolean;
  readonly reason?: "too-large" | "core-unavailable" | "unavailable" | "changed" | "invalid" | "failed";
  readonly supportedNoteCount: number;
  readonly indexedNoteCount?: number;
  readonly mappedNoteCount?: number;
  readonly progress?: Readonly<{ completedPairs: number; totalPairs: number }>;
  readonly map?: SemanticGlobalMap;
}
export interface SemanticGlobalSearchResult { readonly nodes: readonly SemanticGlobalNode[]; readonly total: number }
/** Explicit, read-only, session-only exploration. No setup, persistence or index mutation API. */
export interface SemanticGlobalMapPort {
  getSnapshot(): SemanticGlobalMapProductSnapshot;
  subscribe(listener: () => void): () => void;
  load(): Promise<void>;
  refresh(): Promise<void>;
  search(query: string): SemanticGlobalSearchResult;
  dispose(): void;
}
