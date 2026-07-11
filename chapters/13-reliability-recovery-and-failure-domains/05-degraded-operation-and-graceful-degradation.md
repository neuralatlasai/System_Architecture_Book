# Degraded Operation and Graceful Degradation

## Abstract

Between "fully working" and "down" lies a spectrum most systems fall through by accident and mature systems occupy by design: **degraded operation** — continuing to serve a reduced but useful function when a dependency, a resource, or a component has failed. The reliability principle is that **a partial answer delivered is worth more than a perfect answer that never arrives**, and the failure this file attacks is the all-or-nothing system that converts any single dependency failure into a total outage because it has no designed behavior between success and exception. Graceful degradation is engineered along three axes. **Fallbacks**: when a dependency fails, serve a lower-quality substitute — stale cache instead of fresh (Ch08 f06), a cached/default recommendation instead of the personalized one, a smaller/cheaper model instead of the frontier one (Ch11 f06) — chosen so the substitute is *always ready* and never itself depends on the thing that failed. **Feature shedding**: shed non-essential work under pressure so the core function survives — the Ch09 load-shedding decision framed as a *feature ladder* where each rung names what is dropped (personalization, then recommendations, then analytics logging) to protect the rung below (checkout, auth), so saturation degrades the experience instead of collapsing it. **The fail-open / fail-closed decision**: when a component cannot render a verdict, does the system default to *permit* (fail-open — availability over safety) or *deny* (fail-closed — safety over availability)? This is the single most consequential degraded-mode choice and it is *domain-specific*, not a default: a rate limiter should usually fail-open (a limiter outage must not become an application outage — [Stripe's discipline](https://stripe.com/blog/rate-limiters)), but an authentication or payment-authorization check must fail-closed (an auth outage that fails open is a security incident). The file's synthesis: degraded modes are **designed, tested, and observable states** — not the emergent behavior of unhandled exceptions — each with an explicit trigger (the file-02 detection signal), an explicit reduced-function contract (what still works and what does not), and an explicit exit condition (how the system returns to full function when the dependency recovers, without a thundering recovery that re-breaks it — the Ch06/Ch08 metastability concern).

## 1. The Degradation Ladder

```text
Figure 1. The feature ladder: rungs shed top-down under pressure so
the load-bearing core survives. Each rung names its trigger and the
function it sacrifices to protect the rungs below.

  FULL SERVICE                                     resource headroom
    │  shed under: rising latency / burn-rate (f02) / shed signal (Ch09)
    ▼
  − personalization      (serve popular/default instead of per-user)
    │  shed next
    ▼
  − recommendations      (drop the "you might like" panel entirely)
    │
    ▼
  − async enrichment     (skip non-critical logging, analytics, badges)
    │
    ▼
  ══ CORE (protected) ══  checkout · auth · read the record · serve
                          the answer — the function whose loss IS the
                          outage; everything above is shed to keep this
    │  if even core is threatened → shed LOAD not features (Ch09):
    ▼                              reject excess at admission, fail
  CONTROLLED REJECTION           fast with a retryable signal, protect
                                 the requests already admitted
```

The ladder's design rule: **classify every feature by whether its loss is an outage**, and make the shedding order explicit and *automatic* on the detection signal — because a human deciding mid-incident which features to disable is slower and more error-prone than a pre-declared ladder that sheds on a burn-rate threshold. The ladder is also the capacity-planning artifact: it states, in advance, exactly what the system does at each level of resource starvation, converting "we'll see what happens under load" into a designed response with a known user experience at every rung.

## 2. Fallbacks — Substitutes That Are Always Ready

A fallback is a lower-quality path taken when the primary fails, and its one non-negotiable property is **independence from the failure it covers**: a fallback that shares the primary's failed dependency is not a fallback, it is a second way to fail at the same time. The design constraints:

- **The substitute must be pre-computed or trivially cheap**: a stale cache entry (Ch08 f06's `stale-if-error`), a static default, a previously-good response — not a fresh call to a *different* struggling service, which just moves the failure.
- **The fallback path must be exercised in normal operation or by drills** (file 10): a fallback that only runs during incidents is an untested code path that will itself fail when first invoked — the same untested-backup trap as file 04, applied to code.
- **The degradation must be observable**: serving fallbacks is a *signal* (the primary is failing), so fallback rate is an SLI; a system silently serving stale/default responses at 40% is in a gray failure (file 02) that looks healthy on error-rate dashboards because the fallback returns 200.

The AI-native instance (file 08): the model fallback ladder — frontier model → smaller model → cached/templated response → explicit "I can't answer that right now" — where the honest-degradation endpoint (abstention, Ch12 f08) is itself a designed rung, because a confident hallucinated answer is a *worse* degraded mode than a truthful refusal.

## 3. The Fail-Open / Fail-Closed Decision

```text
Figure 2. The verdict-under-failure decision. When a gating
component cannot decide, its default is a design choice with
opposite risk profiles — chosen per component, never by accident.

  component cannot render a verdict (timeout, crash, overload)
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
     FAIL-OPEN (permit)          FAIL-CLOSED (deny)
     availability > safety       safety > availability
          │                           │
     right for:                  right for:
     · rate limiters (Stripe)     · authentication
     · optional enrichment        · authorization / payment auth
     · non-critical guardrails    · destructive-action gates
     · recommendation filters     · quota on irreversible ops
          │                           │
     risk if wrong:              risk if wrong:
     over-admission,             self-inflicted outage
     bypassed non-critical       (an auth-service blip
     check                       locks everyone out)
          │                           │
     ═══ the failure mode: a default chosen by omission ═══
     an unconfigured timeout that happens to throw = fail-closed
     by accident on a limiter (outage), or swallowed = fail-open
     by accident on auth (breach). DECIDE, per component.
```

The decision is load-bearing because both wrong answers are severe and *opposite*: a payment authorization that fails open is fraud; a rate limiter that fails closed is a self-inflicted outage triggered by its own dependency. The discipline is that **every gating component declares its failure default explicitly**, and the default is validated against the question "if this component is completely down, do we want traffic permitted or denied?" — answered by the *cost asymmetry* of the two errors for that specific gate, never inherited from a framework default or an unhandled-exception accident.

## 4. Recovery From Degraded Mode — The Return Path

Entering degraded mode is the easy half; *leaving* it safely is where metastability bites (Ch06, file 06). When the failed dependency recovers, a naive system slams it with the full deferred load — every shed request retrying, every fallback cache expiring at once, every circuit breaker closing simultaneously — and re-breaks it (the thundering-herd recovery, Ch08 f01's cold-cache storm generalized). The return-path design: **exit degraded mode gradually** (ramp traffic back to the recovered dependency, not step it), **jitter the recovery** (stagger cache expiry and breaker-close so load returns smoothly), and **gate the exit on the recovered dependency's *observed* health** (the differential-observability signal of file 02, not a timer) so the system does not declare recovery prematurely and oscillate. A degraded mode without a designed, gradual, health-gated return path is a system that either stays degraded longer than necessary or recovers into an immediate re-failure — the oscillation that turns one incident into a sequence.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Ladder gate | Features classified by "is its loss an outage"; explicit auto-shedding order on the detection signal; core protected | All-or-nothing behavior; a human choosing features to disable mid-incident; no designed response to starvation |
| Fallback gate | Fallbacks independent of the covered failure; pre-computed/cheap; exercised by drills; fallback rate an SLI | Fallbacks sharing the failed dependency; untested fallback paths; silent fallback-serving (gray failure) |
| Fail-open/closed gate | Every gating component declares its failure default from the cost-asymmetry of the two errors; validated against "if fully down, permit or deny?" | Defaults by framework/exception accident; auth failing open (breach) or limiter failing closed (self-outage) |
| Return-path gate | Gradual, jittered, health-gated exit from degraded mode | Thundering recovery re-breaking the dependency; timer-based exit causing oscillation |
| Observability gate | Degraded operation is a visible state (fallback rate, shed rate, mode as an emitted signal), not silent | Degraded mode invisible on dashboards because fallbacks return 200 |

## Output

The output of this file is a set of *designed* degraded modes: a feature ladder that sheds non-essential function automatically to protect the load-bearing core, fallbacks that are independent, ready, drilled, and observable, an explicit fail-open/fail-closed default for every gating component chosen from its error-cost asymmetry, and a gradual health-gated return path that leaves degraded mode without re-breaking the dependency that recovered. Between working and down there is now a spectrum the system occupies deliberately, with a known user experience at every point on it.

## References

- [Google SRE Book — "Addressing Cascading Failures" (graceful degradation, load shedding, the recovery problem)](https://sre.google/sre-book/addressing-cascading-failures/)
- [Stripe, "Scaling your API with rate limiters" (fail-open limiter discipline)](https://stripe.com/blog/rate-limiters)
- [Nygard, *Release It!* (2nd ed.) — Fallback, Bulkhead, and the stability patterns](https://pragprog.com/titles/mnee2/release-it-second-edition/)
- [Meta Engineering, "A Public Analysis of the October 4, 2021 Outage" (recovery-load and thundering-return dynamics)](https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/)
