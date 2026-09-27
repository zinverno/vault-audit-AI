import { compareStrings, isTimestamp, isVaultPath } from "../domain/validation";
import type { SemanticGlobalMap } from "../semanticGlobalMapPort";
import type { VaultTopologySnapshot } from "../topology/types";
import type { ConnectionComparisonPair, ConnectionComparisonSnapshot, MarkdownLinkDirection } from "../connectionComparisonPort";

function valid(condition: boolean): void { if (!condition) throw new Error("Invalid connection comparison input"); }
const scoreValid = (score: number): boolean => Number.isFinite(score) && score >= -1 && score <= 1;
const key = (left: string, right: string): string => JSON.stringify(left < right ? [left, right] : [right, left]);

/** Linear graph join plus deterministic output sorting. Never evaluates similarity or parses links. */
export function deriveConnectionComparison(semantic: SemanticGlobalMap, topology: VaultTopologySnapshot, capturedAt: number): ConnectionComparisonSnapshot {
  valid(isTimestamp(capturedAt) && Array.isArray(semantic.nodes) && Array.isArray(semantic.edges) && Array.isArray(topology.nodes) && Array.isArray(topology.edges));
  const revision = semantic.revision;
  valid(Boolean(revision) && [revision.vectorGeneration, revision.configurationRevision, revision.runtimeRevision].every(n => Number.isSafeInteger(n) && n >= 0) &&
    [revision.vectorCount, revision.dimensions].every(n => Number.isSafeInteger(n) && n > 0) &&
    typeof revision.provider === "string" && revision.provider.length > 0 && typeof revision.model === "string" && revision.model.length > 0);
  valid(Boolean(topology.revision) && topology.revision.noteCount === topology.nodes.length && typeof topology.revision.signature === "string" &&
    topology.revision.signature.length > 0 && typeof topology.revision.complete === "boolean");
  const nodes = new Map(semantic.nodes.map(node => [node.path, node]));
  const links = new Map(topology.nodes.map(node => [node.path, node]));
  valid(nodes.size === semantic.nodes.length && links.size === topology.nodes.length && semantic.mappedNoteCount === nodes.size && topology.noteCount === links.size);
  for (const node of [...semantic.nodes, ...topology.nodes]) valid(isVaultPath(node.path) && typeof node.basename === "string");
  for (const node of topology.nodes) valid(typeof node.linksAvailable === "boolean");
  const ranked = new Map<string, { score: number; leftRank?: number; rightRank?: number }>();
  for (const node of semantic.nodes) {
    valid(Array.isArray(node.neighbors) && node.neighbors.length <= 5);
    const seen = new Set<string>();
    node.neighbors.forEach((neighbor: Readonly<{ path: string; score: number }>, index: number) => {
      valid(nodes.has(neighbor.path) && neighbor.path !== node.path && !seen.has(neighbor.path) && scoreValid(neighbor.score));
      seen.add(neighbor.path);
      const prior = node.neighbors[index - 1];
      valid(!prior || prior.score > neighbor.score || prior.score === neighbor.score && compareStrings(prior.path, neighbor.path) < 0);
      const id = key(node.path, neighbor.path);
      const relation: { score: number; leftRank?: number; rightRank?: number } = ranked.get(id) ?? { score: neighbor.score };
      valid(relation.score === neighbor.score);
      if (node.path < neighbor.path) relation.leftRank = index + 1;
      else relation.rightRank = index + 1;
      ranked.set(id, relation);
    });
  }
  const semanticPairs = new Set<string>();
  for (const edge of semantic.edges) {
    valid(nodes.has(edge.left) && nodes.has(edge.right) && edge.left < edge.right && scoreValid(edge.score));
    const id = key(edge.left, edge.right), ranks = ranked.get(id);
    valid(!semanticPairs.has(id) && Boolean(ranks) && ranks!.score === edge.score && edge.mutual === Boolean(ranks!.leftRank && ranks!.rightRank));
    semanticPairs.add(id);
  }
  valid(semanticPairs.size === ranked.size);
  const explicit = new Map<string, { left: string; right: string; direction: MarkdownLinkDirection }>();
  const directed = new Set<string>();
  for (const edge of topology.edges) {
    valid(links.has(edge.source) && links.has(edge.target) && edge.source !== edge.target);
    const directedId = JSON.stringify([edge.source, edge.target]);
    valid(!directed.has(directedId)); directed.add(directedId);
    const [left, right] = edge.source < edge.target ? [edge.source, edge.target] : [edge.target, edge.source];
    const id = key(left, right);
    explicit.set(id, { left, right, direction: explicit.has(id) ? "reciprocal" : edge.source === left ? "left-to-right" : "right-to-left" });
  }
  const comparable = (path: string): boolean => nodes.has(path) && links.get(path)?.linksAvailable === true;
  const pairs: ConnectionComparisonPair[] = [];
  let candidateCount = 0, alignedCount = 0, explicitOnlyCount = 0, unclassifiedSemanticPairCount = 0;
  let explicitOutsideSemanticMapCount = 0, unclassifiedExplicitPairCount = 0;
  const publish = (left: string, right: string, category: ConnectionComparisonPair["category"], semantic?: ConnectionComparisonPair["semantic"]): void => {
    const id = key(left, right), direction = explicit.get(id)?.direction;
    valid(direction === undefined || direction === "left-to-right" || direction === "right-to-left" || direction === "reciprocal");
    pairs.push(Object.freeze({ id, leftPath: left, rightPath: right, leftBasename: nodes.get(left)!.basename, rightBasename: nodes.get(right)!.basename,
      category, semantic: semantic && Object.freeze(semantic), markdown: direction && Object.freeze({ direction }) }));
  };
  for (const edge of semantic.edges) {
    if (!comparable(edge.left) || !comparable(edge.right)) { unclassifiedSemanticPairCount++; continue; }
    const id = key(edge.left, edge.right), ranks = ranked.get(id)!;
    const category = explicit.has(id) ? "aligned" : "candidate";
    if (category === "aligned") alignedCount++; else candidateCount++;
    const leftNeighbors = nodes.get(edge.left)!.neighbors, rightNeighbors = new Set(nodes.get(edge.right)!.neighbors.map(n => n.path));
    const sharedNeighborPaths = Object.freeze(leftNeighbors.map(n => n.path)
      .filter(path => path !== edge.left && path !== edge.right && rightNeighbors.has(path)).sort(compareStrings));
    const rankClass = ranks.leftRank && ranks.rightRank
      ? ranks.leftRank <= 3 && ranks.rightRank <= 3 ? "mutual-top-3" : "mutual-top-5"
      : "one-sided-top-5";
    publish(edge.left, edge.right, category, { score: edge.score, mutualTopK: edge.mutual, leftRank: ranks.leftRank, rightRank: ranks.rightRank,
      rankClass, sharedNeighborPaths });
  }
  for (const [id, pair] of explicit) {
    if (!nodes.has(pair.left) || !nodes.has(pair.right)) { explicitOutsideSemanticMapCount++; continue; }
    if (!comparable(pair.left) || !comparable(pair.right)) { unclassifiedExplicitPairCount++; continue; }
    if (!semanticPairs.has(id)) { explicitOnlyCount++; publish(pair.left, pair.right, "explicit-only"); }
  }
  const rankOrder = { "mutual-top-3": 0, "mutual-top-5": 1, "one-sided-top-5": 2 };
  pairs.sort((a, b) => compareStrings(a.category, b.category) ||
    (a.semantic ? rankOrder[a.semantic.rankClass] : 0) - (b.semantic ? rankOrder[b.semantic.rankClass] : 0) ||
    (b.semantic?.sharedNeighborPaths.length ?? 0) - (a.semantic?.sharedNeighborPaths.length ?? 0) ||
    (b.semantic?.score ?? 0) - (a.semantic?.score ?? 0) || compareStrings(a.leftPath, b.leftPath) || compareStrings(a.rightPath, b.rightPath));
  return Object.freeze({ semanticRevision: Object.freeze({ ...semantic.revision }), topologyRevision: Object.freeze({ ...topology.revision }), capturedAt,
    semanticMappedNoteCount: nodes.size, topologyNoteCount: links.size, comparableNoteCount: semantic.nodes.filter(node => comparable(node.path)).length,
    semanticNotesMissingTopologyCount: semantic.nodes.filter(node => !links.has(node.path)).length,
    semanticNotesUnavailableLinksCount: semantic.nodes.filter(node => links.get(node.path)?.linksAvailable === false).length,
    semanticPairCount: semanticPairs.size, candidateCount, alignedCount, explicitOnlyCount, unclassifiedSemanticPairCount,
    explicitOutsideSemanticMapCount, unclassifiedExplicitPairCount, pairs: Object.freeze(pairs) });
}
