// Narrow adapter-only native execution. This does not claim new native UI coverage.
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { check } from './rerank-comparison-budget.mjs';
import { ROOT, BUILD, ENDPOINT, sha256, productionAdapters, keyPreflight } from './rerank-comparison.mjs';
import { installProbe, connect } from './rerank-comparison-native.mjs';
import { STATE, MODEL, SETTINGS, freeze, loadPools, refine, replay, settle } from './rerank-hard-v1.mjs';

export async function rankPools(journal, data, key) {
  const saved = loadPools(journal, data), adapters = await productionAdapters();
  // Resolve finished work entirely offline; never create a second native submission on resume.
  const pending = saved.pools.filter(pool => !journal.entries.has('rerank-' + pool.id.toLowerCase()));
  for (const pool of saved.pools.filter(p => !pending.includes(p))) {
    freeze(STATE + '/result-' + pool.id + '.json', await replay(pool, journal, adapters));
  }
  if (!pending.length) { console.log('All 28 case IDs are already settled; no paid requests.'); return; }
  const root = fs.mkdtempSync('/tmp/veynrel-rerank-hard-'), vault = root + '/vault';
  const pluginDir = vault + '/.obsidian/plugins/ai-knowledge-hub';
  fs.mkdirSync(pluginDir, { recursive: true }); fs.mkdirSync(root + '/profile');
  for (const doc of data.docs) fs.writeFileSync(vault + '/' + doc.path, doc.content);
  fs.writeFileSync(pluginDir + '/data.json', JSON.stringify({ language: 'en', apiKey: '', semantic: { enabled: false },
    companion: { enabled: false }, health: { profile: 'mixed', profileChosen: true, onboardingCompleted: true } }));
  fs.writeFileSync(vault + '/.obsidian/community-plugins.json', '["ai-knowledge-hub"]');
  fs.writeFileSync(vault + '/.obsidian/app.json', '{"checkForUpdates":false}');
  fs.writeFileSync(root + '/profile/obsidian.json', JSON.stringify({ vaults: { benchmark: { path: vault, ts: Date.now(), open: true } } }));
  for (const name of ['main.js', 'manifest.json', 'styles.css']) fs.copyFileSync(ROOT + name, pluginDir + '/' + name);
  check(sha256(fs.readFileSync(pluginDir + '/main.js')) === BUILD, 'installed-build-changed');
  const server = http.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port; await new Promise(r => server.close(r));
  const child = spawn('/usr/bin/electron43', ['/usr/lib/obsidian/app.asar', `--user-data-dir=${root}/profile`,
    `--remote-debugging-port=${port}`, '--disable-gpu', '--ozone-platform=x11'],
  { env: { ...process.env, OPENROUTER_API_KEY: key }, stdio: 'ignore' });
  child.on('error', () => {});
  let client;
  try {
    client = await connect(port);
    await client.waitFor('Boolean(window.app?.workspace?.layoutReady && window.app?.plugins?.manifests?.["ai-knowledge-hub"])', 1200);
    check(await client.evaluate(`app.vault.adapter.basePath===${JSON.stringify(vault)}`), 'wrong-vault');
    await client.evaluate('(async()=>{if(!app.plugins.isEnabled())await app.plugins.setEnable(true);if(!app.plugins.plugins["ai-knowledge-hub"])await app.plugins.enablePlugin("ai-knowledge-hub");})()');
    await client.waitFor('Boolean(app.plugins.plugins["ai-knowledge-hub"]?.semanticController)');
    await client.evaluate("app.setting.open();app.setting.openTabById('about');true");
    const versions = await client.evaluate("({obsidian:app.setting.modalEl.innerText.match(/Version ([0-9.]+)/)?.[1],electron:process.versions.electron})");
    await client.evaluate('app.setting.close();true'); check(versions.obsidian, 'native-version');
    freeze(STATE + '/native.json', { ...versions, buildSha256: BUILD, transport: 'Installed production OpenRouterRerankProvider + actual Obsidian requestUrl', ui: 'NOT RUN in this benchmark; previous PR #73 evidence only' });
    await client.evaluate(`(${installProbe.toString()})(${JSON.stringify({ fake: false, model: MODEL, endpoint: ENDPOINT })})`);
    for (const pool of pending) {
      let receipt;
      const provider = { rank: async (query, documents) => {
        check(documents.every(t => !/note-\d{3}/.test(t)), 'filename-provenance');
        const op = { id: 'rerank-' + pool.id.toLowerCase(), caseId: pool.id, model: MODEL, reserve: 1_000_000,
          requestSha256: sha256(adapters.rerankBody(MODEL, query, documents)) };
        const before = await keyPreflight(key); journal.reserve(op, before.usage);
        await client.evaluate(`window.__rerankComparison.ticket=${JSON.stringify(op)};window.__rerankComparison.observation={};`);
        // Do not await inference in Runtime.evaluate: the guarded one-shot records completion even on a provider error.
        await client.evaluate(`void app.plugins.plugins['ai-knowledge-hub'].semanticController.rerankProvider(${JSON.stringify(SETTINGS)}).rank(${JSON.stringify(query)},${JSON.stringify(documents)},new AbortController().signal).catch(()=>{});`);
        await client.waitFor('Boolean(window.__rerankComparison.observation?.done)');
        const observation = await client.evaluate('window.__rerankComparison.observation');
        receipt = await settle(journal, key, before, op, observation);
        await client.evaluate('window.__rerankComparison.ticket=null');
        return receipt.scores;
      } };
      const result = await refine(pool, provider, adapters);
      // refinedSearch intentionally catches provider errors; the experiment must still stop on an uncertain operation.
      check(result.stage === 'reranked' && receipt?.validator === 'PASS', 'rerank-not-completed');
      const savedResult = await replay(pool, journal, adapters);
      check(JSON.stringify(result.results) === JSON.stringify(savedResult.result.results), 'replay-order');
      freeze(STATE + '/result-' + pool.id + '.json', savedResult);
    }
    check(!fs.readFileSync(pluginDir + '/data.json', 'utf8').includes(key), 'persisted-key');
  } finally {
    if (client) { await client.evaluate('window.__rerankComparison.ticket=null;window.close()').catch(() => {}); client.close(); }
    child.kill();
  }
}
