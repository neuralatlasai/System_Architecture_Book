# Indexing and Write Amplification

## Abstract

An index is a purchased read path: it converts one class of query from scan to seek, and it bills every write to the table forever. This file treats the index set as a portfolio under budget — each index justified by named access-pattern rows, priced in write amplification, space, and lock/maintenance behavior, and audited for the two portfolio diseases: redundant indexes that pay full write cost for marginal read benefit, and missing indexes whose absence is invisible until the planner's fallback scan meets production volume. The pricing law is file 02's RUM triangle applied additively: N secondary indexes make every insert roughly N+1 writes (plus WAL), so the index portfolio is a multiplier on the table's write amplification — the reason "just add an index" is never free and occasionally an outage.

The discipline throughout: indexes are named consequences of the file 01 matrix. An index no pattern claims is dead weight on the write path; a pattern no index serves is a scan wearing a promise.

## 1. The Index Cost Model

```text
Figure 1. What one secondary index costs. The read side is a
one-time design win; the write side is a permanent tax on every
mutation of the indexed columns.

              write(row)
                 │
     ┌───────────┼──────────────────────────────┐
     v           v                              v
  table       index 1 (btree on a)     ...   index N
  write       leaf insert + possible          write
  + WAL       page split + WAL                + WAL
     │
     └── total write cost ≈ (1 + N_indexes_touched) × page-write
         + WAL bytes; on LSM engines: + per-index compaction debt

  read side: pattern using index k
     scan O(rows)  ──►  seek O(log N + result)
     and, if covering: no heap/base-table fetch at all
```

| Cost Line | Detail |
|---|---|
| Write amplification | Every INSERT touches all indexes; every UPDATE touches indexes on changed columns (engine-dependent optimizations like HOT updates only when the changed column is unindexed — one more reason not to index speculatively) |
| Space | Each index is a second (partial) copy of the table, sorted differently; wide composite indexes on wide columns can rival the table |
| Maintenance | Index builds/rebuilds lock or consume I/O (the file 07-of-Ch03 online-DDL problem); LSM engines pay per-index compaction |
| Planner surface | Every index enlarges the planner's choice space — more plans to choose from is also more plans to choose *wrong* (file 04 §3) |
| Contention | Monotonic keys (sequences, timestamps) concentrate inserts on the rightmost leaf — the B-tree's own hot partition |

## 2. Index Forms and When Each Earns Its Cost

| Form | Serves | The Catch |
|---|---|---|
| Composite (a, b, c) | Patterns filtering on prefixes: (a), (a,b), (a,b,c); ordering by the same | Column order is the design: leading column must be the equality-filtered, high-selectivity one; a composite led by the wrong column serves nothing |
| Covering (include payload columns) | Read patterns answered entirely from the index — no base-table fetch; the closest thing to a free lunch for hot read paths | Wider index = more write/space cost; payload changes now touch the index |
| Partial (WHERE active = true) | Patterns over a small hot subset of a large table | The predicate must match the query's predicate *exactly enough* for the planner to use it; a priced bet on the workload staying shaped |
| Expression/functional | Patterns filtering on computed values (lower(email)) | Invisible to queries that don't use the same expression; documentation burden |
| Unique | Uniqueness invariants (Ch03 file 03: declarative beats isolation) | This one is not optional when the invariant exists — it is the invariant |
| Inverted / GIN-family | Contains/overlap patterns (arrays, JSON fields, full-text) | Write amplification is severe (one row → many postings); update-heavy tables pay dearly |
| Time-partitioned local indexes | Time-range patterns over append-mostly data | Global uniqueness across partitions is no longer free; partition pruning must actually engage |

The covering-index row deserves the emphasis reviews rarely give it: for the handful of hottest read patterns, covering indexes are how relational engines deliver wide-column-style "the table is the query" behavior (file 01 §4) — bounded, predictable, single-structure reads — while keeping the relational model everywhere else.

## 3. Portfolio Discipline

The index set is reviewed as a whole, against two lists:

```text
audit A: every index → the matrix rows that claim it
         unclaimed index = write tax with no read constituency
         → candidates: redundant prefixes ((a) shadowed by (a,b)),
           speculative "might need it" indexes, indexes for
           retired features

audit B: every matrix row → the index (or key) that bounds it
         unserved row = a scan scheduled to become an incident
         → the row is served, re-bounded, or explicitly accepted
           as a scan with a size ceiling and an owner
```

Portfolio rules with teeth: additions and removals are Chapter 03 file 07 migrations (build online, verify usage telemetry, remove on measured silence — engines expose per-index usage counters precisely so removal can be evidence-based); the portfolio has a *write-amplification ceiling* declared per table (when a new index would breach it, something must be removed or the pattern served differently); and index count is a latency statement about writes — a table with fourteen indexes has chosen its insert latency, whether or not anyone said so out loud.

## 4. Selectivity, Statistics, and the Planner Contract

An index is only used when the planner believes it wins, and the planner believes its statistics. Three obligations follow. **Selectivity justifies the index**: an index on a boolean column is a list of half the table — the planner will (correctly) scan instead; index candidates need estimated selectivity attached at design time. **Statistics freshness is an operational dependency**: stale or mis-sampled statistics flip plans (file 04 §3's incident class) — auto-analyze cadence and per-column statistics targets are configuration with SLI standing, not defaults. **Correlated columns lie to the estimator**: multi-predicate selectivity estimates multiply as if independent; correlated predicates (city + zip) produce misestimates that flip joins — extended/multi-column statistics exist for exactly this and belong in the schema review.

## 5. Write-Side Pathologies

| Pathology | Mechanism | Repair |
|---|---|---|
| Rightmost-leaf contention | Monotonic keys serialize inserts on one page | Non-monotonic keys where the pattern allows; or accept and measure |
| Index bloat | Churned keys leave dead entries; B-tree pages hollow out | Scheduled reindex/rebuild as budgeted background work (file 02 §5) |
| GIN write storms | One document update → hundreds of posting updates | Batched/deferred index maintenance; or move full-text to file 07's dedicated path |
| Foreign-key index absence | FK checks and cascades scan the child table per parent mutation | Index the FK columns — the one index that is nearly always claimed |
| Over-indexed queue tables | High-churn tables (job queues) with many indexes rewrite constantly | Minimal portfolio + engine features for churn (fill factor, partial on status) |

## 6. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Claim gate | Audit A: every index is claimed by named matrix rows | Unclaimed indexes ride the write path |
| Coverage gate | Audit B: every matrix row is served, re-bounded, or accepted-with-owner | A pattern's plan is "the planner will figure it out" |
| Ceiling gate | Per-table write-amplification ceiling declared; portfolio fits under it | Index accretion has no budget and no forcing function |
| Statistics gate | Selectivity attached to each index; analyze cadence and correlated-column statistics configured with SLIs | The planner's beliefs are unmanaged |
| Lifecycle gate | Index adds/removes follow migration discipline with usage telemetry | Indexes are added in incidents and removed never |

## Output

The output of this file is an index portfolio under budget: every index claimed by patterns, every pattern served or consciously accepted as bounded scan, write amplification summed and ceilinged per table, planner statistics managed as configuration with SLIs, and additions/removals executed as evidence-gated migrations.

## References

- [Athanassoulis et al., "The RUM Conjecture" — the triangle indexes move you around](https://openproceedings.org/2016/conf/edbt/paper-12.pdf)
- [Winand — Use The Index, Luke (index design against real planners)](https://use-the-index-luke.com/)
- [PostgreSQL documentation — indexes, statistics, and planner behavior](https://www.postgresql.org/docs/current/indexes.html)
- [gh-ost / Vitess Online DDL — index changes as online migrations](https://vitess.io/docs/user-guides/schema-changes/)
- [Kleppmann, *DDIA* — storage structures and their write costs](https://dataintensive.net/)
