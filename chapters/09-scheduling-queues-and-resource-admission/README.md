# Chapter 09 — Scheduling, Queues, and Resource Admission

## Abstract

This chapter's claim is that every system already has an admission policy — the only question is whether anyone designed it: every buffer is a queue with a discipline, a bound, and a full-queue behavior; every retry configuration is an arrival-rate multiplier; every utilization target is a purchased position on a latency asymptote; and when none of these were chosen, the memory allocator, the framework defaults, and the feedback physics choose for you, invariably during the worst hour of the year. The chapter builds the discipline outward from a decision table (queue, shed, scale, or backpressure — per work class, with arithmetic), through the queueing laws carried *with their validity envelopes* (Little's exactness, M/M/1's asymptote, Kingman's variance pricing — and the open-loop and heavy-tail conditions that break naive use of all three), into the machinery: sojourn-controlled adaptive-LIFO queues that refuse to serve the dead, criticality-ordered shedding with priced brownout ladders, token-bucket limits that are contracts, dominant-resource fairness and shuffle-sharded isolation, governed priority with priced preemption, and the backlog/storm mechanics whose exit sequences must exist before they are needed. The through-line number is goodput — work completed within its usefulness — because past saturation, throughput and success part company, and every mechanism in this chapter exists to keep them together.

## Chapter Structure

| File | Claim it carries |
|---|---|
| [00-chapter-file-map.md](00-chapter-file-map.md) | Reading order, approval dependency graph, prerequisites from Chapters 01–08 |
| [01-the-admission-decision-queue-shed-or-scale.md](01-the-admission-decision-queue-shed-or-scale.md) | The four honest responses to overload; goodput as objective; unbounded queues are never a design |
| [02-queueing-laws-and-utilization-economics.md](02-queueing-laws-and-utilization-economics.md) | Little/M-M-1/Kingman with envelopes; utilization worked (50%→1, 99%→99); the tandem composition law + endogenous λ |
| [03-queue-disciplines-and-bounded-queues.md](03-queue-disciplines-and-bounded-queues.md) | FIFO's goodput inversion; adaptive LIFO + CoDel sojourn control; bounds as delay contracts; the implicit-queue inventory |
| [04-load-shedding-and-adaptive-concurrency.md](04-load-shedding-and-adaptive-concurrency.md) | Criticality classes; priced brownout ladders; gradient concurrency limits; client-side adaptive throttling |
| [05-rate-limiting-and-quotas.md](05-rate-limiting-and-quotas.md) | Token buckets as contracts; the distributed-enforcement triangle; quotas ≠ capacity plans |
| [06-fairness-and-multi-tenant-isolation.md](06-fairness-and-multi-tenant-isolation.md) | The isolation ladder; DRF worked; shuffle sharding's combinatorics; K8s APF as the assembled instance |
| [07-priority-preemption-and-deadline-scheduling.md](07-priority-preemption-and-deadline-scheduling.md) | Priority scarcity, starvation, inversion; the preemption price list; feasibility-tested deadline admission |
| [08-backlogs-retry-storms-and-recovery.md](08-backlogs-retry-storms-and-recovery.md) | B/(μ−λ) drain arithmetic; congestive collapse and its rehearsed exit; the incident-mechanism corpus |
| [09-ai-workload-scheduling.md](09-ai-workload-scheduling.md) | Continuous batching; chunked prefill vs disaggregation; KV-priced preemption; gang scheduling; agent episode budgets |
| [10-verification-of-admission-and-scheduling.md](10-verification-of-admission-and-scheduling.md) | Drills W1–W10 (open-loop, binding); the admission SLI set; load-model evidence stamps |
| [11-scheduling-review-templates.md](11-scheduling-review-templates.md) | The ten-section dossier and 26-point reviewer checklist |

## Source Corpus

| Source | What this chapter takes from it |
|---|---|
| [Google SRE Book, "Handling Overload"](https://sre.google/sre-book/handling-overload/) + ["Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/) | Criticality, client-side adaptive throttling, goodput past saturation, the shed-and-ramp recovery discipline |
| [Maurer, "Fail at Scale" (ACM Queue 2015)](https://queue.acm.org/detail.cfm?id=2839461) | Adaptive LIFO + CoDel + concurrency control — the production overload stack |
| [Nichols & Jacobson, "Controlling Queue Delay" (ACM Queue 2012)](https://queue.acm.org/detail.cfm?id=2209336) | Sojourn time as the control variable; standing-queue detection |
| [Brooker: "Latency Sneaks Up On You"](https://brooker.co.za/blog/2021/08/05/utilization.html), ["Erlang economics"](https://brooker.co.za/blog/2020/08/06/erlang.html), ["Open and Closed"](https://brooker.co.za/blog/2023/05/10/open-closed.html) | The utilization asymptote; pooling headroom; the open/closed-loop envelope condition |
| [Kingman's formula](https://en.wikipedia.org/wiki/Kingman%27s_formula) + [Harchol-Balter, *Performance Modeling*](https://www.cs.cmu.edu/~harchol/PerformanceModeling/book.html) | Variance pricing (VUT); the rigorous backing for every law cited |
| [Netflix, "Performance Under Load"](https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581) + [concurrency-limits](https://github.com/Netflix/concurrency-limits) | Gradient adaptive concurrency — TCP congestion control transplanted to RPC |
| [Stripe, "Scaling your API with rate limiters"](https://stripe.com/blog/rate-limiters) | Token buckets in production; fail-open limiter posture |
| [Ghodsi et al., "Dominant Resource Fairness" (NSDI 2011)](https://www.usenix.org/conference/nsdi11/dominant-resource-fairness-fair-allocation-multiple-resource-types) | Multi-resource fairness: strategy-proof, envy-free, the shape GPU sharing needs |
| [AWS Builders' Library: queue backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/), [load shedding](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/), [shuffle sharding](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/), [fairness](https://aws.amazon.com/builders-library/fairness-in-multi-tenant-systems/) | Drain/triage repertoire; shedding placement; combinatorial isolation; tenant fairness |
| [AWS postmortems: DynamoDB 2015](https://aws.amazon.com/message/5467D2/) + [US-East-1 Oct 2025](https://aws.amazon.com/message/101925/) | The incident-mechanism corpus: retry storms and congestive collapse, a decade apart, same shape |
| [Bronson et al., "Metastable Failures" (HotOS 2021)](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) | The sustaining-feedback formalism behind congestive collapse |
| [Kubernetes: API Priority and Fairness (GA v1.29)](https://kubernetes.io/docs/concepts/cluster-administration/flow-control/) + [priority/preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/) + [Kueue](https://kueue.sigs.k8s.io/) | The assembled production instances: flow control, preemption budgets, gang queueing (statuses verified at write time) |
| [Orca (OSDI 2022)](https://www.usenix.org/conference/osdi22/presentation/yu), [Sarathi-Serve (OSDI 2024)](https://www.usenix.org/conference/osdi24/presentation/agrawal), [DistServe (OSDI 2024)](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin) | Continuous batching; chunked prefill; disaggregation — the AI scheduling frontier |
| [Liu & Layland (JACM 1973)](https://dl.acm.org/doi/10.1145/321738.321743) | EDF's optimality and its feasible-region envelope |

## Chapter Standards

1. Research-note structure per file: Abstract → numbered sections with formal models → ASCII figures ("Figure N.") → decision tables → approval gates → Output → verified primary-source references.
2. Every work class has a written queue/shed/scale/backpressure verdict; the when-NOT-to-queue decision is first-class (file 01 §1).
3. Goodput — not throughput — is the objective function, measured past saturation under open-loop load.
4. Every queueing formula carries its validity envelope inline: the assumptions, the production conditions that break them, and the consequence — the standard this chapter introduces for all subsequent chapters (standard 7).
5. Utilization targets are derived by inverting the latency curve at the SLO; variance is a priced lever (Kingman).
6. The composition law is stated with algebra and worked numbers (file 02 §3): conjunctive stability, bottleneck throughput, additive waits, propagating variance, endogenous arrivals.
7. No unbounded queues; bounds are delay contracts; disciplines are overload decisions; expired work is never executed.
8. Shedding consumes a governed criticality ladder; brownout rungs are priced and rehearsed.
9. Limits are published contracts with cost-based debiting; enforcement topology states its accuracy bound; Σ(limits) ≠ capacity plan.
10. Isolation is chosen per shared resource from an explicit ladder with the one-bad-tenant cost quantified; multi-resource pools share by dominant resource.
11. Priority is scarce, governed, and provisioned; preemption is priced against resumability; deadline admission is feasibility-tested.
12. Backlog drain, surge, and triage are pre-designed; the congestive-collapse exit sequence is rehearsed with pre-built pause controls.
13. The incident-mechanism corpus is maintained: named public postmortems mapped to the chapter's laws and converted into standing gates.
14. The AI instantiation is load-bearing (file 09): iteration-level scheduling, two-resource admission, priced KV preemption, phase-interference decisions, gang and episode admission.
15. Every stated law/formula carries at least one worked numeric example (99% → 99 in system; 19-hour drains; λ_eff = 1080 > μ = 1000; DRF's 20/18 split; shuffle sharding's 1/28).
16. The research frontier (≤3-year-old peer-reviewed work) is evaluated with explicit adoption-status judgments (Sarathi-Serve, DistServe, Kueue/gang-scheduling statuses verified at write time).
17. Version-status claims are search-verified at write time and stated inline (APF GA v1.29; gang scheduling beta in Kubernetes v1.36, May 2026).
18. Verification is drills + standing SLIs + load-model stamps (file 10), with open-loop generation as a binding requirement.
19. The chapter approves admission and scheduling decisions only; API contracts, logs, caches, and GPU internals are cited prerequisites (file 11 §4).
20. The README carries an Open Problems section — what the discipline has not solved, stated honestly — the standard this chapter introduces for all subsequent chapters (standard 8).

## Chapter Completion Gate

The chapter is complete for a given system only when its review can answer:

1. For every work class: queue, shed, scale, or backpressure — and what arithmetic decided?
2. What does the measured goodput curve look like at 2× capacity, and when was it last driven open-loop?
3. What utilization does each fleet run at, derived from which latency SLO, with what measured C_a²/C_s²?
4. What is the tandem-stage walk's result — per-stage ρ, additive waits vs the deadline budget, and where is the bottleneck?
5. At what retry fraction does λ_eff cross μ, and what forces it back down?
6. Which queues exist — including the implicit ones — and for each: discipline, derived bound, full-queue behavior, and expired-work enforcement?
7. In what order does overload consume quality (the criticality ladder and brownout rungs), and when was the ladder last rehearsed?
8. What does one hostile-or-unlucky tenant cost the others, per shared resource, as a number?
9. How long does each queue's worst credible backlog take to drain, what surges, what gets triaged, and can the collapse exit be executed with controls that exist today?
10. For the AI fleet: what TTFT/TPOT position is the scheduler configured to, what does a preemption cost, and are training and agent workloads admitted under gang and episode budgets?

## Open Problems

Stated honestly, per this chapter's standard: **(1) Aggregation vs disaggregation for LLM serving is unresolved** — the literature actively contests whether prefill/decode separation beats stall-free colocation, the answer is workload-dependent (context/output ratios, SLO tightness, fleet scale), and this chapter can only require the trade be *stated*, not settled. **(2) Shedding under unknown request cost**: criticality-ordered shedding assumes cost and value are knowable at admission; for workloads whose cost is revealed only during execution (agent episodes, complex queries), optimal admission remains heuristic — budgets cap the damage but do not choose well. **(3) Adversarial fairness**: DRF is strategy-proof about quantities, not shapes; tenants who *engineer* their demand vectors (or their burst timing, against reconciled limiters) can still extract more than their share, and practical defenses remain structural (sharding, dedication) rather than algorithmic. **(4) The closed-form theory of feedback systems** — queues whose arrivals depend on their own latency through retries, hedging, and client adaptation — is thin: the two-solution intuition of file 02 §3 is qualitatively robust but quantitatively bespoke per system, which is why this chapter leans so heavily on measured goodput curves and rehearsed exits over analytical guarantees.

## Final Position

Admission control is the system deciding, in advance and in writing, what it will fail to do under pressure — and this chapter's machinery exists so that decision is made by the business's preference order and the queueing arithmetic rather than by whichever buffer overflows first. The seam forward: every law here priced the queue in front of a generic server; [Chapter 10](../10-inference-runtime-and-gpu-serving-architecture/README.md) descends into the most contended server this book covers — the GPU serving runtime, where the iteration scheduler of file 09 meets tokenizers, prefill, decode, KV allocation, batching, and streaming, and where TTFT, TPOT, memory bandwidth, and cache residency define the real capacity envelope this chapter's admission decisions must respect.

## References

- [Google SRE Book, "Handling Overload"](https://sre.google/sre-book/handling-overload/)
- [Maurer, "Fail at Scale" (ACM Queue 2015)](https://queue.acm.org/detail.cfm?id=2839461)
- [AWS Builders' Library, "Avoiding insurmountable queue backlogs"](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/)
- [Brooker, "Open and Closed, Omission and Collapse"](https://brooker.co.za/blog/2023/05/10/open-closed.html)
