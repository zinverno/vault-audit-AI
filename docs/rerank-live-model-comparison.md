# Rerank v1: paid live model comparison

Verified **2026-10-10**. All three requested rerank models passed the real OpenRouter route and the unchanged production validator. All scored **4/4 top-1, MRR 1.0** on the frozen RU/EN cases. Voyage is the cost-based recommendation for this evidence, not a proven quality winner. Real semantic retrieval was already correct in all four cases; rerank produced **0 improvements, 0 regressions, 4 unchanged**.

## Provenance and scope

- Production commit: `3890f74d7d4d057c92ec5bd9d7922db63e2fe3be`, current main including merges #69, #70 and #72.
- Installed and rebuilt `main.js` SHA-256: `c8c2d4482a962b7f3e20793ae876501081fe58ce64b159b4d2212c207a9cf158`.
- Linux Obsidian **1.13.7**, Electron **43.6.0**; disposable profiles and synthetic vaults only.
- Branch: `test/rerank-live-model-comparison`. No production source, versions, dependencies or CI definitions changed. No release, merge, cloud pilot, or new Decisions experiment.
- PR #71 remains separate and unchanged. Its 21 Decisions calls are historical and excluded from this run. The mandatory existing `npm test` includes the repository's unit suites.
- No filesystem AGENTS.md, project skill, or existing Graphify graph was found in the checkout/ancestor paths. Applied the session-provided instructions and read the actual affected source and callers.

The [JSON evidence](rerank-live-model-comparison.json) includes source hashes, frozen texts and labels, exact request hashes, sanitized results/scores, costs, native observations and saved real semantic pools. No keys, authorization headers, raw provider logs, personal notes, profiles or vectors are committed.

## Pricing and budget

Rates checked on the test date: [Cohere](https://openrouter.ai/cohere/rerank-v3.5) **$0.001/search unit**, [Voyage](https://openrouter.ai/voyageai/rerank-3-lite) **$0.02/M input tokens**, [Qwen](https://openrouter.ai/qwen/qwen3-reranker-8b) **$0.20/M input tokens**, [text-embedding-3-small](https://openrouter.ai/openai/text-embedding-3-small) **$0.02/M input tokens** ($0.00000002/token). Each receipt matches its published rate and reported units.

The supplied `create-rerank` documentation URL returned 404; the current [official contract](https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request) documents `POST /api/v1/rerank`, indexed relevance scores, model and usage. [Cohere's pricing explanation](https://cohere.com/pricing) defines search units using document counts and splitting of longer query/document inputs. The published rate is **not a proven absolute maximum cost per HTTP call**. This authorized experiment began with two short documents and inspected the first actual bill before continuing.

Initial free `GET /api/v1/key`: valid, expiry `2026-10-14T08:09:40.860Z`, limit **$50**, usage **$0.000488922**. This differed from the original $0.10 instruction; paid dispatch paused. The user then explicitly confirmed they had intentionally selected that limit. The agent did not alter it. Local planning remained **$0.02**, absolute experiment ceiling **$0.03**.

**19 paid rerank calls ($0.0053713) + 1 real embedding batch ($0.00001108) = $0.00538238.** Final key usage **$0.005871302**, remaining **$49.994128698**. Subtracting the initial usage gives **exactly $0.00538238**. Unresolved reserves: **$0**. Overall mean rerank latency: **569.63 ms**.

Every response supplied numeric `usage.cost`. All 19 retained Rerank generation metadata lookups returned HTTP 404; these were free metadata lookups, not failed reranks. The embedding lookup result was not retained after the accounting stop. The key counter updated later in batches and ultimately matched all receipts exactly. Search units, tokens and dollars are stored separately.

## A/B: minimal real smoke

Query: `Which document explains retry backoff?`

0. `A retry with exponential backoff increases the delay between attempts.`
1. `A database index speeds up queries.`

| Requested model → resolved model | Provider | HTTP / validator | Order | Latency | Usage | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| `cohere/rerank-v3.5` → `rerank-v3.5` | Cohere | 200 / PASS | 0 → 1 | 610 ms | 1 search unit | $0.001 |
| `voyageai/rerank-3-lite` → `rerank-3-lite` | VoyageAI by MongoDB | 200 / PASS | 0 → 1 | 614 ms | 25 tokens | $0.0000005 |
| `qwen/qwen3-reranker-8b` → `accounts/fireworks/models/qwen3-reranker-8b` | Fireworks | 200 / PASS | 0 → 1 | 946 ms | 177 tokens | $0.0000354 |

Each model used the same installed production adapter, original Obsidian `requestUrl`, endpoint and serializer; only the explicit model ID changed. All result indices were complete/unique and scores finite. There were no model/endpoint substitutions or retries. All models were supported; no paid HTTP/validator failures occurred. Cohere did not report total tokens; token-priced models did not report search units. Missing fields remain absent.

## C: identical frozen quality cases

Original fixture SHA-256: `a6213ed3b33c26625ec537aafb910ed7d8cd86b238be3f27de97a5ddec714973`. Original manual labels remain unchanged. Before any model answer, the send order was fixed to **[1, 2, 0]** for every case/model, placing the labelled relevant fragment last. The original JSON order is **not a semantic baseline**.

| Model | Top-1 | MRR | Mean latency (4 fixed cases) | Fixed cost | All calls / cost |
| --- | --- | --- | --- | --- | --- |
| `cohere/rerank-v3.5` | 4/4 | 1.00 | 489.75 ms | $0.004 | 5 / $0.005 |
| `voyageai/rerank-3-lite` | 4/4 | 1.00 | 520.50 ms | $0.0000102 | 9 / $0.0000515 |
| `qwen/qwen3-reranker-8b` | 4/4 | 1.00 | 661.50 ms | $0.0002844 | 5 / $0.0003198 |

| Case | Cohere order | Voyage order | Qwen order |
| --- | --- | --- | --- |
| ru-cancellation | revision → http → index | revision → index → http | revision → index → http |
| ru-offline | local-asr → cloud-asr → local-player | local-asr → cloud-asr → local-player | local-asr → cloud-asr → local-player |
| en-rollback | conditional-restore → reset-all → ui-style | conditional-restore → reset-all → ui-style | conditional-restore → reset-all → ui-style |
| en-incomplete | coverage → speed → empty-screen | coverage → speed → empty-screen | coverage → speed → empty-screen |

The first item in each returned order is the manually labelled relevant document. **No labelled ranking errors** occurred. Differences among distractors (for example `http` versus `index` in ru-cancellation) have no graded labels and do not establish a quality difference. Top-3 is 4/4 for all models but is uninformative on three-document cases. Four easy synthetic queries cannot establish statistical superiority, multilingual robustness or real-vault performance.

## D: real semantic baseline

No running/local Ollama setup was found; `ollama` was not installed on PATH. The authorized OpenRouter embedding model produced **16 real vectors in one batch**: 12 production chunk texts from the synthetic notes plus the four queries. Production chunk text includes the existing synthetic filename breadcrumb for indexing; #72's authored-only boundary applies when preparing outbound Rerank fragments.

The real vectors were cached outside Git. The driver built a file-backed synthetic vault/index with the actual `MarkdownChunker`, `IndexingService`, `LocalVectorStore` and `SemanticSearchService`, then used production `prepareRerankCandidates`. Each query consumed its cached real embedding once to obtain one saved 12-document pool. No artificial vector was used for this quality baseline, and no second embedding request was made for baseline versus rerank. Index/search ran through the shared production services in Node; the saved pools were reranked through the installed native adapter.

Voyage was selected by the predeclared rule: highest fixed-case MRR, then lowest measured cost, then latency. All models tied on MRR; Voyage had the lowest cost. The exact same query, candidate membership, candidate order and prepared texts were frozen before each rerank.

| Case / relevant note | In candidate pool | Position before → after | Top-1 before / after | Top-3 before / after | Effect |
| --- | --- | --- | --- | --- | --- |
| ru-cancellation / `revision` | Yes | 1 → 1 | yes / yes | yes / yes | unchanged |
| ru-offline / `local-asr` | Yes | 1 → 1 | yes / yes | yes / yes | unchanged |
| en-rollback / `conditional-restore` | Yes | 1 → 1 | yes / yes | yes / yes | unchanged |
| en-incomplete / `coverage` | Yes | 1 → 1 | yes / yes | yes / yes | unchanged |

All relevant notes were present. Missing-relevant-candidate cases: **0**. Rerank changed some distractor positions but did not improve the measured relevant positions, top-1 or top-3. Four semantic rerank calls cost **$0.0000408**, mean latency **491.50 ms**. The corpus is small enough that all notes fit in the candidate pool; this does not evaluate retrieval recall on large vaults. Required local npm checks overlapped this final stage, so its latency is not a controlled speed comparison. A second semantic reranker was not needed to support the observed ceiling result.

## Native Obsidian live

The first Cohere smoke was reused as the full UI test, with synthetic vectors only for local wiring. It was not a standalone HTTP-only check. The installed build emitted `semantic → refining → reranked`, displayed both local note names, preserved semantic scores (1.0 and approximately 0.8), and attached distinct actual rerank scores. Clicking the first result opened `Local-Only-0.md` at body line 0. Production payload hashing confirmed the two exact authored bodies above; `Local-Only-*` fallback names were absent. Local titles remained visible.

Rerank had separate in-memory model/key settings. The real key was read only from the authorized test file, passed to the disposable process through `OPENROUTER_API_KEY`, removed from renderer environment, and injected into provider copies. Persistable settings contained a harmless placeholder. The driver checked the synthetic plugin `data.json` for absence of the actual key. No screenshots or raw logs were retained. All native processes were closed after each stage.

Native verdict: **PASS for Linux live transport, production parsing, refinement, local labels and fragment navigation**. The first UI smoke's synthetic vectors are not quality evidence. Real embedding quality was evaluated separately in D; a full native cloud-index configuration/UI run was not performed.

## Driver failures, safety and reproducibility

Two harness issues were found, with no product changes:

- Some fresh Obsidian profiles started in Restricted mode. The manifest existed but the plugin was not loaded. These attempts stopped before paid dispatch. The driver now verifies the temporary vault, explicitly enables community plugins, then waits for the controller; the narrow free native scenario passed.
- After the successful embedding batch, delayed aggregate key usage tripped a per-request accounting comparison. Paid work stopped. A free regression covered the actual numbers; reconciliation now compares cumulative receipts. An append-only journal reconciliation entry confirmed the exact bill. The existing real vectors were reused and embeddings were never resent.

The durable journal is fixed at `~/.local/state/veynrel/rerank-smoke-v1/budget.jsonl`, separate from Decisions. It binds the production build, model list, cases, input hashes and billing rules. Exclusive locking, fsync before dispatch, outstanding reserves, fixed operation IDs, unknown-outcome stops and a date guard prevent accidental repeat billing. The $0.002 per-rerank reserve is a planning allowance, not a promised provider maximum. Do not delete/move the state directory or create another journal to restart the budget.

**Verified resume: all 20 completed paid operations were skipped; 0 extra paid calls; journal SHA-256 unchanged.** Existing native evidence is not overwritten by a skipped replay. The final corrected driver was used for D; A/B/C used the same unchanged production artifact, with earlier harness startup/accounting revisions documented above.

Free driver checks (do not read the key):

```sh
node scripts/rerank-comparison.check.mjs
node scripts/rerank-comparison-native.mjs --fake smoke 0
```

Explicit paid entrypoints are `node scripts/rerank-comparison-native.mjs --live smoke|fixed|semantic 0|1|2` and `node scripts/rerank-comparison-semantic.mjs --live`. They are not in npm test or CI. The smoke must succeed before fixed/semantic requests for that model; errors stop that model, unknown accounting stops all new paid work. The completed experiment's commands only reuse the preserved journal/cache. New dispatch after the reviewed date requires an explicit tariff/plan review; do not remove the guard or state to repeat this experiment.

## Paid call ledger

| Operation | Latency | Usage | Actual cost |
| --- | --- | --- | --- |
| smoke-0-smoke | 610 ms | 1 search unit | $0.001 |
| smoke-1-smoke | 614 ms | 25 tokens | $0.0000005 |
| smoke-2-smoke | 946 ms | 177 tokens | $0.0000354 |
| fixed-0-ru-cancellation | 603 ms | 1 search unit | $0.001 |
| fixed-0-ru-offline | 566 ms | 1 search unit | $0.001 |
| fixed-0-en-rollback | 403 ms | 1 search unit | $0.001 |
| fixed-0-en-incomplete | 387 ms | 1 search unit | $0.001 |
| fixed-1-ru-cancellation | 654 ms | 161 tokens | $0.00000322 |
| fixed-1-ru-offline | 422 ms | 177 tokens | $0.00000354 |
| fixed-1-en-rollback | 410 ms | 89 tokens | $0.00000178 |
| fixed-1-en-incomplete | 596 ms | 83 tokens | $0.00000166 |
| fixed-2-ru-cancellation | 629 ms | 389 tokens | $0.0000778 |
| fixed-2-ru-offline | 921 ms | 405 tokens | $0.000081 |
| fixed-2-en-rollback | 663 ms | 317 tokens | $0.0000634 |
| fixed-2-en-incomplete | 433 ms | 311 tokens | $0.0000622 |
| embedding-real-v1 | 1540 ms | 554 tokens | $0.00001108 |
| semantic-1-ru-cancellation | 670 ms | 528 tokens | $0.00001056 |
| semantic-1-ru-offline | 428 ms | 576 tokens | $0.00001152 |
| semantic-1-en-rollback | 442 ms | 468 tokens | $0.00000936 |
| semantic-1-en-incomplete | 426 ms | 468 tokens | $0.00000936 |

## Verification and recommendation

| Check | Result |
| --- | --- |
| Free driver checks | PASS: 10 checks, including production serialization/validation, index mapping, preserved scores, fallback, no retry, journal recovery and delayed accounting |
| npm test | PASS: 115 files, 2,862 tests |
| npm run typecheck | PASS |
| npm run lint | PASS: only the existing reviewed api.ts:402 fetch warning |
| npm run build | PASS; SHA-256 equals installed production artifact |
| git diff --check | PASS |
| Native live | PASS, Linux Obsidian 1.13.7 / Electron 43.6.0 |
| Real semantic quality baseline | EVALUATED; 4 unchanged, no gain |
| Resume without repeat billing | PASS |

**Recommend `voyageai/rerank-3-lite` for optional Veynrel reranking on this evidence**: it matched both alternatives on these labels, cost substantially less, and had similar observed end-to-end latency. This is a bounded price/performance choice, not evidence that Voyage is generally the best model. The default model and product settings were not changed. No production defect requiring a pre-release fix was found; the two fixes concern the test harness. Do not market an established semantic-search improvement from this run.

Not covered: personal/large vaults, long documents and their billing bounds, model stability over repetitions, mobile/other OS, themes or screen readers. No release or merge is part of this work.
