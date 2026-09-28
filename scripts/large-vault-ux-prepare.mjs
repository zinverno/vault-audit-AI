// Build first. Creates only synthetic, disposable acceptance data.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root=process.argv[2];
if(!root?.startsWith('/tmp/')||root.includes('..'))throw Error('Supply a disposable /tmp directory');
execFileSync(process.execPath,['scripts/global-semantic-map-prepare.mjs',root],{stdio:'inherit'});
const plugin=root+'/vault/.obsidian/plugins/ai-knowledge-hub';
for(const path of JSON.parse(await fs.readFile(root+'/fixtures/500/paths.json','utf8'))){
  const full=root+'/vault/'+path;await fs.mkdir(full.slice(0,full.lastIndexOf('/')),{recursive:true});
  await fs.writeFile(full,'# Synthetic showcase note\n\nThis is a synthetic note for large vault UX acceptance. No personal data.\n');
}
for(const file of await fs.readdir(root+'/fixtures/500'))if(file!=='paths.json')await fs.copyFile(root+'/fixtures/500/'+file,plugin+'/semantic-index/'+file);
const settings=JSON.parse(await fs.readFile(plugin+'/data.json','utf8'));
Object.assign(settings,{provider:'ollama',model:'synthetic-ux',baseUrl:'http://127.0.0.1:9889/v1',semanticAutoSyncSuspended:true,deepAudit:{batchSize:5,maxConcurrent:3,delayMs:0}});
await fs.writeFile(plugin+'/data.json',JSON.stringify(settings,null,2));
