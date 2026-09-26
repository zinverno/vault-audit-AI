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
