# Global Semantic Map

Global Semantic Map answers **“How is my knowledge space shaped?”** It visualizes
all semantically eligible documents in the existing compatible vector index.
It creates no embeddings and does not inspect Markdown bodies.

| Relationship view | Meaning |
| --- | --- |
| Vault Topology | Actual Markdown links: “What did I explicitly connect?” |
| Semantic Neighborhood | One source and its nearest 10 semantic neighbors: “What is semantically close to this note?” |
| Global Semantic Map | The whole eligible indexed semantic space, within the exact-mode cap |

Discover exposes Neighborhood and Global Map together under Semantic exploration
when Semantic Intelligence is Ready. `{ page: "semantic-map" }` is a child route;
Discover stays selected in the existing seven-tab navigation. Search, Related
Notes, Potential Duplicates and existing Semantic Health actions remain available.

## Explicit work and ownership

Opening Discover reads cached capability state only. **Open global semantic map**
is the first computation boundary. Load/refresh traverse existing vector metadata
and vectors; search, selection, pan, zoom and Fit use the already-loaded map.
A cached map is reused across views during the plugin session. Opening a stale
map does not recompute it; **Refresh map** is explicit.

`main.ts` constructs one `SemanticGlobalMapController`, injects its dedicated
`health/semanticGlobalMapPort.ts` through `registerHealth`, and registers disposal.
Views own transient selection/search/viewport state. The global port does not
extend or overload Neighborhood. `SemanticDiscoveryService.analyzeGlobalSemanticMap`
performs the engine work through the existing controller/runtime shared lease.
Only safe document scores and sparse relationships cross the engine boundary;
Health/UI receive no vectors, chunk text, VectorStore snapshot or embedding-space
internals beyond the existing revision identity.

There are **zero provider/embed calls, network requests, Markdown-body reads,
VectorStore mutations, index writes or plugin-data writes** on map operations.
**Open note** is a separate explicit action through the existing safe
`openHealthNote` boundary. **Explore neighborhood** loads the selected path using
`SemanticNeighborhoodPort.load(path)` and opens the existing child surface.
No Findings, Health scores, settings fields, files or layout/cluster/centrality
persistence are created. No dependency, version, tag or release is added.

## Centroids, eligibility and scores

The service reuses its existing `prepareSnapshot` and `eligible` implementations,
unchanged for `findSimilarNotes` and `findPotentialDuplicates`:

1. Group stored chunks by canonical document path; order rows by ordinal then ID.
2. Sum existing normalized Float32 chunk vectors in Float64, then normalize the
   sum with the existing stable norm calculation.
3. Require at least `MIN_DOCUMENT_MEANINGFUL_CHARACTERS = 32` letters/digits across
   unique stored previews, and mean resultant length above
   `MIN_DOCUMENT_COHERENCE = 1e-5`.

No preview is a fresh note read, and the global result includes no previews.
`indexedNoteCount` counts indexed paths; `mappedNoteCount` counts eligible paths.
These counts may differ. The regression fixtures explicitly exercise exclusions.

The **vault semantic core** is the normalized sum of the eligible, already
normalized document centroids. Each eligible document has equal weight in this
sum, regardless of chunk count. It is a vector-space mean direction, not a note
or a “best note”; it has no path, open action or self-similarity. The UI uses a
hollow diamond with an inner dot to distinguish it from document circles.

A zero/empty/nonfinite or ill-conditioned global mean (norm / eligible count
≤ `1e-5`) returns the controlled “Semantic core could not be determined” state.
It never fabricates a core or publishes NaN/Infinity positions.

- **Similarity to semantic core** is the cosine between the document centroid
  and normalized global core, clamped to [-1, 1].
- **Semantic connectedness** is the arithmetic mean of exact cosine scores to
  the document's available top five other documents. With fewer than five, all
  available neighbors contribute. A singleton has `null` connectedness, displayed
  as “No semantic neighbors”, and the minimum node size.

These are semantic metrics, not importance, quality, value or Health. Proximity
does not imply factual agreement. The inspector formats cosine scores to three
decimals with the existing score formatter; the product retains the exact number.

## Bounded exact computation and sparse relationships

The supported cap is **500 eligible documents**, including the intended
approximately 149-note real-vault scale. Over the cap, the engine returns a
controlled limit state with truthful counts and no partial map. There is no
sampling, truncating the corpus, ANN/HNSW or hidden similarity threshold.

Centroids are prepared once. Each unordered pair is compared exactly once.
During that comparison, each endpoint's sorted top-K list is updated:
**K = 5**, cosine descending, then canonical path ascending. A rejected candidate
is discarded immediately. A full N×N matrix is never allocated, retained, returned
or persisted. Analysis workspace is O(N·D + N·K), in addition to the existing
chunk snapshot and its O(C·D) vector storage / O(C) row metadata; time is bounded
O(N²·D). No repeated per-note `findSimilarNotes` calls are used.

A sparse edge exists if **A ranks B OR B ranks A** in its top five. Each canonical
`left < right` pair is stored once with its exact score. `mutual` means **both**
rank each other, not that cosine itself is asymmetric. Default overview edges
show only mutual top-five pairs, quietly. Selecting a node highlights all of its
own top-five edges, including non-mutual ones. Other non-mutual stored edges stay
hidden; the legend says so. No all-pairs relationship display is implied.

The local loading state is “Building global semantic map…”, followed by count-only
“Comparing semantic documents… completed / total pairs”. Work yields before
preparation and every 2,048 comparisons, checks cancellation, and never polls.
Progress updates replace status text without reconstructing an existing SVG.
There is no fake ETA or embedding progress claim.

## Validation and freshness

Before publication, the product projection rejects the entire result for invalid
counts, duplicate/noncanonical paths, unknown/self/duplicate neighbors, invalid
or nonfinite scores, wrong top-K lengths/order, a connectedness value inconsistent
with its neighbors, duplicate/noncanonical/missing edges, asymmetric reciprocal
scores, or an inconsistent mutual flag. Public fields are copied and deeply
frozen; unexpected engine fields never cross the boundary. Error state contains
fixed codes, not raw provider/storage exceptions.

The shared pure `semantic/semanticIndexRevision.ts` preserves the same seven
fields and readiness checks as Semantic Health and Neighborhood:
`vectorGeneration`, `vectorCount`, `dimensions`, `provider`, `model`,
`configurationRevision`, `runtimeRevision`. A map belongs to that exact revision.
Index changes mark it stale: **“Semantic index changed. Global map may be outdated.”**
There is no automatic rebuild. Explicit refresh uses the current revision.
Epoch ownership plus pre/post-analysis revision checks prevent R1 publication
after R2, including missed status notifications during computation. Disposal
aborts in-flight work and removes listeners; late results cannot publish.

## Geometry and interaction

In a fixed 1000×1000 coordinate space centered at (500, 500):

```
normalizedCore = (coreSimilarity + 1) / 2
radialDistance = 120 + (1 - normalizedCore) * 290       // [120, 410]
nodeRadius = 4 + 10 * ((semanticConnectedness + 1) / 2)^3 // [4, 14]
```

These absolute monotonic mappings do not exaggerate tiny differences through
rank scaling. Node size stays bounded. Layout never changes a node's semantic
radius. The cubic size scale gives common positive connectedness scores more
visible differentiation. Pan/zoom applies only a shared view transform.

Reference rings are labeled +1, 0 and −1 at the actual radii 120, 265 and 410.
A visible EN/RU caption identifies these as similarity to the semantic core.
The compact summary shows captured indexed/mapped counts plus the minimum,
maximum and median of each metric across mapped notes. An even-length median
averages the middle two values; undefined singleton connectedness is omitted and
shown as “No semantic neighbors”. These are local calculations over the published
map, with no new engine analysis or persistence.

Angles come from a deterministic maximum-similarity spanning forest of the
sparse union graph. Kruskal orders edges by score descending, then canonical
left/right path. Each tree roots at highest connectedness, then canonical path.
Trees receive sectors proportional to their sizes, ordered by root path, with
small bounded gaps. Children sort by edge score descending then path, receive
contiguous sectors proportional to subtree size, and reserve one slot for their
parent. There are no random positions, force simulation or continuous animation.
The forest is strictly a **layout scaffold**, not a knowledge hierarchy or extra
semantic relationship contract. No generated topic names are shown.

Only the selected note and the five highest-connectedness notes are permanently
labeled (three at narrow pane widths). Labels are unique, basename-only and
truncated, with measured text widths and a bounded search for the nearest free
row in either direction, including at the map boundary. Core/ring annotations
reserve space; selected labels take priority. Quiet connector lines identify
nodes whose labels moved, without intercepting pointer input. Hover exposes other
labels; native titles and the inspector retain full paths. Node positions are
never changed to fit text. Highly connected notes are not called “most important”.

Search is case-insensitive substring matching over basename/path, with at most
20 result buttons and the full match count. Selecting a result updates the
inspector and centers its node when practical. The inspector contains real text,
exact formatted scores and up to five nearest-neighbor buttons. Note text uses
native text sinks; no `innerHTML`, Markdown render, `foreignObject` or raw-path
CSS selector interpolation is used.

Wheel zoom, pointer drag pan and Fit share the extracted topology viewport
contract: zoom [0.4, 4], translation bounded to ±4000 SVG units, pointer movement
threshold 5 CSS pixels. Drag does not select. Pointer-up/cancel/lost capture and
view teardown release capture/listeners. Nothing is persisted.

SVG nodes are pointer-oriented and absent from Tab order. Search, real result
buttons, inspector/actions and nearest-neighbor buttons provide keyboard access.
Selection information exists outside SVG. Neighbor selection retains focus at
the inspector; loading uses a persistent polite live region. Wide panes show map
and inspector side by side; narrow panes stack them. Dense narrow maps may require
zoom. Theme tokens supply all graph colors. Reduced motion disables transitions;
pan/zoom is immediate in all modes.

## Verification and performance

Synthetic-only fixtures use **three chunks/document, 1,536 dimensions**, deterministic
eight-direction groups plus dense variation. They never access or commit a personal
vault. Rerunnable harnesses:

```
node scripts/global-semantic-map-benchmark.mjs /tmp/global-map-benchmark.json
npm run build
node scripts/global-semantic-map-prepare.mjs /tmp/global-semantic-map-smoke
# Start isolated Obsidian with this vault/profile and a localhost CDP port.
node scripts/global-semantic-map-native.mjs http://127.0.0.1:9258 /tmp/global-semantic-map-smoke
```

Node medians after warmup, seven samples, Node 24.14.1 (milliseconds):

| Documents | Pairs | Centroid preparation | Pairwise top-K, including yields | Product projection | Angular layout |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 150 | 11,175 | 8.93 | 56.04 | 5.31 | 1.81 |
| 300 | 44,850 | 16.26 | 248.18 | 11.47 | 3.50 |
| 500 | 124,750 | 25.26 | 708.67 | 18.43 | 7.16 |

Native DOM/render and final verification results are recorded in
[the evidence report](global-semantic-map-evidence/verification.md). Timings are
observations on this host, not CI thresholds or guarantees for other devices.
The exact cap remains 500; local compute is cooperative and this bounded mode
comfortably covers the synthetic 150-note equivalent of the user's current vault.

Tests cover known core cosines, finite/deterministic core and ill-conditioning,
multichunk parity with Neighborhood, exact top-five/ties/connectedness,
sparse union/mutual edges, cap/cap+1, rejection validation, immutable output,
seven-field stale handling, races, disposal, deterministic angular sectors,
radial/size monotonicity and bounds, passive Discover and real-runtime zero-IO.
Existing Neighborhood and Semantic Health tests retain their contracts.

Screenshots under `global-semantic-map-evidence/` cover desktop, selection, 390px,
yellow accent, stale state and updated Neighborhood labels. The native matrix
covers EN/RU, dark/light/custom yellow accent, and 320/390/768/1024/1280/1440/1600px.
Narrow Linux desktop emulation is not mobile OS testing; screen-reader speech,
popout windows, third-party themes and live-provider behavior remain untested.

## Known limitations and deferred work

- Exact global analysis is capped; no ANN/HNSW or silent sampling.
- No AI-generated cluster labels or invented topic names.
- No Markdown-link overlay or mixing of semantic and explicit relationships.
- No missing-link recommendations, comparative map or new Findings.
- Semantic proximity does not imply factual agreement.
- Semantic connectedness does not imply importance.
- Vault semantic core is a mean direction, not a best note.
- Similar scores can occupy a thin ring; node overlap is possible. Zoom/search
  help, and layout never distorts radial meaning to separate nodes.
- Labels can still be dense for unusually long or tightly grouped names.
- No persisted global-map layout; restarting may require an explicit rebuild
  from the existing index. Source embeddings may be stale relative to note edits;
  this map represents its captured semantic index, not freshly read text.
