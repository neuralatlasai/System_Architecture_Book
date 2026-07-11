# Structured Logs and Wide Events

## Abstract

The log is the oldest observability signal and the one whose modern form is most different from its origin: a traditional log is an unstructured human-readable text line (`ERROR: failed to process order 12345`), grep-able but not query-able, and its aggregate is a haystack. The reframing this file makes — the [observability-2.0](https://www.honeycomb.io/blog/structured-events-basis-observability) substrate of file 01 — is to stop emitting *log lines* and start emitting **structured events**: one wide event per unit of work (a request, a job, an agent step), carrying not a message but *fields* — dozens to hundreds of typed key-value attributes describing everything known about that unit at the moment it completed. The shift from line to event is the shift from "search the text" to "query the dimensions," and it is what makes the high-cardinality context (which tenant, which build, which model version, which feature-flag state, which retrieval recall) *queryable after the fact* rather than buried in prose. The design rules this file establishes: **structure over prose** (typed fields, machine-parseable, so `WHERE tenant='X' AND build='Y' GROUP BY error_class` is a query, not a regex); **wide over narrow** (one rich event per unit of work beats twenty thin log lines scattered through the code path — the event is the join of everything that request touched, and width is what lets an investigation slice by a dimension nobody anticipated); **context propagated** (the event carries the trace and request identifiers of file 04 so events, traces, and metrics are the *same* data viewed through different lenses); and **level as sampling policy, not just severity** (DEBUG/INFO/WARN/ERROR is a volume-and-cost control — file 07 — not merely a human-attention hint). Two governance constraints bind hard here because logs are where they are most often violated: **PII and secrets** (Chapter 03 f09's retention and deletion obligations apply to logged fields exactly as to a database — a user's message logged verbatim is a data-retention liability, and a logged credential is a breach), and **the log as an attack and cost surface** (unbounded high-cardinality fields from untrusted input are both a cardinality-explosion cost (file 07) and, for AI systems logging prompts, a place where sensitive content accumulates). The event substrate is the highest-leverage observability investment because it is the one signal from which the other two (metrics, traces) can be *derived* — but only if it is structured, wide, propagated, governed, and paid for.

## 1. From Log Line to Structured Event

```text
Figure 1. The same failure, as a log line and as a wide event. The
line is grep-able; the event is query-able across every dimension
an incident might ask about.

  TRADITIONAL LOG LINE (prose, one of many scattered lines):
    2026-07-11T14:03:22Z ERROR failed to process order 12345:
    upstream timeout

    → to investigate: grep, eyeball, correlate by hand across
      services, hope the dimension you need was printed somewhere

  WIDE STRUCTURED EVENT (one per unit of work, hundreds of fields):
    {
      timestamp, trace_id, span_id, request_id,
      user_id, tenant, region, build_sha, flag_state,
      route: "POST /orders", status: 504, error_class: "upstream_timeout",
      upstream: "inventory-svc", latency_ms: 30012, queue_wait_ms: 120,
      retry_count: 3, cache_hit: false, db_pool_util: 0.98,
      model_version: null, ...
    }
    → to investigate: WHERE error_class='upstream_timeout'
      GROUP BY tenant, build_sha  → "only tenant X on build Y"
      — the answer, from data already emitted (f01's property)
```

The width is the point: the event is a *join at emit time* of everything the unit of work touched — its identity, its context, its infrastructure state, its outcome — so an investigation slices it by any dimension without needing to have anticipated that dimension when instrumenting. A team emitting thin log lines scattered through the code (`log.info("entering handler")`, `log.error("timeout")`) has the data spread across many lines that must be manually re-joined by timestamp and hope; a team emitting one wide event per request has the join done for them, queryable. The instrumentation pattern that follows: **accumulate a context object through the request's life and emit it once, at the end, wide** — rather than logging incrementally and thinly.

## 2. Structure, Context, and the Derivation of the Other Signals

The structured event is the substrate because metrics and traces are *views* of it (file 01 §2):

- **Metric = an aggregation of a field over a window**: `count(*) WHERE status>=500` grouped by minute *is* the error-rate metric — derived from events, not stored separately, so the moment you need it per-tenant you `GROUP BY tenant` instead of having pre-committed to a label set (file 02's cardinality boundary dissolves when the dimension is an event field, not a metric label).
- **Trace = events sharing a trace_id, ordered by span**: the causal graph (file 04) *is* the set of this request's events grouped and time-ordered — so propagating `trace_id` and `span_id` into every event (the context rule) is what makes the same data serve as both a log and a trace.
- **The join is the value**: because the event carries business context (tenant, user, plan) *and* infra context (pool utilization, queue wait, cache hit) *and* outcome (status, error class, and for AI, correctness — file 08) in one row, it answers questions that span those domains ("do enterprise-tier users on the new build see more timeouts when the cache is cold?") that no single-domain signal can.

This is why the event's **field discipline** matters: emit the high-cardinality identifiers (trace/request/user/tenant/build/flag/model-version) that make slicing possible, the infra state that explains *why*, and the outcome that says *what happened* — designed as the set of dimensions incidents will ask about, at a cardinality file 07 can afford.

## 3. Levels, Sampling, and Volume as a Cost Decision

Log/event volume is a direct cost (file 07: storage + ingest + index), so the level and sampling policy is an economic control, not just a human-attention hint:

```text
Figure 2. Level and sampling as a cost/fidelity dial. Keep all the
errors; sample the successes; make the dial dynamic under incident.

  level    typical policy              rationale
  ──────   ─────────────────────────   ──────────────────────────
  ERROR    keep 100%, always           errors are rare + high-value;
                                        never sample away a failure
  WARN     keep 100% (usually)         leading indicators
  INFO     sample (e.g. 1–10%) OR      the successful-request bulk;
           one wide event/request       volume lives here → cost lives
           kept at a sampled rate        here (f07)
  DEBUG    off in prod; on by flag     high volume, low steady value;
           for a scoped investigation   flag it on for a tenant/route

  Discipline: sample the COMMON (successful requests), keep the RARE
  (errors, slow tail). Head-based sampling (decide at ingress) is
  cheap but may drop the request that later errored; tail-based
  (decide after outcome known, f04) keeps the interesting ones —
  at the cost of buffering. Choose per the f07 budget.
```

The governing rule: **sample the common, keep the rare** — the successful, fast, unremarkable requests are where the volume and cost live and where the marginal information is lowest, while errors and tail-latency events are rare and high-value and must never be sampled away. This makes the outcome-aware (tail-based) sampling of file 04 attractive: decide what to keep *after* you know whether the request errored or ran slow, so the interesting events survive at full fidelity while the boring bulk is thinned — the fidelity-per-dollar optimization file 07 prices.

## 4. Governance — PII, Secrets, and the Log as a Liability Surface

Logs are where data-governance failures most often happen because logging feels incidental while being, legally, a data store. The binding constraints (Chapter 03 f09 inherited, not re-argued):

- **PII in fields is retained data**: a user's email, message, or location logged as an event field is subject to the same consent, retention, and *deletion* obligations as any database column — a deletion request must reach the logged copies, which means either not logging PII (redact/hash at emit) or including the log store in the deletion path. The AI-specific sharp edge: **logging prompts and completions verbatim** (file 08) accumulates user content — often sensitive — in the observability store, and that store's retention and access controls must match the sensitivity of what it now holds.
- **Secrets must never be logged**: a credential, token, or key in a log line is a breach with a long tail (logs are copied, shipped to third-party observability vendors, and retained) — so secret redaction is an emit-time discipline, enforced structurally (typed fields with a redaction policy) not by reviewer vigilance.
- **Untrusted input is a cardinality and content risk**: logging attacker-controlled fields at high cardinality is a cost-amplification vector (file 07) and, if reflected into a dashboard or downstream system, an injection surface — untrusted field values are bounded and sanitized before they become telemetry.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Structure gate | Events emitted as typed structured fields, not prose lines; queryable by dimension | Unstructured text logs requiring grep; dimensions buried in messages |
| Width gate | One wide event per unit of work joining identity + infra + outcome context; not scattered thin lines | Many thin log lines re-joined by hand; the answer spread across records |
| Context-propagation gate | trace_id/span_id/request_id in every event so events, traces, metrics are one dataset | Logs, traces, metrics as three disconnected stores; no cross-signal correlation |
| Sampling-economics gate | Keep-the-rare/sample-the-common policy; levels as cost policy; tail-based sampling where the budget favors it | Sampling away errors; logging everything at full volume (f07 bankruptcy); DEBUG on in prod |
| Governance gate | PII redacted/hashed or in the deletion path; secrets never logged (structural redaction); untrusted fields bounded; prompt/completion logging governed to its sensitivity | Verbatim PII/prompts as an undeletable retention liability; a logged credential; unbounded untrusted-input cardinality |

## Output

The output of this file is the wide-structured-event substrate: one rich, typed, high-cardinality event per unit of work, carrying identity, infrastructure state, and outcome together with propagated trace context — from which metrics and traces are derived as lenses rather than maintained as separate lossy stores. Volume is controlled as the cost decision it is (keep the rare, sample the common, tail-based where affordable), and the event store is governed to the sensitivity of what it holds (PII deletable, secrets never present, untrusted input bounded). This event is the signal from which file 04's traces and file 02's metrics are cut, and the place file 08's AI outcomes are recorded.

## References

- [Honeycomb, "Structured Events Are the Basis of Observability"](https://www.honeycomb.io/blog/structured-events-basis-observability)
- [Majors, Fong-Jones, Miranda, *Observability Engineering* (wide events, high cardinality)](https://www.honeycomb.io/wp-content/uploads/2022/05/Observability-Engineering.pdf)
- [OpenTelemetry — Logs data model and semantic conventions](https://opentelemetry.io/docs/specs/otel/logs/)
- [Chapter 03 file 09 — the retention/deletion governance logged PII inherits](../03-state-ownership-and-consistency-model/09-ai-native-state.md)
