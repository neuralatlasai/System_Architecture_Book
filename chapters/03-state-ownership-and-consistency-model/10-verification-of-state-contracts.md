# Verification of State Contracts

## Abstract

State contracts fail silently by default: a consistency claim degrades into a lie the day a cache is added to its path, an isolation level differs from its documentation, a rebuild path dies when retention shortens, and none of it pages anyone — the system keeps returning 200s over quietly wrong data. This file specifies the evidence regime that converts each contract of files 01–09 into something that can fail loudly: adversarial consistency and isolation testing in the tradition of [Jepsen](https://jepsen.io/analyses) (whose analyses keep finding that mature databases violate their documented guarantees under partition and process pause) and [Hermitage](https://github.com/ept/hermitage) (whose engine-by-engine matrix shows isolation keywords and isolation behavior are different facts); divergence and lag SLIs that make weak-consistency anomaly budgets measurable; and a drill catalog S1–S10 whose union covers ownership, coordination, lineage, deletion, migration, and recovery. Every result lands in the Chapter 01 file 11 evidence taxonomy — and the taxonomy's bounding rule bites hardest here: a restore tested on 1% of production volume is evidence about 1% of production volume.

The organizing observation: correctness bugs in state are the only bugs whose blast radius *grows with time undetected*. Detection latency is therefore the parameter every section below is actually about.

```text
Figure 1. Why detection latency is the master parameter. A silent
corruption is recoverable only while a clean restore point still
exists; every day of detection latency consumes a day of backup
retention. When t_detect > retention, the loss is permanent — no
restore tooling, however good, can reach behind the window.

               corruption      last CLEAN        detection
               begins          backup ages out       │
  ────────────────╳═══════════════════│══════════════●──────► t
                  │◄─── t_detect ────────────────────►│
                  │◄── backup retention window ──►│
                  │                               │
        RECOVERABLE while t_detect < retention    │ UNRECOVERABLE:
        (restore clean point + replay/repair)     │ every surviving
                                                  │ backup contains
                                                  │ the corruption

  design consequence: reconciliation and validation SLIs (§3) are
  sized against the retention window, not against dashboards —
  they are recovery infrastructure, not observability garnish.
```

## 1. Testing Consistency Claims

Per read path (file 02 §1 tuple), the claim is tested by its anomalies, not its happy path:

| Claimed Model | Falsification Test |
|---|---|
| Linearizable | Concurrent history checking (Jepsen/elle-style): record all ops with real-time bounds; search for non-linearizable histories — under partition, failover, and process pause, not just steady state |
| Read-your-writes / session | Write-then-read probes through the *production* path (LB, cache, replicas) with session tokens; violation rate is an SLI, not a test-suite-only fact |
| Monotonic reads | Versioned repeated reads per session; any regression to an older version is a violation event |
| Bounded staleness Δ | Continuous lag measurement per follower + injected writes with timestamps; alert at Δ-margin, reject/redirect at Δ (the mechanism *is* the test) |
| Eventual + divergence budget | Anti-entropy metrics: divergence duration histogram, merge-conflict rate (files 01 §5, 04 §4) — a converging system with no divergence metric is claimed, not observed |

The Jepsen record justifies the adversarial posture: these are not tests for exotic bugs but for the *default* gap between documentation and behavior — respected systems have shipped stale reads, lost updates, and aborted-read anomalies under exactly the fault conditions production eventually supplies. Testing a consistency claim only under healthy conditions is testing the marketing.

## 2. Testing Isolation Claims

Hermitage's method, adopted wholesale: drive concrete concurrent transaction interleavings per anomaly (§1 catalog of file 03) against the *actual engine at the actual configured level*, and record what happens ([Hermitage](https://github.com/ept/hermitage)). The chapter adds three obligations: the tests run against the production engine *version and configuration* (isolation behavior changes across versions and settings — the test suite is part of the upgrade gate); write-skew scenarios are written for every cross-object invariant the file 03 mapping identified (generic anomaly tests do not know your invariants); and serializable paths measure their *abort rate under production-shaped contention*, because an SSI path whose retry loop was never load-tested is a latent availability incident (file 03 §2).

## 3. State SLIs

The continuous signals, extending the Chapter 01 file 09 catalog — each one exists to shrink detection latency below the window where damage compounds:

| SLI | Contract It Guards | Alert Meaning |
|---|---|---|
| Follower/replication lag (per follower) | file 02 bounded staleness | Claims about to be violated at the read path |
| Derived-node lag (per DAG edge) | file 05 propagation | Projection/index/embedding staleness exceeding its SLI |
| Divergence duration + conflict rate | files 01 §5, 04 §4 | Multi-writer arbitration under stress or broken |
| Session-guarantee violation rate | file 02 §2 | Users seeing their writes vanish — the incoherence users report as "flaky" |
| Isolation abort/retry rate | file 03 §2 | Contention shifting; retry loops nearing exhaustion |
| Reconciliation delta (cross-store counts/checksums) | files 03 §5, 08 §5 | Layer-3 corruption detection — the SLI that must outrun backup retention |
| Backup evidence freshness (absence-of-verified-success) | file 08 §4 | The GitLab signal: recovery capability silently expired |
| Purge completion + negative-verification pass rate | file 06 §5 | Erasure claims drifting from erasure facts |
| Migration divergence (old-vs-new shape diff rate) | file 07 §2 | The plateau is not converging; cutover gate cannot be met |
| Orphaned-lineage count (vectors/memories without valid sources) | files 05, 09 | The disguised-source pattern accumulating |

## 4. Drill Catalog S1–S10

Same discipline as Chapter 02's D-catalog: falsifiable hypothesis, controlled fault, pass condition, freshness requirement. Chapter 02 drilled the *plane* contracts; these drill the *state* contracts.

| # | Drill | Hypothesis | Pass Condition | Frequency |
|---|---|---|---|---|
| S1 | Partition the primary mid-write-load; force failover | file 01 §4 transfer protocol | Old writer fenced *before* promotion; zero acknowledged writes lost; ambiguity states surfaced to clients per contract | Quarterly |
| S2 | Pause (SIGSTOP/GC-simulate) a lease holder past expiry; resume; let it write | file 04 §1 fencing | The *resource* rejects the stale-token write; no client-side check is credited | Quarterly |
| S3 | Run the §1 anomaly suite under partition + pause + failover | file 02 claims | No anomaly outside each path's declared budget | Per engine/topology change |
| S4 | Delete a derived store (index, projection, one vector namespace); rebuild from declared sources | file 05 §4 | Rebuild completes from retained sources within measured duration; result equals pre-deletion state (checksum/count + sampled content) | Semi-annually, and on retention changes |
| S5 | Execute a full erasure for a synthetic subject seeded across the entire DAG (source, log, cache, index, vectors, memory, backups) | file 06 §4–5 | Negative verification passes at every node incl. semantic vector probe; audit artifact complete | Quarterly |
| S6 | Restore the most critical store to a point in time, at production-representative volume, run by a non-author | file 08 §4 | Measured RTO/RPO within budget; validation proves correctness; downstream DAG re-converged | Semi-annually (the drill GitLab teaches) |
| S7 | Inject divergence between two stores that reconciliation guards | files 03 §5, 08 §5 | Reconciliation SLI detects within its window; repair procedure converges | Annually |
| S8 | Mid-migration rollback: revert new-code deploy at the dual-write plateau | file 07 §1 matrix | Old code serves correctly against old+new data; no stuck writes; migration resumable | Per major migration, before the plateau |
| S9 | Kill and replay a CDC/outbox consumer with induced duplicates | files 05 §3, 08 §5 | Derived state converges identically; no duplicated external side effects (idempotency holds under replay) | Per consumer change |
| S10 | Inject a policy-violating memory write (simulated injection) and a memory-erasure request | file 09 §4 | Write rejected/quarantined by the memory service with audit; erasure empties memory + its embeddings + summaries with negative verification | Quarterly for agent systems |

S5 and S6 are the two that organizations resist because they are expensive — and they are expensive precisely because they exercise the paths that are worthless untested. The budget argument runs one way only: the drill's cost is the *floor* of the incident's cost.

## 5. Structural Audits

Continuous, mechanical, CI-and-production-trace checks — the state analogue of Chapter 02 §3's dependency audit:

```text
A1 (write legality):  every observed mutation of each state item
                      flows through its declared write interface
                      (file 01) — production traces vs declared paths
A2 (DAG closure):     every derived store appears in the DAG with
                      live sources; no node has client write edges;
                      no orphaned transforms (file 05)
A3 (claim ceiling):   no read path advertises a model stronger than
                      the weakest intermediary on its traced route
                      (file 02 §4 composition rule)
A4 (retention floor): every rebuild/recovery/audit consumer's window
                      ≤ its source's retention (files 05 §4, 06 §2)
A5 (lineage totality): every vector/memory/summary carries complete
                      version + provenance tuples (file 09)
```

A4 is the quiet killer: retention gets shortened by a cost initiative, and six months later a rebuild fails because its replay source no longer reaches back far enough. The audit turns that from an incident into a blocked config change.

## 6. Evidence Classification of State Claims

Applying Chapter 01 file 11, with the bounding rule made concrete:

| Claim | It Is `tested` Only If |
|---|---|
| "Failover loses no acknowledged writes" | S1 passed under concurrent write load, this topology, this quarter |
| "Serializable" | §2 suite passed on the production engine version + config, including your write-skew cases |
| "We can rebuild the index" | S4 executed against current retention, this data generation |
| "We delete user data everywhere" | S5's negative verification passed, including vectors and backups' decay ledger |
| "RTO is 4 hours" | S6 measured it at production volume, run by someone who didn't write the runbook |
| "Memory is injection-resistant and erasable" | S10 passed on the current memory-service policy version |

Everything short of the right column is `intended` or `assumed` wearing confident prose. The dossier states the row and the date; the review reads the date first.

## 7. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Adversarial gate | Consistency and isolation suites run under partition/pause/failover, per path and per invariant | Claims tested only on a healthy system, or by reading documentation |
| SLI gate | The §3 signals exist, are per-item where declared, and alert to owners | Divergence, lag, or purge drift is discoverable only by user report |
| Drill gate | S1–S6 passed within their freshness windows; S7–S10 scheduled with owners | Any recovery, erasure, or fencing claim rests on an unexercised path |
| Audit gate | A1–A5 run in CI and against production traces; violations block merges | Side-door writes and orphaned lineage accumulate between annual reviews |
| Detection gate | Reconciliation detection latency demonstrably < backup retention; measured, not asserted | Corruption can outlive every restore point (the unrecoverable class) |
| Classification gate | Every state claim in the dossier carries its §6 evidence row and date | "We have backups" (and its relatives) appear without a drill date attached |

## Output

The output of this file is a verification regime under which every state contract in this chapter is either currently evidenced — adversarial tests per claim, SLIs per divergence, drills S1–S10 within freshness windows, audits A1–A5 running continuously — or is explicitly downgraded to `intended`, in writing, where everyone planning around it can see the word.

## References

- [Jepsen — Analyses (documented guarantee violations in production databases)](https://jepsen.io/analyses)
- [Kleppmann — Hermitage: testing transaction isolation levels](https://github.com/ept/hermitage)
- [Google SRE Book — Data Integrity (validation as the third defense layer)](https://sre.google/sre-book/data-integrity/)
- [GitLab — Postmortem of January 31, 2017 (five untested recovery mechanisms)](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
