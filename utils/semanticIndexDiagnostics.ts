import { t } from "../i18n";

/** Transient presentation data only; never persisted or mirrored to Companion. */
export type SemanticIndexFailureReason =
  | "provider-timeout" | "provider-network" | "provider-auth" | "provider-rate-limit"
  | "provider-server" | "provider-request" | "provider-response"
  | "source" | "storage" | "compatibility" | "unknown";

export interface SemanticIndexProgress {
  phase: "reading" | "preparing" | "embedding" | "retrying" | "committing";
  documentsTotal?: number;
  chunksTotal?: number;
  chunksCompleted?: number;
  batchCurrent?: number;
  batchTotal?: number;
  /** Retry number, excluding the initial attempt. */
  retryAttempt?: number;
  retryMaximum?: number;
  retryReason?: "rate-limit" | "server";
}

/** Shape of one finally failed embedding batch; no source or provider payload. */
export interface SemanticRejectedBatchDiagnostic {
  batchCurrent: number;
  batchTotal: number;
  inputCount: number;
  largestInputChars: number;
  totalInputChars: number;
  /** Inputs exceeding the semantic chunker's default hard character limit. */
  oversizedInputCount: number;
}

export function semanticIndexFailureMessage(reason: SemanticIndexFailureReason): string {
  return t(`@semantic.failure.${reason}`);
}

export function reportIndexingProgress(
  listener: ((progress: SemanticIndexProgress) => void) | undefined,
  progress: SemanticIndexProgress,
): void {
  try { listener?.({ ...progress }); }
  catch { /* Presentation cannot change an indexing result. */ }
}
