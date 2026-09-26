// Synthetic, credential-free native Obsidian smoke.
// node scripts/semantic-index-reliability-native.mjs prepare /tmp/semantic-index-reliability-smoke
// Start isolated Obsidian on CDP port 9255, then:
// node scripts/semantic-index-reliability-native.mjs run /tmp/semantic-index-reliability-smoke
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
const [mode, root] = process.argv.slice(2);
assert(['prepare', 'run'].includes(mode));
assert(root?.startsWith('/tmp/') && !root.includes('..'));
const vault = root + '/vault', pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
const settings = { language: 'en', apiKey: '', semantic: { enabled: true, embeddingProvider: 'openai-compatible',
  embeddingBaseUrl: 'http://127.0.0.1:19355/v1', embeddingModel: 'synthetic-reliability', openRouterApiKey: '', openAICompatibleApiKey: '' },
  companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } };
if (mode === 'prepare') {
  await fs.mkdir(pluginDir, { recursive: true }); await fs.mkdir(root + '/profile', { recursive: true });
  await fs.mkdir(root + '/screenshots', { recursive: true });
  for (let i = 0; i < 159; i++) await fs.writeFile(`${vault}/Synthetic ${String(i).padStart(3, '0')}.md`, `# Synthetic ${i}\n\nSynthetic reliability fixture number ${i}.\n`);
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify(settings));
  await fs.writeFile(vault + '/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
  await fs.writeFile(vault + '/.obsidian/app.json', '{"checkForUpdates":false}');
  await fs.writeFile(root + '/profile/obsidian.json', JSON.stringify({ vaults: { reliability: { path: vault, ts: Date.now(), open: true } } }));
  for (const file of ['manifest.json', 'main.js', 'styles.css']) await fs.copyFile(file, pluginDir + '/' + file);
  console.log(root); process.exit(0);
}
const report = { scenarios: [], passive: [], screenshots: [], limitations: [
  'Linux native desktop only; no mobile OS, popout, screen reader, custom theme, or live provider.',
  'Native timeout scenario accelerates the 90000 ms timer to 350 ms; unit tests verify exact timeout deadlines.',
  'Native retry timers are accelerated from 1000/3000 ms to 180/300 ms; unit tests verify exact backoff.'
] };
let scenario = 'success', calls = [], attempts = new Map();
const server = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const { input } = JSON.parse(raw); assert(Array.isArray(input)); assert(!req.headers.authorization);
  const probe = input[0] === 'Vault Audit AI embedding test';
  const key = JSON.stringify(input), attempt = (attempts.get(key) ?? 0) + 1; attempts.set(key, attempt);
  const batch = probe ? 0 : [...attempts.keys()].filter(k => !k.includes('Vault Audit AI embedding test')).indexOf(key) + 1;
  calls.push({ probe, batch, attempt, count: input.length });
  let status = 200, invalid = false, delay = probe ? 20 : 200;
  if (!probe && batch === 2) {
    if (scenario === 'rate-limit' && attempt === 1) status = 429;
    if (scenario === 'server') status = attempt === 2 ? 503 : 500;
    if (scenario === 'auth') status = 401;
    if (scenario === 'invalid') invalid = true;
    if (scenario === 'timeout') delay = 1200;
  }
  await new Promise(resolve => setTimeout(resolve, delay));
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(status !== 200 || invalid ? 'synthetic-private-response' : JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [1, 0.2, 0.1] })) }));
});
await new Promise(resolve => server.listen(19355, '127.0.0.1', resolve));
const pages = await (await fetch('http://127.0.0.1:9255/json/list')).json();
const page = pages.find(p => p.url.startsWith('app://obsidian.md/')); assert(page);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map();
socket.onmessage = event => { const message = JSON.parse(event.data), item = pending.get(message.id); if (!item) return;
  pending.delete(message.id); message.error ? item.reject(message.error) : item.resolve(message.result); };
const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
const waitFor = async (expression, timeout = 10000) => { const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
  throw Error('Native wait failed: ' + expression); };
const screenshot = async name => {
  // Keep transient Notices from covering inline UI in evidence; their text is checked separately.
  await evaluate("document.querySelectorAll('.notice-container').forEach(n=>n.style.visibility='hidden')");
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`${root}/screenshots/${name}.png`, Buffer.from(data, 'base64')); report.screenshots.push(name + '.png');
  await evaluate("document.querySelectorAll('.notice-container').forEach(n=>n.style.visibility='')"); };
const setup = async (language = 'en') => {
  await evaluate(`(async()=>{window.restoreReliability?.(); for(const leaf of app.workspace.getLeavesOfType('veynrel-health'))leaf.detach(); await app.plugins.disablePlugin('ai-knowledge-hub');})()`);
  await fs.rm(pluginDir + '/semantic-index', { recursive: true, force: true });
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify({ ...settings, language }));
  for (const file of ['main.js', 'styles.css']) await fs.copyFile(file, pluginDir + '/' + file);
  calls = []; attempts = new Map();
  await evaluate(`(async()=>{
    await app.plugins.enablePlugin('ai-knowledge-hub');
    for(let i=0;i<200&&!app.commands.commands['ai-knowledge-hub:veynrel-open-health'];i++)await new Promise(r=>setTimeout(r,25));
    await new Promise(r=>app.workspace.onLayoutReady(r));
    window.plugin=app.plugins.plugins['ai-knowledge-hub'];window.engine=plugin.semanticController;
    window.io={read:0,build:0,commit:0}; const restores=[];
    for(const [obj,key,counter] of [[app.vault,'cachedRead','read'],[app.vault,'read','read'],[engine,'indexVault','build']]) {
      const original=obj[key];obj[key]=function(...args){io[counter]++;return original.apply(this,args)};restores.push(()=>obj[key]=original);
    }
    window.progress=[];window.timeouts=[];
    const unsubscribe=engine.subscribeStatus(()=>{const s=engine.getSemanticStatus();if(s.progress)progress.push({...s.progress});});restores.push(unsubscribe);
    const timer=window.setTimeout;window.setTimeout=function(fn,ms,...args){
      if(ms===90000||ms===30000||ms===1000||ms===3000)timeouts.push(ms);
      return timer.call(this,fn,ms===90000&&window.timeoutScenario?350:ms===1000?180:ms===3000?300:ms,...args);
    };restores.push(()=>window.setTimeout=timer);
    window.restoreReliability=()=>restores.reverse().forEach(f=>f());
    app.commands.executeCommandById('ai-knowledge-hub:veynrel-open-health');
    for(let i=0;i<200&&!app.workspace.getLeavesOfType('veynrel-health')[0]?.view.body;i++)await new Promise(r=>setTimeout(r,25));
    window.hv=app.workspace.getLeavesOfType('veynrel-health')[0].view;await hv.controller.getHealthService();
    app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();
    hv.contentEl.querySelector('[data-health-action="nav-discover"]').click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 200));
  const passive = await evaluate('({...io})'); assert.deepEqual(passive, { read: 0, build: 0, commit: 0 }); assert.equal(calls.length, 0);
  report.passive.push({ language, ...passive, provider: calls.length });
};
const build = async (name, language = 'en', fresh = true, method = 'indexVault') => {
  scenario = name; if (fresh) await setup(language); else { attempts = new Map(); calls = []; }
  await evaluate(`window.timeoutScenario=${name === 'timeout'};window.done=false;window.pendingBuild=engine.${method}().then(()=>window.done=true);void 0;`);
  await waitFor("Boolean(document.querySelector('.modal-container button:is(.mod-cta, .mod-warning)'))");
  const confirmation = await evaluate("document.querySelector('.modal-container').innerText");
  assert(confirmation.includes('159')); assert.equal(calls.length, 0);
  await evaluate("document.querySelector('.modal-container button:is(.mod-cta, .mod-warning)').click()");
  await waitFor("engine.getSemanticStatus().progress?.phase==='embedding'");
  // Instrument the actual store commit after lazy initialization, before any batch completes.
  await evaluate(`{const store=engine.runtimeSlot.runtime.components.vectorStore;if(!store.nativeCounted){store.nativeCounted=true;const apply=store.applyChanges;store.applyChanges=function(...args){io.commit++;return apply.apply(this,args)}}}`);
  if (name === 'success') {
    await waitFor("Boolean(hv.contentEl.querySelector('progress')?.max===159)");
    const ui = await evaluate(`({text:hv.contentEl.querySelector('.veynrel-discover').innerText,label:hv.contentEl.querySelector('progress').getAttribute('aria-label')})`);
    assert(ui.text.includes('159')); assert(ui.label); await screenshot('success-' + language);
  }
  if (name === 'rate-limit') {
    await waitFor("engine.getSemanticStatus().progress?.phase==='retrying'");
    const text = await evaluate("hv.contentEl.querySelector('.veynrel-discover').innerText");
    assert(text.includes(language === 'en' ? 'Attempt 2 of 3' : 'Попытка 2 из 3')); await screenshot('retry-' + language);
  }
  await waitFor('window.done'); await new Promise(resolve => setTimeout(resolve, 50));
  const result = await evaluate(`({status:engine.getSemanticStatus(),io:{...io},progress:[...progress],timeouts:[...timeouts],text:hv.contentEl.querySelector('.veynrel-discover').innerText,notices:[...document.querySelectorAll('.notice')].map(n=>n.innerText),bar:!!hv.contentEl.querySelector('progress')})`);
  assert.equal(result.bar, false); assert.equal(result.status.progress, undefined); assert(!result.text.includes('synthetic-private-response')); assert(!result.notices.join(' ').includes('synthetic-private-response'));
  const batches = calls.filter(call => !call.probe);
  const failure = { server: 'provider-server', timeout: 'provider-timeout', auth: 'provider-auth', invalid: 'provider-response' }[name];
  if (failure) {
    assert.equal(result.status.failure, failure); assert.equal(result.status.kind, 'error'); assert.equal(result.io.commit, 0);
    assert.equal(await evaluate('engine.runtimeSlot.runtime.components.vectorStore.getStats().count'), 0);
    assert.equal(batches.length, name === 'server' ? 4 : 2);
    for (const file of ['vector-manifest.json', 'vector-index.bin']) assert.equal(await fs.stat(pluginDir + '/semantic-index/' + file).then(() => true, () => false), false, file);
    await screenshot(name + '-' + language);
  } else {
    assert.equal(result.status.kind, 'ready'); assert.equal(result.status.vectorCount, 159); assert.equal(result.status.failure, undefined);
    assert.equal(result.io.commit, 1); assert.equal(batches.length, name === 'rate-limit' ? 6 : 5);
  }
  assert(result.timeouts.includes(90000));
  assert(result.progress.some(p => p.phase === 'reading')); assert(result.progress.some(p => p.documentsTotal === 159));
  let completed = 0;
  for (const p of result.progress) { if (p.chunksCompleted !== undefined) { assert(p.chunksCompleted >= completed); assert(p.chunksCompleted <= p.chunksTotal); completed = p.chunksCompleted; } }
  if (name === 'timeout') { await new Promise(resolve => setTimeout(resolve, 1300)); assert.equal(calls.filter(c => !c.probe).length, 2); }
  report.scenarios.push({ name, method, language, calls: [...calls], ...result });
};
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.body.classList.remove('theme-light');document.body.classList.add('theme-dark')");
  report.runtime = await evaluate('({obsidian:document.title,electron:process.versions.electron})');
  report.artifactSha256 = crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  for (const name of ['success', 'rate-limit', 'server', 'timeout', 'auth', 'invalid']) await build(name);
  await evaluate('window.progress=[];window.timeouts=[];');
  await build('success', 'en', false); // Same runtime recovers after invalid response.
  await evaluate('window.progress=[];window.timeouts=[];io.commit=0;');
  await build('server', 'en', false, 'rebuildIndex');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1200, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.body.classList.remove('theme-dark');document.body.classList.add('theme-light')");
  await build('rate-limit', 'ru');
  await build('auth', 'ru');
  await fs.writeFile(root + '/native.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ scenarios: report.scenarios.length, passive: report.passive.length, artifactSha256: report.artifactSha256 }));
} finally { await evaluate('window.restoreReliability?.()').catch(() => {}); socket.close(); server.closeAllConnections(); server.close(); }
