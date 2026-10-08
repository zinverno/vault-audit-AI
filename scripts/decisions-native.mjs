// Disposable native Obsidian + fake Decisions HTTP. No real credentials or paid calls.
// prepare /tmp/veynrel-decisions-native; launch profile with CDP 9262; then run <same root>.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
const [mode, root] = process.argv.slice(2);
assert(['prepare', 'run'].includes(mode)); assert(root?.startsWith('/tmp/') && !root.includes('..'));
const vault = root + '/vault', pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
if (mode === 'prepare') {
  await fs.mkdir(pluginDir, { recursive: true }); await fs.mkdir(root + '/profile', { recursive: true });
  const body = 'Bicycles have two wheels. Велосипед имеет два колеса. 😀 '.repeat(28);
  await fs.writeFile(`${vault}/Alpha.md`, body); // Entirely headerless.
  await fs.writeFile(`${vault}/Beta.md`, body + '\n\n# Authored section\n\nLater body.'); // Introduction before heading.
  await fs.writeFile(`${vault}/Gamma.md`, '# Authored context\n\n' + body);
  await fs.writeFile(pluginDir + '/data.json', JSON.stringify({ language: 'en', apiKey: '',
    semantic: { enabled: true, embeddingProvider: 'openai-compatible', embeddingModel: 'synthetic-decisions-smoke',
      embeddingBaseUrl: 'http://127.0.0.1:19362/v1', openRouterApiKey: '', openAICompatibleApiKey: '' },
    companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } }));
  await fs.writeFile(vault + '/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
  await fs.writeFile(vault + '/.obsidian/app.json', '{"checkForUpdates":false}');
  await fs.writeFile(root + '/profile/obsidian.json', JSON.stringify({ vaults: { decisions: { path: vault, ts: Date.now(), open: true } } }));
  for (const name of ['main.js', 'manifest.json', 'styles.css']) await fs.copyFile(name, pluginDir + '/' + name);
  console.log(root); process.exit(0);
}
let embeddings = 0;
const server = http.createServer(async (req, res) => {
  req.setEncoding('utf8'); let body = ''; for await (const chunk of req) body += chunk;
  const { input } = JSON.parse(body); assert(Array.isArray(input)); assert(!req.headers.authorization); embeddings++;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [1, 0.2, 0.1] })) }));
});
await new Promise(resolve => server.listen(19362, '127.0.0.1', resolve));
const pages = await (await fetch('http://127.0.0.1:9262/json/list')).json();
const page = pages.find(p => p.url.startsWith('app://obsidian.md/')); assert(page);
const socket = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map();
socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry.reject(message.error) : entry.resolve(message.result); } };
const cdp = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
const waitFor = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 50)); } throw Error('Native wait timed out: ' + expression); };
const checks = []; const check = (name, value) => { assert(value, name); checks.push(name); };
const screenshot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(root + '/' + name + '.png', Buffer.from(data, 'base64')); };
const stage = state => waitFor(`document.querySelector('.ai-overlap-modal [role=status]')?.dataset.state==='${state}'`);
const closeOverlap = async () => {
  await evaluate("document.querySelector('.ai-overlap-modal').closest('.modal').querySelector('.modal-close-button,.modal-header-button').click();void 0");
  await waitFor("!document.querySelector('.ai-overlap-modal')");
};
try {
  await waitFor("!!app.plugins.plugins['ai-knowledge-hub']?.semanticController");
  check('isolated synthetic vault selected', await evaluate(`app.vault.adapter.basePath===${JSON.stringify(vault)}`));
  await evaluate(`(async()=>{await new Promise(r=>app.workspace.onLayoutReady(r));window.plugin=app.plugins.plugins['ai-knowledge-hub'];window.engine=plugin.semanticController;
    window.decisionCalls=[];window.mode='success';window.pendingDecisions=[];
    const factory=engine.decisionsProvider;engine.decisionsProvider=settings=>{const provider=factory(settings);provider.transport=async request=>{
      if(request.url!=='https://openrouter.ai/api/alpha/decisions')throw Error('unexpected endpoint');
      const body=JSON.parse(request.body);decisionCalls.push(body);
      if(mode==='slow')await new Promise(resolve=>pendingDecisions.push(resolve));
      if(mode==='failure')return {status:402,text:'synthetic private error'};
      return {status:200,text:JSON.stringify({model:'typesafe/jev-1.13-20260917',answers:{overlap:{type:'choice',choice:'same_information',confidence:1,
        probabilities:{same_information:1,partial_overlap:0,related_distinct:0,unrelated:0,insufficient_context:0}}}})};};return provider;};
  })()`);
  check('legacy settings default off with independent empty key', await evaluate("!plugin.settings.decisions.enabled && plugin.settings.decisions.apiKey==='' && !plugin.settings.rerank.enabled"));
  await evaluate("app.setting.open();app.setting.openTabById('ai-knowledge-hub');void 0");
  await waitFor("app.setting.modalEl.innerText.includes('Overlap assessment / Decisions')");
  check('settings and workspace do zero Decisions calls', embeddings === 0 && await evaluate('decisionCalls.length===0'));
  check('masked dedicated key and disclosure', await evaluate("[...app.setting.modalEl.querySelectorAll('.setting-item')].find(el=>el.innerText.includes('Separate OpenRouter API key for Decisions'))?.querySelector('input')?.type==='password' && app.setting.modalEl.innerText.includes('Requests are billed to your account')"));
  await evaluate("app.setting.close();engine.confirm=async()=>true;engine.indexVault()");
  await waitFor("engine.getSemanticStatus().kind==='ready'");
  await evaluate('engine.openPotentialDuplicates()');
  await waitFor("!!document.querySelector('.ai-semantic-duplicate-card button')");
  await evaluate("window.selectedPair=()=>[...document.querySelectorAll('.ai-semantic-duplicate-card')].find(el=>el.innerText.includes('Alpha.md')&&el.innerText.includes('Beta.md')).querySelector('button');void 0");
  check('index and duplicate list do not call Decisions', await evaluate('decisionCalls.length===0'));
  await evaluate("selectedPair().click()"); await stage('disabled');
  check('disabled comparison shows settings route', await evaluate("document.querySelector('.ai-overlap-modal').innerText.includes('Settings → Veynrel') && decisionCalls.length===0"));
  await closeOverlap();
  await evaluate("Object.assign(plugin.settings.decisions,{enabled:true,apiKey:'synthetic-decisions-key'});engine.notifyDecisionsSettingsChanged();plugin.saveSettings()");
  const indexBefore = await evaluate('engine.getCachedIndexState()');
  const bytesBefore = await fs.readdir(pluginDir);
  await evaluate("selectedPair().click()"); await stage('ready');
  check('preview has two long exact fragments and no request', await evaluate("document.querySelectorAll('.ai-overlap-text').length===2 && document.querySelector('.ai-overlap-text').innerText.length>1000 && decisionCalls.length===0"));
  await screenshot('preview-en');
  await evaluate("window.displayed=[...document.querySelectorAll('.ai-overlap-text')].map(el=>el.textContent);mode='slow';document.querySelector('.ai-overlap-modal .mod-cta').focus()");
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await stage('assessing'); await waitFor('pendingDecisions.length===1');
  check('keyboard launches one request with exactly displayed text', await evaluate("decisionCalls.length===1 && decisionCalls[0].state.fragmentA===displayed[0] && decisionCalls[0].state.fragmentB===displayed[1] && Object.keys(decisionCalls[0].state).join(',')==='fragmentA,fragmentB' && document.querySelector('.ai-overlap-modal .mod-cta').disabled"));
  check('headerless and introduction payloads have no filename-derived context', await evaluate("!JSON.stringify(decisionCalls[0]).includes('Alpha') && !JSON.stringify(decisionCalls[0]).includes('Beta') && displayed.every(text=>text==='Bicycles have two wheels. Велосипед имеет два колеса. 😀 '.repeat(28).trimEnd())"));
  check('note names remain local in comparison', await evaluate("[...document.querySelectorAll('.ai-overlap-note')].map(el=>el.textContent).join('|').includes('Alpha.md') && [...document.querySelectorAll('.ai-overlap-note')].map(el=>el.textContent).join('|').includes('Beta.md')"));
  await evaluate("document.querySelector('.ai-overlap-modal .mod-cta').click();pendingDecisions.shift()();mode='success'"); await stage('result');
  check('tentative fragment-only result and no automatic re-run', await evaluate("document.querySelector('.ai-overlap-result').innerText.includes('The model suggests') && document.querySelector('.ai-overlap-modal').innerText.includes('not the entire notes') && decisionCalls.length===1"));
  check('index identity remains unchanged', JSON.stringify(indexBefore) === JSON.stringify(await evaluate('engine.getCachedIndexState()')));
  check('no new plugin persistent result store', JSON.stringify(bytesBefore) === JSON.stringify(await fs.readdir(pluginDir)));
  await screenshot('result-en');
  for (const name of ['Alpha.md', 'Beta.md']) {
    await evaluate(`[...document.querySelectorAll('.ai-overlap-note')].find(el=>el.textContent.includes(${JSON.stringify(name)})).click();void 0`);
    await waitFor(`app.workspace.getActiveFile()?.path===${JSON.stringify(name)}`);
    check('opens ' + name + ' at its selected body fragment', await evaluate('app.workspace.activeEditor.editor.getCursor().line===0'));
  }
  await evaluate("plugin.settings.decisions.model='typesafe/jev-1.13';engine.notifyDecisionsSettingsChanged();void 0"); await stage('stale');
  check('shown assessment marked stale on settings change', await evaluate("document.querySelector('.ai-overlap-result').innerText.includes('This assessment is stale') && decisionCalls.length===1"));
  await closeOverlap();
  await evaluate("app.setting.open();app.setting.openTabById('ai-knowledge-hub');void 0");
  await evaluate("[...app.setting.modalEl.querySelectorAll('.setting-item button')].find(el=>el.innerText==='Test Decisions').click();void 0");
  await waitFor('decisionCalls.length===2');
  check('explicit connection test is synthetic only', await evaluate("decisionCalls.at(-1).state.fragmentA==='A bicycle has two wheels.' && decisionCalls.at(-1).state.fragmentB==='Bicycles have two wheels.'"));
  await evaluate("{const select=[...app.setting.modalEl.querySelectorAll('select')].find(el=>[...el.options].some(o=>o.value==='ru'));select.value='ru';select.dispatchEvent(new Event('change',{bubbles:true}));}void 0");
  await waitFor("app.setting.modalEl.innerText.includes('Оценка пересечения / Decisions')"); await evaluate('app.setting.close()');
  await evaluate("selectedPair().click()"); await stage('ready');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  check('Russian localization and narrow long fragments without horizontal overflow', await evaluate("{const el=document.querySelector('.ai-overlap-modal');el.innerText.includes('Оценка относится к выбранным фрагментам') && el.scrollWidth<=el.clientWidth}"));
  await screenshot('preview-ru-narrow');
  await evaluate("mode='failure';document.querySelector('.ai-overlap-modal .mod-cta').click()"); await stage('error');
  check('controlled billing error, no provider body', await evaluate("document.querySelector('.ai-overlap-modal').innerText.includes('Недостаточно средств') && !document.body.innerText.includes('synthetic private error')"));
  await evaluate("mode='slow';document.querySelector('.ai-overlap-modal .mod-cta').click()"); await stage('assessing'); await waitFor('pendingDecisions.length===1');
  await closeOverlap(); await evaluate("pendingDecisions.shift()();void 0");
  check('closing ignores a slow reply', await evaluate("!document.querySelector('.ai-overlap-modal')"));
  await evaluate("app.setting.open();app.setting.openTabById('about');void 0");
  const observedVersion = await evaluate("app.setting.modalEl.innerText.match(/Version ([0-9.]+)/)?.[1]");
  assert(observedVersion);
  await evaluate("app.setting.close()");
  const info = await evaluate("({installer:require('/usr/lib/obsidian/obsidian.asar/package.json').version,electron:process.versions.electron,platform:process.platform})");
  const report = { ...info, obsidian: observedVersion, checks, embeddings, decisionsRequests: await evaluate('decisionCalls.length'), mainSha256: crypto.createHash('sha256').update(await fs.readFile(pluginDir + '/main.js')).digest('hex'),
    limitations: 'Linux native desktop with fake Decisions HTTP and synthetic local embeddings. No live provider/quality, mobile, other OS or screen-reader claim.' };
  await fs.writeFile(root + '/native.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { socket.close(); await new Promise(resolve => server.close(resolve)); }
