// Synthetic, credential-free native Obsidian smoke.
// node scripts/semantic-chunk-bounds-native.mjs prepare /tmp/semantic-chunk-bounds-smoke
// Start isolated Obsidian on CDP port 9255, then:
// node scripts/semantic-chunk-bounds-native.mjs run /tmp/semantic-chunk-bounds-smoke
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
const [mode, root] = process.argv.slice(2);
assert(['prepare', 'run'].includes(mode));
assert(root?.startsWith('/tmp/') && !root.includes('..'));
const vault = root + '/vault', pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
const settings = { language: 'en', apiKey: '', semantic: { enabled: true, embeddingProvider: 'openai-compatible',
  embeddingBaseUrl: 'http://127.0.0.1:19356/v1', embeddingModel: 'synthetic-chunk-bounds', openRouterApiKey: '', openAICompatibleApiKey: '' },
  companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } };
if (mode === 'prepare') {
  await fs.mkdir(pluginDir, { recursive: true }); await fs.mkdir(root + '/profile', { recursive: true });
  await fs.mkdir(root + '/screenshots', { recursive: true });
  const rows = Array.from({ length: 1400 }, (_, i) => `row_${i} ${'value '.repeat(8)}`);
  const notes = {
    'Normal A': '# Normal A\n\nA short synthetic note.', 'Normal B': '# Normal B\n\nAnother synthetic note.',
    SQL: '# SQL\n```sql\n' + rows.map(row => `SELECT '${row}';`).join('\n') + '\n```',
    Table: '# Table\n| Key | Value |\n| --- | --- |\n' + rows.map(row => `| key | ${row} |`).join('\n'),
    List: '# List\n' + rows.map((row, i) => `${i % 2 ? '  ' : ''}- ${row}`).join('\n'),
    Line: '# Line\n```txt\n' + '😀é🧪'.repeat(10000) + '\n```',
  };
  for (const [name, text] of Object.entries(notes)) await fs.writeFile(`${vault}/${name}.md`, text);
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify(settings));
  await fs.writeFile(vault + '/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
  await fs.writeFile(vault + '/.obsidian/app.json', '{"checkForUpdates":false}');
  await fs.writeFile(root + '/profile/obsidian.json', JSON.stringify({ vaults: { reliability: { path: vault, ts: Date.now(), open: true } } }));
  for (const file of ['manifest.json', 'main.js', 'styles.css']) await fs.copyFile(file, pluginDir + '/' + file);
  console.log(root); process.exit(0);
}
const report = { scenarios: [], passive: [], screenshots: [], limitations: [
  'Synthetic local HTTP provider only; no user vault or credits. Linux desktop only; mobile, popout, screen reader, custom themes and live providers untested.'
] };
let scenario = 'success', calls = [], releaseFirst;
const server = http.createServer(async (req, res) => {
  // Decode UTF-8 across TCP chunks without replacing split emoji byte sequences.
  req.setEncoding('utf8');
  let raw = ''; for await (const chunk of req) raw += chunk;
  const { input } = JSON.parse(raw); assert(Array.isArray(input)); assert(!req.headers.authorization);
  const probe = input[0] === 'Vault Audit AI embedding test';
  const batch = probe ? 0 : calls.filter(c => !c.probe).length + 1;
  const shape = { probe, batch, inputCount: input.length, largestInputChars: Math.max(...input.map(s => s.length)),
    totalInputChars: input.reduce((n, s) => n + s.length, 0), oversizedInputCount: input.filter(s => s.length > 1800).length };
  calls.push(shape); assert.equal(shape.oversizedInputCount, 0, JSON.stringify(shape)); assert(shape.inputCount <= 32);
  if (batch === 1) await new Promise(resolve => { releaseFirst = resolve; });
  await new Promise(resolve => setTimeout(resolve, 70));
  const status = scenario === 'request' && batch === 2 ? 400 : 200;
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(status !== 200 ? 'synthetic-private-response' : JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [1, 0.2, 0.1] })) }));
});
await new Promise(resolve => server.listen(19356, '127.0.0.1', resolve));
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
  calls = [];
  await evaluate(`(async()=>{
    await app.plugins.enablePlugin('ai-knowledge-hub');
    for(let i=0;i<200&&!app.commands.commands['ai-knowledge-hub:veynrel-open-health'];i++)await new Promise(r=>setTimeout(r,25));
    await new Promise(r=>app.workspace.onLayoutReady(r));
    window.plugin=app.plugins.plugins['ai-knowledge-hub'];window.engine=plugin.semanticController;
    window.io={read:0,build:0,commit:0}; const restores=[];
    for(const [obj,key,counter] of [[app.vault,'cachedRead','read'],[app.vault,'read','read'],[engine,'indexVault','build']]) {
      const original=obj[key];obj[key]=function(...args){io[counter]++;return original.apply(this,args)};restores.push(()=>obj[key]=original);
    }
    window.progress=[];
    const unsubscribe=engine.subscribeStatus(()=>{const s=engine.getSemanticStatus();if(s.progress)progress.push({...s.progress});});restores.push(unsubscribe);
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
const build = async (name, language = 'en', fresh = true) => {
  scenario = name; if (fresh) await setup(language); else { calls = []; await evaluate('progress=[];'); }
  await evaluate(`window.done=false;engine.indexVault().then(()=>window.done=true);void 0;`);
  await waitFor("Boolean(document.querySelector('.modal-container button:is(.mod-cta, .mod-warning)'))");
  const confirmation = await evaluate("document.querySelector('.modal-container').innerText");
  assert(confirmation.includes('6')); assert.equal(calls.length, 0);
  await evaluate("document.querySelector('.modal-container button:is(.mod-cta, .mod-warning)').click()");
  await waitFor("engine.getSemanticStatus().progress?.phase==='embedding' && !!hv.contentEl.querySelector('progress')");
  const initial = await evaluate(`({status:engine.getSemanticStatus(),value:hv.contentEl.querySelector('progress').value,max:hv.contentEl.querySelector('progress').max,label:hv.contentEl.querySelector('progress').getAttribute('aria-label')})`);
  const total = initial.status.progress.chunksTotal, batchTotal = Math.ceil(total / 32);
  assert(total > 128); assert.equal(initial.max, total); assert.equal(initial.value, 0); assert(initial.label.includes(String(total)));
  assert.equal(initial.status.progress.documentsTotal, 6); assert.equal(initial.status.rejectedBatch, undefined);
  await evaluate(`{const store=engine.runtimeSlot.runtime.components.vectorStore;if(!store.nativeCounted){store.nativeCounted=true;const apply=store.applyChanges;store.applyChanges=function(...args){io.commit++;return apply.apply(this,args)}}}`);
  await screenshot('building-' + language);
  assert(releaseFirst); releaseFirst(); releaseFirst = undefined;
  await waitFor('window.done', 20000); await new Promise(resolve => setTimeout(resolve, 50));
  const result = await evaluate(`({status:engine.getSemanticStatus(),io:{...io},progress:[...progress],text:hv.contentEl.querySelector('.veynrel-discover').innerText,notices:[...document.querySelectorAll('.notice')].map(n=>n.innerText),bar:!!hv.contentEl.querySelector('progress')})`);
  assert.equal(result.bar, false); assert.equal(result.status.progress, undefined);
  assert(!result.text.includes('synthetic-private-response')); assert(!result.notices.join(' ').includes('synthetic-private-response'));
  const batches = calls.filter(call => !call.probe);
  if (name === 'request') {
    assert.equal(result.status.failure, 'provider-request'); assert.equal(result.status.kind, 'error'); assert.equal(result.io.commit, 0);
    assert.equal(batches.length, 2); // HTTP 400 is not retried.
    const { probe, batch, ...shape } = batches[1];
    assert.equal(probe, false);
    assert.deepEqual(result.status.rejectedBatch, { batchCurrent: batch, batchTotal, ...shape });
    for (const n of [batchTotal, shape.inputCount, shape.largestInputChars, shape.totalInputChars]) assert(result.text.includes(String(n)));
    assert(result.text.includes(language === 'en' ? 'input-specific provider rejection' : 'конкретными входными данными'));
    assert.equal(await evaluate('engine.runtimeSlot.runtime.components.vectorStore.getStats().count'), 0);
    await screenshot('rejected-' + language);
  } else {
    assert.equal(result.status.kind, 'ready'); assert.equal(result.status.vectorCount, total); assert.equal(result.status.failure, undefined);
    assert.equal(result.status.rejectedBatch, undefined); assert.equal(result.io.commit, 1); assert.equal(batches.length, batchTotal);
    assert.equal(batches.reduce((n, b) => n + b.inputCount, 0), total);
    assert(result.progress.some(p => p.phase === 'committing'));
  }
  let completed = 0;
  for (const p of result.progress) if (p.chunksCompleted !== undefined) {
    assert(p.chunksCompleted >= completed); assert(p.chunksCompleted <= total); assert.equal(p.chunksTotal, total);
    if (p.batchTotal !== undefined) assert.equal(p.batchTotal, batchTotal);
    completed = p.chunksCompleted;
  }
  report.scenarios.push({ name, language, chunksTotal: total, batchTotal, calls: [...calls], ...result });
};
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.body.classList.remove('theme-light');document.body.classList.add('theme-dark')");
  report.runtime = await evaluate('({obsidian:document.title,electron:process.versions.electron})');
  report.artifactSha256 = crypto.createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
  await build('success'); await build('request');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1200, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.body.classList.remove('theme-dark');document.body.classList.add('theme-light')");
  await build('request', 'ru'); await build('success', 'ru', false);
  await fs.writeFile(root + '/native.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ scenarios: report.scenarios.length, passive: report.passive.length, artifactSha256: report.artifactSha256 }));
} finally { releaseFirst?.(); await evaluate('window.restoreReliability?.()').catch(() => {}); socket.close(); server.closeAllConnections(); server.close(); }
