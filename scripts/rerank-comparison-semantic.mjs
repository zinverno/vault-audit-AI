// One optional paid embedding batch; Veynrel's production index/search then uses those cached real vectors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { BudgetJournal, check, safeCode } from './rerank-comparison-budget.mjs';
import { ROOT, STATE, BUILD, MODELS, sha256, frozenCases, plan, readKey, keyPreflight } from './rerank-comparison.mjs';
import { reconcile } from './rerank-comparison-native.mjs';

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export async function semanticAdapters() {
  const result = await build({ stdin: { resolveDir: ROOT, sourcefile: 'comparison-semantic-entry.ts', contents: [
    'export * from "./chunking/markdownChunker";', 'export * from "./indexing/indexingService";',
    'export * from "./vectorStore/localVectorStore";', 'export * from "./semantic/semanticSearchService";',
    'export * from "./rerank/prepareCandidates";', 'export * from "./embeddings/providers";',
  ].join('\n') }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'embedding-transport', setup(b) {
    b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'bridge' }));
    b.onLoad({ filter: /.*/, namespace: 'bridge' }, () => ({ contents:
      'export const getLanguage=()=>"en"; export const requestUrl=r=>globalThis.__comparisonEmbeddingTransport(r);' }));
  } }] });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}

export function documentsForCases(cases) {
  return cases.flatMap(c => c.fragments.map(f => ({ id: f.id, path: `Synthetic-${f.id}.md`, content: f.text })));
}

// Real file-backed production vector index, restricted to the experiment's synthetic vault.
export async function buildPools(root, vectors, texts, a) {
  fs.mkdirSync(root, { recursive: true });
  const cases = frozenCases(), docs = documentsForCases(cases), chunker = new a.MarkdownChunker();
  const cached = new Map(texts.map((text, i) => [text, new Float32Array(vectors[i])]));
  const queryLookups = {};
  const provider = { id: 'openrouter', model: EMBEDDING_MODEL, dimensions: async () => vectors[0].length,
    embed: async inputs => inputs.map(t => {
      check(cached.has(t), 'uncached-embedding-input');
      if (cases.some(c => c.query === t)) queryLookups[t] = (queryLookups[t] ?? 0) + 1;
      return new Float32Array(cached.get(t));
    }) };
  const disk = p => { check(!p.includes('..') && !path.isAbsolute(p), 'index-path'); return path.join(root, p); };
  const persistence = {
    exists: async p => fs.existsSync(disk(p)), readText: async p => fs.readFileSync(disk(p), 'utf8'),
    readBinary: async p => Uint8Array.from(fs.readFileSync(disk(p))).buffer,
    writeText: async (p, data) => fs.writeFileSync(disk(p), data),
    writeBinary: async (p, data) => fs.writeFileSync(disk(p), Buffer.from(data)),
    createDirectory: async p => { fs.mkdirSync(disk(p), { recursive: true }); },
    remove: async p => fs.unlinkSync(disk(p)), rename: async (from, to) => fs.renameSync(disk(from), disk(to)),
  };
  let store;
  const indexing = new a.IndexingService({ chunker, embeddingProvider: provider,
    embeddingSpace: { providerId: 'openrouter', model: EMBEDDING_MODEL, baseUrl: 'https://openrouter.ai/api/v1' },
    vectorStoreFactory: options => (store = new a.LocalVectorStore({ ...options, persistence, basePath: '.synthetic-index' })) });
  docs.forEach(d => fs.writeFileSync(disk(d.path), d.content));
  await indexing.initialize(); await indexing.reconcileAll(docs, { retryTransient: false });
  const service = new a.SemanticSearchService(provider, store, vectors[0].length);
  const source = { readPaths: async paths => ({ documents: docs.filter(d => paths.includes(d.path)), missingPaths: [] }) };
  const pools = [];
  for (const c of cases) {
    const candidates = await service.search(c.query, { limit: 30, matchesPerDocument: 3 });
    const prepared = await a.prepareRerankCandidates(candidates, source, chunker, () => true);
    const relevant = c.fragments.filter(f => f.relevant).map(f => f.id);
    pools.push({ id: c.id, query: c.query, relevantIds: relevant, queryEmbeddingLookups: queryLookups[c.query],
      baseline: candidates.map(d => ({ id: docs.find(f => f.path === d.path).id, ...d })),
      fragments: prepared.map(p => ({ id: docs.find(f => f.path === p.document.path).id,
        relevant: relevant.includes(docs.find(f => f.path === p.document.path).id), text: p.text })) });
  }
  return { embeddingModel: EMBEDDING_MODEL, dimensions: vectors[0].length, indexStats: indexing.getStats(),
    retrieval: 'Production MarkdownChunker + IndexingService + LocalVectorStore + SemanticSearchService + prepareRerankCandidates; cached real embeddings.',
    pools };
}

export function chooseModel(entries) {
  const complete = MODELS.map((model, index) => {
    const results = entries.filter(e => e.id.startsWith(`fixed-${index}-`) && e.outcome?.validator === 'PASS' && e.cost !== null);
    return { model, index, count: results.length,
      mrr: results.reduce((n, e) => n + e.outcome.quality.reciprocalRank, 0) / 4,
      cost: results.reduce((n, e) => n + e.cost, 0), latency: results.reduce((n, e) => n + e.outcome.latencyMs, 0) };
  }).filter(r => r.count === 4).sort((a, b) => b.mrr - a.mrr || a.cost - b.cost || a.latency - b.latency);
  check(complete.length, 'no-complete-model'); return complete[0];
}

export async function runSemantic() {
  check(sha256(fs.readFileSync(ROOT + 'main.js')) === BUILD, 'build-mismatch');
  const key = readKey(), before = await keyPreflight(key);
  const journal = new BudgetJournal(STATE, sha256(JSON.stringify(plan())), before.usage);
  const a = await semanticAdapters(), previousWindow = globalThis.window;
  globalThis.window = globalThis;
  try {
    const selected = chooseModel([...journal.entries.values()]);
    const docs = documentsForCases(frozenCases()), chunker = new a.MarkdownChunker();
    const texts = [...docs.flatMap(d => chunker.chunk(d).map(c => c.text)), ...frozenCases().map(c => c.query)];
    check(texts.length === 16 && texts.every(t => t.length < 500), 'bounded-embedding-input');
    const body = JSON.stringify({ model: EMBEDDING_MODEL, input: texts, encoding_format: 'float' });
    const op = { id: 'embedding-real-v1', model: EMBEDDING_MODEL, caseId: 'semantic-all', reserve: 1_000_000, requestSha256: sha256(body) };
    const cachePath = STATE + '/real-embeddings.json';
    let vectors;
    const prior = journal.entries.get(op.id);
    if (prior) {
      check(['settled', 'reconciled'].includes(prior.state) && prior.cost !== null && prior.outcome.validator === 'PASS' && fs.existsSync(cachePath), 'embedding-reconciliation-required');
      const cache = JSON.parse(fs.readFileSync(cachePath));
      check(cache.requestSha256 === op.requestSha256 && sha256(JSON.stringify(cache.vectors)) === prior.outcome.vectorSha256, 'embedding-cache-mismatch');
      vectors = cache.vectors;
    } else {
      check(new Date().toISOString().slice(0, 10) === '2026-10-10', 'tariffs-need-recheck');
      journal.reserve(op, before.usage);
      let observation = {}, calls = 0;
      globalThis.__comparisonEmbeddingTransport = async request => {
        check(++calls === 1 && request.url === 'https://openrouter.ai/api/v1/embeddings' && request.body === body, 'embedding-one-shot-guard');
        observation.dispatched = true;
        const response = await fetch(request.url, { method: 'POST', headers: { ...request.headers, 'Content-Type': request.contentType },
          body: request.body, signal: AbortSignal.timeout(25000), redirect: 'error' });
        const text = await response.text(); observation.httpStatus = response.status;
        try {
          const p = JSON.parse(text); observation.usage = {};
          for (const f of ['cost', 'total_tokens', 'prompt_tokens']) if (typeof p.usage?.[f] === 'number' && Number.isFinite(p.usage[f]) && p.usage[f] >= 0) observation.usage[f] = p.usage[f];
          observation.generationId = typeof p.id === 'string' && /^gen-[A-Za-z0-9-]{1,160}$/.test(p.id) ? p.id : null;
        } catch { /* Production parser classifies the response. */ }
        return { status: response.status, text };
      };
      const start = performance.now();
      try {
        const provider = new a.OpenAICompatibleEmbeddingProvider({ provider: 'openrouter', model: EMBEDDING_MODEL,
          baseUrl: 'https://openrouter.ai/api/v1', apiKey: key });
        vectors = (await provider.embed(texts, { timeoutMs: 25000 })).map(v => [...v]);
        observation.validator = 'PASS'; observation.vectorSha256 = sha256(JSON.stringify(vectors));
        fs.writeFileSync(cachePath, JSON.stringify({ requestSha256: op.requestSha256, vectors }), { flag: 'wx', mode: 0o600 });
      } catch (error) { observation.error = safeCode(error); observation.validator = 'FAIL'; }
      observation.latencyMs = Math.round(performance.now() - start);
      try { observation = await reconcile(key, before, observation, false,
        { baselineUsage: journal.header.baselineUsage, knownCostUSD: journal.summary().spentNanodollars / 1e9 }); }
      catch { observation.costUSD = null; observation.costBasis = 'unknown'; }
      journal.settle(op.id, observation);
      console.log(JSON.stringify({ id: op.id, validator: observation.validator, usage: observation.usage, costUSD: observation.costUSD, latencyMs: observation.latencyMs }));
      check(journal.entries.get(op.id).cost !== null && journal.entries.get(op.id).cost <= op.reserve && observation.validator === 'PASS', 'embedding-reconciliation-required');
    }
    const pools = await buildPools(STATE + '/synthetic-vault', vectors, texts, a);
    const output = { ...pools, selectedModel: selected, embeddingRequestSha256: op.requestSha256,
      vectorSha256: sha256(JSON.stringify(vectors)), casesSha256: plan().casesSha256 };
    const destination = STATE + '/semantic-pools.json';
    if (fs.existsSync(destination)) check(JSON.parse(fs.readFileSync(destination)).vectorSha256 === output.vectorSha256, 'pool-cache-mismatch');
    fs.writeFileSync(destination, JSON.stringify(output, null, 2));
    console.log(JSON.stringify({ selected, pools: output.pools.map(p => ({ id: p.id, before: p.baseline.map(r => r.id), queryEmbeddingLookups: p.queryEmbeddingLookups })) }));
  } finally { journal.close(); globalThis.window = previousWindow; delete globalThis.__comparisonEmbeddingTransport; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--live') { console.error('Explicit --live required.'); process.exitCode = 1; }
  else await runSemantic().catch(error => { console.error(JSON.stringify({ stopped: true, code: safeCode(error) })); process.exitCode = 1; });
}
