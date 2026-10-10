// Offline report assembly: saved synthetic pools + allowlisted journal receipts, never credential access.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check } from './rerank-comparison-budget.mjs';
import { ROOT, sha256 } from './rerank-comparison.mjs';
import { STATE, dataset, plan, hashJSON, readJSON, compare, aggregate } from './rerank-hard-v1.mjs';

export function report() {
  const data = dataset(), saved = readJSON(STATE + '/pools.json'), frozen = readJSON(STATE + '/pools-freeze.json');
  check(sha256(fs.readFileSync(STATE + '/pools.json')) === frozen.sha256 && saved.planSha256 === hashJSON(plan(data)), 'report-pools-changed');
  const [header, ...history] = fs.readFileSync(STATE + '/budget.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  check(header.fingerprint === hashJSON(plan(data)), 'report-plan-changed');
  const entries = [...new Map(history.map(r => [r.id, r])).values()];
  const results = saved.pools.map(pool => {
    const file = STATE + '/result-' + pool.id + '.json', completed = fs.existsSync(file) ? readJSON(file) : null;
    const operation = entries.find(e => e.id === 'rerank-' + pool.id.toLowerCase());
    return { id: pool.id, group: pool.group, query: pool.query, status: completed ? 'PASS' : operation ? 'BLOCKED' : 'NOT RUN',
      queryEmbeddingLookups: pool.queryEmbeddingLookups, baseline: pool.baseline,
      selectedFragments: pool.prepared.map(({ document, ...p }) => ({ path: document.path, ...p })),
      result: completed?.result ?? null, sentPaths: completed?.sentPaths ?? null,
      receipt: operation?.outcome ?? null, quality: compare(pool, completed?.result, data.judgments.find(j => j.id === pool.id).documents) };
  });
  const knownUSD = entries.filter(e => e.cost !== null).reduce((n, e) => n + e.cost, 0) / 1e9;
  const lastFile = STATE + '/final-key-snapshot.json';
  const finalSnapshot = fs.existsSync(lastFile) ? readJSON(lastFile) : null;
  const deltaUSD = finalSnapshot ? finalSnapshot.usage - header.baselineUsage : null;
  return { benchmark: 'Hard Rerank Benchmark v1', plan: plan(data), inputs: { ...data.manifest, poolsFreeze: frozen,
    inputFreezeCommit: '79732d6', vectorSha256: saved.vectorSha256, embeddingInputsSha256: saved.inputsSha256,
    chunkCount: saved.chunkCount, embeddingInputs: saved.embeddingInputs, dimensions: saved.dimensions, indexStats: saved.stats },
    sources: [
      { url: 'https://openrouter.ai/voyageai/rerank-3-lite', checkedOn: '2026-10-10', rateUSDPerToken: 0.00000002 },
      { url: 'https://openrouter.ai/openai/text-embedding-3-small', checkedOn: '2026-10-10', rateUSDPerToken: 0.00000002 },
      { url: 'https://openrouter.ai/docs/api/api-reference/rerank/create-rerank', checkedOn: '2026-10-10', contract: 'POST /api/v1/rerank; model + results[].index/relevance_score' },
    ],
    provenance: { corpus: 'Agent-authored synthetic data only', embeddings: 'Real OpenRouter embeddings, reused by production MarkdownChunker → IndexingService → LocalVectorStore → SemanticSearchService',
      rerank: 'Saved pools → production refinedSearch → installed production OpenRouterRerankProvider / Obsidian requestUrl',
      newNativeUI: 'NOT RUN; previous PR #73 is historical UI evidence', native: fs.existsSync(STATE + '/native.json') ? readJSON(STATE + '/native.json') : null,
      embeddingRunnerCommit: '79732d6',
      rerankRunnerSha256: Object.fromEntries(['scripts/rerank-hard-v1.mjs', 'scripts/rerank-hard-v1-native.mjs'].map(p => [p, sha256(fs.readFileSync(ROOT + p))])),
      filenameFallbackAbsent: results.every(r => r.selectedFragments.every(f => !/note-\d{3}/.test(f.text))) },
    accounting: { budgetJournalSha256: sha256(fs.readFileSync(STATE + '/budget.jsonl')), baselineKeyUsageUSD: header.baselineUsage,
      finalKeySnapshot: finalSnapshot, keyUsageDeltaUSD: deltaUSD, confirmedCostUSD: knownUSD,
      keyDeltaMatchesReceipts: deltaUSD === null ? null : Math.abs(deltaUSD - knownUSD) <= 1e-9,
      unresolvedReserveUSD: entries.filter(e => e.cost === null).reduce((n, e) => n + e.reserve, 0) / 1e9,
      embeddingCalls: entries.filter(e => e.model === plan(data).models[0]).length,
      embeddingCostUSD: entries.filter(e => e.model === plan(data).models[0] && e.cost !== null).reduce((n, e) => n + e.cost, 0) / 1e9,
      pauses: history.filter(e => e.state === 'settled' && e.cost === null).map(e => ({ id: e.id, statusAtPause: 'unknown cost; paid phase stopped',
        validator: e.outcome?.validator, reportedReceiptCostUSD: e.outcome?.usage?.cost ?? null, settledAt: e.finishedAt,
        resolvedBy: entries.find(r => r.id === e.id)?.state === 'reconciled' ? 'append-only cumulative receipt reconciliation; no retransmission' : null })),
      operations: entries },
    summary: aggregate(results), groups: Object.fromEntries([... 'ABCDEF'].map(g => [g, aggregate(results.filter(r => r.group === g))])), results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = report(); fs.writeFileSync(ROOT + 'docs/rerank-hard-benchmark-v1.json', JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ summary: output.summary, accounting: { costUSD: output.accounting.confirmedCostUSD,
    keyDeltaMatchesReceipts: output.accounting.keyDeltaMatchesReceipts }, groups: output.groups }, null, 2));
}
