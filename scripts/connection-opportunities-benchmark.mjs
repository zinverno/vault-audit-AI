// Comparison derivation only; semantic and topology preparation are outside the measured interval.
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
await build({ entryPoints: ['scripts/connection-opportunities-fixture.ts'], bundle: true, external: ['obsidian'], platform: 'node', format: 'cjs', outfile: '/tmp/connection-opportunities-fixture.cjs',
  plugins: [{name:'synthetic-host',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const setIcon=()=>{}; export const getLanguage = () => "en";'}));}}] });
const { connectionFixture, deriveConnectionComparison } = createRequire(import.meta.url)('/tmp/connection-opportunities-fixture.cjs');
const report = { node: process.version, results: [] };
for (const notes of [150, 300, 500]) {
  const f = await connectionFixture(notes), samples = [];
  for (let i=0;i<8;i++) { const start=performance.now(); deriveConnectionComparison(f.semantic,f.topology,1); const elapsed=performance.now()-start; if(i)samples.push(elapsed); }
  report.results.push({notes,semanticPairs:f.semantic.edges.length,topologyEdges:f.topology.edges.length,medianMs:[...samples].sort((a,b)=>a-b)[3],samples});
}
if(process.argv[2]) await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
