# Backlogs, Retry Storms, and Recovery

## Abstract

This file owns the failure mechanics: how queues and retries convert partial degradation into sustained collapse, and the arithmetic of getting back out. The backlog law is division: a backlog B drains in **B/(μ−λ)** — the denominator is *headroom*, not capacity — so a queue that absorbed one hour of λ=0.95μ traffic during a downstream outage holds 0.95μ·3600 items and drains, at the same λ, in 0.95·3600/0.05 ≈ **19 hours**: the outage was one hour; the *degradation* is a day, unless drain capacity is surged or the backlog is triaged (dropped, deprioritized, or sideline-queued — the [AWS backlog article's](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/) core repertoire, and Chapter 06 file 09's recovery-multiplier law arriving from the queue side). The storm law is multiplication: retries are arrival-rate multipliers correlated with exactly the moments capacity is short (Ch07 f03's 27×; file 02 §3's endogenous-λ feedback), and the collapse they sustain — load high enough that all capacity churns on timeouts, retries, and connection setup, with zero goodput, *persisting after the trigger clears* — is **congestive collapse**, the queueing instance of the metastable failure class (Bronson et al.). The incident-mechanism corpus (this chapter's named-postmortem table) shows the same shape across a decade: the [2015 DynamoDB metadata storm](https://aws.amazon.com/message/5467D2/) (storage servers timing out on grown membership requests, retrying, self-disqualifying, and re-retrying — until AWS *paused the request source* to let the service breathe) and the [October 2025 US-East-1 event](https://aws.amazon.com/message/101925/) (a DNS automation defect emptied DynamoDB's endpoint record; the recovery itself then drove congestive collapse in EC2's droplet-workflow manager as queued work and retries exceeded what recovering capacity could absorb, extending a 3-hour trigger into a day of degradation). Recovery from this class has one shape: **shed to below the good-loop threshold, then re-admit gradually** — which must be a rehearsed procedure with pre-built controls, because inventing traffic-pause tooling during the incident is how three hours becomes twenty.

## 1. Backlog Arithmetic and Triage

```text
Figure 1. The drain equation, and why surge capacity and triage
beat patience.

  drain time = B / (μ − λ)
  worked: outage 1 h at λ=0.95μ → B = 3,420·(μ/1000) k items
    patience:        drain at headroom 0.05μ  → ~19 h degraded
    surge μ×1.5:     headroom 0.55μ           → ~1.7 h
    triage 60% of B (expired, superseded, deferrable→side queue):
                     B×0.4 at 0.05μ           → ~7.6 h
    surge + triage:                            → ~42 min

  and the prerequisite for ALL of it: per-queue SLIs from file 03
  (depth, age-at-dequeue, drain headroom) — a backlog you notice
  at 19 hours of depth was a design failure 18 hours earlier.
```

Triage is a *pre-designed* classification, not incident-time archaeology: which entries expire (deadline passed — drop by the file 03 dequeue law), which are superseded (newer state makes them moot — drop-oldest semantics), which defer (move to a sideline queue drained off-peak: the backlog stops taxing live traffic and becomes a scheduled job), and which must run in order (Ch06's per-key ordering — triage granularity is the partition, not the item). The surge decision is equally pre-made: what scales (stateless drain workers — minutes), what does not (the database behind them — the bottleneck law, file 02 §3), and the *ordering* rule that prevents self-reinfection: surged drain capacity replays traffic into downstreams sized for λ — a drained backlog is an *arrival burst* to everything below it, so drain rate is admission-controlled too (the recovering system is a client of itself, and it needs the same budgets it gives its clients).

## 2. Congestive Collapse — the Mechanism and the Exit

The collapse loop, assembled from this chapter's parts: latency rises (any trigger) → timeouts fire → retries multiply λ (file 02 §3: λ_eff crosses μ with no demand change) → queues stand (file 03) → all served work is expired-on-arrival (goodput → 0) → latency stays high → retries continue: **both states are self-sustaining, and the system does not exit on its own** even after the trigger clears — the defining metastability signature, and the reason "we fixed the root cause, why is it still down" is a sentence in so many postmortems. Prevention is this chapter's files applied together (budgets cap the multiplier; adaptive limits shed before standing queues form; deadline-at-dequeue stops paying for dead work; bounded queues cap the stored anger). The **exit**, when prevention lost, is a rehearsed sequence: (1) *stop the multiplier* — force retry fractions down (server-side: fast-fail with long Retry-After; client-side: the adaptive throttle floor; edge: block/pause the offending traffic class — the 2015 incident's "pause metadata requests," the control worth pre-building); (2) *dump the dead* — flush or sideline queue segments older than any live deadline; (3) *re-admit by class, gradually* — file 04's criticality ladder in reverse, watching goodput (not throughput) confirm each step holds; (4) *hold headroom until the backlog clears* — λ must stay meaningfully below μ through the drain window per §1's arithmetic. Every step needs a control that exists *before* the incident (drill W3 exercises the sequence end-to-end against an induced storm in a load environment).

## 3. The Incident-Mechanism Corpus

| Incident | Trigger | The mechanism from this chapter | The lesson encoded in a gate |
|---|---|---|---|
| [AWS DynamoDB, Sep 2015](https://aws.amazon.com/message/5467D2/) | GSI growth pushed metadata responses past timeouts | Timeout → retry → self-disqualify → re-request: endogenous λ over a capacity-shrunk service; exit required pausing the source | Timeouts sized against *grown* payloads (envelope drift); a pre-built pause control per internal request class |
| [AWS US-East-1, Oct 2025](https://aws.amazon.com/message/101925/) | DNS automation race emptied the DynamoDB endpoint record | The *recovery* was the storm: accumulated work + retries into recovering capacity → congestive collapse in EC2's workflow manager; throttles + selective pauses were the exit | Recovery load is designed load: re-admission ramps and drain admission control (§ 1–2), rehearsed |
| [Facebook, Sep 2010](https://engineering.fb.com/2010/09/23/uncategorized/more-details-on-today-s-outage/) | Invalid config value | Error path deleted the cache key and re-queried: a client-side storm sustained by its own failure handling (Ch08 f06's fail-static lesson, storm-side) | Error handlers must not multiply load; fail static, not fail-refetch |

Three incidents, one shape, fifteen years apart — the corpus is the empirical argument that this file's machinery is not optional, and the table's fourth column is how a postmortem becomes a standing gate instead of a memo.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Drain gate | Per queue: B/(μ−λ) analysis at design λ; surge plan (what scales, to what, in what time) and triage classes pre-defined | 19-hour drains discovered by division during the incident; triage invented at 3 a.m. |
| Self-client gate | Drain/replay traffic admission-controlled into downstreams; recovery ramps rate-limited | The backlog drain as a self-inflicted second outage |
| Multiplier gate | Retry budgets verified end-to-end under fault injection (with Ch07 f03); the storm drill (W3) run with the collapse-and-exit sequence | λ_eff unbounded; the exit sequence performed for the first time in production |
| Pause-control gate | Pre-built, tested controls to pause/throttle each major traffic class and internal request source | "Turn it off" requiring code changes mid-incident (the 2015 lesson; the 2025 lesson again) |
| Corpus gate | The incident-mechanism table maintained; each entry's lesson mapped to a standing gate or drill | Postmortems as documents instead of machinery; the same shape recurring in-house |

## Output

The output of this file is a failure-mechanics design with its exits pre-built: backlogs bounded by drain arithmetic with surge and triage decided in advance, drain traffic admission-controlled against self-reinfection, retry multipliers capped and the congestive-collapse exit sequence — stop the multiplier, dump the dead, re-admit gradually, hold headroom — rehearsed with controls that exist before they are needed, and a named-incident corpus that keeps converting the industry's postmortems into this system's standing gates.

## References

- [AWS, "Summary of the Amazon DynamoDB Service Disruption" (September 2015)](https://aws.amazon.com/message/5467D2/)
- [AWS, "Summary of the Amazon DynamoDB Service Disruption in the Northern Virginia (US-EAST-1) Region" (October 2025)](https://aws.amazon.com/message/101925/)
- [AWS Builders' Library, "Avoiding insurmountable queue backlogs" — the drain/triage repertoire](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/)
- [Bronson et al., "Metastable Failures in Distributed Systems" (HotOS 2021) — the sustaining-feedback formalism](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [Google SRE Book, "Addressing Cascading Failures" — the load-shed-and-ramp recovery discipline](https://sre.google/sre-book/addressing-cascading-failures/)
