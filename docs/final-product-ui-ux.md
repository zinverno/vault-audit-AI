# Final product UI / UX consolidation

## A. Methodology and baseline

- Repository: `zinverno/veynrel`; branch: `feat/final-product-ui-ux`.
- Clean `main`, `git pull --ff-only`, baseline `20ba4c47a53d3cc69837e3f16528527cdc34fbcb`. GitHub confirms PR #62 merged at that commit.
- Audit first: traced `VeynrelHealthView` and all its presenters, view models, shared controls, graph views, native settings definitions, locale strings and CSS before changing product code.
- Fresh native Obsidian in `/tmp/final-product-ui-ux/vault`, isolated profile, synthetic 150-note semantic fixture plus two native Recall cards. Existing topology fixture deliberately contains missing/unavailable metadata; partial coverage remains visible. No personal vault or paid credentials.
- Before captures use the baseline bundle and styles. Normal routes use actual controllers, local scan, index fixture, map computation and Recall inventory. Uncommon loading/error/setup/recovery captures override only public presentation snapshots in the disposable runtime; these do not claim a successful provider, sync, recovery or scan.
- Native audit driver: `scripts/final-product-ui-native.mjs`. Fresh screenshots, DOM copy, headings, controls, current navigation, overflow, and IO counters are recorded. Prior PR screenshots were not used as evidence.
- The frontend-ui-engineering skill guided native theme tokens, content hierarchy, native controls, progressive disclosure and accessible focus. No design-system framework or dependency is introduced.

## B. Audit matrix (before implementation)

| Surface | States and interactions inspected | Finding / decision |
| --- | --- | --- |
| Shared workspace | Seven primary routes, parent selection, heading focus, 390px rail | Rail already flat/full-width; keep its seven buttons, underline and native scrolling. Heading focus border inconsistent with map routes. |
| Health | Initial, current partial local analysis, recommendation, dimensions, Recall due, topology preview, profile; scanning/error/recovery source paths | Pulse consumes too much first viewport; repeated Health titles; capability blocks read as documentation. Preserve honest coverage. |
| Findings | Empty filters, open list, selected inspector, lifecycle controls; mutation/error paths | Filters compete with primary rail; repeated explanations inflate every row; evidence appears after note actions. |
| Discover | Ready, disabled, configured/index-required, building, incompatible, error | Exploration cards consume two rows and leave a hole; search buried; redundant capability prose/status after workflows. |
| Semantic Neighborhood | Source choice, ready/source/neighbor evidence, loading, stale, error, absent/source-removed source paths | Top controls and double-divided metrics delay map; Back and Refresh look like peer actions. Keep geometry and text alternatives. |
| Global Semantic Map | Core/selection, focus, loading, stale, error/unavailable, search/list/inspector | Radial meaning too small; focus repeated in status and inspector; repeated connectedness explanation; legend expanded by default. |
| Connection Opportunities | Candidate/aligned/explicit-only, rank/review/special-format/search, selected pair, coverage, loading/stale/error | First pair below 1000px viewport; three equal rails and repeated category counts; coverage internals prominent; rows have long repeated ranks. |
| Vault Topology | Partial preview/detail, search, selected inspector, loading/stale/error, empty source paths | Successful composition retained; title size and boxed metric strip differ from other maps; Refresh over-emphasized. |
| Recall overview | First-run, empty, due, incomplete inventory, loading, error, recovery/confirmation | Counts and native review are sound; optional generation competes with overview. |
| Recall active review | Question, reveal, answer, four ratings, source/back; completion path | Keep focused review and text/interval semantics. Add visible keyboard hints; remove heading control border. |
| Connect | Disabled/configured/ready/sync/error, local/remote setup, sync consent | Disabled view spends first viewport on disable/protocol details; connection and mirror state need parallel structure. Preserve all security/automatic-sync disclosures. |
| Tools | All five launchers, editor-only descriptions, references | Existing catalog grouping sound; oversized descriptions and repeated tool-name buttons; keep side effects visible. |
| Settings overview | Deep/Semantic/Connect state, Recall, Advanced Settings instructions | Tall sequential sections hide lower capabilities; use compact rows with one contextual action. |
| Advanced Settings | Actual native tab, both locale definitions, settings inventory/search aliases | Preserve all controls/keys/defaults/validation; headings should use the native Setting API and provider choices should be native buttons. |
| Semantic setup | Mode chooser, local/cloud/custom form, error, connected/index-required; rebuild consent source | Generic Back destination; preserve network disclosure before Connect/Build. |
| Deep setup / Knowledge | Provider chooser/form/error; explicit Knowledge consent, running/result source paths | Repeated model explanation; preserve cost/data meaning before consent. |
| Onboarding | Profile choice, local scan step, result source, recovery | Clarify profile affects recommendations only and first path needs no AI. |
| Recovery | Health blocked and reset modal, Recall blocked/confirm/retained-card paths | Keep explicit reset consent, safe errors and useful data; no cosmetic change to recovery ownership. |

Baseline native output: 116 route/state observations, 122 captures, no page overflow, raw translation keys or runtime exceptions in these observations. Both language traversals recorded zero in all instrumented passive IO counters.

## C. Main observed problems

1. Density: Discover three cards occupy two oversized rows; Connection Opportunities has no pair visible in its first 1000px capture.
2. Repetition: Health title/section, Discover readiness, map explanations, provider capabilities and Connect protocol prose compete with actual state.
3. Action hierarchy: boxed Back/Refresh/navigation buttons and Findings filters compete with meaningful actions.
4. Inconsistency: metric order/size, title size, inspector framing, spacing and programmatic heading outlines vary by route.
5. Localization: RU child Back labels do not match the Discover tab (Открытия); semantic setup says only Back; some copy exposes captured/snapshot terminology.
6. Interaction risk: full view replacement would collapse newly introduced native disclosures and lose summary focus unless their same-page state is retained in memory during that render.

## D. Changes made

| Surface | Final presentation change |
| --- | --- |
| Global shell | Retained the already-flat full-width seven-item rail and 1400px shell. Shared type/spacing, heading focus treatment, quiet actions, metric strips and native disclosures. |
| Health | Single page identity, shorter Pulse, clearer dimensions heading, quiet profile/note actions, compact capability details. Pulse state, coverage/count/time and recommendation order unchanged. |
| Findings | Rows prioritize identity, dimension, impact and note summary. Explanations stay in the inspector; evidence precedes affected-note actions. Lightweight state/dimension filters. |
| Discover | Compact readiness/provider/index context, Search & find first, three balanced visual exploration choices, separate explicit semantic Health action. One non-ready explanation/action group. |
| Neighborhood | Quiet Back/Refresh, shared metric strip, one distance caption, established graph/list/inspector retained. |
| Global Map | Explicit core/focused-note context above the map; reset alongside it. Search/refresh/fit toolbar, flat metrics, evidence before inspector actions, technical legend in disclosure. |
| Connection Opportunities | Category totals become category controls. Secondary filters share a disclosure that names active filters. Coverage internals move into coverage disclosure; warning stays visible. Compact row metadata, separate session annotations and note actions. |
| Topology | Shared title/metric grammar; quiet Back/Refresh/Fit. Partial state stays attached to the title; map and inspector keep their existing geometry/composition. |
| Recall | Shared metric grammar, quieter refresh/source/return, visible 1–4 rating hints. Optional AI authoring explanation is distinct from native review. |
| Connect | Connection and mirror appear together on wide panes. Configuration is the primary disabled-state action. Proposal approval boundary stays visible; protocol/storage/disable details use a named disclosure. |
| Tools | Existing five launchers and editor-only descriptions retained. Shared typography/spacing; quiet references use one wrapping row. Material side-effect copy remains visible. |
| Settings | Capability summaries become compact state/provider/action rows. Native Advanced Settings uses Obsidian Setting headings and native provider buttons with aria-pressed. Inventory, callbacks, defaults and validation are frozen. |
| Setup/onboarding/recovery | Local-first first-run copy; destination-specific Back labels in both locales. Existing setup privacy, network/cost, rebuild/sync and recovery consent retained. |

Narrow interaction fix: the view rebuilds its DOM on controller notifications. Native details would otherwise close and lose summary focus during an update. Open state is copied from keyed details immediately before that same-page render and restored before the existing focus/scroll restoration. It is never persisted and resets on route changes. A regression test checks open state, summary focus, preventScroll, viewport and passive IO. Topology's existing legend uses the same mechanism.

Removed only proven obsolete CSS: unused Health summary/scan selectors, former row-explanation selectors, superseded per-surface metric declarations and metric grid overrides, and the replaced settings heading selector. No stylesheet rewrite.

## E. Deliberately not changed

No new capability, analyzer, Finding type, provider operation, settings, storage, schema, dependency, route family or algorithm. Existing ports and owners remain authoritative. No invented score/history/trend; semantic geometry, centroid, top-five ranks, comparison categories, FSRS and topology remain unchanged. No release/version/tag/merge.

## F. Visual hierarchy rules

Page title → section → panel → metric → body → supporting metadata. Actual counts precede explanations; important coverage/status stays visible. Flat grouped information; bounded surfaces for maps, inspectors, recommendation and review. Theme-owned text, background, border and accent variables; no product palette.

## G. Navigation rules

Health | Findings | Discover | Recall | Connect | Tools | Settings. Topology retains Health; all semantic exploration children retain Discover. Back names its actual destination. Existing origin state and controller ownership retained; no browser-history API.

## H. Actions

Primary: explicit next step (scan/build/start/reveal/confirm/setup). Secondary: meaningful alternatives. Quiet: Back, refresh, fit, change, note navigation. Session verdicts and filters use pressed state with text; destructive recovery keeps warning styling. Disclosures remain native keyboard controls.

## I. Responsive behavior

Required native widths: 320, 390, 768, 1024, 1280, 1440, 1600. Wide 1400px shell retained. Maps/lists and inspectors stack in narrow panes. Only the primary rail scrolls horizontally; no page overflow is acceptable.

## J. Accessibility

Native buttons/inputs/details, visible interactive focus, literal note text, one shared polite route-status region. Programmatic headings retain DOM focus without control outlines. SVG nodes retain existing text/search alternatives. Color never replaces labels/selection indicators. Reduced motion disables nonessential movement.

## K. Passivity / IO

Baseline primary-route traversal after explicit fixture preparation: counters instrument semantic analyses, metadata/inventory, embedding provider, fetch, XHR, Markdown reads, plugin/Markdown writes, settings save, index mutation and localStorage. Existing requestUrl unit/integration boundaries are complementary. Host workspace persistence is distinct from plugin persistence. Final proof combines zero native counters during passive traversal/theme/width changes with the existing requestUrl and controller boundary suites. Actual scan/build/sync/review operations are measured separately and remain explicit.

## L. Remaining limitations / deferred work

- Native test environment is Linux desktop; emulated narrow viewport is not an Android/iOS test. No screen-reader speech, popout or third-party theme claim. Windows/macOS/mobile host rendering remains unverified.
- Synthetic semantics may produce dense node overlaps. Coordinates and ranking must not be distorted for cosmetic separation.
- Companion/provider services are tested with synthetic endpoints/ports; no live paid-provider reliability claim.
- Native Advanced Settings is a host modal, separate from the workspace Settings route. At 320/390px desktop viewport widths its fixed host sidebar leaves only 94/157px for plugin content: residual horizontal overflow is 169/106px in EN and 270/207px in RU. All 30 Advanced Settings cells at 768px and wider fit; all 546 workspace cells fit, including 320/390px. Provider cards now wrap, but changing the host settings navigation/layout is deferred. These narrow desktop-modal results are not a claim about native mobile Settings.
- Existing dependency audit advisories from `npm ci` are outside this presentation milestone; no dependency changes.

## M. Evidence and validation

Evidence is committed under `final-product-ui-ux-evidence/`. The before report includes full visible copy/headings/actions; the after report adds the responsive matrix, IO counts, user-journey checkpoints, artifact hashes and exceptions. Snapshot-injected uncommon states are explicitly labeled in the driver; real user journeys use the production controllers and HTTP clients against localhost fixtures.

Separate visual review was performed after the initial implementation captures, followed by corrections and final recapture. Findings and resolutions:

| Finding | Resolution / disposition |
| --- | --- |
| Host button styling overrode workflow surfaces | Scoped the workflow class to the workspace so intended border/shadow hierarchy wins. |
| Narrow category words wrapped awkwardly | Compact category rows below 300px available content width. |
| Narrow three-digit category count split into separate digits | Intrinsic count column plus nowrap numeric text; recaptured both locales. |
| Settings summaries still consumed too much vertical space | State/provider/vector metadata now shares a wrapping line. |
| Advanced Settings hardcoded purple accents and emulated buttons | Theme tokens and native pressed buttons; native Setting headings satisfy the repository lint contract. |
| Advanced Settings free-model button remained Russian in EN; provider captions were too small/faint and the fixed five-column grid compressed them in narrow panes | Routed the existing label through its existing translation and used native small-font/muted-text tokens with an automatically wrapping provider grid. The language picker intentionally retains “Русский”. |
| Some screenshots caught finite entrance transitions mid-fade | Capture harness now finishes finite animations, dismisses transient host tooltips and allows a short paint interval; complete set recaptured, without a product behavior change. |
| Dense synthetic semantic nodes overlap | Retained honest coordinates and algorithms. Search/list/inspector remain the accessible alternative. |
| Long Tools side-effect explanations | Retained where they distinguish writes/provider work; shared spacing avoids additional framing. |

The independent pass means a separate screenshot inspection pass by the primary agent, not a claim of an external reviewer or screen-reader audit.

Validation and screenshot index are appended below.

### Automated verification

| Command | Result |
| --- | --- |
| `npm ci` | Passed; lockfile unchanged. Existing dependency advisories retained, with no package changes. |
| `npm run typecheck` | Passed (plugin and Health projects). |
| `npm test -- health` | 986 passed / 47 files. |
| `npm test -- semantic` | 484 passed / 21 files. |
| `npm test -- recall` | 557 passed / 20 files. |
| `npm test` | 2,680 passed / 109 files. |
| `npx eslint health semantic recall` | Passed, no warnings. |
| `npm run lint` | Passed; only the existing reviewed `api.ts` SSE fetch advisory. |
| `npm run audit:proposals` | 5/5 mutation probes killed; each restored test passed. The sandbox run returned an empty child-process result; the unchanged audit passed outside the sandbox. |
| `npm run build` | Passed. |

Settings inventory retains every durable key, default and callback. Only the three explicitly reviewed presentation methods (native headings/provider buttons and the existing free-model translation) have new expected fingerprints. No engine test was rewritten to fit markup.

### Native verification scope

- EN and RU; native default dark/light and a synthetic yellow accent supplied through Obsidian's accent variable.
- Widths 320, 390, 768, 1024, 1280, 1440, 1600: 13 major route/composition scenarios per locale/theme/width = 546 cells.
- Each cell checks page overflow, shell/rail alignment, seven primary tabs, current parent tab, native focus visibility, raw locale keys and no SVG node Tab stops. Narrow composition checks cover map/list stacking; desktop retains the wide shell.
- Primary rail uses real Tab/Enter activation at all seven widths. Finite page-entrance animations are completed before settled-frame recaptures; Pulse is not reinterpreted.
- Existing `workspace-ui-native.mjs`: 144 held-load/refresh/stale updates, pointer and keyboard; maximum recorded scroll delta 0px. Another 168 primary-route/theme/width checks verify alignment and hidden polite status.
- Both-language keyboard journeys (the harness focuses visible named native controls and sends real Enter/text/digit events; the rail additionally uses sequential Tab): fresh local onboarding/scan/Findings; Recall inventory and two reviews; custom semantic connection test and confirmed index build; all child-return origins; Connect configure/check/explicit sync/proposal entry; Tools batch-modal entry and Settings configuration.
- The localhost service fixture implements only the existing embedding and Companion v1 responses needed for these journeys. It records numeric request counts, never note bodies or credentials. Real controllers, scheduling, indexing and HTTP clients execute unchanged.
- Rare setup/error/loading/stale/recovery variants use controlled presentation snapshots. This establishes copy/layout, not a claim that every operational failure was induced natively. Engine and recovery behavior remain covered by existing tests.

### Scope assertions

No new product capability, analyzer, Finding type, semantic algorithm/threshold, Topology algorithm, Recall scheduling behavior, provider/indexing behavior, persistence, setting, schema, dependency or route family. All seven primary routes and all child routes remain. No version bump, tag, release or merge.

### Reproduction

Build with `npm ci && npm run build`, prepare an isolated fixture using `node scripts/connection-opportunities-prepare.mjs /tmp/final-product-ui-ux`, and launch native Obsidian with that disposable vault/profile and a localhost CDP port. The existing native harness must wait for command registration and `workspace.onLayoutReady`.

Run:

```sh
node scripts/final-product-ui-native.mjs http://127.0.0.1:9262 /tmp/final-product-ui-ux after
node scripts/final-product-ui-native.mjs http://127.0.0.1:9262 /tmp/final-product-ui-ux recapture
node scripts/workspace-ui-native.mjs http://127.0.0.1:9262 /tmp/final-product-ui-ux/vault
```

The `after` run performs the full matrix and real journeys; `recapture` repeats the full matrix and produces settled frames for the complete screenshot set, including Findings/Topology composition with their concrete grid selectors. The scripts reject a non-local CDP endpoint or a root outside `/tmp`. Journey servers bind only `127.0.0.1:9290` and `127.0.0.1:27124`, then close.

Before screenshots were captured from baseline before any product edit. Final bundle SHA-256: `87ecfbd74e5db7dc1e0f7d9e1ed07c41631cc2b45203cb5bc3efe5cbf297eb5c`; styles SHA-256: `c28fb14b7157c06d6f959434da5ae52a7fd82e7248a13f99c2bdc68e6903ee31`.

### Final native results

| Viewport | Workspace: EN/RU × 3 themes × 13 scenarios | Native Advanced Settings |
| --- | --- | --- |
| 320 | 78/78 pass; no page overflow | Host modal limitation above |
| 390 | 78/78 pass; no page overflow | Host modal limitation above |
| 768 | 78/78 pass; no page overflow | 6/6 fit |
| 1024 | 78/78 pass; no page overflow | 6/6 fit |
| 1280 | 78/78 pass; no page overflow | 6/6 fit |
| 1440 | 78/78 pass; no page overflow | 6/6 fit |
| 1600 | 78/78 pass; no page overflow | 6/6 fit |

Final settled capture run: 142 native route/state observations, 178 screenshots, 546 matrix cells, 42 separate Advanced Settings layout observations, no runtime exceptions or raw workspace translation keys. English Advanced Settings is also checked for unintended Russian text, excluding the intentional language choice “Русский”. Both locale traversals and every matrix scenario record zero in all instrumented passive IO counters.

### Screenshot index

All images use synthetic data. Matching baseline captures are linked beside the final views; additional final captures cover the expanded state/width/theme audit. The JSON reports distinguish controlled presentation states from executed operations.

- [Before report](final-product-ui-ux-evidence/before/report.json)
- [Final matrix/state report](final-product-ui-ux-evidence/after/report.json)
- [Settled core capture record](final-product-ui-ux-evidence/core-captures.json)
- [Automated validation log](final-product-ui-ux-evidence/validation.txt)
- [Final user journeys](final-product-ui-ux-evidence/journeys.json)
- [Native stability log](final-product-ui-ux-evidence/stability.log)
- [Changed file inventory](final-product-ui-ux-evidence/changed-files.txt)

| Capture | Before EN | Final EN | Before RU | Final RU |
| --- | --- | --- | --- | --- |
| 390-connections | [EN](final-product-ui-ux-evidence/before/en-390-connections.png) | [EN](final-product-ui-ux-evidence/after/en-390-connections.png) | [RU](final-product-ui-ux-evidence/before/ru-390-connections.png) | [RU](final-product-ui-ux-evidence/after/ru-390-connections.png) |
| 390-health | [EN](final-product-ui-ux-evidence/before/en-390-health.png) | [EN](final-product-ui-ux-evidence/after/en-390-health.png) | [RU](final-product-ui-ux-evidence/before/ru-390-health.png) | [RU](final-product-ui-ux-evidence/after/ru-390-health.png) |
| advanced-settings | [EN](final-product-ui-ux-evidence/before/en-advanced-settings.png) | [EN](final-product-ui-ux-evidence/after/en-advanced-settings.png) | [RU](final-product-ui-ux-evidence/before/ru-advanced-settings.png) | [RU](final-product-ui-ux-evidence/after/ru-advanced-settings.png) |
| comparison-semantic-unavailable | — | [EN](final-product-ui-ux-evidence/after/en-comparison-semantic-unavailable.png) | — | [RU](final-product-ui-ux-evidence/after/ru-comparison-semantic-unavailable.png) |
| comparison-topology-unavailable | — | [EN](final-product-ui-ux-evidence/after/en-comparison-topology-unavailable.png) | — | [RU](final-product-ui-ux-evidence/after/ru-comparison-topology-unavailable.png) |
| connect-configured | [EN](final-product-ui-ux-evidence/before/en-connect-configured.png) | [EN](final-product-ui-ux-evidence/after/en-connect-configured.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-configured.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-configured.png) |
| connect-confirm | [EN](final-product-ui-ux-evidence/before/en-connect-confirm.png) | [EN](final-product-ui-ux-evidence/after/en-connect-confirm.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-confirm.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-confirm.png) |
| connect-disabled | [EN](final-product-ui-ux-evidence/before/en-connect-disabled.png) | [EN](final-product-ui-ux-evidence/after/en-connect-disabled.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-disabled.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-disabled.png) |
| connect-error | [EN](final-product-ui-ux-evidence/before/en-connect-error.png) | [EN](final-product-ui-ux-evidence/after/en-connect-error.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-error.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-error.png) |
| connect-ready | [EN](final-product-ui-ux-evidence/before/en-connect-ready.png) | [EN](final-product-ui-ux-evidence/after/en-connect-ready.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-ready.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-ready.png) |
| connect-setup-local | [EN](final-product-ui-ux-evidence/before/en-connect-setup-local.png) | [EN](final-product-ui-ux-evidence/after/en-connect-setup-local.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-setup-local.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-setup-local.png) |
| connect-setup-remote | [EN](final-product-ui-ux-evidence/before/en-connect-setup-remote.png) | [EN](final-product-ui-ux-evidence/after/en-connect-setup-remote.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-setup-remote.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-setup-remote.png) |
| connect-syncing | [EN](final-product-ui-ux-evidence/before/en-connect-syncing.png) | [EN](final-product-ui-ux-evidence/after/en-connect-syncing.png) | [RU](final-product-ui-ux-evidence/before/ru-connect-syncing.png) | [RU](final-product-ui-ux-evidence/after/ru-connect-syncing.png) |
| connect | [EN](final-product-ui-ux-evidence/before/en-connect.png) | [EN](final-product-ui-ux-evidence/after/en-connect.png) | [RU](final-product-ui-ux-evidence/before/ru-connect.png) | [RU](final-product-ui-ux-evidence/after/ru-connect.png) |
| connection-opportunities-1440-light | — | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-1440-light.png) | — | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-1440-light.png) |
| connection-opportunities-1440-yellow | — | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-1440-yellow.png) | — | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-1440-yellow.png) |
| connection-opportunities-390-light | — | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-390-light.png) | — | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-390-light.png) |
| connection-opportunities-390-yellow | — | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-390-yellow.png) | — | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-390-yellow.png) |
| connection-opportunities-error | [EN](final-product-ui-ux-evidence/before/en-connection-opportunities-error.png) | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-error.png) | [RU](final-product-ui-ux-evidence/before/ru-connection-opportunities-error.png) | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-error.png) |
| connection-opportunities-loading | [EN](final-product-ui-ux-evidence/before/en-connection-opportunities-loading.png) | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-loading.png) | [RU](final-product-ui-ux-evidence/before/ru-connection-opportunities-loading.png) | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-loading.png) |
| connection-opportunities-stale | [EN](final-product-ui-ux-evidence/before/en-connection-opportunities-stale.png) | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities-stale.png) | [RU](final-product-ui-ux-evidence/before/ru-connection-opportunities-stale.png) | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities-stale.png) |
| connection-opportunities | [EN](final-product-ui-ux-evidence/before/en-connection-opportunities.png) | [EN](final-product-ui-ux-evidence/after/en-connection-opportunities.png) | [RU](final-product-ui-ux-evidence/before/ru-connection-opportunities.png) | [RU](final-product-ui-ux-evidence/after/ru-connection-opportunities.png) |
| deep-choose | [EN](final-product-ui-ux-evidence/before/en-deep-choose.png) | [EN](final-product-ui-ux-evidence/after/en-deep-choose.png) | [RU](final-product-ui-ux-evidence/before/ru-deep-choose.png) | [RU](final-product-ui-ux-evidence/after/ru-deep-choose.png) |
| deep-error | [EN](final-product-ui-ux-evidence/before/en-deep-error.png) | [EN](final-product-ui-ux-evidence/after/en-deep-error.png) | [RU](final-product-ui-ux-evidence/before/ru-deep-error.png) | [RU](final-product-ui-ux-evidence/after/ru-deep-error.png) |
| deep-form | [EN](final-product-ui-ux-evidence/before/en-deep-form.png) | [EN](final-product-ui-ux-evidence/after/en-deep-form.png) | [RU](final-product-ui-ux-evidence/before/ru-deep-form.png) | [RU](final-product-ui-ux-evidence/after/ru-deep-form.png) |
| discover-building | [EN](final-product-ui-ux-evidence/before/en-discover-building.png) | [EN](final-product-ui-ux-evidence/after/en-discover-building.png) | [RU](final-product-ui-ux-evidence/before/ru-discover-building.png) | [RU](final-product-ui-ux-evidence/after/ru-discover-building.png) |
| discover-configured | [EN](final-product-ui-ux-evidence/before/en-discover-configured.png) | [EN](final-product-ui-ux-evidence/after/en-discover-configured.png) | [RU](final-product-ui-ux-evidence/before/ru-discover-configured.png) | [RU](final-product-ui-ux-evidence/after/ru-discover-configured.png) |
| discover-disabled | [EN](final-product-ui-ux-evidence/before/en-discover-disabled.png) | [EN](final-product-ui-ux-evidence/after/en-discover-disabled.png) | [RU](final-product-ui-ux-evidence/before/ru-discover-disabled.png) | [RU](final-product-ui-ux-evidence/after/ru-discover-disabled.png) |
| discover-error | [EN](final-product-ui-ux-evidence/before/en-discover-error.png) | [EN](final-product-ui-ux-evidence/after/en-discover-error.png) | [RU](final-product-ui-ux-evidence/before/ru-discover-error.png) | [RU](final-product-ui-ux-evidence/after/ru-discover-error.png) |
| discover-incompatible | [EN](final-product-ui-ux-evidence/before/en-discover-incompatible.png) | [EN](final-product-ui-ux-evidence/after/en-discover-incompatible.png) | [RU](final-product-ui-ux-evidence/before/ru-discover-incompatible.png) | [RU](final-product-ui-ux-evidence/after/ru-discover-incompatible.png) |
| discover | [EN](final-product-ui-ux-evidence/before/en-discover.png) | [EN](final-product-ui-ux-evidence/after/en-discover.png) | [RU](final-product-ui-ux-evidence/before/ru-discover.png) | [RU](final-product-ui-ux-evidence/after/ru-discover.png) |
| finding-inspector | [EN](final-product-ui-ux-evidence/before/en-finding-inspector.png) | [EN](final-product-ui-ux-evidence/after/en-finding-inspector.png) | [RU](final-product-ui-ux-evidence/before/ru-finding-inspector.png) | [RU](final-product-ui-ux-evidence/after/ru-finding-inspector.png) |
| findings-empty | — | [EN](final-product-ui-ux-evidence/after/en-findings-empty.png) | — | [RU](final-product-ui-ux-evidence/after/ru-findings-empty.png) |
| findings | [EN](final-product-ui-ux-evidence/before/en-findings.png) | [EN](final-product-ui-ux-evidence/after/en-findings.png) | [RU](final-product-ui-ux-evidence/before/ru-findings.png) | [RU](final-product-ui-ux-evidence/after/ru-findings.png) |
| global-core-unavailable | — | [EN](final-product-ui-ux-evidence/after/en-global-core-unavailable.png) | — | [RU](final-product-ui-ux-evidence/after/ru-global-core-unavailable.png) |
| global-focus-error | — | [EN](final-product-ui-ux-evidence/after/en-global-focus-error.png) | — | [RU](final-product-ui-ux-evidence/after/ru-global-focus-error.png) |
| global-focus | [EN](final-product-ui-ux-evidence/before/en-global-focus.png) | [EN](final-product-ui-ux-evidence/after/en-global-focus.png) | [RU](final-product-ui-ux-evidence/before/ru-global-focus.png) | [RU](final-product-ui-ux-evidence/after/ru-global-focus.png) |
| global-invalid | — | [EN](final-product-ui-ux-evidence/after/en-global-invalid.png) | — | [RU](final-product-ui-ux-evidence/after/ru-global-invalid.png) |
| global-too-large | — | [EN](final-product-ui-ux-evidence/after/en-global-too-large.png) | — | [RU](final-product-ui-ux-evidence/after/ru-global-too-large.png) |
| global-unavailable | — | [EN](final-product-ui-ux-evidence/after/en-global-unavailable.png) | — | [RU](final-product-ui-ux-evidence/after/ru-global-unavailable.png) |
| health-1024-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-1024-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-1024-dark.png) |
| health-1280-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-1280-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-1280-dark.png) |
| health-1440-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-1440-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-1440-dark.png) |
| health-1600-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-1600-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-1600-dark.png) |
| health-320-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-320-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-320-dark.png) |
| health-390-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-390-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-390-dark.png) |
| health-768-dark | — | [EN](final-product-ui-ux-evidence/after/en-health-768-dark.png) | — | [RU](final-product-ui-ux-evidence/after/ru-health-768-dark.png) |
| health-recovery-confirm | [EN](final-product-ui-ux-evidence/before/en-health-recovery-confirm.png) | [EN](final-product-ui-ux-evidence/after/en-health-recovery-confirm.png) | [RU](final-product-ui-ux-evidence/before/ru-health-recovery-confirm.png) | [RU](final-product-ui-ux-evidence/after/ru-health-recovery-confirm.png) |
| health | [EN](final-product-ui-ux-evidence/before/en-health.png) | [EN](final-product-ui-ux-evidence/after/en-health.png) | [RU](final-product-ui-ux-evidence/before/ru-health.png) | [RU](final-product-ui-ux-evidence/after/ru-health.png) |
| knowledge-confirm | [EN](final-product-ui-ux-evidence/before/en-knowledge-confirm.png) | [EN](final-product-ui-ux-evidence/after/en-knowledge-confirm.png) | [RU](final-product-ui-ux-evidence/before/ru-knowledge-confirm.png) | [RU](final-product-ui-ux-evidence/after/ru-knowledge-confirm.png) |
| neighborhood-absent | — | [EN](final-product-ui-ux-evidence/after/en-neighborhood-absent.png) | — | [RU](final-product-ui-ux-evidence/after/ru-neighborhood-absent.png) |
| neighborhood-choosing | — | [EN](final-product-ui-ux-evidence/after/en-neighborhood-choosing.png) | — | [RU](final-product-ui-ux-evidence/after/ru-neighborhood-choosing.png) |
| neighborhood-incompatible | — | [EN](final-product-ui-ux-evidence/after/en-neighborhood-incompatible.png) | — | [RU](final-product-ui-ux-evidence/after/ru-neighborhood-incompatible.png) |
| neighborhood-source-removed | — | [EN](final-product-ui-ux-evidence/after/en-neighborhood-source-removed.png) | — | [RU](final-product-ui-ux-evidence/after/ru-neighborhood-source-removed.png) |
| neighborhood-unavailable | — | [EN](final-product-ui-ux-evidence/after/en-neighborhood-unavailable.png) | — | [RU](final-product-ui-ux-evidence/after/ru-neighborhood-unavailable.png) |
| onboarding-profile | [EN](final-product-ui-ux-evidence/before/en-onboarding-profile.png) | [EN](final-product-ui-ux-evidence/after/en-onboarding-profile.png) | [RU](final-product-ui-ux-evidence/before/ru-onboarding-profile.png) | [RU](final-product-ui-ux-evidence/after/ru-onboarding-profile.png) |
| onboarding-recovery | [EN](final-product-ui-ux-evidence/before/en-onboarding-recovery.png) | [EN](final-product-ui-ux-evidence/after/en-onboarding-recovery.png) | [RU](final-product-ui-ux-evidence/before/ru-onboarding-recovery.png) | [RU](final-product-ui-ux-evidence/after/ru-onboarding-recovery.png) |
| onboarding-scan | [EN](final-product-ui-ux-evidence/before/en-onboarding-scan.png) | [EN](final-product-ui-ux-evidence/after/en-onboarding-scan.png) | [RU](final-product-ui-ux-evidence/before/ru-onboarding-scan.png) | [RU](final-product-ui-ux-evidence/after/ru-onboarding-scan.png) |
| recall-confirm | [EN](final-product-ui-ux-evidence/before/en-recall-confirm.png) | [EN](final-product-ui-ux-evidence/after/en-recall-confirm.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-confirm.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-confirm.png) |
| recall-empty | [EN](final-product-ui-ux-evidence/before/en-recall-empty.png) | [EN](final-product-ui-ux-evidence/after/en-recall-empty.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-empty.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-empty.png) |
| recall-error | [EN](final-product-ui-ux-evidence/before/en-recall-error.png) | [EN](final-product-ui-ux-evidence/after/en-recall-error.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-error.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-error.png) |
| recall-first | [EN](final-product-ui-ux-evidence/before/en-recall-first.png) | [EN](final-product-ui-ux-evidence/after/en-recall-first.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-first.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-first.png) |
| recall-loading | [EN](final-product-ui-ux-evidence/before/en-recall-loading.png) | [EN](final-product-ui-ux-evidence/after/en-recall-loading.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-loading.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-loading.png) |
| recall-partial | [EN](final-product-ui-ux-evidence/before/en-recall-partial.png) | [EN](final-product-ui-ux-evidence/after/en-recall-partial.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-partial.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-partial.png) |
| recall-recovery | [EN](final-product-ui-ux-evidence/before/en-recall-recovery.png) | [EN](final-product-ui-ux-evidence/after/en-recall-recovery.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-recovery.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-recovery.png) |
| recall-review | [EN](final-product-ui-ux-evidence/before/en-recall-review.png) | [EN](final-product-ui-ux-evidence/after/en-recall-review.png) | [RU](final-product-ui-ux-evidence/before/ru-recall-review.png) | [RU](final-product-ui-ux-evidence/after/ru-recall-review.png) |
| recall | [EN](final-product-ui-ux-evidence/before/en-recall.png) | [EN](final-product-ui-ux-evidence/after/en-recall.png) | [RU](final-product-ui-ux-evidence/before/ru-recall.png) | [RU](final-product-ui-ux-evidence/after/ru-recall.png) |
| semantic-choose | [EN](final-product-ui-ux-evidence/before/en-semantic-choose.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-choose.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-choose.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-choose.png) |
| semantic-connected | [EN](final-product-ui-ux-evidence/before/en-semantic-connected.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-connected.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-connected.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-connected.png) |
| semantic-error | [EN](final-product-ui-ux-evidence/before/en-semantic-error.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-error.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-error.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-error.png) |
| semantic-form | [EN](final-product-ui-ux-evidence/before/en-semantic-form.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-form.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-form.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-form.png) |
| semantic-map-1440-light | — | [EN](final-product-ui-ux-evidence/after/en-semantic-map-1440-light.png) | — | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-1440-light.png) |
| semantic-map-1440-yellow | — | [EN](final-product-ui-ux-evidence/after/en-semantic-map-1440-yellow.png) | — | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-1440-yellow.png) |
| semantic-map-390-light | — | [EN](final-product-ui-ux-evidence/after/en-semantic-map-390-light.png) | — | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-390-light.png) |
| semantic-map-390-yellow | — | [EN](final-product-ui-ux-evidence/after/en-semantic-map-390-yellow.png) | — | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-390-yellow.png) |
| semantic-map-error | [EN](final-product-ui-ux-evidence/before/en-semantic-map-error.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-map-error.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-map-error.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-error.png) |
| semantic-map-loading | [EN](final-product-ui-ux-evidence/before/en-semantic-map-loading.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-map-loading.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-map-loading.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-loading.png) |
| semantic-map-stale | [EN](final-product-ui-ux-evidence/before/en-semantic-map-stale.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-map-stale.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-map-stale.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-map-stale.png) |
| semantic-map | [EN](final-product-ui-ux-evidence/before/en-semantic-map.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-map.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-map.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-map.png) |
| semantic-neighborhood-error | [EN](final-product-ui-ux-evidence/before/en-semantic-neighborhood-error.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-neighborhood-error.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-neighborhood-error.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-neighborhood-error.png) |
| semantic-neighborhood-loading | [EN](final-product-ui-ux-evidence/before/en-semantic-neighborhood-loading.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-neighborhood-loading.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-neighborhood-loading.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-neighborhood-loading.png) |
| semantic-neighborhood-stale | [EN](final-product-ui-ux-evidence/before/en-semantic-neighborhood-stale.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-neighborhood-stale.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-neighborhood-stale.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-neighborhood-stale.png) |
| semantic-neighborhood | [EN](final-product-ui-ux-evidence/before/en-semantic-neighborhood.png) | [EN](final-product-ui-ux-evidence/after/en-semantic-neighborhood.png) | [RU](final-product-ui-ux-evidence/before/ru-semantic-neighborhood.png) | [RU](final-product-ui-ux-evidence/after/ru-semantic-neighborhood.png) |
| settings | [EN](final-product-ui-ux-evidence/before/en-settings.png) | [EN](final-product-ui-ux-evidence/after/en-settings.png) | [RU](final-product-ui-ux-evidence/before/ru-settings.png) | [RU](final-product-ui-ux-evidence/after/ru-settings.png) |
| tools | [EN](final-product-ui-ux-evidence/before/en-tools.png) | [EN](final-product-ui-ux-evidence/after/en-tools.png) | [RU](final-product-ui-ux-evidence/before/ru-tools.png) | [RU](final-product-ui-ux-evidence/after/ru-tools.png) |
| topology-error | [EN](final-product-ui-ux-evidence/before/en-topology-error.png) | [EN](final-product-ui-ux-evidence/after/en-topology-error.png) | [RU](final-product-ui-ux-evidence/before/ru-topology-error.png) | [RU](final-product-ui-ux-evidence/after/ru-topology-error.png) |
| topology-loading | [EN](final-product-ui-ux-evidence/before/en-topology-loading.png) | [EN](final-product-ui-ux-evidence/after/en-topology-loading.png) | [RU](final-product-ui-ux-evidence/before/ru-topology-loading.png) | [RU](final-product-ui-ux-evidence/after/ru-topology-loading.png) |
| topology-stale | [EN](final-product-ui-ux-evidence/before/en-topology-stale.png) | [EN](final-product-ui-ux-evidence/after/en-topology-stale.png) | [RU](final-product-ui-ux-evidence/before/ru-topology-stale.png) | [RU](final-product-ui-ux-evidence/after/ru-topology-stale.png) |
| topology | [EN](final-product-ui-ux-evidence/before/en-topology.png) | [EN](final-product-ui-ux-evidence/after/en-topology.png) | [RU](final-product-ui-ux-evidence/before/ru-topology.png) | [RU](final-product-ui-ux-evidence/after/ru-topology.png) |
