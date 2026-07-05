# Failure Modes and Degradation

## Abstract

Streaming failures are distinguished by their *tempo*: almost none of them are sudden. Lag runaway, retention expiry, rebalance storms, duplicate bursts, and DLQ overflow all announce themselves minutes to days in advance through derivatives — lag velocity, runway shrinkage, rebalance frequency — and then convert to data loss or outage precisely when the warning window closes. The production record bears this out: Parse.ly's pipeline-wide stop began as data volume crossing a capacity threshold their monitoring didn't treat as a countdown ([Parse.ly postmortem](https://www.parse.ly/kafkapocalypse/)); LinkedIn's "Kafkaesque" incident series is a catalog of slow interplays — segment-roll edge cases, retention misbehavior on low-volume topics, monitoring gaps — rather than crashes ([LinkedIn Engineering](https://engineering.linkedin.com/blog/2016/05/kafkaesque-days-at-linkedin--part-1)); and the rebalance storm is this domain's native instance of the sustaining-feedback-loop metastable failure ([Bronson et al., HotOS'21](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)): the recovery mechanism (reassignment + tail replay) generates the load that re-triggers the recovery mechanism. This file catalogs the failure modes with their mechanisms, tempos, and leading indicators, and specifies the degradation ladder — because a streaming system's overload behavior, like any system's (Chapter 01 file 08), must be chosen before the incident chooses it.

## 1. The Catalog

| # | Failure mode | Mechanism | Tempo | Leading indicator |
|---:|---|---|---|---|
| F1 | Rebalance storm | Member eviction (poll-interval breach under dependency slowness) → partitions reassigned → successor inherits the same slow dependency + replay burst → evicted too → sustained loop; group oscillates, consumption ≈ 0 while workers are "busy" | Minutes, self-sustaining | Rebalance frequency > deploy frequency; poll-interval utilization > ~70% |
| F2 | Lag runaway | consume_rate < produce_rate persistently (capacity, skew, or a downstream slowdown); lag integrates the deficit | Hours–days | Positive lag velocity sustained past one window (file 03 §3) — the alarm that matters *before* absolute lag does |
| F3 | Retention expiry race | F2's terminal stage: oldest unconsumed offset meets the retention edge; unread data deleted — loss without any component failing | Days, deadline-shaped | Retention runway < catch-up runway (both from file 03 §3; when that inequality flips, loss is scheduled) |
| F4 | Duplicate storm | Mass rebalance/recovery replays every partition's uncommitted tail simultaneously; dedup and idempotency machinery hit at 10³–10⁵× steady-state duplicate rate (file 02 §4) | Minutes, follows F1/recovery | Any group-wide rebalance or restart is the indicator; the question is dedup headroom, measured beforehand |
| F5 | Poison stall | One bad record pins a partition; per-key lag diverges while group aggregate looks healthy (file 05) | Hours, per-partition | Per-partition (not aggregate) time lag; retry-count-per-offset counters |
| F6 | DLQ overflow / graveyard | Bug-class poison at volume floods the DLQ, or triage debt lets entries age past DLQ retention — loss laundered through the error path (file 05 §3) | Days–months | DLQ inflow rate vs triage rate; age of oldest entry |
| F7 | Broker-side degradation | ISR shrink, leader elections, under-replicated partitions — Chapter 05's failure domain surfacing as produce latency/unavailability here | Minutes | Chapter 05 file 08's signals; this chapter *consumes* them, it does not re-own them |
| F8 | Downstream-view divergence | Any of F1–F5 experienced by *readers of the derived views*: staleness SLO breaches propagating along Chapter 03 file 05's DAG | Follows upstream tempo | The freshness SLIs those views declared |

## 2. The Two Compounding Shapes

**The runway race (F2→F3)** is the chapter's signature loss mode because every quantity in it is knowable in advance: lag, lag velocity, catch-up runway, retention runway. Loss occurs exactly when catch-up runway exceeds retention runway, and *that comparison* — not any absolute threshold — is the alarm. The response ladder, in order of preference: add consumer capacity (bounded by partition count, file 01 §4); raise retention (an emergency contract change, file 07 §1 — cheap under tiered storage, a disk crisis without it); apply producer policy (quotas/shedding, file 04 §4); and, last, *choose* what to lose per class rather than letting the retention edge choose. Worked once, because every team should run it with their own numbers: λ = 5k rec/s, capacity μ = 6k rec/s, retention 72 h. A 12 h consumer outage leaves a 216M-record backlog; catch-up at the 1k rec/s surplus takes **60 h** — and the retention runway at recovery start is exactly 72 − 12 = 60 h. That design sits at the edge of scheduled loss *with nothing else going wrong*, and the lever was always the headroom ratio: μ/λ = 1.2 means every incident takes 5× its own duration to digest (the recovery-multiplier identity of file 04 §1). Parse.ly's incident is the canonical instance of discovering these options during the race instead of before it.

**The rebalance storm (F1+F4)** is metastability with a group-protocol trigger, and its physics dictate the mitigations: widen the eviction margin (poll-interval budget from *measured* worst-case batches, file 03); cut the replay burst (cooperative assignment + static membership shrink the moved-partition set and the duplicate tail); bound the work per poll (batch-size-down as the circuit breaker, file 04 §3); and break the loop the way all metastable loops are broken — reduce load below the sustaining threshold, here by pausing consumption *deliberately* (a paused group is stable and accrues honest lag; a storming group accrues the same lag plus duplicate storms plus state-rebuild churn). The counter-intuitive operational rule that follows, stated for the runbook: **when a group is storming, stopping it is often the fastest way to catch up.**

```text
Figure 1. Rebalance storm as metastable loop — and where each
mitigation cuts.

     dependency slows / deploy / one slow member
                      │
                      ▼
        member exceeds poll interval ──────► evicted
        ▲   (budget margin ①)                  │
        │                                      ▼
   successor inherits:                 partitions reassigned
   same slow dependency          ◄──── + uncommitted tail replayed
   + replay burst (F4)                 (cooperative/static ②,
   + state rebuild                      smaller tails ③=frequent
        ▲                               commits, batch-down ④)
        │                                      │
        └────────────── loop ◄─────────────────┘
   break-glass ⑤: pause the group — lag accrues honestly,
   loop stops sustaining itself.
```

## 3. The Degradation Ladder

Chapter 01 file 08's overload stages, instantiated for event flows — each stage declared per topic class in the dossier (file 11), because a ladder invented mid-incident is just improvisation with extra steps:

| Stage | Action | Contract it spends |
|---|---|---|
| D1 | Absorb in lag; freshness SLOs consume error budget | Staleness only — the log doing its job |
| D2 | Degrade per-record work (skip enrichment, batch harder, cheap path) | Output richness, declared per view |
| D3 | Producer admission: quotas, class-based shedding at produce (file 04 §4) | Lowest-class data, counted |
| D4 | Pause selected consumers/flows to protect the critical ones (shared-cluster triage: not all topics are equal) | Chosen staleness for named flows |
| D5 | Emergency retention raise + rate-capped catch-up plan | Money and time, instead of data |

The D4 line requires the one artifact shared clusters usually lack: a **criticality ranking of topics/flows**, agreed before the incident, so that pausing analytics to save payments is a runbook step rather than a 3 a.m. negotiation.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Derivative-alarm gate | Alarms on lag velocity, runway comparison (catch-up vs retention), rebalance frequency, DLQ inflow-vs-triage, oldest-entry age — the *derivatives*, per partition | Absolute-threshold-only alarming; aggregate-only lag; F3 discoverable only by data absence |
| Storm-physics gate | F1 mitigations in place (budget margin, cooperative+static, commit cadence, batch-down knob); pause-the-group in the runbook with authority to use it | Storm response = restart everything and hope; no rehearsed pause |
| Duplicate-headroom gate | Dedup/idempotency path load-tested at rebalance-burst rates (file 02 §5's burst gate, verified here by drill) | Dedup sized for steady state; F4 discovers the ceiling in production |
| Ladder gate | D1–D5 declared per topic class; criticality ranking of flows signed by owning teams | Degradation improvised; shared-cluster triage undecided at incident time |
| Ownership gate | Every F1–F8 mode mapped to an owning team and a runbook; F7 explicitly routed to the Chapter 05 owner | Failure modes that page nobody, or page everybody |

## Output

The output of this file is a failure model that exploits streaming's slow tempos instead of being ambushed by them: derivative-based alarms that fire while the runway comparison still favors recovery, storm mitigations aimed at the metastable loop's actual joints, duplicate machinery with measured burst headroom, and a pre-agreed degradation ladder with the criticality ranking that makes triage a decision already made.

## References

- [Parse.ly — Kafkapocalypse: a postmortem on our service outage](https://www.parse.ly/kafkapocalypse/)
- [LinkedIn Engineering — Kafkaesque days at LinkedIn, Part 1 (incident catalog: retention, segment-roll, monitoring gaps)](https://engineering.linkedin.com/blog/2016/05/kafkaesque-days-at-linkedin--part-1)
- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021 — the sustaining-feedback-loop model F1 instantiates](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [AWS Builders' Library — Avoiding insurmountable queue backlogs (the backlog-recovery analysis behind §2 and D5)](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/)
- [New Relic — Kafkapocalypse: monitoring Kafka without losing your mind (the SLI set for F1/F2/F7)](https://newrelic.com/blog/best-practices/new-relic-kafkapocalypse)
