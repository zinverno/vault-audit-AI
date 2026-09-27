/** Synthetic fixture tooling only. Uses the published Global Map projector and existing topology derivation. */
import { semanticGlobalMapFixture, SemanticDiscoveryService, projectGlobalSemanticMap } from "./global-semantic-map-fixture";
import { deriveTopology } from "../health/topology/deriveTopology";
export { deriveConnectionComparison } from "../health/connections/deriveConnectionComparison";

export async function connectionFixture(count = 150) {
  const f = await semanticGlobalMapFixture(count);
  // Keep the existing real vector engine fixture; rename two synthetic paths to observed special formats.
  const renamedPaths = new Map([[f.paths[20], "Drawings/Drawing A.excalidraw.md"], [f.paths[21], "Drawings/Drawing B.EXCALIDRAW.md"]]);
  const captured = f.store.readSnapshot();
  await f.store.applyChanges({ deletePaths: [...renamedPaths.keys()], upserts: captured.metadata.flatMap((entry, i) => {
    const path = renamedPaths.get(entry.path);
    return path ? [{ ...entry, path, id: `${path}:${entry.ordinal}`, vector: captured.vectors.slice(i * f.dimensions, (i + 1) * f.dimensions) }] : [];
  }) });
  f.paths = f.paths.map(path => renamedPaths.get(path) ?? path);
  const service = new SemanticDiscoveryService(f.store, f.dimensions);
  const revision = { vectorGeneration: 1, vectorCount: count * 3, dimensions: f.dimensions, provider: "ollama", model: "global-map-synthetic", configurationRevision: 0, runtimeRevision: 1 };
  const semantic = projectGlobalSemanticMap(await service.analyzeGlobalSemanticMap(), revision, 1)!;
  const paths = semantic.nodes.map(n => n.path), missing = paths.at(-1)!, unavailable = paths.at(-2)!;
  const eligible = semantic.edges.filter(e => ![e.left, e.right].some(p => p === missing || p === unavailable));
  const oneWay = eligible[0], reciprocal = eligible[1];
  const explicitOnly = paths.flatMap((left, i) => paths.slice(i + 1).map(right => ({ left, right })))
    .find(e => ![e.left, e.right].some(p => p === missing || p === unavailable) && !semantic.edges.some(s => s.left === e.left && s.right === e.right))!;
  const topologyOnly = "Coverage/Topology only.md";
  const edges = [{ source: oneWay.left, target: oneWay.right }, { source: reciprocal.left, target: reciprocal.right },
    { source: reciprocal.right, target: reciprocal.left }, { source: explicitOnly.left, target: explicitOnly.right }, { source: oneWay.left, target: topologyOnly }];
  const topology = await deriveTopology({ notes: [...paths.filter(p => p !== missing), topologyOnly].map(path => ({ path,
    basename: path.split("/").pop()!.replace(/\.md$/, ""), mtime: 1, contentAvailable: false,
    linksAvailable: path !== unavailable, resolvedOutgoing: edges.filter(e => e.source === path).map(e => e.target), unresolvedLinks: [] })),
    coverage: { noteListComplete: true, contentComplete: false, linksComplete: false }, diagnostics: [], diagnosticsTruncated: 0 }, 1, new AbortController().signal);
  return { ...f, semantic, topology, plan: { oneWay, reciprocal, explicitOnly, missing, unavailable, topologyOnly, edges, renamedPaths: [...renamedPaths] } };
}
