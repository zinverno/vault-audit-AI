import { EmbeddingError } from "../embeddings/errors";
import { IndexingCompatibilityError, IndexingProviderError, IndexingSourceError, IndexingValidationError } from "../indexing/errors";
import { VectorStoreCompatibilityError, VectorStoreError } from "../vectorStore/errors";
import type { SemanticIndexFailureReason } from "../utils/semanticIndexDiagnostics";
import { SemanticCompatibilityError, SemanticStorageError } from "./errors";

export function classifyIndexingFailure(error: unknown): SemanticIndexFailureReason {
  if (error instanceof IndexingCompatibilityError || error instanceof SemanticCompatibilityError
    || error instanceof VectorStoreCompatibilityError) return "compatibility";
  if (error instanceof IndexingProviderError) return classifyIndexingFailure(error.cause);
  if (error instanceof EmbeddingError) {
    return error.code === "invalid-response" ? "provider-response" : `provider-${error.code}`;
  }
  if (error instanceof IndexingSourceError || error instanceof IndexingValidationError) return "source";
  if (error instanceof SemanticStorageError || error instanceof VectorStoreError) return "storage";
  return "unknown";
}
