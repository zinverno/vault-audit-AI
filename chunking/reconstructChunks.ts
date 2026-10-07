import type { ChunkingStrategy, MarkdownChunkInput, NoteChunk } from "./types";

export function isCanonicalMarkdownPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes("\0") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    !value.toLowerCase().endsWith(".md")
  ) {
    return false;
  }
  return !value
    .split("/")
    .some((segment) => !segment || segment === "." || segment === "..");
}

function chunkIsValid(
  chunk: NoteChunk,
  path: string,
  contentLength: number,
  lineCount: number,
): boolean {
  return (
    chunk &&
    chunk.path === path &&
    typeof chunk.id === "string" &&
    chunk.id.length > 0 &&
    typeof chunk.contentHash === "string" &&
    chunk.contentHash.length > 0 &&
    typeof chunk.text === "string" &&
    chunk.text.length > 0 &&
    Array.isArray(chunk.headingPath) &&
    chunk.headingPath.every((heading) => typeof heading === "string") &&
    Number.isSafeInteger(chunk.ordinal) &&
    chunk.ordinal >= 0 &&
    Boolean(chunk.source) &&
    Number.isSafeInteger(chunk.source.startOffset) &&
    Number.isSafeInteger(chunk.source.endOffset) &&
    Number.isSafeInteger(chunk.source.startLine) &&
    Number.isSafeInteger(chunk.source.endLine) &&
    chunk.source.startOffset >= 0 &&
    chunk.source.endOffset >= chunk.source.startOffset &&
    chunk.source.endOffset <= contentLength &&
    chunk.source.startLine >= 0 &&
    chunk.source.endLine >= chunk.source.startLine &&
    chunk.source.endLine < lineCount
  );
}

/** Re-chunk current content; indexed offsets and previews are never text sources. */
export function reconstructChunks(document: MarkdownChunkInput, chunker: ChunkingStrategy): Map<string, NoteChunk> {
  const chunks = chunker.chunk(document);
  const lineCount = document.content.split("\n").length;
  const byId = new Map<string, NoteChunk>();
  for (const chunk of chunks) {
    if (chunkIsValid(chunk, document.path, document.content.length, lineCount) && !byId.has(chunk.id)) {
      byId.set(chunk.id, chunk);
    }
  }
  return byId;
}
