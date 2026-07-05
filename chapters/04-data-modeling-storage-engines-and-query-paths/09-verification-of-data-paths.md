# Verification of Data Paths

## Abstract

Data-path contracts decay along three axes the code never touches: data grows (the bounded query meets the unbounded table), distributions drift (the planner's statistics and the ANN index's geometry both go quietly stale), and background debt accumulates (compaction, vacuum, delete vectors, graph decay). This file specifies the evidence regime that catches all three before users do: plan-shape regression testing that pins the hot paths' plans against production-scale statistics, load evaluation on production-shaped data with the coordinated-omission discipline of Chapter 01 file 02, continuous data-path SLIs (queries-per-request, scan-to-seek ratios, background backlogs, recall@k), and a drill catalog Q1–Q8 that exercises the failure modes files 01–08 predicted. As always, results land in the Chapter 01 file 11 taxonomy with dates — and this chapter adds the taxonomy's sharpest corollary: a query path tested at 1× data volume is `tested` for a system that no longer exists by the time it matters.

The premise, restated as operations: the query layer is the one part of the serving stack whose behavior changes *without deploys* — statistics refresh, data grows past a threshold, compaction falls behind — so its verification cannot live only in CI. Half of this file is CI; the other half is production telemetry that notices the world moved.

## 1. Plan-Shape Regression Testing

The `expected_plan_shape` field of every file 04 query contract, made executable:

```text
Figure 1. The plan regression pipeline. The test asserts SHAPE
(scan type, join strategy, index used), not cost numbers — costs
drift with data; shapes flip with statistics, and flips are the
incident class.

  contracted query set (file 04 §1, by query id)
        │
        v
  CI stage: EXPLAIN against a statistics twin
  ──────────────────────────────────────────────
  • schema + production-scale statistics (pg_stats
    export / optimizer stats clone — data itself not needed:
    the PLANNER reads statistics, not rows)
  • assert: plan shape == contracted shape
  • statistics refreshed from production on a cadence →
    the drift arrives in CI as a failing test, not in prod
        │
        v
  production stage: plan-hash telemetry
  ──────────────────────────────────────────────
  • log plan hash per contracted query id
  • alert on hash change (file 04 §3) — the flip is visible
    the moment it happens, attributable to the ANALYZE or
    deploy that caused it
```

The statistics-twin trick is the load-bearing detail: planners choose plans from statistics, so a CI database with production's *statistics* (megabytes) predicts production's plans without production's *data* (terabytes). Engines that support optimizer-statistics export/import make this nearly free; where unsupported, a periodically refreshed scaled sample is the honest fallback, with its scale factor documented as an evidence bound.

## 2. Load Evaluation Discipline

The file 08 §5 bake-off rules apply to *ongoing* verification, not just selection — condensed to the four that catch the most lies: **production-shaped data** (size, skew, cardinality — the uniform-data benchmark flatters every component this chapter reviewed: the planner, the partition scheme, the ANN index); **steady state** (run past the background-work horizon: post-compaction LSM, post-vacuum-cycle B-tree, post-delete-churn HNSW — every engine's demo is its best hour); **open-loop arrival with corrected percentiles** (Ch01 file 02 §4.3 — a closed-loop generator politely waits for the slow query it should be piling onto); **regression against the last run** (load results are a time series per query contract, not a one-time gate — the trend line is the early warning the point-in-time test cannot give).

## 3. Data-Path SLIs

| SLI | Guards | Alert Meaning |
|---|---|---|
| Queries per request, per endpoint | file 04 §5 N+1 rule | Query cardinality growing with result size — an ORM loop shipped |
| Plan-hash changes on contracted queries | file 04 §3 | A flip happened; attribute it before latency does |
| Scan-to-seek ratio / rows-examined÷rows-returned | files 03–04 bounding structures | A query lost its index (drop, bloat, statistics) and became a scan |
| Slowest-key latency (p99 *key*, not p99 request) | file 01 §2 skew tests | The giant tenant/channel approaching its partition's ceiling — the Discord signal |
| Background backlog: compaction debt, vacuum lag, delete-vector count, small-file count | files 02 §5, 06 §3 | Deferred work compounding toward the read path |
| Index usage counters | file 03 §3 portfolio audits | Unclaimed indexes (removal evidence) and unused new indexes (the pattern didn't engage) |
| recall@k per (model × corpus generation), incl. under dominant filters | file 07 §1, §3 | Retrieval quality drifting — the silent failure by construction |
| Projection lag as reader-facing staleness | file 05 §3 | Read-model consumers' freshness claim in breach |
| Table/partition growth vs bound forecasts | file 01 §5 growth gate | The unbounded-growth key approaching engine limits |

The unifying property: every SLI above detects a change *no deploy caused*. This is the telemetry that watches the axes CI cannot.

## 4. Drill Catalog Q1–Q8

| # | Drill | Hypothesis | Pass Condition | Frequency |
|---|---|---|---|---|
| Q1 | Replay production's top-N query traces against a dataset scaled to next year's forecast | file 01/04 bounds hold under growth | Every contracted query within budget; no plan flips at scale | Semi-annually |
| Q2 | Force-degrade statistics (or inject skewed sample) on a staging twin | file 04 §3 planner management | Plan-pin/baseline holds the hot paths; telemetry catches the rest | Per engine upgrade |
| Q3 | Saturate ingest until compaction/vacuum visibly lags | file 02 §5 background budget | Backlog SLI alerts before read p99 breaches; recovery without operator action (the metastability check) | Annually |
| Q4 | Drop (staging) or disable a load-bearing index | files 03–04 | Scan-to-seek SLI fires; the affected contracts identify themselves by id | Per portfolio change |
| Q5 | Drive the hottest key at its forecast p99 rate | file 01 §2 hot-key strategy | The named strategy (split/salt/coalesce/isolate) holds; node-level latency stays flat | Semi-annually |
| Q6 | Recompute exact ground truth; measure recall@k at deployed parameters, incl. filter classes | file 07 §1, §3 | Recall within target; degradation trend attributed (corpus growth vs deletes vs drift) | Quarterly, and per corpus generation |
| Q7 | Kill and rebuild a read model / vector index from sources, timed | files 05 §2, 07 §5 (Ch03 S4 instantiated) | Rebuild within declared duration; result equivalent; serving posture as declared | Semi-annually |
| Q8 | Run the analytical feed's erasure walk into the lakehouse (snapshot expiry included) | file 06 §2–3 | The subject is gone from marts, snapshots, and manifests; negative verification passes | Quarterly (extends Ch03 S5) |

## 5. Evidence Classification of Data-Path Claims

| Claim | It Is `tested` Only If |
|---|---|
| "This query is bounded" | Q1 ran it at forecast scale; the bounding structure engaged (Q4-visible) |
| "The planner won't flip this" | Pinned, or Q2 survived a statistics degradation on this engine version |
| "We handle our biggest tenant" | Q5 at forecast rate, on the real partition scheme |
| "Retrieval quality is fine" | Q6's number, this corpus generation, including filtered classes |
| "We can rebuild the index/model" | Q7's measured duration, this data generation |
| "Compaction keeps up" | Q3's saturation point exceeds forecast ingest with margin |

Everything else is the access-pattern matrix's polite word for hope. The dossier (file 10) records the row and the date; growth silently re-expires the evidence, which is why every drill carries a frequency and Q1 carries a forecast.

## 6. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Plan gate | Contracted queries shape-tested in CI against refreshed statistics twins; plan-hash telemetry live in production | Plan flips discovered by latency pages |
| Load gate | Load evaluation on production-shaped data, steady-state, open-loop, trended run-over-run | Benchmarks on uniform data, first-hour, closed-loop |
| SLI gate | The §3 signals exist with owners; each detects a no-deploy change class | The query layer's drift is invisible between incidents |
| Drill gate | Q1–Q8 within freshness windows, results dated in the dossier | Bounds, recall, rebuilds, and hot-key strategies asserted from design docs |
| Growth gate | Q1's forecast scaling re-run on schedule; evidence expiry tracked against data growth | Claims tested at a volume the system outgrew |

## Output

The output of this file is a data path that cannot drift silently: plans pinned or shape-tested with flips alarmed, load evidence trended on production-shaped data, SLIs watching every no-deploy change class from N+1 to recall decay, and drills Q1–Q8 keeping each chapter-04 claim stamped with the data generation that last proved it.

## References

- [McClarence — Catching Query Plan Regressions Before They Become Incidents](https://medium.com/@philmcc/catching-query-plan-regressions-before-they-become-incidents-5645eb256583)
- [PostgreSQL — planner statistics and EXPLAIN (the statistics-twin substrate)](https://www.postgresql.org/docs/current/planner-stats.html)
- [Jepsen — the adversarial-evidence standard this regime extends to query paths](https://jepsen.io/analyses)
- [Dean & Barroso / Ch01 file 02 — open-loop measurement and coordinated omission](https://cacm.acm.org/research/the-tail-at-scale/)
- [Discord — the hot-partition signal Q5 exists to pre-empt](https://discord.com/blog/how-discord-stores-trillions-of-messages)
