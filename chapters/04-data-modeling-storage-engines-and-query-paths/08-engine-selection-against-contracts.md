# Engine Selection Against Contracts

## Abstract

Engine selection is the most cargo-culted decision in system architecture and the easiest to do correctly, because by this point in the book the rubric already exists: an engine is admissible for a store exactly when it demonstrably satisfies that store's Chapter 03 contracts (ownership enforcement, consistency and isolation claims, recovery budgets, deletion mechanics) at the amplification position (file 02) the access-pattern matrix (file 01) requires — and "demonstrably" means adversarial evidence of the Jepsen class, not documentation, because the documented-versus-delivered gap in consistency guarantees is one of the most reproducible findings in systems evaluation ([Jepsen analyses](https://jepsen.io/analyses)). This file turns that into a selection procedure, adds the two portfolio-level forces that per-store rubrics miss — sprawl cost (every additional engine is a permanent tax in expertise, drills, security surface, and on-call depth) and its opposite, the one-engine hammer (serving RUM-incompatible patterns from the incumbent because migration is annoying) — and closes with the evaluation protocol that keeps benchmarks from lying.

The prior it installs, stated plainly: default to boring. An engine with fifteen years of production scar tissue, whose failure modes are documented in other people's postmortems, is worth a large performance discount over one whose failure modes you will document yourself.

## 1. The Selection Procedure

```text
Figure 1. Selection is the LAST step of a chain this book already
built. Running it first — "we're a MongoDB shop, now model the
data" — inverts every dependency in chapters 1–4.

  Ch01 f02  workload vector ──► Ch04 f01  access-pattern matrix
                                     │
  Ch03      state contracts          ▼
  (ownership, consistency,    Ch04 f02–07  required RUM position,
   isolation, recovery,       index/query/analytical/vector needs
   deletion, migration)              │
        │                            ▼
        └────────────────► candidate engines
                                     │
                          evidence per contract (§2)
                                     │
                          portfolio check (§3: sprawl vs hammer)
                                     │
                                selection + exit story (§4)
```

## 2. The Contract Rubric

Per candidate engine, per store — each row answered with evidence class and date (Ch01 file 11), not vendor prose:

| Contract | The Question | Admissible Evidence |
|---|---|---|
| Ownership enforcement (Ch03 f01) | Can the store enforce single-writer — grants, epochs, fencing tokens honored at the storage layer? | Drill S1/S2 on the candidate; fencing rejected-write demonstrated |
| Consistency claims (Ch03 f02) | Does it deliver the models the read paths claim, *under partition and pause*? | Jepsen-class testing — third-party analysis where it exists, your own harness where it doesn't; the record shows healthy-cluster testing proves nothing ([analyses](https://jepsen.io/analyses)) |
| Isolation (Ch03 f03) | Actual anomaly behavior at the configured level, on this version? | Hermitage-style suite + your write-skew cases (Ch03 f10 §2) |
| Recovery (Ch03 f08) | Measured RPO/RTO at production volume; PITR mechanics; backup isolation? | Drill S6 on the candidate, run by a non-author |
| Deletion (Ch03 f06) | Can erasure be executed and *proven* — including in immutable segments, snapshots, replicas? | The purge walk executed against the engine's storage reality |
| Migration (Ch03 f07) | Online schema/index change at your table sizes? Exit replication (CDC out)? | gh-ost/Online-DDL-class tooling demonstrated; CDC tap verified |
| Amplification (f02) | Measured WA/RA/SA on production-shaped data at the required RUM position? | The f02 §5 budget, filled by measurement |
| Query contracts (f04) | Plan stability controls, timeout/cancellation semantics, pagination support? | The f04 gates run against the candidate |
| Operations | Who on the team has operated it through an incident? What is the 3 a.m. story? | Named humans; runbooks; the honest answer that this row often decides |

The rubric's deliberate asymmetry: most rows are *disqualifiers*, not scores. An engine that cannot prove the consistency model a read path claims is not "weaker on consistency" — it is inadmissible for that store, whatever its benchmarks say.

## 3. Portfolio Forces

Two failure modes live at the portfolio level, and they are opposites:

**Sprawl.** Every engine added is a permanent line item: a second set of Ch03 drills (S1–S10 *per engine*), a second security/patch surface, a second backup discipline, a second expertise pool that must survive attrition, a second entry in every incident decision tree. The sprawl rule: a new engine buys its way in only when an existing engine *fails a contract row* for the pattern family — not when it would be "better." Preference is not a contract failure.

**The hammer.** The equal-and-opposite sin: serving a RUM-incompatible pattern from the incumbent because adding an engine is bureaucratically expensive — full-text search in LIKE queries, queues in a relational table polled by cron, 100M-vector ANN in an extension the team never load-tested at that scale. The hammer rule: when a pattern family's contract rows *cannot be met* by the incumbent at production scale (measured, not vibed), the sprawl tax is due and honest — pay it.

The portfolio artifact is a two-column ledger: engines each pattern family *requires* (hammer check) versus engines the org *runs* (sprawl check). Divergence in either direction is a finding with a migration or a retirement attached. Extensions and multi-model features (relational engines with JSON, vector, and full-text support) are the legitimate middle path — same operational surface, adequate contract satisfaction at moderate scale — evaluated by the same rubric rows, at *your* scale, with special suspicion toward the scale ceiling nobody load-tested.

## 4. The Exit Story

Selection is a bet, and honest bets name their exit before placing chips. Per selected engine: the CDC/export tap that makes data extractable at production rate without downtime (verified, because this is also the Ch03 f05 propagation machinery — an engine you cannot CDC out of is an engine you cannot leave *or* project from); the abstraction seam — which query surfaces are portable and which are engine-idioms (pretending everything is portable produces lowest-common-denominator usage that pays sprawl tax for nothing; the honest move is naming the idioms and containing them); and the re-evaluation trigger — the measured condition (scale, contract change, version EOL) that reopens the decision, so the selection is a lease with conditions rather than an identity.

## 5. The Evaluation Protocol

How to keep the bake-off from lying:

| Rule | Rationale |
|---|---|
| Your workload, not YCSB defaults | Generic benchmarks measure the vendor's tuning target; the access-pattern matrix *is* the benchmark spec — replay production traces where possible |
| Production-shaped data: size, skew, cardinality | Uniform synthetic data hides the hot partition (f01 §5), flatters the planner (f04 §3), and inflates ANN recall (f07 §1) |
| Steady state, not first hour | LSM compaction debt, B-tree bloat, vector-graph decay — every engine's second week is worse than its first hour; run long enough to hit the background-work regime (f02 §5) |
| Failure drills during the bake-off | Kill nodes, partition networks, fill disks *during* the evaluation — buying an engine without watching it fail is buying a car without brakes-testing |
| Open-loop load, corrected percentiles | Ch01 f02 §4.3's coordinated-omission rule; closed-loop benchmarks self-throttle into flattery |
| Same hardware, same durability settings | fsync-off numbers against fsync-on numbers is the oldest trick in the vendor playbook |
| Operate it during the eval | Upgrades, backup/restore, monitoring integration — the rubric's operations row gets its evidence here, cheaply |

## 6. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Order gate | Selection artifacts show contracts and matrix preceded the engine choice | The engine was chosen first and the modeling retrofitted |
| Rubric gate | Every §2 row answered with evidence class + date per store; disqualifier rows treated as disqualifiers | Consistency/recovery rows answered from documentation |
| Portfolio gate | The two-column ledger balances: no unpaid hammer patterns, no unjustified sprawl engines | A new engine admitted by preference, or a failing pattern retained by inertia |
| Exit gate | CDC-out verified at rate; idiom seams named; re-evaluation trigger declared | Selection with no priced exit — a marriage presented as a lease |
| Protocol gate | Bake-off followed §5: production shape, steady state, failure drills, open-loop | Selection justified by a benchmark the workload will never resemble |

## Output

The output of this file is an engine portfolio in which every engine is admissible by evidence against the Chapter 03 contracts, required by pattern families the rest of the portfolio cannot serve, operable by named humans who have watched it fail, and exitable through a verified tap — a set of priced leases, not a stack of identities.

## References

- [Jepsen — Analyses: the documented-vs-delivered gap, engine by engine](https://jepsen.io/analyses)
- [Kleppmann — Hermitage: isolation levels as tested, not as named](https://github.com/ept/hermitage)
- [Athanassoulis et al. — RUM: the position the workload requires](https://openproceedings.org/2016/conf/edbt/paper-12.pdf)
- [Discord — Cassandra→ScyllaDB: a contract-driven engine exit executed at trillion-row scale](https://discord.com/blog/how-discord-stores-trillions-of-messages)
- [McKinley — "Choose Boring Technology"](https://mcfunley.com/choose-boring-technology)
