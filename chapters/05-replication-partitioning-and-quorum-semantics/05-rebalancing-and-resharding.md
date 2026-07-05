# Rebalancing and Resharding

## Abstract

Rebalancing moves partitions between machines; resharding changes the partition boundaries themselves — and both are Chapter 03 file 07's migration discipline executed against live traffic, with the partition map as the schema being migrated. This file specifies the movement budget (rebalancing competes with serving for I/O, network, and cache warmth, so it is admission-controlled background work in the Chapter 04 file 02 sense), the shard-count arithmetic that decides whether future rebalancing is cheap partition-movement or expensive boundary-surgery (Notion's 480-logical-shards-on-32-hosts choice — divisible by 2,3,4,5,6,8,10… — is shard-count design done in advance of the need; [sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion)), and the live-resharding protocol whose production reference is Vitess's VReplication: copy the new shards from a snapshot, tail the source's changes to convergence, verify row-for-row, then cut over ownership with a fenced, reversible switch ([Vitess resharding](https://vitess.io/docs/faq/sharding/overview/what-is-resharding-how-does-it-work/)).

The blunt framing: a sharded system that cannot reshard has a expiration date it hasn't computed, and a resharding executed without the migration gates is the GitHub-2018 dual-authority window scheduled deliberately across every key that moves.

## 1. Two Operations, One Discipline

| Operation | What Changes | Cost Driver | Cadence |
|---|---|---|---|
| Rebalancing | partition→host assignment (the map's placement column) | Data movement + cache re-warming on the destination | Routine: membership change, load skew, hardware refresh |
| Resharding | The partition boundaries (split/merge; the map's key column) | Everything rebalancing costs, plus dual-write/backfill/cutover per affected key range | Rare: shard-count exhaustion, giant-key extraction, scheme change |

The design goal is to make the first cheap enough to be boring and the second rare enough to be a project. Fixed-partition-count designs (file 04 §2) achieve exactly this split: create enough logical partitions up front that growth is absorbed by *moving* them for years, and boundary surgery is deferred until the count itself is exhausted.

## 2. Shard-Count Arithmetic

The number chosen at sharding time is a bet on the system's whole future, and it has real math:

```text
Figure 1. Shard-count design space. Too few: each shard grows
monolith-sized and every future move is heavy. Too many: per-shard
overhead (connections, files, replication streams, map entries)
dominates. The escape: pick a highly divisible count with headroom.

  count too low ◄──────────────────────────► count too high
  shard size → monolith            per-shard overhead × N
  moves are heavy                  connection pools explode
  hot shard = big blast radius     map + metadata bloat

  Notion's instrument: 480 logical shards / 32 physical hosts
  480 = 2^5 × 3 × 5 → divisible by 2,3,4,5,6,8,10,12,15,16,20,24,30,32,40,48…
  → rescale 32 → 40 → 48 hosts by MOVING whole shards,
    never splitting one, with uniform shards-per-host at each step
```

Sizing inputs the dossier must show: projected keyspace growth (Ch01 file 02's growth model) against per-shard size ceilings (restore time — Ch03 file 08's RTO is per shard; move time; the engine's comfortable working set); per-shard fixed overhead × count against fleet capacity; and the divisibility/headroom argument for the specific number. A shard count chosen as "one per current host" fails this gate by construction.

## 3. The Movement Budget

Rebalancing is load. Untreated, it is *correlated* load — triggered by the same membership changes and failures that already stressed the system, which is how rebalancing storms turn one node's failure into a fleet-wide latency event (the Chapter 02 file 07 feedback-loop table, row "autoscaler thrash," with data gravity added).

| Budget Line | Control |
|---|---|
| Throughput cap | Bytes/sec and concurrent-movements ceilings, admission-controlled like any background work (Ch04 f02 §5) |
| Trigger dampening | Hysteresis on load-based rebalancing; failure-triggered re-replication distinguished from optimization-triggered movement — the first is urgent, the second waits out the incident |
| Destination warm-up | A moved partition arrives with cold caches; traffic shifts gradually (weighted routing) rather than at map-flip |
| Priority | Serving > re-replication (restoring redundancy) > optimization; a rebalancer that competes evenly with serving has its priorities exactly inverted |
| Blast-radius cap | Max fraction of fleet's partitions in motion at once (Ch02 f02 §2.2's reconciler cap, applied to the balancer — the balancer IS a reconciler) |

## 4. Live Resharding Protocol

The VReplication shape, generalized — each phase mapping onto the Chapter 03 file 07 expand/contract machine:

```text
Figure 2. Live shard split. The source serves throughout; the
cutover is the only authority transfer, and it is fenced and
reversible.

  phase          mechanism                          gate to advance
  ─────          ─────────                          ───────────────
  1 PROVISION    create target shards -80,80-       targets healthy
    (expand)     from source snapshot
  2 CLONE        consistent copy source→targets     copy complete,
                 (per-key-range, throttled §3)      checksums match
  3 TAIL         apply source's ongoing changes     replication lag
                 (CDC/binlog) to targets            ≈ 0, sustained
  4 VERIFY       row-count + content comparison     diff = 0 on full
                 while tailing (Ch03 f07's           + sampled compare
                 shadow-comparison gate)
  5 CUTOVER      map epoch bump: writes fence at    wrong-owner rate
                 source, drain in-flight, flip      → 0; reverse
                 ownership, unfence at targets      replication armed
                 (Ch03 f01 §4: fence FIRST)
  6 REVERSE      source now tails targets —         stability window
                 rollback = flip back               elapsed
  7 CONTRACT     decommission source ranges         read telemetry
                                                    silence (Ch03 f07)
```

The two details that separate this from a hopeful script: **cutover is an authority transfer with all four Chapter 03 file 01 §4 conditions** — fencing before the new owners accept writes (map epoch enforcement, file 04 §3), new owners provably caught up (phase 3's lag gate), one arbiter (the map's single writer), ambiguity semantics for requests in flight at the flip; and **reverse replication is armed before cutover, not after trouble** — rollback from a resharding that has taken writes is only possible if the old shards have been *following* the new ones from the first post-cutover write.

## 5. Skew-Triggered Surgery

The unplanned resharding: the giant key (Ch04 file 01's Discord channel, the whale tenant) outgrows every strategy short of boundary change. The surgical options, in escalation order: split the range around the hot key (range schemes — cheap if the map supports arbitrary boundaries); extract the key to a directory-pinned dedicated shard (file 04 §1's directory override — the giant gets its own hardware and its own blast radius, per Ch01 file 03's isolation logic); and salt/sub-shard the key itself with fan-in reads (the last resort, because it moves complexity into every reader forever). The review requirement is not choosing early — it is that the map machinery *supports* the chosen escalation before the whale arrives, because boundary surgery invented during the incident inherits none of §4's gates.

## 6. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Count gate | Shard-count arithmetic shown: growth projection, per-shard ceilings (incl. restore time), overhead × count, divisibility headroom | Count = current host count, or chosen without arithmetic |
| Budget gate | Movement throughput caps, priority ordering, trigger hysteresis, in-motion blast-radius cap | Rebalancing storms possible; re-replication competes with serving unprioritized |
| Protocol gate | Resharding follows the seven phases with per-phase gates; cutover satisfies all four authority-transfer conditions | Cutover without fencing, verification, or armed reverse replication |
| Reversibility gate | Rollback demonstrated from post-cutover state (reverse replication live), not just asserted | The only path back is restore-from-backup |
| Whale gate | The giant-key escalation path is supported by the map machinery today | Boundary surgery would be invented during the incident that demands it |

## Output

The output of this file is elasticity with receipts: a shard count computed for a decade rather than a quarter, movement that is admission-controlled background work with priorities and caps, resharding as a seven-phase fenced migration with rollback armed before cutover, and a pre-built escalation path for the whale key that every partitioned system eventually meets.

## References

- [Notion — Herding Elephants: Sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion)
- [Vitess — Resharding and VReplication](https://vitess.io/docs/faq/sharding/overview/what-is-resharding-how-does-it-work/)
- [Karger et al., consistent hashing — the movement bound rebalancing relies on](https://dl.acm.org/doi/10.1145/258533.258660)
- [Discord — the hot-partition surgery this file's whale gate anticipates](https://discord.com/blog/how-discord-stores-trillions-of-messages)
- [Chapter 03 file 07 — the migration matrix resharding instantiates](../03-state-ownership-and-consistency-model/07-schema-evolution-and-migration.md)
