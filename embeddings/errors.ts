import { t } from "../i18n";

export type EmbeddingErrorCode =
  | "timeout" | "network" | "auth" | "rate-limit" | "server" | "request" | "invalid-response";

/** Only fixed copy, a code and an optional HTTP status cross the transport boundary. */
export class EmbeddingError extends Error {
  constructor(readonly code: EmbeddingErrorCode, readonly status?: number) {
    super(t(`@embedding.error.${code}`));
    this.name = "EmbeddingError";
  }
}
