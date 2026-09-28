// Reuses the isolated native CDP fixture; see docs/large-vault-ux-stabilization.md.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
const [endpoint, root] = process.argv.slice(2);
assert(['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname));
assert(root?.startsWith('/tmp/') && !root.includes('..'));
let requests = 0, fail = false, hold = false;
const server = http.createServer(async (req, res) => {
  let bytes = ''; for await (const chunk of req) bytes += chunk;
  requests++;
  while (hold) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 120));
  if (fail) { res.writeHead(400); res.end('{}'); return; }
  const user = JSON.parse(bytes).messages.at(-1).content;
  const summaries = [...user.matchAll(/^PATH: (.+)$/gm)].map(m => ({ path: m[1], quality: 'draft' }));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(summaries) } }] }));
});
await new Promise(r => server.listen(9889, '127.0.0.1', r));
const pages = await (await fetch(endpoint + '/json/list')).json();
const socket = new WebSocket(pages.find(p => p.url.startsWith('app://obsidian.md/')).webSocketDebuggerUrl);
await new Promise((r,j) => { socket.onopen=r; socket.onerror=j; });
let sequence = 0; const pending = new Map();
socket.onmessage = e => { const m=JSON.parse(e.data), q=pending.get(m.id); if(q){pending.delete(m.id);m.error?q.reject(m.error):q.resolve(m.result);} };
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression: expression.includes('await') && !expression.startsWith('(async()=>') ? '(async()=>{'+expression+'})()' : expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=async expression=>{for(let i=0;i<600;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const click=key=>evaluate(`hv.contentEl.querySelector('[data-health-action="${key}"]').click()`);
const report={checks:[],screenshots:[],matrix:[],limitations:['Linux desktop, synthetic notes/vectors, local mock language model; no live provider, mobile OS, popout or screen-reader test']};
const shot=async name=>{await new Promise(r=>setTimeout(r,500));await fs.mkdir(root+'/screenshots',{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(root+'/screenshots/'+name+'.png',Buffer.from(r.data,'base64'));report.screenshots.push(name+'.png');};
const locale=language=>evaluate(`(async()=>{const tab=app.setting.pluginTabs.find(t=>t.id==='ai-knowledge-hub');tab.display();const select=[...tab.containerEl.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.value==='ru'));select.value=${JSON.stringify(language)};select.dispatchEvent(new Event('change'));await plugin.settingsSave;})()`);
try {
  await wait("Boolean(app.plugins.plugins['ai-knowledge-hub'] && app.commands.commands['ai-knowledge-hub:veynrel-open-health'])");
  assert.equal(await evaluate('app.vault.adapter.basePath'),root+'/vault');
  await evaluate(`(async()=>{const p=app.plugins.plugins['ai-knowledge-hub'];for(const button of document.querySelectorAll('.modal-close-button'))button.click();window.hv?.controller.cancelDeepScan();window.unsub?.();for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach();p.settings.semanticAutoSyncSuspended=true;await p.saveSettings();await app.plugins.disablePlugin('ai-knowledge-hub');})()`);
  await fs.rm(root+'/vault/.obsidian/plugins/ai-knowledge-hub/note-index.json',{force:true});
  for(const name of ['main.js','styles.css'])await fs.copyFile(name,root+'/vault/.obsidian/plugins/ai-knowledge-hub/'+name);
  await evaluate(`(async()=>{await app.plugins.enablePlugin('ai-knowledge-hub');for(let i=0;i<200&&!app.commands.commands['ai-knowledge-hub:veynrel-open-health'];i++)await new Promise(r=>setTimeout(r,25));await new Promise(r=>app.workspace.onLayoutReady(r));window.plugin=app.plugins.plugins['ai-knowledge-hub'];
    app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await plugin.semanticController.refreshSemanticStatus();
    app.commands.executeCommandById('ai-knowledge-hub:veynrel-open-health');})()`);
  await wait("Boolean(app.workspace.getLeavesOfType('veynrel-health')[0]?.view.body)");
  await evaluate(`window.hv=app.workspace.getLeavesOfType('veynrel-health')[0].view;window.gp=hv.globalMap;window.auditIndex=await plugin.getIndex();`);
  assert.equal(await evaluate('app.vault.getMarkdownFiles().length'),500);
  report.versions=await evaluate(`({obsidian:app.appVersion ?? document.title,electron:process.versions.electron})`);
  // Audit first run and incremental state, both locales, narrow/short desktop layouts.
  for(const state of ['fresh','current','changed']) {
    if(state==='current')await evaluate(`(async()=>{for(const f of app.vault.getMarkdownFiles())auditIndex.set(f.path,{mtime:f.stat.mtime,analyzedAt:Date.now(),mainIdea:'Synthetic',keyPoints:[],entities:[],quality:'developed',suggestedTags:[],wordCount:10,mode:'single'});await auditIndex.save();})()`);
    if(state==='changed')await evaluate(`(async()=>{for(const f of app.vault.getMarkdownFiles().slice(0,12))await app.vault.modify(f,(await app.vault.read(f))+'\\nChanged for synthetic acceptance.\\n');})()`);
    for(const language of ['en','ru'])for(const width of [1000,390]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false});
      await locale(language);await evaluate('plugin.openAuditModeModal()');
      await wait("document.querySelectorAll('.ai-hub-audit-mode').length===3");
      const result=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.ai-hub-audit-mode')],content=cards[0].closest('.modal-content');return {counts:cards.map(c=>Number(c.querySelector('.ai-hub-card-badge').textContent.match(/\\d+/)[0])),disabled:cards.map(c=>c.getAttribute('aria-disabled')),overflow:content.scrollWidth>content.clientWidth+1,raw:/@audit/.test(content.textContent),context:content.querySelector('.ai-hub-audit-context').textContent,badgesInside:cards.every(c=>{const a=c.getBoundingClientRect(),b=c.querySelector('.ai-hub-card-badge').getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom})};})()`);
      assert.deepEqual(result.counts,state==='fresh'?[500,500,500]:state==='current'?[0,500,0]:[12,500,12]);
      assert(!result.overflow && !result.raw && result.badgesInside,JSON.stringify(result));
      assert(result.context.includes(language==='en'?(state==='fresh'?'First run':state==='current'?'No new':'New and changed'):(state==='fresh'?'Первый запуск':state==='current'?'Новых и изменённых':'Новые и изменённые')));
      if(state==='fresh')assert.equal(await evaluate('auditIndex.getUpdatedAt()'),'');
      await shot('audit-'+state+'-'+language+'-'+width);
      report.matrix.push({state,language,width,...result});
      await evaluate(`document.querySelector('.modal-close-button').click()`);
    }
  }
  report.checks.push('Fresh 500 / current 0 / changed 12 counts, cache copy, badge containment and scrolling in EN/RU at 1000px and 390px');
  // Native keyboard activation still delegates to the detailed incremental path.
  await evaluate(`window.originalSingle=plugin.runSingleAudit;window.selectedMode=null;plugin.runSingleAudit=async(_index,onlyStale)=>{selectedMode=onlyStale};await plugin.openAuditModeModal();`);
  await wait("document.querySelectorAll('.ai-hub-audit-mode').length===3");
  await evaluate(`document.querySelector('.ai-hub-audit-mode').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate('selectedMode'),true);
  await evaluate('plugin.runSingleAudit=originalSingle');
  report.checks.push('Enter on the incremental card preserves onlyStale=true');
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
  await locale('en');await evaluate(`window.progress=[];window.service=await hv.controller.getHealthService();window.unsub=service.subscribe(()=>{const p=hv.controller.getState().deepProgress;if(p)progress.push({...p});});`);
  const beforeRequests=requests; hold=true;
  await click('deep-knowledge'); assert.equal(requests,beforeRequests);await click('knowledge-start');
  await wait("hv.controller.getState().deepProgress?.stage==='mapping'");
  assert.match(await evaluate('hv.contentEl.textContent'),/0 \/ 100 batches processed/);
  await new Promise(r=>setTimeout(r,1100));
  assert.match(await evaluate('hv.contentEl.textContent'),/Elapsed: 0m 0[1-9]s/);
  await evaluate("hv.contentEl.querySelector('.veynrel-knowledge-progress').scrollIntoView({block:'center'})");await shot('health-mapping-start');hold=false;
  await wait("hv.controller.getState().deepProgress?.stage==='mapping' && hv.controller.getState().deepProgress.current>10");
  await evaluate("hv.contentEl.querySelector('.veynrel-knowledge-progress').scrollIntoView({block:'center'})");await shot('health-mapping-progress');
  await wait('!hv.controller.getState().deepScanRunning');
  const health=await evaluate(`({running:hv.controller.getState().deepScanRunning,progress:hv.controller.getState().deepProgress,outcome:hv.controller.getState().deepOutcome.scan.status,stages:[...new Set(progress.map(p=>p.stage))],countsValid:progress.every(p=>!('current'in p)||p.current>=0&&p.current<=p.total),maxReading:Math.max(...progress.filter(p=>p.stage==='reading').map(p=>p.current)),maxMapping:Math.max(...progress.filter(p=>p.stage==='mapping').map(p=>p.current))})`);
  assert.equal(health.outcome,'completed');assert(!health.running&&health.progress===undefined&&health.countsValid);assert.equal(health.maxReading,500);assert.equal(health.maxMapping,100);
  assert.deepEqual(health.stages,['preparing','reading','mapping','verifying','saving']);assert.equal(requests-beforeRequests,100);report.health=health;
  // Failure and cancel cleanup use the same real provider transport and engine.
  fail=true;await evaluate('window.originalFiles=app.vault.getMarkdownFiles;app.vault.getMarkdownFiles=()=>originalFiles.call(app.vault).slice(0,1)');await click('deep-knowledge');await click('knowledge-start');
  await wait('!hv.controller.getState().deepScanRunning');
  assert.equal(await evaluate('hv.controller.getState().deepOutcome.scan.status'),'failed');
  assert.equal(await evaluate('hv.controller.getState().deepProgress'),undefined);
  await evaluate('app.vault.getMarkdownFiles=originalFiles');fail=false;hold=true;await click('deep-knowledge');await click('knowledge-start');
  await wait("hv.controller.getState().deepProgress?.stage==='mapping'");
  assert.equal(await evaluate('hv.controller.getState().deepProgress.current'),0);
  await click('knowledge-cancel');await wait('!hv.controller.getState().deepScanRunning');hold=false;
  assert.equal(await evaluate('hv.controller.getState().deepCancelled'),true);await evaluate('unsub()');
  report.checks.push('500-note real Health pipeline: reading 0–500, MAP 0–100, elapsed, verify/save, success, provider failure, restart and cancel cleanup');
  // Global map: real captured vectors and native input, no recalculation on viewport changes.
  await click('nav-discover');await click('global-map-open');await evaluate('gp.load()');
  await wait("gp.getSnapshot().state==='ready'");
  await evaluate(`window.mapBefore=JSON.stringify(gp.getSnapshot().map);window.mapCalls=0;window.originalMap=plugin.semanticController.analyzeGlobalSemanticMap;plugin.semanticController.analyzeGlobalSemanticMap=function(...a){mapCalls++;return originalMap.apply(this,a)};`);
  assert.equal(await evaluate("hv.contentEl.querySelectorAll('[data-global-map-node]').length"),500);
  await evaluate("hv.contentEl.querySelector('.veynrel-global-map-svg').scrollIntoView({block:'center'})");await shot('map-overview-500');
  await evaluate(`(()=>{const e=hv.contentEl.querySelector('[data-health-action="global-map-search"]');e.value='Document 0250';e.dispatchEvent(new Event('input'));})()`);
  await click('global-map-result-0');
  for(let i=0;i<8;i++)await click('global-map-zoom-in');
  assert.equal(await evaluate('hv.globalMapView.viewport.zoom'),24);
  await evaluate("hv.contentEl.querySelector('.veynrel-global-map-svg').scrollIntoView({block:'center'})");
  const target=await evaluate(`(()=>{const svg=hv.contentEl.querySelector('.veynrel-global-map-svg'),s=svg.getBoundingClientRect(),dot=[...svg.querySelectorAll('[data-selected="false"] .veynrel-global-map-dot')].find(d=>{const r=d.getBoundingClientRect();return r.x>=s.x&&r.right<=s.right&&r.y>=Math.max(0,s.y)&&r.bottom<=Math.min(innerHeight,s.bottom)&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-global-map-node]')===d.closest('[data-global-map-node]')}),r=dot.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,path:dot.closest('[data-global-map-node]').getAttribute('data-global-map-node'),inside:r.x>=s.x&&r.right<=s.right&&r.y>=s.y&&r.bottom<=s.bottom}})()`);
  assert(target.inside);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y});
  assert.equal(await evaluate(`getComputedStyle(hv.contentEl.querySelector('[data-global-map-node]:hover .veynrel-global-map-label')).display`),'block');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
  assert.equal(await evaluate('hv.globalMapView.selected'),target.path);
  const viewport=await evaluate('hv.globalMapView.viewport');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x+50,y:target.y+30,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x+50,y:target.y+30,button:'left',clickCount:1});
  assert.notDeepEqual(await evaluate('hv.globalMapView.viewport'),viewport);assert.equal(await evaluate('hv.globalMapView.selected'),target.path);
  await shot('map-zoomed-500');
  await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:target.x,y:target.y,deltaY:200,deltaX:0});
  await wait('hv.globalMapView.viewport.zoom<24');
  await click('global-map-zoom-out');await click('global-map-fit');await click('global-map-reset-view');
  assert.deepEqual(await evaluate('hv.globalMapView.viewport'),{x:0,y:0,zoom:1});
  assert.equal(await evaluate('JSON.stringify(gp.getSnapshot().map)===mapBefore'),true);assert.equal(await evaluate('mapCalls'),0);
  const values=await evaluate(`(()=>{const n=gp.getSnapshot().map.nodes.find(n=>n.path===hv.globalMapView.selected),facts=[...hv.contentEl.querySelectorAll('.veynrel-global-map-facts dd')].map(e=>e.textContent);return {facts,scores:[n.coreSimilarity,n.semanticConnectedness].map(n=>n.toFixed(3)),neighbors:n.neighbors.map(n=>n.score.toFixed(3)),text:hv.contentEl.querySelector('.veynrel-global-map-inspector').textContent}})()`);
  assert.deepEqual(values.facts,values.scores);for(const score of values.neighbors)assert(values.text.includes(score));
  await click('global-map-open-note');await wait(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path===${JSON.stringify(target.path)})`);
  report.checks.push('500-node map: global overview, 24x controls, hover/click under transforms, pan without selection, wheel, fit/reset, real inspector scores/neighbors, open note, zero map recomputations');
  report.artifactSha256=crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  await fs.writeFile(root+'/native-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks,matrix:report.matrix.length,screenshots:report.screenshots,health:report.health}));
} finally {
  hold=false;
  await evaluate(`window.unsub?.();window.hv?.controller.cancelDeepScan();if(window.originalFiles)app.vault.getMarkdownFiles=originalFiles;if(window.originalMap&&window.plugin)plugin.semanticController.analyzeGlobalSemanticMap=originalMap;if(window.originalSingle&&window.plugin)plugin.runSingleAudit=originalSingle;`).catch(()=>{});
  socket.close();server.closeAllConnections();server.close();
}
