// Offline plan and actual production modules. Paid execution is a separate explicit native command.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { check } from './rerank-comparison-budget.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const STATE = '/home/zinvernix/.local/state/veynrel/rerank-smoke-v1';
export const KEY_FILE = '/home/zinvernix/.config/veynrel/openrouter-test.key';
export const SOURCE = '3890f74d7d4d057c92ec5bd9d7922db63e2fe3be';
export const BUILD = 'c8c2d4482a962b7f3e20793ae876501081fe58ce64b159b4d2212c207a9cf158';
export const MODELS = ['cohere/rerank-v3.5', 'voyageai/rerank-3-lite', 'qwen/qwen3-reranker-8b'];
export const ENDPOINT = 'https://openrouter.ai/api/v1/rerank';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const CASE_HASH = 'a6213ed3b33c26625ec537aafb910ed7d8cd86b238be3f27de97a5ddec714973';
export const smoke = { id: 'smoke', query: 'Which document explains retry backoff?', fragments: [
  { id: 'backoff', relevant: true, text: 'A retry with exponential backoff increases the delay between attempts.' },
  { id: 'database', relevant: false, text: 'A database index speeds up queries.' },
] };

export function frozenCases() {
  const bytes = fs.readFileSync(ROOT + 'docs/rerank-v1-evaluation.json');
  check(sha256(bytes) === CASE_HASH, 'frozen-cases-changed');
  // Frozen before any response: put the relevant fragment last for all models.
  return JSON.parse(bytes).cases.map(c => ({ ...c, fragments: [c.fragments[1], c.fragments[2], c.fragments[0]] }));
}
export const plan = () => ({ sourceCommit: SOURCE, buildSha256: BUILD, casesSha256: CASE_HASH,
  models: MODELS, cases: [smoke, ...frozenCases()], fixedPermutation: [1, 2, 0],
  plannedUSD: 0.02, ceilingUSD: 0.03, serverLimitUSD: 50,
  serverLimitAuthorization: 'User confirmed their intentionally selected $50 limit after preflight on 2026-10-10.',
  billing: 'Actual response/generation cost; otherwise reconciled key delta. Unknown is not zero. No retries.',
  reservePerRerankUSD: 0.002, reserveEmbeddingUSD: 0.001,
  semantic: { model: 'openai/text-embedding-3-small', rerankSelection: 'highest fixed-set MRR, then lowest observed cost, then latency',
    caseIds: frozenCases().map(c => c.id), maximumRerankModels: 1 },
});

export async function productionAdapters() {
  const result = await build({ stdin: { contents: [
    'export * from "./rerank/openRouterRerank";', 'export * from "./rerank/refinedSearch";',
    'export * from "./rerank/prepareCandidates";', 'export * from "./chunking/markdownChunker";',
  ].join('\n'), resolveDir: ROOT, sourcefile: 'rerank-comparison-entry.ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'offline-obsidian', setup(b) {
    b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'offline' }));
    b.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({ contents: 'export function requestUrl(){throw Error("offline-tripwire")}' }));
  } }] });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}

export function metrics(item, scores) {
  const order = [...scores].sort((a, b) => b.relevanceScore - a.relevanceScore || a.index - b.index).map(s => item.fragments[s.index].id);
  const relevantIds = item.fragments.filter(f => f.relevant).map(f => f.id);
  const positions = relevantIds.map(id => order.indexOf(id) + 1);
  const first = Math.min(...positions.filter(p => p > 0));
  return { relevantIds, order, positions, top1: first === 1, top3: first <= 3, reciprocalRank: Number.isFinite(first) ? 1 / first : 0 };
}

export function readKey() {
  const s = fs.lstatSync(KEY_FILE);
  check(s.isFile() && (s.mode & 0o077) === 0 && s.uid === process.getuid(), 'key-permissions');
  const key = fs.readFileSync(KEY_FILE, 'utf8').trim();
  check(/^[\x21-\x7e]+$/.test(key), 'key-format');
  return key;
}
export async function keyPreflight(key) {
  const response = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  check(response.status === 200, 'key-http');
  const { data } = await response.json();
  const result = { httpStatus: response.status, checkedAt: new Date().toISOString() };
  for (const field of ['limit', 'limit_remaining', 'usage']) result[field] = typeof data?.[field] === 'number' ? data[field] : null;
  result.expires_at = typeof data?.expires_at === 'string' && Number.isFinite(Date.parse(data.expires_at)) ? data.expires_at : null;
  result.resetIsDisabled = data?.limit_reset === null;
  check(result.limit > 0 && result.limit <= plan().serverLimitUSD && result.limit_remaining >= 0.002 &&
    result.usage >= 0 && result.expires_at && Date.parse(result.expires_at) > Date.now() && result.resetIsDisabled, 'key-budget-gate');
  return result;
}
