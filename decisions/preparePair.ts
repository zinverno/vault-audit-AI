import { stableHash } from "../chunking/hash";
import { isCanonicalMarkdownPath, outboundChunkText, reconstructChunks } from "../chunking/reconstructChunks";
import type { ChunkingStrategy } from "../chunking/types";
import type { MarkdownDocumentSource } from "../indexing/types";
import type { SemanticDuplicatePair } from "../semantic/types";
import { DecisionsError } from "./openRouterDecisions";
import { DECISIONS_LIMITS } from "./types";
import type { PreparedFragment, PreparedPair } from "./types";

export async function preparePair(pair: SemanticDuplicatePair, source: MarkdownDocumentSource,
  chunker: ChunkingStrategy, isCurrent: () => boolean, allowed: (path: string) => boolean): Promise<PreparedPair> {
  const sides = [[pair.leftPath, pair.leftMatches], [pair.rightPath, pair.rightMatches]] as const;
  const fragments: PreparedFragment[] = [];
  try {
    if (pair.leftPath === pair.rightPath) throw new DecisionsError("stale");
    for (const [index, [path, matches]] of sides.entries()) {
      if (!isCurrent() || !isCanonicalMarkdownPath(path) || !allowed(path)) throw new DecisionsError("stale");
      const selection = await source.readPaths([path]);
      if (!isCurrent() || !allowed(path)) throw new DecisionsError("stale");
      const document = selection.documents.find(item => item.path === path);
      if (!document) throw new DecisionsError("stale");
      const chunks = reconstructChunks(document, chunker);
      for (const match of [...matches].sort((a, b) => b.score - a.score || a.ordinal - b.ordinal)) {
        const chunk = chunks.get(match.id);
        if (match.path !== path || !chunk || chunk.contentHash !== match.contentHash) continue;
        const text = outboundChunkText(chunker, chunk);
        if (text === undefined) continue;
        const points = Array.from(text);
        fragments.push({ match: { ...match, source: { ...chunk.source }, headingPath: [...chunk.headingPath] },
          text: points.slice(0, DECISIONS_LIMITS.fragmentCodePoints).join(""),
          truncated: points.length > DECISIONS_LIMITS.fragmentCodePoints, sourceHash: stableHash(document.content) });
        break;
      }
      if (fragments.length !== index + 1) throw new DecisionsError("stale");
    }
    if (!isCurrent()) throw new DecisionsError("stale");
    return { a: fragments[0], b: fragments[1] };
  } catch { throw new DecisionsError("stale"); }
}
