# Chapter 06: Event Logs, Streams, and Backpressure

## Abstract

Logs provide replayable ordering, recovery, and decoupling — and they introduce offset ownership, consumer lag, duplicate delivery, poison events, and retention constraints, with backpressure as a first-class control path rather than an operational afterthought. This chapter is where the book's storage discipline crosses team boundaries: the log is the transport of Chapter 03's derived-state DAG and the delivery mechanism between systems that Chapters 01–05 designed individually, and its guarantees are systematically weaker than teams assume. Ordering is scoped to a partition key chosen once and nearly unchangeable; delivery is at-least-once with "exactly-once" available only as a transactional or idempotence discipline that ends at every external boundary; the decoupling the log sells is a retention window, not an exemption from capacity arithmetic; and every deferred question — who slows the producer, who owns the DLQ, how long is history really needed, who reads this schema — converts into loss at retention edges and replay time.

The chapter's spine is the honest pricing of the log's promises: Kreps' unifying-abstraction argument taken seriously enough to enforce its costs ([The Log](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)); the impossibility of exactly-once delivery and the KIP-98 machinery that makes exactly-once *processing* real within the log's boundary; the rebalance storm as this domain's native metastable failure; and the slow-tempo loss modes — lag runaway racing retention expiry — whose defining property is that every quantity in them is knowable days in advance, as Parse.ly's pipeline-wide stop demonstrated by counterexample ([postmortem](https://www.parse.ly/kafkapocalypse/)). One sentence for the whole chapter: an event flow is approved end-to-end — producer to final side effect — or it is not approved at all.

## Chapter Structure

Each file is a self-contained research note: abstract, formal model, ASCII figures, decision tables, approval gates that can fail a design, and primary-source references. The reading order is a dependency graph (see [00-chapter-file-map.md](00-chapter-file-map.md)).

| Order | File | Concept |
|---:|---|---|
| 0 | [00-chapter-file-map.md](00-chapter-file-map.md) | Folder map, dependency graph, prerequisites from Chapters 01/03/05 |
| 1 | [01-the-log-abstraction-and-topic-design.md](01-the-log-abstraction-and-topic-design.md) | What the log buys — priced; partition key as the ordering contract; partition-count arithmetic; when the log is the wrong tool |
| 2 | [02-delivery-semantics-and-idempotent-consumption.md](02-delivery-semantics-and-idempotent-consumption.md) | The delivery lattice, KIP-98 machinery, the external-boundary patterns, duplicate-burst arithmetic |
| 3 | [03-consumer-groups-lag-and-rebalancing.md](03-consumer-groups-lag-and-rebalancing.md) | Group mechanics, rebalance cost models, lag as the master SLI (time, velocity, runways) |
| 4 | [04-backpressure-and-flow-control.md](04-backpressure-and-flow-control.md) | The conservation law, pull/credit mechanics, bounded buffers, who slows the producer |
| 5 | [05-poison-events-dlq-and-replay.md](05-poison-events-dlq-and-replay.md) | Poison taxonomy, graduated retries, DLQ as an owned product, replay discipline |
| 6 | [06-stream-processing-and-stateful-computation.md](06-stream-processing-and-stateful-computation.md) | Event time and watermarks, barrier snapshots, what exactly-once covers, runtime placement, streams feeding models and indexes |
| 7 | [07-retention-compaction-and-the-log-as-storage.md](07-retention-compaction-and-the-log-as-storage.md) | Retention as multi-party contract, compaction semantics, tiered storage, event-sourcing caution |
| 8 | [08-event-schema-governance-and-evolution.md](08-event-schema-governance-and-evolution.md) | Compatibility direction and transitivity, registry enforcement, envelopes, semantic evolution |
| 9 | [09-failure-modes-and-degradation.md](09-failure-modes-and-degradation.md) | The F1–F8 catalog, the runway race, the rebalance storm, the D1–D5 ladder |
| 10 | [10-verification-of-event-flows.md](10-verification-of-event-flows.md) | Drills E1–E10, streaming SLIs, flow-generation evidence stamps |
| 11 | [11-event-flow-review-templates.md](11-event-flow-review-templates.md) | Executable dossier and approval checklist |

## Source Corpus

| Source | Official Material | Standard Imported Into This Chapter |
|---|---|---|
| Kreps / LinkedIn | [The Log, 2013](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying), [Kafka, NetDB 2011](https://notes.stephenholiday.com/Kafka.pdf) | The log as the unifying abstraction; its gifts (ordering, replay, decoupling) scoped per partition and priced in storage, lag, and retention. |
| Apache Kafka / KIP-98 | [KIP-98](https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging), [Confluent exposition](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/) | Idempotent producers (PID + sequence fencing) and transactions (atomic produce + offset commit, zombie fencing by epoch); exactly-once as processing semantics inside the log's boundary, never delivery. |
| Treat | [You Cannot Have Exactly-Once Delivery](https://bravenewgeek.com/you-cannot-have-exactly-once-delivery/) | The impossibility argument that fixes the chapter's vocabulary: at-least-once + idempotence is the honest contract. |
| Apache Kafka / KIP-429, KIP-345, KIP-848, KIP-932 | [Incremental cooperative rebalancing](https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol), [static membership](https://cwiki.apache.org/confluence/display/KAFKA/KIP-345%3A+Introduce+static+membership+protocol+to+reduce+consumer+rebalances), [next-gen protocol (GA in 4.0)](https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol), [share groups (production in 4.2)](https://cwiki.apache.org/confluence/display/KAFKA/KIP-932%3A+Queues+for+Kafka) | Rebalance cost as the group protocol's central engineering problem: minimal-movement assignment, restart-without-rebalance, the removal of the stop-the-world barrier — and queue semantics as a distinct tool on the same log, making tool-fit an explicit decision. |
| LinkedIn Burrow | [Burrow](https://github.com/linkedin/Burrow) | Lag evaluated by consumer behavior over windows — velocity and progress — rather than fixed thresholds. |
| Reactive Streams / Apache Flink | [Specification](https://www.reactive-streams.org/), [Flink network stack](https://flink.apache.org/2019/06/05/a-deep-dive-into-flinks-network-stack/) | Demand-based flow control as the compositional bounded-memory guarantee; credit-based per-channel pressure scoped to the slow path. |
| AWS Builders' Library | [Avoiding insurmountable queue backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/) | The backlog as an outage on a timer; recovery-time arithmetic; shedding as a designed choice rather than an ambient outcome. |
| Uber Engineering | [Reliable reprocessing and DLQs](https://www.uber.com/blog/reliable-reprocessing/) | Tiered retry topics with escalating delay; DLQ entries as diagnostic envelopes; re-injection as a designed path. |
| Carbone et al. / Apache Flink | [Asynchronous barrier snapshots, arXiv:1506.08603](https://arxiv.org/abs/1506.08603), [end-to-end exactly-once](https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/) | Checkpoints as consistent cuts of state + source positions; recovery as rollback-plus-replay; sinks joining the checkpoint via two-phase commit. |
| Akidau et al. | [The Dataflow Model, VLDB 2015](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf) | Event time vs processing time; watermarks as declared completeness policy; late data as a rule, not a surprise. |
| Apache Kafka / KIP-405 | [Tiered storage](https://cwiki.apache.org/confluence/display/KAFKA/KIP-405%3A+Kafka+Tiered+Storage), [log compaction](https://kafka.apache.org/documentation/#compaction) | Retention as economics rather than broker disk; the cold tier as a distinct performance class; compaction as current-state semantics with tombstone and offset caveats. |
| Confluent Schema Registry / Apache Avro | [Schema evolution and compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html), [Avro spec](https://avro.apache.org/docs/current/specification/) | Compatibility direction as upgrade order; transitivity scoped to everything still readable under retention; produce-time enforcement. |
| Parse.ly / LinkedIn | [Kafkapocalypse postmortem](https://www.parse.ly/kafkapocalypse/), [Kafkaesque days](https://engineering.linkedin.com/blog/2016/05/kafkaesque-days-at-linkedin--part-1) | The incident corpus: slow-tempo failures announcing themselves through derivatives nobody alarmed; retention and segment-roll edge cases as production surprises. |
| Bronson et al. | [Metastable Failures, HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) | The rebalance storm as a sustaining-feedback-loop metastable failure; break the loop by shedding the sustaining load — including pausing the group. |

## Chapter Standards

1. Ordering claims are scoped: total order per partition, nothing across partitions; the partition key is derived from a written consumer ordering requirement and treated as irrevocable.
2. Partition count is computed from measured per-consumer throughput with headroom; repartitioning a keyed topic is a migration, never a knob.
3. Delivery vocabulary is honest: at-least-once + idempotent effect, or transactional-within-the-log; "exactly-once delivery" is a rejected phrase; at-most-once requires a data-loss sign-off.
4. Offsets commit after side effects; every non-idempotent effect is enumerated and covered by a dedup table, a 2PC sink, or an idempotency-key contract with dedup window ≥ replay horizon.
5. Event identity is origin-assigned and travels in a standard envelope (ID, type, schema ID, event time, source, trace context); offsets are positions, never identity.
6. Stateful consumer groups run cooperative assignment and static membership; liveness budgets derive from measured worst-case batches; group IDs and reset policies are under change control.
7. Lag is measured as time, per partition, with velocity and both runways (catch-up, retention) computed; alerts fire on derivatives and comparisons, never only on absolute counts.
8. Every buffer is bounded and every bound has a declared overflow behavior; the pressure path is traced source-ward and terminates at a named producer policy per topic class.
9. Poison events are classified per exception path with distinct dispositions; retry-topic detours are reconciled with the ordering contract; the DLQ has an owner, a triage SLO, an oldest-entry-age alarm, and exactly two exit doors.
10. Replay is licensed by rehearsed idempotence, rate-capped, abortable, change-controlled, with non-idempotent externalities enumerated and masked and time semantics stated.
11. Windowed logic runs on event time with a watermark policy derived from measured skew and an explicit late-data rule; keyed state declares TTLs; checkpoint recovery time is measured, not asserted.
12. Retention is the maximum of declared multi-party horizons, alarmed at the edges, reconciled with erasure ceilings; compacted topics serve only upsert-idempotent readers; cold-tier reads are load-tested against the rebuild claims that depend on them.
13. Schema compatibility is transitive and scoped to every version inside retention; the registry enforces at produce time; consumer registries answer "who reads this"; semantic shifts ride new fields.
14. Every failure mode F1–F8 has an owner, a runbook, and a leading indicator; the degradation ladder D1–D5 and the cross-flow criticality ranking are agreed before the incident.
15. Event-flow evidence carries class, date, and flow-generation stamp (topic config, group protocol, schema versions, fleet); any stamped-field change resets the evidence to `assumed`.

## Chapter Completion Gate

Chapter 06 is complete only when the reviewer can answer these questions without guessing:

- For any topic: what ordering does it actually guarantee, to whom, and what consumer requirement is the partition key derived from?
- For any flow: where exactly does the transactional boundary end, and which pattern covers every non-idempotent side effect beyond it?
- For any consumer group: how far behind is it in *time*, which direction is that moving, and how long until unconsumed data expires?
- For any topic: who slows the producer when the consumer cannot keep up — and is that an implemented policy or a hope?
- For any partition: what happens to the record that cannot be processed, who owns where it lands, and how old is the oldest thing there?
- For any stateful processor: what is the measured recovery time, and what do its windowed outputs mean under replay?
- For any topic: who declared its retention horizon, who is alarmed as consumers approach it, and can the cold tier actually serve the rebuild that depends on it?
- For any schema: does its compatibility scope cover everything still readable, and who gets notified before it changes?
- For every claim above: what is the evidence class, its date, and the flow generation it was proven at?

## Final Position

The log is the best tool distributed systems have for connecting teams without coupling their uptime — and every one of its gifts is a deferred bill: ordering deferred to a key choice, capacity deferred to a retention window, correctness deferred to consumer idempotence, and loss deferred to the retention edge where it stops being deferred. This chapter's discipline is simply to read the bill before signing: price the key, bound the buffers, own the DLQ, rehearse the replay, stamp the evidence. Chapter 05 distributed state across machines; this chapter distributed it across teams and time. Chapter 07 takes the next seam: the API contracts and request lifecycle that ride in front of everything built so far — the synchronous face of the systems these logs connect asynchronously.

## References

- [Kreps, "The Log," LinkedIn Engineering, 2013](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
- [Parse.ly — Kafkapocalypse postmortem](https://www.parse.ly/kafkapocalypse/)
- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
