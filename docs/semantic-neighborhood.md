# Semantic Neighborhood

Semantic Neighborhood is Discover's interactive exploration surface for the
**existing compatible semantic index**. It answers “What does Veynrel see as
related by meaning?” Vault Topology answers “What did I explicitly connect?”
Topology represents resolved Markdown relationships; Neighborhood represents
semantic relationships. Their data and renderers are separate.

## Engine and product boundary

`SemanticDiscoveryService.findSimilarNotes()` remains the sole similarity
implementation. It groups indexed chunks by note path, derives normalized
document-centroid vectors, computes cosine similarity, excludes the source,
and orders results by score descending then canonical lexical path. Neighborhood
uses its existing **10 neighbors / 3 matches per document** behavior. There is no
additional cutoff, including for negative scores. An empty result means only
“No usable semantic neighbors found”; it does not diagnose note quality.

The source catalog is `SemanticDiscoveryService.listIndexedPaths()`: unique
`metadata.path` values from the same validated VectorStore snapshot structure,
in canonical lexical order. It does not compute centroids. It is exposed through
`LazySemanticRuntime` and `ObsidianSemanticController` under the existing
`AsyncReadWriteBarrier.withShared()` lease. The UI cannot access a store, raw
vectors, registry, snapshot, Markdown inventory or provider.

`health/semanticNeighborhoodPort.ts` is the separate product contract. One
`SemanticNeighborhoodController` is constructed in `main.ts` per plugin session,
injected through `registerHealth()` into all Veynrel views, and disposed by plugin
registration. Views own only source-search text and visual selection. Closing a
view detaches listeners; reopening can reuse the session catalog/map. There is
no persistence, settings change, exploration history, index schema change, or
layout cache.

The product projection copies/freezes the map, revision, nodes, relationships,
evidence and nested heading arrays. It validates canonical paths, catalog
membership, unique neighbors, exclusion of the source, the 10/3 bounds, finite
scores in [-1, 1], chunk identities, headings/previews and nonnegative ordered
source ranges. Malformed results reject the entire operation. No partial graph
is silently presented. Raw exceptions never enter product state.

## Explicit work and freshness

Discover's card reads already-cached capability state only. Opening Discover
performs zero Neighborhood catalog reads, vector snapshots, similarity queries,
embedding/provider/network calls, Markdown-body reads, storage writes or index
mutations. The card appears only when Semantic Intelligence is Ready. Existing
Discover setup remains authoritative when it is unavailable.

**Open semantic map** is the explicit prepare boundary. Choose a note, Refresh,
and Explore from this note are subsequent explicit work boundaries. Every such
operation uses existing vectors/metadata/previews: **no new embedding request,
no provider request, no network, no `vault.read` / `vault.cachedRead`, no write**.
The existing index may originally have been created by a local or remote provider;
the UI makes no claim about where embeddings were produced. Open note is a later,
separate navigation action through `openHealthNote()`, which resolves and validates
the target at click time.

The controller captures and compares the same seven revision fields and ready
validation as `SemanticHealthAnalysisAdapter`: `vectorGeneration`, `vectorCount`,
`dimensions`, `provider`, `model`, `configurationRevision`, `runtimeRevision`.
Catalog and graph must belong to that exact revision. The revision is checked
before work and again before publication. A change during work discards the
result and offers Refresh. Status subscriptions change a completed map to stale
or unavailable without recomputing or polling. Disable, indexing, rebuild,
clear and configuration changes cannot leave old relationships labeled current.
Explicit refresh rederives a changed catalog; a removed source yields a controlled
message and Choose another note.

Repeated actions share one pending promise. Epoch ownership prevents obsolete
or disposed work from publishing. Discovery's synchronous loops are not claimed
to be interruptible. Disposal invalidates publication and removes subscriptions.
States distinguish idle, preparing, choosing, loading, ready, stale, unavailable
and bounded error. A retained previous map is always accompanied by its current
stale/unavailable/error message.

## Map, evidence and interaction

The transient `{ page: "semantic-neighborhood" }` child route keeps **Discover**
current in the unchanged seven-tab primary navigation. Search, Related Notes,
Potential Duplicates, Semantic Duplicate Health, and setup controls remain.
`SemanticSimilarNotesModal` remains the fast list workflow.

The source chooser searches only the prepared indexed catalog. Trimmed,
case-insensitive substrings match basename or full vault-relative path in
canonical order. It displays at most 20 results with the total matching count.
Filtering is O(N), entirely local, and needs neither debounce nor a dependency.
Choose another note reuses a fresh catalog; a changed revision requires explicit
refresh before presenting it as current.

The source has no self-similarity metric. Each neighbor is an existing discovery
result, and each undirected relationship is source ↔ neighbor. Selecting a graph
node or list button updates only the inspector. **Explore from this note** is the
sole recenter action; it queries that note once, without expansion or prefetch.

Evidence is at most three stored neighbor fragments closest to the **source
centroid**. These are not claimed to have caused the document-centroid score.
The inspector presents heading, stored preview, source lines (converted from
zero-based storage to one-based display), and chunk score. It retains no vectors,
content hashes or provider payload. Every heading/path/preview uses text sinks,
never HTML or Markdown rendering. Scores use the extracted pure
`utils/semanticPresentation.ts` helper; existing modal output remains exactly
`score.toFixed(3)` (or an em dash for a nonfinite input).

The pure deterministic layout centers the source at (500, 500) in a 1000 × 1000
space. Neighbor radius is:

```
normalized = (cosine + 1) / 2
radius = 190 + (1 - normalized) * 220
```

Higher cosine never places a node farther away. Angles distribute nodes in
score-descending, path-ascending order. The fixed guide rings are spatial guides,
not semantic thresholds. Edges have a uniform quiet stroke, no arrows, and no
redundant width encoding. There is no randomness, simulation or ongoing motion.
One center against the indexed corpus uses the existing discovery algorithm;
it is not sublinear. No whole-vault N × N matrix or global graph is constructed.

## Accessibility and presentation

Theme variables supply all map colors; source size plus a double ring distinguishes
its role without relying on color. A sorted list of real buttons exposes every
node and score, with pressed state reflecting selection. SVG is aria-hidden and
has no Tab stops. Inspector actions are ordinary buttons. Child navigation focuses
the heading; same-route asynchronous work preserves the workspace viewport and
nearby action focus using the established view behavior. The persistent polite,
atomic live region stays visually hidden. Visible routine/loading/error status is
inside the Neighborhood page; no status is added above navigation.

Wide panes place map/list beside the inspector. At container widths ≤850px the
inspector follows map/list. Long paths and previews wrap. Primary navigation keeps
its own horizontal scrolling. Reduced motion removes Neighborhood transitions;
Vault Pulse behavior is untouched. The 1400px workspace and 80ch prose boundaries
are preserved.

## Verification evidence

Verification and synthetic screenshots are recorded in
[`semantic-neighborhood-evidence/`](semantic-neighborhood-evidence/).
The reproducible benchmark is `node scripts/semantic-neighborhood-benchmark.mjs`.
It seeds 1,000 documents, 3 chunks per document, 8 dimensions, and records seven
samples separately for catalog derivation, one discovery query, projection and
layout. Native DOM rendering is measured separately; no timing threshold is in CI.

The final synthetic native run used **Linux Obsidian 1.12.7 / Electron 39.8.10**.
**378 presentation cases** passed: nine states (disabled, configured/index absent,
chooser, one neighbor, ten varied neighbors, zero usable neighbors, stale generation,
selected evidence, source removed) × EN/RU × default dark/default light/custom yellow
accent × 320/390/768/1024/1280/1440/1600px. All preserved seven primary tabs, Discover's
active state, no raw translation keys, no SVG Tab stops, and no page overflow.
The sidebars were collapsed to expose the pane at narrow desktop viewport sizes.

Native boundary evidence records 18 state/language sequences. Passive Discover
had zero catalog/query/snapshot calls. Explicit preparation, discovery, refresh
and recenter had zero embedding, fetch/XHR, Markdown body reads, plugin writes,
settings saves and index mutations. Synthetic fixture mutations used to create
stale/removed states happened outside the measured operation boundary.
`requestUrl` is directly instrumented by the real-runtime integration test;
the native runner does not claim to intercept that module-local API. Stored HTML
remained literal text and created no image nodes. Host workspace layout writes
are not plugin persistence.

Seven native interaction groups passed: pointer selection without querying;
shared controller/catalog/map across two Veynrel leaves; meaningful focus after
source choice/recenter/Choose another; exactly one explicit recenter; held-refresh
scroll/focus restoration; native Enter activation; reduced motion. The 1,000-note
native case rendered only 10 neighbors. No native product JavaScript exception
occurred. The final native artifact hash is recorded in `native.json` and was
compared to the final production bundle.

| Measurement (7 samples, median) | Time |
| --- | ---: |
| Catalog, 1,000 documents / 3,000 chunks / 8 dimensions | 1.59 ms |
| One existing `findSimilarNotes` call | 13.02 ms |
| Validated product projection | 0.40 ms |
| Pure layout | 0.04 ms |
| Native Veynrel DOM rerender with this map | 7.60 ms |

These measurements are observations on this machine, without CI timing thresholds.
Automated results: Semantic **391 tests / 19 files**, Health **895 / 42**, full
suite **2,442 / 102**. Checks include catalog deduplication/validation, zero external
IO across the real runtime, shared lease exclusion, exact model/evidence, malformed
results, deterministic monotonic layout, local search, selection/recenter, every
revision field, catalog/result races, source removal, disposal, passive Discover,
focus and existing semantic/Health workflows. Typecheck, focused ESLint, full lint,
proposal mutation audit (5/5), build and diff checks pass. The proposal audit was
rerun outside the sandbox after its child test returned empty output. One existing
Health-settings test timed out during overlapping checks; its focused rerun and
sequential domain/full reruns passed without changing any timeout or test contract. Full lint retains only
the existing reviewed `api.ts` streaming-fetch advisory.

The independent read-only review found and prompted the transition-focus fix;
re-review found no blocking issue. Native testing caught the SVG class-token API
mismatch and the DOM mock now enforces that native contract. Initial harness
corrections concerned version probing and collapsed sidebars, not product changes.
Mobile OS, popout windows, screen-reader speech, third-party themes and live
providers were not tested. Narrow desktop and a custom accent are not claims of
those environments.

Reproduction (synthetic data only):

```sh
npm run build
node scripts/semantic-neighborhood-prepare.mjs /tmp/semantic-neighborhood-smoke
# Launch native Obsidian with that root's profile and localhost CDP on 9254.
node scripts/semantic-neighborhood-native.mjs http://127.0.0.1:9254 /tmp/semantic-neighborhood-smoke
node scripts/semantic-neighborhood-benchmark.mjs /tmp/performance.json
```

Screenshots: [chooser](semantic-neighborhood-evidence/semantic-neighborhood-chooser.png),
[desktop](semantic-neighborhood-evidence/semantic-neighborhood-desktop.png),
[selected evidence](semantic-neighborhood-evidence/semantic-neighborhood-selected.png),
[390px](semantic-neighborhood-evidence/semantic-neighborhood-390.png),
[yellow accent](semantic-neighborhood-evidence/semantic-neighborhood-yellow.png),
[stale](semantic-neighborhood-evidence/semantic-neighborhood-stale.png).

## Known limitations

- One semantic center at a time; at most the current 10 neighbors.
- Similarity does not imply factual agreement or prove duplication.
- Distance visualizes cosine similarity, not physical structure.
- No Markdown relationship overlay or semantic/Markdown edge mixing.
- No whole-vault semantic graph, global clustering or recursive expansion.
- No persistent exploration history or last-map home preview.
- Indexed notes are not necessarily all Vault notes; the catalog can include
  notes without usable centroids or without other eligible neighbors.
- No Findings, Health scores, recommendations or Topology data are changed.
- Synchronous discovery can occupy the main thread for a large index; timings
  depend on corpus size, chunk count and vector dimensions.
