# Load Shedding and Adaptive Concurrency

## Abstract

Load shedding is the practice of refusing work you could technically start but cannot usefully finish, and its two design questions are *what to shed* and *when to know*. The *what* is criticality: requests carry a declared criticality class (Google's overload architecture propagates it as first-class request metadata with defaults by traffic type — [SRE, "Handling Overload"](https://sre.google/sre-book/handling-overload/)), and shedding consumes classes from the bottom — batch and speculative work first, interactive next, the "critical-plus" never (capacity is *provisioned* to cover it) — so that overload degrades the system in the order the business already chose, not the order requests happened to arrive. The *when* is the harder half, and the field's answer has converged on *adaptive* signals over static ones: static thresholds (max-inflight = 200) are wrong twice a year in both directions as capacity and workload drift, while adaptive concurrency limits — Netflix's gradient family, TCP-congestion-control transplanted to RPC ([Netflix, "Performance Under Load"](https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581)) — infer the service's *current* capacity from latency drift (gradient = RTT_noload/RTT_actual; gradient < 1 ⇒ a queue is forming ⇒ shrink the limit) and track it continuously. The file's third mechanism is the client side: **adaptive throttling** — clients that observe their own reject rate and preemptively drop the expected-to-fail fraction (reject probability ≈ (requests − K·accepts)/requests) — which moves rejection cost from the server that is drowning to the caller that can best afford it, and is the only shedding that helps when the bottleneck is the rejection path itself.

## 1. Criticality — Shedding in a Chosen Order

```text
Figure 1. The degradation ladder, consumed bottom-up under load.

  criticality      examples                    under overload
  ─────────────────────────────────────────────────────────────
  CRITICAL_PLUS    payment capture, auth       never shed —
                                               provisioned for
  CRITICAL         interactive user requests   shed last, after
                                               degrading (below)
  SHEDDABLE_PLUS   async-visible work (feeds,  deferred/queued —
                   notifications)              latency stretches
  SHEDDABLE        batch, speculative, retry-  shed FIRST, silently
                   able background, prefetch
  ─────────────────────────────────────────────────────────────
  Rules: criticality travels IN the request (Ch07 f02's typed
  context); a hop may LOWER a request's class, never raise it;
  every service knows its class mix and the capacity line each
  class is provisioned to.
```

Degradation sits between "serve fully" and "shed": before rejecting CRITICAL work, a service with a *brownout ladder* — smaller result pages, cached-over-fresh answers (Ch08 f04's stale-if-error), disabled recommendations, sampled logging — buys real capacity at chosen quality cost. The review artifact is the ladder itself, ordered and priced (each rung: what degrades, how much capacity it recovers, who approved the quality loss), because improvising quality cuts during an incident produces the wrong cuts, permanently (the rung nobody re-enables). The failure this section exists to prevent: uniform random shedding — dropping 30% of everything — which degrades every user's experience including the payment flows, when the same capacity recovered from the SHEDDABLE tiers would have been invisible.

## 2. Adaptive Concurrency — Finding the Limit Without Asking

Static limits encode a guess about capacity that hardware upgrades, deploys, co-tenants, and downstream latency all silently falsify. The adaptive family treats the service like a TCP path: probe upward while latency holds (the analogue of congestion-window growth), back off multiplicatively when the latency gradient shows queueing — with Gradient2's refinement of comparing short-term RTT against a long-term exponentially smoothed baseline to tolerate bursty RPC patterns ([Netflix concurrency-limits](https://github.com/Netflix/concurrency-limits)). Design rules from production use: **the limit is per-resource, enforced at the entry to that resource** (a service-wide number hides the one slow downstream that needed its own); **rejections at the adaptive limit are the *system working*** (Ch07 file 05's correct-rejection accounting — they must not page anyone as errors, and must feed W1's goodput measurement as successful shedding); **the envelope condition (standard 7)**: gradient algorithms *infer queueing from latency*, so they are blind where latency is not the bottleneck signal — memory exhaustion, connection-table pressure, and GC-pause-shaped failures need their own guards — and they oscillate when the latency signal is dominated by a bimodal downstream (cache hit/miss splits; pin the limiter below the split or feed it the miss-path latency). Priority composes here, not in a second limiter: one adaptive limit with criticality-ordered admission *inside* it (critical always admitted while the limit holds any room, sheddable consumes what remains) beats stacked per-class limiters that fight each other.

## 3. Client-Side Adaptive Throttling — Shedding Before Sending

When a service is rejecting, the rejections themselves cost it capacity (parse, authenticate, respond — cheap, but not free, and at 10× overload the cheap path *is* the load). The client-side correction from Google's overload chapter: each client tracks its recent `requests` and `accepts`, and self-rejects new calls with probability ≈ max(0, (requests − K·accepts)/(requests + 1)) — with K ≈ 2 leaving enough probe traffic through to notice recovery. The properties that make this the correct default for internal callers: it needs no coordination (each client computes from its own history); it converges to sending roughly what the server can accept; it keeps a recovery signal flowing (unlike a tripped circuit breaker's binary silence); and it composes with retry budgets (Ch07 f03) into the two-sided contract — *the server sheds what it must; the client stops offering what will be shed*. The envelope note: adaptive throttling assumes rejections are cheap for the server and visible to the client; where rejection is expensive (TLS-before-reject) the shedding must move further out (gateway, Ch07 f02), and where failures are timeouts rather than fast rejects, the breaker/budget machinery — not throttling arithmetic — is the right tool.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Criticality gate | Classes declared per work type, carried in request context, lowered-never-raised; provisioning line per class stated | Criticality inferred at shed time from URL patterns; batch and payments shed with equal probability |
| Ladder gate | The brownout ladder written, ordered, priced (capacity recovered per rung), and rehearsed (W2) | Quality cuts improvised mid-incident; rungs that never get re-enabled |
| Adaptive-limit gate | Per-resource adaptive limits with the algorithm and its blind spots stated (§2's envelope); rejections-at-limit accounted as shedding, not errors | Static max-inflight guesses; one global limit hiding the slow downstream; adaptive rejections paging as 5xx |
| Client-throttle gate | Internal callers implement adaptive throttling (or budgeted breakers) with K stated; probe traffic preserved | Clients hammering a shedding server at full rate; breakers that never learn recovery started |
| Signal gate | Non-latency exhaustion (memory, connections, GC) guarded independently of the gradient signal | The adaptive limiter confidently admitting work into an OOM |

## Output

The output of this file is a shedding design that degrades in the business's chosen order: criticality classes carried in every request and consumed from the bottom, a priced brownout ladder ahead of rejection, per-resource adaptive concurrency limits that track real capacity with their blind spots guarded, and clients that throttle themselves against observed rejection — so overload spends the system's quality budget deliberately instead of uniformly.

## References

- [Google SRE Book, "Handling Overload" — criticality, adaptive throttling, the client-side rejection formula](https://sre.google/sre-book/handling-overload/)
- [Netflix Technology Blog, "Performance Under Load" — adaptive concurrency limits](https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581)
- [Netflix/concurrency-limits — the gradient algorithms as running code](https://github.com/Netflix/concurrency-limits)
- [AWS Builders' Library, "Using load shedding to avoid overload" — shedding placement and cost](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)
