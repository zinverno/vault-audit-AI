import { compareStrings, isVaultPath } from "../../health/domain/validation";
import type { SemanticNeighborhoodMap, SemanticNeighborhoodNode, SemanticNeighborhoodRevision } from "../../health/semanticNeighborhoodPort";
import { DEFAULT_MATCHES_PER_DOCUMENT, DEFAULT_SIMILAR_NOTES_LIMIT } from "../semanticDiscoveryService";
import type { SemanticChunkMatch, SemanticDocumentSimilarity } from "../types";

export { semanticIndexRevision as neighborhoodRevision, sameSemanticIndexRevision as sameNeighborhoodRevision } from "../semanticIndexRevision";
export class InvalidNeighborhoodResult extends Error {}
function requireValid(valid: boolean): asserts valid {
  if (!valid) throw new InvalidNeighborhoodResult();
}
function score(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
}
export function neighborhoodBasename(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/i, "") || path;
}
export function projectNeighborhood(sourcePath: string, results: readonly SemanticDocumentSimilarity[], catalog: readonly string[],
  revision: SemanticNeighborhoodRevision, capturedAt: number): SemanticNeighborhoodMap {
  requireValid(isVaultPath(sourcePath) && catalog.includes(sourcePath));
  requireValid(Array.isArray(results) && results.length <= DEFAULT_SIMILAR_NOTES_LIMIT);
  const seen = new Set([sourcePath]);
  const neighbors = Array.from(results, (result: SemanticDocumentSimilarity): SemanticNeighborhoodNode => {
    requireValid(Boolean(result) && isVaultPath(result.path) && catalog.includes(result.path) && !seen.has(result.path) && score(result.score));
    seen.add(result.path);
    requireValid(Array.isArray(result.matches) && result.matches.length <= DEFAULT_MATCHES_PER_DOCUMENT);
    const matchIds = new Set<string>();
    const evidence = Array.from(result.matches, (match: SemanticChunkMatch) => {
      requireValid(Boolean(match) && match.path === result.path && typeof match.id === "string" && !!match.id && !matchIds.has(match.id) &&
        typeof match.contentHash === "string" && !!match.contentHash && Number.isSafeInteger(match.ordinal) && match.ordinal >= 0 && score(match.score));
      matchIds.add(match.id);
      requireValid(Array.isArray(match.headingPath) && Array.from(match.headingPath).every((s) => typeof s === "string" && !s.includes("\0")) &&
        (match.preview === undefined || typeof match.preview === "string" && !match.preview.includes("\0")));
      const range = match.source;
      requireValid(Boolean(range) && [range.startLine, range.endLine, range.startOffset, range.endOffset].every((n) => Number.isSafeInteger(n) && n >= 0) &&
        range.endLine >= range.startLine && range.endOffset >= range.startOffset);
      return Object.freeze({ headingPath: Object.freeze([...match.headingPath]),
        ...(match.preview === undefined ? {} : { preview: match.preview }), startLine: range.startLine, endLine: range.endLine, score: match.score });
    });
    return Object.freeze({ id: result.path, path: result.path, basename: neighborhoodBasename(result.path), role: "neighbor",
      similarity: result.score, evidence: Object.freeze(evidence) });
  }).sort((a, b) => b.similarity! - a.similarity! || compareStrings(a.path, b.path));
  const source: SemanticNeighborhoodNode = Object.freeze({ id: sourcePath, path: sourcePath, basename: neighborhoodBasename(sourcePath), role: "source", evidence: Object.freeze([]) });
  return Object.freeze({ revision: Object.freeze({ ...revision }), source, neighbors: Object.freeze(neighbors),
    edges: Object.freeze(neighbors.map((n) => Object.freeze({ source: sourcePath, target: n.path, score: n.similarity! }))),
    indexedNoteCount: catalog.length, capturedAt });
}
