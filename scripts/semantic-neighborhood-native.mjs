// Isolated native smoke. Prepare with scripts/semantic-neighborhood-prepare.mjs.
// node scripts/semantic-neighborhood-native.mjs http://127.0.0.1:9254 /tmp/semantic-neighborhood-smoke
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const [endpoint, root] = process.argv.slice(2);
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
  const q = pending.get(m.id); if (!q) return; pending.delete(m.id); m.error ? q.reject(m.error) : q.resolve(m.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value; };
const click = key => evaluate(`hv.contentEl.querySelector('[data-health-action="${key}"]').click()`);
const io = () => evaluate('({...io})');
const resetIO = () => evaluate('Object.keys(io).forEach(k=>io[k]=0)');
const report = { matrix: [], boundaries: [], interactions: [], screenshots: [], exceptions, performance: {}, limitations: ['requestUrl is instrumented in the real-runtime integration test; native counters cover provider embed, fetch and XHR', 'Linux desktop only; narrow desktop viewport is not mobile OS', 'No screen reader, popout, third-party theme, or live provider testing'] };
const noIO = values => { for (const key of ['embed', 'fetch', 'xhr', 'read', 'cachedRead', 'write', 'writeBinary', 'saveData', 'mutate']) assert.equal(values[key], 0, key + ': ' + JSON.stringify(values)); };
const setup = async (count, language = 'en', disabled = false) => {
  await evaluate(`(async()=>{window.nativeRestore?.(); for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach(); await app.plugins.disablePlugin('ai-knowledge-hub');})()`);
  const settings = JSON.parse(await fs.readFile(pluginDir + '/data.json', 'utf8'));
  settings.language = language; settings.semantic.enabled = !disabled;
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify(settings));
  await fs.rm(pluginDir + '/semantic-index', { recursive: true, force: true });
  if (count) { await fs.mkdir(pluginDir + '/semantic-index'); for (const file of await fs.readdir(root + '/fixtures/' + count)) if (file !== 'paths.json') await fs.copyFile(root + '/fixtures/' + count + '/' + file, pluginDir + '/semantic-index/' + file); }
  for (const file of ['main.js', 'styles.css']) await fs.copyFile(file, pluginDir + '/' + file);
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
    window.np=hv.neighborhood; window.store=engine.runtimeSlot?.runtime.components?.vectorStore;
    await new Promise(r=>setTimeout(r,180));
    window.io={catalog:0,similarity:0,snapshot:0,embed:0,fetch:0,xhr:0,read:0,cachedRead:0,write:0,writeBinary:0,saveData:0,mutate:0};
    const restores=[]; const wrap=(obj,key,counter)=>{if(!obj||typeof obj[key]!=='function')return;const original=obj[key];obj[key]=function(...args){io[counter]++;return original.apply(this,args)};restores.push(()=>obj[key]=original)};
    wrap(engine,'listIndexedPaths','catalog');wrap(engine,'findSimilarNotes','similarity');wrap(store,'readSnapshot','snapshot');wrap(store,'applyChanges','mutate');
    wrap(engine.runtimeSlot?.runtime.components?.searchService.provider,'embed','embed');
    wrap(window,'fetch','fetch');wrap(XMLHttpRequest.prototype,'open','xhr');
    wrap(app.vault,'read','read');wrap(app.vault,'cachedRead','cachedRead');wrap(plugin,'saveData','saveData');
    const adapter=app.vault.adapter;
    for(const key of ['write','writeBinary','append','remove','rename','mkdir']){const original=adapter[key];adapter[key]=function(path,...args){if(path.startsWith('.obsidian/plugins/ai-knowledge-hub/'))io[key==='writeBinary'?'writeBinary':'write']++;return original.call(this,path,...args)};restores.push(()=>adapter[key]=original)}
    window.nativeRestore=()=>{restores.reverse().forEach(f=>f());window.nativeRestore=undefined};
  })()`);
};
const load = async (source = 'Architecture/Query Planning.md') => {
  await click('neighborhood-open'); await evaluate('np.prepare()'); await evaluate(`np.load(${JSON.stringify(source)})`);
  assert.equal(await evaluate('np.getSnapshot().state'), 'ready');
};
const theme = async name => evaluate(`document.body.classList.toggle('theme-dark',${name !== 'light'});document.body.classList.toggle('theme-light',${name === 'light'});document.body.style.setProperty('--interactive-accent',${JSON.stringify(name === 'yellow' ? '#dbb42c' : '')});`);
const screenshot = async (name, width, selected = false) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: selected ? width === 390 ? 2700 : 1500 : 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate('hv.contentEl.scrollTop=0');
  const clip = await evaluate(`(()=>{const r=hv.contentEl.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
  const data = await send('Page.captureScreenshot', { format: 'png', clip });
  await fs.mkdir(root + '/screenshots', { recursive: true }); await fs.writeFile(root + '/screenshots/' + name + '.png', Buffer.from(data.data, 'base64')); report.screenshots.push(name + '.png');
};
try {
  await send('Runtime.enable'); await send('Page.bringToFront');
  assert.equal(await evaluate('app.vault.adapter.getBasePath()'), vault);
  report.environment = await evaluate('({obsidian:document.title,electron:process.versions.electron,platform:process.platform})');
  report.artifactSha256 = crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  for (const language of ['en', 'ru']) for (const scenario of ['disabled', 'absent', 'chooser', 'one', 'ten', 'zero', 'stale', 'selected', 'removed']) {
    const count = scenario === 'absent' ? 0 : scenario === 'one' ? 2 : scenario === 'zero' ? 1 : 11;
    await setup(count, language, scenario === 'disabled'); await resetIO(); await click('nav-discover');
    const passive = await io(); noIO(passive); for(const key of ['catalog','similarity','snapshot'])assert.equal(passive[key],0);
    if (['disabled', 'absent'].includes(scenario)) assert.equal(await evaluate(`!!hv.contentEl.querySelector('[data-health-action="neighborhood-open"]')`), false);
    else {
      await click('neighborhood-open'); await evaluate('np.prepare()'); assert.equal(await evaluate('np.getSnapshot().state'), 'choosing');
      const prepared = await io(); noIO(prepared); assert.equal(prepared.catalog,1); assert.equal(prepared.similarity,0);
      if (scenario !== 'chooser') {
        await evaluate('np.load("Architecture/Query Planning.md")'); assert.equal(await evaluate('np.getSnapshot().state'),'ready');
        assert.equal(await evaluate('np.getSnapshot().map.neighbors.length'), scenario === 'one' ? 1 : scenario === 'zero' ? 0 : 10);
        if (scenario === 'selected') { const before=await io(); await click('neighborhood-select-1'); assert.equal((await io()).similarity,before.similarity); assert.equal(await evaluate('hv.contentEl.querySelectorAll(".veynrel-neighborhood-inspector img").length'),0); }
        if (scenario === 'stale' || scenario === 'removed') {
          await evaluate(`store.applyChanges(${scenario === 'removed' ? '{deletePaths:["Architecture/Query Planning.md"]}' : '{}'})`);
          await evaluate('engine.getCachedIndexState()'); await evaluate('Promise.resolve()');
          assert.equal(await evaluate('np.getSnapshot().state'),'stale');
          await resetIO();
          if(scenario==='removed'){await evaluate('np.refresh()'); assert.equal(await evaluate('np.getSnapshot().reason'),'source-removed');}
        }
      }
      noIO(await io());
    }
    report.boundaries.push({scenario,language,passive,after:await io()});
    for (const color of ['dark', 'light', 'yellow']) for (const width of [320,390,768,1024,1280,1440,1600]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false}); await theme(color);
      const result=await evaluate(`(()=>{const r=hv.contentEl,section=r.querySelector('.veynrel-neighborhood')??r.querySelector('.veynrel-discover');const svg=r.querySelector('.veynrel-neighborhood-svg');const nav=r.querySelector('nav');return {width:r.clientWidth,scroll:r.scrollWidth,section:section.clientWidth,sectionScroll:section.scrollWidth,title:section.querySelector('h1').textContent,rawKeys:/@neighborhood\\./.test(r.innerText),tabs:nav.querySelectorAll('button').length,current:nav.querySelector('[aria-current="page"]').getAttribute('data-health-action'),svgTabs:svg?.querySelectorAll('[tabindex="0"]').length??0,hidden:svg?.getAttribute('aria-hidden'),columns:r.querySelector('.veynrel-neighborhood-composition')?getComputedStyle(r.querySelector('.veynrel-neighborhood-composition')).gridTemplateColumns:null}})()`);
      assert(result.scroll<=result.width+1 && result.sectionScroll<=result.section+1,JSON.stringify({scenario,language,color,width,...result}));
      assert(!result.rawKeys); assert.equal(result.tabs,7);assert.equal(result.current,'nav-discover');assert.equal(result.svgTabs,0);
      report.matrix.push({scenario,language,theme:color,viewport:width,...result});
    }
    if(language==='en'){
      await theme('dark');
      if(scenario==='chooser')await screenshot('semantic-neighborhood-chooser',1280);
      if(scenario==='ten')await screenshot('semantic-neighborhood-desktop',1600);
      if(scenario==='selected'){await screenshot('semantic-neighborhood-selected',1440,true);await screenshot('semantic-neighborhood-390',390,true);await theme('yellow');await screenshot('semantic-neighborhood-yellow',1280,true);}
      if(scenario==='stale')await screenshot('semantic-neighborhood-stale',1280);
    }
    await fs.writeFile(root+'/native-progress.json',JSON.stringify(report,null,2));
  }
  // Real pointer selection and shared plugin-session ownership across two native leaves.
  await setup(11); await click('nav-discover'); await load(); await resetIO();
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const point=await evaluate(`(()=>{const el=hv.contentEl.querySelectorAll('[data-neighborhood-node]')[1];el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  assert.equal(await evaluate('hv.neighborhoodView.selected'),'Databases/Hash Join.md');assert.equal((await io()).similarity,0);noIO(await io());
  report.interactions.push('native pointer selects the same inspector without querying');
  await evaluate(`(async()=>{window.secondLeaf=app.workspace.getLeaf('tab');await secondLeaf.setViewState({type:'veynrel-health',active:true});await secondLeaf.view.controller.getHealthService();})()`);
  assert.equal(await evaluate('secondLeaf.view.neighborhood===np'),true);
  await resetIO(); await evaluate(`secondLeaf.view.contentEl.querySelector('[data-health-action="nav-discover"]').click();secondLeaf.view.contentEl.querySelector('[data-health-action="neighborhood-open"]').click();np.prepare()`);
  assert.equal((await io()).catalog,0);assert.equal((await io()).similarity,0);noIO(await io());
  await evaluate('secondLeaf.detach();app.workspace.setActiveLeaf(hv.leaf)');
  report.interactions.push('two native Veynrel leaves share the prepared controller and map without repeated IO');
  // Explicit recenter, coalescing, same-route viewport and keyboard focus.
  await setup(11); await click('nav-discover'); await load(); await click('neighborhood-select-1'); await resetIO();
  await evaluate(`hv.contentEl.querySelector('[data-health-action="neighborhood-explore"]').focus({preventScroll:true})`);
  await click('neighborhood-explore'); await evaluate('np.pending');
  assert.equal((await io()).similarity,1); assert.equal(await evaluate('np.getSnapshot().map.source.path'),'Databases/Hash Join.md'); noIO(await io());
  assert.equal(await evaluate(`document.activeElement.getAttribute('data-health-action')`),'neighborhood-select-0');
  await evaluate(`hv.contentEl.querySelector('[data-health-action="neighborhood-choose"]').focus({preventScroll:true})`); await click('neighborhood-choose');
  assert.equal(await evaluate(`document.activeElement.getAttribute('data-health-action')`),'neighborhood-search');
  await evaluate(`(()=>{const input=hv.contentEl.querySelector('[data-health-action="neighborhood-search"]');input.value='Query Planning';input.dispatchEvent(new Event('input'));const b=hv.contentEl.querySelector('[data-health-action="neighborhood-source-0"]');b.focus();b.click()})()`); await evaluate('np.pending');
  assert.equal(await evaluate(`document.activeElement.getAttribute('data-health-action')`),'neighborhood-select-0');
  report.interactions.push('source choice, Explore and Choose another retain meaningful keyboard focus');
  report.interactions.push('neighbor selection does zero queries; Explore recenters exactly once');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:1,mobile:false});
  await evaluate(`(()=>{const original=engine.findSimilarNotes;window.hold=new Promise(r=>window.release=r);engine.findSimilarNotes=async function(path){await hold;return original.call(this,path)};window.releaseDiscovery=()=>engine.findSimilarNotes=original;hv.contentEl.scrollTop=300;const b=hv.contentEl.querySelector('[data-health-action="neighborhood-refresh"]');b.focus({preventScroll:true});window.beforeScroll=hv.contentEl.scrollTop;b.click();})()`);
  const loading=await evaluate(`({state:np.getSnapshot().state,scroll:hv.contentEl.scrollTop,before:beforeScroll,disabled:hv.contentEl.querySelector('[data-health-action="neighborhood-refresh"]').disabled,live:hv.status.innerText})`);
  assert.equal(loading.state,'loading'); assert.equal(loading.scroll,loading.before); assert(loading.disabled); assert(loading.live.includes('Building'));
  await evaluate('release();np.pending'); await evaluate('releaseDiscovery()');
  assert.deepEqual(await evaluate(`({scroll:hv.contentEl.scrollTop,focus:document.activeElement.getAttribute('data-health-action')})`),{scroll:loading.before,focus:'neighborhood-refresh'});
  report.interactions.push('held refresh preserves scroll and nearby focus, then restores the button');
  await click('neighborhood-select-1');
  await evaluate(`hv.contentEl.querySelector('[data-health-action="neighborhood-explore"]').focus()`);
  await resetIO();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await evaluate('np.pending');assert.equal((await io()).similarity,1);noIO(await io());
  report.interactions.push('native Enter activates Explore through the real button');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate(`[...hv.contentEl.querySelectorAll('.veynrel-neighborhood *')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration.split(',').every(x=>parseFloat(x)===0))`));
  report.interactions.push('reduced motion disables all Neighborhood transitions and animation');
  await send('Emulation.setEmulatedMedia',{features:[]});
  // Large corpus, one-source workload. DOM measurement includes the view rerender.
  await setup(1000); await click('nav-discover'); await load();
  report.performance=await evaluate(`(()=>{const values=[];for(let i=0;i<7;i++){const start=performance.now();hv.render();values.push(performance.now()-start)}return {documents:np.getSnapshot().map.indexedNoteCount,neighbors:np.getSnapshot().map.neighbors.length,domRenderMs:values,domMedianMs:[...values].sort((a,b)=>a-b)[3]}})()`);
  assert.equal(report.performance.documents,1000);assert.equal(report.performance.neighbors,10);noIO(await io());
  assert.equal(exceptions.length,0);
  await fs.writeFile(root+'/native.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:report.matrix.length,boundaries:report.boundaries.length,interactions:report.interactions,performance:report.performance,screenshots:report.screenshots,exceptions},null,2));
} finally { await evaluate('window.nativeRestore?.()').catch(()=>{}); socket.close(); }
