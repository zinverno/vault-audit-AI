# Rerank v1 verification

Base: `main` at `3c38fc2eb27657101b45ad04bf77568f34ee9188`. Branch: `feat/discover-rerank-v1`. No version change, release, tag or auto-merge.

## Automated checks

| Command | Result |
| --- | --- |
| `npm test` | PASS: 2,760 tests / 112 files |
| `npm run typecheck` | PASS: plugin and Health TypeScript projects |
| `npm run lint` | PASS: zero errors; only the pre-existing allowlisted `api.ts:402` streaming-fetch warning |
| `npm run audit:proposals` | PASS: 5/5 mutation checks killed; all restored tests passed |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Tests use fake transports and synthetic inputs. The production adapter, real semantic runtime/index, current document reconstruction and modal/settings boundaries are exercised. This does not establish model ranking quality.

The legacy settings regression still compares all pre-existing bindings/defaults/callbacks against its frozen baseline. Only the new `rerank` property, three new bindings and their two lifecycle helpers are outside that legacy snapshot; their behavior has dedicated tests.

## Native: PASS, synthetic providers

Actual Obsidian **1.13.7**, Electron **43.6.0**, Linux. Disposable vault with 12 synthetic notes (24 chunks); default theme, English UI, 390 px layout check. Settings ran in Obsidian's native settings popout. Search ran in the existing search modal.

[`native.json`](native.json) records 17 successful assertions and the installed `main.js` SHA-256. The native driver invokes the built plugin's real rerank adapter with a fake transport and a localhost synthetic embedding server. It checks passive settings/workspace, old-settings migration, masked independent key/disclosure, no rerank during indexing, disabled search, one expanded search, original results during refinement, reordered results, fallback, new query, close, note opening, explicit synthetic connection test, model/index independence and narrow layout.

Harness: [`scripts/rerank-native.mjs`](../../scripts/rerank-native.mjs). Reproduce using the prepare/run instructions in [rerank-v1.md](../rerank-v1.md). Obsidian 1.13.7 uses a settings popout and `.modal-header-button` for modal close; the driver queries the owning settings modal and waits for search-modal teardown before reopening.

Native verification covers the installed artifact with hash recorded in the JSON, not a published release. Source build output `main.js` remains ignored and uncommitted.

## Unverified

- **Live-provider: NOT RUN.** No real keys or paid OpenRouter calls; no latency/cost or ranking-quality claims. The [evaluation set](../rerank-v1-evaluation.json) is prepared for a later explicitly authorized run.
- Mobile/other operating systems, screen readers, custom themes, localized native Russian rendering and search in an Obsidian popout were not verified. Russian UI strings and stages have automated coverage.
- Provider-side cancellation is not guaranteed by `requestUrl`; only local waiting and application of late responses are cancelled.

Review scope: no change to embedding-space identity, vector-store schema, indexing algorithm, semantic-score meaning, Health/Recall/maps/similar-note/duplicate/RAG/Companion behavior, version metadata or dependencies. RAG's existing chunk validity checks were moved into one shared helper; its behavioral suites remain green.

Independent read-only review found no actionable correctness, privacy or concurrency issues. Final focused additions verify navigation to the selected current rerank fragment, including moved source coordinates.
