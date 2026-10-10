// Explicit paid commands only. Original installed production adapter and Obsidian requestUrl.
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BudgetJournal, check, nanos, safeCode } from './rerank-comparison-budget.mjs';
import { ROOT, STATE, SOURCE, BUILD, MODELS, ENDPOINT, sha256, smoke, frozenCases, plan,
  productionAdapters, readKey, keyPreflight, metrics } from './rerank-comparison.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function installProbe(config) {
  const plugin = app.plugins.plugins['ai-knowledge-hub'], engine = plugin.semanticController;
  const key = config.fake ? 'synthetic-only' : process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  const probe = window.__rerankComparison = { ticket: null, observation: null, attempts: 0, updates: [], candidates: [] };
  const digest = text => require('node:crypto').createHash('sha256').update(text).digest('hex');
  const summary = results => results.map(r => ({ path: r.path, semanticScore: r.score,
    rerankScore: r.rerankScore ?? null, source: r.rerankMatch?.source ?? r.matches[0]?.source }));
  const search = engine.searchCandidates.bind(engine);
  engine.searchCandidates = async (...args) => { const result = await search(...args); probe.candidates = summary(result); return result; };
  const discover = engine.searchDiscover.bind(engine);
  engine.searchDiscover = async (query, publish, signal) => {
    const remember = update => probe.updates.push({ stage: update.stage, results: summary(update.results) });
    const result = await discover(query, update => { remember(update); publish(update); }, signal);
    remember(result); return result;
  };
  const factory = engine.rerankProvider;
  engine.rerankProvider = settings => {
    const provider = factory({ ...settings, apiKey: key });
    const transport = provider.transport;
    provider.transport = async request => {
      const ticket = probe.ticket;
      if (!ticket || ticket.used || request.url !== config.endpoint || request.method !== 'POST' ||
        digest(request.body) !== ticket.requestSha256) throw Error('unarmed-or-body-mismatch');
      ticket.used = true; probe.attempts++;
      const observation = probe.observation;
      observation.dispatched = true;
      const body = JSON.parse(request.body);
      observation.requestSha256 = digest(request.body);
      observation.payloadBytes = Buffer.byteLength(request.body);
      observation.documentCount = body.documents.length;
      observation.filenameFallbackAbsent = body.documents.every(t => !t.includes('Local-Only-'));
      const response = config.fake ? { status: 200, text: JSON.stringify({ model: body.model,
        results: body.documents.map((_, index) => ({ index, relevance_score: 1 - index / 10 })), usage: { search_units: 1, cost: 0.001 } }) }
        : await transport(request);
      observation.httpStatus = response.status;
      // Copy only a bounded schema summary and numeric accounting; raw bodies/headers never leave the renderer.
      try {
        const p = JSON.parse(response.text), identifier = s => typeof s === 'string' && /^[A-Za-z0-9 ._:/-]{1,200}$/.test(s) ? s : null;
        observation.generationId = typeof p.id === 'string' && /^gen-[A-Za-z0-9-]{1,160}$/.test(p.id) ? p.id : null;
        observation.resolvedModel = identifier(p.model); observation.provider = identifier(p.provider);
        observation.schema = { modelType: typeof p.model, resultsIsArray: Array.isArray(p.results),
          resultsCount: Array.isArray(p.results) ? p.results.length : null };
        observation.usage = {};
        for (const name of ['search_units', 'total_tokens', 'input_tokens', 'output_tokens', 'cost']) {
          if (typeof p.usage?.[name] === 'number' && Number.isFinite(p.usage[name]) && p.usage[name] >= 0)
            observation.usage[name] = p.usage[name];
        }
        observation.apiErrorCode = typeof p.error?.code === 'number' ? p.error.code : null;
      } catch { observation.schema = { json: false }; }
      return response;
    };
    const rank = provider.rank.bind(provider);
    provider.rank = async (...args) => {
      const o = probe.observation, start = performance.now();
      try { const result = await rank(...args); o.scores = result; o.validator = 'PASS'; return result; }
      catch (error) {
        o.error = ['auth', 'credits', 'rate-limit', 'server', 'request', 'network', 'timeout', 'cancelled', 'invalid-response', 'configuration'].includes(error?.code)
          ? error.code : 'internal';
        o.validator = o.error === 'invalid-response' ? 'FAIL' : 'NOT RUN'; throw error;
      } finally { o.latencyMs = Math.round(performance.now() - start); o.done = true; }
    };
    return provider;
  };
  // A harmless placeholder passes local configuration checks; the real key exists only in provider memory.
  Object.assign(plugin.settings.rerank, { enabled: true, apiKey: 'session-provider-memory', model: config.model });
  engine.notifyRerankSettingsChanged();
}

export async function connect(port) {
  let page;
  for (let i = 0; i < 200; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.url.startsWith('app://obsidian.md/')); } catch { /* Local startup only. */ }
    if (page) break; await pause(100);
  }
  check(page, 'native-not-ready');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(Error('cdp-connect')); });
  let id = 0; const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data), p = pending.get(message.id);
    if (p) { pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(Error('cdp-error')) : p.resolve(message.result); }
  };
  const evaluate = async expression => {
    const result = await new Promise((resolve, reject) => {
      const number = ++id, timer = setTimeout(() => { pending.delete(number); reject(Error('cdp-timeout')); }, 25000);
      pending.set(number, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: number, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
    if (result.exceptionDetails) throw Object.assign(Error('native-evaluate'), { expressionHash: sha256(expression),
      exceptionClass: result.exceptionDetails.exception?.className ?? null });
    return result.result.value;
  };
  const waitFor = async (expression, attempts = 400) => {
    for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await pause(50); }
    throw Object.assign(Error('native-timeout'), { code: 'timeout' });
  };
  return { evaluate, waitFor, close: () => { for (const p of pending.values()) clearTimeout(p.timer); socket.close(); } };
}

async function prepareProfile(root, embeddingPort) {
  const vault = root + '/vault', pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
  fs.mkdirSync(pluginDir, { recursive: true }); fs.mkdirSync(root + '/profile', { recursive: true });
  smoke.fragments.forEach((f, i) => fs.writeFileSync(`${vault}/Local-Only-${i}.md`, f.text));
  fs.writeFileSync(pluginDir + '/data.json', JSON.stringify({ language: 'en', apiKey: '',
    semantic: { enabled: true, embeddingProvider: 'openai-compatible', embeddingModel: 'synthetic-wiring-only',
      embeddingBaseUrl: `http://127.0.0.1:${embeddingPort}/v1`, openRouterApiKey: '', openAICompatibleApiKey: '' },
    companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } }));
  fs.writeFileSync(vault + '/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
  fs.writeFileSync(vault + '/.obsidian/app.json', '{"checkForUpdates":false}');
  fs.writeFileSync(root + '/profile/obsidian.json', JSON.stringify({ vaults: { comparison: { path: vault, ts: Date.now(), open: true } } }));
  for (const name of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(ROOT + name, pluginDir + '/' + name);
  check(sha256(fs.readFileSync(pluginDir + '/main.js')) === BUILD, 'installed-build-mismatch');
  return { vault, pluginDir };
}

export function reconcileAccounting(before, after, observation, generation, accounting) {
  const delta = after.usage - before.usage;
  const actual = nanos(observation.usage?.cost) !== null ? observation.usage.cost : generation?.totalCostUSD;
  const unaccounted = after.usage - accounting.baselineUsage - accounting.knownCostUSD;
  const cost = nanos(actual) !== null ? actual : unaccounted > 1e-9 ? unaccounted : null;
  // Key accounting can arrive in batches. Compare cumulative cost, never a delayed batch to one HTTP call.
  check(nanos(delta) !== null && (nanos(actual) === null || unaccounted <= actual + 1e-8), 'billing-mismatch');
  return { ...observation, generation, keyUsageBeforeUSD: before.usage, keyUsageAfterUSD: after.usage,
    keyUsageDeltaUSD: delta, costUSD: cost ?? null,
    costBasis: nanos(actual) !== null ? (nanos(observation.usage?.cost) !== null ? 'response-cost' : 'generation-total-cost')
      : cost !== null ? 'cumulative-key-usage' : 'unknown' };
}

export async function reconcile(key, before, observation, fake = false, accounting = { baselineUsage: before.usage, knownCostUSD: 0 }) {
  if (fake) return { ...observation, costUSD: observation.usage?.cost ?? null, costBasis: 'fake-receipt' };
  if (['network', 'timeout', 'cancelled'].includes(observation.error)) return { ...observation, costUSD: null, costBasis: 'unknown' };
  let generation = null;
  if (observation.generationId) {
    const response = await fetch('https://openrouter.ai/api/v1/generation?id=' + encodeURIComponent(observation.generationId), {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (response.status === 200) {
      const { data } = await response.json();
      generation = { httpStatus: 200, totalCostUSD: nanos(data?.total_cost) !== null ? data.total_cost : null,
        provider: typeof data?.provider_name === 'string' && /^[A-Za-z0-9 ._-]{1,100}$/.test(data.provider_name) ? data.provider_name : null };
    } else generation = { httpStatus: response.status, totalCostUSD: null };
  }
  const after = await keyPreflight(key);
  return reconcileAccounting(before, after, observation, generation, accounting);
}

export async function run({ fake = false, phase = 'smoke', modelIndex = 0 } = {}) {
  check(['smoke', 'fixed', 'semantic'].includes(phase) && Number.isInteger(modelIndex) && modelIndex >= 0 && modelIndex < 3, 'arguments');
  check(sha256(fs.readFileSync(ROOT + 'main.js')) === BUILD, 'build-mismatch');
  const key = fake ? '' : readKey();
  const initial = fake ? { usage: 0, limit: 50 } : await keyPreflight(key);
  const directory = fake ? fs.mkdtempSync('/tmp/rerank-comparison-fake-') + '/state' : STATE;
  const journal = new BudgetJournal(directory, sha256(JSON.stringify(plan())), initial.usage);
  const adapters = await productionAdapters();
  const model = MODELS[modelIndex];
  let items = phase === 'smoke' ? [smoke] : frozenCases();
  if (phase === 'semantic') {
    const saved = JSON.parse(fs.readFileSync(STATE + '/semantic-pools.json'));
    check(saved.selectedModel.index === modelIndex && saved.casesSha256 === plan().casesSha256, 'semantic-plan-mismatch');
    const texts = new Map(frozenCases().flatMap(c => c.fragments.map(f => [f.id, f.text])));
    for (const p of saved.pools) {
      check(p.fragments.length === texts.size && new Set(p.fragments.map(f => f.id)).size === texts.size &&
        p.fragments.every(f => texts.get(f.id) === f.text) && p.query === frozenCases().find(c => c.id === p.id)?.query, 'semantic-input-mismatch');
    }
    items = saved.pools;
  }
  const operations = items.map(item => ({
    id: `${phase}-${modelIndex}-${item.id}`, model, caseId: item.id, reserve: 2_000_000, item,
    requestSha256: sha256(adapters.rerankBody(model, item.query, item.fragments.map(f => f.text))),
  }));
  let connection, child, server, resumedOnly = false;
  const report = { mode: fake ? 'fake-native' : 'paid-native', sourceCommit: SOURCE, buildSha256: BUILD,
    phase, model, initial, startedAt: new Date().toISOString(), native: null, checks: [] };
  try {
    if (!fake && phase !== 'smoke') check(journal.entries.get(`smoke-${modelIndex}-smoke`)?.outcome?.validator === 'PASS', 'model-smoke-required');
    check(![...journal.entries.values()].some(e => e.model === model && e.outcome?.error), 'model-stopped-after-error');
    if (operations.every(op => journal.entries.has(op.id))) {
      resumedOnly = true;
      report.checks.push('restart skipped all previously dispatched operations'); return report;
    }
    check(fake || new Date().toISOString().slice(0, 10) === '2026-10-10', 'tariffs-need-recheck');
    const root = fs.mkdtempSync('/tmp/veynrel-rerank-comparison-');
    server = http.createServer(async (req, res) => {
      let bytes = ''; for await (const chunk of req) bytes += chunk;
      try {
        const { input } = JSON.parse(bytes); check(Array.isArray(input) && !req.headers.authorization, 'local-embedding');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: t.includes('database index') ? [0.8, 0.6] : [1, 0] })) }));
      } catch { res.writeHead(400); res.end('{}'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const fixture = await prepareProfile(root, server.address().port);
    const portProbe = http.createServer(); await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
    const port = portProbe.address().port; await new Promise(resolve => portProbe.close(resolve));
    child = spawn('/usr/bin/electron43', ['/usr/lib/obsidian/app.asar', `--user-data-dir=${root}/profile`,
      `--remote-debugging-port=${port}`, '--disable-gpu', '--ozone-platform=x11'],
    { env: { ...process.env, OPENROUTER_API_KEY: key }, stdio: 'ignore' });
    child.on('error', () => {});
    report.step = 'connect'; connection = await connect(port);
    const { evaluate, waitFor } = connection;
    report.step = 'plugin-start';
    await waitFor("!!window.app?.workspace?.layoutReady && !!window.app?.plugins?.manifests?.['ai-knowledge-hub']", 1200);
    check(await evaluate(`app.vault.adapter.basePath===${JSON.stringify(fixture.vault)}`), 'wrong-vault');
    report.step = 'plugin-enable';
    await evaluate("(async()=>{if(!app.plugins.isEnabled())await app.plugins.setEnable(true);if(!app.plugins.plugins['ai-knowledge-hub'])await app.plugins.enablePlugin('ai-knowledge-hub');})()");
    await waitFor("!!window.app?.plugins?.plugins?.['ai-knowledge-hub']?.semanticController", 1200);
    await evaluate('new Promise(r=>app.workspace.onLayoutReady(r))');
    report.step = 'install-probe';
    await evaluate(`(${installProbe.toString()})(${JSON.stringify({ fake, model, endpoint: ENDPOINT })});true`);
    await evaluate("app.setting.open();app.setting.openTabById('about');true");
    report.native = await evaluate("({obsidian:app.setting.modalEl.innerText.match(/Version ([0-9.]+)/)?.[1],electron:process.versions.electron,platform:process.platform})");
    await evaluate('app.setting.close();true');
    check(report.native.obsidian, 'native-version');
    if (phase === 'smoke' && modelIndex === 0) {
      report.step = 'local-index';
      await evaluate("{const e=app.plugins.plugins['ai-knowledge-hub'].semanticController;e.confirm=async()=>true;void e.indexVault();}true");
      await waitFor("app.plugins.plugins['ai-knowledge-hub'].semanticController.getSemanticStatus().kind==='ready'");
      check(await evaluate('__rerankComparison.attempts===0'), 'passive-paid-request');
    }
    for (const op of operations) {
      if (journal.entries.has(op.id)) continue;
      const before = fake ? { usage: 0 } : await keyPreflight(key);
      report.step = op.id; journal.reserve(op, before.usage);
      let observation = {};
      try {
        await evaluate(`__rerankComparison.ticket=${JSON.stringify(op)};__rerankComparison.observation={};__rerankComparison.updates=[];true`);
        const nativeUI = phase === 'smoke' && modelIndex === 0;
        if (nativeUI) {
          await evaluate("app.plugins.plugins['ai-knowledge-hub'].semanticController.openSearch();true");
          await waitFor("!!document.querySelector('.ai-semantic-search-modal input')");
          await evaluate(`document.querySelector('.ai-semantic-search-modal input').value=${JSON.stringify(op.item.query)};document.querySelector('.ai-semantic-search-input-row button').click();true`);
        } else {
          await evaluate(`{const p=app.plugins.plugins['ai-knowledge-hub'];void p.semanticController.rerankProvider(p.settings.rerank).rank(${JSON.stringify(op.item.query)},${JSON.stringify(op.item.fragments.map(f => f.text))},new AbortController().signal).catch(()=>{});}true`);
        }
        await waitFor('__rerankComparison.observation.done');
        observation = await evaluate('structuredClone(__rerankComparison.observation)'); delete observation.done;
        if (nativeUI) {
          await waitFor("['reranked','fallback','error','skipped'].includes(document.querySelector('.ai-semantic-search-status')?.dataset.state)");
          observation.native = await evaluate("({stage:document.querySelector('.ai-semantic-search-status').dataset.state,updates:__rerankComparison.updates,candidates:__rerankComparison.candidates,titles:[...document.querySelectorAll('.ai-semantic-result-title')].map(e=>e.innerText)})");
          if (observation.validator === 'PASS') {
            await evaluate("document.querySelector('.ai-semantic-result-card').click();true");
            await waitFor("app.workspace.getActiveFile()?.path==='Local-Only-0.md'");
            observation.native.opened = await evaluate("({path:app.workspace.getActiveFile().path,line:app.workspace.activeEditor.editor.getCursor().line})");
          }
        }
        observation = await reconcile(key, before, observation, fake,
          { baselineUsage: journal.header.baselineUsage, knownCostUSD: journal.summary().spentNanodollars / 1e9 });
        if (observation.scores) observation.quality = metrics(op.item, observation.scores);
        if (phase === 'semantic' && observation.quality) {
          const relevant = op.item.relevantIds, order = op.item.baseline.map(r => r.id);
          const positions = relevant.map(id => order.indexOf(id) + 1), first = Math.min(...positions.filter(p => p > 0));
          const after = observation.quality.positions[0];
          observation.semantic = { candidateContainsRelevant: positions.some(p => p > 0), beforeOrder: order,
            beforePositions: positions, beforeTop1: first === 1, beforeTop3: first <= 3,
            afterPositions: observation.quality.positions, afterTop1: observation.quality.top1, afterTop3: observation.quality.top3,
            change: !Number.isFinite(first) ? 'not-retrieved' : after < first ? 'improved' : after > first ? 'worsened' : 'unchanged',
            queryEmbeddingLookups: op.item.queryEmbeddingLookups, sameCandidatePool: true };
        }
      } catch (error) { observation.error = safeCode(error); observation.costUSD ??= null; }
      finally { await evaluate('__rerankComparison.ticket=null;true').catch(() => {}); }
      journal.settle(op.id, observation);
      fs.writeFileSync(directory + '/evidence.json', JSON.stringify({ ...report, entries: [...journal.entries.values()], accounting: journal.summary() }, null, 2));
      console.log(JSON.stringify({ id: op.id, status: observation.error ?? observation.validator, http: observation.httpStatus,
        latencyMs: observation.latencyMs, usage: observation.usage, costUSD: observation.costUSD, costBasis: observation.costBasis, quality: observation.quality }));
      check(journal.entries.get(op.id).cost !== null && journal.entries.get(op.id).cost <= op.reserve, 'reconciliation-required');
      if (observation.error) break;
    }
    const stored = fs.readFileSync(fixture.pluginDir + '/data.json', 'utf8');
    check(!key || !stored.includes(key), 'credential-persistence');
    report.checks.push('production artifact hash verified', 'real credential absent from data.json', 'one-shot exact body guard');
  } catch (error) {
    if (connection) report.startup = await connection.evaluate(`({appReady:!!window.app,pluginReady:!!window.app?.plugins?.plugins?.['ai-knowledge-hub'],
      manifestReady:!!window.app?.plugins?.manifests?.['ai-knowledge-hub'],layoutReady:!!window.app?.workspace?.layoutReady,
      enabled:window.app?.plugins?.enabledPlugins?.has('ai-knowledge-hub')??null,
      restricted:typeof window.app?.plugins?.isEnabled==='function'?!app.plugins.isEnabled():null})`).catch(() => null);
    throw error;
  } finally {
    report.entries = [...journal.entries.values()]; report.accounting = journal.summary(); report.finishedAt = new Date().toISOString();
    if (!resumedOnly) fs.writeFileSync(directory + `/evidence-${phase}-${modelIndex}.json`, JSON.stringify(report, null, 2));
    if (connection) { try { await connection.evaluate('setTimeout(()=>window.close(),100);true'); } catch { /* Local cleanup. */ } connection.close(); }
    if (child) { await pause(500); if (child.exitCode === null) child.kill('SIGTERM'); }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    journal.close();
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, phase, index] = process.argv.slice(2);
  if (!['--fake', '--live'].includes(mode)) { console.error('Usage: --fake|--live smoke|fixed|semantic 0|1|2'); process.exitCode = 1; }
  else await run({ fake: mode === '--fake', phase, modelIndex: Number(index) }).then(r =>
    console.log(JSON.stringify({ mode: r.mode, checks: r.checks, accounting: r.accounting, native: r.native })))
    .catch(error => { console.error(JSON.stringify({ stopped: true, code: safeCode(error), expressionHash: error.expressionHash, exceptionClass: error.exceptionClass,
      reason: ['native-not-ready', 'native-evaluate', 'key-budget-gate', 'reconciliation-required', 'money-limit', 'model-smoke-required',
        'missing-established-journal', 'journal-plan-mismatch', 'build-mismatch'].includes(error.message) ? error.message : 'driver-error' })); process.exitCode = 1; });
}
