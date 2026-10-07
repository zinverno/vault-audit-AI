import { isCanonicalMarkdownPath, reconstructChunks } from "../chunking/reconstructChunks";
import type { ChunkingStrategy } from "../chunking/types";
import type { MarkdownDocumentSource } from "../indexing/types";
import type { SemanticDocumentResult } from "../semantic/types";
import { RERANK_LIMITS } from "./types";
import type { PreparedRerankCandidate } from "./types";

export async function prepareRerankCandidates(
  results: readonly SemanticDocumentResult[], source: MarkdownDocumentSource,
  chunker: ChunkingStrategy, isCurrent: () => boolean,
): Promise<PreparedRerankCandidate[]> {
  const prepared: PreparedRerankCandidate[] = [];
  for (const [originalOrder, document] of results.slice(0, RERANK_LIMITS.candidates).entries()) {
    if (!isCurrent()) break;
    if (!isCanonicalMarkdownPath(document.path)) continue;
    try {
      const selection = await source.readPaths([document.path]);
      if (!isCurrent()) break;
      const current = selection.documents.find(item => item.path === document.path);
      if (!current) continue;
      const chunks = reconstructChunks(current, chunker);
      const matches = [...document.matches].sort((a, b) => b.score - a.score || a.ordinal - b.ordinal);
      for (const match of matches) {
        const chunk = chunks.get(match.id);
        if (match.path !== document.path || !chunk || chunk.contentHash !== match.contentHash || !chunk.text.trim()) continue;
        prepared.push({ document, chunkId: chunk.id, originalOrder,
          match: { ...match, source: { ...chunk.source }, headingPath: [...chunk.headingPath] },
          text: Array.from(chunk.text).slice(0, RERANK_LIMITS.fragmentCodePoints).join("") });
        break;
      }
    } catch { /* Unreadable/stale text remains unscored, never replaced by the whole note. */ }
  }
  return prepared;
}
