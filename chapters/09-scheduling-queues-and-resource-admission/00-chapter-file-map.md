# Chapter 09 File Map — Scheduling, Queues, and Resource Admission

## Reading Order

| Order | File | Owns |
|---:|---|---|
| 1 | [01-the-admission-decision-queue-shed-or-scale.md](01-the-admission-decision-queue-shed-or-scale.md) | When a queue is the wrong tool; the queue/shed/scale/backpressure decision; goodput as the objective function |
| 2 | [02-queueing-laws-and-utilization-economics.md](02-queueing-laws-and-utilization-economics.md) | Little's Law, M/M/1, Kingman — each with its validity envelope; the tandem-stage composition law; utilization as a purchased latency |
| 3 | [03-queue-disciplines-and-bounded-queues.md](03-queue-disciplines-and-bounded-queues.md) | FIFO's overload failure; adaptive LIFO + CoDel; sojourn time as the control signal; queue bounds as capacity statements |
| 4 | [04-load-shedding-and-adaptive-concurrency.md](04-load-shedding-and-adaptive-concurrency.md) | Criticality-aware shedding; client-side adaptive throttling; gradient concurrency limits; degradation ladders |
| 5 | [05-rate-limiting-and-quotas.md](05-rate-limiting-and-quotas.md) | Token buckets; distributed limiter accuracy trades; quotas as contracts; limiter placement against Ch07's pipeline |
| 6 | [06-fairness-and-multi-tenant-isolation.md](06-fairness-and-multi-tenant-isolation.md) | Max-min and dominant-resource fairness; shuffle sharding; head-of-line blocking; K8s API Priority and Fairness as the worked instance |
| 7 | [07-priority-preemption-and-deadline-scheduling.md](07-priority-preemption-and-deadline-scheduling.md) | Priority classes that mean something; starvation and inversion; deadline-aware queues that refuse expired work |
| 8 | [08-backlogs-retry-storms-and-recovery.md](08-backlogs-retry-storms-and-recovery.md) | Backlog drain arithmetic; retry storms as arrival-rate multipliers; congestive collapse; the incident-mechanism corpus |
| 9 | [09-ai-workload-scheduling.md](09-ai-workload-scheduling.md) | Continuous batching, chunked prefill, disaggregation; SLO-aware admission for token workloads; gang scheduling; agent episode budgets — the AI-native instantiation |
| 10 | [10-verification-of-admission-and-scheduling.md](10-verification-of-admission-and-scheduling.md) | Drill catalog W1–W10; the admission SLI set; load-generation evidence stamps |
| 11 | [11-scheduling-review-templates.md](11-scheduling-review-templates.md) | The admission surface dossier and reviewer checklist |

## Approval Dependency Graph

```text
Figure 1. Approval dependencies. The laws [02] gate every design
file; the admission decision [01] gates the chapter; failure
mechanics [08] and the AI file [09] consume everything and feed
the evidence machinery [10] → templates [11].

  [01 queue/shed/scale decision]
        │
        v
  [02 queueing laws + composition]
        │
        ├──► [03 disciplines/bounds] ──► [07 priority/deadlines]
        │              │
        ├──► [04 shedding/concurrency]      │
        │              │                    │
        ├──► [05 rate limits/quotas] ──► [06 fairness/isolation]
        │              │                    │
        │              v                    v
        └────────► [08 backlogs/storms/recovery]
                       │
                       v
              [09 AI workload scheduling]
                       │
                       v
              [10 verification] ──► [11 templates]
```

## Prerequisites From Earlier Chapters

| Prerequisite | Where it is established | Consumed by |
|---|---|---|
| The overload contract: reject early, degrade deliberately | [Ch01 file 08](../01-architectural-objective-and-system-boundary/08-failure-domain-and-overload-semantics.md) | [01], [04] |
| Admission decisions as control-plane state enforced in the data plane | [Ch02 file 05](../02-control-plane-and-data-plane-separation/05-admission-scheduling-and-placement.md) | [01], [05] |
| Backpressure as the log/stream answer to overload | [Ch06 file 04](../06-event-logs-streams-and-backpressure/04-backpressure-and-flow-control.md) | [01], [08] |
| The recovery multiplier: catch-up load after an outage | [Ch06 file 09](../06-event-logs-streams-and-backpressure/09-failure-modes-and-degradation.md) | [08] |
| Retry amplification, budgets, and one-retrying-layer | [Ch07 file 03](../07-api-contracts-and-request-lifecycle/03-timeout-budgets-retries-and-hedging.md) | [02], [08] |
| The pipeline's admission stage and rejection economics | [Ch07 file 02](../07-api-contracts-and-request-lifecycle/02-request-lifecycle-and-middleware-order.md) | [04], [05] |
| Deadline propagation: work must not outlive its caller | [Ch07 file 03 §1](../07-api-contracts-and-request-lifecycle/03-timeout-budgets-retries-and-hedging.md) | [07] |
| Cache misses as origin load; cold-start multipliers | [Ch08 file 06](../08-caching-materialization-and-invalidation/06-stampede-metastability-and-degraded-modes.md) | [01], [08] |
| Evidence classification (tested / observed / assumed) | [Ch01 file 11](../01-architectural-objective-and-system-boundary/11-evidence-classification-and-architecture-review.md) | [10], [11] |

## Chapter Rule

This chapter approves *admission and scheduling decisions*: what work is accepted, where it waits, in what order it runs, who gets capacity under contention, and how backlogs drain. It does not approve the API surface that receives requests (Chapter 07), the log that carries deferred work (Chapter 06), the caches that shape arrival rates (Chapter 08), or the GPU serving internals the AI schedulers drive (Chapter 10) — those are cited as prerequisites, never re-argued.
