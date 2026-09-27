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
| Advanced Settings | Actual native tab, both locale definitions, settings inventory/search aliases | Preserve all controls/keys/defaults/validation; heading markup should be semantic. |
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

Pending implementation and final verification.

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

Baseline primary-route traversal after explicit fixture preparation: counters instrument semantic analyses, metadata/inventory, embedding provider, fetch, XHR, Markdown reads, plugin/Markdown writes, settings save, index mutation and localStorage. Existing requestUrl unit/integration boundaries are complementary. Host workspace persistence is distinct from plugin persistence. Final proof pending.

## L. Remaining limitations / deferred work

- Native test environment is Linux desktop; emulated narrow viewport is not an Android/iOS test. No screen-reader speech, popout or third-party theme claim.
- Synthetic semantics may produce dense node overlaps. Coordinates and ranking must not be distorted for cosmetic separation.
- Companion/providing services are tested with synthetic endpoints/ports; no live paid-provider reliability claim.
- Existing dependency audit advisories from `npm ci` are outside this presentation milestone; no dependency changes.

## M. Evidence and validation

Fresh before/after screenshot index, matrix, tests and exact-final-HEAD CI will be recorded here after validation.
