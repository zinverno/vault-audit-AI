// Bounded native release smoke. Prepare with global-semantic-map-prepare.mjs; see docs/release-2.0.1.md.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { stableHash } from '../utils/stableHash.ts';
const [endpoint, root] = process.argv.slice(2);
assert(['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname));
assert(root?.startsWith('/tmp/') && !root.includes('..'));
const pages = await (await fetch(endpoint + '/json/list')).json();
const socket = new WebSocket(pages.find(p => p.url.startsWith('app://obsidian.md/')).webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map(), errors = [];
socket.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
  const q = pending.get(m.id); if (!q) return;
  pending.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error) + ' ' + q.context)) : q.resolve(m.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; pending.set(next, { resolve, reject, context: method + ' ' + (params.expression ?? '').slice(0, 180) }); socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
};
const wait = async expression => {
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw Error('Timed out: ' + expression);
};
const click = key => evaluate(`hv.contentEl.querySelector('[data-health-action="${key}"]').click()`);
const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
const motion = value => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
const report = { checks: [], matrix: [], errors, assets: {} };
const check = (label, value) => { assert(value, label); report.checks.push(label); console.log('PASS ' + label); };
const shot = async name => {
  await new Promise(r => setTimeout(r, 350));
  const r = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(root + '/' + name + '.png', Buffer.from(r.data, 'base64'));
};
try {
  await send('Runtime.enable'); await send('Page.bringToFront');
  await wait("Boolean(window.app?.commands?.commands['ai-knowledge-hub:veynrel-open-health'])");
  assert.equal(await evaluate('app.vault.adapter.basePath'), root + '/vault');
  await evaluate("document.querySelector('.modal-close-button')?.click();app.setting.close();for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach();void 0");
  await evaluate("app.plugins.disablePlugin('ai-knowledge-hub')");
  const settingsPath = root + '/vault/.obsidian/plugins/ai-knowledge-hub/data.json';
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  Object.assign(settings, { provider: 'ollama', model: 'synthetic-release', baseUrl: 'http://127.0.0.1:9889/v1', semanticAutoSyncSuspended: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings));
  for (const name of ['main.js', 'manifest.json', 'styles.css']) {
    const bytes = await fs.readFile(name); await fs.writeFile(root + '/vault/.obsidian/plugins/ai-knowledge-hub/' + name, bytes);
    report.assets[name] = { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  }
  await evaluate("(async()=>{await app.plugins.loadManifests();await app.plugins.enablePlugin('ai-knowledge-hub');await new Promise(r=>app.workspace.onLayoutReady(r));})()");
  await wait("Boolean(app.commands.commands['ai-knowledge-hub:veynrel-open-health'])");
  await evaluate(`(async()=>{window.plugin=app.plugins.plugins['ai-knowledge-hub'];app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await plugin.semanticController.refreshSemanticStatus();app.commands.executeCommandById('ai-knowledge-hub:veynrel-open-health');})()`);
  await wait("Boolean(app.workspace.getLeavesOfType('veynrel-health')[0]?.view.body)");
  await evaluate("window.hv=app.workspace.getLeavesOfType('veynrel-health')[0].view;void 0");
  report.environment = await evaluate("({obsidian:navigator.userAgent.match(/obsidian\\/([^ ]+)/)?.[1],electron:process.versions.electron,platform:process.platform,version:plugin.manifest.version,notes:app.vault.getMarkdownFiles().length})");
  check('Plugin loads as 2.0.1 with 150 synthetic notes', report.environment.version === '2.0.1' && report.environment.notes === 150);
  await size(1280, 900);
  check('Health dashboard renders', await evaluate("Boolean(hv.contentEl.querySelector('.veynrel-vault-pulse'))"));
  await shot('health');
  await evaluate("hv.status.setText('Synthetic release status')");
  const status = await evaluate("(()=>{const e=hv.status,s=getComputedStyle(e);return {position:s.position,width:s.width,height:s.height,opacity:s.opacity,pointer:s.pointerEvents,display:s.display,visibility:s.visibility,live:e.getAttribute('aria-live')}})()");
  check('Status remains transparent, 1px, out of layout and pointer-inert', status.position === 'absolute' && status.width === '1px' && status.height === '1px' && status.opacity === '0' && status.pointer === 'none' && status.display !== 'none' && status.visibility !== 'hidden' && status.live === 'polite');
  const obj = await send('Runtime.evaluate', { expression: 'hv.status' });
  const ax = await send('Accessibility.getPartialAXTree', { objectId: obj.result.objectId });
  report.statusAX = ax.nodes.filter(n => n.role?.value === 'status').map(n => ({ ignored: n.ignored, role: n.role.value, properties: n.properties }));
  check('Native accessibility tree exposes the polite atomic status region', report.statusAX.some(n => !n.ignored && n.properties.some(p => p.name === 'live' && p.value.value === 'polite') && n.properties.some(p => p.name === 'atomic' && p.value.value === true)));
  // Controlled elements exercise every motion selector covered by the former workspace resets.
  await evaluate(`(()=>{window.probes=document.body.createDiv({cls:'veynrel-health-view'});const add=(parent,cls,tag='div')=>parent.createEl(tag,{cls});
    for(const state of ['unknown','good','review','attention','scanning']){const p=add(probes,'veynrel-vault-pulse');p.dataset.pulseState=state;add(p,'veynrel-vault-pulse-accent');}
    add(add(probes,'veynrel-health-home'),'veynrel-health-card');
    for(const cls of ['veynrel-health-page-enter','veynrel-topology-content','veynrel-topology-inspector-content'])add(probes,cls);
    for(const cls of ['veynrel-findings-navigation','veynrel-topology-detail','veynrel-neighborhood-list'])add(add(probes,cls),'','button');
    for(const cls of ['ai-hub-provider-card','ai-hub-model-chip','ai-hub-test-btn'])add(probes,cls,'button');})()`);
  for (const preference of ['no-preference', 'reduce']) {
    await motion(preference);
    const styles = await evaluate("[...probes.querySelectorAll('.veynrel-vault-pulse-accent,.veynrel-health-card,.veynrel-health-page-enter,.veynrel-topology-content,.veynrel-topology-inspector-content,button')].map(e=>{const s=getComputedStyle(e);return {selector:e.className||e.parentElement.className,animation:s.animationName,duration:s.animationDuration,transition:s.transitionDuration}})");
    report.matrix.push({ preference, styles });
    if (preference === 'reduce') check('All 15 concrete workspace/settings motion probes are disabled, including all Pulse states', styles.length === 15 && styles.every(s => s.animation === 'none' && s.transition.split(',').every(d => parseFloat(d) === 0)));
    else check('Default Pulse cadence, page entry and card transitions remain active', styles[1].duration === '7s' && styles[4].duration === '4s' && styles.some(s => s.animation === 'veynrel-page-enter') && styles.some(s => parseFloat(s.transition) > 0));
  }
  await evaluate('probes.remove()'); await motion('no-preference');
  await click('nav-findings'); check('Findings navigation renders', await evaluate("hv.route.page==='findings' && !!hv.contentEl.querySelector('nav')"));
  await click('nav-discover'); await click('global-map-open'); await evaluate('hv.globalMap.load()');
  await wait("hv.globalMap.getSnapshot().state==='ready'");
  await evaluate("window.mapBefore=JSON.stringify(hv.globalMap.getSnapshot().map);window.mapCalls=0;window.originalMap=plugin.semanticController.analyzeGlobalSemanticMap;plugin.semanticController.analyzeGlobalSemanticMap=function(...a){mapCalls++;return originalMap.apply(this,a)}");
  check('Discover loads the existing 150-node Global Semantic Map', await evaluate("hv.contentEl.querySelectorAll('[data-global-map-node]').length===150"));
  await click('global-map-zoom-in'); await click('global-map-zoom-out');
  for (let i=0;i<8;i++) await click('global-map-zoom-in');
  check('Visible zoom controls reach 24x', await evaluate('hv.globalMapView.viewport.zoom===24'));
  await click('global-map-reset-view');
  await evaluate("hv.contentEl.querySelector('.veynrel-global-map-svg').scrollIntoView({block:'center'})");
  const point = await evaluate("(()=>{const r=hv.contentEl.querySelector('.veynrel-global-map-svg').getBoundingClientRect();return {x:r.x+r.width/2,y:Math.max(10,r.y)+100}})()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+40,y:point.y+20,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+40,y:point.y+20,button:'left',clickCount:1});
  check('Native drag pans the map', await evaluate('hv.globalMapView.viewport.x!==0 && hv.globalMapView.viewport.y!==0'));
  await send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:-200,deltaX:0});
  await wait('hv.globalMapView.viewport.zoom>1');
  check('Native wheel zoom works', true); await click('global-map-fit');
  check('Fit updates the viewport', await evaluate('JSON.stringify(hv.globalMapView.viewport)!==JSON.stringify({x:0,y:0,zoom:1})'));
  await click('global-map-reset-view');
  check('Reset is exact; map scores/snapshot unchanged; no map recomputation', await evaluate('JSON.stringify(hv.globalMapView.viewport)===JSON.stringify({x:0,y:0,zoom:1}) && JSON.stringify(hv.globalMap.getSnapshot().map)===mapBefore && mapCalls===0'));
  await shot('map'); await evaluate('plugin.semanticController.analyzeGlobalSemanticMap=originalMap');
  await click('global-map-back'); await click('connections-open'); await evaluate('hv.comparison.load()');
  await wait("hv.comparison.getSnapshot().state==='ready'");
  for (const width of [1280, 320]) {
    await size(width, 700);
    const layout = await evaluate("(()=>{const root=hv.contentEl,e=root.querySelector('.veynrel-connections-count'),s=getComputedStyle(e);return {width,container:root.querySelector('.veynrel-connections').clientWidth,columns:s.gridTemplateColumns,row:s.rowGap,column:s.columnGap,overflow:root.scrollWidth-root.clientWidth}})()".replace('{width,','{width:'+width+','));
    assert(layout.overflow<=1,JSON.stringify(layout));
    if(width===320) assert(layout.container<=300 && layout.column==='12px' && layout.row==='4px' && layout.columns.split(' ').length===2,JSON.stringify(layout));
    else assert(layout.column==='4px',JSON.stringify(layout));
    report.matrix.push({connections:layout}); await shot('connections-'+width);
  }
  check('Connections retain normal spacing and the <=300px two-column layout', true);
  for(const language of ['en','ru']) {
    await evaluate(`(async()=>{const tab=app.setting.pluginTabs.find(t=>t.id==='ai-knowledge-hub');tab.display();const select=[...tab.containerEl.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.value==='ru'));select.value=${JSON.stringify(language)};select.dispatchEvent(new Event('change'));await plugin.settingsSave;})()`);
    await click('nav-health');
    check(language+' Health localization loads',await evaluate("!/@health\\./.test(hv.contentEl.innerText) && !!hv.contentEl.querySelector('.veynrel-vault-pulse')"));
    for (const width of [1280,390]) {
      await size(width,700); await evaluate('plugin.openAuditModeModal()'); await wait("document.querySelectorAll('.ai-hub-audit-mode').length===3");
      const audit=await evaluate("(()=>{const e=document.querySelector('.ai-hub-audit-modal .modal-content');return {overflow:e.scrollWidth-e.clientWidth,text:e.innerText,counts:[...e.querySelectorAll('.ai-hub-card-badge')].map(b=>Number(b.textContent.match(/\\d+/)[0]))}})()");
      assert(audit.overflow<=1 && !/@audit\./.test(audit.text),JSON.stringify(audit)); assert.deepEqual(audit.counts,[150,150,150]);
      report.matrix.push({language,width,audit}); await shot('audit-'+language+'-'+width);await evaluate("document.querySelector('.modal-close-button').click()");
    }
    await size(1280,900); await click('nav-settings');
    await evaluate("app.setting.open();app.setting.openTabById('ai-knowledge-hub');void 0");
    check(language+' native Settings loads', await evaluate("document.querySelectorAll('.ai-hub-provider-card').length>0"));
    await evaluate('app.setting.close()');
  }
  check('EN/RU audit cards render at normal/narrow widths with actual counts',true);
  await motion('reduce'); await click('nav-health');
  check('Actual Health remains rendered with reduced motion', await evaluate("!!hv.contentEl.querySelector('.veynrel-vault-pulse') && [...hv.contentEl.querySelectorAll('.veynrel-vault-pulse-accent,.veynrel-health-page-enter')].every(e=>getComputedStyle(e).animationName==='none')"));
  await click('nav-discover'); await click('global-map-open'); await click('global-map-zoom-in'); await click('global-map-reset-view');
  check('Map remains interactive with reduced motion', await evaluate("hv.contentEl.querySelectorAll('[data-global-map-node]').length===150 && hv.globalMapView.viewport.zoom===1"));
  await motion('no-preference');
  // Mock only the Companion application boundary; actual installed modal and diff renderer are used.
  const base=Array.from({length:150},(_,i)=>'Original line '+i).join('\n'),next=base+'\nProposed final line';
  const proposal={proposalId:'11111111-1111-4111-8111-111111111111',operation:'UPDATE_NOTE',path:'Synthetic.md',summary:'Synthetic long proposal for release layout verification',status:'PENDING',createdAt:1,updatedAt:1,claimedAt:null,claimExpiresAt:null,appliedAt:null,statusCode:null,baseContent:base,baseContentHash:stableHash(base),proposedContent:next,proposedContentHash:stableHash(next)};
  await evaluate(`window.originalCompanion=plugin.settings.companion;window.originalApplication=plugin.proposalApplication;plugin.settings.companion={...originalCompanion,enabled:true};window.proposal=${JSON.stringify(proposal)};(()=>{const s=plugin.settings.companion;plugin.proposalApplication={signature:JSON.stringify([s.enabled,s.endpoint,s.token,s.timeoutMs,s.vaultId]),value:{vaultId:'synthetic',vault:{configDir:'.obsidian',read:async()=>proposal.baseContent},api:{listProposals:async()=>({proposals:[proposal],nextCursor:null}),getProposal:async()=>proposal}}};})()`);
  for(const [width,height] of [[1280,900],[1280,400],[390,700],[390,400]]) {
    await size(width,height); await evaluate('plugin.openProposalReview()');await wait("Boolean(document.querySelector('.ai-proposal-card-actions button'))");
    await evaluate("document.querySelector('.ai-proposal-card-actions button').click()"); await wait("Boolean(document.querySelector('.ai-proposal-diff'))");
    const bounds=await evaluate("(()=>{const e=document.querySelector('.ai-proposal-shell'),r=e.getBoundingClientRect(),f=e.querySelector('.ai-proposal-footer').getBoundingClientRect(),d=e.querySelector('.ai-proposal-diff'),b=e.querySelector('.ai-proposal-body');b.scrollTop=b.scrollHeight;d.scrollTop=d.scrollHeight;const dr=d.getBoundingClientRect(),br=b.getBoundingClientRect();return {maxHeight:getComputedStyle(e).maxHeight,height:r.height,top:r.top,bottom:r.bottom,footer:f.bottom,overflow:e.scrollWidth-e.clientWidth,scrollTop:d.scrollTop,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,diffVisible:Math.min(dr.bottom,br.bottom)-Math.max(dr.top,br.top)>30}})()");
    assert.equal(bounds.maxHeight,(height-(width<=520?16:32))+'px');assert(bounds.top>=0 && bounds.bottom<=height+1 && bounds.footer<=height+1 && bounds.overflow<=1 && bounds.scrollTop>0,JSON.stringify(bounds));
    assert(bounds.diffVisible,JSON.stringify(bounds));
    report.matrix.push({proposal:{width,viewportHeight:height,...bounds}}); await shot('proposal-'+width+'-'+height);await evaluate("document.querySelector('.modal-close-button').click()");
  }
  check('Proposal footer and diff remain reachable at normal/short and narrow heights',true);
  await evaluate('plugin.settings.companion=originalCompanion;plugin.proposalApplication=originalApplication;void 0');
  check('No captured startup/reload/runtime exceptions or console errors', errors.length===0);
  await fs.writeFile(root+'/native-report.json',JSON.stringify(report,null,2)+'\n');
} finally { socket.close(); }
