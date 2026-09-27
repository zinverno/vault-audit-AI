# Semantic Visualization V2 verification

Baseline: `c058bb62c35e4c8b04fc5203814fb79b77412549`, clean current main after
`git switch main` / `git pull --ff-only`; PR #57 verified merged at that SHA.
Implementation branch: `feat/global-semantic-map`. No personal vault was opened,
read by the harness, photographed or committed.

## Automated checks

| Check | Result |
| --- | --- |
| `npm ci` | Passed; lockfile unchanged |
| `npm run typecheck` | Passed, including strict Health compilation |
| `npm test -- semantic` | 450 passed / 21 files |
| `npm test -- health` | 916 passed / 44 files |
| `npm test` | 2,582 passed / 106 files |
| `npx eslint semantic health` | Passed, no warnings |
| `npm run lint` | Passed; existing `api.ts:402` fetch advisory only |
| `npm run audit:proposals` | 5/5 mutations killed, restored tests passed |
| `npm run build` | Passed |
| Diff whitespace check | Passed |

The proposal audit's first sandbox run returned empty subprocess output; rerunning
its unchanged disposable mutation harness outside the sandbox passed all probes.
No tests or lint rules were weakened. `npm ci` reported 7 existing dependency
advisories (4 moderate, 3 high); no dependency or lockfile changes were made.

Engine regressions cover the known A/B/C mean direction, multichunk centroid
parity with Neighborhood, eligibility exclusions, deterministic finite cores,
ill-conditioned core, singleton, exact available top-five/canonical ties,
connectedness means, union/mutual edges and the exact 500/501 boundary. Projection
checks reject whole malformed results and deeply freeze only public data. Product
checks cover passive ownership, 20-result search, all seven revision fields,
R1/R2 races with/without notifications, cancellation/disposal and fixed safe errors.
Layout checks cover finite bounds, exact radial transform, size bounds/monotonicity,
deterministic reordered input, connected/disconnected contiguous forest sectors,
radial Neighborhood labels and bounded global label text spacing. The shared
viewport has pointer threshold, cancel, capture disposal and zoom-bound tests.

The real controller/runtime/VectorStore integration test records **zero**
`BaseEmbeddingProvider.embed`, `requestUrl`, `fetch`, `XMLHttpRequest`, `vault.read`,
`vault.cachedRead`, Markdown enumeration, index mutation, adapter writes and plugin
settings writes across Global Map load/refresh/search. Existing Neighborhood
integration checks retain its 10/3 behavior, evidence, cosine scores and recenter.

## Native desktop

Isolated **Obsidian 1.12.7 / Electron 39.8.10 on Linux**; synthetic 1,536-dimensional
index, three chunks per document. Verified bundle SHA-256:

```
46400787679aad79c1c751911af9a7b5a24b0dd65422066700f85f1ddd5331f4
```

[Raw native evidence](native.json): **294 cases** = EN/RU × seven scenarios ×
dark/light/custom yellow accent × 320/390/768/1024/1280/1440/1600px. Scenarios:
overview, selected, stale, singleton, over-cap, disabled and absent index.
All passed with zero runtime exceptions, no horizontal page overflow, seven
primary tabs, Discover selected for both semantic children, no raw translation
keys and no SVG nodes in Tab order. Narrow label density passed.

Native counters prove passive Discover performs zero global analysis, vector
snapshot traversal, provider/embed, fetch/XHR, Markdown-body reads, writes or
mutations. Explicit map operations use one snapshot per load, zero new embeddings,
zero provider/network, zero `read`/`cachedRead`, zero index/plugin-data writes or
mutations. Plugin JSON/binary hashes remain identical during read-only analysis.
Fixture setup and the deliberate revision change used to test stale state occur
outside those measured map operations. Explicit Open note is checked separately.
`requestUrl` is instrumented by the real-runtime integration test, not claimed as
a native monkey-patched host function.

Additional native acceptance:

- Pointer selection updates the inspector; drag does not select; wheel zoom and
  Fit work. Search and keyboard Enter on neighbor buttons require no analysis.
- Two Veynrel leaves share one session controller and cached map.
- Local loading is announced; Refresh restores keyboard focus. Progress updates
  preserve graph DOM while calculation is pending.
- Explore Neighborhood delegates to the existing owner with the selected path,
  retains ten neighbors and supports source + selected + top-three labels
  (top-two at 390px). Full text remains in real inspector/list elements.
- Open note uses the existing Obsidian boundary and resolves the synthetic path.
- Reduced motion has no animation or transitions.
- Native Topology pointer selection still converts node IDs to canonical paths
  after extraction of the shared viewport interaction helper.

Screenshots:

- [Desktop](global-semantic-map-desktop.png)
- [Selected note](global-semantic-map-selected.png)
- [390px](global-semantic-map-390.png)
- [Yellow accent](global-semantic-map-yellow.png)
- [Stale map](global-semantic-map-stale.png)
- [Neighborhood top labels](semantic-neighborhood-top-labels.png)

## Performance

[Raw local benchmark](benchmark.json) separates centroid preparation, exact
pairwise top-K work, product projection and deterministic layout. Seven measured
samples after warmup, three chunks/note, 1,536 dimensions; no CI timing gate.
Pairwise timing includes cooperative yields. See the phase table in
[the feature documentation](../global-semantic-map.md#verification-and-performance).

Native whole-page DOM reconstruction, seven samples; layout cache reused:

| Mapped notes | Native DOM median | Explicit initial load wall time | Explicit refresh wall time |
| ---: | ---: | ---: | ---: |
| 150 | 59.8 ms | 278.5 ms | 281.9 ms |
| 300 | 130.8 ms | 720.8 ms | 945.7 ms |
| 500 | 248.5 ms | 1,636.8 ms | 2,114.9 ms |

Load/refresh include analysis, product publication, native DOM work and CDP
round-trip overhead. The 500-note cap remains bounded and usable on this host;
the synthetic equivalent of the current 149-note vault is comfortably supported.
Dense nodes can overlap because semantic radius is preserved. Results describe
this fixture/host, not other hardware or vector distributions.

## Scope and review

Review found an ID/path mismatch during viewport extraction; the original
Topology conversion was restored and verified natively. Follow-up review found
no remaining high-confidence issue in the changed product/engine boundaries.

Confirmed: no new embedding requests; no provider/network or Markdown-body reads
for map operations; no full N×N matrix; no sampling, AI cluster labels,
Markdown-link mixing, new Findings, Health-state behavior changes, persistence,
dependency changes, version bump, tag or release. The shared pure revision helper
preserves existing Health/Neighborhood freshness checks exactly.

Native evidence covers Linux desktop and narrow desktop widths. Mobile OS,
popout windows, screen-reader speech, third-party themes and live providers were
not tested. Exact-final-HEAD GitHub CI and the open/unmerged PR state are reported
in the PR handoff; the bundle hash above ties these native artifacts to the code.
