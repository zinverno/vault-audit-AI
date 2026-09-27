// Isolated native smoke. Prepare with scripts/global-semantic-map-prepare.mjs.
// node scripts/global-semantic-map-native.mjs http://127.0.0.1:9258 /tmp/global-semantic-map-smoke
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
const report = { matrix: [], boundaries: [], interactions: [], screenshots: [], exceptions, performance: [], limitations: ['requestUrl is instrumented in the real-runtime integration test; native counters cover provider embed, fetch and XHR', 'Linux desktop only; narrow desktop viewport is not mobile OS', 'No screen reader, popout, third-party theme, or live provider testing'] };
const noIO = values => { for (const key of ['embed', 'fetch', 'xhr', 'read', 'cachedRead', 'write', 'writeBinary', 'saveData', 'mutate']) assert.equal(values[key], 0, key + ': ' + JSON.stringify(values)); };
const setup = async (count, language = 'en', disabled = false) => {
  await evaluate(`(async()=>{window.nativeRestore?.(); for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach(); await app.plugins.disablePlugin('ai-knowledge-hub');})()`);
  const settings = JSON.parse(await fs.readFile(pluginDir + '/data.json', 'utf8'));
  settings.language = language; settings.semantic.enabled = !disabled; settings.semantic.embeddingModel = 'global-map-synthetic';
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
    window.np=hv.neighborhood; window.gp=hv.globalMap; window.store=engine.runtimeSlot?.runtime.components?.vectorStore;
    await new Promise(r=>setTimeout(r,180));
    window.io={focus:0,global:0,catalog:0,similarity:0,snapshot:0,embed:0,fetch:0,xhr:0,read:0,cachedRead:0,write:0,writeBinary:0,saveData:0,mutate:0};
    const restores=[]; const wrap=(obj,key,counter)=>{if(!obj||typeof obj[key]!=='function')return;const original=obj[key];obj[key]=function(...args){io[counter]++;return original.apply(this,args)};restores.push(()=>obj[key]=original)};
    wrap(engine,'analyzeSemanticFocus','focus');wrap(engine,'analyzeGlobalSemanticMap','global');wrap(engine,'listIndexedPaths','catalog');wrap(engine,'findSimilarNotes','similarity');wrap(store,'readSnapshot','snapshot');wrap(store,'applyChanges','mutate');
    wrap(engine.runtimeSlot?.runtime.components?.searchService.provider,'embed','embed');
    wrap(window,'fetch','fetch');wrap(XMLHttpRequest.prototype,'open','xhr');
    wrap(app.vault,'read','read');wrap(app.vault,'cachedRead','cachedRead');wrap(plugin,'saveData','saveData');
    const adapter=app.vault.adapter;
    for(const key of ['write','writeBinary','append','remove','rename','mkdir']){const original=adapter[key];adapter[key]=function(path,...args){if(path.startsWith('.obsidian/plugins/ai-knowledge-hub/'))io[key==='writeBinary'?'writeBinary':'write']++;return original.call(this,path,...args)};restores.push(()=>adapter[key]=original)}
    window.nativeRestore=()=>{restores.reverse().forEach(f=>f());window.nativeRestore=undefined};
  })()`);
};
const load = async () => { await click('global-map-open'); await evaluate('gp.load()'); };
const theme = async name => evaluate(`document.body.classList.toggle('theme-dark',${name !== 'light'});document.body.classList.toggle('theme-light',${name === 'light'});document.body.style.setProperty('--interactive-accent',${JSON.stringify(name === 'yellow' ? '#dbb42c' : '')});`);
const screenshot = async (name, width, selected = false) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 1900 : 1500, deviceScaleFactor: 1, mobile: false });
  await evaluate('hv.contentEl.scrollTop=0');
  const clip = await evaluate(`(()=>{const r=hv.contentEl.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
  const data = await send('Page.captureScreenshot', { format: 'png', clip });
  await fs.mkdir(root + '/screenshots', { recursive: true }); await fs.writeFile(root + '/screenshots/' + name + '.png', Buffer.from(data.data, 'base64')); report.screenshots.push(name + '.png');
};
const searchSelect = async query => {
  await evaluate(`(()=>{const input=hv.contentEl.querySelector('[data-health-action="global-map-search"]');input.value=${JSON.stringify(query)};input.dispatchEvent(new Event('input'));})()`);
  await click('global-map-result-0');
};
const digestPlugin = async () => {
  const paths = (await fs.readdir(pluginDir, { recursive:true })).filter(p => /(?:\.json|\.bin|\.md)$/.test(p));
  return Object.fromEntries(await Promise.all(paths.map(async p => [p,crypto.createHash('sha256').update(await fs.readFile(pluginDir+'/'+p)).digest('hex')])));
};
try {
  await send('Runtime.enable'); await send('Page.bringToFront');
  assert.equal(await evaluate('app.vault.adapter.getBasePath()'),vault);
  report.environment=await evaluate('({obsidian:document.title,version:app.appVersion??app.version??null,electron:process.versions.electron,platform:process.platform})');
  report.artifactSha256=crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  for(const language of ['en','ru']) for(const scenario of ['overview','selected','stale','single','too-large','disabled','absent','focus','focus-selected','focus-stale']){
    const count=scenario==='too-large'?501:scenario==='single'?1:scenario==='absent'?0:150;
    await setup(count,language,scenario==='disabled'); await resetIO(); await click('nav-discover');
    const passive=await io();noIO(passive);for(const key of ['focus','global','snapshot','catalog','similarity'])assert.equal(passive[key],0);
    const before=await digestPlugin();
    if(['disabled','absent'].includes(scenario))assert.equal(await evaluate(`!!hv.contentEl.querySelector('[data-health-action="global-map-open"]')`),false);
    else{
      await load();assert.equal(await evaluate('gp.getSnapshot().state'),scenario==='too-large'?'unavailable':'ready');
      if(scenario==='too-large'){assert.equal(await evaluate('gp.getSnapshot().reason'),'too-large');assert.equal(await evaluate('!!gp.getSnapshot().map'),false);}
      else{
        assert.equal(await evaluate('gp.getSnapshot().map.mappedNoteCount'),count);
        assert.equal(await evaluate(`hv.contentEl.querySelectorAll('[data-global-map-node]').length`),count);
        if(scenario==='selected'||scenario.startsWith('focus'))await searchSelect('Hash Join');
        if(scenario.startsWith('focus')){
          await click('global-map-focus');await evaluate('gp.pending');
          assert.equal(await evaluate('gp.getSnapshot().focus.path'),'Databases/Hash Join.md');
          assert.equal((await io()).focus,1);assert.equal((await io()).global,1);
          if(scenario==='focus-selected')await click('global-map-neighbor-0');
        }
        if(scenario==='stale'||scenario==='focus-stale'){
          noIO(await io());assert.deepEqual(await digestPlugin(),before);
          await evaluate('store.applyChanges({})');await evaluate('engine.getCachedIndexState()');await evaluate('Promise.resolve()');
          assert.equal(await evaluate('gp.getSnapshot().state'),'stale');await resetIO();
        }
      }
      noIO(await io());if(!scenario.endsWith('stale'))assert.deepEqual(await digestPlugin(),before);
    }
    report.boundaries.push({scenario,language,passive,after:await io()});
    for(const color of ['dark','light','yellow'])for(const width of [320,390,768,1024,1280,1440,1600]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await theme(color);
      const result=await evaluate(`(()=>{const r=hv.contentEl,s=r.querySelector('.veynrel-global-map')??r.querySelector('.veynrel-discover'),svg=r.querySelector('.veynrel-global-map-svg');return {width:r.clientWidth,scroll:r.scrollWidth,section:s.clientWidth,sectionScroll:s.scrollWidth,rawKeys:/@(?:global-map|neighborhood)\\./.test(r.innerText),tabs:r.querySelector('nav').querySelectorAll('button').length,current:r.querySelector('nav [aria-current="page"]').getAttribute('data-health-action'),svgTabs:svg?.querySelectorAll('[tabindex="0"]').length??0,labels:svg?[...svg.querySelectorAll('.veynrel-global-map-label')].filter(e=>getComputedStyle(e).display!=='none').length:0,columns:r.querySelector('.veynrel-global-map-composition')?getComputedStyle(r.querySelector('.veynrel-global-map-composition')).gridTemplateColumns:null}})()`);
      assert(result.scroll<=result.width+1&&result.sectionScroll<=result.section+1,JSON.stringify({scenario,language,color,width,...result}));
      assert(!result.rawKeys);assert.equal(result.tabs,7);assert.equal(result.current,'nav-discover');assert.equal(result.svgTabs,0);
      if(scenario==='overview')assert.equal(result.labels,width<=390?3:5);
      if(['overview','selected','stale','single'].includes(scenario)||scenario.startsWith('focus')){
        const presentation=await evaluate(`(()=>{
          const r=hv.contentEl,svg=r.querySelector('.veynrel-global-map-svg'),map=gp.getSnapshot().map;
          const labels=[...svg.querySelectorAll('.veynrel-global-map-label')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBBox());
          const overlaps=labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));
          const summary=[...r.querySelectorAll('.veynrel-global-map-summary dd')].map(e=>e.innerText);
          const focus=gp.getSnapshot().focus;
          const scores=[focus?focus.scores.filter(n=>n.path!==focus.path).map(n=>n.score):map.nodes.map(n=>n.coreSimilarity),map.nodes.map(n=>n.semanticConnectedness).filter(n=>n!==null)].map(a=>a.sort((x,y)=>x-y));
          return {overlaps:overlaps.length,rings:[...svg.querySelectorAll('.veynrel-global-map-ring-label')].map(e=>e.textContent),
            scale:r.querySelector('.veynrel-global-map-scale').innerText,summary,
            values:scores.map(a=>a.length?[a[0],a[a.length-1],a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2].map(n=>n.toFixed(3)):[]),
            sizes:[...svg.querySelectorAll('.veynrel-global-map-dot')].map(e=>+e.getAttribute('r')),
            leadersIgnorePointer:[...svg.querySelectorAll('.veynrel-global-map-label-link')].every(e=>getComputedStyle(e).pointerEvents==='none')};
        })()`);
        assert.equal(presentation.overlaps,0,JSON.stringify({language,color,width,presentation}));
        assert.deepEqual(presentation.rings,['+1','0','-1']);assert(presentation.scale.length>20);assert(presentation.leadersIgnorePointer);
        presentation.values.forEach((values,i)=>values.forEach(value=>assert(presentation.summary[i].includes(value))));
        assert(presentation.sizes.every(radius=>radius>=4&&radius<=14));
        result.presentation=presentation;
      }
      if(scenario.startsWith('focus')){
        const centered=await evaluate(`(()=>{const r=hv.contentEl,svg=r.querySelector('.veynrel-global-map-svg'),focus=gp.getSnapshot().focus;
          const dot=[...svg.querySelectorAll('[data-global-map-node]')].find(n=>n.getAttribute('data-global-map-node')===focus.path).querySelector('.veynrel-global-map-dot');
          return {x:+dot.getAttribute('cx'),y:+dot.getAttribute('cy'),virtualCore:!!svg.querySelector('.veynrel-global-map-core'),visible:r.querySelector('.veynrel-global-map-focus').innerText,
            centerLabel:svg.querySelector('.veynrel-global-map-focused-center').textContent,selfMetric:r.querySelector('.veynrel-global-map-facts').innerText.includes('1.000'),scale:r.querySelector('.veynrel-global-map-scale').innerText};})()`);
        assert.equal(centered.x,500);assert.equal(centered.y,500);assert(!centered.virtualCore);assert(centered.visible.includes('Hash Join'));
        assert(centered.centerLabel.includes(language==='en'?'Focused note':'Заметка в центре'));
        assert(centered.scale.includes(language==='en'?'selected note':'выбранной заметкой'));
        if(scenario!=='focus-selected')assert(!centered.selfMetric);
        result.centered=centered;
      }
      report.matrix.push({scenario,language,theme:color,viewport:width,...result});
    }
    if(language==='en'){
      await theme('dark');
      if(scenario==='overview')await screenshot('global-semantic-map-desktop',1600);
      if(scenario==='selected'){await screenshot('global-semantic-map-selected',1440,true);await screenshot('global-semantic-map-390',390,true);await theme('yellow');await screenshot('global-semantic-map-yellow',1280,true);}
      if(scenario==='stale')await screenshot('global-semantic-map-stale',1280);
      if(scenario==='focus'){await screenshot('semantic-map-focus',1600);await screenshot('semantic-map-focus-390',390);await theme('yellow');await screenshot('semantic-map-focus-yellow',1280);}
      if(scenario==='focus-stale')await screenshot('semantic-map-focus-stale',1280);
    }
    await fs.writeFile(root+'/native-progress.json',JSON.stringify(report,null,2));
  }
  // Native input, explicit integrations, shared ownership and refresh focus.
  await setup(150);await click('nav-discover');await load();await resetIO();
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const point=await evaluate(`(()=>{const svg=hv.contentEl.querySelector('.veynrel-global-map-svg'),dot=svg.querySelector('.veynrel-global-map-dot');dot.scrollIntoView({block:'center'});const p=svg.createSVGPoint();p.x=+dot.getAttribute('cx');p.y=+dot.getAttribute('cy');const q=p.matrixTransform(dot.getScreenCTM());return {x:q.x,y:q.y}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  assert(await evaluate('!!hv.globalMapView.selected'));const selected=await evaluate('hv.globalMapView.selected');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+65,y:point.y+30,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+65,y:point.y+30,button:'left',clickCount:1});
  assert.equal(await evaluate('hv.globalMapView.selected'),selected);assert.notEqual(await evaluate('hv.globalMapView.viewport.x'),0);
  await send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:-200,deltaX:0});
  await new Promise(r=>setTimeout(r,50));assert((await evaluate('hv.globalMapView.viewport.zoom'))>1);
  await click('global-map-fit');assert.deepEqual(await evaluate('hv.globalMapView.viewport'),{x:0,y:0,zoom:1});
  await searchSelect('Hash Join');assert.equal(await evaluate('hv.globalMapView.selected'),'Databases/Hash Join.md');
  await evaluate(`hv.contentEl.querySelector('[data-health-action="global-map-neighbor-0"]').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert(await evaluate(`document.activeElement.classList.contains('veynrel-global-map-inspector')`));
  noIO(await io());assert.equal((await io()).global,0);report.interactions.push('native pointer select, drag without selection, wheel zoom, Fit, search and Enter neighbor selection use only loaded data');
  await evaluate(`(async()=>{window.secondLeaf=app.workspace.getLeaf('tab');await secondLeaf.setViewState({type:'veynrel-health',active:true});await secondLeaf.view.controller.getHealthService();})()`);
  assert(await evaluate('secondLeaf.view.globalMap===gp'));await evaluate(`secondLeaf.view.contentEl.querySelector('[data-health-action="nav-discover"]').click();secondLeaf.view.contentEl.querySelector('[data-health-action="global-map-open"]').click();gp.load()`);
  noIO(await io());assert.equal((await io()).global,0);await evaluate('secondLeaf.detach();app.workspace.setActiveLeaf(hv.leaf)');report.interactions.push('two leaves share one cached session controller');
  await evaluate(`(()=>{const original=engine.analyzeGlobalSemanticMap;window.hold=new Promise(r=>window.release=r);engine.analyzeGlobalSemanticMap=async function(options){await hold;return original.call(this,options)};window.releaseAnalysis=()=>engine.analyzeGlobalSemanticMap=original;const b=hv.contentEl.querySelector('[data-health-action="global-map-refresh"]');b.focus();b.click();})()`);
  assert.equal(await evaluate('gp.getSnapshot().state'),'loading');assert((await evaluate('hv.status.innerText')).includes('Building global'));
  await evaluate('release();gp.pending');await evaluate('releaseAnalysis()');assert.equal(await evaluate(`document.activeElement.getAttribute('data-health-action')`),'global-map-refresh');
  report.interactions.push('loading is local compute; refresh restores keyboard focus');
  await searchSelect('Hash Join');await click('global-map-explore');await evaluate('np.pending');
  assert.equal(await evaluate('np.getSnapshot().map.source.path'),'Databases/Hash Join.md');assert.equal(await evaluate('np.getSnapshot().map.neighbors.length'),10);
  await click('neighborhood-select-6');
  for(const width of [390,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    const labels=await evaluate(`(()=>{const nodes=[...hv.contentEl.querySelectorAll('[data-neighborhood-node]')];return nodes.filter(n=>getComputedStyle(n.querySelector('.veynrel-neighborhood-label')).display!=='none').map(n=>({path:n.getAttribute('data-neighborhood-node'),rank:n.getAttribute('data-label-rank'),role:n.getAttribute('data-role'),selected:n.getAttribute('data-selected')}))})()`);
    assert.equal(labels.length,width===390?4:5);assert(labels.some(n=>n.role==='source'));assert(labels.some(n=>n.selected==='true'));
  }
  await screenshot('semantic-neighborhood-top-labels',1440,true);report.interactions.push('Explore reuses existing Neighborhood: 10 neighbors, source + selected + top3 labels; top2 at 390px');
  await click('neighborhood-back');assert.equal(await evaluate('hv.route.page'),'semantic-map');await searchSelect('Hash Join');await resetIO();
  await click('global-map-open-note');await evaluate('new Promise(r=>setTimeout(r,100))');assert.equal(await evaluate('app.workspace.getActiveFile()?.path'),'Databases/Hash Join.md');
  report.interactions.push('Open note uses the existing safe Obsidian note-opening boundary');
  await evaluate('app.workspace.setActiveLeaf(hv.leaf)');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate(`[...hv.contentEl.querySelectorAll('.veynrel-global-map *')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration.split(',').every(x=>parseFloat(x)===0))`));await send('Emulation.setEmulatedMedia',{features:[]});
  report.interactions.push('reduced motion: no animation or transitions');
  for(const count of [150,300,500]){
    await setup(count);await click('nav-discover');await resetIO();const started=performance.now();await load();const elapsed=performance.now()-started;
    const measurement=await evaluate(`(()=>{const values=[];for(let i=0;i<7;i++){const start=performance.now();hv.render();values.push(performance.now()-start)}const svg=hv.contentEl.querySelector('.veynrel-global-map-svg');return {documents:gp.getSnapshot().map.mappedNoteCount,domRenderMs:values,domMedianMs:[...values].sort((a,b)=>a-b)[3],layoutMs:+svg.getAttribute('data-layout-ms'),svgRenderMs:+svg.getAttribute('data-render-ms')}})()`);
    const refreshStart=performance.now();await evaluate('gp.refresh()');const refreshWallMs=performance.now()-refreshStart;
    report.performance.push({...measurement,loadWallMs:elapsed,refreshWallMs});noIO(await io());
  }
  // Exact child-route return ownership and focus boundaries, through real controls.
  for(const language of ['en','ru']){
    await setup(150,language);await click('nav-discover');await click('neighborhood-open');await evaluate('np.pending');
    assert.equal(await evaluate(`hv.contentEl.querySelector('[data-health-action="neighborhood-back"]').innerText`),language==='en'?'Back to Discover':'Назад к исследованию');
    await click('neighborhood-back');assert.equal(await evaluate('hv.route.page'),'discover');
    await load();await searchSelect('Hash Join');
    await evaluate('window.savedMap=gp.getSnapshot().map;window.savedCore=[...hv.contentEl.querySelectorAll(".veynrel-global-map-dot")].map(e=>[+e.getAttribute("cx"),+e.getAttribute("cy"),+e.getAttribute("r")])');
    await resetIO();await click('global-map-focus');await evaluate('gp.pending');
    assert.equal((await io()).focus,1);assert.equal((await io()).global,0);assert.equal((await io()).snapshot,1);noIO(await io());
    assert(await evaluate('savedMap===gp.getSnapshot().map'));
    const geometry=await evaluate(`(()=>{const focus=gp.getSnapshot().focus,map=gp.getSnapshot().map,scores=new Map(focus.scores.map(n=>[n.path,n.score]));
      return [...hv.contentEl.querySelectorAll('[data-global-map-node]')].map((g,i)=>{const d=g.querySelector('.veynrel-global-map-dot'),x=+d.getAttribute('cx')-500,y=+d.getAttribute('cy')-500;
        const path=g.getAttribute('data-global-map-node'),old=savedCore[i],cross=(old[0]-500)*y-(old[1]-500)*x;
        return {path,cross,radius:+d.getAttribute('r'),oldRadius:old[2],distance:Math.hypot(x,y),expected:path===focus.path?0:120+(1-(scores.get(path)+1)/2)*290};});})()`);
    for(const p of geometry){assert(Math.abs(p.cross)<1e-7);assert.equal(p.radius,p.oldRadius);assert(Math.abs(p.distance-p.expected)<1e-9);}
    // Pan/zoom with native input before entering the local Neighborhood.
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1100,deviceScaleFactor:1,mobile:false});
    const point=await evaluate(`(()=>{const svg=hv.contentEl.querySelector('.veynrel-global-map-svg');svg.scrollIntoView({block:'center'});const r=svg.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+55,y:point.y+25,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+55,y:point.y+25,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:-150,deltaX:0});await new Promise(r=>setTimeout(r,60));
    assert((await evaluate('hv.globalMapView.viewport.zoom'))>1);
    await evaluate('window.savedFocus=gp.getSnapshot().focus;window.savedView=JSON.stringify({query:hv.globalMapView.query,selected:hv.globalMapView.selected,viewport:hv.globalMapView.viewport})');
    await click('global-map-explore');await evaluate('np.pending');
    assert.equal(await evaluate(`hv.contentEl.querySelector('[data-health-action="neighborhood-back"]').innerText`),language==='en'?'Back to Global Semantic Map':'Назад к глобальной семантической карте');
    await resetIO();await click('neighborhood-back');assert.equal(await evaluate('hv.route.page'),'semantic-map');
    assert(await evaluate('gp.getSnapshot().map===savedMap&&gp.getSnapshot().focus===savedFocus&&savedView===JSON.stringify({query:hv.globalMapView.query,selected:hv.globalMapView.selected,viewport:hv.globalMapView.viewport})'));
    assert(Object.values(await io()).every(v=>v===0));
    await click('global-map-explore');await evaluate('np.pending');
    const sources=[await evaluate('np.getSnapshot().map.source.path')];
    for(const index of [1,2]){await click('neighborhood-select-'+index);await click('neighborhood-explore');await evaluate('np.pending');sources.push(await evaluate('np.getSnapshot().map.source.path'));}
    assert.equal(new Set(sources).size,3);
    await click('neighborhood-choose');await click('neighborhood-source-3');await evaluate('np.pending');await click('neighborhood-refresh');await evaluate('np.pending');
    noIO(await io());await resetIO();await click('neighborhood-back');
    assert.equal(await evaluate('hv.route.page'),'semantic-map');
    assert(await evaluate('gp.getSnapshot().map===savedMap&&gp.getSnapshot().focus===savedFocus&&savedView===JSON.stringify({query:hv.globalMapView.query,selected:hv.globalMapView.selected,viewport:hv.globalMapView.viewport})'));
    assert(Object.values(await io()).every(v=>v===0));
    await evaluate(`hv.contentEl.querySelector('[data-health-action="global-map-reset-focus"]').focus()`);
    await click('global-map-reset-focus');assert.equal(await evaluate('!!gp.getSnapshot().focus'),false);
    assert.equal(await evaluate('document.activeElement.getAttribute("data-health-action")'),'global-map-focus');
    assert(await evaluate('JSON.stringify(savedCore)===JSON.stringify([...hv.contentEl.querySelectorAll(".veynrel-global-map-dot")].map(e=>[+e.getAttribute("cx"),+e.getAttribute("cy"),+e.getAttribute("r")]))'));
    assert(Object.values(await io()).every(v=>v===0));
    await click('global-map-focus');await evaluate('gp.pending');await click('global-map-explore');await evaluate('np.pending');
    await evaluate('store.applyChanges({})');await evaluate('engine.getCachedIndexState()');await evaluate('Promise.resolve()');await resetIO();await click('neighborhood-back');
    assert.equal(await evaluate('gp.getSnapshot().state'),'stale');assert(await evaluate('!!gp.getSnapshot().focus'));
    assert(Object.values(await io()).every(v=>v===0));
    await click('global-map-refresh');await evaluate('gp.pending');assert.equal(await evaluate('gp.getSnapshot().state'),'ready');assert.equal(await evaluate('!!gp.getSnapshot().focus'),false);
    assert.equal((await io()).global,1);assert.equal((await io()).focus,0);noIO(await io());
    report.interactions.push(language+': Discover return; Global return; A/B/C recenter, choose and refresh preserve origin; map/focus/query/selection/native pan+zoom preserved; exact angles/sizes; local reset; stale return and explicit refresh reset');
  }
  // Guard the extracted shared viewport's existing topology ID-to-path contract.
  await setup(150);await click('nav-health');await click('topology-refresh');await evaluate('hv.topology.load()');await click('topology-open');
  const topologyPoint=await evaluate(`(()=>{const svg=hv.contentEl.querySelector('.veynrel-topology-svg'),dot=svg.querySelector('.veynrel-topology-dot'),group=dot.parentElement;dot.scrollIntoView({block:'center'});const p=svg.createSVGPoint();p.x=+dot.getAttribute('cx');p.y=+dot.getAttribute('cy');const q=p.matrixTransform(dot.getScreenCTM());const id=group.getAttribute('data-topology-node');return {x:q.x,y:q.y,path:hv.topology.getSnapshot().map.nodes.find(n=>n.id===id).path}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:topologyPoint.x,y:topologyPoint.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:topologyPoint.x,y:topologyPoint.y,button:'left',clickCount:1});
  assert.equal(await evaluate('hv.topologyView.selected'),topologyPoint.path);report.interactions.push('topology native pointer selection preserves ID-to-path conversion after viewport extraction');
  assert.equal(exceptions.length,0);await fs.writeFile(root+'/native.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:report.matrix.length,interactions:report.interactions,performance:report.performance,screenshots:report.screenshots,exceptions},null,2));
}finally{await evaluate('window.nativeRestore?.()').catch(()=>{});socket.close();}
