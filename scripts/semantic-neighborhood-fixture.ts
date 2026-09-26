/** Synthetic-only native/performance fixture. Never imported by the plugin. */
import { LocalVectorStore } from "../vectorStore/localVectorStore";
import { buildEmbeddingSpaceId } from "../indexing/embeddingSpace";
import type { VectorStorePersistence } from "../vectorStore/types";
export { SemanticDiscoveryService } from "../semantic/semanticDiscoveryService";
export { projectNeighborhood } from "../semantic/product/semanticNeighborhoodModel";
export { semanticNeighborhoodLayout } from "../health/ui/semanticNeighborhoodLayout";

export async function semanticNeighborhoodFixture(count = 1000) {
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
  const dimensions = 8;
  const store = new LocalVectorStore({ dimensions, basePath: "semantic-index", persistence,
    embeddingSpaceId: buildEmbeddingSpaceId({ providerId: "ollama", model: "neighborhood-synthetic", baseUrl: "http://127.0.0.1:11434", dimensions }) });
  await store.initialize();
  const names = ["Architecture/Query Planning.md", "Databases/Hash Join.md", "Databases/PostgreSQL.md", "Architecture/Processing.md", "Databases/Indexes.md",
    "Systems/Memory.md", "Systems/Storage.md", "Research/Similarity.md", "Research/Representations.md", "Writing/Notes.md", "Writing/Taxonomy.md"];
  const paths = Array.from({ length: count }, (_, i) => names[i] ?? `Synthetic/Document ${String(i).padStart(4, "0")}.md`);
  const upsert = paths.flatMap((path, i) => Array.from({ length: 3 }, (_, ordinal) => {
    const cosine = i === 0 ? 1 : i < 11 ? [0.91, 0.82, 0.64, 0.5, 0.32, 0.12, 0, -0.22, -0.55, -0.91][i - 1] : Math.cos(i * 2.399963229728653);
    const vector = new Float32Array(dimensions); vector[0] = cosine; vector[1] = Math.sqrt(1 - cosine * cosine);
    return { id: `${path}:${ordinal}`, path, headingPath: ["Semantic exploration", ["Overview", "Practical example", "Related concepts"][ordinal]], ordinal,
      contentHash: `synthetic-${i}-${ordinal}`, preview: ordinal === 2 ? 'Literal user text: <img src="https://invalid.test/a" onerror="alert(1)"> and **stored Markdown**.'
        : `Synthetic indexed fragment about ${path.replace(/\.md$/, "").split("/").pop()}. This example explores concepts, representations and how ideas relate.`,
      source: { startOffset: ordinal * 200, endOffset: ordinal * 200 + 150, startLine: ordinal * 6, endLine: ordinal * 6 + 3 }, vector };
  }));
  await store.applyChanges({ upserts: upsert, deleteIds: [] });
  return { store, files, paths, dimensions };
}
