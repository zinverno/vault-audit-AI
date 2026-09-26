# Semantic index reliability

Baseline: `aff051f436eba66a824f286bc62ed8be1b77aad0` (merged PR #55).

A real vault of about 159 notes passed its OpenRouter connection test, then a long
initial semantic-index build failed with generic “needs attention” copy. Checking
the connection succeeded again and returned to “index required”. The original
failure was **not reproduced or diagnosed**: timeout, rate limit, server/network
failure, or an invalid response remain possibilities. This change makes the next
failure diagnosable without logging provider payloads or vault content.

Subsequent HTTP 400 observations and hard character bounds are documented in
[Semantic chunk bounds](semantic-chunk-bounds.md), including transient failed-batch
shape diagnostics. The original incident cause remains unproven.

## Failure boundary

`embeddings/errors.ts` defines `EmbeddingError`. It carries a fixed localized
message, a safe code, and an optional numeric HTTP status. It does not retain the
original network exception, request/response bodies, URL, headers, or credentials.

| Condition | Embedding code | Cached indexing reason |
| --- | --- | --- |
| Waiting deadline expires | `timeout` | `provider-timeout` |
| Transport rejects / no response | `network` | `provider-network` |
| HTTP 401/403 | `auth` | `provider-auth` |
| HTTP 429 | `rate-limit` | `provider-rate-limit` |
| HTTP 500–599 | `server` | `provider-server` |
| Other non-2xx status | `request` | `provider-request` |
| Invalid JSON, count, indices, shape, numbers, or dimensions | `invalid-response` | `provider-response` |
| Source read / input preparation error | — | `source` |
| Local index storage error | — | `storage` |
| Incompatible embedding space | — | `compatibility` |
| Unclassified failure | — | `unknown` |

Existing vector validation remains strict, including Float32 range, finite values,
nonzero vector norm, and dimensions. `IndexingProviderError` preserves a typed
`EmbeddingError` cause for both dimension probes and batches. Unknown exceptions
are discarded at that boundary. Provider contract errors carry `invalid-response`.

`SemanticStatus.failure` and the product snapshot contain only the safe reason.
Inline Semantic Intelligence, Discover, and explicit build failure Notices use the
same EN/RU reason mapping. Unknown exception messages and raw HTTP bodies are never
rendered. Compatibility retains its existing state and explicit Rebuild action.
Errors offer the existing Check connection / Change connection actions; a successful
check clears the diagnostic and exposes Build when the index is empty. This is
transient in-session state, not an error history or persisted setting.

## Timeout and retry policy

The provider API accepts optional `EmbeddingRequestOptions.timeoutMs`; both provider
implementations and the lazy existing-index adapter forward it.

| Caller | Timeout | Automatic retry |
| --- | --- | --- |
| Connection test / fixed-phrase dimension probe | 30 seconds | None |
| Interactive semantic query | 30 seconds | None |
| Explicit full Vault build or rebuild, embedding batches | 90 seconds | HTTP 429/5xx only |
| Automatic sync and single-note indexing | Existing 30-second default | Existing no-retry policy |

A batch contains up to 32 changed chunks in the normal indexing configuration.
Multi-input embedding can legitimately take longer than the fixed connection-test
phrase, so explicit full builds select 90 seconds without slowing interactive
queries. The initial dimension probe remains short and is not retried.

The same ordered batch gets at most **three total attempts**: initial request,
then a 1,000 ms delay, then a 3,000 ms delay. Backoff uses runtime timers with an
injectable sleep function for tests. It does not re-read notes, re-chunk, skip a
failed batch, or write successful earlier batches. No retry dependency is added.

**Timeout is never retried.** Obsidian `requestUrl()` cannot abort the underlying
HTTP operation; the timer only stops waiting. Starting another request could
perform duplicate provider work or incur duplicate cost while the first request
is still running. A late settlement cannot update the completed caller. Network
rejection is also not retried because this transport cannot prove whether the
provider already processed the request. Auth, deterministic 4xx, malformed JSON,
invalid vectors, source/storage errors, and compatibility errors are not retried.

## Progress and ownership

`IndexingExecutionOptions.onProgress` is optional, synchronous and presentation
neutral. Each callback receives a fresh object; listener exceptions are ignored.
There are no note paths, content, chunk text, provider payloads, keys, or URLs.

Phases are `reading`, `preparing`, `embedding`, `retrying`, and `committing`.
Reading starts before `source.readAll()`. The document total becomes known after
that call. Preparation determines changed chunks; embedding publishes completed /
total changed chunks and current / total batches. Completed means vectors have
passed validation in memory, not that those chunks are already committed. Retry
progress includes the batch, retry reason, retry number and maximum (1/2 or 2/2);
the UI presents total attempt numbers (2 of 3 or 3 of 3).

Only phase, batch start/completion and retry boundaries publish progress. Native
`<progress>` is indeterminate before a nonzero denominator exists, and carries a
visible stage/count plus accessible label once numeric. Both inline setup and
Discover reuse the same renderer and existing engine subscription, with no polling,
ETA, token or cost estimate. Automatic single-note synchronization keeps its simpler
busy state. Clear, settings change, dispose, failure and success remove progress.
Successful status check/build/rebuild clears the previous failure.

An explicit full operation captures the existing settings signature/epoch.
`isCurrent` stops obsolete work before source reads, batches and delayed retries;
`shouldCommit` remains the final commit guard. Old progress, errors, success Notices
and post-build Companion snapshots are not published after settings change or
dispose. Already submitted HTTP requests cannot be cancelled. Once an atomic store
commit itself has started it follows the existing store durability protocol; this
change does not add rollback of a completed commit on later settings edits.

## Atomicity and rebuild distinction

Ordinary build/update keeps the existing boundary:

1. Read and prepare required changed chunks and removals.
2. Obtain and validate **all** required vectors in memory.
3. Check ownership and perform **one** `VectorStore.applyChanges` mutation.

A permanently failing later batch discards the prepared mutation, including any
planned deletes. The existing generation, entries and durable files remain
unchanged by that build. A failed first build exposes no partial vectors or usable
index. Tests compare the store and persistence against their post-initialization
baseline; this is not a blanket claim that storage initialization can never create
structural artifacts.

**Confirmed destructive Rebuild retains its existing contract**, as explicitly
requested during implementation: the confirmation warns that the old index is
removed first. A subsequent failure leaves no usable replacement; it does not
restore that deleted index. The replacement still has no batch-by-batch commits.
Cancelling the confirmation keeps the old index. Preserving the pre-rebuild index
across failures requires a separate durability design.

## Privacy, regressions and limitations

No checkpoint, staging-vector file, resume journal, new persistence file, schema
migration or dependency is introduced. Progress/failure diagnostics are never sent
to Companion. Existing successful mirror behavior remains; obsolete builds do not
publish a stale success or mirror. Search, Related Notes, Potential Duplicates,
Semantic Duplicate Health and Semantic Neighborhood continue through their existing
owners. Neighborhood still reads existing vectors only, preserves revision checks,
and remains a Discover child route. Opening the plugin, Health, or Discover adds no
index build or provider traffic.

A failed initial build **restarts embedding from the last committed semantic index
state**. Successful uncommitted batches are not saved for resume. Checkpoint/resume
is future work. The 90-second limit can still expire; exact provider-side work/cost
cannot be known after timeout/network failure. Retry-After parsing, cancellation of
in-flight `requestUrl`, per-note reading progress and ETA are outside this change.

## Verification

Automated tests cover transport classifications and body redaction; default and
explicit timeout deadlines; fixed-phrase connection tests; 429/5xx recovery and
exhaustion; no retry for timeout/auth/invalid response; existing/new-store late-batch
atomicity; monotonically bounded progress; throwing/mutating listeners; settings
changes during backoff and success publication; status/snapshot copies and reset;
and EN/RU failure/progress/retry rendering on both Semantic Intelligence surfaces.

The native harness is `scripts/semantic-index-reliability-native.mjs`. It prepares
159 synthetic Markdown notes and a credential-free local OpenAI-compatible HTTP
server, loads the actual plugin artifact in isolated Obsidian, and exercises success,
429 recovery, 5xx exhaustion, timeout with no retry, auth, invalid response, and
success after failure. The native timer is accelerated only for reproducible timeout
and retry smoke; fake-timer unit tests check the real deadlines. [Native evidence](semantic-index-reliability-evidence/native.json) records 10 passing
scenarios in Obsidian 1.12.7 / Electron 39.8.10, with 159 notes, EN/dark/1280px and
RU/light/390px. It also checks the preserved destructive rebuild failure contract.
Eight fresh loads/Health/Discover openings made zero provider requests/builds;
observed opening-time Markdown reads were zero. The tested production bundle SHA-256
is `414cbad5f160155e23a43b8e128acb6f3c50881cf943aef61662e5aa53fd2d98`.
Screenshots temporarily hide transient Notice overlays so the inline UI stays
visible; Notice text is checked separately for raw-payload leaks.

Automated verification: embeddings 28, indexing 146, semantic 400, Health 903;
full suite **2,501 tests / 103 files**. Typecheck, focused ESLint, repository lint,
proposal mutation audit and production build are required gates. Repository lint
retains only the existing `api.ts` streaming-fetch advisory. No mobile OS,
popout, screen-reader, custom-theme or live-provider claim is made.

## Manual real-vault retest

1. Install the reviewed build, reload Obsidian, and keep your existing embedding
   configuration. Do not paste keys or personal note content into logs or screenshots.
2. Open Health or Discover → Semantic Intelligence. Use Check connection if needed.
   A successful check is light; it does not prove that a full build will succeed.
3. Choose **Build semantic index**, or the existing **Update Vault semantic index**
   command for a compatible index. Confirm the file count and provider disclosure.
   Use **Rebuild** only if you intend to delete the previous index after its warning.
4. Observe stage, chunk and batch counters. Allow informational automatic retries
   for rate limit/server failures. No additional confirmation is needed.
5. On failure, record only the displayed safe reason, approximate duration and the
   last numeric counters you observed. The running bar disappears. After a timeout,
   allow the provider's outstanding request time to settle before manually retrying.
6. Check the connection or adjust settings if indicated, then explicitly build
   again. Uncommitted batches are re-embedded; success should reach Ready.
