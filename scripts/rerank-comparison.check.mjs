// Free: node scripts/rerank-comparison.check.mjs (never reads a real key).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BudgetJournal, PLAN, nanos } from './rerank-comparison-budget.mjs';
import { productionAdapters, frozenCases, smoke, MODELS, ENDPOINT, metrics, plan, sha256 } from './rerank-comparison.mjs';
import { semanticAdapters, documentsForCases, buildPools, chooseModel } from './rerank-comparison-semantic.mjs';
import { reconcileAccounting } from './rerank-comparison-native.mjs';

const fingerprint = sha256(JSON.stringify(plan()));
const op = (id, reserve = 2_000_000) => ({ id, reserve, model: MODELS[0], caseId: 'smoke', requestSha256: 'a'.repeat(64) });
function fixture(t) {
  const root = fs.mkdtempSync('/tmp/rerank-budget-test-'), dir = root + '/state';
  const journal = new BudgetJournal(dir, fingerprint, 0.000488922);
  t.after(() => { journal.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { dir, journal };
}
test('durable reservation precedes dispatch, restart preserves cost and forbids duplicate/unknown sends', t => {
  const { dir, journal } = fixture(t);
  journal.reserve(op('first'), 0.000488922);
  assert.equal(JSON.parse(fs.readFileSync(journal.file, 'utf8').trim().split('\n').at(-1)).state, 'reserved');
  journal.settle('first', { validator: 'PASS', costUSD: 0.001 }); journal.close();
  const resumed = new BudgetJournal(dir, fingerprint, 0.001488922);
  assert.equal(resumed.summary().spentNanodollars, 1_000_000);
  assert.throws(() => resumed.reserve(op('first'), 0.001488922), /already-sent/);
  resumed.reserve(op('unknown'), 0.001488922); resumed.close();
  const interrupted = new BudgetJournal(dir, fingerprint, 0.001488922);
  assert.throws(() => interrupted.reserve(op('next'), 0.001488922), /reconciliation-required/); interrupted.close();
});
test('planning ceiling, account delta, unknown bills, lock and missing established journal fail closed', t => {
  const { dir, journal } = fixture(t);
  assert.throws(() => new BudgetJournal(dir, fingerprint, 0), /EEXIST/);
  assert.throws(() => journal.reserve(op('large', PLAN + 1), 0.000488922), /money-limit/);
  assert.throws(() => journal.reserve(op('external'), 0.020488922), /money-limit/);
  journal.reserve(op('first'), 0.000488922); journal.settle('first', { costUSD: null });
  assert.equal(journal.summary().unresolvedNanodollars, 2_000_000);
  assert.throws(() => journal.reserve(op('second'), 0.000488922), /reconciliation-required/);
  journal.close(); fs.renameSync(journal.file, journal.file + '.retained');
  assert.throws(() => new BudgetJournal(dir, fingerprint, 0), /missing-established-journal/);
});
test('timeout never releases reserve, even with a late zero receipt; different model after reconciled rejection is allowed', t => {
  for (const error of ['timeout', 'network', 'cancelled']) {
    const { journal } = fixture(t);
    journal.reserve(op('lost'), 0.000488922); journal.settle('lost', { error, costUSD: 0 });
    assert.equal(journal.summary().unresolvedNanodollars, 2_000_000);
    assert.throws(() => journal.reserve(op('next'), 0.000488922), /reconciliation-required/);
  }
  const { journal } = fixture(t);
  journal.reserve(op('unsupported'), 0.000488922); journal.settle('unsupported', { error: 'request', costUSD: 0 });
  journal.reserve({ ...op('other'), model: MODELS[1] }, 0.000488922);
});
test('plan change and corrupt journal rejected; numeric costs are not token counts', t => {
  const { dir, journal } = fixture(t); journal.close();
  assert.throws(() => new BudgetJournal(dir, 'b'.repeat(64), 0), /journal-plan-mismatch/);
  fs.appendFileSync(journal.file, '{truncated');
  assert.throws(() => new BudgetJournal(dir, fingerprint, 0));
  for (const value of [null, undefined, '0', -1, NaN, Infinity]) assert.equal(nanos(value), null);
});

test('production serializer, validator and fixed input permutations use exact endpoint with no retries', async t => {
  const a = await productionAdapters(), previous = globalThis.window; globalThis.window = globalThis;
  t.after(() => { globalThis.window = previous; });
  for (const model of MODELS) for (const item of [smoke, ...frozenCases()]) {
    let calls = 0;
    const texts = item.fragments.map(f => f.text), settings = { provider: 'openrouter', model, apiKey: 'fake-only', enabled: true };
    const provider = new a.OpenRouterRerankProvider(settings, async request => {
      calls++; assert.equal(request.url, ENDPOINT); assert.equal(request.method, 'POST');
      assert.equal(request.body, a.rerankBody(model, item.query, texts));
      assert.deepEqual(JSON.parse(request.body), { model, query: item.query, documents: texts, top_n: texts.length, provider: { allow_fallbacks: false } });
      return { status: 200, text: JSON.stringify({ model, results: texts.map((_, index) => ({ index, relevance_score: index })).reverse() }) };
    });
    const result = await provider.rank(item.query, texts, new AbortController().signal);
    assert.equal(result[0].index, texts.length - 1); assert.equal(calls, 1);
  }
  for (const response of [ { status: 429, text: '{}' }, { status: 200, text: '{' },
    { status: 200, text: JSON.stringify({ results: [{ index: 0, relevance_score: 1 }, { index: 1, relevance_score: 0 }] }) },
    { status: 200, text: JSON.stringify({ model: MODELS[0], results: [{ index: 0, relevance_score: 1 }, { index: 0, relevance_score: 0 }] }) } ]) {
    let calls = 0;
    const p = new a.OpenRouterRerankProvider({ enabled: true, provider: 'openrouter', model: MODELS[0], apiKey: 'fake-only' }, async () => { calls++; return response; });
    await assert.rejects(p.rank(smoke.query, smoke.fragments.map(f => f.text), new AbortController().signal)); assert.equal(calls, 1);
  }
});
test('actual chunk preparation excludes fallback names; refined search maps indices and preserves semantic scores and fallback', async t => {
  const a = await productionAdapters(), previous = globalThis.window; globalThis.window = globalThis;
  t.after(() => { globalThis.window = previous; });
  const chunker = new a.MarkdownChunker(), docs = smoke.fragments.map((f, i) => ({ path: `Local-Only-${i}.md`, content: f.text }));
  const base = docs.map((d, i) => ({ path: d.path, score: 0.8 - i / 10, matches: chunker.chunk(d).map(c => ({ ...c, score: 0.8 - i / 10 })) }));
  const source = { readPaths: async paths => ({ documents: docs.filter(d => paths.includes(d.path)), missingPaths: [] }) };
  const settings = { enabled: true, provider: 'openrouter', model: MODELS[0], apiKey: 'fake-only' };
  for (const failure of [false, true]) {
    let calls = 0, searches = 0; const stages = [];
    const p = new a.OpenRouterRerankProvider(settings, async r => {
      calls++; assert.deepEqual(JSON.parse(r.body).documents, smoke.fragments.map(f => f.text));
      return failure ? { status: 200, text: '{}' } : { status: 200, text: JSON.stringify({ model: settings.model,
        results: [{ index: 1, relevance_score: 0.9 }, { index: 0, relevance_score: 0.2 }] }) };
    });
    const result = await a.refinedSearch({ query: smoke.query, settings, signal: new AbortController().signal,
      search: async () => { searches++; return base; }, prepare: results => a.prepareRerankCandidates(results, source, chunker, () => true),
      allowed: () => true, isCurrent: () => true, provider: p, publish: u => stages.push(u.stage) });
    assert.equal(calls, 1); assert.equal(searches, 1); assert.deepEqual(stages, ['semantic', 'refining']);
    if (failure) { assert.equal(result.stage, 'fallback'); assert.deepEqual(result.results, base); }
    else { assert.equal(result.results[0].path, docs[1].path); assert.equal(result.results[0].score, base[1].score); assert.equal(result.results[0].rerankScore, 0.9); }
  }
});
test('quality uses manual labels and does not treat original order as semantic baseline', () => {
  const c = frozenCases()[0]; assert.equal(c.fragments[2].relevant, true);
  const result = metrics(c, [{ index: 0, relevanceScore: 0.1 }, { index: 2, relevanceScore: 0.9 }, { index: 1, relevanceScore: 0.2 }]);
  assert.equal(result.reciprocalRank, 1); assert.equal(result.top1, true);
});
test('semantic driver uses the real index/search/preparation once per query, with an offline vector cache', async t => {
  const root = fs.mkdtempSync('/tmp/rerank-semantic-test-'), original = globalThis.fetch;
  globalThis.fetch = () => assert.fail('network in free test');
  t.after(() => { globalThis.fetch = original; fs.rmSync(root, { recursive: true, force: true }); });
  const a = await semanticAdapters(), cases = frozenCases(), docs = documentsForCases(cases), chunker = new a.MarkdownChunker();
  const texts = [...docs.flatMap(d => chunker.chunk(d).map(c => c.text)), ...cases.map(c => c.query)];
  const vectors = texts.map((_, i) => [1, i / 20, 0.1]);
  const result = await buildPools(root, vectors, texts, a);
  assert.equal(result.indexStats.vectorCount, 12); assert.equal(result.pools.length, 4);
  for (const pool of result.pools) {
    assert.equal(pool.queryEmbeddingLookups, 1); assert.equal(pool.baseline.length, 12);
    assert.equal(pool.fragments.length, 12); assert(pool.fragments.every(f => !f.text.includes('Synthetic-')));
  }
  const entries = MODELS.flatMap((_, i) => cases.map(c => ({ id: `fixed-${i}-${c.id}`, cost: 1000 * (3 - i),
    outcome: { validator: 'PASS', quality: { reciprocalRank: 1 }, latencyMs: 20 } })));
  assert.equal(chooseModel(entries).index, 2);
});
test('production embedding provider sends one exact batch and reuses its dimension cache', async t => {
  const a = await semanticAdapters(), previousWindow = globalThis.window;
  globalThis.window = globalThis;
  t.after(() => { globalThis.window = previousWindow; delete globalThis.__comparisonEmbeddingTransport; });
  let calls = 0;
  globalThis.__comparisonEmbeddingTransport = async request => {
    calls++; assert.equal(request.url, 'https://openrouter.ai/api/v1/embeddings');
    assert.deepEqual(JSON.parse(request.body), { model: 'openai/text-embedding-3-small', input: ['doc', 'query'], encoding_format: 'float' });
    return { status: 200, text: JSON.stringify({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }) };
  };
  const p = new a.OpenAICompatibleEmbeddingProvider({ provider: 'openrouter', model: 'openai/text-embedding-3-small', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'fake-only' });
  assert.deepEqual((await p.embed(['doc', 'query'])).map(v => [...v]), [[1, 0], [0, 1]]);
  assert.equal(await p.dimensions(), 2); assert.equal(calls, 1);
});
test('delayed aggregate key usage reconciles against cumulative receipts, without a second paid request', t => {
  const observation = { validator: 'PASS', usage: { cost: 0.00001108 } };
  const result = reconcileAccounting({ usage: 0.000488922 }, { usage: 0.005830502 }, observation, null,
    { baselineUsage: 0.000488922, knownCostUSD: 0.0053305 });
  assert.equal(result.costUSD, 0.00001108);
  assert.throws(() => reconcileAccounting({ usage: 0 }, { usage: 1 }, observation, null,
    { baselineUsage: 0, knownCostUSD: 0 }), /billing-mismatch/);
  assert.equal(reconcileAccounting({ usage: 0 }, { usage: 0 }, {}, null, { baselineUsage: 0, knownCostUSD: 0 }).costUSD, null);
  const { dir, journal } = fixture(t);
  journal.reserve(op('one'), 0.000488922); journal.settle('one', { validator: 'PASS', usage: { cost: 0.001 }, costUSD: null });
  assert.throws(() => journal.reconcileReceipt('one', 0.000488922), /cumulative-billing-mismatch/);
  journal.reconcileReceipt('one', 0.001488922); journal.close();
  const resumed = new BudgetJournal(dir, fingerprint, 0.001488922);
  assert.equal(resumed.summary().spentNanodollars, 1_000_000);
  assert.throws(() => resumed.reserve(op('one'), 0.001488922), /already-sent/); resumed.close();
});
