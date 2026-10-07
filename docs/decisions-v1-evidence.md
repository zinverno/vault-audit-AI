# Decisions v1 verification evidence

Date: 2026-10-07. Base: `main` at `499d5fb383048101b819f4b70a01e3c06ce1aa90` (merged Rerank PR #69). No live OpenRouter credentials or paid requests were used.

## Automated

- `npm test`: 114 files, 2,823 tests passed, including existing Rerank coverage.
- `npm run typecheck`: passed.
- `npm run lint`: passed; only the pre-existing allowlisted `api.ts:402` streaming-fetch warning.
- `npm run audit:proposals`: 5/5 mutations killed; restored tests passed.
- `npm run build`: passed.
- `git diff --check`: passed.

One repeated proposal-audit run received empty Vitest stdout despite child exit 0. An immediate isolated rerun passed all five mutations without code changes; no unrelated audit-runner changes were made. The full suite passed before the final test-only addition of explicit RAG/Companion calls to the existing no-Decisions integration assertion; the affected 101-test suite passed afterward.

Tests cover the provider/Choice boundary, independent default-off migration and failed-save rollback, current evidence reconstruction and scope, Unicode limits, exact preview/send equality, changed-preview explicit confirmation, stale results, pending lifecycle races, disabled/passive behavior, navigation, EN/RU UI and no index writes. The index write barrier remains available during the network request. Mock success is not evidence of semantic quality.

A separate read-only review found no Critical/Required issues. Its model-placeholder and first-refresh observations were fixed. The latter has a regression that first reproduced the extra-refresh problem, then passed after the fix.

## Native: PASS for the exercised desktop scenarios

Actual native **Obsidian 1.14.4**, verified in General settings (installer 1.13.7), Electron 43.6.0, Linux/X11. Disposable vault: three synthetic bilingual Markdown notes. No personal vault or real credentials. Local fake embedding endpoint and fake Decisions transport inside the production adapter; real plugin UI, runtime, reconstruction and response validator.

Final tested build:

- `main.js` SHA-256: `ae2fce2d38c5003ec4888f516de572544b30ceb9ac75f8f8c5d489644a6175ea`
- `styles.css` SHA-256: `443b21f59f0326e38e369f67af2159a3d965a1cbbb053c7ca5a2d70f4a60dfff`

The final run passed all 16 assertions in [`scripts/decisions-native.mjs`](../scripts/decisions-native.mjs):

1. Legacy settings default off, separate empty key, rerank off.
2. Workspace/settings opening causes zero Decisions calls.
3. Masked key and pre-enable billing disclosure.
4. Indexing and duplicate-list display cause zero Decisions calls.
5. Disabled comparison shows the settings route.
6. Two current long fragments (>1,000 characters), zero preview requests.
7. Enter starts one request with exactly the shown text; button disabled during request.
8. Tentative fragment-only result and no rerender-triggered request.
9. Unchanged index identity after assessment.
10. No new persistent plugin result-store file.
11. Opens the selected note and chunk through the existing navigation path.
12. Already shown assessment becomes stale on settings change.
13. Explicit connection test sends only fixed synthetic text.
14. Russian UI, long fragments and 390×844 viewport without horizontal overflow.
15. Controlled 402 message without raw provider text.
16. Closed comparison ignores a slow reply.

Observed final run: one local embedding request and four fake Decisions requests (assessment, synthetic test, 402 response, slow/closed assessment). Screenshots and sanitized JSON: `/tmp/veynrel-decisions-native/{preview-en.png,result-en.png,preview-ru-narrow.png,native.json}`. The narrow Russian screenshot was visually inspected.

The first native attempt exposed a CDP test-driver issue: Enter needed its `\r` text field to exercise normal browser button activation. No product keyboard workaround was added. A later run used the updated Obsidian app; its actual version was checked rather than inferred from the older installer package.

## Live-provider: NOT RUN

No real Decisions API call or model-quality measurement was performed. Connection and schema mocks do not validate classification accuracy or prompt-injection resistance. The RU/EN evaluation file is manual annotation for a future separately authorized evaluation, including A/B swaps.

Native coverage does not establish mobile, other operating systems, custom themes or screen-reader behavior. The normal native fixture uses the production chunker's smaller fragments; the 4,000-code-point truncation boundary is covered by unit/UI fixtures. Staleness, exclusion, source deletion, unload, pair changes and save failures have automated coverage; only the explicitly listed scenarios were exercised natively.
