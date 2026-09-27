import { compareStrings } from "../domain/validation";
import type { SemanticGlobalMap } from "../semanticGlobalMapPort";

/** Fixed cosine encodings, never rank-scaled. Layout affects angles only. */
export const semanticCoreRadius = (score: number): number => 120 + (1 - (score + 1) / 2) * 290;
export const semanticNodeRadius = (score: number | null): number => score === null ? 4 : 4 + (score + 1) / 2 * 5;

export function semanticGlobalMapLayout(map: SemanticGlobalMap) {
  const nodes = new Map(map.nodes.map((node) => [node.path, node]));
  const parents = new Map(map.nodes.map((node) => [node.path, node.path]));
  const rootOf = (path: string): string => {
    let root = path;
    while (parents.get(root) !== root) root = parents.get(root)!;
    while (path !== root) { const next = parents.get(path)!; parents.set(path, root); path = next; }
    return root;
  };
  const forest = new Map(map.nodes.map((node) => [node.path, [] as Array<{ path: string; score: number }>]));
  for (const edge of [...map.edges].sort((a, b) => b.score - a.score || compareStrings(a.left, b.left) || compareStrings(a.right, b.right))) {
    const left = rootOf(edge.left); const right = rootOf(edge.right);
    if (left === right) continue;
    parents.set(right, left);
    forest.get(edge.left)!.push({ path: edge.right, score: edge.score });
    forest.get(edge.right)!.push({ path: edge.left, score: edge.score });
  }
  for (const adjacent of forest.values()) adjacent.sort((a, b) => b.score - a.score || compareStrings(a.path, b.path));
  const groups = new Map<string, string[]>();
  for (const node of map.nodes) { const root = rootOf(node.path); const group = groups.get(root) ?? []; group.push(node.path); groups.set(root, group); }
  const trees = [...groups.values()].map((paths) => paths.sort((a, b) =>
    (nodes.get(b)!.semanticConnectedness ?? -1) - (nodes.get(a)!.semanticConnectedness ?? -1) || compareStrings(a, b)))
    .sort((a, b) => compareStrings(a[0], b[0]));
  const sizes = new Map<string, number>();
  const children = new Map<string, string[]>();
  const measure = (path: string, parent?: string): number => {
    const descendants = forest.get(path)!.filter((item) => item.path !== parent).map((item) => item.path);
    children.set(path, descendants);
    const size = 1 + descendants.reduce((sum, child) => sum + measure(child, path), 0); sizes.set(path, size); return size;
  };
  const points: Array<Readonly<{ path: string; x: number; y: number; radius: number; distance: number; angle: number; sectorStart: number; sectorEnd: number }>> = [];
  const place = (path: string, start: number, end: number): void => {
    // Reserve one angular slot for this node; each child receives a contiguous subtree sector.
    const unit = (end - start) / sizes.get(path)!; const angle = start + unit / 2;
    const node = nodes.get(path)!; const distance = semanticCoreRadius(node.coreSimilarity);
    points.push(Object.freeze({ path, x: 500 + Math.cos(angle) * distance, y: 500 + Math.sin(angle) * distance,
      radius: semanticNodeRadius(node.semanticConnectedness), distance, angle, sectorStart: start, sectorEnd: end }));
    let cursor = start + unit;
    for (const child of children.get(path)!) { const next = cursor + unit * sizes.get(child)!; place(child, cursor, next); cursor = next; }
  };
  const gap = trees.length > 1 ? Math.min(0.06, Math.PI / trees.length) : 0;
  const available = 2 * Math.PI - gap * trees.length;
  let cursor = -Math.PI / 2;
  for (const tree of trees) {
    measure(tree[0]); const span = available * tree.length / map.nodes.length;
    place(tree[0], cursor, cursor + span); cursor += span + gap;
  }
  return Object.freeze(points.sort((a, b) => compareStrings(a.path, b.path)));
}
