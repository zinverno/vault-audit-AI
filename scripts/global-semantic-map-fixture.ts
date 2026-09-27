/** Synthetic-only native/performance fixture. Never imported by the plugin. */
import { LocalVectorStore } from "../vectorStore/localVectorStore";
import { buildEmbeddingSpaceId } from "../indexing/embeddingSpace";
import type { VectorStorePersistence } from "../vectorStore/types";
export { SemanticDiscoveryService } from "../semantic/semanticDiscoveryService";
export { projectGlobalSemanticMap } from "../semantic/product/semanticGlobalMapModel";
export { semanticGlobalMapLayout } from "../health/ui/semanticGlobalMapLayout";
export { projectNeighborhood } from "../semantic/product/semanticNeighborhoodModel";
export { semanticNeighborhoodLayout } from "../health/ui/semanticNeighborhoodLayout";

export async function semanticGlobalMapFixture(count = 150, dimensions = 1536) {
  const files = new Map<string, string | ArrayBuffer>();
  const persistence: VectorStorePersistence = {
    exists: async (path) => files.has(path),
    readText: async (path) => files.get(path) as string,
    readBinary: async (path) => files.get(path) as ArrayBuffer,
    writeText: async (path, value) => { files.set(path, value); },
    writeBinary: async (path, value) => { files.set(path, value); },
    createDirectory: async () => {}, remove: async (path) => { files.delete(path); },
    rename: async (from, to) => { files.set(to, files.get(from)!); files.delete(from); },
  };
  const store = new LocalVectorStore({ dimensions, basePath: "semantic-index", persistence,
    embeddingSpaceId: buildEmbeddingSpaceId({ providerId: "ollama", model: "global-map-synthetic", baseUrl: "http://127.0.0.1:11434", dimensions }) });
  await store.initialize();
  const names = ["Architecture/Query Planning.md", "Databases/Hash Join.md", "Databases/PostgreSQL.md", "Architecture/Processing.md", "Databases/Indexes.md",
    "Systems/Memory.md", "Systems/Storage.md", "Research/Similarity.md", "Research/Representations.md", "Writing/Notes.md", "Writing/Taxonomy.md"];
  const paths = Array.from({ length: count }, (_, i) => names[i] ?? `Synthetic/Document ${String(i).padStart(4, "0")}.md`);
  const upsert = paths.flatMap((path, i) => Array.from({ length: 3 }, (_, ordinal) => {
    const vector = new Float32Array(dimensions);
    // Deterministic dense noise around eight directions; three chunks per document.
    for (let d = 0; d < dimensions; d++) vector[d] = Math.sin((i + 1) * (d + 3) * 0.713 + ordinal * 0.02) * 0.014;
    vector[0] = 0.1 + (i % 19) * 0.018;
    vector[1 + Math.floor(i / 19) % 8] += 0.8;
    const norm = Math.hypot(...vector);
    for (let d = 0; d < dimensions; d++) vector[d] /= norm;
    return { id: `${path}:${ordinal}`, path, headingPath: ["Semantic exploration", ["Overview", "Practical example", "Related concepts"][ordinal]], ordinal,
      contentHash: `synthetic-${i}-${ordinal}`, preview: ordinal === 2 ? 'Literal user text: <img src="https://invalid.test/a" onerror="alert(1)"> and **stored Markdown**.'
        : `Synthetic indexed fragment about ${path.replace(/\.md$/, "").split("/").pop()}. This example explores concepts, representations and how ideas relate.`,
      source: { startOffset: ordinal * 200, endOffset: ordinal * 200 + 150, startLine: ordinal * 6, endLine: ordinal * 6 + 3 }, vector };
  }));
  await store.applyChanges({ upserts: upsert, deleteIds: [] });
  return { store, files, paths, dimensions };
}
