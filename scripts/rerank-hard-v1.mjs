// Fixed experiment, opt-in paid phases; imports alone perform no network or credential access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetJournal, check, safeCode } from './rerank-comparison-budget.mjs';
import { ROOT, BUILD, sha256, readKey, keyPreflight } from './rerank-comparison.mjs';
import { semanticAdapters, EMBEDDING_MODEL } from './rerank-comparison-semantic.mjs';
import { reconcile } from './rerank-comparison-native.mjs';

export const STATE = '/home/zinvernix/.local/state/veynrel/rerank-hard-benchmark-v1';
export const FIXTURE = ROOT + 'tests/fixtures/rerank-hard-v1/';
export const MODEL = 'voyageai/rerank-3-lite';
export const SOURCE = '224d50f4862ee6be4edf8a69d36eb7729479c964';
export const SETTINGS = { enabled: true, provider: 'openrouter', model: MODEL, apiKey: 'memory-only-placeholder' };
export const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const hashJSON = value => sha256(JSON.stringify(value));

export function dataset() {
  const manifest = readJSON(FIXTURE + 'manifest.json');
  check(manifest.corpusSha256 === 'f8b81a9abcd34a0b873282711251a06fc7e4746391830987e368f8c6f2f186b2' &&
    manifest.queriesSha256 === 'd5bf8607d555e90c5f35bc406031ae629a9343f2b76021d80e2c1ef79838115b' &&
    manifest.judgmentsSha256 === '5caa3379fa87376eed752e79d423a10a43aed4a110c10389631e7fe72072f48e', 'fixture-plan-changed');
  const files = Object.fromEntries(fs.readdirSync(FIXTURE + 'vault').sort().map(name => {
    check(/^note-\d{3}\.md$/.test(name), 'fixture-filename');
    return ['vault/' + name, sha256(fs.readFileSync(FIXTURE + 'vault/' + name))];
  }));
  check(hashJSON(files) === manifest.corpusSha256 && hashJSON(files) === hashJSON(manifest.files), 'corpus-changed');
  for (const kind of ['queries', 'judgments']) check(sha256(fs.readFileSync(FIXTURE + kind + '.json')) === manifest[kind + 'Sha256'], 'labels-changed');
  const queries = readJSON(FIXTURE + 'queries.json'), judgments = readJSON(FIXTURE + 'judgments.json');
  const docs = Object.keys(files).map(p => ({ path: p.slice(6), content: fs.readFileSync(FIXTURE + p, 'utf8') }));
  check(docs.length === 64 && queries.length === 28 && new Set(queries.map(q => q.id)).size === 28 && judgments.length === 28, 'dataset-counts');
  for (const group of 'ABCDEFN') check(queries.filter(q => q.group === group).length === 4, 'group-counts');
  for (const q of queries) {
    const j = judgments.filter(j => j.id === q.id);
    check(j.length === 1 && j[0].documents.length === docs.length && new Set(j[0].documents.map(d => d.path)).size === docs.length, 'judgment-coverage');
    check(j[0].documents.every(d => Number.isInteger(d.grade) && d.grade >= 0 && d.grade <= 3 && d.reason &&
      docs.some(n => n.path === d.path && (d.grade === 0 || typeof d.answerAnchor === 'string' && n.content.includes(d.answerAnchor)))), 'judgment-content');
    check(q.group === 'N' ? j[0].documents.every(d => d.grade === 0) : j[0].documents.some(d => d.grade === 3), 'judgment-positive');
  }
  return { manifest, queries, judgments, docs };
}

export function plan(data = dataset()) {
  return { sourceCommit: SOURCE, buildSha256: BUILD, corpusSha256: data.manifest.corpusSha256,
    queriesSha256: data.manifest.queriesSha256, judgmentsSha256: data.manifest.judgmentsSha256,
    models: [EMBEDDING_MODEL, MODEL], caseIds: data.queries.map(q => q.id), metrics: data.manifest.metrics,
    plannedUSD: 0.02, ceilingUSD: 0.03, serverLimitUSD: 50, tariffDate: '2026-10-10',
    ratesUSDPerToken: { [EMBEDDING_MODEL]: 0.00000002, [MODEL]: 0.00000002 },
    billing: 'Sequential, no retries. Receipt or reconciled cumulative key usage; unknown stops. One fixed journal. Reserves are local allowances, not proven HTTP maximum prices.',
    reserveNanodollars: 1_000_000, embeddingBatchSize: 64, retrievalLimit: 30, finalK: 10 };
}

// Immutable artifacts: a crash leaves either a complete file or a fail-closed mismatch, never a reason to re-pay.
export function freeze(file, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file)) { check(fs.readFileSync(file, 'utf8') === bytes, 'artifact-changed'); return; }
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const dir = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}

export function completed(journal, op) {
  const row = journal.entries.get(op.id);
  if (!row) return null;
  check(row.requestSha256 === op.requestSha256 && row.model === op.model && row.caseId === op.caseId, 'operation-changed');
  check(['settled', 'reconciled'].includes(row.state) && row.cost !== null && row.cost <= row.reserve && row.outcome.validator === 'PASS' && !row.outcome.error, 'reconciliation-required');
  return row.outcome;
}

export function measure(order, judgments) {
  check(new Set(order).size === order.length, 'duplicate-ranked-document');
  const grade = new Map(judgments.map(j => [j.path, j.grade]));
  check(order.every(p => grade.has(p)), 'unknown-ranked-document');
  const dcg = values => values.slice(0, 10).reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(judgments.map(j => j.grade).sort((a, b) => b - a));
  const index = order.slice(0, 10).findIndex(p => grade.get(p) >= 2);
  return { firstRelevantRank: index < 0 ? null : index + 1, hit1: Number(index === 0), hit3: Number(index >= 0 && index < 3),
    mrr10: index < 0 ? 0 : 1 / (index + 1), ndcg10: ideal ? dcg(order.map(p => grade.get(p))) / ideal : null };
}

export function compare(pool, result, judgments) {
  const beforeOrder = pool.baseline.map(d => d.path), afterOrder = result?.results.map(d => d.path) ?? [];
  const before = measure(beforeOrder, judgments), after = result ? measure(afterOrder, judgments) : null;
  const relevant = judgments.filter(j => j.grade >= 2);
  const delta = after?.ndcg10 === null || !after ? null : after.ndcg10 - before.ndcg10;
  return { before, after, deltaNdcg10: delta, change: delta === null ? 'NOT EVALUATED' : Math.abs(delta) <= 1e-9 ? 'Unchanged' : delta > 0 ? 'Improved' : 'Regressed',
    recall30: relevant.length ? relevant.filter(j => beforeOrder.includes(j.path)).length / relevant.length : null,
    relevantInPool: relevant.filter(j => beforeOrder.includes(j.path)).length, relevantTotal: relevant.length,
    positiveDocuments: judgments.filter(j => j.grade > 0).map(j => {
      const selected = pool.prepared.find(p => p.document.path === j.path);
      const position = order => order.includes(j.path) ? order.indexOf(j.path) + 1 : null;
      return { ...j, poolRank: position(beforeOrder), beforeTop10: position(beforeOrder.slice(0, 10)), afterTop10: position(afterOrder),
        afterPoolRank: result?.fullOrder ? position(result.fullOrder) : null,
        rankDeltaTop10: position(afterOrder) && position(beforeOrder.slice(0, 10)) ? position(beforeOrder) - position(afterOrder) : null,
        selectedChunkId: selected?.chunkId ?? null, selectedFragmentContainsAnchor: selected ? selected.text.includes(j.answerAnchor) : null };
    }) };
}

export function aggregate(rows) {
  const positive = rows.filter(r => r.group !== 'N'), paired = positive.filter(r => r.result?.stage === 'reranked');
  const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const allLatency = rows.filter(r => r.receipt?.validator === 'PASS').map(r => r.receipt.latencyMs).sort((a, b) => a - b);
  const metric = side => Object.fromEntries(['hit1', 'hit3', 'mrr10', 'ndcg10'].map(k => [k, mean(paired.map(r => r.quality[side][k]))]));
  const costs = rows.filter(r => r.receipt?.costUSD !== null && r.receipt?.costUSD !== undefined).map(r => r.receipt.costUSD);
  return { positiveCount: positive.length, pairedCount: paired.length, baselineAll: Object.fromEntries(['hit1', 'hit3', 'mrr10', 'ndcg10'].map(k => [k, mean(positive.map(r => r.quality.before[k]))])),
    before: metric('before'), after: metric('after'), meanDeltaNdcg10: mean(paired.map(r => r.quality.deltaNdcg10)),
    changes: Object.fromEntries(['Improved', 'Unchanged', 'Regressed'].map(c => [c, paired.filter(r => r.quality.change === c).length])),
    meanRecall30: mean(positive.map(r => r.quality.recall30)),
    latencyMs: { count: allLatency.length, mean: mean(allLatency), median: allLatency.length ? (allLatency[Math.floor((allLatency.length - 1) / 2)] + allLatency[Math.floor(allLatency.length / 2)]) / 2 : null,
      p95: allLatency.length ? allLatency[Math.ceil(allLatency.length * 0.95) - 1] : null },
    knownRerankCostUSD: costs.reduce((a, b) => a + b, 0), knownCostPerRequestUSD: mean(costs), knownCostCount: costs.length };
}

export async function makePools(data, vectors, texts, root, adapters) {
  const cached = new Map(texts.map((t, i) => [t, new Float32Array(vectors[i])])), lookups = {};
  const provider = { id: 'openrouter', model: EMBEDDING_MODEL, dimensions: async () => vectors[0].length,
    embed: async inputs => inputs.map(t => {
      check(cached.has(t), 'uncached-embedding'); lookups[t] = (lookups[t] ?? 0) + 1; return new Float32Array(cached.get(t));
    }) };
  fs.mkdirSync(root, { recursive: true });
  const disk = p => { check(!p.includes('..') && !path.isAbsolute(p), 'index-path'); return path.join(root, p); };
  const persistence = { exists: async p => fs.existsSync(disk(p)), readText: async p => fs.readFileSync(disk(p), 'utf8'),
    readBinary: async p => Uint8Array.from(fs.readFileSync(disk(p))).buffer,
    writeText: async (p, v) => fs.writeFileSync(disk(p), v), writeBinary: async (p, v) => fs.writeFileSync(disk(p), Buffer.from(v)),
    createDirectory: async p => fs.mkdirSync(disk(p), { recursive: true }), remove: async p => fs.unlinkSync(disk(p)), rename: async (a, b) => fs.renameSync(disk(a), disk(b)) };
  const chunker = new adapters.MarkdownChunker(); let store;
  const indexing = new adapters.IndexingService({ chunker, embeddingProvider: provider,
    embeddingSpace: { providerId: 'openrouter', model: EMBEDDING_MODEL, baseUrl: 'https://openrouter.ai/api/v1' },
    vectorStoreFactory: options => (store = new adapters.LocalVectorStore({ ...options, persistence, basePath: '.index' })) });
  await indexing.initialize(); await indexing.reconcileAll(data.docs, { retryTransient: false });
  const service = new adapters.SemanticSearchService(provider, store, vectors[0].length);
  const source = { readPaths: async paths => ({ documents: data.docs.filter(d => paths.includes(d.path)), missingPaths: [] }) };
  const pools = [];
  for (const q of data.queries) {
    const baseline = await service.search(q.query, { limit: 30, matchesPerDocument: 3 });
    const prepared = await adapters.prepareRerankCandidates(baseline, source, chunker, () => true);
    check(lookups[q.query] === 1 && baseline.length <= 30 && prepared.every(p => !/note-\d{3}/.test(p.text)), 'pool-invariant');
    pools.push({ ...q, baseline, prepared, queryEmbeddingLookups: lookups[q.query] });
  }
  return { dimensions: vectors[0].length, stats: indexing.getStats(), pools };
}

// Run the exact refinement orchestration once over the saved pool; no embedding provider is called here.
export async function refine(pool, provider, adapters) {
  const stages = [];
  const result = await adapters.refinedSearch({ query: pool.query, settings: SETTINGS, signal: new AbortController().signal,
    search: async limit => { check(limit === 30, 'candidate-limit'); return pool.baseline; }, prepare: async () => pool.prepared,
    allowed: () => true, isCurrent: () => true, provider, publish: update => stages.push(update.stage) });
  check(result.results.every(r => r.score === pool.baseline.find(b => b.path === r.path)?.score), 'semantic-score-changed');
  return { ...result, stages };
}

export async function replay(pool, journal, adapters) {
  let receipt, sent;
  const result = await refine(pool, { rank: async (query, documents) => {
    const op = { id: 'rerank-' + pool.id.toLowerCase(), caseId: pool.id, model: MODEL,
      requestSha256: sha256(adapters.rerankBody(MODEL, query, documents)) };
    receipt = completed(journal, op); check(receipt, 'receipt-missing');
    sent = documents.map(text => {
      const matches = pool.prepared.filter(p => p.text === text); check(matches.length === 1, 'ambiguous-fragment'); return matches[0];
    });
    return adapters.validateRerankResponse({ model: receipt.resolvedModel, results: receipt.scores.map(s => ({ index: s.index, relevance_score: s.relevanceScore })) }, documents.length);
  } }, adapters);
  check(result.stage === 'reranked' && receipt, 'replay-failed');
  const order = [...receipt.scores].sort((a, b) => b.relevanceScore - a.relevanceScore || sent[a.index].originalOrder - sent[b.index].originalOrder).map(s => sent[s.index].document.path);
  result.fullOrder = [...order, ...pool.baseline.map(d => d.path).filter(p => !order.includes(p))];
  return { result, sentPaths: sent.map(p => p.document.path), receiptId: 'rerank-' + pool.id.toLowerCase() };
}

export async function embeddingBatch({ texts, key, adapters, send, observe }) {
  check(texts.length > 0 && texts.length <= 64, 'embedding-batch-limit');
  const body = JSON.stringify({ model: EMBEDDING_MODEL, input: texts, encoding_format: 'float' });
  let calls = 0;
  globalThis.__comparisonEmbeddingTransport = async request => {
    check(++calls === 1 && request.url === 'https://openrouter.ai/api/v1/embeddings' && request.body === body, 'embedding-one-shot-guard');
    observe.dispatched = true;
    const response = await send(request), text = response.text;
    observe.httpStatus = response.status;
    try {
      const p = JSON.parse(text); observe.usage = {};
      for (const field of ['cost', 'total_tokens', 'prompt_tokens']) if (typeof p.usage?.[field] === 'number' && Number.isFinite(p.usage[field]) && p.usage[field] >= 0) observe.usage[field] = p.usage[field];
      observe.generationId = typeof p.id === 'string' && /^gen-[A-Za-z0-9-]{1,160}$/.test(p.id) ? p.id : null;
    } catch { /* Production validator owns malformed responses. */ }
    return response;
  };
  try {
    const provider = new adapters.OpenAICompatibleEmbeddingProvider({ provider: 'openrouter', model: EMBEDDING_MODEL, baseUrl: 'https://openrouter.ai/api/v1', apiKey: key });
    return (await provider.embed(texts, { timeoutMs: 25000 })).map(v => [...v]);
  } finally { delete globalThis.__comparisonEmbeddingTransport; }
}

export async function embedAndRetrieve(journal, data, key) {
  const adapters = await semanticAdapters(), chunks = data.docs.flatMap(d => new adapters.MarkdownChunker().chunk(d));
  const texts = [...new Set([...chunks.map(c => c.text), ...data.queries.map(q => q.query)])], vectors = [];
  for (let offset = 0; offset < texts.length; offset += 64) {
    const batch = texts.slice(offset, offset + 64), body = JSON.stringify({ model: EMBEDDING_MODEL, input: batch, encoding_format: 'float' });
    const op = { id: `embedding-${offset / 64}`, caseId: `batch-${offset / 64}`, model: EMBEDDING_MODEL, requestSha256: sha256(body), reserve: 1_000_000 };
    const cachePath = STATE + '/' + op.id + '.json';
    let receipt = completed(journal, op);
    if (!receipt) {
      const before = await keyPreflight(key); journal.reserve(op, before.usage);
      const observation = {}, start = performance.now();
      try {
        const output = await embeddingBatch({ texts: batch, key, adapters, observe: observation, send: async request => {
          const r = await fetch(request.url, { method: 'POST', headers: { ...request.headers, 'Content-Type': request.contentType }, body: request.body, signal: AbortSignal.timeout(25000), redirect: 'error' });
          return { status: r.status, text: await r.text() };
        } });
        observation.validator = 'PASS'; observation.vectorSha256 = hashJSON(output);
        freeze(cachePath, { requestSha256: op.requestSha256, vectors: output });
      } catch (error) { observation.validator = 'FAIL'; observation.error = safeCode(error); }
      observation.latencyMs = Math.round(performance.now() - start);
      receipt = await settle(journal, key, before, op, observation);
    }
    check(fs.existsSync(cachePath), 'paid-cache-missing');
    const cache = readJSON(cachePath);
    check(cache.requestSha256 === op.requestSha256 && hashJSON(cache.vectors) === receipt.vectorSha256, 'embedding-cache-changed');
    vectors.push(...cache.vectors);
  }
  const poolPath = STATE + '/pools.json';
  if (fs.existsSync(poolPath)) { loadPools(journal, data); return; }
  const output = { planSha256: hashJSON(plan(data)), vectorSha256: hashJSON(vectors), inputsSha256: hashJSON(texts),
    noteCount: data.docs.length, chunkCount: chunks.length, embeddingInputs: texts.length,
    ...await makePools(data, vectors, texts, STATE + '/index', adapters) };
  freeze(poolPath, output); freeze(STATE + '/pools-freeze.json', { sha256: sha256(fs.readFileSync(poolPath)), frozenAt: new Date().toISOString() });
  console.log(JSON.stringify({ frozenPools: output.pools.length, notes: output.noteCount, chunks: output.chunkCount, embeddingInputs: texts.length }));
}

export function loadPools(journal, data = dataset()) {
  const file = STATE + '/pools.json', pools = readJSON(file), frozen = readJSON(STATE + '/pools-freeze.json');
  check(sha256(fs.readFileSync(file)) === frozen.sha256 && pools.planSha256 === hashJSON(plan(data)), 'pools-changed');
  check(pools.pools.length === 28 && pools.pools.every((p, i) => p.id === data.queries[i].id && p.query === data.queries[i].query && p.queryEmbeddingLookups === 1), 'pool-queries-changed');
  check([...journal.entries.values()].filter(e => e.model === EMBEDDING_MODEL).every(e => e.cost !== null && e.outcome.validator === 'PASS'), 'embedding-incomplete');
  return pools;
}

export async function settle(journal, key, before, op, observation) {
  let receipt;
  try { receipt = await reconcile(key, before, observation, false, { baselineUsage: journal.header.baselineUsage, knownCostUSD: journal.summary().spentNanodollars / 1e9 }); }
  catch { receipt = { ...observation, costUSD: null, costBasis: 'unknown' }; }
  journal.settle(op.id, receipt);
  console.log(JSON.stringify({ id: op.id, validator: receipt.validator, latencyMs: receipt.latencyMs, usage: receipt.usage, costUSD: receipt.costUSD }));
  completed(journal, op); return receipt;
}

export async function live(phase) {
  check(['embeddings', 'rerank'].includes(phase), 'phase');
  const data = dataset();
  check(sha256(fs.readFileSync(ROOT + 'main.js')) === BUILD, 'build-changed');
  check(new Date().toISOString().slice(0, 10) === plan(data).tariffDate, 'recheck-tariffs');
  const key = readKey(), initial = await keyPreflight(key);
  const journal = new BudgetJournal(STATE, hashJSON(plan(data)), initial.usage);
  const previousWindow = globalThis.window; globalThis.window = globalThis;
  try {
    if (phase === 'embeddings') await embedAndRetrieve(journal, data, key);
    else await (await import('./rerank-hard-v1-native.mjs')).rankPools(journal, data, key);
    const after = await keyPreflight(key);
    const snapshotPath = STATE + `/snapshot-${phase}-${journal.summary().requests}.json`;
    if (!fs.existsSync(snapshotPath)) freeze(snapshotPath, after);
    console.log(JSON.stringify({ phase, ...journal.summary(), keyUsageUSD: after.usage }));
  } finally { journal.close(); globalThis.window = previousWindow; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--live') await live(process.argv[3]).catch(() => { console.error('STOPPED: inspect sanitized journal; no automatic retry.'); process.exitCode = 1; });
  else { const data = dataset(); console.log(JSON.stringify({ plan: plan(data), notes: data.docs.length, queries: data.queries.length })); }
}
