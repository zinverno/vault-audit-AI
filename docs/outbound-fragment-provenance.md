# Outbound fragment provenance fix

Verified on **2026-10-07**, branch `fix/outbound-fragment-provenance`, against main
`6a405e2e7d90be41f722e2a80995628ce56ad83c`. The tested production artifact is
`main.js` SHA-256 `c8c2d4482a962b7f3e20793ae876501081fe58ce64b159b4d2212c207a9cf158`.
[Fresh native evidence](outbound-fragment-provenance-native.json) also records the installed
artifact hashes, platform, versions and individual checks. These results concern this fix,
not the earlier live-evaluation build.

## Defect and reproduction

`MarkdownChunker.buildSections` supplies `rootHeading(path)` when there is no authored
heading: a headerless note, the introduction before its first heading, or an empty
heading with no nonempty parent. Chunk assembly prepends this breadcrumb to `chunk.text`.
Both `preparePair` and `prepareRerankCandidates` previously sent that enriched text
after validating the chunk ID/content hash. Omitting separate path fields did not
prevent filenames from entering the actual text.

The new regression uses the real MarkdownChunker, preparation/session code, production
serializers and adapters with fake transport. Before changing production code:

```sh
npm test -- chunking/outboundText.test.ts -t 'headerless final payload'
```

**Both tests failed** on the old implementation. For the synthetic
`Private-folder/Unique-headerless-name.md`, whose entire body was `Ordinary body.`,
the final Decisions `state.fragmentA` and Rerank `documents[0]` both contained
`Unique-headerless-name\n\nOrdinary body.`. The same regressions pass after the fix.

## Fixed boundary and compatibility

The existing parser now records whether each section's breadcrumb is synthetic.
When emitting a chunk, it retains an outbound representation made from exactly the
same selected blocks, separators and overlap. An object-local WeakMap holds this
representation; it adds no enumerable chunk field or persisted metadata.

Both outbound preparations still validate the original ID and content hash first.
They then use the shared `outboundChunkText` helper, before the 4,000 Unicode code-point
limit and JSON size checks. Authored headings/breadcrumbs remain context, including
headings equal to the basename and paths literally written in a heading or body.
No substring removal, replacement filename, extra parser or whole-note substitution
is involved. Missing/empty provenance fails closed: Decisions reports a technical
preparation state; Rerank leaves the candidate unscored and skips the request if fewer
than two usable candidates remain.

Decisions preview equals the eventual payload. Existing pre-send and post-response
snapshot checks, scope checks, cancellation and stale-result handling remain in place.
Local note labels and fragment navigation remain available. Rerank retains candidate
mapping, semantic scores, fallback order and one source search/embedding request.

Legacy `chunk.text`, ID, content hash, heading path, ordinal, source offsets/lines,
grouping and overlap are unchanged. Twelve representative fixtures compare the hash
of the complete serialized legacy chunk output captured from the baseline chunker.
The frozen `tests/fixtures/outbound-legacy-index.json` was produced with the baseline
chunker and existing production index writer. It still loads, searches and supplies
both outbound preparations; indexing unchanged documents causes zero embedding calls,
zero writes and no generation change. No rebuild, embedding-space change, index format
change or automatic migration is introduced.

## Fresh checks

| Check | Result |
| --- | --- |
| `npm test` | PASS: 115 files, 2,862 tests |
| New provenance suite | PASS: 39 tests, including both final JSON payloads |
| Focused provenance/session/refined-search suites | PASS: 74 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 errors; existing `api.ts:402` fetch warning |
| `npm run audit:proposals` | PASS on isolated retry: all 5 mutations killed and restored tests pass |
| `npm run build` | PASS; hash matches both installed native copies |
| Native script syntax and `git diff --check` | PASS |

The full suite ran before a subsequent test-only lint cleanup (typed JSON reads and
local mock references); the final 39-test suite, typecheck, lint and build passed after
that cleanup. The first audit attempt received empty output from its child test
process and failed; an unchanged isolated retry passed. No audit code was changed.

The regression matrix covers headerless notes, introductions, empty headings,
authored names/paths, long Unicode basenames, BOM/CRLF, nested breadcrumbs, cached
Setext headings, fenced code, lists and overlap. Empty/frontmatter-only notes produce
no outbound document, and excluded frontmatter stays excluded. It also covers missing,
changed, deleted and excluded sources; unavailable provenance; exact preview/send text;
Unicode truncation; and two different paths with identical short authored bodies.

## Native fake verification

**PASS on Linux, Obsidian 1.13.7, Electron 43.6.0** using separate disposable profiles
and synthetic vaults. The initially pending native run had no completed report; access
to its localhost CDP endpoint was blocked by the execution sandbox. After the normal
permissioned localhost connection, both actual runs completed successfully.

- Decisions: **20 checks**, 4 fake Decisions requests, 2 localhost synthetic embedding
  calls. Alpha is headerless; Beta has an introduction before a real heading. Their
  final payloads contain the body only, and exactly match the displayed preview.
  Both names remain local, and both note buttons open the selected body at line 0.
  EN/RU, keyboard launch, long fragments, narrow width, stale state, controlled errors
  and late-response handling also pass.
- Rerank: **23 checks**, 9 fake Rerank requests, 11 localhost synthetic embedding calls.
  Note-00 is headerless; Note-01 has an introduction before a heading. Their final
  payloads omit filename context, preserve body text, and both local result titles
  navigate to line 0. Baseline/refinement states, one query embedding, result mapping,
  semantic scores, safe fallback, settings changes and late responses also pass.

These counts include the existing explicit **fake** connection checks. There were
**0 new paid/provider requests, $0 spent and no real OpenRouter credential reads**.
Both disposable Obsidian windows were closed afterward; no profile or `data.json`
is included in the repository. The host updater used its ordinary application network
path; this is not a claim that the entire Obsidian process performed zero network I/O.

Reproduce from fresh disposable directories using the native instructions in
[Decisions v1](decisions-v1.md#verification-and-manual-acceptance) and
[Rerank v1](rerank-v1.md). The updated `scripts/decisions-native.mjs` and
`scripts/rerank-native.mjs` already contain these headerless/introduction fixtures.
Use their fake transport unchanged, without any real key. Do not point them at a
personal vault or reuse a configured live profile.

Manual acceptance: open the synthetic pair, confirm both preview texts omit injected
names, run once with fake transport, and open both notes at the shown fragments.
Search the same synthetic vault with fake Rerank, inspect its final documents, compare
the original scores/order and open the headerless/introduction results. Names remain
visible locally; only authored text reaches the fragment payload.

## Scope and remaining limits

This is provenance correction, **not anonymization**. Author-written names, paths,
links and other sensitive content remain text sent to the configured provider.
Endpoint/model contracts, Decisions criteria/confidence validation, timeouts and
sorting are unchanged. Live model quality and changed model outputs are **NOT EVALUATED**;
mobile, other operating systems, custom themes and screen readers are not covered.

Other consumers retain enriched legacy text: `indexing/indexingService.ts` embeds it,
`rag/ragContextBuilder.ts` uses it as context, and `semantic/semanticRuntime.ts` exposes
it through the existing Companion export. This fix makes no plugin-wide filename
exclusion claim. Legacy chunk length budgeting still includes breadcrumbs, so a rename
can change segmentation of a long document; this PR intentionally preserves that
algorithm. A custom chunker without outbound provenance cannot supply these requests.

PR #71's **21 live requests and $0.000488922** concern the previous production build.
Its historical evidence, frozen labels, budget journal, hashes and plan are unchanged
and are not a live retest of this fix. Rerank's live pricing blocker remains a separate
task. No release/version change or merge is part of this fix.
