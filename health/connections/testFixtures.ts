import type { SemanticGlobalMap } from "../semanticGlobalMapPort";
import { deriveTopology } from "../topology/deriveTopology";
import { note, snapshot } from "../analyzers/local/testFixtures";

export const semanticRevision = { vectorGeneration: 1, vectorCount: 8, dimensions: 3, provider: "synthetic", model: "fixture", configurationRevision: 0, runtimeRevision: 1 };
export function semanticMap(): SemanticGlobalMap {
  const edges = [
    { left: "A.md", right: "B.md", score: 0.9, mutual: true },
    { left: "A.md", right: "C.md", score: 0.85, mutual: true },
    { left: "B.md", right: "C.md", score: 0.8, mutual: true },
    { left: "C.md", right: "D.md", score: 0.95, mutual: false },
    { left: "D.md", right: "E.md", score: 0.7, mutual: true },
    { left: "E.md", right: "F.md", score: 0.6, mutual: true },
    { left: "F.md", right: "G.md", score: 0.5, mutual: true },
  ];
  return { revision: semanticRevision, capturedAt: 1, indexedNoteCount: 7, mappedNoteCount: 7,
    nodes: ["A", "B", "C", "D", "E", "F", "G"].map(name => {
      const path = name + ".md";
      return { id: path, path, basename: name, coreSimilarity: 0.8, semanticConnectedness: null,
        neighbors: edges.filter(e => e.left === path || e.mutual && e.right === path)
          .map(e => ({ path: e.left === path ? e.right : e.left, score: e.score })).sort((a, b) => b.score - a.score) };
    }), edges };
}
export async function topologyMap() {
  return deriveTopology(snapshot([
    note("A.md", { resolvedOutgoing: ["C.md", "X.md"] }),
    note("B.md", { resolvedOutgoing: ["C.md"] }),
    note("C.md", { resolvedOutgoing: ["B.md"] }),
    note("D.md", { resolvedOutgoing: ["A.md", "E.md"] }),
    note("E.md", { linksAvailable: false }), note("F.md"), note("X.md"),
  ]), 1, new AbortController().signal);
}
