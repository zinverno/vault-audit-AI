// Run after build. All files are synthetic and confined to the supplied disposable /tmp root.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import './global-semantic-map-prepare.mjs';
const root=process.argv[2];
if(!root?.startsWith('/tmp/')||root.includes('..'))throw Error('Supply a disposable /tmp root');
await build({entryPoints:['scripts/connection-opportunities-fixture.ts'],bundle:true,platform:'node',format:'cjs',outfile:root+'/fixture.cjs',plugins:[{name:'host',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const setIcon=()=>{}; export const getLanguage=()=>"en";'}));}}]});
const {connectionFixture}=createRequire(import.meta.url)(root+'/fixture.cjs');
for(const count of [150,300,500]){
  const f=await connectionFixture(count);
  await fs.writeFile(root+'/fixtures/'+count+'/comparison-plan.json',JSON.stringify(f.plan));
  await fs.writeFile(root+'/fixtures/'+count+'/comparison-input.json',JSON.stringify({semantic:f.semantic,topology:f.topology}));
  if(count!==150)continue;
  for(const path of [...f.paths,f.plan.topologyOnly]){
    const full=root+'/vault/'+path;await fs.mkdir(full.slice(0,full.lastIndexOf('/')),{recursive:true});
    await fs.writeFile(full,'# Synthetic comparison note\n\n'+f.plan.edges.filter(e=>e.source===path).map(e=>'[['+e.target+']]').join('\n')+'\n');
  }
}
// Browser-only fixture helper for measuring real DOM render separately from source computation.
await build({entryPoints:['health/connections/renderConnectionComparison.ts'],bundle:true,platform:'browser',format:'iife',globalName:'comparisonPresentation',outfile:root+'/presentation.js',plugins:[{name:'host',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'synthetic'}));b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:'export const setIcon=()=>{}; export const getLanguage=()=>"en";'}));}}]});
