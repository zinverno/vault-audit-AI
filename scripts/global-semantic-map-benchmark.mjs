// Synthetic local measurements; never a CI timing gate. Node + native DOM timings are separate.
// node scripts/global-semantic-map-benchmark.mjs /tmp/global-map-benchmark.json
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
await build({ entryPoints: ['scripts/global-semantic-map-fixture.ts'], bundle: true, plugins: [{ name: 'synthetic-host', setup(build) {
  build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'synthetic' }));
  build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export const getLanguage = () => "en";' }));
} }], platform: 'node', format: 'cjs', outfile: '/tmp/global-semantic-map-fixture.cjs' });
const { semanticGlobalMapFixture, SemanticDiscoveryService, projectGlobalSemanticMap, semanticGlobalMapLayout } = createRequire(import.meta.url)('/tmp/global-semantic-map-fixture.cjs');
const report = { node: process.version, dimensions: 1536, chunksPerDocument: 3, samples: 7, results: [] };
for (const documents of [150, 300, 500]) {
  const f = await semanticGlobalMapFixture(documents), service = new SemanticDiscoveryService(f.store, f.dimensions);
  const revision = { vectorGeneration: 1, vectorCount: documents * 3, dimensions: f.dimensions, provider: 'ollama', model: 'global-map-synthetic', configurationRevision: 0, runtimeRevision: 1 };
  let preparationMs = 0;
  const prepare = service.prepareSnapshot.bind(service);
  service.prepareSnapshot = () => { const start = performance.now(); const result = prepare(); preparationMs = performance.now() - start; return result; };
  const samples = [];
  for (let i = 0; i < 8; i++) {
    let pairStart = 0, pairEnd = 0;
    const started = performance.now();
    const result = await service.analyzeGlobalSemanticMap({ onProgress: p => { if (!p.completedPairs) pairStart = performance.now(); if (p.completedPairs === p.totalPairs) pairEnd = performance.now(); } });
    const analyzed = performance.now();
    const map = projectGlobalSemanticMap(result, revision, 0); const projected = performance.now();
    semanticGlobalMapLayout(map); const laidOut = performance.now();
    if (i) samples.push({ centroidPreparationMs: preparationMs, pairwiseTopKMs: pairEnd - pairStart, analysisTotalMs: analyzed - started, productProjectionMs: projected - analyzed, layoutMs: laidOut - projected });
  }
  const medians = Object.fromEntries(Object.keys(samples[0]).map(key => [key, samples.map(s => s[key]).sort((a,b) => a-b)[3]]));
  report.results.push({ documents, pairs: documents * (documents - 1) / 2, samples, medians });
}
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.results.map(({ documents, pairs, medians }) => ({ documents, pairs, ...medians })), null, 2));
