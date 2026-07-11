# Blast Radius and Failure Isolation

## Abstract

Once a fault becomes a failure (file 01), the only remaining reliability lever is *how much fails with it* — the blast radius — and this file is the arithmetic of making that number small by construction. The governing insight is that redundancy alone does not bound blast radius; **isolation** does: a hundred redundant workers behind one shared load balancer, one connection pool, or one config are a single failure domain with a hundred-way-redundant illusion, and the fault that takes the shared thing takes all hundred. Bounding blast radius means partitioning the system into **cells** — independent, complete, fixed-maximum-size replicas of the service, each serving a subset of traffic, sharing *nothing* on the request path — so a fault (a bad row, a poison request, a hot key, a memory leak) is contained to one cell and the availability floor becomes **1 − 1/N** for N cells rather than zero ([AWS Well-Architected, cell-based architecture](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html): with 10 cells, a single-cell failure caps user impact at 10%). Two refinements sharpen the tool. **Bulkheads** (from ship design via [Nygard, *Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/)) isolate resource pools *within* a service — separate thread pools, connection pools, and queues per dependency or tenant class — so one saturated dependency cannot consume the resources the others need (the Ch09 admission concern applied as a containment boundary). **Shuffle sharding** ([AWS Builders' Library](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)) is the combinatorial upgrade to cells: by assigning each customer a *random subset* of workers rather than a fixed partition, the number of distinct shard-combinations explodes, so two customers almost never share a full shard and a poison-input fault that kills its shard's workers isolates to a vanishingly small fraction of customers — the worked combinatorics below show why 8 workers chosen 2-at-a-time from 100 already isolates a bad actor to ~0.02% of a large customer base. The chapter's synthesis: blast radius is a *design-time* number you compute from your partitioning, not a runtime surprise you measure after the outage — and static stability (file 04's cousin) is what keeps the cells serving when the thing that assigns traffic to them is itself failing.

## 1. The Blast-Radius Ladder

```text
Figure 1. Isolation boundaries, coarse to fine, with the fraction
of the system a single contained fault can take down at each level.

  boundary          shared on request path     blast per fault
  ────────────────  ─────────────────────────  ───────────────
  none (1 domain)   everything                  100%
  availability zone AZ power/network            1 / #AZ  (~33%)
  region            control plane, config       1 / #region
  CELL              nothing (complete replica)   1 / #cells
  shuffle shard     random worker subset         ≪ 1 / #cells
  bulkhead (intra)  pool per dependency/tenant   1 dependency's pool
  request/session   nothing beyond itself        1 request

  Rule: the blast radius of a fault equals the size of the SMALLEST
  boundary that fully contains it. A fault that escapes to a shared
  dependency inherits THAT dependency's blast radius, however well
  the callers were partitioned (the hidden-shared-domain trap, f09).
```

The ladder's discipline: for each fault class (file 01 §3), name the boundary that contains it, and verify the boundary shares *nothing* on the hot path — because containment is only as good as the least-isolated shared resource. The most common blast-radius bug is not absent isolation but *leaked* isolation: perfectly celled request paths that all reach one shared metadata store, so the store's failure is regional despite the cells. This is why the cell definition is strict — *complete and independent* — and why file 09 audits for the shared domains that quietly re-merge the cells.

## 2. Cells — The Unit of Containment

A cell is a full, self-sufficient instance of the service (its own compute, its own data partition, its own caches) sized to a **fixed maximum**; growth is handled by adding cells, never by growing a cell past its tested ceiling. Three properties make cells the workhorse of blast-radius control:

- **Bounded blast radius**: a fault confined to a cell affects ≤ 1/N of traffic. With N=10, worst-case user impact is 10%; the availability arithmetic (file 09) turns this into a concrete floor.
- **Bounded operational scope**: a cell's fixed size caps the resource pool an operator must reason about during an incident, lowering MTTR (file 02) — a database restore of 1/N of the data is N× faster, and a poison-input blast that wipes a cell's state loses 1/N of users, not all of them.
- **Independent deployment (file 07)**: cells are the natural canary unit — deploy to one cell, watch its SLIs, proceed; a bad deploy is contained to the cell it landed on, converting the highest-blast-radius fault class (deployment regression) into a 1/N event.

The hard part is the **cell router** — the thin layer that maps a request to its cell. It must be far simpler and more available than the cells themselves (it is now a shared dependency of all of them), which is why it is kept to stateless, static-mapping logic (hash of tenant → cell) with no per-request calls to anything stateful, and why its own failure mode is the one to design against hardest: a smart, stateful router is a single point of failure wearing a cell architecture as a disguise.

## 3. Shuffle Sharding — Combinatorial Isolation

Fixed partitioning (customer → cell) still lets one customer's poison input take down every other customer *in the same cell*. Shuffle sharding breaks this by giving each customer a *randomly chosen subset* of workers, so two customers rarely share their full subset. The isolation is combinatorial:

```text
Figure 2. Shuffle-sharding arithmetic. n workers, shard size k.
Distinct shards = C(n, k). Overlap probability drops fast.

  With n = 100 workers, shard size k = 2:
    distinct shards C(100,2) = 4,950
    a fault that kills one customer's 2 workers fully overlaps
    another customer only if that customer drew the SAME 2:
    P(full overlap) = 1 / C(100,2) ≈ 0.0002 = 0.02%

  With n = 100, k = 5:
    distinct shards C(100,5) = 75,287,520
    P(two customers share all 5) ≈ 1.3 × 10⁻⁸

  Effect: a poison-input fault that takes down its shard isolates
  the fault to the customers whose shard it fully covers — a tiny
  fraction — while everyone else, sharing at most k−1 workers,
  keeps serving on their remaining workers (with graceful
  degradation, f05, over the survivors).
```

The critical pairing: shuffle sharding **requires** graceful degradation on the client side (file 05) to realize its benefit — a customer who loses 2 of their 5 workers must retry onto the surviving 3, or the partial overlap becomes a full outage for them. Shuffle sharding bounds *who* is affected; client-side degradation bounds *how badly*. Together they convert a fault that would be an N-customer outage into a sub-1% event that most customers never notice — which is why AWS uses it under Route 53 and other multi-tenant control planes where one abusive or malformed workload must not become everyone's outage.

## 4. Static Stability — Isolation That Survives the Isolator

Cells and shards are assigned by a control plane (Ch02), and the failure that embarrasses a blast-radius design is the *control plane itself* failing — the router that maps requests to cells, the system that rebalances shards. **Static stability** (Ch02 file 04's principle, invoked here as an isolation property) is the requirement that the data plane keeps serving on its *last known assignment* when the control plane is unavailable: cells continue serving their existing traffic without needing the router to be healthy, shards keep their current worker assignments without needing the rebalancer. The anti-pattern this forbids is a blast-radius architecture whose containment *depends on* a healthy control plane — because then a control-plane failure (a correlated, high-blast domain, file 09) unwinds every cell boundary at once, which is the shape of the largest cloud outages (the assignment layer fails, and the isolation it was maintaining fails with it). Isolation must be a property the data plane holds *statically*, not one the control plane must be alive to enforce.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Boundary gate | Each fault class mapped to the smallest boundary that fully contains it; no shared hot-path resource inside a boundary | Redundancy mistaken for isolation; celled paths reaching one shared store (leaked isolation) |
| Cell gate | Cells complete, independent, fixed-max-size; blast radius = 1/N stated; router simple, stateless, more available than cells | Cells sharing state; unbounded-size cells; a smart stateful router as hidden SPOF |
| Shuffle-shard gate | Where multi-tenant poison inputs threaten, shuffle sharding with computed overlap probability + client-side degradation over survivors | Fixed partitioning letting one tenant sink a whole cell; shuffle sharding without survivor-retry |
| Static-stability gate | Isolation holds on last-known assignment when the control plane is down; no containment that requires a healthy router/rebalancer | Blast-radius design that unwinds when the assignment layer fails — the largest-outage shape |
| Blast-arithmetic gate | Blast radius per fault class computed at design time from the partitioning, not measured post-incident | "How much would fail" unknown until the outage answers it |

## Output

The output of this file is a blast-radius design computed at design time: fault classes mapped to isolation boundaries that share nothing on the hot path, cells as fixed-size complete replicas giving a 1/N availability floor and a 1/N canary unit, shuffle sharding as the combinatorial upgrade that isolates multi-tenant poison inputs to a sub-percent fraction, and static stability ensuring the isolation survives the control plane that assigns it. Blast radius stops being a post-incident measurement and becomes a number the architecture guarantees — the input file 09 composes into a system availability figure.

## References

- [AWS Well-Architected — Reducing the Scope of Impact with Cell-Based Architecture](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html)
- [AWS Builders' Library — "Workload Isolation Using Shuffle-Sharding"](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)
- [AWS Builders' Library — "Static Stability Using Availability Zones"](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/)
- [Nygard, *Release It!* (2nd ed.) — Bulkhead and Circuit Breaker stability patterns](https://pragprog.com/titles/mnee2/release-it-second-edition/)
