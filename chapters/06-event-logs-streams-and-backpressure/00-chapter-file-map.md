# Chapter 06 File Map

## Purpose

Logs provide replayable ordering, recovery, and decoupling — and they also introduce offset ownership, consumer lag, duplicate delivery, poison events, and retention constraints, with backpressure as a first-class control path rather than an operational afterthought. That is the root thesis this chapter implements. The log has already appeared in this book three times in supporting roles: as the CDC/outbox propagation machinery of Chapter 03 file 05, as the offset-commit delivery semantics of Chapter 01 file 07 §8, and as the per-partition leadership instance of Chapter 05. This chapter makes it the subject: topic and partition design, delivery semantics as an end-to-end property, consumer-group mechanics, flow control, poison handling, stateful stream processing, retention as a multi-party contract, and event schema governance across team boundaries.

Each file is a self-contained research note: an abstract stating the claim, a formal model, figures, decision tables, approval gates that can fail a design, and primary-source references.

## Reading Order

| Order | File | Architecture Decision Produced |
|---:|---|---|
| 1 | [README.md](README.md) | Chapter thesis, source corpus, and completion gate |
| 2 | [01-the-log-abstraction-and-topic-design.md](01-the-log-abstraction-and-topic-design.md) | What the log buys, topic/partition design, key choice as ordering scope, log-vs-queue admission |
| 3 | [02-delivery-semantics-and-idempotent-consumption.md](02-delivery-semantics-and-idempotent-consumption.md) | End-to-end delivery guarantees; idempotent producers, transactions, idempotent consumers |
| 4 | [03-consumer-groups-lag-and-rebalancing.md](03-consumer-groups-lag-and-rebalancing.md) | Group protocol, assignment, rebalance cost, lag as the master SLI |
| 5 | [04-backpressure-and-flow-control.md](04-backpressure-and-flow-control.md) | Bounded buffers everywhere, credit/pull flow control, producer admission |
| 6 | [05-poison-events-dlq-and-replay.md](05-poison-events-dlq-and-replay.md) | Poison taxonomy, retry topics, DLQ ownership, replay discipline |
| 7 | [06-stream-processing-and-stateful-computation.md](06-stream-processing-and-stateful-computation.md) | Stateful operators, checkpointing, event time, watermarks, exactly-once state, streams feeding models and indexes |
| 8 | [07-retention-compaction-and-the-log-as-storage.md](07-retention-compaction-and-the-log-as-storage.md) | Retention as contract, compaction semantics, tiered storage, event-sourcing caution |
| 9 | [08-event-schema-governance-and-evolution.md](08-event-schema-governance-and-evolution.md) | Registry compatibility modes, event versioning, cross-team contracts |
| 10 | [09-failure-modes-and-degradation.md](09-failure-modes-and-degradation.md) | Rebalance storms, lag runaway, duplicate storms, retention expiry, DLQ overflow |
| 11 | [10-verification-of-event-flows.md](10-verification-of-event-flows.md) | Drills E1–E10, streaming SLIs, end-to-end semantics testing |
| 12 | [11-event-flow-review-templates.md](11-event-flow-review-templates.md) | Executable dossier and approval checklist |

## Approval Dependency Graph

```text
Figure 1. Chapter 06 approval dependency graph.

  [01] Log abstraction + topic design
        │  (key choice fixes ordering scope — everything
        │   downstream inherits it)
        v
  [02] Delivery semantics (end-to-end, producer→consumer)
        │
        ├──────────────────────────────┐
        v                              v
  [03] Consumer groups + lag     [04] Backpressure + flow control
        │                              │
        └──────────┬───────────────────┘
                   v
  [05] Poison events, DLQ, replay
                   │
                   v
  [06] Stream processing + stateful computation
                   │
                   ├──────────────────┐
                   v                  v
  [07] Retention + compaction   [08] Schema governance
                   │                  │
                   └────────┬─────────┘
                            v
  [09] Failure modes + degradation
                            v
  [10] Verification ──► [11] Dossier
```

Concrete dependencies the graph encodes:

- Delivery semantics ([02]) are meaningless before the partition key ([01]) fixes what "in order" even scopes to.
- Poison handling ([05]) presupposes both the consumer-group mechanics ([03]) — a poison event blocks its whole partition — and the flow-control vocabulary ([04]).
- Exactly-once stream processing ([06]) composes [02]'s transactions with its own checkpointing; neither alone suffices.
- Retention ([07]) bounds every replay claim made in [05] and every rebuild claim inherited from Chapter 03 file 05 §4.
- Schema governance ([08]) is Chapter 03 file 07's migration matrix applied to events — with the twist that retention keeps old versions readable long after producers stop.

## Prerequisites From Earlier Chapters

| Artifact | Consumed By |
|---|---|
| Offset-commit delivery semantics ([Ch01 file 07 §8](../01-architectural-objective-and-system-boundary/07-state-classification-and-consistency-boundary.md)) | [02] — deepened into end-to-end guarantees |
| Backpressure contract, overload stages ([Ch01 file 08](../01-architectural-objective-and-system-boundary/08-failure-domain-and-overload-semantics.md)) | [04] — instantiated for streams |
| Idempotency contract ([Ch01 file 04 §3](../01-architectural-objective-and-system-boundary/04-input-output-and-api-contracts.md)) | [02], [05] — the consumer side of every retry |
| CDC/outbox propagation, DAG lag SLIs ([Ch03 file 05](../03-state-ownership-and-consistency-model/05-derived-state-and-lineage.md)) | [01], [07] — the log as the DAG's transport |
| Retention floor/ceiling contract ([Ch03 file 06 §2](../03-state-ownership-and-consistency-model/06-state-lifecycle-retention-and-deletion.md)) | [07] |
| Migration matrix ([Ch03 file 07](../03-state-ownership-and-consistency-model/07-schema-evolution-and-migration.md)) | [08] |
| Per-partition leadership, partition maps ([Ch05 file 04](../05-replication-partitioning-and-quorum-semantics/04-partitioning-and-placement.md)) | [01], [03] |

## Chapter Rule

Chapter 06 approves topic designs, delivery-semantics contracts, consumer-group configurations, flow-control paths, poison-handling machinery, stream-processing topologies, retention policies, and event schema governance — each priced end-to-end from producer to final side effect. It does not approve API request/response contracts (Chapter 01 file 04 owns those), and it does not re-litigate the broker's internal replication (Chapter 05 owns partition leadership and quorums).
