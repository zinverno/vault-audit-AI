# Semantic Map Focus and child-route return verification

Baseline: `0b9adf2f4955aa6ce43e6d45b7734912956cf482`, clean current main after
`git switch main` and `git pull --ff-only`. PR #59 was verified merged at this SHA.
Branch: `feat/semantic-map-focus`. Implementation commit: `a6262d0`.
The final documentation/evidence commit and exact-final-HEAD CI are reported in
the PR handoff. No version, dependency, tag, release or merge is part of this work.

## Navigation

`SemanticNeighborhoodRoute` explicitly carries optional
`returnTo: "discover" | "semantic-map"`; omission defaults to Discover.
Both semantic surfaces keep Discover current in the seven-item primary rail.
Discover entry returns to Discover. Global Map's Explore neighborhood returns
to Global Map, including after A → B → C local recentering, Choose another note,
Refresh and neighbor selection. EN/RU Back labels reflect the origin.

Back calls only transient view navigation. It preserves the same global product
map, focused data, selected node, search query, pan and zoom. It invokes neither
`load()` nor `analyzeGlobalSemanticMap()`. A changed index returns to the retained,
visibly stale map; there is no silent refresh or browser/persistent history.

## Focus engine, ownership and geometry

- `analyzeSemanticFocus(path)` reads one validated vector snapshot and reuses the
  existing `prepareSnapshot`, `eligible`, normalized document-centroid and cosine
  logic. It returns only safe path/score data for every eligible document,
  including documents outside top five. Focus comparison is O(N·D) after centroid
  preparation; it does not rerun O(N²·D) global analysis.
- The same 500-document cap applies. The product port requires a successfully
  loaded, current map and mapped source. Indexed but ineligible/unmapped sources
  produce a controlled message. Invalid/missing/duplicate/nonfinite scores reject
  the whole focus result without losing a prior valid map/focus.
- One session `SemanticGlobalMapController` owns deeply frozen focus data against
  the captured map revision, the same seven revision fields, pending operation,
  epoch and disposal guard. Shared leases exclude concurrent index writes.
  Revision changes mark map and focus stale; late R1 results cannot publish after
  R2, reset or disposal. A successful explicit Refresh returns to Vault core.
- Focus is an explicit inspector button. Search/node selection does not focus.
  Focus source is at (500, 500), with a ring and Focused note/basename text replacing
  the virtual core glyph. Visible inspector text identifies the center outside SVG.
- Other nodes retain the same absolute radius mapping:
  `120 + (1 - (cosine + 1) / 2) * 290`. Higher score means no greater radius.
  Global cached angles/sectors, connectedness, node sizes and sparse top-five
  relationships are unchanged. Reset returns the exact original core positions
  with no engine work. Updates are immediate, including reduced motion.
- Rings remain +1 inner / 0 middle / -1 outer. Focus captions say Similarity to
  selected note; inspector says Similarity to focused note. The radial min/max/
  median excludes self, and self-similarity is omitted from the inspector.
  Connectedness summary remains global. The local 10-neighbor Neighborhood is
  still a separate action.
- Controls are native buttons; no SVG node enters Tab order. Reset restores
  keyboard focus to the inspector action (or search when no node is selected).

## Automated checks

| Check | Result |
| --- | --- |
| `npm ci` | Passed; lockfile unchanged |
| `npm run typecheck` | Passed, including Health compilation |
| `npm test -- semantic` | 483 passed / 21 files |
| `npm test -- health` | 927 passed / 44 files |
| `npm test` | 2,620 passed / 106 files |
| `npx eslint semantic health` | Passed, no warnings |
| `npm run lint` | Passed; existing `api.ts:402` fetch advisory only |
| `npm run audit:proposals` | 5/5 mutations killed; restored tests passed |
| `npm run build` | Passed |
| `git diff --check 0b9adf2f4955aa6ce43e6d45b7734912956cf482..HEAD` | Passed at final HEAD |

Regression tests cover Discover and Global return, repeated local recentering,
chooser/refresh origin, exact global map identity/query/selection/viewport,
known A/B/C cosines with multichunk Neighborhood parity, full selected-to-all
coverage, 500/501 cap, malformed snapshot/result rejection, immutable scores,
radial monotonicity, exact angular/sector/size stability, exact local reset,
all seven stale revision fields plus readiness changes, races with/without status
notification, reset during focus, a newer focus after reset, and disposal.

The real runtime/store integration instruments provider embed, `requestUrl`,
`fetch`, XHR, `vault.read`, `vault.cachedRead`, Markdown enumeration, adapter writes,
plugin settings writes and VectorStore mutation. All remain **zero** across
load/focus/reset/refresh/search. Focus uses one snapshot; reset adds no snapshot,
focus call or global analysis. A held focus lease makes Clear wait.

The proposal audit's sandbox child process returned empty output; the unchanged
harness passed outside the sandbox. `npm ci` reported seven existing dependency
advisories (4 moderate, 3 high); no dependency or lockfile changes were made.

## Native desktop

Isolated synthetic **Obsidian 1.13.7 / Electron 39.8.10, Linux**, 1,536 dimensions,
three chunks/document. No personal-vault content or credentials were used.
Final production bundle SHA-256, matched to the installed native plugin:

```
86b904461a532dfe460f1f67ca9c495e0963a5fa7ad0263879b88059ffe50685
```

[Native evidence](native.json): **420 cases** = EN/RU × 10 states × dark/light/
yellow accent × 320/390/768/1024/1280/1440/1600px. This includes every requested
390/768/1280/1600 combination. States: core overview, selected, stale, singleton,
over-cap, disabled, absent, focus, focus inspecting another note, focused stale.
Assertions cover page overflow, seven tabs/Discover current, translation keys,
SVG Tab stops, label overlap, fixed rings, exact summaries, bounded unchanged
sizes, real focused center and hidden virtual core. Zero runtime exceptions.
The checked per-node size arrays are stored as min/max in the compact evidence.

Native interaction sequences passed in both languages:

1. Discover → Neighborhood → Back to Discover.
2. Global → Neighborhood → Back to Global with the same map/focus/query/selection
   and real pointer-pan/wheel-zoom state; **all counters zero on Back**.
3. Global → Neighborhood A → B → C → Choose another → Refresh → Back, preserving
   origin and global view state with no global analysis.
4. Core → focus → reset: one focus snapshot, no global analysis, exact original
   coordinates restored, unchanged sizes/angles, **all counters zero on reset**;
   reset preserves meaningful keyboard focus.
5. Focus → Neighborhood → fixture index revision change → Back: visibly stale,
   no automatic analysis. Explicit Refresh computes once and resets to Vault core.

Existing native pointer selection, drag threshold, wheel zoom, Fit, keyboard
Enter, shared-controller views, loading focus, Open note and Topology viewport
regressions also pass. Reduced motion introduces no motion. Plugin JSON/binary
hashes stay unchanged within measured read-only operations. Fixture mutations
and explicit Open note are separate boundaries. Native counters cover embed,
fetch/XHR, note reads, index mutations and plugin writes; the real-runtime test
instruments module-local `requestUrl`. Host workspace layout writes from opening
leaves/resizing windows are distinct from plugin persistence; no plugin route or
focus layout persistence was added.

The native fixture initially checked revision state before awaiting its synthetic
store mutation; fixing the harness await produced truthful stale evidence.
This did not require changing product freshness logic.

Screenshots: [focused map](semantic-map-focus.png), [390px](semantic-map-focus-390.png),
[yellow accent](semantic-map-focus-yellow.png), [focused stale](semantic-map-focus-stale.png).

Reproduce with the existing synthetic preparation and native scripts described in
[Global Semantic Map](../global-semantic-map.md#verification-and-performance).
Mobile OS, screen-reader speech, popout windows, third-party themes and live
provider behavior are untested; narrow Linux desktop and yellow accent do not
claim those environments.

## Review and scope

Independent read-only correctness/architecture/security/performance review found
no actionable issue. The final review also checked callers, shared lease, complete
score projection, epoch/reset/disposal guards and route-origin ownership.

Confirmed: no new embeddings, provider/network work or Markdown-body reads on
focus/reset/return; no semantic-index mutation, settings/data/layout persistence,
Semantic↔Markdown comparison, recommendations, Findings, AI labels, ANN/HNSW,
rank-based Neighborhood, dependency changes, version bump, tag or release.
The PR remains open/unmerged; exact-final-HEAD CI is recorded in the handoff.
