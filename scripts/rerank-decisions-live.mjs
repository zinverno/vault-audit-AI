// Offline preflight for the blocked live evaluation. --live fails closed; see the report.
// No HTTP implementation here: paid/native execution must wait for a defensible billing bound.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SOURCE_COMMIT = '6a405e2e7d90be41f722e2a80995628ce56ad83c';
export const CASE_FILE = 'docs/rerank-decisions-live-cases-v1.json';
export const CASE_SHA256 = '6c3a1ac4c540add14e64e821fff8c49ce82a7ef6a3f375fb0cee25701b590906';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const MODELS = { rerank: 'cohere/rerank-v3.5', decisions: 'typesafe/jev-1.13' };
export const ENDPOINTS = { rerank: 'https://openrouter.ai/api/v1/rerank', decisions: 'https://openrouter.ai/api/alpha/decisions' };

export async function frozenCases() {
  const bytes = await fs.readFile(path.join(ROOT, CASE_FILE));
  if (sha256(bytes) !== CASE_SHA256) throw Error('frozen-cases-changed');
  const cases = JSON.parse(bytes);
  const expected = { ...cases.sources, 'decisions/types.ts': cases.criteriaSourceSha256,
    'decisions/openRouterDecisions.ts': cases.decisionsAdapterSha256,
    'rerank/openRouterRerank.ts': cases.rerankAdapterSha256 };
  for (const [file, hash] of Object.entries(expected)) {
    if (sha256(await fs.readFile(path.join(ROOT, file))) !== hash) throw Error('frozen-source-changed');
  }
  return cases;
}

// Bundle actual production serializers/adapters/validators; the default transport is a tripwire.
// The injected fake in the free check is the only transport used by this preflight.
export async function productionAdapters() {
  const result = await build({ stdin: { contents:
    'export * from "./rerank/openRouterRerank"; export * from "./decisions/openRouterDecisions";',
    resolveDir: ROOT, sourcefile: 'evaluation-entry.ts' }, bundle: true, write: false, format: 'esm',
    platform: 'node', logLevel: 'silent', plugins: [{ name: 'offline-obsidian', setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'offline' }));
      builder.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({ contents:
        'export function requestUrl(){throw new Error("offline-transport-tripwire")}' }));
    } }] });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}

export async function preflight({ live = false } = {}) {
  const cases = await frozenCases();
  const adapters = await productionAdapters();
  const entries = [];
  for (const item of cases.rerank) {
    const body = adapters.rerankBody(MODELS.rerank, item.query, item.fragments.map(f => f.text));
    entries.push({ caseId: item.id, capability: 'rerank', endpoint: ENDPOINTS.rerank, model: MODELS.rerank,
      requestSha256: sha256(body), payloadBytes: Buffer.byteLength(body),
      relevantIds: item.fragments.filter(f => f.relevant).map(f => f.id),
      status: 'NOT RUN', candidateContainsRelevant: true, candidateOrigin: 'fixed-manual-set',
      afterOrder: null, firstRelevantAfter: null, top1: null, top3: null,
      semanticBefore: null, semanticAfter: null, semanticChange: 'NOT EVALUATED',
      latencyMs: null, usage: null, costUSD: null });
  }
  for (const item of cases.decisions) {
    const body = adapters.decisionsBody(MODELS.decisions, item);
    entries.push({ caseId: item.id, capability: 'decisions', endpoint: ENDPOINTS.decisions, model: MODELS.decisions,
      requestSha256: sha256(body), payloadBytes: Buffer.byteLength(body),
      expected: item.manualExpected, alternatives: item.manualAlternatives,
      status: 'NOT RUN', choice: null, probabilities: null, confidence: null, tied: null,
      resolvedModel: null, correspondence: null, latencyMs: null, usage: null, costUSD: null });
  }
  const keyPresent = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const blockers = [...(keyPresent ? [] : ['missing credential']), 'unverified OpenRouter billing upper bound'];
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), mode: live ? 'live-preflight-refused' : 'dry-run',
    sourceCommit: SOURCE_COMMIT, checkoutCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    buildSha256: sha256(await fs.readFile(path.join(ROOT, 'main.js'))),
    stylesSha256: sha256(await fs.readFile(path.join(ROOT, 'styles.css'))),
    environment: { platform: process.platform, arch: process.arch, node: process.version,
      nativeVersion: null, nativePlatform: 'NOT RUN' },
    cases: { file: CASE_FILE, sha256: CASE_SHA256, criteriaVersion: cases.criteriaVersion,
      sources: cases.sources, criteriaSourceSha256: cases.criteriaSourceSha256,
      decisionsAdapterSha256: cases.decisionsAdapterSha256, rerankAdapterSha256: cases.rerankAdapterSha256 },
    blockers, liveAdapter: 'BLOCKED', nativeLive: 'BLOCKED', semanticQuality: 'NOT EVALUATED',
    pricing: { checkedOn: '2026-10-07', rerankUSDPerSearchUnit: 0.001, decisionsUSDPerMillionInputTokens: 0.042,
      decisionsUSDPerMillionOutputTokens: 0,
      sources: ['https://openrouter.ai/cohere/rerank-v3.5', 'https://openrouter.ai/typesafe/jev-1.13',
        'https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request',
        'https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request',
        'https://cohere.com/pricing', 'https://docs.cohere.com/v1/reference/rerank', 'https://docs.typesafe.ai/models'],
      verifiedUpperBoundUSD: null, conditionalPlanningEnvelopeUSD: 0.07376,
      assumptions: ['5 rerank calls reserving 4 search units each (0.020 USD total); OpenRouter upstream chunk cap not established.',
        '20 Decisions calls reserving 64000 input tokens each, including state, criteria and service context (0.05376 USD total); no output charge.',
        'No connection probes, remote embeddings, retries, or additional experiments. Recheck rules before live execution.'] },
    budget: { authorizedUSD: 0.10, planningCeilingUSD: 0.08, untouchedMarginUSD: 0.02, maximumRequests: 32,
      planned: { rerankFixed: 4, rerankNative: 1, decisions: 20, nativeDecisionsReusesFirstPair: true,
        remoteEmbeddings: 0, connectionTests: 0, total: 25 },
      sent: { rerank: 0, decisions: 0, embeddings: 0, connectionTests: 0, total: 0 },
      spentByThisRunUSD: 0, providerReportedUSD: null, calculatedFromUsageUSD: null, unresolvedReservesUSD: 0 },
    nativePlan: { rerankCaseId: 'native-ru-cancellation', decisionsCaseId: 'ru-paraphrase-AB',
      rerankStatus: 'NOT RUN', decisionsStatus: 'NOT RUN', embeddings: 'synthetic only; no quality baseline' },
    orderStability: cases.decisions.filter(p => !p.swapped).map(p => ({ pairId: p.id.slice(0, -3),
      choiceAgrees: null, ambiguousSetAgrees: null, status: 'NOT RUN' })), entries,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const outputIndex = args.indexOf('--out');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const valid = args.every((arg, i) => arg === '--live' || arg === '--out' || i === outputIndex + 1 && outputIndex >= 0);
  if (!valid || outputIndex >= 0 && (!output || output.startsWith('--'))) throw Error('usage: [--live] [--out new-file.json]');
  try {
    const report = await preflight({ live });
    if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ mode: report.mode, blockers: report.blockers, planned: report.budget.planned,
      conditionalPlanningEnvelopeUSD: report.pricing.conditionalPlanningEnvelopeUSD,
      verifiedUpperBoundUSD: null, sent: 0, output: output ? 'written' : 'not requested' }, null, 2));
    if (live) process.exitCode = 2;
  } catch { console.error('Preflight failed; no provider calls made. Check frozen sources, build and output path.'); process.exitCode = 1; }
}
