# Veynrel 2.0.0 release verification

This is the engineering record for `chore/release-2.0.0`. The publication-ready GitHub Release body is [releases/2.0.0.md](releases/2.0.0.md). This preparation does not publish a tag, release or release assets. Publication belongs to the user after review and merge.

## Baselines and scope

After `git switch main`, `git pull --ff-only` and an empty `git status --porcelain=v1`, the actual baseline was **`c4d402be45e1c418f0c6c27f63be7f52c8996995`** (merged README PR #64). Preflight found no local `2.0.0`/`v2.0.0` tag, remote tag with either spelling, or GitHub release with either tag. Historical tags/releases, including an unrelated old draft, were left untouched.

The release comparison is **published 1.9.0 → 2.0.0**, not PR #64 → this branch.

| Published 1.9.0 | Evidence |
| --- | --- |
| Release | [Veynrel 1.9.0](https://github.com/zinverno/veynrel/releases/tag/1.9.0), release ID `396053888`, published `2026-09-24T20:26:50Z`; neither draft nor prerelease |
| Tag | `1.9.0`; annotated tag object `fb356f6818d9d50018a5654a7e976d9dd6e681fe` |
| Peeled commit | `a10776422379f77bfc35068cec14a6e2a6ad691d` |

Downloaded the actual three GitHub release assets with `gh release download 1.9.0`. Each byte count and SHA-256 matched the GitHub asset metadata/digest:

| Published asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `main.js` | 765344 | `ef5a1deff49120e1fa730c5bcf75d6399f773730523d69ac9392ac841e078c32` |
| `manifest.json` | 349 | `b018c1d54c7a94044007f80e25a330f20e0ebdea9597e3bd56e3a8570489ac9f` |
| `styles.css` | 66344 | `16ca3bf971baf678a13302ab66c47c938ba6c8928fe5af96d16e31b92660247e` |

| Area | Change since published 1.9.0 |
| --- | --- |
| Health | Visual dashboard, Vault Pulse refinement, current-data hierarchy and metadata-based Vault Topology |
| Semantic exploration | Semantic Neighborhood; Global Semantic Map with core, connectedness and selected-note focus; map presentation improvements |
| Connection Opportunities | Sparse semantic top-5 versus Markdown comparison; rank/shared-neighbor evidence, session review and safe pair inspection |
| Index reliability | Actionable failure/progress states, hard chunk bounds including oversized atomic blocks, bounded retry and timeout behavior |
| Workspace | Whole-product hierarchy, copy, action/navigation consistency, responsive composition and EN/RU consolidation |
| Product presentation | Updated README and committed synthetic visual showcase |
| Existing capabilities | Native Recall/FSRS-6, Knowledge Health, Connect/Companion proposals, Tools and Settings remain; they are not presented as newly invented in 2.0 |

This PR changes versions, the short listing description, release documentation/evidence, and the existing release compatibility test plus its frozen fixture. It adds no product capability, dependency, engine change, stylesheet change or storage schema. No release blocker required product code changes.

## Versions and minimum runtime

Ran **`npm version 2.0.0 --no-git-tag-version`**, using the repository's existing `version-bump.mjs` script. The four version files were not manually edited before running it.

| Location | Verified value |
| --- | --- |
| `package.json.version` | `2.0.0` |
| `package-lock.json.version` | `2.0.0` |
| `package-lock.json.packages[""].version` | `2.0.0` |
| `manifest.json.version` | `2.0.0` |
| `versions.json["2.0.0"]` | `1.8.7`, equal to `manifest.minAppVersion` |
| Plugin ID / name | `ai-knowledge-hub` / `Veynrel` |
| Desktop-only / author / funding | `false` / `Zinvernix` / `https://boosty.to/veynrel`, unchanged |

The description now summarizes Health, semantic connections, native spaced repetition and explicit AI workflows. A structured comparison confirmed that package dependencies/scripts and all lock entries except the two version fields are unchanged.

**Keep `minAppVersion: 1.8.7`.** A fresh run used the official Linux Obsidian **1.8.7 / Electron 33.3.2** distribution with the final candidate assets. It passed the same desktop upgrade and acceptance probes as modern Obsidian, including native `Setting` headings, provider controls and opening a connection pair with the public workspace split API. This decision uses current 2.0 evidence, not the old 1.9 verification record.

## Published-artifact upgrade method

1. Install the downloaded 1.9.0 assets under `.obsidian/plugins/ai-knowledge-hub/` in an isolated synthetic vault.
2. Seed six Markdown notes, unrelated binary user data, non-default settings, distinct dummy LLM/embedding/Companion credentials, endpoint/vault identity, enabled-state and historical hotkey sentinels.
3. Through the actual published plugin, explicitly build/search the semantic index, run local Health, discover four Recall cards and rate one Good. Save the legacy Deep Audit cache through its existing owner. A deterministic embedding transport is injected only into this test runtime; no live paid provider or personal credentials are used.
4. Freeze the vault before upgrade. Store the [fixture and provenance](../tests/fixtures/upgrade-1.9.0/provenance.json), including published asset hashes, all 21 command IDs and hashes of 16 preserved files.
5. Replace **only `main.js`, `manifest.json`, `styles.css`**, refresh manifests and reload the same plugin ID. Use a separate frozen copy for Obsidian 1.8.7.
6. Check passive load/navigation and byte preservation before explicit operations are allowed. Then exercise the new surfaces, Finding lifecycle, local scan and Recall rating.

The fixture contains synthetic credentials with `.invalid` provider endpoints. Published JavaScript/CSS are downloaded for verification, not copied into the source fixture. `releaseCompatibility.test.ts` reuses its existing loader/index test for both the frozen 1.8.0 and 1.9.0 fixtures, retains historical command assertions and verifies all current version fields.

## Upgrade results

[Native evidence](release-2.0.0-evidence/native.json) records 45 upgrade assertions and 23 acceptance assertions on each desktop runtime, with no captured exceptions. All **16 frozen files remained byte-identical** after passive upgrade on both runtimes.

| Contract | Observed result |
| --- | --- |
| Identity / activation | Same folder and plugin ID; enabled-state and hotkey files unchanged; all 21 published command IDs retained |
| Settings | Every saved compatible value retained, including independent credentials, provider/model settings, language, output folders, Health preferences and Companion configuration; no passive settings save |
| Semantic index | Schema-1 descriptor/binary unchanged; compatible index loads without a rebuild; explicit semantic search succeeds against it |
| Health | Version-2 Findings/history unchanged; published scan receipt and six Findings retained; explicit dismiss/reopen and a new local scan work |
| Recall | Version-3 inventory and schedules unchanged before review; four cards retained; reveal/four ratings and a Good rating work; review needs no Markdown discovery or provider |
| Connect | Endpoint, token, enabled state and vault identity retained; no passive sync or proposal application; proposal approval guards remain covered by the full suite and mutation audit |
| Legacy Deep Audit | Version-3 `note-index.json` unchanged and readable by its existing owner |
| User content | All six Markdown notes and unrelated binary sentinel unchanged during passive upgrade; no migration to another plugin directory |

The native fixture exercises current published formats. Existing automated Recall tests additionally cover v1, canonical/transitional v2, v3, and protected unsupported future schema/scheduler data. Those are storage/service tests, not separate native migrations of every format. No new migration promise or crash-atomicity guarantee is introduced.

### IO interpretation

Desktop startup reads existing plugin state; opening each of the seven primary tabs then performs no Markdown enumeration/body reads, provider request, settings save or plugin write. Explicit compatible-index loading reads its descriptor/binary and performs the existing best-effort cleanup of non-authoritative temporary/backup paths; it does not rewrite the authoritative index. The frozen-byte check proves preservation separately from method-call counts.

Explicit Topology capture uses Markdown metadata/enumeration. Neighborhood, Global Map/core/focus and candidate annotation reuse the index: no new embedding request, Markdown body read or storage write. The one embedding request observed is the **explicit search query**. Opening both notes intentionally reads their content. Explicit local scans and Recall ratings write their existing stores as expected. Obsidian's own `workspace.json` saves are counted separately from plugin writes.

The first Android probe used a broad adapter counter and recorded one unclassified write while opening Health; it is not used as zero-write evidence. A scoped recheck of all seven tabs recorded zero plugin writes, Markdown work or provider requests. Android settings/Recall preservation and unchanged-note checks are independent of that counter.

## Native release acceptance

| Runtime | Freshly exercised | Result |
| --- | --- | --- |
| Linux Obsidian 1.12.7 / Electron 39.8.10 | Published 1.9 upgrade; all seven tabs; all child surfaces below; local Health; native Recall; Advanced Settings | PASS |
| Linux Obsidian 1.8.7 / Electron 33.3.2 | Same frozen upgrade and desktop acceptance, including public split-opening and native headings | PASS; declared minimum retained |
| Android 15 / API 35 x86_64 emulator, Obsidian 1.13.8, WebView 124, 320×844 | Replace the three assets over an existing synthetic 1.9 installation; settings/Recall preserved; seven tabs; local Health; Recall inventory/reveal/rating; basic Discover; notes unchanged | PASS; 25 assertions, no captured exceptions |

| Surface | Desktop acceptance |
| --- | --- |
| Health / Findings / Vault Topology | Dashboard and saved state open; Finding dismiss/reopen; explicit local check; explicit topology capture, map and Back |
| Discover / Neighborhood | Compatible index ready; explicit query; choose source and load four neighbors from saved embeddings |
| Global Map | Five eligible mapped notes; core similarity values; select Alpha through search and focus on it; exact limit shown as 500 |
| Connection Opportunities | Explicit topology plus existing index; nine Candidates and one Aligned pair; category invariants; Useful annotation; split-note opening; annotations cleared on workspace close |
| Recall | Saved inventory; start, reveal, four rating controls, Good rating and return to overview |
| Connect | Saved enabled configuration renders; no automatic synchronization/application |
| Tools / Settings | Existing Batch workflow modal opens; product overview and native Advanced Settings render |

The small native fixture has no Explicit-only pair. That category and actual 500/501-note rejection are exercised by automated tests, not inferred from the five-note native map. Android semantic graphs were not exercised in this release run. Physical Android, iOS, macOS and Windows are unverified here.

This is bounded release acceptance, not a rerun of PR #63's complete design matrix. Its known limitation remains: the native Obsidian **Advanced Settings host modal can overflow at artificial 320/390px desktop window widths**. The Veynrel workspace passed those widths in [the consolidation audit](final-product-ui-ux.md); no private host layout was modified. Actual screen-reader output, every custom theme and every mobile graph composition are not claimed.

## Semantic and proposal regression coverage

| Contract | Current automated evidence |
| --- | --- |
| Full indexing / publication | `indexing/indexingService.test.ts`: successful full build, progress/failure states, all-or-nothing normal publication |
| Hard chunk bounds | `chunking/markdownChunker.test.ts`: oversized paragraphs and atomic Markdown/code blocks, Unicode/CRLF and bounded output |
| HTTP failure / retry / timeout | `embeddings/embeddings.test.ts` and indexing tests: safe 400 diagnostics without retries/publication, bounded 429/5xx retries, deadline/no overlapping timeout attempts |
| Neighborhood | `semantic/semanticDiscoveryService.test.ts`: existing document centroids, top-neighbor ordering/evidence and cosine similarity |
| Global core / focus / cap | Same suite: normalized centroids, semantic core, selected-to-all scores, exact 500-note support and 501-note refusal |
| No map embeddings / external work | `semantic/semanticConcurrency.integration.test.ts`: real-engine map load, focus, reset, refresh and search use existing data; native transport probe corroborates |
| Comparison / session review | `health/connections/*test.ts`: sparse top-5/category definitions, rank/shared-neighbor evidence, coverage, presentation filters and non-persistent reviews |
| Approval boundary | Proposal tests and `npm run audit:proposals`: guarded explicit application, failure/retry handling and all five security mutants killed |

No semantic thresholds, ranking, centroid math, Topology algorithms, Recall scheduling, provider/indexing behavior or proposal protocol were changed in this preparation PR. It introduces zero automatic Markdown-link mutation.

## Required checks

See [check results](release-2.0.0-evidence/checks.json). The full suite and lint were rerun after extending the release fixture/test.

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test -- health` | 986 tests / 47 files |
| `npm test -- semantic` | 484 tests / 21 files |
| `npm test -- recall` | 557 tests / 20 files |
| `npm test -- releaseCompatibility` | 7 tests / 1 file |
| `npm test` | 2,681 tests / 109 files |
| `npx eslint health semantic recall` | PASS |
| `npm run lint` | PASS; zero errors, existing streaming `fetch` warning at `api.ts:402` |
| `npm run audit:proposals` | PASS; 5/5 mutants killed |
| `npm run build` | PASS |

`npm ci` reports the existing seven development-package advisories (four moderate, three high); no dependency changes are hidden in the lockfile. This preparation does not opportunistically upgrade tooling. No live paid provider is required for these regressions.

## Final build and release assets

The exact manual release asset set is **`main.js`, `manifest.json`, `styles.css`**. Do not upload settings/data, evidence, screenshots, source-built extra bundles, README archives or package metadata as release assets. GitHub-generated source archives are separate. Generated `main.js` remains ignored.

| Candidate asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `main.js` | 934941 | `87ecfbd74e5db7dc1e0f7d9e1ed07c41631cc2b45203cb5bc3efe5cbf297eb5c` |
| `manifest.json` | 355 | `4942c1f2e5f504da61d4c4479a497bf9b5e5f9c63ce295ce39a05aa9927bbbe5` |
| `styles.css` | 108877 | `c28fb14b7157c06d6f959434da5ae52a7fd82e7248a13f99c2bdc68e6903ee31` |

[Build evidence](release-2.0.0-evidence/build.json) lists **194 production input modules** and `obsidian` as the sole external runtime import. Input/byte inspection found no test-only modules, fixtures, screenshot evidence, personal paths or synthetic credential markers. There is no arbitrary bundle-size threshold. Hashes of the installed assets on all three native runtimes exactly matched this final build.

The final commit SHA, clean-clone asset comparison, `git diff --check <baseline>..HEAD`, working-tree status and exact-HEAD CI URLs belong in the PR handoff rather than a self-referential commit. Required CI is `verify` plus both Scanner install jobs (npm 10.9.2 and 11.11.0); a failure blocks the handoff. Later documentation-only evidence does not change the tested product assets.

## Disposition and manual publication boundary

**BLOCKER:** none found in local/native verification. Exact-final-HEAD checks must pass before handoff.

**NON-BLOCKERS:** existing development advisories and streaming lint warning; the native Settings host overflow noted above; existing map cap and session-only review limitations; previously documented non-crash-atomic storage boundaries. No feature or architectural expansion was made to disguise these limits.

**UNVERIFIED:** live AI providers, real external Companion deployment/TLS, Android semantic graphs, physical Android/iOS/macOS/Windows, universal theme/accessibility coverage, physical power-loss behavior, and Community catalogue delivery of the future update. The existing enabled synchronization and proposal contracts remain unchanged; a fresh end-to-end Companion deployment was not part of this release smoke.

Before handoff, repeat local/remote tag and GitHub release absence checks for `2.0.0` and `v2.0.0`. Leave the PR open/unmerged. No tag creation/push, GitHub Release creation or release-asset upload is authorized here. The user will **build the three release assets again from merged/tagged main before publication** and use [the public release body](releases/2.0.0.md), not this engineering record.
