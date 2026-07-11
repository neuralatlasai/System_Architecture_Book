# Retry Storms, Circuit Breakers, and Metastability

## Abstract

The failure class that turns a recoverable blip into a sustained outage is not any single fault but a **feedback loop**: a system under stress generates load that increases the stress, so the system stays down *after the original trigger is gone* — the defining property of a **metastable failure** ([Bronson et al., HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf); [Huang et al., OSDI 2022](https://www.usenix.org/conference/osdi22/presentation/huang-lexiang)). The canonical engine is the **retry storm**: a dependency slows, callers time out and retry, retries multiply the offered load (Ch07 f03's amplification — a 3-retry policy turns 1× into up to 4×, and across a 3-tier call chain into up to 4³ = 64×), the multiplied load keeps the dependency saturated, and the retries that were meant to *tolerate* a transient fault instead *sustain* it. The reliability discipline is to recognize that **retries are a load-amplifier before they are a fault-tolerance tool**, and to bound them with three composed mechanisms this file assembles. **Circuit breakers** ([Nygard, *Release It!*](https://pragprog.com/titles/mnee2/release-it-second-edition/)) stop calling a failing dependency entirely (open the circuit) after a failure threshold, converting slow timeouts into fast local failures and — critically — *removing the retry load so the dependency can recover*, then probing with half-open trials before resuming. **Retry budgets / token buckets** ([SRE, adaptive throttling](https://sre.google/sre-book/handling-overload/)) cap retries as a *fraction* of the request rate (e.g. 10%) rather than a per-request count, so system-wide retry amplification is bounded no matter how many callers are failing simultaneously — the fix for the per-caller retry policy that is individually reasonable and collectively catastrophic. **Jittered exponential backoff** ([AWS, "Timeouts, retries, and backoff with jitter"](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)) de-correlates retry timing so the retries do not arrive as a synchronized wave. The chapter-level point (standard 6, the composition of *protection*): these mechanisms compose *multiplicatively* against amplification — a circuit breaker bounds duration, a retry budget bounds magnitude, and backoff-with-jitter bounds synchronization, and a system missing any one of the three has an unbounded axis the other two cannot cover. The escape property to design for: metastable systems do not recover on their own — breaking the loop requires an *external* load reduction (shed, drain, or block the retries), which is why the return-path discipline (file 05 §4) and the load-shedding admission (Ch09) are the exits from the trap this file describes.

## 1. The Metastable Failure Loop

```text
Figure 1. The sustaining loop. The trigger starts it; the loop keeps
it going after the trigger is gone. Reliability = break an arrow.

        TRIGGER (transient)                    the loop persists even
        e.g. latency spike, GC pause,          after the trigger
        deploy blip, cache-cold event          disappears — this is
              │                                what makes it META-
              ▼                                stable, not merely a
     ┌─► dependency saturates ──► callers      failure.
     │        ▲                    time out
     │        │                       │        Breaking arrows:
     │   more load                    ▼        · retries → retry
     │        │                    callers        budget caps offered
     │        │                    RETRY          load (§3)
     │        └──────────────────────┤         · saturate→timeout →
     │                               │            circuit breaker
     └───────────────────────────────┘            opens (§2)
        amplified load sustains the           · timeout→retry sync →
        saturation = METASTABLE                  jittered backoff (§4)

  Two regimes (Bronson): a STABLE system absorbs the trigger and
  returns; a system in the VULNERABLE region is tipped by the
  trigger into the METASTABLE region and stays there. Capacity
  headroom is the distance from vulnerable to metastable.
```

The metastability lens reframes every mechanism in this chapter: the goal is to keep the system in the *stable* region (enough headroom that triggers are absorbed — the Ch09 utilization discipline), and, failing that, to guarantee an *exit* from the metastable region (external load reduction), because the one thing a metastable system will *not* do is recover by itself. This is why "just wait for it to recover" is not a mitigation for this failure class and why the largest outages (AWS US-East-1 Oct 2025's DWFM "congestive collapse," Ch09's corpus) required operators to actively block load to break the loop.

## 2. Circuit Breakers — Converting Slow Failures Into Fast Ones

A circuit breaker wraps calls to a dependency and tracks their failure rate; it has three states:

```text
Figure 2. Breaker state machine. CLOSED passes calls; OPEN fails
fast without calling; HALF-OPEN probes for recovery.

   ┌─────────┐  failure rate > threshold   ┌────────┐
   │ CLOSED  │ ──────────────────────────► │  OPEN  │
   │ (pass)  │                             │ (fail  │
   │         │ ◄──── probe succeeds ──┐    │  fast) │
   └─────────┘                        │    └───┬────┘
        ▲                             │        │ after cooldown
        │                        ┌────┴─────┐  │
        └── probe fails ─────────│HALF-OPEN │◄─┘
                                 │ (1 trial)│
                                 └──────────┘

  Value: OPEN state removes retry load from the failing dependency
  (letting it recover — breaks the metastable loop) AND converts
  slow timeouts into fast local failures (freeing the caller's
  threads/connections — prevents the caller from saturating too,
  the cascade up the call chain).
```

The breaker's dual value is why it is the keystone feedback-breaker: it protects the *callee* (removes sustaining load, enabling recovery) and the *caller* (fast-fails instead of blocking threads on timeouts, preventing the caller from becoming the next saturated tier — the cascade Ch09 f01 traces). The design parameters — failure threshold, cooldown, half-open trial count — are tuned so the breaker trips fast enough to matter but not so eagerly that a brief blip opens it needlessly; and the half-open probe must be *gradual* (one or a few trials, not full traffic) or closing the breaker becomes its own thundering-herd trigger (file 05 §4).

## 3. Retry Budgets — Bounding Amplification System-Wide

The per-caller retry policy has a composition failure: each caller retrying 3× is individually reasonable, but when a shared dependency fails, *every* caller retries at once and the aggregate amplification is the sum — the exact load the struggling dependency cannot survive. The fix is to bound retries as a **fraction of the request rate** rather than a count per request:

```text
Figure 3. Retry budget arithmetic. A token bucket refilled at a
fraction of the success rate caps total retries regardless of how
many callers are failing.

  request rate            R  = 10,000 req/s
  retry budget            = 10% of successful requests
  max retry rate          = 0.10 × R = 1,000 retries/s (bounded)

  WITHOUT budget, dependency failing, 3-retry policy, all callers:
    offered load → up to 4 × R = 40,000 req/s  (4× amplification,
    sustains the saturation — metastable)

  WITH budget:
    offered load → R + 1,000 = 11,000 req/s max (retries capped at
    10% no matter how many callers fail — the loop starves)

  Across a 3-tier chain, unbudgeted amplification compounds:
    4 × 4 × 4 = 64×  ← the retry storm that ends services
  Budgeted, each tier's retries stay ≤10%: 1.1 × 1.1 × 1.1 ≈ 1.33×
```

The retry budget is the mechanism that makes retries *safe to compose* across tiers: it converts a multiplicative amplification (4ⁿ across n tiers) into a bounded additive one (~1.1ⁿ), which is the difference between a retry policy that tolerates transient faults and one that manufactures outages. It is paired with **adaptive throttling** (Ch09's client-side `(requests − K·accepts)/requests` — a caller that sees its accept rate collapse throttles *itself*, reducing offered load without central coordination).

## 4. Composing the Protections — The Three-Axis Bound

```text
Figure 4. The three feedback-breakers bound three independent axes
of a retry storm. Missing any one leaves that axis unbounded.

  axis of the storm        bounded by              if missing
  ───────────────────────  ─────────────────────   ──────────────
  DURATION (how long the   circuit breaker          storm persists
  failing dep is hammered) (opens, removes load)    until manual
                                                     intervention
  MAGNITUDE (how much      retry budget / token     amplification
  amplification per unit   bucket (fraction cap)    is 4ⁿ across
  time)                                             tiers
  SYNCHRONIZATION (retries jittered exponential      retries arrive
  arriving as one wave)    backoff                   as synchronized
                                                     spikes
```

The composition is the standard-6 statement for this chapter's *protection* layer: the three mechanisms are not redundant — each bounds a different axis, and reliability against metastable feedback requires all three, because a system with breakers and budgets but no jitter still gets synchronized retry waves, and a system with backoff and breakers but no budget still amplifies without bound when many callers fail together. The mechanisms multiply in *coverage*, not in strength, which is why the review gate below checks for the *presence of all three*, not the tuning of any one.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Metastability gate | Feedback loops identified; capacity headroom keeping the system in the stable region; an external-load-reduction exit designed | "Wait for recovery" as the plan for a self-sustaining loop; no designed exit from metastable region |
| Circuit-breaker gate | Breakers on cross-service calls; open state removes retry load and fast-fails; gradual half-open probe | Slow timeouts blocking caller threads (cascade up the chain); full-traffic breaker-close re-tripping it |
| Retry-budget gate | Retries bounded as a fraction of request rate (budget/bucket), not per-request count; adaptive client throttling | Per-caller retry counts amplifying to 4ⁿ across tiers; every caller retrying a failing shared dependency at once |
| Backoff gate | Exponential backoff *with jitter* on all retries | Fixed or un-jittered retry intervals producing synchronized waves |
| Composition gate | All three axes (duration, magnitude, synchronization) bounded — breaker AND budget AND jitter present | Two of three present, leaving one storm axis unbounded |

## Output

The output of this file is a defense against the feedback-loop failure class: metastable loops identified and kept in the stable region by headroom with a designed external-reduction exit, circuit breakers converting slow failures into fast ones and removing the load that sustains an outage, retry budgets bounding amplification as a fraction of throughput so retries stay safe to compose across tiers, and jittered backoff de-correlating the retry wave — the three composed so that the duration, magnitude, and synchronization axes of a retry storm are each bounded, because leaving any one open is enough to sustain the outage the other two prevented.

## References

- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [Huang et al., "Metastable Failures in the Wild," OSDI 2022](https://www.usenix.org/conference/osdi22/presentation/huang-lexiang)
- [AWS Builders' Library — "Timeouts, Retries, and Backoff with Jitter"](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Google SRE Book — "Handling Overload" (client-side adaptive throttling, retry budgets)](https://sre.google/sre-book/handling-overload/)
- [Nygard, *Release It!* (2nd ed.) — Circuit Breaker pattern](https://pragprog.com/titles/mnee2/release-it-second-edition/)
