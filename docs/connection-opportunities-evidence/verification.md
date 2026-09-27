# Connection Opportunities verification

Verified 2026-09-27 against baseline
`1235aeb4b12818b23cfe03bdc3918fd33d82e685` (merged PR #60), on
`feat/connection-opportunities`. Runtime implementation commit: `9719dc6`.
Later evidence/documentation changes do not change the tested plugin artifact.
The final PR head and its GitHub CI checks are reported in the PR handoff.

## Automated checks

| Check | Result |
| --- | --- |
| `npm ci` | PASS; dependency/lock files unchanged |
| `npm run typecheck` | PASS, including strict Health project |
| `npm test -- health` | PASS: 968 tests, 46 files |
| `npm test -- semantic` | PASS: 484 tests, 21 files |
| `npm test` | PASS: 2,662 tests, 108 files |
| `npx eslint health semantic` | PASS, no errors/warnings |
| `npm run lint` | PASS; existing unrelated `api.ts:402` fetch warning |
| `npm run audit:proposals` | PASS: all 5/5 mutations killed, restored tests passed |
| `npm run build` | PASS |
| Baseline-to-HEAD `git diff --check` | Checked at final commit |

The proposal audit initially received empty child-test output in the sandbox.
An unchanged run outside the sandbox passed; no test or audit contract was relaxed.
Independent code review found no blockers in pair semantics, coverage, source
ownership/freshness, race handling, or the read-only UI.

## Semantics and lifecycle evidence

The pure fixture covers a semantic-only candidate, aligned one-way, aligned
reciprocal, explicit-only without a score, a one-sided semantic union rank,
unavailable link metadata (including an observed explicit edge), a topology-only
endpoint, and a semantic-only endpoint. Both known endpoints are mandatory for
all three classes. Canonical deduplication and reversed source node/edge ordering
are tested. Invalid paths/endpoints, duplicates, self edges, scores, rank order
and bounds, mutual flags, and neighbor/edge disagreement reject publication.

Controller tests cover passive construction, ready-map reuse, explicit loading,
coalescing, stale semantic/topology, explicit refresh, unchanged Global Map
core/focus/reset, all seven semantic revision fields, changed revisions during
derivation, disposal during source load/derivation, listener removal, source
failure, and incomplete-inventory freshness rejection. No automatic comparison
recomputation occurs on notifications.

View tests cover Discover child selection, safe text sinks, case-insensitive local
search before the row limit, Showing X of Y, 50/100-row paging, and retained
`category=aligned`, `query="join"`, selected pair and `visibleLimit=100` across
Neighborhood A → B → C → Back. The comparison is not reloaded on return.

The real semantic runtime/store integration test composes Global Map,
ObsidianLocalVaultSource, VaultTopologyController, ConnectionComparisonController,
and Neighborhood. It observes zero provider `embed`, `requestUrl`, fetch, XHR,
Markdown-body read/cachedRead, VectorStore mutation, storage write/writeBinary,
and settings save during comparison load/refresh/focus/search-return work.

## Native synthetic fixture

Environment: **Obsidian 1.12.7, Electron 39.8.10, Linux desktop**. A disposable
`/tmp/connection-opportunities-smoke` vault/profile uses no credentials or personal
notes. The fixture seeds synthetic vectors offline through the existing fixture
and constructs real Markdown links for Obsidian's existing resolver. One endpoint
is omitted from synthetic inventory and one returns unavailable metadata to
exercise coverage. This is controlled fixture injection, not personal-vault access.

The native harness verifies these exact counts independently from derivation:

| Metric | Count |
| --- | ---: |
| Mapped semantic notes | 150 |
| Topology notes | 150 |
| Comparable notes | 148 |
| Sparse semantic pairs | 593 |
| Candidate pairs | 574 |
| Aligned pairs | 2 |
| Explicit-only pairs | 1 |
| Unclassified semantic pairs | 17 |
| Explicit pairs outside semantic map | 1 |

Both the one-way and reciprocal aligned examples and the explicit-only pair are
asserted by path identity. Native counts agree with an independent set-based
oracle. Exact source ranks and scores also have focused derivation tests.

**168 presentation cases passed**: EN/RU × dark/light/yellow accent ×
320/390/768/1024/1280/1440/1600 widths × candidate/aligned/explicit-only/stale.
There is no page/section horizontal overflow and no raw translation keys.
Discover retains `aria-current="page"` with seven primary tabs. Wide panes show
list/inspector columns; narrow panes stack them. Category/selection actions are
real buttons; all meaning is available as text. Enter-key activation selects a
pair and moves focus to the inspector. Selected rows use `aria-pressed`.

Native interaction checks cover show-more, search, category selection, selected
pair, Neighborhood recenter/Back, retained comparison identity and view state,
Global Map focus/reset without invalidation, topology stale/refresh, safe explicit
note opening, and zero runtime exceptions.

At passive Discover entry, source loads, vector reads, semantic work, topology
inventory/metadata, embeddings, network, body reads and writes all remain zero.
Opening comparison after Global Map reuses that map: **0 semantic loads, 0 vector
reads, 0 semantic analyses; 1 topology load, 2 inventory captures, 150 metadata
lookups**. Embeddings, fetch/XHR, Markdown-body reads, VectorStore mutation,
settings saves, plugin writes and Markdown writes remain zero across measured
operations. Plugin/index JSON/binary files and synthetic Markdown hashes are
unchanged. Host workspace layout persistence is outside plugin persistence.
`requestUrl` is instrumented in the real-runtime integration test, not the native
harness. Note opening is measured separately from comparison IO.

## Performance

Seven samples after one warmup, no fragile pass/fail timing threshold. Derivation
excludes Global Map/topology computation. DOM timings use the same bounded
renderer in native Obsidian and include layout, excluding derivation. The topology
fixture has five directed edges; these are sparse join/render measurements, not a
dense-topology stress test.

| Notes | Sparse semantic pairs | Derivation median (ms) | Native render/layout median (ms) | Initial rows |
| ---: | ---: | ---: | ---: | ---: |
| 150 | 593 | 6.20 | 23.10 | 50 |
| 300 | 1,342 | 10.26 | 20.30 | 50 |
| 500 | 2,341 | 16.08 | 20.00 | 50 |

The join is O(N + S + T), with O(P log P) deterministic output sorting. No new
all-pairs similarity pass is introduced. Results are observations on this host.
Raw samples/counters are in [derivation-benchmark.json](derivation-benchmark.json)
and [native-summary.json](native-summary.json).

## Artifacts and limits

- `main.js` SHA-256: `d7fd2fb4742fd997229a649ee6624d4956cdb91c9f42ea5cee7b6d7dd9304e57`
- `styles.css` SHA-256: `45beeb9bb82b16c6efe8e474094a724aded5f2b21e033cd64b25049a06ac4b66`
- Screenshots: [desktop](desktop.png), [390px light](narrow.png), [yellow accent](yellow.png).

Not verified: actual mobile OS, popout windows, screen-reader speech, third-party
themes, or real-vault false-positive quality. A yellow theme-token override was
verified; it is not a claim about arbitrary custom themes. No personal vault was
inspected. Follow the [manual ~145-note acceptance instructions](../connection-opportunities.md#manual-acceptance-on-the-existing-145-note-map)
and inspect the top 10–20 candidates before considering any Findings design.

No new embeddings/provider/network, Markdown-body reads, parser, semantic engine,
arbitrary threshold, Markdown mutation, Findings, persistence, dependency,
version bump, tag, or release. Explicit-only is never labelled semantically far.
