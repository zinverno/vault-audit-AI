# Rerank / Decisions live evaluation — blocked preflight

Date: **2026-10-07**. **No paid request was sent.** This is the reproducible free preparation and a blocked-run report, not evidence that either real integration or model quality passed.

| Gate | Rerank | Decisions |
| --- | --- | --- |
| Live production adapter | **BLOCKED: missing credential** | **BLOCKED: missing credential** |
| Native Obsidian with real transport | **BLOCKED: missing credential** | **BLOCKED: missing credential** |
| Semantic quality | **NOT EVALUATED** | **NOT EVALUATED** |
| Free serialization / validation checks | PASS with injected fake transport | PASS with injected fake transport |

`OPENROUTER_API_KEY` was absent. No other credential source was designated. No home-directory, personal-vault or plugin-settings search for a key was performed. A second preflight issue remains: the official sources reviewed do not establish a sufficiently small maximum billed search-unit count for this OpenRouter route. The conditional cost calculation below is **not permission to send**. No key, account limit, payment setting, personal note, production setting, criteria, validator, timeout or model was changed.

## Source and build

GitHub confirmed [#69](https://github.com/zinverno/veynrel/pull/69) and [#70](https://github.com/zinverno/veynrel/pull/70) merged. `origin/main` was fetched and the clean evaluation branch `test/rerank-decisions-live-evaluation` created from **`6a405e2e7d90be41f722e2a80995628ce56ad83c`** (actual #70 merge). #69 merged as `499d5fb383048101b819f4b70a01e3c06ce1aa90`. Neither PR was modified.

Fresh `npm run build` on this production source:

- `main.js`: `ae2fce2d38c5003ec4888f516de572544b30ceb9ac75f8f8c5d489644a6175ea`
- `styles.css`: `443b21f59f0326e38e369f67af2159a3d965a1cbbb053c7ca5a2d70f4a60dfff`
- Free preparation host: Linux x64, Node **24.14.1**. `/usr/bin/obsidian` and `/usr/bin/electron43` exist. **No native app was launched in this evaluation; native app/Electron versions are unobserved.** Previous [Rerank native evidence](rerank-v1-evidence/verification.md) and [Decisions native evidence](decisions-v1-evidence.md) used fake transport and are not a live PASS here.

The localhost Ollama model-list probe returned `ECONNREFUSED`; there is no established available real local embedding model. No heavy model was downloaded. No remote embeddings were requested or budgeted. Artificial embeddings in the existing native scripts can exercise UI, but cannot establish search quality.

## Rates, routes and budget

Official sources were checked before any possible paid operation:

| Capability | Exact requested model | Route | Published rate |
| --- | --- | --- | --- |
| Rerank | [`cohere/rerank-v3.5`](https://openrouter.ai/cohere/rerank-v3.5) | [`POST /api/v1/rerank`](https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request) | $0.001/search |
| Decisions | [`typesafe/jev-1.13`](https://openrouter.ai/typesafe/jev-1.13) | [`POST /api/alpha/decisions`](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) | $0.042 / million input tokens; output $0 |

Both model IDs and endpoints are documented. That does not verify account access, billing, HTTP compatibility or acceptance by the production validator. No `latest`, Jev Router, chat endpoint, alternate model or direct-provider fallback is planned.

The authorized ceiling is **$0.10**, the planning ceiling **$0.08**, and **$0.02 is untouched margin**. The provisional order is: native Rerank once; four fixed Rerank cases in file order; first Decisions pair A/B through native preview + explicit launch; the other 19 Decisions orders in file order. Thus **25 calls** (5 Rerank, 20 Decisions), with no connection probes, paid embeddings, automatic retries or extra experiments. Maximum 32 never overrides the money limit.

Conditional planning envelope:

- Five Rerank calls × four reserved search units × $0.001 = **$0.02000**.
- Twenty Decisions calls × 64,000 reserved input tokens × $0.042 / 1,000,000 = **$0.05376**.
- Total **$0.07376**, below $0.08 **only if those request bounds hold**. No characters-per-token estimate is used. The whole-request token reservation includes state, fixed Choice criteria and service context rather than counting fragment text alone.

[TypeSafe's model reference](https://docs.typesafe.ai/models) states a 64k total request budget and a 32k state-plus-longest-question budget; OpenRouter lists 32,000 context tokens. The larger total is reserved conservatively. [Cohere pricing](https://cohere.com/pricing) defines a search unit as a query with up to 100 documents and counts long-document chunks. [Cohere v1](https://docs.cohere.com/v1/reference/rerank) documents a default maximum of ten chunks per document. **The OpenRouter contract does not establish that this upstream default governs its route**, nor expose a caller-set chunk cap. Four units is an allowance, not a proven upper bound. Therefore `verifiedUpperBoundUSD` is `null` and `--live` fails closed even if a key becomes available. A future run needs current authoritative billing/chunking evidence before enabling paid dispatch; merely increasing an estimated reserve or flipping a boolean is insufficient.

Actual accounting: **0 dispatched requests of every kind; $0 spent by this evaluation; $0 unresolved reservations**. No provider cost or usage was observed (`null`, not a reported zero). No paid journal was initialized. The temporary journals in free guard tests contain simulated accounting only and are deleted afterward.

## Frozen annotation and case results

The [versioned input copy](rerank-decisions-live-cases-v1.json) is `live-evaluation-v1`, SHA-256 **`6c3a1ac4c540add14e64e821fff8c49ce82a7ef6a3f375fb0cee25701b590906`**. Production criteria remain **`overlap-v1`**. Source file hashes:

- `rerank-v1-evaluation.json`: `a6213ed3b33c26625ec537aafb910ed7d8cd86b238be3f27de97a5ddec714973`
- `decisions-v1-evaluation.json`: `1d551dca41743fcdc027aded51caaf662fdf75cac174f1eb69e1344934ccee2f`

The copy also pins adapter and criteria source hashes. The preflight rejects changed inputs or those sources. Request hashes and UTF-8 sizes come from the actual production serializers. Original evaluation files are unchanged.

Before seeing any model output, both `ru-paraphrase` orders were relabelled: primary **`partial_overlap`**, permitted alternative **`same_information`**. “Встреча перенесена…” adds the fact of rescheduling, absent from “Во вторник встречаемся…”. The alternative records a possible pragmatic reading focused on the resulting arrangements. All other labels, alternatives, fragment text and ordering were reviewed and retained. These are manual judgments, not measured truth or model predictions.

### Rerank A: fixed candidate sets

| Case | Manually relevant fragment | In fixed pool? | Reranked position / top-1 / top-3 |
| --- | --- | --- | --- |
| ru-cancellation | revision | Yes | NOT RUN / — / — |
| ru-offline | local-asr | Yes | NOT RUN / — / — |
| en-rollback | conditional-restore | Yes | NOT RUN / — / — |
| en-incomplete | coverage | Yes | NOT RUN / — / — |

Each fixed pool has three fragments. Relevant-first JSON order is an annotation convenience, **not an embedding baseline**; top-3 on these pools would itself provide little discrimination. No movement relative to this list will be advertised as improved semantic search.

### Rerank B: actual semantic retrieval

| Query | Relevant in retrieved pool | First relevant before / after | Top-1 / top-3 before / after | Change |
| --- | --- | --- | --- | --- |
| ru-cancellation | Unknown | — / — | — / — | NOT EVALUATED |
| ru-offline | Unknown | — / — | — / — | NOT EVALUATED |
| en-rollback | Unknown | — / — | — / — | NOT EVALUATED |
| en-incomplete | Unknown | — / — | — / — | NOT EVALUATED |

No actual retrieval was run. For a future quality comparison, use the twelve synthetic fragments as the corpus, existing semantic search with a real already-installed local embedding model, and capture baseline and refinement from **one** search with the same candidates and final `k`. Record missing relevant candidates as retrieval limitations. The provisional budget covers only the artificial-embedding native UI scenario, not these additional quality calls; revise the call allocation within the same $0.08 cap before adding them.

### Decisions: ten pairs, twenty orders

Every row below is **NOT RUN**. Choice, probabilities, confidence, ties, resolved model, latency, usage and cost are `null` in the [sanitized evidence](rerank-decisions-live-evidence.json). Requested model is `typesafe/jev-1.13` throughout.

| Input | Primary manual label | Allowed alternatives | Model outcome |
| --- | --- | --- | --- |
| ru-paraphrase-AB | partial_overlap | same_information | NOT RUN |
| ru-paraphrase-BA | partial_overlap | same_information | NOT RUN |
| en-partial-AB | partial_overlap | — | NOT RUN |
| en-partial-BA | partial_overlap | — | NOT RUN |
| ru-aspects-AB | related_distinct | — | NOT RUN |
| ru-aspects-BA | related_distinct | — | NOT RUN |
| en-contradiction-AB | related_distinct | — | NOT RUN |
| en-contradiction-BA | related_distinct | — | NOT RUN |
| ru-unrelated-AB | unrelated | — | NOT RUN |
| ru-unrelated-BA | unrelated | — | NOT RUN |
| en-context-AB | insufficient_context | — | NOT RUN |
| en-context-BA | insufficient_context | — | NOT RUN |
| translation-AB | same_information | — | NOT RUN |
| translation-BA | same_information | — | NOT RUN |
| en-ambiguous-AB | partial_overlap | related_distinct, same_information | NOT RUN |
| en-ambiguous-BA | partial_overlap | related_distinct, same_information | NOT RUN |
| ru-ambiguous-AB | partial_overlap | insufficient_context | NOT RUN |
| ru-ambiguous-BA | partial_overlap | insufficient_context | NOT RUN |
| en-caveat-AB | partial_overlap | — | NOT RUN |
| en-caveat-BA | partial_overlap | — | NOT RUN |

There are **0 evaluated pairs / 10 planned**, so A/B agreement is unmeasured, not 0%. Primary-label matches, allowed alternatives, disagreements, ambiguous answers and technical failures all have no live observations. A later report must distinguish choice agreement from agreement of tied-category sets. Twenty orders are not twenty independent semantic examples. Neither confidence nor a successful connection test measures accuracy or calibration.

## Reproduce the free preparation

From the repository root, using installed dependencies:

```sh
npm run build
node --test scripts/live-evaluation.check.mjs
node scripts/rerank-decisions-live.mjs
node scripts/rerank-decisions-live.mjs --out /tmp/veynrel-live-preflight.json
node scripts/rerank-decisions-live.mjs --live
git diff --check
```

The default makes **zero HTTP calls even with a key present**. `--out` creates a new sanitized file and refuses overwrite. `--live` currently exits **2** with the preflight blockers; it **does not execute paid requests**. This intentionally limited runner is not advertised as a completed live/native harness. It bundles the actual adapters with an offline Obsidian transport tripwire; free tests inject fake responses through the production validators. No simplified network API or alternate validator is implemented.

The separate [budget journal](../scripts/live-evaluation-budget.mjs) is free-tested for future use around the production operation. It writes and fsyncs a reservation before calling its supplied operation, uses integer nanodollars, rejects duplicate IDs and concurrent writers, and retains the history on restart. Its fingerprint must bind cases, criteria, build, prices and reservations when paid dispatch is added. Keep a single journal outside the repository across all paid scenarios. A local ID is not provider idempotency; deleting the journal or choosing a new filename does not undo spending and must not be used to restart this evaluation.

Missing/invalid cost stays unknown. Only an explicit numeric provider cost, or recognized numeric usage at the reviewed rate, settles a bill. Timeout, cancellation and network failure retain the full reserve even if a late receipt appears. Any technical failure, unresolved reservation or cost exceeding its reservation blocks further dispatch. There is deliberately no automatic reconciliation/reset command. After a crash, inspect the journal and provider accounting before removing a stale lock; do not resend its reserved operation. Recheck tariff rules before using usage-based calculation in a later run.

## Native acceptance remaining

Do not run `scripts/rerank-native.mjs` or `scripts/decisions-native.mjs` wholesale with a real key. Their fake delays, failures, connection probes and retries are not the paid plan.

Once credentials and the billing bound are established, reuse their disposable-profile setup and CDP interaction patterns in a narrow driver with the same journal. Necessary work before claiming native live:

1. Create a fresh `/tmp` vault/profile, install the hashed build, write only the frozen synthetic corpus, disable Companion and unrelated cloud features. Index with a free local model or artificial UI-only vectors. Never use the personal profile.
2. Pass the authorized environment key in process memory to the two independent capability settings/provider constructions, without saving it. Read the running app version from General settings. Do not export the profile, `data.json`, secrets, headers or raw bodies.
3. Wrap each **original production transport** transparently: reserve before its call, return its response unchanged, extract only safe numeric accounting. Preserve production validation, sorting and Choice criteria. No paid connection probe.
4. Rerank: enter the frozen query in existing Semantic Search, explicitly submit, observe semantic → refining → validated result or controlled fallback. Capture one original candidate pool and equal final `k`; artificial vectors must be labelled UI-only. This is the planned native Rerank operation.
5. Decisions: select the `ru-paraphrase-AB` evidence pair in the existing duplicate list, open comparison, verify zero requests and exact A/B preview, then press the separate assessment button once. Capture the tentative result or safe error. Reuse this as the first of the twenty ordered inputs; never also send it in an adapter loop.
6. Execute each remaining frozen operation once, sequentially. Halt a capability on route/auth/contract failure; halt all paid work on uncertain accounting. If HTTP succeeds but the production validator rejects it, report an integration failure and keep the bill. Never normalize or change validators to rescue the run.
7. Close the disposable profile, remove any created temporary secret copy, and preserve only the allowlisted evidence and durable journal. No screenshot or log should expose a key. This evaluation has created no temporary secret copy to remove.

## Fresh verification and conclusions

- `node --test scripts/live-evaluation.check.mjs`: **11/11 passed**. Includes money/count limits, pending reserve, unknown cost, timeout/disconnect/cancellation, restart and duplicate protection, corrupt journal/lock handling, safe diagnostics, all 24 inputs through actual production adapters with fake transport, and offline preflight with a synthetic key present.
- `npm test -- rerank decisions`: **4 files, 92 tests passed**.
- `npm run build`: **PASS**, hashes above.
- `node --check` for all three new `.mjs` files: **PASS**.
- Dry-run: **PASS**, zero calls. `--live`: expected refusal, exit **2**, zero calls.
- `git diff --check`: **PASS**. No production TypeScript or package/CI configuration changed. Typecheck, lint and proposal mutation audit are not claimed as rerun for this scripts/docs-only change.

The first free-check attempt exposed teardown ordering in the new check file: its temporary directory was deleted before closing the journal lock. Cleanup was corrected and all eleven checks passed on rerun; no production behavior was involved. No live integration defect or model error can be diagnosed without live responses. No sanitized real-response regression fixture exists because there was no response.

A separate review found that the new journal rejected uppercase `AB`/`BA` in the frozen Decisions case IDs. Both reservation and replay validation were corrected, and the restart check now uses a real frozen case ID. No other Required/Critical review findings remained. These were test-runner issues, not observations about either model.

**Rerank:** real integration remains blocked. The four fixed pools establish a reproducible future ranking task, not an observed improvement. Real semantic retrieval quality is untested. No product fix is established by this run; live acceptance still needs completion before describing the integration as verified.

**Decisions:** real integration remains blocked. The manual meeting annotation was clarified before testing; no model categories or order-stability results were measured. No production criteria/validator fix is justified from these mocks. Live acceptance and the small semantic evaluation remain outstanding before making reliability claims.

This change adds free preparation and evidence only. No release, version bump, cloud pilot, account/backend infrastructure or product feature was created.
