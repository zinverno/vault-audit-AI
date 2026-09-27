// Isolated native smoke. Prepare with scripts/connection-opportunities-prepare.mjs.
// node scripts/connection-opportunities-native.mjs http://127.0.0.1:9260 /tmp/connection-opportunities-smoke
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const [endpoint, root, phase = 'before'] = process.argv.slice(2);
assert(['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname));
assert(root?.startsWith('/tmp/') && !root.includes('..'));
const vault = root + '/vault', pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
const pages = await (await fetch(endpoint + '/json/list')).json();
const page = pages.find(p => p.url.startsWith('app://obsidian.md/')); assert(page);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
let id = 0; const pending = new Map(), exceptions = [];
socket.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
  const q = pending.get(m.id); if (!q) return; pending.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error)+' '+q.context)) : q.resolve(m.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject, context: method+' '+(params.expression??'').slice(0,350) }); socket.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; };
const click = key => evaluate(`hv.contentEl.querySelector('[data-health-action="${key}"]').click()`);
const viewState = () => evaluate('(({comparison,reviewByPairId,...rest})=>({...rest,reviewByPairId:[...reviewByPairId]}))(hv.comparisonView)');
const io = () => evaluate('({...io})');
const resetIO = () => evaluate('Object.keys(io).forEach(k=>io[k]=0)');
const report={matrix:[],boundaries:[],interactions:[],performance:[],exceptions,limitations:['Linux desktop only; narrow viewports are not mobile OS','No screen-reader speech, popout or third-party theme test','requestUrl is covered by the real-runtime integration test; native tracks embed/fetch/XHR']};
const noIO=values=>{for(const key of ['embed','fetch','xhr','read','cachedRead','write','writeBinary','saveData','mutate','localStorage'])assert.equal(values[key],0,key+': '+JSON.stringify(values));};
const setup = async (count, language = 'en', disabled = false) => {
  await evaluate(`(async()=>{window.nativeRestore?.(); for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach(); await app.plugins.disablePlugin('ai-knowledge-hub');})()`);
  const settings = JSON.parse(await fs.readFile(pluginDir + '/data.json', 'utf8'));
  settings.language = language; settings.semantic.enabled = !disabled; settings.semantic.embeddingModel = 'global-map-synthetic';
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify(settings));
  await fs.rm(pluginDir + '/semantic-index', { recursive: true, force: true });
  if (count) { await fs.mkdir(pluginDir + '/semantic-index'); for (const file of await fs.readdir(root + '/fixtures/' + count)) if (!['paths.json','comparison-plan.json','comparison-input.json'].includes(file)) await fs.copyFile(root + '/fixtures/' + count + '/' + file, pluginDir + '/semantic-index/' + file); }
  for (const file of ['main.js', 'styles.css']) await fs.copyFile(file, pluginDir + '/' + file);
  const plan=JSON.parse(await fs.readFile(root+'/fixtures/150/comparison-plan.json','utf8'));
  await evaluate(`(async()=>{
    await app.plugins.enablePlugin('ai-knowledge-hub');
    for(let i=0;i<200&&!app.commands.commands['ai-knowledge-hub:veynrel-open-health'];i++)await new Promise(r=>setTimeout(r,25));
    await new Promise(r=>app.workspace.onLayoutReady(r));
    window.plugin=app.plugins.plugins['ai-knowledge-hub']; window.engine=plugin.semanticController;
    ${count && !disabled ? 'await engine.refreshSemanticStatus();' : ''}
    app.commands.executeCommandById('ai-knowledge-hub:veynrel-open-health');
    for(let i=0;i<200&&!app.workspace.getLeavesOfType('veynrel-health')[0]?.view.body;i++)await new Promise(r=>setTimeout(r,25));
    app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
    window.hv=app.workspace.getLeavesOfType('veynrel-health')[0].view; await hv.controller.getHealthService();
    window.cp=hv.comparison;window.tp=hv.topology;window.np=hv.neighborhood; window.gp=hv.globalMap; window.store=engine.runtimeSlot?.runtime.components?.vectorStore;
    await new Promise(r=>setTimeout(r,180));
    window.io={semanticLoad:0,topologyLoad:0,inventory:0,metadata:0,focus:0,global:0,catalog:0,similarity:0,snapshot:0,embed:0,fetch:0,xhr:0,read:0,cachedRead:0,write:0,writeBinary:0,saveData:0,mutate:0,localStorage:0};
    const restores=[]; const wrap=(obj,key,counter)=>{if(!obj||typeof obj[key]!=='function')return;const original=obj[key];obj[key]=function(...args){io[counter]++;return original.apply(this,args)};restores.push(()=>obj[key]=original)};
    const plan=${JSON.stringify(plan)};
    const inventory=app.vault.getMarkdownFiles.bind(app.vault),cache=app.metadataCache.getFileCache.bind(app.metadataCache);
    app.vault.getMarkdownFiles=()=>inventory().filter(f=>f.path!==plan.missing);
    app.metadataCache.getFileCache=f=>f.path===plan.unavailable?null:cache(f);
    restores.push(()=>{app.vault.getMarkdownFiles=inventory;app.metadataCache.getFileCache=cache});
    wrap(gp,'load','semanticLoad');wrap(tp,'load','topologyLoad');wrap(app.vault,'getMarkdownFiles','inventory');wrap(app.metadataCache,'getFileCache','metadata');
    wrap(engine,'analyzeSemanticFocus','focus');wrap(engine,'analyzeGlobalSemanticMap','global');wrap(engine,'listIndexedPaths','catalog');wrap(engine,'findSimilarNotes','similarity');wrap(store,'readSnapshot','snapshot');wrap(store,'applyChanges','mutate');
    wrap(engine.runtimeSlot?.runtime.components?.searchService.provider,'embed','embed');
    wrap(Storage.prototype,'setItem','localStorage');wrap(window,'fetch','fetch');wrap(XMLHttpRequest.prototype,'open','xhr');
    wrap(app.vault,'read','read');wrap(app.vault,'cachedRead','cachedRead');wrap(plugin,'saveData','saveData');
    const adapter=app.vault.adapter;
    for(const key of ['write','writeBinary','append','remove','rename','mkdir']){const original=adapter[key];adapter[key]=function(path,...args){if(path.endsWith('.md')||path.startsWith('.obsidian/plugins/ai-knowledge-hub/'))io[key==='writeBinary'?'writeBinary':'write']++;return original.call(this,path,...args)};restores.push(()=>adapter[key]=original)}
    window.nativeRestore=()=>{restores.reverse().forEach(f=>f());window.nativeRestore=undefined};
  })()`);
};
const theme=async name=>evaluate(`document.body.classList.toggle('theme-dark',${name!=='light'});document.body.classList.toggle('theme-light',${name==='light'});document.body.style.setProperty('--interactive-accent',${JSON.stringify(name==='yellow'?'#dbb42c':'')})`);
const out = `${root}/${phase}`;
await fs.mkdir(out, { recursive: true });
report.screenshots = [];
report.states = [];
const settle = () => evaluate('new Promise(r=>setTimeout(r,200))');
const size = (width, height = 1000) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
const shot = async name => {
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0}); await evaluate('hv.contentEl.scrollTop=0'); await settle();
  const clip = await evaluate('(()=>{const r=hv.contentEl.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const result = await send('Page.captureScreenshot', { format: 'png', clip });
  await fs.writeFile(`${out}/${name}.png`, Buffer.from(result.data, 'base64'));
  report.screenshots.push(name + '.png');
};
const navigate = page => evaluate(`hv.navigate(${JSON.stringify(page === 'findings' ? { page, state: 'open', dimension: 'all' } : { page })})`);
const inspect = async name => {
  await settle();
  const state = await evaluate(`(()=>{const r=hv.contentEl;return {route:hv.route.page, overflow:r.scrollWidth-r.clientWidth,
    current:r.querySelector('[aria-current=page]')?.dataset.healthAction,
    headings:[...r.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),
    text:r.innerText, buttons:[...r.querySelectorAll('button')].map(e=>({key:e.dataset.healthAction,text:e.textContent,disabled:e.disabled}))}})()`);
  report.states.push({ name, ...state });
};
// Deliberately controlled presentation states, not claims that a provider was contacted.
const snapshotState = async (port, patch, name, page, extra = '') => {
  console.log('Inspect '+name);
  await navigate(page);
  await evaluate(`(()=>{window.auditOriginal=hv.${port}.getSnapshot; const original=hv.${port}.getSnapshot();
    hv.${port}.getSnapshot=()=>({...original,...${JSON.stringify(patch)}}); ${extra} hv.render();})()`);
  await inspect(name);
  await shot(name);
  await evaluate(`hv.${port}.getSnapshot=window.auditOriginal;hv.semanticSetup=undefined;hv.deepSetup=undefined;hv.connectSetup=undefined;hv.connectConfirmation=undefined;hv.knowledgeConfirmation=undefined;hv.render()`);
};
try {
  await send('Runtime.enable'); await send('Page.bringToFront');
  assert.equal(await evaluate('app.vault.adapter.getBasePath()'), vault);
  await evaluate('app.setting.close()');
  report.environment = await evaluate('({electron:process.versions.electron,platform:process.platform,userAgent:navigator.userAgent})');
  report.artifactSha256 = crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  report.stylesSha256 = crypto.createHash('sha256').update(await fs.readFile('styles.css')).digest('hex');
  for (const language of ['en', 'ru']) {
    await setup(150, language); await size(1280); await theme('dark');
    await evaluate(`(async()=>{if(!app.vault.getAbstractFileByPath('Recall fixture.md'))await app.vault.create('Recall fixture.md',${JSON.stringify('# Synthetic learning\n\n## Flashcards\n\nWhat does a database index do?::It supports efficient lookup.\n\nWhat is spaced repetition?::Review with increasing intervals.\n')});})()`);
    await evaluate('hv.controller.runLocalScan()');
    await evaluate('hv.recall.initialize()');
    await evaluate('hv.recall.refreshCards()');
    await evaluate('gp.load()'); await evaluate('tp.load()'); await evaluate('cp.load()');
    await evaluate("np.load('Databases/Hash Join.md')");
    // Primary routes are passive; native initialization above is intentional fixture preparation.
    await resetIO();
    for (const route of ['health','findings','discover','recall','connect','tools','settings']) {
      await navigate(route); await inspect(`${language}-${route}`); await shot(`${language}-${route}`);
    }
    const passive = await io(); noIO(passive);
    for (const key of ['semanticLoad','topologyLoad','inventory','metadata','global','focus','catalog','similarity','snapshot']) assert.equal(passive[key], 0, JSON.stringify(passive));
    report.boundaries.push({language,passive});
    await navigate('findings');
    await evaluate(`hv.contentEl.querySelector('.veynrel-findings-row')?.click()`);
    await inspect(`${language}-finding-inspector`); await shot(`${language}-finding-inspector`);
    for (const route of ['topology','semantic-neighborhood','semantic-map','connection-opportunities']) {
      await navigate(route);
      if(route === 'connection-opportunities') await click('connections-pair-0');
      await inspect(`${language}-${route}`); await shot(`${language}-${route}`);
    }
    await navigate('semantic-map');
    await evaluate(`hv.globalMapView.selected='Databases/Hash Join.md';hv.render()`);
    await evaluate("gp.focus('Databases/Hash Join.md')");
    await inspect(`${language}-global-focus`); await shot(`${language}-global-focus`);
    await evaluate('gp.resetFocus()');
    await navigate('recall'); await evaluate('hv.recall.startSession();hv.recall.revealAnswer()');
    await inspect(`${language}-recall-review`); await shot(`${language}-recall-review`);
    await evaluate('hv.recall.endSession()');
    await size(390); await navigate('health'); await shot(`${language}-390-health`);
    await navigate('connection-opportunities'); await shot(`${language}-390-connections`);
    await size(1280);
    for(const [state,patch] of Object.entries({disabled:{state:'disabled',enabled:false},configured:{state:'configured',indexRequired:true},building:{state:'configured',busy:true,operation:'build',progress:{phase:'embedding',documentsTotal:150,chunksTotal:450,chunksCompleted:90,batchCurrent:3,batchTotal:15}},error:{state:'error',failure:'provider-request'},incompatible:{state:'incompatible'}})) {
      await snapshotState('semantic',patch,`${language}-discover-${state}`,'discover');
    }
    for(const step of ['choose','form','error','connected']) {
      const setup = step==='choose'?{step}:step==='connected'?{step,dimensions:12}:{step:'form',draft:{mode:'custom',provider:'openai-compatible',baseUrl:'http://127.0.0.1:9290/v1',model:'synthetic',apiKey:''},...(step==='error'?{result:{ok:false,reason:'connection'}}:{})};
      await snapshotState('semantic',{state:'configured',indexRequired:true},`${language}-semantic-${step}`,'health',`hv.semanticSetup=${JSON.stringify(setup)};`);
    }
    for(const step of ['choose','form','error']) {
      const setup=step==='choose'?{step}:{step:'form',draft:{provider:'custom',baseUrl:'http://127.0.0.1:9290/v1',model:'synthetic',apiKey:''},...(step==='error'?{result:{ok:false,reason:'connection'}}:{})};
      await snapshotState('deep',{},`${language}-deep-${step}`,'health',`hv.deepSetup=${JSON.stringify(setup)};`);
    }
    await snapshotState('deep',{state:'configured',provider:'ollama',providerLabel:'Ollama',model:'synthetic'},`${language}-knowledge-confirm`,'health',`hv.knowledgeConfirmation={providerKind:'local'};`);
    for (const [state,patch] of Object.entries({disabled:{state:'disabled',enabled:false},configured:{state:'configured',enabled:true},ready:{state:'ready',enabled:true,mirrorKnownReady:true,lastSuccessAt:1790490000000},syncing:{state:'syncing',enabled:true,busy:true,operation:'sync'},error:{state:'error',enabled:true,error:'unreachable'}})) {
      await snapshotState('connect',patch,`${language}-connect-${state}`,'connect');
    }
    for(const mode of ['local','remote']) await snapshotState('connect',{},`${language}-connect-setup-${mode}`,'connect',`hv.connectSetup={step:'form',draft:{mode:'${mode}',endpoint:'http://127.0.0.1:9291',token:''}};`);
    await snapshotState('connect',{state:'configured',enabled:true},`${language}-connect-confirm`,'connect',`hv.connectConfirmation={local:true,endpointLabel:'http://127.0.0.1:9291'};`);
    for (const [port,page] of [['globalMap','semantic-map'],['neighborhood','semantic-neighborhood'],['comparison','connection-opportunities'],['topology','topology']]) {
      for (const state of ['loading','stale','error']) await snapshotState(port,{state, ...(state==='error'?{reason:port==='comparison'?'invalid':'failed',error:'failed'}:state==='stale'?{reason:'changed'}:{})},`${language}-${page}-${state}`,page);
    }
    for(const [name,patch] of Object.entries({loading:{loadState:'loading'},empty:{firstRun:false,summary:{active:0,due:0,new:0},inventoryEstablished:true},first:{firstRun:true},partial:{inventoryResult:{complete:false,committed:false,active:2}},recovery:{loadState:'invalid',canRecover:true},confirm:{loadState:'invalid',canRecover:true,confirmingRecovery:true},error:{error:'inventory'}})) await snapshotState('recall',patch,`${language}-recall-${name}`,'recall');
    // First-run and blocked Health are read-only injected presentation snapshots.
    await navigate('health');
    await evaluate('window.auditHealth=hv.controller.getState;window.auditState=hv.controller.getState()');
    for(const step of ['profile','scan','recovery']) {
      await evaluate(`hv.controller.getState=()=>({...auditState,preferences:{...auditState.preferences,onboardingCompleted:false,profileChosen:${step!=='profile'}},snapshot:{...auditState.snapshot,lastLocalScan:undefined,initialization:${step==='recovery'?"{...auditState.snapshot.initialization,findingsWritable:false,findings:'invalid'}":"auditState.snapshot.initialization"}}});hv.render()`);
      await inspect(`${language}-onboarding-${step}`);await shot(`${language}-onboarding-${step}`);
      if(step==='recovery'){await click('recover');await settle();const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${out}/${language}-health-recovery-confirm.png`,Buffer.from(r.data,'base64'));report.screenshots.push(`${language}-health-recovery-confirm.png`);await evaluate('document.querySelector(".veynrel-health-confirmation button").click()');}
    }
    await evaluate('hv.controller.getState=window.auditHealth;hv.render()');
    await evaluate("app.setting.open();void app.setting.openTabById('ai-knowledge-hub')");await settle();
    report.states.push({name:`${language}-advanced-settings`,...(await evaluate('({text:app.setting.activeTab.containerEl.innerText,controls:app.setting.activeTab.containerEl.querySelectorAll("input,select,button").length})'))});
    const settingsImage=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${out}/${language}-advanced-settings.png`,Buffer.from(settingsImage.data,'base64'));report.screenshots.push(`${language}-advanced-settings.png`);
    await evaluate('app.setting.close()');
    console.log(`PASS ${phase} ${language}: routes and controlled presentation states captured`);
  }
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({screenshots:report.screenshots.length,states:report.states.length,exceptions}));
} finally {
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await evaluate('window.nativeRestore?.()');socket.close();
}
