# Decisions v1: manual fragment overlap

Decisions compares **two selected fragments**, not whole notes. A shared topic does not imply the same information. The result is a model's suggestion, not a confirmed duplicate. No notes, links, Findings, Health state, semantic scores or rerank results are changed. API/UI success and semantic classification quality are separate questions.

## Setup and use

1. Open Settings → Veynrel → **Semantic Intelligence — Advanced** → **Overlap assessment / Decisions**.
2. Read the data/billing disclosure. Enable Decisions, enter an explicit Decisions model ID and its **separate** OpenRouter API key. The documented starting example is `typesafe/jev-1.13`; it is not a quality recommendation. Chat, embedding and Jev Router models are not substitutes. No automatic `latest` selection.
3. Optionally press **Test Decisions**. This makes one potentially paid API request with fixed synthetic bicycle fragments. It verifies connection and response shape, not classification quality. Opening settings does not run the test.
4. Open the existing potentially similar pairs window from Discover or the plugin command. Choose **Assess overlap** on one pair. Opening the comparison only prepares a local preview.
5. Check both source notes and the exact outgoing text. Press **Run assessment** to send it. Results and technical errors appear in the same small window. Each note button opens its note at the reconstructed chunk.

The feature is off by default, including upgrades. It does not require rerank. Its enabled state, model and key are independent of other capabilities and do not invalidate the semantic index. The key is stored using the existing plugin settings mechanism, **unencrypted in the plugin's `data.json`**. Password masking only hides it on screen. Failed saves roll back the changed fields without replacing other capabilities' settings.

## Data flow and limits

`SemanticDuplicatesModal` passes the selected `SemanticDuplicatePair` to an `OverlapSession` owned by `ObsidianSemanticController`. The semantic runtime uses the existing document source and chunker, sharing `chunking/reconstructChunks.ts` with RAG/rerank. It chooses the first usable match per side in descending score, then ordinal order (stable ties), requiring matching chunk ID and content hash. Preview text and old offsets are never used as source text. Navigation uses reconstructed coordinates.

Only current Markdown paths still present in the compatible index and permitted by the document source are eligible. Missing, deleted, renamed, excluded or stale evidence blocks sending. The code never substitutes a whole note, broadens the scope, scans other pairs, or rebuilds the index to obtain a comparison. Current semantic scope remains unchanged.

After checking the original chunk ID/content hash, Decisions obtains an outbound representation from the same parsed blocks and overlap. Filename-derived fallback breadcrumbs are omitted, including for headerless notes, introductions and empty headings. Actual Markdown headings remain as context; names or paths written by the author in a heading or body remain content. This is provenance handling, **not anonymization or personal-data removal**. The plugin does not add filenames, folder names or paths as service context to these fragments. Local note labels and navigation remain available.

This happens before Unicode truncation and JSON size checks; the preview is exactly the resulting outbound text. Missing provenance is a technical stale/preparation state, never a model verdict or a fallback to enriched text. Legacy `chunk.text`, identity/hash, coordinates, embedding space and persisted index stay unchanged; no rebuild is requested. This boundary applies to Decisions and Rerank, not to embeddings, RAG or Companion.

Product limits, **not provider limits**:

| Limit | v1 |
| --- | --- |
| Fragments per request | Exactly two |
| Each fragment | First 4,000 Unicode code points |
| Serialized request | At most 64 KiB of UTF-8 JSON, including criteria/model |
| Local waiting timeout | 15 seconds |
| Requests per explicit run | One, no automatic retries |

Truncation is a deterministic prefix using Unicode code points; surrogate pairs are not split. Combining sequences/graphemes may end at the boundary. The preview displays the exact truncated version and a notice. The normal chunker may produce smaller chunks. Oversized/invalid input is rejected before HTTP.

The request is `POST https://openrouter.ai/api/alpha/decisions`, via Obsidian `requestUrl`. JSON contains only:

- `model`: the configured explicit model ID;
- `state`: `fragmentA` and `fragmentB`, containing precisely the displayed text;
- `questions.overlap`: one `type: "choice"` question, fixed instructions and the five fixed criteria.

The API key is only in the Authorization header. The code adds no file paths, filenames, vault IDs, hashes, user/session/trace metadata, rerank parameters or telemetry. Note text itself may contain names or paths; preview it before sending. The two fragments go to OpenRouter and the selected model provider, billed to the user's account. This is not a local or anonymous mode and makes no retention/training promise.

Fragment content remains untrusted data in `state`, never interpolated into the question's instructions or criteria. This separation and serialization tests **do not establish model resistance to prompt injection**. File existence, scope, identities and permission to send are checked by code.

## Fixed question and result

Criteria version: `overlap-v1` (stored locally with the in-memory result). The question compares only the provided text, without inferring unseen parts of either note.

| Category | Criterion |
| --- | --- |
| `same_information` | Essentially identical claims and caveats, including paraphrase or translation; no substantive addition or contradiction. |
| `partial_overlap` | Shared information plus substantial additions or differences on either side. |
| `related_distinct` | Related topic but different main information; includes opposing claims about the same issue. |
| `unrelated` | No substantive overlap or meaningful thematic relation. |
| `insufficient_context` | Supplied text is too unclear, incomplete or context-dependent to justify a substantive category. |

A stale/missing fragment, HTTP error or cancellation is a **technical state**, never `insufficient_context`.

Raw JSON is checked for `answers.overlap`, `type: "choice"`, a known choice, exactly the five probability keys, and finite numbers in [0,1]. To tolerate independent rounding to hundredths, sum error may be at most 0.025 (plus floating-point epsilon); the chosen probability must be within 0.01 of the maximum. Choices within that same tolerance are displayed as a tie/ambiguity, not an unequivocal conclusion. Probabilities are not normalized or filled in.

Choice confidence must be finite in [0,1] and agree with the documented `(maxProbability - 1/5) / (1 - 1/5)` within 0.01125 plus epsilon: 0.005 for reported confidence plus 0.005 / 0.8 for probability rounding. It is not measured accuracy, percentage text overlap or a guarantee. There are no automatic acceptance thresholds. Details show probabilities, requested and returned model IDs and criteria version. A resolved version suffix such as `typesafe/jev-1.13-20260917` is accepted; model IDs are not compared for literal equality.

Descriptions are fixed localized copy, not generated explanations. No second LLM is invoked.

## Lifecycle and failure

The session holds previews/results only in memory until its window closes. No persistent result store or text/query cache is created. Rerendering, searching, listing pairs, opening workspace/settings/maps, indexing, source events and Companion sync never trigger Decisions.

Before sending, the sources, eligibility and configuration snapshot are checked again. If the source or preview changed, no updated text is silently sent: a refreshed preview requires another explicit run, or stale evidence requires refreshing the pair after an explicit index update. After HTTP, the same validation runs before applying the answer. Index locking covers only local preparation, never the external request.

Closing the window, selecting another pair, source modification/deletion/rename, settings changes, disabling Decisions, index changes or plugin unload invalidate pending work. Already displayed assessments are visibly marked stale. Source events only invalidate state; they do not reread or reassess automatically. Index count/generation changes conservatively invalidate open sessions even when unrelated to the selected pair.

401/403, 402, 429, 5xx, malformed/empty responses, invalid distributions, network errors, timeout and cancellation produce fixed safe categories. Provider bodies, raw errors, keys and fragments are not logged or included in diagnostics. No endpoint/model/service fallback or automatic paid retry exists. A retry needs another explicit button press; double clicks while preparing/assessing are ignored.

`requestUrl` does not cancel processing at the provider. Timeout/cancellation stops local waiting and ignores late replies; the provider may still finish and bill the request.

## Contract sources and quality evaluation

Checked against official documentation on 2026-10-07:

- [OpenRouter Jev guide](https://openrouter.ai/docs/guides/community/jev) — model availability and dedicated Decisions route.
- [Decisions API reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request) — HTTP request/answer structure and resolved version suffix example.
- [Choice primitive](https://docs.typesafe.ai/primitives/choice) — question and distribution semantics.
- [Confidence](https://docs.typesafe.ai/confidence) — Choice confidence formula.

The alpha API/model availability can change. The integration uses one checked route, with no endpoint probing. Real quality depends on the selected pair's evidence, fragment completeness, language and model. It is not measured by mocks or the connection test and is not guaranteed for any pair.

[The synthetic RU/EN evaluation set](decisions-v1-evaluation.json) contains manual labels, alternatives for ambiguous cases and both A/B orders. These are future evaluation inputs, **not measured model outcomes**. Review actual classifications and order sensitivity separately after explicitly authorizing paid calls. No production behavior is fitted to these examples.

## Verification and manual acceptance

Automated tests use fake transport only: Choice validation, request serialization/privacy, preparation by ID/hash and scope, Unicode limits, preview/send equality, snapshot races, safe errors, rollback, independent settings and no index mutation. Existing Rerank tests remain in the full suite.

Native reproduction (Linux, disposable vault; no actual credentials):

```sh
npm run build
node scripts/decisions-native.mjs prepare /tmp/veynrel-decisions-native
electron43 /usr/lib/obsidian/app.asar --user-data-dir=/tmp/veynrel-decisions-native/profile --remote-debugging-port=9262 --disable-gpu --ozone-platform=x11
# In another terminal after Obsidian loads:
node scripts/decisions-native.mjs run /tmp/veynrel-decisions-native
```

The harness uses a synthetic localhost embedding server and replaces only the production Decisions adapter's transport. It saves sanitized check names, artifact hash and screenshots under `/tmp/veynrel-decisions-native`. See [verification evidence](decisions-v1-evidence.md) for the actual tested build and native results. No live-provider quality claim is made.

Manual acceptance:

1. With Decisions off, open a pair; confirm the settings route and no network call.
2. Configure an explicit model and separate test key; preview both texts, scope/disclosure and truncation notice if present. Opening/rerendering must not request an assessment.
3. Run once with fake transport. Confirm displayed text equals payload, tentative verdict/details, separate confidence wording and note navigation. Check ties.
4. Modify/delete a selected note during and after the request; disable/change settings; close/reopen or choose another pair. Old replies must not apply, shown old results must be stale, no automatic rerun.
5. Check a controlled error and manual retry. Verify EN/RU, keyboard buttons/scrollable text, long content and narrow width.
6. Verify rerank/semantic search remain functional and semantic index identity is unchanged by Decisions configuration or assessment.

Native smoke is desktop-only. Mobile, other operating systems, custom themes and screen readers require separate acceptance. Live OpenRouter requests and semantic accuracy require a separately authorized evaluation.
