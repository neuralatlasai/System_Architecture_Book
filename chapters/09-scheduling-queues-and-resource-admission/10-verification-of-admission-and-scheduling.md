# Verification of Admission and Scheduling

## Abstract

Admission machinery has the cruelest verification profile in this book: it is *only* exercised by the conditions it exists to survive, so an untested shedding path is best assumed absent, an unmeasured goodput curve is best assumed collapsing, and a load test that self-throttles (closed-loop) certifies nothing about the open-loop internet. This file is the chapter's evidence machinery: ten drills (W1–W10) converting each file's gates into falsifiable experiments — with the **open-loop generation requirement** stated once and binding all of them (offered load must be independent of system response, or the test hides the cliff it exists to find: file 02 §1's envelope condition, made procedural) — the admission SLI set that watches the same promises between drills, and the evidence-stamp discipline from Chapter 01 file 11 with this chapter's invalidator: every result carries a **load-model stamp** `{workload mix + arrival process (measured C_a², request-cost distribution), capacity generation (fleet size/HW), limit & policy config versions, dependency topology}` — a goodput curve measured against last quarter's traffic shape or fleet is last quarter's evidence, and capacity-affecting changes (fleet resize, engine upgrade, new heavy work class) reset it to *assumed*.

## 1. The Drill Catalog

```text
Figure 1. The evidence loop. The destructive majority of this
catalog runs in load environments on a calendar; the standing
minority (W4 inventory scan, W8 SLI conformance) lives in CI.
Any load-model stamp change resets dependent evidence.

  drill Wn ──► evidence {claim, class: tested, date, load-model
      ▲                  stamp}
      │             stamp change (traffic shape, fleet, config,
      │             topology) → dependent evidence → assumed
      └── recalibrate: stamps force re-drilling to track reality
```

| Drill | Hypothesis under test | Procedure / fault injected | Pass condition | Cadence |
|---|---|---|---|---|
| W1 Goodput curve | Goodput ≈ μ past saturation (file 01 §2) | Open-loop load ramp to ≥2× capacity; plot completed-within-deadline vs offered | The flat line; rejections cheap and early; no collapse shape | Quarterly + per capacity-generation change |
| W2 Degradation ladder | Brownout rungs recover stated capacity in order (file 04 §1) | Trigger each rung under load; measure capacity recovered and quality delta | Rungs fire in order, recover ≈ their priced capacity, re-enable cleanly | Semi-annual game day |
| W3 Storm and exit | The congestive-collapse exit sequence works (file 08 §2) | Induce a retry storm (fault a dependency at load, disable client budgets in the test cohort); execute stop-multiplier → dump-dead → ramped re-admission | Collapse reproduced, then exited by procedure; pause controls worked; time-to-goodput recorded | Annual, load environment, full sequence |
| W4 Queue inventory | Every buffer in the path answers file 03's questions | Mechanical scan: pools, accept queues, executors, brokers, batch buffers vs the dossier inventory | No unlisted queue; each has bound, discipline, full-behavior, and the four SLIs | Standing, CI/config audit |
| W5 Fairness flood | One tenant cannot degrade others past the declared bound (file 06) | Single-tenant flood at N× fair share against a production-shaped background | Other tenants' p99 within declared degradation; flow isolation and (if present) shuffle math hold; quarantine triggers where configured | Quarterly |
| W6 Priority truth | Classes mean what the policy says (file 07) | Class-mix measurement (inflation check); critical-path inversion walk (pools, locks, partitions); saturated-load class latency separation | Top class ≤ provisioned line; no inversion on the walked path; classes separate under saturation | Per quarter (mix) + per architecture change (walk) |
| W7 AI saturation | Iteration scheduler holds SLO-goodput under overload (file 09) | Open-loop token-workload ramp: long-prompt floods, KV pressure, mid-stream disconnects | TTFT/TPOT per class within SLO to the declared load; eviction economics as priced; disconnected sequences culled | Quarterly + per engine/model-class change |
| W8 SLI conformance | The §2 set exists and alarms (all files) | Synthetic violations per SLI (stand a queue, expire work, starve a class) | Every SLI fires its alarm with the declared budget line attached | Standing, synthetic |
| W9 Limiter honesty | Limits enforce r/b within stated accuracy; fail open (file 05) | Burst/sustain probes at and past limits per topology; kill the central store mid-load | Accuracy within the declared bound; 429s carry computed Retry-After; store outage ≠ API outage | Per limiter-topology change + semi-annual |
| W10 Feasibility and expiry | Doomed work is refused or dropped, never executed (files 03/07) | Inject expired-deadline and infeasible-deadline traffic at load | Zero expired executions; infeasible work rejected at admission with honest signals | Standing, synthetic |

## 2. The Admission SLI Set

| SLI | Definition | What it catches |
|---|---|---|
| Goodput vs throughput, per class | Completed-within-usefulness ÷ completed | The collapse signature (gap opening) between W1 runs |
| Utilization vs derived ceiling | ρ per resource against the file 02 §2 inverted-SLO target | Headroom erosion — the latency SLO being sold off a point at a time |
| Queue depth / sojourn / drops-by-reason / drain headroom | File 03's four, per inventoried queue | Standing queues (sojourn) that depth misses; the sign of μ−λ |
| Shed rate by criticality class | Rejections per class per cause | Uniform shedding; the ladder not being consumed bottom-up |
| Retry fraction and λ_eff/λ | Observed retries ÷ first attempts; the effective multiplier | The endogenous feedback loop trending toward its bad solution |
| Limit rejection rate + accuracy drift | 429s per principal; enforced rate vs configured r | Fleet-size drift doubling effective limits; limiter decay |
| Class mix (priority inflation) | Share of traffic per priority class, trended | The top class swelling toward FIFO-with-extra-steps |
| Tenant p99 spread under load | Per-tenant latency distribution at the same offered load | Noisy neighbors inside the quota envelope |
| Expired-at-dequeue count | Work dropped for deadline expiry (and the executions it replaced) | The cheapest goodput intervention, verified working |
| TTFT/TPOT per class + eviction rate (AI) | The file 09 split + KV preemption frequency | Frontier-position drift; capacity bugs surfacing as scheduling churn |

The standing rules carried from Chapters 06–08: alert on derivatives and ratios (retry fraction rising, headroom shrinking, mix inflating), slice per class and tenant before averaging, and print the declared contract (bound, ceiling, budget) on the dashboard beside its measurement.

## 3. Evidence Classes and the Load-Model Stamp

Chapter 01 file 11's taxonomy applies — *tested* (a drill above, dated), *observed* (standing SLIs over a stated window), *assumed* (declared, expiring) — with the load-model stamp's reset rules doing the work: a traffic-shape change (new heavy endpoint, agent traffic arriving, C_a² regime shift) resets W1/W5/W7; a fleet or engine change resets W1/W7/W9; a policy/limit config change resets W6/W9/W10; a topology change (new dependency, disaggregation adopted) resets W3 and the composition walk. The posture note this chapter adds to the book's verification discipline: **most of this catalog is destructive and load-environment-bound** — the standing/CI share is smaller than Chapter 07's or 08's, which raises the premium on the SLI set (§2) as the between-drills sentinel and makes stamp-honesty (knowing when evidence expired) the difference between a dossier and a scrapbook.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Open-loop gate | All load drills generated open-loop; the generator's independence from response latency demonstrated | Closed-loop tests certifying cliff-free behavior the internet will falsify |
| Coverage gate | W1–W10 mapped to every admission surface, queue, limiter, and scheduler in the dossier; gaps declared *assumed* with expiry | Shedding paths never exercised; "the limiter works" as folklore |
| Destructive-rehearsal gate | W2/W3/W5/W7 executed in production-shaped load environments; the W3 exit sequence timed | The collapse exit performed first in production; game days that skip the ugly drills |
| Stamp gate | Evidence carries the load-model stamp; stamp-field changes reset dependent evidence; the dossier refuses stale stamps | Goodput curves from a smaller fleet and a gentler traffic mix, still cited |
| SLI gate | The §2 set implemented per class/tenant/queue with contract lines on dashboards; W8 conformance standing | Blended averages; alarms on raw counts; measurements without their budgets |

## Output

The output of this file is the chapter's evidence base: ten drills — goodput curves, degradation ladders, storm exits, queue inventories, fairness floods, priority truth, AI saturation, SLI conformance, limiter honesty, and expiry enforcement — generated open-loop because the closed-loop lie is this domain's signature verification failure, watched between drills by an SLI set built on ratios and contract lines, and bound to a load-model stamp that retires evidence the moment the traffic, fleet, or policy it certified stops existing.

## References

- [Brooker, "Open and Closed, Omission and Collapse" — why the generation model is the drill's first correctness condition](https://brooker.co.za/blog/2023/05/10/open-closed.html)
- [Principles of Chaos Engineering — hypothesis-driven fault injection (W2/W3/W5's method)](https://principlesofchaos.org/)
- [Google SRE Workbook — implementing SLOs (the contract-line discipline)](https://sre.google/workbook/implementing-slos/)
- [Google SRE Book, "Addressing Cascading Failures" — the storm-drill rationale](https://sre.google/sre-book/addressing-cascading-failures/)
