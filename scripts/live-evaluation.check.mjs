// Free only: node --test scripts/live-evaluation.check.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BudgetJournal, receipt } from './live-evaluation-budget.mjs';
import { frozenCases, productionAdapters, preflight, MODELS } from './rerank-decisions-live.mjs';

const fingerprint = 'a'.repeat(64);
function fixture(t, limits) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veynrel-budget-check-'));
  const file = path.join(dir, 'journal.jsonl');
  const journal = new BudgetJournal(file, fingerprint, limits);
  t.after(() => { journal.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { file, journal };
}
const reported = cost => () => ({ usage: { cost } });

test('money bound, full outstanding reservation and no call on refusal', async t => {
  const { journal } = fixture(t);
  let calls = 0;
  await journal.run('first', 'rerank', 79_000_000, async () => { calls++; }, reported(0.079));
  await assert.rejects(journal.run('second', 'decisions', 1_000_001, async () => { calls++; }), /money-limit/);
  assert.equal(calls, 1);
  assert.equal(journal.summary().committedNanodollars, 79_000_000);
});
test('32 request cap, independent of zero explicitly reported cost', async t => {
  const { journal } = fixture(t);
  for (let i = 0; i < 32; i++) await journal.run('case-' + i, 'decisions', 100, async () => {}, reported(0));
  await assert.rejects(journal.run('extra', 'decisions', 100, async () => assert.fail('sent')), /request-limit/);
});
test('receipt distinguishes cost, usage calculation and unknown; rejects nonnumeric data', () => {
  assert.equal(receipt({ usage: { search_units: 2 } }, 'rerank').costNanodollars, 2_000_000);
  assert.equal(receipt({ usage: { input_tokens: 100, output_tokens: 9 } }, 'decisions').costNanodollars, 4200);
  assert.equal(receipt({ usage: { cost: 0 } }, 'rerank').costBasis, 'provider');
  for (const usage of [undefined, {}, { cost: -1 }, { cost: NaN }, { cost: Infinity }, { cost: '0' }, { total_tokens: 10 }])
    assert.equal(receipt({ usage }, 'rerank').costNanodollars, null);
  assert.deepEqual(receipt({ usage: { cost: 0.001, input_tokens: 3, secret: 'secret' } }, 'decisions').usage, { input_tokens: 3 });
});
test('unknown cost remains reserved and stops subsequent sends', async t => {
  const { journal } = fixture(t);
  await journal.run('unknown', 'rerank', 4_000_000, async () => {});
  assert.equal(journal.summary().unresolvedNanodollars, 4_000_000);
  await assert.rejects(journal.run('next', 'rerank', 4_000_000, async () => assert.fail('sent')), /reconciliation-required/);
});
test('timeout, disconnect and cancellation do not release a reserve even with a late receipt', async t => {
  for (const code of ['timeout', 'network', 'cancelled']) {
    const { journal } = fixture(t);
    await assert.rejects(journal.run('pending', 'rerank', 4_000_000, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      throw Object.assign(Error('synthetic-secret-and-note-body'), { code });
    }, reported(0)), error => error.message === code);
    assert.equal(journal.summary().unresolvedNanodollars, 4_000_000);
    await assert.rejects(journal.run('next', 'rerank', 1, async () => assert.fail('sent')), /reconciliation-required/);
  }
});
test('restart retains bills, skips nothing silently and never resends an existing ID', async t => {
  const { journal, file } = fixture(t);
  const decisionsId = (await frozenCases()).decisions[0].id;
  await journal.run('done', 'rerank', 4_000_000, async () => 42, () => ({ usage: { search_units: 1 } }));
  journal.close();
  const reopened = new BudgetJournal(file, fingerprint);
  try {
    assert.equal(reopened.summary().calculatedNanodollars, 1_000_000);
    await assert.rejects(reopened.run('done', 'rerank', 1, async () => assert.fail('resent')), /already-sent/);
    await reopened.run(decisionsId, 'decisions', 2_688_000, async () => {}, reported(0.0001));
    assert.equal(reopened.summary().requests, 2);
  } finally { reopened.close(); }
  const again = new BudgetJournal(file, fingerprint);
  try { await assert.rejects(again.run(decisionsId, 'decisions', 1, async () => assert.fail('resent')), /already-sent/); }
  finally { again.close(); }
});
test('reservation is on disk before sending; restart after interruption requires reconciliation', t => {
  const { journal, file } = fixture(t);
  journal.reserve('interrupted', 'rerank', 4_000_000);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').at(-1)).status, 'reserved');
  journal.close();
  const reopened = new BudgetJournal(file, fingerprint);
  try { assert.throws(() => reopened.reserve('new', 'rerank', 1), /reconciliation-required/); }
  finally { reopened.close(); }
});
test('concurrent writer, changed plan, corrupt journal and excessive limits fail closed', t => {
  const { journal, file } = fixture(t);
  assert.throws(() => new BudgetJournal(file, fingerprint), /EEXIST/);
  journal.close();
  assert.throws(() => new BudgetJournal(file, 'b'.repeat(64)), /journal-plan-mismatch/);
  assert.throws(() => new BudgetJournal(file, fingerprint, { ceiling: 80_000_001 }), /invalid-plan/);
  fs.appendFileSync(file, '{truncated');
  assert.throws(() => new BudgetJournal(file, fingerprint));
});
test('HTTP 200 rejected by production validator stays a technical error, not a quality verdict', async t => {
  const { journal, file } = fixture(t);
  const adapters = await productionAdapters();
  const previousWindow = globalThis.window; globalThis.window = globalThis;
  t.after(() => { globalThis.window = previousWindow; });
  const payload = { model: MODELS.rerank, results: [], usage: { search_units: 1 }, error: 'synthetic-secret-and-note-body' };
  const provider = new adapters.OpenRouterRerankProvider({ enabled: true, provider: 'openrouter', model: MODELS.rerank, apiKey: 'synthetic-only' },
    async () => ({ status: 200, text: JSON.stringify(payload) }));
  await assert.rejects(journal.run('invalid', 'rerank', 4_000_000,
    () => provider.rank('synthetic query', ['one', 'two'], new AbortController().signal), () => payload), /invalid-response/);
  assert.equal(journal.summary().calculatedNanodollars, 1_000_000);
  assert(!fs.readFileSync(file, 'utf8').includes('synthetic-secret-and-note-body'));
  await assert.rejects(journal.run('next', 'rerank', 1, async () => assert.fail('sent')), /reconciliation-required/);
});
test('all 24 frozen inputs pass actual serialization and validators with fake transport only', async t => {
  const cases = await frozenCases(), adapters = await productionAdapters();
  const previousWindow = globalThis.window; globalThis.window = globalThis;
  t.after(() => { globalThis.window = previousWindow; });
  assert.equal(cases.rerank.length, 4); assert.equal(cases.decisions.length, 20);
  let calls = 0;
  for (const capability of ['rerank', 'decisions']) {
    const settings = { enabled: true, provider: 'openrouter', model: MODELS[capability], apiKey: 'synthetic-only' };
    for (const item of cases[capability]) {
      const transport = async request => {
        calls++;
        const body = JSON.parse(request.body);
        assert.equal(body.model, settings.model);
        if (capability === 'rerank') {
          assert.deepEqual(body.documents, item.fragments.map(f => f.text));
          assert.equal(body.query, item.query);
          return { status: 200, text: JSON.stringify({ model: settings.model,
            results: body.documents.map((_, index) => ({ index, relevance_score: 1 - index })) }) };
        }
        assert.deepEqual(Object.keys(body.state), ['fragmentA', 'fragmentB']);
        assert.deepEqual(body.state, { fragmentA: item.fragmentA, fragmentB: item.fragmentB });
        return { status: 200, text: JSON.stringify({ model: settings.model + '-synthetic-version', answers: { overlap: {
          type: 'choice', choice: 'insufficient_context', confidence: 0,
          probabilities: { same_information: 0.2, partial_overlap: 0.2, related_distinct: 0.2, unrelated: 0.2, insufficient_context: 0.2 },
        } } }) };
      };
      const signal = new AbortController().signal;
      if (capability === 'rerank') await new adapters.OpenRouterRerankProvider(settings, transport).rank(item.query, item.fragments.map(f => f.text), signal);
      else assert.equal((await new adapters.OpenRouterDecisionsProvider(settings, transport).assess(item, signal)).tied.length, 5);
    }
  }
  assert.equal(calls, 24);
  for (let i = 0; i < cases.decisions.length; i += 2) {
    const a = cases.decisions[i], b = cases.decisions[i + 1];
    assert.equal(a.fragmentA, b.fragmentB); assert.equal(a.fragmentB, b.fragmentA);
    assert.equal(a.manualExpected, b.manualExpected); assert.deepEqual(a.manualAlternatives, b.manualAlternatives);
  }
});
test('dry-run stays offline with a key present; --live preflight still refuses unproven billing bound', async t => {
  const previousKey = process.env.OPENROUTER_API_KEY, previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = 'synthetic-only';
  globalThis.fetch = () => assert.fail('network in preflight');
  t.after(() => { globalThis.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey; });
  for (const live of [false, true]) {
    const report = await preflight({ live });
    assert.equal(report.budget.sent.total, 0); assert.equal(report.entries.length, 24);
    assert.deepEqual(report.blockers, ['unverified OpenRouter billing upper bound']);
    assert.equal(report.pricing.verifiedUpperBoundUSD, null);
    assert(!JSON.stringify(report).includes('synthetic-only'));
  }
});
