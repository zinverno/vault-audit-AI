import type { SemanticNeighborhoodNode } from "../semanticNeighborhoodPort";
import { compareStrings } from "../domain/validation";

/** Fixed normalized chord distance between unit vectors. The square root makes
 * high-similarity differences visible without scaling by this result's ranks/range.
 * A 100-unit inner clearance keeps even identical neighbors away from the source.
 */
export const semanticNeighborhoodRadius = (score: number): number => 100 + 310 * Math.sqrt((1 - score) / 2);

export function semanticNeighborhoodLayout(source: Pick<SemanticNeighborhoodNode, "id">,
  neighbors: readonly Pick<SemanticNeighborhoodNode, "id" | "path" | "similarity">[]) {
  const sorted = [...neighbors].sort((a, b) => b.similarity! - a.similarity! || compareStrings(a.path, b.path));
  return Object.freeze([
    Object.freeze({ id: source.id, x: 500, y: 500 }),
    ...sorted.map((node, index) => {
      const radius = semanticNeighborhoodRadius(node.similarity!);
      const angle = -Math.PI / 2 + index * 2 * Math.PI / sorted.length;
      return Object.freeze({ id: node.id, x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius });
    }),
  ]);
}
