# Semantic chunk bounds and rejected-batch diagnostics

Baseline: `a0b35c8510717b941eb21b2526835c39f3496a53` (merged PR #56).

Two real-vault builds, using OpenRouter `qwen/qwen3-embedding-8b` and then
`openai/text-embedding-3-small`, completed many HTTP 200 embedding requests before
a late deterministic request quickly failed with HTTP 400. This is **consistent
with an input-specific rejection**. It does not prove the precise cause or identify
a particular input. The second run used OpenAI as final provider, so the observation
is not reasonably attributable only to Qwen or one DeepInfra upstream.

Repository inspection found a concrete defect: the chunker emitted oversized
atomic Markdown blocks intact and set `NoteChunk.oversized = true`. Nothing downstream
protected the embedding request. That defect plausibly produces rejected inputs;
we have not established that it caused either real-vault incident.

## Hard character bound

Every emitted `MarkdownChunker` chunk now satisfies
`chunk.text.length <= options.maxChars`, including the breadcrumb and separators.
The normal options remain target 1,200, maximum 1,800, overlap 200 UTF-16 code units.
This is a character contract, **not a token limit guarantee**. No tokenizer or other
dependency is added. Indexing batch size remains **32**; there is no model/provider
special case or automatic batch-size reduction.

Fitting code, table, list, quote and HTML blocks remain atomic. Only an atomic block
that exceeds the available body budget takes the hard fallback:

1. Budget the embedding breadcrumb and separator first.
2. Take a source window no larger than the remaining body budget.
3. Prefer the last source newline in that window; if the line itself is too long,
   split at the hard boundary, moving back if necessary to preserve a surrogate pair.
   Keep CRLF together so normalization does not introduce an extra newline.
4. Emit pieces in source order. Normalize non-code whitespace as before. Preserve
   code whitespace, including nonempty whitespace-only fragments of very long lines.
   No body text is truncated. Code pieces need not be syntactically complete fences.

Hard-split atomic pieces are separate chunks, with **zero additional overlap** into,
between, or out of those pieces. Ordinary grouping and overlap remain, with a final
hard-budget check on Unicode overlap slack. Paragraph splitting keeps its existing
sentence/word preference and safe code-point boundaries.

Breadcrumb text is capped at `floor(maxChars / 2) - 2` code units (minimum zero),
reserving at least half the chunk for the body. A longer breadcrumb uses a
code-point-safe leading prefix and an ellipsis; a zero budget omits the breadcrumb
and separator entirely. Full `headingPath` metadata is retained. This does not alter
Vault Markdown. Custom `maxChars` must be at least two, the minimum capacity for any
Unicode code point. Combining sequences may cross chunks; surrogate pairs do not.

Each split piece has its own actual source fragment's half-open offsets and zero-based
line range, not the whole original atomic block's range. Source whitespace normalization
may omit blank/non-code boundary whitespace as before; meaningful body segments are
retained. The breadcrumb is presentation context, not part of that source range.
Ordinals remain consecutive. Text hashes and IDs use the existing canonical identity
algorithm, including full heading metadata and duplicate occurrence numbering.
Repeated input produces identical chunks, ranges, ordinals, hashes and IDs.

The optional `oversized` field remains for source compatibility with other strategies;
`MarkdownChunker` no longer sets it. There is no oversized-output exception.

## Failed-batch shape

Only after a batch finally fails, `IndexingProviderError.rejectedBatch` contains:

- `batchCurrent`, `batchTotal`
- `inputCount`, `largestInputChars`, `totalInputChars`
- `oversizedInputCount` (inputs above the default semantic maximum, 1,800)

The shape also accompanies indexing-layer invalid-vector failures. It is not
produced for dimension probes, successful attempts, or intermediate retries.
Explicit full build/rebuild publishes a copy alongside the existing safe failure
reason. Automatic and single-note sync do not publish detailed batch diagnostics.
Cached status and the product snapshot return independent copies.

Inline Semantic Intelligence and Discover show request/response failures with
batch, input count, largest input and total character count, in EN/RU. Secondary
copy explains that counts can help diagnose an input-specific rejection. It does
not claim the largest input caused it. Timeout/rate-limit displays stay uncluttered.
Notices retain the safe reason. Starting another operation, successful check/build,
settings change, clear and dispose clear previous diagnostics. Nothing is persisted
or sent to Companion. Settings-epoch ownership still suppresses stale results.

Every new diagnostic field is a number. There is no note text/path, heading, chunk
ID/hash, API key, Authorization header, endpoint, request/response body, raw exception
or stack in this shape. Rendering uses text nodes and fixed localized copy.

## Existing contracts

[PR #56 reliability policy](semantic-index-reliability.md) remains authoritative:
explicit build batches get 90 seconds; interactive requests and the fixed connection
probe retain 30 seconds. HTTP 429/5xx can retry the same batch twice (1s then 3s).
**HTTP 400 is not retried.** Neither are timeout, auth, other deterministic request
failures, invalid vectors or uncertain network failure. `requestUrl` cannot abort
an outstanding request, so retrying a timeout could duplicate work/cost.

Preparation completes before embedding. Progress reports the actual post-split
changed-chunk and batch totals. All required vectors must succeed and validate
before the one ordinary `VectorStore.applyChanges` call. A failed late batch commits
no upserts or deletes; an existing ordinary-build index stays unchanged and a first
build exposes no partial vectors. Confirmed destructive Rebuild still deletes the
old index first, as documented in PR #56; its failure leaves no usable replacement.

Changed boundaries can change IDs. Existing full reconciliation and note sync remove
obsolete chunk IDs and insert bounded replacements through the same atomic mutation.
Embedding-space identity is unchanged; boundary changes alone do not mark an index
incompatible. Existing unchanged normal chunks retain their identity. A subsequent
full sync or affected-note sync updates older oversized chunks; loading an index
alone does not rewrite it. There is **no persistence/schema migration**, staging file,
checkpoint or resume journal. Failed uncommitted embedding work must be repeated.

Search, Related Notes, Duplicates, Semantic Duplicate Health, Neighborhood and
Companion continue using their existing owners. Neighborhood remains vector-only,
revision-aware and Discover-selected. Passive startup/Health/Discover do no new
provider or indexing work. No release, version bump or tag is part of this change.

## Verification and manual retest

Tests cover >50,000-character code/table/list/quote/HTML and Unicode lines; broad
hard bounds including tiny budgets and huge headings; exact code/CRLF preservation;
source coverage and deterministic output; bounded reconciliation of old oversized
IDs; late failure atomicity; numeric-only rejected-batch shape and lifecycle clearing;
EN/RU UI and existing retry/timeout behavior.

The credential-free native harness is `scripts/semantic-chunk-bounds-native.mjs`.
It prepares six synthetic notes including huge SQL, table, list and single-line
blocks, validates every HTTP input against the 1,800-character maximum, and observes
post-split progress, success, HTTP 400 diagnostics and recovery in isolated Obsidian.
No personal vault or real provider credits are used.

[Native evidence](semantic-chunk-bounds-evidence/native.json): four passing scenarios
in Obsidian 1.12.7 / Electron 39.8.10. Six notes produced **194 chunks / 7 batches**;
every HTTP input was at most 1,800 characters. Forced HTTP 400 on batch 2/7 retained
32 inputs, largest 1,800, total 54,297, oversized count zero, with exactly one attempt
for that batch and zero commits. The next build succeeded with one commit and cleared
the failure. Three fresh startup/Health/Discover checks recorded zero Markdown reads,
builds, commits and provider calls. EN/dark/1280px and RU/light/390px UI were inspected;
these are desktop viewport checks, not mobile-platform coverage. Screenshots:
[building](semantic-chunk-bounds-evidence/building-en.png),
[EN rejection](semantic-chunk-bounds-evidence/rejected-en.png),
[RU rejection](semantic-chunk-bounds-evidence/rejected-ru.png).
The tested production bundle SHA-256 is
`2ac3db36ae79a4bac32ef590623f94f8d5166946b836a1286a5ee87d53870d40`.

Automated results: chunking 105, embeddings 28, indexing 151, semantic 405, Health
909; full suite **2,535 tests / 103 files**. Typecheck, focused ESLint, repository lint,
proposal mutation audit (5/5) and production build passed. Lint retains only the
existing `api.ts` streaming-fetch advisory. The audit's sandbox child-runner returned
no output; its authorized unsandboxed rerun passed. Independent review additionally
ran 2,000 deterministic randomized code-body reconstruction/bounds probes. No live
provider, personal vault, mobile OS, popout, screen-reader or custom-theme claim is made.


For your next real-vault retest:

1. Install this reviewed build and reload Obsidian. Keep the existing model/settings.
2. Use Check connection if needed, then explicitly Build semantic index (or Update
   Vault semantic index for an existing compatible index). Confirm the file count
   and provider privacy disclosure. Rebuild intentionally removes the old index.
3. Observe the updated chunk/batch totals. On failure, record only the final safe
   reason, batch X/Y, input count, largest input characters and total input characters.
   Do not share note content, paths, credentials, raw provider logs or screenshots
   containing secrets. Counts do not establish the rejected input's identity/cause.
4. A successful check clears the diagnostic; record those safe numbers first.
   A new build retries from the last committed state, with no resume of prior batches.
