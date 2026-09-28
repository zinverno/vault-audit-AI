# Large-vault UX stabilization after 2.0.0

This pass changes presentation and transient progress only. Persisted analyzer IDs,
mode IDs (`single` / `batch`), freshness rules, provider transport, retries, analysis
results, similarity/connectedness scores and persistence formats stay compatible.

## Verified flows and before/after

### Knowledge Health

Previously `DeepAuditEngine.onProgress` stopped at the Health adapter. The UI only
showed “Checking knowledge…” while reading and MAP requests ran.

The existing callback now flows through `DeepHealthAnalysisAdapter` →
`HealthService` transient snapshot → `HealthPluginController` →
`deepIntelligenceViewModel` → `renderDeepIntelligence`. Stages are preparation,
reading notes, language-model analysis (actual completed batch count), freshness
verification and saving Findings/history. Existing completed/partial/error/cancel
messages remain the terminal states; progress is cleared in `finally`.

Reading counters now count settled notes, rather than claiming the pending read
has completed. MAP emits `0 / total` before its first request; completed counters
include failed batches after existing retries. No raw progress detail, filenames,
payloads or credentials enter the progress state. No extra requests are made.

A view-owned elapsed clock updates only text, with cleanup on rerender, navigation
and close. It neither polls application state nor advances progress. ETA is omitted:
concurrent completion and retry delays do not currently support a reliable rate.

### Global Semantic Map

Wheel/pointer navigation already existed. The 4× ceiling and jointly scaling node
markers/hit targets left overlapping nodes overlapping at every zoom level.
The existing viewport helpers now accept a semantic-only maximum of 24× (minimum
0.4×); topology retains its 4× limit. Markers, labels and hit targets stop growing
above 1×, while node spacing continues to grow. Edges retain a readable stroke.
Visible Zoom in/out, Reset view and Fit data controls use the same viewport.

No radial spread mode was needed: core/focus radii remain the original linear
cosine encoding and angular layout remains deterministic. Search, browser SVG hit
testing, hover, selection, note opening and the inspector operate on the same
captured map. Reset returns to the original viewport; Fit data fits the current
node extent. Selected/hover labels and the existing maximum of five context labels
are retained. No semantic work or embeddings run on viewport changes.

### Audit modes: actual behavior differs from the initial assumption

All three use the **legacy note index**, not the semantic embedding index.

| User-facing mode | Work | Cache | Result |
| --- | --- | --- | --- |
| Detailed audit of changes | Eligible new/mtime-changed notes; one per request, up to 15,000 characters | Skips current results | Detailed records saved incrementally; no report |
| Full detailed audit | All eligible notes, same detailed pipeline | Bypasses freshness (`onlyStale=false`) | Replaces records incrementally; no report |
| Overview audit + report | Eligible new/mtime-changed notes in batches, up to 4,000 characters per note | Skips current notes; their summaries are **not merged into synthesis** | Index records, clusters, synthesis, Markdown report and Canvas for the processed subset |

The overview is therefore not necessarily a whole-vault report. Its card and
confirmation now say so; no cache/reduce behavior was changed. Both engines and
the selector use the same existing eligible-file scope, including exclusion of
hidden basenames. Counts come from actual note-index freshness. First-run/current/
changed guidance explains 500/500/500, 0/500/0 and 12/500/12 respectively. Zero-work
cards are disabled but remain keyboard discoverable. Full remains available.
Unsupported duration guesses and the unconditional Recommended badge are removed.
The dialog/cards/statistics wrap and scroll at narrow/short desktop sizes.

## Changed files by area

- Health: `deepAudit.ts`, `deep/health/deepHealthAnalysisAdapter.ts`,
  `health/deepHealthAnalysisPort.ts`, `health/services/{healthService,types}.ts`,
  `health/obsidian/healthPluginController.ts`,
  `health/ui/{VeynrelHealthView,deepIntelligenceViewModel,renderDeepIntelligence}.ts`,
  `deep/health/deepHealthScan.test.ts`, `health/ui/VeynrelHealthView.test.ts`.
- Map: `health/ui/{graphViewport,bindGraphViewport,renderSemanticGlobalMapGraph,renderSemanticGlobalMap}.ts`,
  `health/ui/{bindGraphViewport,semanticGlobalMapLayout,VeynrelHealthView}.test.ts`.
- Audit: `main.ts`, `deepAudit.ts`, `deep/auditModeViewModel.ts` and its test.
- Shared presentation/evidence: `i18n.ts`, `styles.css`,
  `scripts/large-vault-ux-{prepare,native}.mjs`, this document and the evidence folder.

## Verification

- Full Vitest suite: **2,691 tests / 110 files passed**, including integration tests.
- Focused suite: **282 tests passed** (before the additional map control test);
  final standalone Health view suite: **147 tests passed**.
- `npm run lint`: passed, including typecheck (both TypeScript projects), production
  build and repository ESLint checks. Only the pre-existing `api.ts:402` fetch
  advisory remains.
- `npm run audit:proposals`: **5/5 mutations killed**, all restored tests passed.
- `git diff --check`: passed.

### Native acceptance, September 28, 2026

Real Obsidian 1.12.7 / Electron 39.8.10 on Linux, disposable profile and 500
synthetic Markdown notes; prebuilt synthetic vectors; localhost-only mock LLM.
The UI counters originate in the real Deep engine/provider transport and Health
service. Model response contents and latency are synthetic, not a provider-speed
benchmark. Automatic embedding sync is suspended in this fixture.

- **A:** 500-note Health run observed preparation, reading 0–500, mapping 0–100,
  verification, saving and successful cleanup. Exactly 100 MAP requests. Elapsed
  text advanced while the mock response was held. A separate one-note provider
  failure cleared running/progress; a restarted 500-note run began at zero and
  cancellation cleared it. The one-note failure fixture avoids spending minutes
  exhaustively retrying 100 intentionally failing batches.
- **B:** 500-node real map snapshot; 24× visible controls, native pointer hover and
  selection of a different node after transforming, native drag without accidental
  selection, native wheel zoom, fit and exact reset. Inspector similarities,
  connectedness and neighbors matched the captured values; opening the selected
  note worked. Captured map bytes stayed identical and viewport work triggered
  zero map recomputations.
- **C:** Fresh audit index: 0 current / 500 new / last run never. All three cards
  showed 500, with first-run/cache/result descriptions in both languages.
- **D:** Seeded current legacy index, then actually modified twelve synthetic
  files: 12/500/12 counts. Current state also verified 0/500/0. Twelve combinations
  cover three states × EN/RU × 1000/390px width at 700px height. Badges stay inside
  cards, horizontal overflow is absent, and Enter retains the incremental callback.

Machine-readable evidence and the exact build SHA-256 are in
[the native report](large-vault-ux-evidence/native.json). Selected screenshots:
[Health progress](large-vault-ux-evidence/health-mapping-progress.png),
[500-note overview](large-vault-ux-evidence/map-overview-500.png),
[zoomed selection](large-vault-ux-evidence/map-zoomed-500.png),
[fresh Russian audit](large-vault-ux-evidence/audit-fresh-ru-1000.png),
[incremental English audit](large-vault-ux-evidence/audit-changed-en-1000.png).
All screenshots were inspected visually.

The actual personal/showcase vault was not accessed. Live-provider latency,
mobile OS, popouts, screen readers and custom themes remain unverified. A narrow
desktop viewport is not a mobile test. The global view intentionally retains a
ring when the real similarity distribution is narrow; zoom makes it inspectable.

### Reproduce native acceptance

```sh
npm run build
node scripts/large-vault-ux-prepare.mjs /tmp/large-vault-ux-smoke
# Launch the installed Obsidian/Electron with this disposable profile:
electron39 /usr/lib/obsidian/app.asar \
  --user-data-dir=/tmp/large-vault-ux-smoke/profile \
  --remote-debugging-port=9261 --disable-gpu --ozone-platform=x11
node scripts/large-vault-ux-native.mjs http://127.0.0.1:9261 /tmp/large-vault-ux-smoke
```

Use the corresponding installed Obsidian executable on other systems. The harness
requires a disposable `/tmp` root and verifies the active vault path before
resetting synthetic audit state. It copies the current build into the fixture,
uses the actual language dropdown, and writes screenshots/report under that root.
Local ports 9261 (CDP) and 9889 (mock model) must be free. No new browser framework
or dependency is required.
