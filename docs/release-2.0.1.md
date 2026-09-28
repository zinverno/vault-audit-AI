# Veynrel 2.0.1 release verification

Preparation only. The PR remains open/unmerged; no tag, GitHub Release or release
asset upload is authorized. Public notes: [releases/2.0.1.md](releases/2.0.1.md).

## Baseline and scope

Fetched `origin` before editing. The clean baseline is
`7ef5b08714867b22aaf468770249e59b152b2379`, the September 28 merge of
[PR #66](https://github.com/zinverno/veynrel/pull/66). Its tree matched the local
#66 branch before creating `chore/release-2.0.1` from `origin/main`. All product
versions were 2.0.0. Neither spelling `2.0.1`/`v2.0.1` existed as a release tag;
published 2.0.0 was the latest release.

Inspected package/lock, manifest, versions, `version-bump.mjs`,
`scripts/lint-obsidian.mjs`, `docs/obsidian-review-audit.md`, CI, release provenance
and the existing maintainer checklist before editing. This patch changes CSS,
its existing presentation test, versions/current-version assertion, and release
notes/evidence/tooling only. No runtime TypeScript implementation, dependency,
CI workflow, storage schema, provider or semantic algorithm changed.

### PR #66 verified in the baseline

- **Knowledge:** `DeepAuditEngine` emits actual read/MAP counters; the adapter
  passes reading/mapping and verification through `HealthService`'s transient
  snapshot and controller into the UI. Preparation/saving correspond to real
  lifecycle boundaries. The service clears running/progress in `finally`; the
  adapter removes its callback and abort listener. The view's elapsed text timer
  is cleared on rerender/close. It does not advance stages or request a provider.
  No Knowledge ETA was added. Existing legacy audit progress dialogs are separate.
- **Map:** `bindGraphViewport` owns real wheel/pointer events; the semantic renderer
  sets its maximum to 24 (minimum 0.4) while topology keeps 4. Zoom/reset/fit use
  the captured viewport, with inverse marker/hit-target/label scaling above 1x.
  Snapshot scores and the original linear similarity geometry are unchanged.
- **Audit:** `auditModeViewModel` uses `stale + unseen` for changes/overview and
  eligible total for full. The selector dispatches full with `onlyStale=false`.
  Batch + Report processes stale/new notes; cached summaries are not merged into
  its reduce/synthesis. Both locales explain this subset; no speculative mode
  duration or unconditional recommendation badge is present.

The existing [#66 source and 500-note mock-provider acceptance record](large-vault-ux-stabilization.md)
was inspected, not repeated. Current full tests include its lifecycle, progress,
viewport, score and mode-count regression coverage.

## CSS review

The live public [Community scorecard](https://community.obsidian.md/plugins/ai-knowledge-hub)
retrieved September 28 still referenced `d18260f...`: its `multicolumn` finding
links to `styles.css:2484`, which is exactly the `column-gap` declaration in that
commit. Current baseline location was 2495. This establishes the trigger; it is
not a rerun of hosted review for this candidate. The scorecard's 1.7.4 browser
compatibility label does not alter the manifest's actual minimum of 1.8.7.

| Reported pattern | Final implementation |
| --- | --- |
| Health `clip-path` | Absolute 1px box with negative margin, hidden overflow, `opacity: 0`, `pointer-events: none`, and nowrap. Existing `role=status`, polite/atomic live region remain untouched. No `display:none`, `visibility:hidden` or `aria-hidden`. Native AX inspection confirms the status node is not ignored. |
| Connections `column-gap` | `gap: var(--size-4-1) var(--size-4-3)` in the same <=300px container rule. Preserves the inherited 4px row gap and 12px column gap; ordinary widths remain 4px/4px. No grid semantics changed. |
| Proposal duplicate `max-height` | Keep desktop `calc(100vh - 32px)` and narrow `calc(100vh - 16px)`. Later `@supports (height: 100dvh)` overrides desktop, with a nested <=520px media override for narrow. Same supported bounds, no duplicate property in a rule; all scrolling rules retained. |
| Broad motion `!important` | Replace with concrete selectors at the same specificity as their motion definitions. Page/topology content animations, navigation/topology controls, neighborhood list, provider/model cards and settings test button are covered. Existing Health-card and every-state Vault Pulse overrides remain. Global Map defines no CSS motion, so its universal reset is removed. |

The motion audit covered every stylesheet `animation`/`transition` declaration
and callers in Health/renderers/settings. Workspace motion consists of Pulse,
Health cards, page entry, topology content/inspector/controls, navigation and
neighborhood list. Provider/model cards and the settings connection-test button
have their own exact overrides. Default declarations/durations remain unchanged.
Older `ai-hub-*` prompt/audit/progress modal motion outside these workspace/settings
surfaces was not governed by those universal resets and is unchanged; this is not
an assertion of universal plugin/host/theme motion suppression.

Native computed-style checks cover 15 concrete elements including all five Pulse
states. Under reduce, each has `animation-name: none` and zero transition duration;
under no-preference, the existing 7s/4s Pulse cadence, entry animation and card
transitions remain. Actual Health and map controls also render/work under reduce.

Final structural scan: **zero `clip-path`, `column-gap`, `!important`; zero rules
with duplicate `max-height`**. The 18 remaining `max-height` declarations are:

| Selector / context | Retained bound |
| --- | --- |
| `.ai-hub-modal-content` | `80vh` |
| `.ai-hub-progress-log` | `300px` |
| `.ai-hub-preview-list` | `130px` |
| `.ai-semantic-result-list`, `.ai-semantic-duplicate-list` | Each `min(65vh, 620px)` |
| `.modal.ai-rag-shell` desktop / narrow | `calc(100vh - 32px)` / `calc(100vh - 16px)` in separate rules |
| `.ai-rag-question`, `.ai-rag-answer` | `min(24vh, 180px)` / `48%` |
| `.modal.ai-proposal-shell` desktop / narrow baseline | `calc(100vh - 32px)` / `calc(100vh - 16px)` |
| Same proposal contexts inside supports | `calc(100dvh - 32px)` / `calc(100dvh - 16px)` |
| `.ai-proposal-detail-header`, `.ai-proposal-diff` | `min(32vh, 240px)` / `min(44vh, 420px)` |
| `.veynrel-topology-results` | `260px` |
| `.veynrel-neighborhood-svg`, `.veynrel-global-map-svg` | `620px` / `740px` |

These are independent content/scroll or graph bounds, not same-rule duplicates.
No CSS advisory is deliberately retained for the four reported patterns. Hosted
Review branch has not been rerun; local structural results do not prove its result.

**Intentional advisory:** exactly one `api.ts:402` / `no-restricted-globals` remains.
`api.ts`, the exact reviewed allowlist in `scripts/lint-obsidian.mjs`, and the
streaming rationale in `docs/obsidian-review-audit.md` are byte-identical to
baseline. `requestUrl` is buffered and cannot replace the retained SSE streaming.

## Versions and automated checks

Used `npm version 2.0.1 --no-git-tag-version` with the existing version lifecycle.
`package.json`, both root lock versions, `manifest.json` agree on **2.0.1**;
`versions.json["2.0.1"]` is **1.8.7**. Identity stays **ai-knowledge-hub / Veynrel**,
minimum **1.8.7**, `isDesktopOnly: false`. Only the two root version values changed
in the lockfile. The existing current-version assertion now expects 2.0.1; frozen
upgrade fixtures and all their compatibility assertions are preserved.

Node 24.14.1, npm 11.11.0:

| Check | Outcome |
| --- | --- |
| `npm ci` | PASS; unchanged seven development advisories (4 moderate, 3 high) |
| Focused CSS/#66 tests | 58 passed / 6 files |
| `npm test` | 2,691 passed / 110 files |
| `npm run lint` | PASS: both typechecks, production build, Obsidian lint; zero errors, one intentional advisory |
| `npm run audit:proposals` | PASS: 5/5 mutations killed; restored checks pass |
| `npm run build` | PASS, fresh production bundle |
| `git diff --check` | PASS |

The initial full run exposed the expected hardcoded 2.0.0 release assertion;
updating its version produced the passing full run. Sandbox child-process output
prevented the first mutation-audit attempt; an unrestricted rerun passed without
source changes. Native harness setup/serialization corrections affected only the
fixture. No product regression was found.

Exact-final-commit clean-checkout results, npm 10.9.2/11.11.0 consumer checks and
GitHub CI links are recorded in the PR handoff to avoid a self-referential SHA.
The configured install matrix and provenance workflow are unchanged.

## Native release smoke

[Machine-readable evidence](release-2.0.1-evidence/native.json): **23 check groups**,
Linux Obsidian **1.12.7**, Electron **39.8.10**, **150 synthetic indexed notes**,
disposable profile, no live provider requests. The installed asset hashes exactly
match the candidate below. Real proposal UI uses a mocked Companion application
boundary; no approval/rejection/write was performed.

- Installed/reloaded 2.0.1; Health dashboard, Findings, Discover and saved-index map.
- Wheel zoom, drag pan, visible zoom to 24x, fit, exact reset; unchanged map snapshot
  and zero map recomputation during viewport changes.
- Status accessible in native AX tree; all 15 motion probes; actual reduced-motion
  Health/map rendering and controls; normal motion cadence preserved.
- EN/RU Health, native Settings, and audit selector at 1280/390px; all three cards
  show the actual fresh eligible count of 150.
- Connections at 1280px and 320px window widths; 216px narrow container, correct
  two-column counts, 4px row / 12px column gaps, no horizontal overflow.
- Proposal diff, scrolling and footer at 1280x900, 1280x400, 390x700, 390x400. Both
  outer body and inner diff can scroll to reveal the last line; footer stays inside
  the viewport. No new captured runtime exceptions/console errors.

Inspected screenshots: [short proposal](release-2.0.1-evidence/proposal-short.png),
[narrow Connections](release-2.0.1-evidence/connections-narrow.png),
[Russian audit](release-2.0.1-evidence/audit-ru.png).

Reproduce with Node 24 and the existing installed native runtime:

```sh
npm run build
node scripts/global-semantic-map-prepare.mjs /tmp/veynrel-2.0.1-release
node - <<'NODE'
const fs=require('node:fs'),root='/tmp/veynrel-2.0.1-release';
for(const [file,patch] of [['profile/obsidian.json',{updateDisabled:true}],['vault/.obsidian/plugins/ai-knowledge-hub/data.json',{semanticAutoSyncSuspended:true}]]) {
 const path=root+'/'+file; fs.writeFileSync(path,JSON.stringify({...JSON.parse(fs.readFileSync(path)),...patch}));
}
NODE
electron39 /usr/lib/obsidian/app.asar \
  --user-data-dir=/tmp/veynrel-2.0.1-release/profile \
  --remote-debugging-port=9262 --disable-gpu --ozone-platform=x11
# In a second terminal, after Obsidian loads:
node scripts/release-2.0.1-native.mjs http://127.0.0.1:9262 /tmp/veynrel-2.0.1-release
```

Use an empty disposable root and its corresponding installed Obsidian launcher.
The harness verifies the active vault path before altering its synthetic settings.

## Candidate assets

Fresh `npm run build`; installed native assets matched all three SHA-256 values.
`main.js` is ignored by `*.js` and is not tracked/staged. Hashes are evidence only;
after merge, rebuild from the selected release commit/tag as described below.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 945526 | `0eb1a12e8415ced10be27342851407c8dd7e41cd513735f6e3728ae2715f17ea` |
| manifest.json | 355 | `3adfa924ce9cbfa749e836c3a05b60ac4f59d3e32b326bdd653c9dea5f7af2cb` |
| styles.css | 109810 | `090874f18246ccb5f79403b91b85b5489f43a70ed0b18f3e420bde2b9f0c911d` |

## Manual publication after review and merge

Do not execute during preparation. Preserve the existing checklist's authenticated
Community **Review branch** step: inspect the exact final PR SHA and accept/understand
its findings before publication. Local lint does not replace that check. Require
all three final PR checks green; merge the reviewed PR manually.

Run the following in Bash, with Node 24, from the repository. Stop on any mismatch.
If main has advanced beyond this PR's merge, review/test intervening changes and
select a new exact release commit explicitly; do not silently release them.

```bash
set -euo pipefail
repo=zinverno/veynrel
release_branch=chore/release-2.0.1
test "$(gh pr view "$release_branch" --repo "$repo" --json state --jq .state)" = MERGED
release_commit="$(gh pr view "$release_branch" --repo "$repo" --json mergeCommit --jq .mergeCommit.oid)"
test -n "$release_commit"
test -z "$(git status --porcelain)"
git switch main
git pull --ff-only origin main
test "$(git rev-parse HEAD)" = "$release_commit"
test -z "$(git status --porcelain)"
# Check the main verification run for this exact SHA is green:
gh run list --repo "$repo" --workflow ci.yml --commit "$release_commit"
npm ci
npm test
npm run lint
npm run audit:proposals
npm run build
git diff --check
node - <<'NODE'
const a=require('node:assert/strict'),p=require('./package.json'),l=require('./package-lock.json'),m=require('./manifest.json'),v=require('./versions.json');
a([p.version,l.version,l.packages[''].version,m.version].every(x=>x==='2.0.1'));
a.equal(v['2.0.1'],'1.8.7');a.equal(m.minAppVersion,'1.8.7');
a.equal(m.id,'ai-knowledge-hub');a.equal(m.name,'Veynrel');a.equal(m.isDesktopOnly,false);
NODE
test -z "$(git status --porcelain)"
if git show-ref --verify --quiet refs/tags/2.0.1; then exit 1; fi
test -z "$(git ls-remote --tags origin refs/tags/2.0.1 'refs/tags/2.0.1^{}')"
git tag -a 2.0.1 "$release_commit" -m "Veynrel 2.0.1"
git push origin refs/tags/2.0.1

# Fresh tagged checkout: all uploaded bytes must come from here.
release_dir="$(mktemp -d -t veynrel-2.0.1.XXXXXX)"
git clone --branch 2.0.1 --single-branch https://github.com/zinverno/veynrel.git "$release_dir/tag"
cd "$release_dir/tag"
test "$(git rev-parse 'HEAD^{commit}')" = "$release_commit"
npm ci
npm test
npm run lint
npm run audit:proposals
npm run build
git diff --check
test -z "$(git status --porcelain)"
sha256sum main.js manifest.json styles.css | tee "$release_dir/SHA256SUMS"
gh release create 2.0.1 main.js manifest.json styles.css \
  --repo "$repo" --verify-tag --draft --title "Veynrel 2.0.1" \
  --notes-file docs/releases/2.0.1.md
```

Inspect the draft body and exactly three attached assets (`main.js`, `manifest.json`,
`styles.css`; GitHub source archives are separate). Before publication, verify the
uploaded draft bytes against this tag checkout:

```bash
gh release view 2.0.1 --repo "$repo" --json isDraft,tagName,name,assets
gh release download 2.0.1 --repo "$repo" --dir "$release_dir/draft" \
  --pattern main.js --pattern manifest.json --pattern styles.css
for asset in main.js manifest.json styles.css; do cmp "$asset" "$release_dir/draft/$asset"; done
# Only after the draft and assets have been reviewed:
gh release edit 2.0.1 --repo "$repo" --draft=false
# Wait for the release.published workflow to appear, then inspect its matching run:
gh run list --repo "$repo" --workflow release-provenance.yml --event release \
  --json databaseId,headSha,status,conclusion,url
attest_run="$(gh run list --repo "$repo" --workflow release-provenance.yml --event release \
  --json databaseId,headSha --jq ".[] | select(.headSha == \"$release_commit\") | .databaseId" | head -n 1)"
test -n "$attest_run"
gh run watch "$attest_run" --repo "$repo" --exit-status
for asset in main.js manifest.json styles.css; do gh attestation verify "$asset" --repo "$repo"; done
```

`Attest published plugin assets` rebuilds the release tag, runs tests/lint,
compares all three downloaded assets byte-for-byte, and attests them. It cannot
repair a bad upload. Do not replace files or rebuild from a dirty checkout after
tagging. Require a successful matching run and attestations before declaring
publication verified; then check Community update delivery separately.

## Limitations

No candidate hosted rescan, live paid-provider run, external Companion deployment,
physical mobile device, mobile OS, popout, screen-reader speech or custom-theme
matrix. This patch freshly verifies Linux Obsidian 1.12.7 only; minimum 1.8.7 was
verified by 2.0.0's existing release evidence, not rerun here. Narrow desktop sizes
are not mobile testing. Default theme only. No new frozen 2.0.0 upgrade fixture;
unchanged runtime/storage paths and existing frozen-format tests establish the
bounded compatibility claim. Existing npm development advisories remain. No
release-blocking product regression was found.
