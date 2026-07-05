# Consensus and Coordination Services

## Abstract

Consensus is the mechanism that makes a group of machines act as one authority — the single arbiter Chapter 03 file 01 demanded for authority transfer and Chapter 03 file 04 demanded for correctness-grade locks. This file specifies what consensus actually buys (a replicated log with a single total order, from which leader election, fencing epochs, and linearizable state machines all derive), the Raft mechanics that made the property implementable by mortals ([Ongaro & Ousterhout](https://raft.github.io/raft.pdf) — designed explicitly for understandability after a decade of Paxos being correctly specified and incorrectly implemented), and the discipline for operating coordination services, whose defining risk is not subtlety but blast radius: when everything routes its authority questions through one consensus cluster, that cluster is the system's availability, as Roblox demonstrated for 73 hours when Consul — serving as service discovery, health checking, *and* feature-flag store — degraded under a streaming-feature contention bug plus a BoltDB pathology, and everything above it went down together ([Roblox postmortem](https://about.roblox.com/newsroom/2022/01/roblox-return-to-service-10-28-10-31-2021)).

The plane placement is inherited and non-negotiable: consensus is control-plane machinery (Chapter 02). Its throughput is precious, its latency is a quorum round-trip, and every data-plane request that transits it is a category error with an availability bill.

## 1. What Consensus Buys

One primitive, many derivatives:

```text
replicated log with single total order (majority-acknowledged)
  ├─► leader election        one leader per term/epoch — the
  │                          arbiter of Ch03 f01 §4.3
  ├─► fencing epochs         monotonic term numbers — the tokens
  │                          of Ch03 f04 §1, minted here
  ├─► linearizable KV        apply the log to a state machine →
  │                          configuration, locks, membership
  └─► membership + failure   who is in the cluster, decided BY
      detection as agreement the cluster, not by each observer
```

The availability arithmetic that governs everything else: a consensus group of `2f+1` members tolerates `f` failures — 3 nodes tolerate 1, 5 tolerate 2 — and *requires a majority to make progress*. Below majority, the group is unavailable *by design*: consensus chooses consistency under partition (the PC branch of Chapter 03 file 02's PACELC), which is precisely why it is the right home for authority and precisely why it must never sit on a path that needs availability-under-partition instead.

## 2. Raft, at Review Altitude

The three mechanisms a reviewer must be able to check, per [the paper](https://raft.github.io/raft.pdf):

| Mechanism | What It Guarantees | The Review Checkpoint |
|---|---|---|
| Leader election (randomized timeouts, term numbers) | At most one leader per term; stale leaders are fenced by term arithmetic | Election timeout vs network RTT: too tight → spurious elections under load (availability flaps); too loose → slow failover. This ratio is *configuration with SLI standing* |
| Log replication (leader appends, majority ack, commit index) | Committed entries survive any `f` failures; followers converge on the leader's log | Commit ≠ applied: state-machine apply lag is its own metric; a linearizable read served from an un-applied node is not linearizable |
| Safety (election restriction: only up-to-date candidates win) | A new leader holds every committed entry — the §1 rung enforcement Chapter 03's transfer protocol needed | Snapshotting/log compaction configured — an unbounded Raft log is the Roblox BoltDB lesson wearing its cause openly |

Linearizable reads have three implementations with different prices — log-entry reads (a quorum round per read), leader leases (fast, but correct only within clock-error bounds), and read-index (the middle path) — and which one the deployment uses is a dossier field, because "we read from the leader" alone does not deliver linearizability after a partition strands an old leader with a lease.

## 3. The Coordination Service

etcd, ZooKeeper, Consul-class systems are consensus wrapped in a convenience API — and convenience is the risk. What starts as "leader election for the scheduler" accretes service discovery, health checks, distributed locks, feature flags, and small hot KV state, until the coordination service is a shared dependency of every plane — Chapter 02 file 07's anti-pattern register, rows 5 and 7, assembled voluntarily.

```text
Figure 1. The accretion failure mode (the Roblox shape). Each
tenant added to the coordination cluster was individually
reasonable; the union made one Raft group the availability
ceiling of the entire platform — and its own management plane.

          scheduler election      service discovery
                    \               /
   feature flags ──► [ one consensus cluster ] ◄── health checks
                    /               \
          lock service            hot KV / config
                                       │
   load grows with fleet × features ───┘
   ► streaming feature + BoltDB freelist pathology → CPU collapse
   ► leader elections thrash under the load they must arbitrate
   ► discovery down ⇒ everything down ⇒ tooling to fix it down too
     (73 hours; Ch02 f01's management-plane rule, violated by accretion)
```

The operating discipline:

| Rule | Rationale |
|---|---|
| Tenant inventory with admission control | Every consumer of the coordination service is registered with its read/write rate; new tenants are capacity decisions, not library imports |
| Watch/streaming fanout is the scaling hazard | N watchers × M keys of change notification is the load class that has felled every major coordination service; fanout budgets are explicit |
| Data-plane requests never transit consensus | Discovery results, flags, and configuration are *cached locally with LKG* (Ch02 file 04's static stability); the coordination service is the source of changes, not the per-request answer |
| The coordination service gets its own Ch03 treatment | Its data has retention, its snapshots have restore drills, its log store's pathologies (BoltDB's non-shrinking freelist) are known and monitored |
| Blast-radius partitioning | Independent concerns get independent consensus groups (or lease-scoped namespaces with quotas) once the tenant inventory crosses the one-cluster comfort line — which it will |
| Its management plane is independent | Fixing the coordination service must not require the coordination service (Roblox's tooling dependency; Ch02 file 07 §1's direction rule) |

## 4. What Does Not Need Consensus

The inverse list matters as much, because consensus overuse is a latency and availability tax paid continuously. Monotonic/CALM-safe state (Ch03 file 04 §3) needs no ordering authority; single-node-owned state needs no distributed agreement about itself; high-rate data-plane writes belong in the file 01 topologies, with consensus reserved for their *membership and leadership* metadata; and approximate answers (service discovery that is seconds stale, membership by gossip) are often contractually sufficient — the Chapter 03 file 02 discipline of buying only the consistency an invariant needs applies to coordination hardest of all, because here the strong option is the expensive one *and* the fragile one under load.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Placement gate | Everything consensus-backed is control-plane; no data-plane request path transits a consensus round | Per-request discovery/lock/flag reads against the coordination cluster |
| Sizing gate | Group size (2f+1) matches the failure model; election timeouts justified against measured RTT; apply-lag and log-compaction monitored | Defaults everywhere; unbounded log growth; elections thrash under load |
| Read gate | Linearizable-read implementation named (log/lease/read-index) with its clock assumptions | "Reads go to the leader" as the entire linearizability story |
| Tenant gate | Coordination-service tenant inventory with rates, watch-fanout budgets, and admission | Accretion by convenience; the Roblox union assembled one import at a time |
| Independence gate | The coordination service's recovery path and management tooling do not depend on the coordination service | The 73-hour shape: the fix requires the thing being fixed |

## Output

The output of this file is a consensus layout with boundaries: consensus deployed exactly where a single authority is contractually required, sized and tuned against its measured environment, wrapped in a coordination service whose tenants are inventoried and whose blast radius is partitioned — and kept off every path that merely wanted a fast answer rather than an agreed one.

## References

- [Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm" (Raft)](https://raft.github.io/raft.pdf)
- [Roblox — Return to Service: the October 2021 73-hour outage postmortem](https://about.roblox.com/newsroom/2022/01/roblox-return-to-service-10-28-10-31-2021)
- [Kleppmann, *DDIA* — consistency and consensus](https://dataintensive.net/)
- [etcd documentation — tuning, snapshots, and operational limits](https://etcd.io/docs/latest/op-guide/)
- [Chapter 02 — static stability and the coupled-domain register the coordination service must obey](../02-control-plane-and-data-plane-separation/README.md)
