# The Observability Model and the Verification Boundary

## Abstract

Observability is a term borrowed from control theory with a precise meaning worth restoring: a system is observable if its internal state can be *inferred from its outputs* — and the engineering translation is that an observable system lets you answer questions about what it is doing inside, **including questions you did not think to ask when you instrumented it**, from the telemetry it emits. That last clause is the whole distinction between observability and monitoring: monitoring answers *pre-defined* questions (dashboards and alerts for failure modes you anticipated), while observability answers *arbitrary* questions (the novel failure you did not anticipate — which, per Chapter 13, is the failure that causes the outage). This reframing has a structural consequence that organizes the chapter: the useful split is not the "three pillars" of metrics, logs, and traces (which describe *storage formats*) but **telemetry versus queries** — the telemetry is everything the system emits, and the value is the arbitrary questions you can ask against it *after the fact*, which is why the modern posture ([Honeycomb's "observability 2.0"](https://www.honeycomb.io/blog/they-arent-pillars-theyre-lenses)) stores wide, high-cardinality structured events from which metrics, traces, and logs are *derived as lenses* rather than maintained as three separate, pre-aggregated stores that each throw away the dimension a future investigation will need. The chapter's second concept is the **verification boundary**: observability asks "is it working?" of production, verification asks "does it work?" of a test, and they are the same discipline separated by time — a claim (a Chapter 01 contract, a Chapter 13 reliability property) is *verified* before deploy against a test that can fail and *observed* after deploy against telemetry that can alert, and a claim with neither is an assumption running live. The load-bearing design principle: **instrumentation and testability are properties designed into the system, not added to it** — a system that emits no high-cardinality context cannot answer the incident's question no matter how good the observability *tool* is (the tool queries what was emitted; it cannot recover what was never recorded), and a system whose architecture risks map to no test is unverifiable regardless of test *count*. Observability and verification are coverage problems, and coverage is decided at design time.

## 1. Observability Is Queryable Internal State

```text
Figure 1. Monitoring vs observability: the axis is whether the
question was anticipated. The failures that cause outages are the
unanticipated ones (Ch13) — so observability, not monitoring, is
the property that matters when it matters most.

  question was...      answered by        catches
  ───────────────────  ─────────────────  ──────────────────────
  ANTICIPATED          monitoring         known failure modes
  (dashboard/alert     (pre-defined       (the ones you already
   built in advance)    metric+threshold)  designed a response for)
  UNANTICIPATED        observability      the NOVEL failure — the
  (asked for the        (query arbitrary   one no dashboard exists
   first time during    dimensions of      for, which is the one
   the incident)        rich telemetry)    causing THIS outage

  Test: "can I answer a question I did NOT pre-build a chart for,
  from data already emitted, without shipping new instrumentation
  and waiting for it to reproduce?" If no → you have monitoring,
  not observability, and the novel incident will out-run you.
```

The operational test in the figure is the honest one: most teams have monitoring (dashboards for the failures they anticipated) and believe they have observability until a novel failure asks a question no chart answers and no emitted field can reconstruct — at which point the investigation stalls on "we'll add logging and wait for it to happen again," the most expensive sentence in incident response. Observability is the property that this sentence is unnecessary because the context needed to answer the new question was *already* in the telemetry. This is why the chapter weights *rich, high-cardinality emission* (files 03, 04) over *more dashboards*: dashboards answer yesterday's questions; the emitted context answers tomorrow's.

## 2. Telemetry vs Queries — The Substrate, Not the Pillars

The "three pillars" framing (metrics, logs, traces) describes how telemetry is *stored*, and storing the same request's information three times in three pre-aggregated formats has a specific failure mode: each format discards, at write time, the dimensions it was not designed to keep, so a question that needs a dimension none of the three retained is unanswerable even though the request that had the answer already happened. The modern substrate inverts this:

```text
Figure 2. One wide structured event per unit of work vs three
pre-aggregated pillars. The wide event keeps the dimensions; the
pillars are DERIVED from it as queries (lenses), not stored apart.

  THREE PILLARS (store-thrice, pre-aggregate each):
    metric:  count/latency per pre-chosen label set  → cardinality
             capped at instrumentation time (lost dims unrecoverable)
    log:     text lines, unstructured → grep, no aggregation
    trace:   spans, sampled → often sampled AWAY before the question

  WIDE EVENT (store-once, query-many):
    one event per request, HUNDREDS of fields:
      request_id, user_id, tenant, region, build_sha, flag_state,
      model_version, retrieval_recall, cache_hit, queue_wait_ms,
      status, latency_ms, error_class, ...
        │
        ├─► metric  = aggregate a field over a window   (a lens)
        ├─► trace   = group events by trace_id           (a lens)
        └─► log     = filter to one event's fields        (a lens)

  The event keeps the high-cardinality context (user, tenant,
  build, flag, model version) that lets you slice an incident by
  ANY dimension after the fact — the observability property (§1).
```

The design consequence is that the highest-leverage observability investment is **emitting one wide, richly-attributed event per unit of work** — carrying business and infrastructure context together (which tenant, which build, which model version, which feature flag, alongside latency and status) — because that context is what converts "the p99 is up" into "the p99 is up *for tenant X on build Y with flag Z*," which is the answer, not the alert. This does not abolish metrics (they remain the cheap, low-cardinality signal for the anticipated golden-signal dashboards of file 02) — it re-roots them as one *derived lens* over a substrate that retains what they discard.

## 3. The Verification Boundary

```text
Figure 3. The same claim, checked at two times. Verification (pre-
deploy, against a test) and observability (post-deploy, against
telemetry) are one discipline: proving a contract holds.

  a CLAIM (Ch01 contract / Ch13 reliability property)
       │
   ┌───┴──────────────────────┬───────────────────────────┐
   ▼                           ▼                           ▼
  VERIFY before deploy       OBSERVE after deploy       neither
  (test that can FAIL:       (telemetry that can        = an
   unit/contract/load/        ALERT: SLI + burn-rate,    ASSUMPTION
   chaos/regression, f09)     f06)                       running in
   proves it works on         proves it IS working        production
   known inputs                on real traffic            (hope)

  Boundary rule: a claim reaches production only after it is
  verifiable (a test exercises it) AND observable (a signal watches
  it). The canary (Ch13 f07) is the hinge — it verifies in
  production under real traffic, gated by the observable SLI.
```

The boundary makes the chapter's two halves one: **a claim must be both verifiable and observable to be trusted in production**, because a verified-but-unobservable claim can regress silently after deploy (the test passed once; nothing watches it now), and an observable-but-unverified claim ships untested behavior and hopes the alert catches the regression *after* users do. The canary deploy (Ch13 f07) is where the two meet — it is verification *in production* (real traffic, the only environment with the real inputs) gated by observation (the SLI that promotes or reverts it) — which is why an un-observable system cannot deploy safely: without the signal, the canary is just a slower way to ship a regression to everyone.

## 4. Instrumentation as a Design Obligation

The failure this file exists to prevent is treating observability as a *tool-purchasing* decision rather than a *design* decision. An observability platform queries what the system emitted; it cannot query what the system never recorded — so the platform's power is capped by the instrumentation, and the instrumentation is code the team writes, deliberately, as part of building the feature. The obligations this imposes on every component: **emit a wide event per unit of work** with the high-cardinality context an investigation will need (§2); **propagate trace context** across every hop (file 04) so causality survives the network boundary; **expose the golden-signal metrics** (file 02) for the anticipated dashboards; and — the discipline most often skipped — **emit the outcome, not just the mechanics** (file 08's lesson, critical for AI): a component that logs its latency and status but not *whether it produced a correct result* is observable for infra failures and blind to the correctness failures Chapter 13 showed are the ones AI systems actually have. Instrumentation is not free (file 07 prices it), so it is *designed* — the right fields, at the right cardinality, for the questions that will actually be asked — rather than either absent (blind) or exhaustive (bankrupt, file 07).

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Observability-not-monitoring gate | The novel-question test passes: an unanticipated incident question is answerable from already-emitted telemetry without shipping new instrumentation | Only pre-built dashboards; investigations stall on "add logging and wait for it to recur" |
| Substrate gate | Wide high-cardinality events per unit of work carrying business + infra context; metrics/traces/logs derived as lenses, not three lossy pre-aggregated stores | Pre-aggregated pillars discarding the dimension the incident needs; low-cardinality-only telemetry |
| Verification-boundary gate | Every production claim is both verifiable (a test can fail it) and observable (a signal can alert it); the canary gated by the observable SLI | Verified-but-unobservable claims regressing silently; observable-but-unverified behavior shipped on hope |
| Instrumentation-as-design gate | Instrumentation written as part of the feature: trace propagation, wide events, golden signals, and *outcome* emission | Observability treated as a tool purchase; components emitting mechanics but not correctness outcomes |

## Output

The output of this file is the model the chapter is built on: observability as the property that arbitrary, unanticipated questions about internal state are answerable from emitted telemetry — the property that matters precisely when the novel failure strikes; the telemetry-versus-queries substrate that retains high-cardinality context in wide events rather than discarding it across three pre-aggregated pillars; and the verification boundary that makes a claim trustworthy in production only when it is both verifiable against a test and observable against a signal. Instrumentation and testability are established here as design obligations — coverage decided when the system is built — because the tool can only query, and the test can only exercise, what the architecture chose to emit and expose.

## References

- [Honeycomb, "They Aren't Pillars, They're Lenses" (telemetry vs queries; wide events)](https://www.honeycomb.io/blog/they-arent-pillars-theyre-lenses)
- [Majors, Fong-Jones, Miranda, *Observability Engineering* (O'Reilly, 2022) — high-cardinality, the novel-question test](https://www.honeycomb.io/wp-content/uploads/2022/05/Observability-Engineering.pdf)
- [Sridharan, *Distributed Systems Observability* (O'Reilly) — observability vs monitoring](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/)
- [Google SRE Book — "Monitoring Distributed Systems" (symptom vs cause; the questions monitoring answers)](https://sre.google/sre-book/monitoring-distributed-systems/)
