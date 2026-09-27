# Connection Opportunities

Connection Opportunities answers: **Where does the semantic structure of my
knowledge differ from the links I explicitly created?** It is an exploratory,
read-only Discover child page. Candidates are prompts for inspection, not proof
that a Markdown link should exist. There is no health or recommendation score.

## Sources and ownership

`ConnectionComparisonPort` exposes a session snapshot and explicit `load` and
`refresh` operations. One `ConnectionComparisonController` is constructed in
`registerHealth` and shared by Health workspace views. Its only source dependencies
are `SemanticGlobalMapPort` and `VaultTopologyPort`. It consumes their published
`SemanticGlobalMap` and `VaultTopologySnapshot`.

The existing Global Map controller owns document centroids, cosine computation,
its 500-note cap, sparse top-five union, and semantic freshness. Comparison never
reads raw vectors, computes centroids, invokes another semantic engine, or calls
`analyzeGlobalSemanticMap` directly. Focus mode is a separate projection: changing
focus with the same map/revision leaves the comparison snapshot identical.

The existing topology controller owns metadata capture through
`ObsidianLocalVaultSource.captureMetadata`, `createLocalAnalysisContext`, and
resolved outgoing relationships. Comparison uses final topology edges and
`linksAvailable`; it never accesses MetadataCache, parses Markdown, or reads
note bodies. Unresolved targets are outside this comparison.

`deriveConnectionComparison(semantic, topology, capturedAt)` is pure. It validates
the consumed paths, duplicate nodes/edges, endpoints, self edges, finite cosine
scores, neighbor order/rank bounds, score and mutual-rank consistency, metadata
availability, and revisions. Invalid inputs reject the entire result. Public
snapshot, pairs, semantic/Markdown facts, and both revisions are copied/frozen.
There are no DOM, filesystem, provider, or Obsidian calls in derivation.

## Exact relationship semantics

A semantic pair is one canonical relationship in the **existing sparse top-K
union, K = 5**: A ranks B in its top five **or** B ranks A. Hidden all-pairs cosine
relationships are never counted. There is no similarity threshold or setting.

A note is fully comparable only if it is a Global Map node, a topology node,
and its topology `linksAvailable === true`. Both endpoints must be comparable
before publishing a primary-class pair.

| Category | Sparse semantic pair | Resolved Markdown relationship |
| --- | --- | --- |
| Candidate | Present | Neither direction, with both endpoints known |
| Aligned | Present | At least one direction |
| Explicit-only | Absent | At least one direction, both endpoints mapped and known |

**Explicit-only means linked outside both notes' semantic top-five lists. It does
not mean semantically far, unrelated, a bad link, or low cosine.** V1 does not
compute an exact score for explicit-only pairs and never displays a fabricated
zero. An explicit link may reflect chronology, contrast, prerequisites, or other
intent that semantic ranking does not represent.

Semantic relationships are symmetric; Markdown edges are directed. Pair identity
is the collision-free JSON tuple of canonical lexical `leftPath < rightPath`.
A/B and B/A produce one row. Markdown facts distinguish left-to-right,
right-to-left, and reciprocal. Missing Markdown facts mean **none**, and this
claim is made only for fully comparable pairs.

Semantic scores come directly from sparse edges, checked against their neighbor
entries. Ranks are positions 1–5 in each note's already ordered neighbor list.
An undefined rank means only the other endpoint contributed this union edge.
`mutualTopK` requires both ranks; cosine symmetry does not establish mutual rank.
Candidates and aligned pairs sort by mutual rank first, then score descending,
then left/right paths. Explicit-only sorts by paths without semantic scoring.
All displayed scores reuse `formatSemanticScore` (three decimals).

## Coverage

Partial link metadata does **not** block pairs whose two endpoints are known.
Even an observed A → B is excluded when B's metadata is unavailable: claiming
one-way would otherwise conceal an unknown reverse relationship.

The summary exposes mapped/comparable notes, sparse semantic pairs, all three
class counts, unclassified semantic pairs, and explicit pairs outside the map.
Coverage details also expose total topology notes, mapped notes missing topology,
mapped notes without link metadata, and mapped explicit pairs with unavailable
metadata. Counts for explicit relationships are **canonical pairs**, so reciprocal
links count once.

- A semantic edge with a missing topology endpoint or unavailable endpoint link
  metadata increments `unclassifiedSemanticPairCount`; it is never a candidate.
- An observed explicit pair with either endpoint outside the semantic map
  increments `explicitOutsideSemanticMapCount`; it is never explicit-only.
- An observed explicit pair with both endpoints mapped but unavailable metadata
  increments `unclassifiedExplicitPairCount`; it has no primary classification.
  This can overlap the unclassified semantic count when the union includes it.
- Indexed notes may be semantically ineligible and thus absent from the map;
  unindexed topology notes and semantic nodes absent from current topology are
  also possible. The comparison does not infer why an endpoint is unmapped.

Coverage notices are neutral. They do not turn missing metadata into an error or
claim that incomplete analysis proves absence. Incomplete inventory enumeration
still cannot establish freshness under the existing Local Vault revision helper;
it must be refreshed. This differs from partial per-note link metadata, which the
comparison supports.

## Freshness and IO

Opening Discover remains passive. **Open connection comparison** is the explicit
boundary: ready maps are reused; absent maps load through existing source ports.
Comparison checks for stale sources before loading, including topology whose
`load` otherwise permits refreshing a stale capture. Stale input never becomes a
new current comparison merely by opening the page.

**Refresh comparison** explicitly refreshes both owners according to their
coalescing contracts and derives only from final current snapshots. Concurrent
operations coalesce. Global Map uses existing vectors; topology uses inventory
and metadata only. Source subscriptions mark a ready comparison stale on source
map/revision replacement, stale/unavailable/loading state, or topology changes.
They do not recompute automatically. Retained rows remain labelled outdated.

Every result owns both the seven-field `SemanticIndexRevision` and
`LocalVaultRevision`, using the existing equality helpers. The semantic equality
helper now lives at the Health product contract and is re-exported at its existing
semantic import path; its seven comparisons are unchanged. Source identity and
revision checks, an operation epoch, and a publication microtask prevent a changed
or disposed operation from publishing a current result. Disposal removes both
subscriptions without disposing the shared source controllers.

Across comparison load, refresh, search, filtering, selection and Neighborhood
return: no new embeddings, provider/network requests, Markdown-body reads,
VectorStore mutations, note writes, plugin-settings writes, or persistence files.
Opening a note is a separate explicit navigation through the existing
`openHealthNote` safe action boundary. Neighborhood exploration uses its existing
read-only semantic operation and keeps the comparison origin across recentering.

## Interaction

Discover retains the seven primary workspace tabs and `aria-current="page"` on
Discover. Its semantic exploration area offers Neighborhood, Global Semantic Map,
and Connection Opportunities when Semantic Intelligence is ready.

The comparison starts on Candidates. Internal buttons select Candidates, Aligned,
and Explicit-only. Case-insensitive substring search matches both basenames and
full paths before applying the visible-row limit. Each category starts at 50
rows; **Show 50 more** expands explicitly. **Showing X of Y** always reflects the
active category and search. Three compact count cards have no normalized score.

Selecting a real pair button reflects `aria-pressed` and focuses the inspector,
including when it follows the list in a narrow pane. The inspector shows both
names/paths, category, exact stored semantic score when available, both ranks,
mutual status, and Markdown direction. Its only actions open either note or
explore either Neighborhood. These actions use native buttons and text sinks.
No path is interpolated into a CSS selector or rendered as HTML/Markdown.

Category, query, selected pair, and show-more limit remain in view memory during
Connection Opportunities → Neighborhood(A) → B → C → Back. Returning does not
reload comparison. Closing the workspace clears view state; plugin restart clears
comparison. No settings, dismissals, history, or persisted selection are added.

## Verification

See [the synthetic verification report](connection-opportunities-evidence/verification.md)
for the native matrix, counts, separate derivation/DOM timings, automated checks,
and platform gaps. Rerunnable commands:

```sh
node scripts/connection-opportunities-benchmark.mjs /tmp/connection-opportunities-benchmark.json
npm run build
node scripts/connection-opportunities-prepare.mjs /tmp/connection-opportunities-smoke
# Launch isolated Obsidian with that vault/profile and a localhost CDP port.
node scripts/connection-opportunities-native.mjs http://127.0.0.1:9260 /tmp/connection-opportunities-smoke
```

Source lookup and pair classification are O(N + S + T), followed by deterministic
pair ordering O(P log P). S is sparse semantic relationships, T is directed
topology edges, and P is published pairs. There is no new quadratic similarity
work. Timings have no CI thresholds. DOM timing measures the bounded renderer
separately from derivation and underlying Global Map computation.

## Manual acceptance on the existing ~145-note map

The implementation and automated checks do not inspect your personal vault.
To collect real-vault false-positive evidence manually:

1. Open Discover and your existing Global Semantic Map. Return to Discover and
   choose **Open connection comparison**. If a source is outdated, use Refresh.
2. Record mapped/comparable notes, semantic pairs, candidate, aligned,
   explicit-only, and unclassified counts; also record explicit pairs outside
   the map and the detailed coverage gaps. Do not interpret excluded pairs as
   missing links.
3. Inspect the first 10–20 candidates in their deterministic order. Record whether
   each pair is a useful connection to consider, merely vocabulary overlap, or
   uncertain. Mutual top-five explains inclusion; it is not a recommendation.
4. Use Open left/right note when needed. Explore a Neighborhood, recenter twice,
   then Back: the category, search, selected pair and row limit should remain.
5. Inspect a few aligned one-way/reciprocal pairs and explicit-only pairs. Confirm
   direction against your own notes. Explicit-only should show no similarity
   score and should never be described as semantically far.
6. Change a note/link or the semantic index outside this page. Confirm the old
   comparison becomes stale and only Refresh publishes a current comparison.

Share aggregate counts and qualitative false-positive observations if desired;
there is no need to share private note text or paths.

## Known limitations and deferred work

- Top-five candidates are rank relationships, not proof a Markdown link should exist.
- No semantic threshold exists; scores reflect the captured index, whose source
  embeddings may themselves lag note edits.
- Explicit-only does not mean semantically unrelated. Exact cosine scoring of
  every explicit-only pair is deferred.
- Missing link metadata leaves some pairs unclassified; unmapped endpoints keep
  some explicit links outside semantic comparison.
- Comparison reflects two captured revisions, not continuous or automatic analysis.
- No automatic Markdown mutation, link creation, proposals, AI explanation,
  cluster labels, recommendation model, or new semantic engine/parser.
- No Findings or Connection Health analyzer until real-vault false-positive
  evidence supports a separate design. No dismiss/ignore persistence or history.
- Global Map's existing 500-note cap applies. Search is local substring search;
  show-more is explicit paging rather than virtualization.
