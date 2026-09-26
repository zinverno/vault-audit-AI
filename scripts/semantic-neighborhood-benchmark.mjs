// node scripts/semantic-neighborhood-benchmark.mjs [output.json]
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
await build({ entryPoints: ['scripts/semantic-neighborhood-fixture.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: '/tmp/semantic-neighborhood-fixture.cjs' });
const require = createRequire(import.meta.url);
const { semanticNeighborhoodFixture, SemanticDiscoveryService, projectNeighborhood, semanticNeighborhoodLayout } = require('/tmp/semantic-neighborhood-fixture.cjs');
const fixture = await semanticNeighborhoodFixture(1000);
const service = new SemanticDiscoveryService(fixture.store, fixture.dimensions);
const revision = { vectorGeneration: fixture.store.getStats().generation, vectorCount: 3000, dimensions: 8, provider: 'ollama', model: 'neighborhood-synthetic', configurationRevision: 0, runtimeRevision: 1 };
const timed = (fn) => { const start = performance.now(); const result = fn(); return { result, ms: performance.now() - start }; };
const measurements = Array.from({ length: 7 }, () => {
  const catalog = timed(() => service.listIndexedPaths());
  const discovery = timed(() => service.findSimilarNotes(fixture.paths[0], { limit: 10, matchesPerDocument: 3 }));
  const projection = timed(() => projectNeighborhood(fixture.paths[0], discovery.result, catalog.result, revision, 0));
  const layout = timed(() => semanticNeighborhoodLayout(projection.result.source, projection.result.neighbors));
  return { catalogMs: catalog.ms, findSimilarNotesMs: discovery.ms, projectionMs: projection.ms, layoutMs: layout.ms };
});
const medians = Object.fromEntries(Object.keys(measurements[0]).map(key => [key, measurements.map(row => row[key]).sort((a, b) => a - b)[3]]));
const report = { documents: 1000, chunks: 3000, dimensions: 8, neighbors: 10, samples: 7, node: process.version, measurements, medians,
  scope: 'One source against the corpus using existing discovery. No global all-pairs graph. DOM rendering measured separately in native Obsidian.' };
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
