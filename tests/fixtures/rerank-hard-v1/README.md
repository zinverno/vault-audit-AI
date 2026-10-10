# Hard Rerank Benchmark v1 — frozen input

64 synthetic Markdown notes, 24 positive queries (four in each group A–F), and four no-answer diagnostics. Neutral filenames do not reveal expected answers. Notes 45–48 have several sections; note 13 has no authored heading and exercises filename-fallback provenance.

`queries.json` and the complete 28 × 64 matrix in `judgments.json` were written before embeddings or rerank responses. Every nonzero grade has a content rationale and a literal passage marker. All other pairs are explicitly grade 0. The agent authored and reviewed both corpus and judgments; this is **not independent expert annotation**. `manifest.json` records predeclared ambiguities, metric rules and SHA-256 hashes. No outcome-based relabeling or query selection is allowed for v1.

Grade 0 means irrelevant; 1 means weak/contextual usefulness; 2 means a substantive but incomplete answer; 3 means a direct complete answer. Grades ≥2 define binary relevance for Hit@1/3, MRR@10 and Recall@30. nDCG@10 uses `2^grade - 1` and the ideal order over **all 64 documents**, not just retrieved candidates. Improved/Unchanged/Regressed uses nDCG@10 with tolerance `1e-9`. No-answer cases have null nDCG and are excluded from positive aggregates; no abstention threshold is inferred.

`answerAnchor` is a predeclared marker for the relevant passage. Its absence from the one selected fragment is an exposure warning. It is not an independently graded fragment and does not prove the fragment has no useful information. Whole-document and fragment visibility are reported separately.

The production chunker, indexing service, local vector store and semantic search build one unmodified pool of up to 30 documents per query. Embedding requests batch unique chunk texts and all query texts once; subsequent service lookups use those real cached vectors. All pools, semantic scores, source spans and selected outbound fragments are frozen before rerank. Final comparison uses 10 results on both sides.

Free checks (no key or network):

```sh
node scripts/rerank-hard-v1.check.mjs
node scripts/rerank-comparison.check.mjs
```

Paid execution is intentionally outside npm test and CI:

```sh
node scripts/rerank-hard-v1.mjs --live embeddings
node scripts/rerank-hard-v1.mjs --live rerank
```

These commands are date/build/input pinned, use only the explicitly authorized key path, and share one new durable journal at `~/.local/state/veynrel/rerank-hard-benchmark-v1/`. Do not remove, rename, reset or replace that journal. Completed operations replay saved receipts and vectors; unknown outcomes stop. A crash-held `budget.lock` requires checking that no experiment process is alive before manual recovery; the runner never removes another process's lock. Missing or corrupt paid artifacts stop rather than initiating replacement requests.

Plan ≤$0.02; hard authorization $0.03, including embeddings. The reused journal enforces the stricter $0.02 planning limit even when reservations could fit the authorization ceiling. Each request reserves $0.001; this allowance is not a formal provider maximum. Actual receipts and cumulative key usage are reconciled sequentially, with delayed aggregate accounting allowed. The server's intentionally configured $50 key limit is unchanged and does not authorize that expenditure.

Only `openai/text-embedding-3-small` and `voyageai/rerank-3-lite` are permitted. Rerank executes through the installed production adapter and real Obsidian requestUrl in a disposable profile. This benchmark does not repeat the full native UI acceptance from PR #73. Production plugin code, user settings, default models and release versions are unchanged.
