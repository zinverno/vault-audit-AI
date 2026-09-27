# Connection Opportunities V2: candidate review

Real-vault acceptance supplied by the author found **313 candidates**, alongside
145 mapped notes, 113 comparable notes, 502 sparse semantic pairs, 24 aligned
pairs, 87 explicit-only pairs, 165 unclassified semantic pairs, and 3 explicit
pairs outside the map. Useful examples included related SQL concepts and notes
about the same practical subject. High-scoring `Drawing … .excalidraw.md` pairs
also appeared. These observations motivate practical human review; they do not
establish a precision estimate. Implementation and automated acceptance use only
synthetic notes, never the author's personal vault.

## Evidence from the existing map

Every published semantic comparison pair (candidate or aligned) retains its
existing cosine, left/right rank, and `mutualTopK`. It additionally contains:

- `rankClass`: `mutual-top-3`, `mutual-top-5`, or `one-sided-top-5`.
- `sharedNeighborPaths`: a frozen, canonical lexical ordering of the intersection
  of the two published `SemanticGlobalMap.nodes[].neighbors` lists. Both pair
  endpoints are explicitly excluded. The shared count is this array's length.

For A → [B,C,D,E,F] and B → [A,C,D,X,Y], the shared neighbors are [C,D]. This uses
only existing top-five membership. It does not run another similarity query or
read vectors/text. Source validation rejects unknown paths, duplicates, self
neighbors, invalid order/scores, and inconsistent edges before publication.
Shared paths must exist in the map and are unique. The inspector shows their
basenames; full paths are available in titles. No additional neighbor navigation
route is introduced; existing endpoint Neighborhood actions are retained.

## Transparent rank buckets and ordering

| Class | Exact meaning |
| --- | --- |
| Mutual top-3 | Both ranks exist and both are ≤ 3 |
| Mutual top-5 (includes rank 4–5) | Both ranks exist; at least one is 4 or 5 |
| One-sided top-5 | Exactly one endpoint ranks the other in its top five |

The filters are **mutually exclusive**. The top-five bucket excludes mutual
top-three pairs. These filters also apply to aligned pairs; explicit-only pairs
have no semantic rank class or exact cosine.

Candidates and aligned pairs sort by this exact sequence:

1. Mutual top-3, then mutual top-5, then one-sided top-5.
2. Shared semantic neighbor count, descending.
3. Existing exact cosine, descending.
4. Canonical left path, ascending.
5. Canonical right path, ascending.

Explicit-only pairs remain sorted by canonical paths. There is no intermediate
weighted value or opaque quality score. There is no cosine threshold: rank
positions describe the existing sparse map, and cosine depends on the embedding
model. Filtering and review do not change category definitions or coverage.
In particular, unavailable endpoint link metadata never produces a candidate.
**Explicit-only does not mean semantically far.**

Rows display similarity, mutual rank shorthand (for example `#1 ↔ #2`) or both
one-sided rank statements, rank class, shared count, Markdown relationship, and a
restrained review marker. Each row button has a full accessible label explaining
both ranks. The inspector expands the evidence and offers native action buttons.
All controls use visible text, labels, and pressed state where applicable. Local
name/path search and 50-row pagination remain; changing filters/search resets the
limit to 50. Rank filter counts describe the source category independently of
search/review/Excalidraw filters; “Showing X of Y” describes the combined result.

## Session-only human review

A candidate can be labelled **Useful**, **Not useful**, or **Unsure**, with an
explicit **Clear review** action. These are the user's feedback, not product
truth. The view's `ConnectionComparisonViewState.reviewByPairId` Map owns them.
No comparison pair, semantic map, topology snapshot, category, Health state, or
Finding changes. Only candidates can receive verdicts.

A separate, quieter summary displays Reviewed / Useful / Not useful / Unsure raw
counts across the current candidate set, regardless of active filters. Missing
or non-candidate IDs cannot contribute. No global precision percentage is
calculated. Candidate review filters are All (default), Unreviewed, Useful, Not
useful, and Unsure. They combine with rank, path/name search, and the Excalidraw
option before applying the visible limit.

Category, rank filter, review filter, special-format toggle, query, selection,
visible limit, and all verdicts survive Connection Opportunities → Neighborhood
→ A → B → C → Back. Return reuses the identical comparison. The workspace view
owns this state; closing it or restarting clears reviews.

**A newly published comparison snapshot clears all reviews**, even if paths
remain the same. This happens on successful refresh, including refresh from
another view while this view is in Neighborhood. A loading, stale, failed or
unavailable refresh that retains the old snapshot retains its reviews. Global
Map core/focus/reset with unchanged map identity/revision retains comparison and
reviews. Filters remain selected after a new capture. The user must review new
evidence afresh; verdicts never silently attach to changed evidence.

There are no writes to `data.json`, settings, localStorage, or another file.

## Excalidraw convenience

**Hide Excalidraw notes** is off by default and applies only to candidate list
presentation and local search results. Either endpoint ending case-insensitively
in the exact suffix `.excalidraw.md` hides that pair. For example,
`Drawing.EXCALIDRAW.MD` matches; `my-excalidraw.md` does not.

The displayed hidden count is the number of source candidates excluded by this
option alone, independent of other filters. Candidate totals, comparison
snapshots, semantic graph, topology and coverage counts remain unchanged. This
is a path-based presentation convenience supported by observed acceptance data,
not a generated-file detector or semantic classification.

## Explicit note inspection

**Open pair side by side** resolves both endpoints through `resolveHealthNote()`
at click time and verifies that both still exist as in-scope Markdown files. It
uses installed public typed Obsidian APIs: `workspace.getLeaf("tab")`, then
`workspace.createLeafBySplit(first, "vertical")`. See the
[official SDK declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).
No private workspace fields, DOM splitting, internal constructors, or forced
casts are used. A new tab and adjacent leaf are created; unrelated leaves are
neither replaced nor closed. The second file is resolved again after the first
open yields to the host. If it disappears or opening fails, the existing note
unavailable message is shown; an already opened first leaf may remain.

Open first/second note and endpoint Neighborhood actions remain available.
Opening notes is explicit native navigation and may cause Obsidian to read them;
it is measured separately from the zero-body-read comparison/review path.
Obsidian may persist its own workspace layout after navigation.

## Boundaries and limitations

- Mutual top-3 is descriptive ranking, not proof a Markdown link is needed.
- Shared semantic neighbors are contextual evidence, not confidence.
- Cosine remains embedding-model dependent.
- Excalidraw filtering is path-based and presentation-only.
- User review is not persisted; there is no export/history in this milestone.
- No learned or LLM ranking model, opaque quality score, or cosine threshold.
- No new embeddings, provider/network calls, Markdown-body reads, Markdown writes,
  link creation, second semantic engine, or second Markdown parser in review.
- No Findings or Connection Health integration yet.
- No exact semantic score for explicit-only pairs.
- Existing partial coverage, freshness, and passive Discover boundaries remain.
  Opening Discover causes zero comparison/map/topology loads, provider/network
  calls, Markdown reads, or writes from this feature.

## Manual real-vault acceptance

Use your vault locally; do not send note contents or private paths. Start from a
current comparison and record the following aggregates before applying search or
review filters:

| Source / presentation count | Record |
| --- | --- |
| Total Candidates | |
| Mutual top-3 | |
| Mutual top-5 (at least one rank 4–5) | |
| One-sided top-5 | |
| Candidates hidden by Hide Excalidraw notes | |

1. Select Candidates, clear search, choose review All, and leave Excalidraw hiding
   off. Record source totals and the three mutually exclusive rank counts.
2. Enable Hide Excalidraw notes and record “Candidates hidden”; confirm the
   Candidate total remains unchanged. Record whether this option stays enabled
   during review so the inspected population is explicit.
3. Select Mutual top-3 and inspect **at least the first 20 distinct candidates**
   in the displayed order. Use both notes, rank positions and shared neighbors
   as context; label each Useful, Not useful or Unsure. Do not refresh or close
   the workspace before recording the results.
4. Record N inspected, Useful, Not useful and Unsure as raw counts (the last three
   must sum to N). For an uncontaminated summary, begin with a new comparison and
   review only this cohort. Do not infer global precision from it.
5. Test Unreviewed, the Excalidraw option, search and Show more. Explore a
   Neighborhood, recenter twice, and Back; all review state should remain.
6. After recording counts, refresh: reviews should clear. Inspect aligned and
   explicit-only examples separately; explicit-only must show no invented score.

These raw verdict counts are input to a later Connection Health design, not a
Health result. See [synthetic verification](connection-candidate-quality-evidence/verification.md)
for executable checks, native matrix and platform limits.
