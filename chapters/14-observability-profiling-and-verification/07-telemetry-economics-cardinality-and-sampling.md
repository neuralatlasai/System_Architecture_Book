# Telemetry Economics — Cardinality and Sampling

## Abstract

Observability has a cost that is easy to ignore until it is larger than the service being observed, and the mature admission (standard 3) this file makes is that **observability is not free and more is not better** — the goal is *coverage of the questions that will be asked*, not *volume*, and past a point more telemetry buys nothing but bill. The dominant cost driver, and the one that surprises teams, is **cardinality**: a metric's cost is proportional to the number of distinct time series it produces, and that number is the *product* of its label cardinalities (standard 9's arithmetic) — a latency metric with `route` (100 values) × `status` (20) × `region` (10) is 20,000 series, cheap; add `user_id` (1,000,000 values) and it is 20 *billion* series, a bill that dwarfs the application, and the reason "just add a label" is the most expensive innocent sentence in observability. The structural fix is file 03's substrate: **high-cardinality dimensions belong on wide events (stored once per event), not on metric labels (stored as a permanent series per combination)** — so the per-user, per-request questions are answered by querying events, and metrics stay low-cardinality for the anticipated dashboards. The second lever is **sampling**: not every event, trace, or profile need be kept, and the discipline (files 03–04) is *keep the rare and valuable, sample the common and unremarkable* — errors and tail-latency traces at 100%, successful-fast requests at 1%, via tail-based sampling that decides after the outcome is known. The third is **retention tiering**: recent telemetry hot and queryable, older telemetry downsampled or cold, ancient telemetry aggregated or dropped — because the question "what is happening now" needs full fidelity and "what was the trend last quarter" needs only the rollup. The file's governing frame is a **cost/fidelity trade made deliberately per signal**: metrics cheap and always-on, events rich but sampled, traces sampled to the interesting, profiles continuous at <1% — each dialed to the questions it must answer at a cost proportional to their value, so the observability bill is an *investment with known coverage* rather than an exhaust that grows unbounded until finance asks why the telemetry costs more than the product. The when-NOT admission stated plainly: instrument for the questions incidents will actually ask, at the cardinality and retention those questions need — and stop, because the marginal event that answers no anticipated or plausible question is pure cost.

## 1. The Cardinality Explosion — Where the Bill Comes From

```text
Figure 1. Metric cost = ∏ label cardinalities. Each high-cardinality
label MULTIPLIES the series count. This is standard-9 arithmetic and
the #1 cause of surprise observability bills.

  metric: http_request_duration
    labels and their distinct-value counts:
      route      100
      status      20
      region      10
    series = 100 × 20 × 10 = 20,000        ← fine, cheap

  someone adds `user_id` (1,000,000 users) "to debug per user":
    series = 20,000 × 1,000,000 = 20,000,000,000
                                = 20 BILLION series ← bill explosion
    (each series is stored, indexed, and retained independently)

  someone adds `request_id` (unbounded, unique per request):
    series = ∞  ← every request mints a new series; the metrics
                  system is now a very expensive, very bad log

  Rule: metric labels must be BOUNDED and LOW cardinality. The
  unbounded/high-cardinality dimensions (user, request, session,
  trace) go on WIDE EVENTS (f03) — stored once per event, not as a
  permanent series per value.
```

The arithmetic is the whole lesson: because series count is the *product* of label cardinalities, a single high-cardinality label does not add cost, it *multiplies* it — and an unbounded one (request id, session id, or any attacker-influenced field, file 03) makes it infinite. This is why "add a label to slice by X" is a decision with a cost model, not a free convenience, and why the file-02 boundary (metrics stop where cardinality begins) is an economic law, not a stylistic preference. The fix is never "buy a bigger metrics store"; it is *move the high-cardinality dimension to the event substrate*, where a million users cost one field on each event rather than a million permanent series — the same question answered at a cost proportional to *traffic* (events) rather than to the *combinatorial label space* (series).

## 2. The Three Levers — Cardinality, Sampling, Retention

```text
Figure 2. The cost/fidelity dials, per signal. Each is set to the
questions the signal must answer, not to "collect everything."

  lever         dial                        set by
  ───────────   ─────────────────────────   ──────────────────────
  CARDINALITY   which dims are metric        low-card → metrics;
                labels vs event fields       high-card → events (§1)
  SAMPLING      what fraction kept, decided  keep rare/valuable
                head (cheap, blind) vs       (errors, tails) at 100%;
                tail (buffered, outcome-      sample common at 1%
                aware — keeps the good ones)  (f03/f04)
  RETENTION     how long at what fidelity    hot+full (days) →
                                             downsampled (weeks) →
                                             rollup/cold (months) →
                                             drop (aggregate kept)

  Each signal gets its own setting:
    metrics   : low-card, no sampling (already cheap), long rollup
    events    : high-card, sampled (keep rare), medium retention
    traces    : sampled tail-based, short full-fidelity retention
    profiles  : continuous, <1% overhead, aggregated retention
```

The three levers are set *per signal and per question*, and the skill is matching fidelity to value: **metrics** are cheap enough to keep always at long retention *because* they are low-cardinality (the §1 discipline is what keeps them cheap); **events** carry the expensive high-cardinality context so they are sampled (keep-the-rare) and retained medium-term; **traces** are sampled to the interesting (tail-based) and kept full-fidelity only briefly because a month-old trace rarely answers a question metrics-rollups cannot; **profiles** run continuously precisely because their overhead is <1% (file 05) and their aggregate is small. The anti-pattern this prevents is uniform treatment — keeping everything, at full fidelity, forever — which is how observability bills reach and exceed the cost of the production system, buying fidelity nobody queries on data nobody revisits.

## 3. The Coverage-Not-Volume Discipline

The mature stance reframes the observability question from "how much can we collect" to "**what questions must we be able to answer, and what is the cheapest telemetry that answers them**":

- **Start from the questions**: the incident questions (which tenant, which build, why this request is slow), the SLO questions (is the user-facing objective holding), the cost questions (where do the GPU-seconds go) — each maps to a signal at a cardinality and retention, and that map *is* the observability design.
- **Instrument for those, and stop**: a field that answers no anticipated or plausible incident question is cost without coverage — the marginal debug log nobody will query, the metric label nobody slices by, the trace retained past any investigation's reach.
- **Coverage is checked, not assumed**: the test (file 10) is whether the questions a real incident asked were answerable from what was emitted — a gap is under-instrumentation (add the field), and a signal that answered nothing across a quarter of incidents is over-instrumentation (drop it). Observability spend is *audited* against the questions it served, like any other budget.

This is the file-01 principle (coverage decided at design time) made economic: the design is the map from questions to signals, and both a blind spot (a question with no answering telemetry) and waste (telemetry answering no question) are failures of that map — the first found in an incident, the second on the invoice.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Cardinality gate | Metric labels bounded and low-cardinality; high-cardinality dims on events not labels; series count estimated as ∏ cardinalities | user_id/request_id as metric labels; a surprise bill from combinatorial series growth |
| Sampling gate | Keep-the-rare/sample-the-common per signal; tail-based where outcome-awareness is worth the buffering | Uniform full-fidelity collection; sampling errors away; head-based sampling discarding the interesting |
| Retention gate | Tiered retention (hot-full → downsampled → rollup → drop) matched to how far back each question reaches | Everything kept at full fidelity forever; month-old traces retained that answer nothing |
| Coverage-not-volume gate | Telemetry designed from the questions incidents/SLOs/cost will ask; instrument-and-stop; spend audited against questions served | Collect-everything posture; observability bill exceeding the service with no coverage justification |
| Governance-cost gate | Untrusted/high-cardinality input bounded before it becomes telemetry (cost + f03 governance) | Attacker-influenced fields exploding cardinality and cost |

## Output

The output of this file is observability treated as an investment with a cost model: cardinality controlled by putting high-cardinality dimensions on wide events rather than metric labels (where series cost is the product of label cardinalities), sampling that keeps the rare and valuable while thinning the common, retention tiered to how far back each question reaches, and the whole designed from the questions that will be asked rather than the volume that can be collected. Coverage — not volume — is the target, and it is audited both ways: a blind spot is found in the incident, waste is found on the invoice, and a mature observability design minimizes both.

## References

- [Majors, Fong-Jones, Miranda, *Observability Engineering* (cardinality, the cost of high-dimensionality)](https://www.honeycomb.io/wp-content/uploads/2022/05/Observability-Engineering.pdf)
- [Honeycomb, "2024 Wrapped: Observability trends" (telemetry cost, the observability-2.0 economics)](https://www.honeycomb.io/blog/2024-wrapped-observability-retrospective)
- [OpenTelemetry — Sampling (head-based and tail-based)](https://opentelemetry.io/docs/concepts/sampling/)
- [Chapter 08 — the caching/cost discipline this file's economics parallels](../08-caching-materialization-and-invalidation/README.md)
