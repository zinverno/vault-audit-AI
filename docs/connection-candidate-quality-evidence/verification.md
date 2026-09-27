# Candidate quality V2 verification

Baseline: `0242c09f931670288e2968e431d5afea252d9384` (merged PR #61).
Implementation: `551e756cd49789668e13bf817c4331426c928c4a`.
The following evidence-only commit does not change the tested plugin artifact.
The final PR head and exact-head GitHub CI are recorded in the PR handoff.

## Automated verification

| Command | Result |
| --- | --- |
| `npm ci` | PASS; no dependency or lockfile changes |
| `npm run typecheck` | PASS, including strict Health project |
| `npm test -- health` | PASS: 984 tests / 47 files |
| `npm test -- semantic` | PASS: 484 tests / 21 files |
| `npm test` | PASS: 2,678 tests / 109 files |
| `npx eslint health semantic` | PASS, no warnings |
| `npm run lint` | PASS; existing unrelated `api.ts:402` fetch warning |
| `npm run audit:proposals` | PASS: 5/5 mutations killed, restored tests passed |
| `npm run build` | PASS |
| Baseline-to-HEAD `git diff --check` | PASS on implementation commit; repeated at final head |

The audit's child tests initially produced empty output in the sandbox. The
unchanged audit passed outside it. Native CDP requires host localhost access;
one launch also preceded CDP readiness and was rerun after startup. The native
harness's initial split leaf count stopped iteration by returning `Array.push`'s
number; void callbacks fixed the harness, and the complete matrix then passed.
No product/test contract was weakened. Final UI/connection focused checks passed
after the accessible row-label and state-snapshot assertion refinements.

Review inspected the full diff, all affected callers, snapshot ownership,
malformed-input rejection, filter composition and public navigation APIs. No
outstanding blocker was found; no unrelated refactoring or dependency changes.

## Derivation and review tests

- Existing top-five intersection yields canonical `[C.md,D.md]`; frozen array,
  copied input, explicit endpoint exclusion, and mapped membership are checked.
- Exact rank examples 1/3 → mutual top-3, 2/5 → mutual top-5, 2/undefined → one-sided.
  Both semantic categories receive evidence; explicit-only has none.
- Mixed rank classes/shared counts/cosines and equal-score left/right path ties
  verify the exact ordering, without a composite score.
- Unknown, duplicate and self neighbor paths fail closed along with the retained
  original source validation and pair-level `linksAvailable` tests.
- Useful → Not useful → Unsure → Clear; candidate-only review; deep equality of
  comparison/map/topology and unchanged comparison/pair identity.
- Combined candidate + mutual top-3 + unreviewed + `JOIN` query + hide Excalidraw;
  counts exclude missing/non-candidate IDs and do not depend on visible filters.
- `.excalidraw.md` visible by default; either endpoint hides case-insensitively,
  `.EXCALIDRAW.MD` matches, `my-excalidraw.md` and extended suffixes do not.
  Source candidate count and pair array remain unchanged.
- Refresh clears verdicts on a new capture, retained capture preserves them;
  category/search/pagination and Neighborhood round-trip preserve session state.
- EN/RU row/inspector text, accessible full rank descriptions, verdict pressed
  state and focus restoration, raw text safety and 50/100-row paging.
- Pair opening rejects invalid, missing, out-of-scope and non-Markdown files
  before creating any leaf, rechecks the second endpoint after the first open,
  and uses only a new tab plus public typed vertical split.

## Native synthetic acceptance

Isolated `/tmp/connection-opportunities-smoke` vault/profile, no credentials or
personal vault. Linux desktop, Electron 39.8.10; user agent reports Obsidian
1.12.7 (the profile startup log names the updated 1.13.7 app package). This is a
single desktop environment, not a cross-version certification.

The existing offline vector fixture and real Semantic/Topology/Comparison
controllers are reused. Two synthetic paths are renamed to Excalidraw suffixes
before runtime observation. There is no new semantic fixture engine. An
independent set-based oracle checks source counts and shared-neighbor sets.

| Source metric | Count |
| --- | ---: |
| Mapped notes / comparable notes | 150 / 148 |
| Sparse semantic pairs | 593 |
| Candidates / aligned / explicit-only | 574 / 2 / 1 |
| Unclassified semantic / explicit outside map | 17 / 1 |
| Mutual top-3 / mutual top-5 / one-sided candidates | 61 / 96 / 417 |
| Candidates hidden by Excalidraw option | 10 |

Shared-neighbor counts 0, 1, 2, 3 and 4 occur in the fixture. Candidate total
remains 574 after hiding the 10 Excalidraw pairs.

**168 cases passed**: EN/RU × dark/light/yellow accent ×
320/390/768/1024/1280/1440/1600 widths × candidate/aligned/explicit-only/stale.
No page/section horizontal overflow or untranslated keys. Filters wrap; inspector
stacks below the list in narrow panes and remains a usable second column in wide
panes. All controls are native inputs/buttons, selected rows use `aria-pressed`,
and Enter moves selection focus to the inspector. Only theme tokens are used in
product styles; yellow is a controlled accent-token override.

The actual native review flow selects mutual top-3; labels distinct candidates
Useful / Not useful / Unsure; clears/reapplies a verdict; filters Unreviewed;
hides Excalidraw; searches `.md`; uses Show more; explores Neighborhood and
recenters twice; returns. Category, rank, review filter, toggle, nonempty query,
selected pair, **visibleLimit=100**, three verdicts and comparison identity are
all retained. Core/focus/reset retains them too. Successful refresh clears the
reviews. Category switching and search keep verdicts.

Side-by-side opening was verified in both locales: exactly **two new leaves**,
correct left/right note paths, adjacent horizontal positions and matching top
coordinates, every pre-existing leaf retained. Note opening is measured apart
from comparison's zero-read boundary.

Native passive Discover counters are all zero, including comparison-source
loads, semantic computation, topology capture, vector reads, provider/network,
Markdown read/cachedRead, storage, settings and localStorage. Opening comparison
reuses the ready Global Map (zero loads/computation/vector reads) and explicitly
loads topology once. Review/filter/navigation/refresh observation reports zero
embed/fetch/XHR, Markdown-body read/cachedRead, store mutation, plugin writes,
settings saves and localStorage writes. `requestUrl` is covered by the real-runtime
integration test. Markdown and plugin JSON/binary hashes remain identical,
including after explicit pair opening; Obsidian's workspace layout is excluded
from plugin persistence claims. No runtime exceptions during the matrix.

## Artifacts and limits

- `main.js` SHA-256: `94573b73a5ef8ddd896a302dd367ee7fed5364a9fc762ea3ca847b8c9d17ceac`
- `styles.css` SHA-256: `6e1e50169a75fdc93e338c444f1054996447b3deaf47cdcb88d0afa434985542`
- [Native counters, matrix and interaction states](native-summary.json)
- [Derivation timing samples](derivation-benchmark.json)
- [Desktop](desktop.png), [390px light](narrow.png), [yellow accent](yellow.png)

Derivation medians for 150/300/500 notes: 7.93 / 14.10 / 24.13 ms. Native bounded
render/layout medians: 26.40 / 25.00 / 25.10 ms, always 50 initial rows. Seven
samples after a warmup; observational only, no CI timing thresholds. Shared
intersection stays bounded by K=5; no additional quadratic similarity work.

Not verified: actual mobile OS, popout windows, screen-reader speech, third-party
themes or real-vault candidate usefulness. The user's personal vault was not
inspected. Follow the [manual first-20 plan](../connection-candidate-quality.md#manual-real-vault-acceptance)
and report raw verdict counts before designing Connection Health.

Confirmed: no opaque score, cosine threshold, learned ranking, Markdown mutation,
Findings, persisted review state, second semantic engine/parser, new dependency,
version bump, tag or release.
