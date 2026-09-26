import type { SemanticNeighborhoodNode } from "../semanticNeighborhoodPort";
import { compareStrings } from "../domain/validation";

/** Fixed encoding: radius = 190 + (1 - (cosine + 1) / 2) * 220.
 * Scores [-1, 1] map to radii [410, 190]. Only angles distribute neighbors.
 */
export function semanticNeighborhoodLayout(source: Pick<SemanticNeighborhoodNode, "id">,
  neighbors: readonly Pick<SemanticNeighborhoodNode, "id" | "path" | "similarity">[]) {
  const sorted = [...neighbors].sort((a, b) => b.similarity! - a.similarity! || compareStrings(a.path, b.path));
  return Object.freeze([
    Object.freeze({ id: source.id, x: 500, y: 500 }),
    ...sorted.map((node, index) => {
      const radius = 190 + (1 - (node.similarity! + 1) / 2) * 220;
      const angle = -Math.PI / 2 + index * 2 * Math.PI / sorted.length;
      return Object.freeze({ id: node.id, x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius });
    }),
  ]);
}
