// Isolated native smoke. Prepare with scripts/connection-opportunities-prepare.mjs.
// node scripts/connection-opportunities-native.mjs http://127.0.0.1:9260 /tmp/connection-opportunities-smoke
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
const search=async value=>evaluate(`(()=>{const input=hv.contentEl.querySelector('[data-health-action="connections-search"]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input'));})()`);
const digest=async()=>{
  const paths=(await fs.readdir(vault,{recursive:true})).filter(p=>p.endsWith('.md')||p.startsWith('.obsidian/plugins/ai-knowledge-hub/')&&/\.(json|bin)$/.test(p));
  return Object.fromEntries(await Promise.all(paths.map(async p=>[p,crypto.createHash('sha256').update(await fs.readFile(vault+'/'+p)).digest('hex')])));
};
const oracle=async()=>evaluate(`(()=>{
  const c=cp.getSnapshot().comparison,s=gp.getSnapshot().map,t=tp.getSnapshot().map;
  const mapped=new Set(s.nodes.map(n=>n.path)),known=new Set(t.nodes.filter(n=>n.linksAvailable&&mapped.has(n.path)).map(n=>n.path));
  const key=(a,b)=>JSON.stringify([a,b].sort());
  const explicit=new Set(t.edges.map(e=>key(e.source,e.target))),sem=new Set(s.edges.map(e=>key(e.left,e.right)));
  const comparable=s.edges.filter(e=>known.has(e.left)&&known.has(e.right));
  return {actual:{mapped:c.semanticMappedNoteCount,topology:c.topologyNoteCount,comparable:c.comparableNoteCount,semantic:c.semanticPairCount,candidate:c.candidateCount,aligned:c.alignedCount,explicitOnly:c.explicitOnlyCount,unclassified:c.unclassifiedSemanticPairCount,outside:c.explicitOutsideSemanticMapCount},
    expected:{mapped:s.nodes.length,topology:t.nodes.length,comparable:known.size,semantic:s.edges.length,candidate:comparable.filter(e=>!explicit.has(key(e.left,e.right))).length,aligned:comparable.filter(e=>explicit.has(key(e.left,e.right))).length,
      explicitOnly:[...explicit].filter(k=>{const [a,b]=JSON.parse(k);return known.has(a)&&known.has(b)&&!sem.has(k)}).length,
      unclassified:s.edges.length-comparable.length,outside:[...explicit].filter(k=>JSON.parse(k).some(p=>!mapped.has(p))).length},pairs:c.pairs};})()`);
try{
  await send('Runtime.enable');await send('Page.bringToFront');
  assert.equal(await evaluate('app.vault.adapter.getBasePath()'),vault);
  await evaluate(`(async()=>{const trust=[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Trust author and enable plugins');if(trust){trust.click();await new Promise(r=>setTimeout(r,1000));}})()`);
  report.environment=await evaluate('({electron:process.versions.electron,platform:process.platform,obsidian:navigator.userAgent.split("obsidian/")[1]?.split(" ")[0]??null})');
  report.artifactSha256=crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  for(const language of ['en','ru']){
    await setup(150,language);const before=await digest();await resetIO();await click('nav-discover');
    const passive=await io();noIO(passive);for(const k of ['semanticLoad','topologyLoad','global','snapshot','inventory','metadata'])assert.equal(passive[k],0);
    // Typical flow: existing Global Map is reused. No focus score is needed for comparison.
    await click('global-map-open');await evaluate('gp.load()');await click('global-map-back');await resetIO();
    await click('connections-open');await evaluate('cp.load()');
    assert.equal(await evaluate('cp.getSnapshot().state'),'ready');
    const opened=await io();noIO(opened);assert.equal(opened.global,0);assert.equal(opened.snapshot,0);assert.equal(opened.semanticLoad,0);assert.equal(opened.topologyLoad,1);assert(opened.metadata>0);
    const result=await oracle();assert.deepEqual(result.actual,result.expected);assert.equal(result.actual.aligned,2);assert.equal(result.actual.explicitOnly,1);assert.equal(result.actual.outside,1);assert(result.actual.candidate>50&&result.actual.unclassified>0);assert.equal(result.actual.comparable,148);
    const plan=JSON.parse(await fs.readFile(root+'/fixtures/150/comparison-plan.json','utf8'));
    const pair=source=>result.pairs.find(p=>p.leftPath===source.left&&p.rightPath===source.right);
    assert.equal(pair(plan.oneWay).markdown.direction,'left-to-right');assert.equal(pair(plan.reciprocal).markdown.direction,'reciprocal');assert.equal(pair(plan.explicitOnly).semantic,undefined);
    report.boundaries.push({language,passive,opened,counts:result.actual});
    const evidence = await evaluate(`(()=>{
      const c=cp.getSnapshot().comparison,s=gp.getSnapshot().map,byPath=new Map(s.nodes.map(n=>[n.path,n]));
      const candidates=c.pairs.filter(p=>p.category==='candidate'),counts={};
      for(const rank of ['mutual-top-3','mutual-top-5','one-sided-top-5'])counts[rank]=candidates.filter(p=>p.semantic.rankClass===rank).length;
      return {counts,sharedCounts:[...new Set(candidates.map(p=>p.semantic.sharedNeighborPaths.length))],drawings:candidates.filter(p=>[p.leftPath,p.rightPath].some(p=>p.toLowerCase().endsWith('.excalidraw.md'))).length,
        sharedValid:c.pairs.filter(p=>p.semantic).every(p=>JSON.stringify(p.semantic.sharedNeighborPaths)===JSON.stringify(byPath.get(p.leftPath).neighbors.map(n=>n.path).filter(path=>path!==p.leftPath&&path!==p.rightPath&&byPath.get(p.rightPath).neighbors.some(n=>n.path===path)).sort()))};})()`);
    assert(evidence.sharedValid); assert(evidence.drawings>0); for(const n of Object.values(evidence.counts))assert(n>0);
    for(const n of [0,1,2])assert(evidence.sharedCounts.includes(n));
    await click('connections-rank-mutual-top-3'); await click('connections-pair-0'); await click('connections-review-useful');
    assert.equal(await evaluate(`hv.contentEl.querySelector('[data-health-action="connections-review-useful"]').getAttribute('aria-pressed')`),'true');
    await click('connections-pair-1');await click('connections-review-not-useful');
    await click('connections-pair-2');await click('connections-review-unsure');
    await click('connections-review-clear');await click('connections-review-unsure');
    assert.equal(await evaluate('hv.comparisonView.reviewByPairId.size'),3);
    await click('connections-review-filter-unreviewed');
    await evaluate(`(()=>{const input=hv.contentEl.querySelector('[data-health-action="connections-hide-excalidraw"]');input.checked=true;input.dispatchEvent(new Event('change'));})()`);
    assert(await evaluate(`cp.getSnapshot().comparison.candidateCount===${result.actual.candidate}`));
    assert(await evaluate(`!([...hv.contentEl.querySelectorAll('.veynrel-connections-list button')].some(b=>b.title.toLowerCase().includes('.excalidraw.md')))`));
    await search('.md');assert(await evaluate(`!hv.contentEl.querySelector('[data-health-action="connections-more"]').hidden`));
    await click('connections-more');assert.equal(await evaluate('hv.comparisonView.visibleLimit'),100);
    await click('connections-pair-0');const reviewedState=await viewState();await evaluate('window.reviewComparison=cp.getSnapshot()');
    await click('connections-explore-left');await evaluate('np.load(np.getSnapshot().sourcePath)');
    for(let i=0;i<2;i++){await click('neighborhood-select-1');await click('neighborhood-explore');await evaluate('np.load(np.getSnapshot().sourcePath)');}
    await click('neighborhood-back');assert.deepEqual(await viewState(),reviewedState);assert(await evaluate('cp.getSnapshot()===reviewComparison'));
    await evaluate('gp.focus(gp.getSnapshot().map.nodes[0].path)');await evaluate('gp.resetFocus()');assert.deepEqual(await viewState(),reviewedState);assert(await evaluate('cp.getSnapshot()===reviewComparison'));
    await click('connections-aligned');await click('connections-candidate');assert.equal(await evaluate('hv.comparisonView.reviewByPairId.size'),3);
    await search('join');assert.equal(await evaluate('hv.comparisonView.visibleLimit'),50);await search('');
    await click('connections-rank-all');await click('connections-review-filter-all');
    report.interactions.push({language,evidence,reviewRoundTrip:true,reviewedState});

    await evaluate(`hv.contentEl.querySelector('[data-health-action="connections-pair-0"]').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert(await evaluate(`document.activeElement===hv.contentEl.querySelector('.veynrel-connections-inspector')`));
    for(const scenario of ['candidate','aligned','explicit-only','stale']){
      if(scenario==='stale'){await evaluate('tp.markStale()');assert.equal(await evaluate('cp.getSnapshot().state'),'stale');}
      else{await click('connections-'+scenario);await click('connections-pair-0');}
      for(const color of ['dark','light','yellow'])for(const width of [320,390,768,1024,1280,1440,1600]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});await theme(color);
        const presentation=await evaluate(`(()=>{const r=hv.contentEl,s=r.querySelector('.veynrel-connections');return {width:r.clientWidth,scroll:r.scrollWidth,section:s.clientWidth,sectionScroll:s.scrollWidth,rawKeys:/@connections\\./.test(r.innerText),tabs:r.querySelector('nav').querySelectorAll('button').length,current:r.querySelector('nav [aria-current="page"]').getAttribute('data-health-action'),rows:r.querySelectorAll('[data-health-action^="connections-pair-"]').length,columns:getComputedStyle(r.querySelector('.veynrel-connections-composition')).gridTemplateColumns,selected:r.querySelectorAll('.veynrel-connections-list button[aria-pressed="true"]').length,buttons:[...s.querySelectorAll('[data-health-action]')].every(e=>e.tagName==='BUTTON'||e.tagName==='INPUT')};})()`);
        assert(presentation.scroll<=presentation.width+1&&presentation.sectionScroll<=presentation.section+1,JSON.stringify({scenario,width,language,color,...presentation}));
        assert(!presentation.rawKeys);assert.equal(presentation.tabs,7);assert.equal(presentation.current,'nav-discover');assert(presentation.rows<=50);assert.equal(presentation.selected,1);assert(presentation.buttons);
        const columns=presentation.columns.trim().split(/\s+/).length;assert.equal(columns,presentation.section<=760?1:2);
        report.matrix.push({scenario,language,theme:color,viewport:width,...presentation});
      }
      if(language==='en'&&scenario==='candidate'){
        await fs.mkdir(root+'/screenshots',{recursive:true});
        for(const [name,width,color] of [['desktop',1440,'dark'],['narrow',390,'light'],['yellow',1280,'yellow']]){
          await send('Emulation.setDeviceMetricsOverride',{width,height:1600,deviceScaleFactor:1,mobile:false});await theme(color);await evaluate('hv.contentEl.scrollTop=0');
          await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await new Promise(r=>setTimeout(r,150));
          const clip=await evaluate('(()=>{const r=hv.contentEl.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
          const image=await send('Page.captureScreenshot',{format:'png',clip});await fs.writeFile(root+'/screenshots/'+name+'.png',Buffer.from(image.data,'base64'));
        }
      }
    }
    await click('connections-refresh');await evaluate('cp.refresh()');assert.equal(await evaluate('cp.getSnapshot().state'),'ready');assert.equal(await evaluate('hv.comparisonView.reviewByPairId.size'),0);noIO(await io());
    await click('connections-candidate');await click('connections-more');assert.equal(await evaluate('hv.comparisonView.visibleLimit'),100);
    await search('Databases');const filtered=await evaluate("hv.contentEl.querySelectorAll('[data-health-action^=\"connections-pair-\"]').length");assert(filtered>0&&filtered<=50);
    await search('');await click('connections-aligned');await click('connections-pair-0');await search('join');
    await evaluate('hv.comparisonView.visibleLimit=100');const state=await viewState();
    const globalCalls=(await io()).global;await evaluate('window.savedComparison=cp.getSnapshot()');
    await click('connections-explore-left');await evaluate('np.load(np.getSnapshot().sourcePath)');
    for(let i=0;i<2;i++){await click('neighborhood-select-1');await click('neighborhood-explore');await evaluate('np.load(np.getSnapshot().sourcePath)');}
    await click('neighborhood-back');assert.deepEqual(await viewState(),state);assert(await evaluate('cp.getSnapshot()===savedComparison'));assert.equal((await io()).global,globalCalls);
    await evaluate('gp.focus(gp.getSnapshot().map.nodes[0].path)');await evaluate('gp.resetFocus()');assert(await evaluate('cp.getSnapshot()===savedComparison'));
    noIO(await io());assert.deepEqual(await digest(),before);
    report.interactions.push({language,roundTrip:true,state,focusPreserved:true,io:await io()});
    // Note opening is explicit navigation and measured separately from comparison IO.
    await click('connections-open-right');assert(await evaluate('!!app.workspace.getActiveFile()'));
    const splitResult=await evaluate(`(async()=>{const before=[];app.workspace.iterateAllLeaves(l=>{before.push(l)});const pair=cp.getSnapshot().comparison.pairs.find(p=>p.id===hv.comparisonView.selectedPair);await hv.openPair(pair.leftPath,pair.rightPath);await new Promise(r=>setTimeout(r,200));const after=[];app.workspace.iterateAllLeaves(l=>{after.push(l)});const added=after.filter(l=>!before.includes(l));const boxes=added.map(l=>l.view.containerEl.getBoundingClientRect());return {retained:before.every(l=>after.includes(l)),added:added.length,paths:added.map(l=>l.view.file?.path),expected:[pair.leftPath,pair.rightPath],beside:boxes.length===2&&Math.abs(boxes[0].top-boxes[1].top)<2&&Math.abs(boxes[0].left-boxes[1].left)>100};})()`);
    assert(splitResult.retained);assert.equal(splitResult.added,2);assert.deepEqual(splitResult.paths,splitResult.expected);assert(splitResult.beside);report.interactions.push({language,sideBySide:splitResult});
    assert.deepEqual(await digest(),before);
    // Clean up only leaves created by this synthetic test before the next locale matrix.
    await evaluate(`for(const leaf of app.workspace.getLeavesOfType('markdown'))leaf.detach()`);

  }
  // Real Obsidian DOM timing: same bounded renderer, source computation excluded.
  await evaluate(await fs.readFile(root+'/presentation.js','utf8'));
  const {createRequire}=await import('node:module');const {deriveConnectionComparison}=createRequire(import.meta.url)(root+'/fixture.cjs');
  for(const notes of [150,300,500]){
    const input=JSON.parse(await fs.readFile(root+'/fixtures/'+notes+'/comparison-input.json','utf8'));
    const comparison=deriveConnectionComparison(input.semantic,input.topology,1);
    const timing=await evaluate(`(()=>{const parent=document.body.createDiv({cls:'veynrel-health-view'}),samples=[];const comparison=${JSON.stringify(comparison)};for(let i=0;i<8;i++){parent.empty();const start=performance.now();comparisonPresentation.renderConnectionComparison(parent,{getSnapshot:()=>({state:'ready',comparison})},comparisonPresentation.newConnectionComparisonViewState(),{back(){},openNote(){},explore(){}});void parent.offsetHeight;if(i)samples.push(performance.now()-start);}const rows=parent.querySelectorAll('[data-health-action^="connections-pair-"]').length;parent.remove();return {samples,medianMs:[...samples].sort((a,b)=>a-b)[3],rows};})()`);
    assert.equal(timing.rows,50);report.performance.push({notes,pairs:comparison.pairs.length,...timing});
  }
  assert.equal(exceptions.length,0);
  await fs.writeFile(root+'/native-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({matrix:report.matrix.length,boundaries:report.boundaries,interactions:report.interactions.length,performance:report.performance,exceptions},null,2));
}finally{await evaluate('window.nativeRestore?.()').catch(()=>{});socket.close();}
