# Fairness and Multi-Tenant Isolation

## Abstract

Fairness is the admission question quotas cannot answer: quotas bound each tenant's *entitlement*, but inside the admitted load, shared queues and pools still let one tenant's burst become every tenant's latency — the noisy neighbor is not a tenant exceeding their quota but a tenant *using* it, concurrently with everyone else. The formal core is **max-min fairness** (repeatedly satisfy the smallest demand first; no tenant's allocation can grow except by shrinking a smaller one's) and its multi-resource generalization **Dominant Resource Fairness** ([Ghodsi et al., NSDI 2011](https://www.usenix.org/conference/nsdi11/dominant-resource-fairness-fair-allocation-multiple-resource-types)): when work consumes several resources at different ratios (CPU-heavy vs memory-heavy vs, in file 09's world, prefill-heavy vs decode-heavy), equalize each tenant's share of its *dominant* resource — the scheme that is simultaneously strategy-proof (lying about demand cannot help), envy-free, and Pareto-efficient, which is why it underlies Mesos/YARN-lineage schedulers and the fair-sharing halves of Kubernetes machinery. The structural complement is **shuffle sharding** ([AWS Builders' Library](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)): assign each tenant a random small subset of nodes so that two tenants rarely share their *whole* footprint — with n=8 workers and shards of 2, two tenants share both nodes with probability 1/28, so a poison tenant takes down its own experience and ~3.6% of others' redundancy instead of 100% of a static shard's cotenants. And the everyday mechanism nobody budgets for is **head-of-line blocking**: any shared FIFO — one queue, one pool, one connection — makes tenant A's slow item tenant B's wait; per-tenant queues drained by weighted round-robin (fair queueing's discrete form) is the default remedy and the shape of Kubernetes' API Priority and Fairness, this file's worked production instance (GA since v1.29).

## 1. The Fairness Ladder

```text
Figure 1. Isolation strength vs cost — choose per shared resource.

  weakest ──────────────────────────────────────► strongest
  shared FIFO      per-tenant queues    shuffle-      dedicated
  (HOL blocking:   + weighted fair      sharded       capacity
  one tenant's     drain (WFQ/DRR) —    node subsets  (physical
  burst = all      bounds any tenant's  (blast radius isolation:
  tenants' wait)   share of DRAIN       = shard       the quota
                   capacity             overlap math) IS capacity)
  cost: none       state per tenant     placement     utilization
                                        constraints   sacrificed
  The review question per shared resource (queue, pool, node
  set, batch slot): which rung, and what does one hostile-or-
  unlucky tenant cost the others AT that rung — as a number.
```

Two rules bind the ladder. **Fair-share weights are product decisions** (tiers, priorities) carried as control-plane policy — the same governance as file 05's quota numbers, because a fairness weight *is* a quota on drain capacity. **Fairness needs an ejection seat**: max-min sharing degrades gracefully, but a tenant whose *requests are pathological* (poison payloads, pathological parameters — Ch06 f05's poison-event class generalized) needs isolation, not fair sharing — automated demotion to a quarantine shard/queue on anomaly signals, with the false-positive path (appeal, restore) designed because quarantine without exit is an outage for that tenant.

## 2. Dominant-Resource Sharing, Worked

Single-resource fair sharing mis-prices multi-resource work: with 90 CPU + 180 GB total, tenant A's tasks need ⟨1 CPU, 4 GB⟩ and tenant B's ⟨3 CPU, 1 GB⟩. A's dominant resource is memory (4/180 = 2.2% per task), B's is CPU (3/90 = 3.3% per task); DRF equalizes dominant shares — allocating ⟨30 tasks A, 20 tasks B⟩ so each holds ≈67% of its dominant resource (A: 120/180 GB; B: 60/90 CPU) — where "equal CPU" would starve A's memory-bound work and "equal task counts" would let B monopolize CPU. The transplant this chapter needs: the same arithmetic governs *any* pool where work classes stress different axes — request threads vs connection slots vs bandwidth at a gateway, and (file 09) prefill FLOPs vs KV-cache bytes vs decode slots on an inference fleet, where "fair by request count" hands the GPU to whoever sends the longest prompts. Envelope (standard 7): DRF assumes divisible resources and demand honesty *about ratios* (strategy-proofness covers quantity, not shape); discrete large-grain work (one giant task = the whole node) and adversarially shaped demand vectors push toward the ladder's structural rungs (sharding, dedication) rather than finer arithmetic.

## 3. The Worked Instance — API Priority and Fairness

Kubernetes' API server flow control (APF, GA v1.29) assembles this chapter's parts into one running design and is worth reading as a reference implementation: requests are classified into **priority levels** (control-plane state: FlowSchemas match requests to levels — file 04's criticality, formalized) with *separate concurrency budgets per level* (so system-critical traffic cannot be starved by workload traffic — bulkheads, not one pool); within a level, requests are partitioned into **flows** (by user/namespace — the tenant key) and admitted by **shuffle sharding across queues** plus fair dequeuing, so one flooding controller degrades its own flow and little else ([Kubernetes docs](https://kubernetes.io/docs/concepts/cluster-administration/flow-control/)). The design decisions to steal: classification is *declarative and versioned* (not code); exempt traffic is explicit and enumerated (the fail-open list, Ch07 f08's discipline); per-level bounded queues with rejection (429) beyond them; and the whole mechanism ships with its own SLIs (queue depth, dispatch latency, reject counts per level/flow) — the observability this chapter's file 10 demands, built in rather than bolted on.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Ladder gate | Per shared resource: the rung chosen, with the one-bad-tenant cost quantified at that rung | Shared FIFOs discovered under a noisy neighbor; isolation asserted without the overlap/HOL math |
| DRF gate | Multi-resource pools shared by dominant-resource arithmetic (or explicitly by a simpler policy with the mis-pricing accepted in writing) | Request-count fairness on workloads with wildly different resource shapes |
| Weight-governance gate | Fair-share weights and flow keys as versioned control-plane policy, keyed by credential-derived tenant | Weights in code; flow keys the client chooses; tier changes requiring deploys |
| Quarantine gate | Anomaly-triggered demotion path with bounded blast radius and a designed restore/appeal path | Poison tenants fairly sharing everyone's queue; quarantine as a permanent oubliette |
| Instance gate | The system's own APF-analogue documented: levels, flows, per-level budgets, shuffle parameters, and the built-in SLIs | Fairness machinery whose behavior under flood has never been stated, let alone drilled (W5) |

## Output

The output of this file is an isolation design chosen per shared resource from an explicit ladder — fair-queued drains where sharing is safe, shuffle-sharded footprints where blast radius must shrink combinatorially, dedication where the quota is the capacity — with multi-resource pools shared by dominant-resource arithmetic, weights governed as policy, pathological tenants quarantined with an exit, and the whole mechanism carrying its own flood-tested SLIs.

## References

- [Ghodsi et al., "Dominant Resource Fairness: Fair Allocation of Multiple Resource Types" (NSDI 2011)](https://www.usenix.org/conference/nsdi11/dominant-resource-fairness-fair-allocation-multiple-resource-types)
- [AWS Builders' Library, "Workload isolation using shuffle-sharding" — the combinatorial blast-radius argument](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)
- [AWS Builders' Library, "Fairness in multi-tenant systems"](https://aws.amazon.com/builders-library/fairness-in-multi-tenant-systems/)
- [Kubernetes — API Priority and Fairness (GA v1.29): the assembled reference instance](https://kubernetes.io/docs/concepts/cluster-administration/flow-control/)
