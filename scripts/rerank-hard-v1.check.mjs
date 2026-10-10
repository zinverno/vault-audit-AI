// Free only. No credential reads, native process or external transport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BudgetJournal } from './rerank-comparison-budget.mjs';
import { productionAdapters, sha256, ENDPOINT } from './rerank-comparison.mjs';
import { semanticAdapters } from './rerank-comparison-semantic.mjs';
import { dataset, plan, hashJSON, freeze, completed, measure, compare, aggregate, makePools, refine, replay, embeddingBatch, SETTINGS, MODEL } from './rerank-hard-v1.mjs';

globalThis.window = globalThis;
globalThis.fetch = () => { throw Error('free-test-network-tripwire'); };
const data = dataset(), adapters = await productionAdapters(), semantic = await semanticAdapters();
const temp = () => fs.mkdtempSync('/tmp/rerank-hard-check-');
const op = id => ({ id, model: MODEL, caseId: id, reserve: 1_000_000, requestSha256: sha256(id) });
const journalAt = root => new BudgetJournal(root + '/state', hashJSON(plan()), 0);

test('frozen corpus, exhaustive judgments, groups and late sections', () => {
  assert.equal(data.docs.length, 64); assert.equal(data.judgments.reduce((n, j) => n + j.documents.length, 0), 1792);
  const c = new semantic.MarkdownChunker();
  for (const n of [45, 46, 47, 48]) assert(c.chunk(data.docs[n - 1]).length >= 5);
  const dir = temp(); freeze(dir + '/frozen.json', data.manifest); freeze(dir + '/frozen.json', data.manifest);
  assert.throws(() => freeze(dir + '/frozen.json', {}), /artifact-changed/);
});

test('hand-calculated graded metrics, cutoff and no-answer exclusion', () => {
  const j = [{ path: 'a', grade: 3 }, { path: 'b', grade: 2 }, { path: 'c', grade: 1 }, { path: 'd', grade: 0 }];
  const m = measure(['d', 'b', 'a', 'c'], j);
  const expected = (3 / Math.log2(3) + 7 / 2 + 1 / Math.log2(5)) / (7 + 3 / Math.log2(3) + 1 / 2);
  assert(Math.abs(m.ndcg10 - expected) < 1e-12); assert.equal(m.mrr10, 0.5); assert.equal(m.hit1, 0); assert.equal(m.hit3, 1);
  assert.equal(measure(['d'], j).mrr10, 0); assert.equal(measure(['x'], [{ path: 'x', grade: 0 }]).ndcg10, null);
  const many = Array.from({ length: 11 }, (_, i) => ({ path: String(i), grade: i === 10 ? 3 : 0 }));
  assert.equal(measure(many.map(d => d.path), many).mrr10, 0);
  assert.throws(() => measure(['a', 'a'], j), /duplicate/);
  const rows = ['A', 'N'].map(group => ({ group, result: { stage: 'reranked' }, quality: { before: m, after: m, deltaNdcg10: 0, change: 'Unchanged', recall30: 1 }, receipt: { validator: 'PASS', latencyMs: group === 'A' ? 100 : 300, costUSD: 0.001 } }));
  const summary = aggregate(rows); assert.equal(summary.pairedCount, 1); assert.equal(summary.latencyMs.median, 200); assert.equal(summary.latencyMs.p95, 300);
});

test('durable budget: concurrency lock, cap, duplicate, identity and resume', () => {
  const root = temp(); let j = journalAt(root);
  assert.throws(() => journalAt(root));
  j.reserve(op('one'), 0); j.settle('one', { costUSD: 0.0001, validator: 'PASS' }); j.close();
  j = journalAt(root); assert.equal(completed(j, op('one')).costUSD, 0.0001);
  assert.throws(() => j.reserve(op('one'), 0), /already-sent/);
  assert.throws(() => completed(j, { ...op('one'), requestSha256: sha256('changed') }), /operation-changed/);
  assert.throws(() => j.reserve({ ...op('huge'), reserve: 20_000_000 }, 0), /money-limit/);
  assert.throws(() => j.reserve(op('external'), 0.020), /money-limit/);
  assert.equal(j.summary().spentNanodollars, 100000); j.close();
});

test('interrupted and unknown paid operations cannot be paid again', () => {
  for (const settled of [false, true]) {
    const root = temp(); let j = journalAt(root); j.reserve(op('unknown'), 0);
    if (settled) j.settle('unknown', { validator: 'PASS', costUSD: null });
    j.close(); j = journalAt(root);
    assert.throws(() => completed(j, op('unknown')), /reconciliation-required/);
    assert.throws(() => j.reserve(op('next'), 0), /reconciliation-required/);
    assert.equal(j.summary().unresolvedNanodollars, 1_000_000); j.close();
  }
});

test('an uncertain accounting read reconciles once from cumulative usage without resubmission', () => {
  const root = temp(); let j = journalAt(root);
  j.reserve(op('prior'), 0); j.settle('prior', { validator: 'PASS', costUSD: 0.0001 });
  j.reserve(op('receipt'), 0); j.settle('receipt', { validator: 'PASS', costUSD: null, usage: { cost: 0.0002 } }); j.close();
  j = journalAt(root);
  assert.throws(() => j.reconcileReceipt('receipt', 0.0001), /cumulative-billing-mismatch/);
  j.reconcileReceipt('receipt', 0.0003); assert.equal(completed(j, op('receipt')).costUSD, 0.0002);
  assert.equal(j.summary().spentNanodollars, 300000); assert.equal(j.summary().requests, 2);
  assert.throws(() => j.reserve(op('receipt'), 0.0003), /already-sent/); j.close();
});

let pool;
test('production chunk/index/vector/search pipeline preserves pools and performs one query lookup', async () => {
  const chunks = data.docs.flatMap(d => new semantic.MarkdownChunker().chunk(d));
  const texts = [...new Set([...chunks.map(c => c.text), ...data.queries.map(q => q.query)])];
  const vectors = texts.map(t => Array.from({ length: 8 }, (_, i) => (parseInt(sha256(t).slice(i * 4, i * 4 + 4), 16) + 1) / 65536));
  const saved = await makePools(data, vectors, texts, temp(), semantic);
  assert.equal(saved.pools.length, 28);
  for (const p of saved.pools) {
    assert.equal(p.queryEmbeddingLookups, 1); assert.equal(p.baseline.length, 30);
    assert.deepEqual(p.prepared.map(x => x.document.path), p.baseline.map(x => x.path));
    assert(p.baseline.every((d, i) => i === 0 || d.score <= p.baseline[i - 1].score));
    assert(p.prepared.every(x => !/note-\d{3}/.test(x.text)));
  }
  pool = saved.pools[0];
});

test('production embedding serializer and validator: one batch, no secrets in receipt', async () => {
  const observe = {}, secret = 'FAKE_SENTINEL_ONLY'; let calls = 0;
  const vectors = await embeddingBatch({ texts: ['synthetic one', 'synthetic two'], key: secret, adapters: semantic, observe,
    send: async request => {
      calls++; assert.equal(request.headers.Authorization, 'Bearer ' + secret);
      assert.deepEqual(JSON.parse(request.body).input, ['synthetic one', 'synthetic two']);
      return { status: 200, text: JSON.stringify({ model: 'openai/text-embedding-3-small', data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }], usage: { cost: 0.00001, total_tokens: 4 }, extra: secret }) };
    } });
  assert.equal(calls, 1); assert.deepEqual(vectors, [[1, 0], [0, 1]]); assert(!JSON.stringify(observe).includes(secret));
  await assert.rejects(embeddingBatch({ texts: Array(65).fill('x'), key: secret, adapters: semantic, observe, send: () => assert.fail() }), /batch-limit/);
});

test('production rerank serialization, index mapping, scores and offline replay', async () => {
  assert(pool); const original = hashJSON(pool); let calls = 0, body;
  const provider = new adapters.OpenRouterRerankProvider(SETTINGS, async request => {
    calls++; assert.equal(request.url, ENDPOINT); body = request.body;
    assert.deepEqual(JSON.parse(body).documents, pool.prepared.map(p => p.text));
    assert.equal(JSON.parse(body).provider.allow_fallbacks, false);
    return { status: 200, text: JSON.stringify({ model: MODEL, results: pool.prepared.map((_, index) => ({ index, relevance_score: index / 30 })).reverse() }) };
  });
  const result = await refine(pool, provider, adapters);
  assert.equal(calls, 1); assert.equal(result.stage, 'reranked'); assert.equal(result.results.length, 10);
  assert.equal(result.results[0].path, pool.prepared[29].document.path);
  assert.equal(result.results[0].score, pool.prepared[29].document.score); assert.equal(result.results[0].rerankScore, 29 / 30);
  assert.deepEqual(result.stages, ['semantic', 'refining']); assert.equal(hashJSON(pool), original);
  const j = journalAt(temp()), operation = { ...op('rerank-a1'), caseId: 'A1', requestSha256: sha256(body) };
  j.reserve(operation, 0); j.settle(operation.id, { validator: 'PASS', resolvedModel: MODEL, costUSD: 0.0001, scores: pool.prepared.map((_, index) => ({ index, relevanceScore: index / 30 })).reverse() });
  const restored = await replay(pool, j, adapters); assert.deepEqual(restored.result.results, result.results);
  assert.equal(restored.result.fullOrder.length, 30); assert.equal(calls, 1); j.close();
  const quality = compare(pool, restored.result, data.judgments[0].documents);
  assert(quality.recall30 >= 0 && quality.recall30 <= 1);
});

test('invalid response and transport failure fall back once; no duplicate indices accepted', async () => {
  for (const bad of [true, false]) {
    let calls = 0;
    const provider = new adapters.OpenRouterRerankProvider(SETTINGS, async () => {
      calls++; if (!bad) throw Error('FAKE_SECRET_IN_UNTRUSTED_ERROR');
      return { status: 200, text: JSON.stringify({ model: MODEL, results: pool.prepared.map(() => ({ index: 0, relevance_score: 1 })) }) };
    });
    const result = await refine(pool, provider, adapters);
    assert.equal(calls, 1); assert.equal(result.stage, 'fallback'); assert.deepEqual(result.results, pool.baseline.slice(0, 10));
    assert(!JSON.stringify(result).includes('FAKE_SECRET'));
  }
});
