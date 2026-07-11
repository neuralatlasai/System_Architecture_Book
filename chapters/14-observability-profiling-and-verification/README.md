# Chapter 14 — Observability, Profiling, and Verification

## Abstract

This chapter owns the substrate that makes every prior chapter's claims checkable: **observability** — the property that arbitrary, unanticipated questions about a system's internal state are answerable from the telemetry it emits — and **verification** — the practice of proving, against tests before deploy and telemetry after, that the system does what its contracts claim. The two are one discipline separated by time, joined at the verification boundary where a canary is verification-in-production gated by observation, and its root claim is that **a reliability design you cannot observe is a set of claims you cannot check, and a system you cannot verify is a hypothesis running in production** — so instrumentation and testability are architecture decisions made at design time, not features bolted on after an incident proves them missing. The chapter reframes the "three pillars" (metrics, logs, traces) as *lenses* over one substrate of wide, high-cardinality structured events, because pillars describe storage while the value is the *queries* you run against rich telemetry after the fact — the novel-failure question no pre-built dashboard anticipated. It builds the signals in order: metrics (RED/USE/golden signals, and the non-negotiable rule that latency is a distribution reported at percentiles, never an average that hides the tail); wide events as the query substrate; distributed traces whose completeness is a *product* of per-hop instrumentation (∏pᵢ, so one dark hop breaks the chain); and continuous eBPF profiling at under 1% overhead that attributes cost to the line of code. It turns signals into decisions through symptom-based, burn-rate alerting — page on what the user feels, diagnose with the causes — and prices the whole against cardinality arithmetic where a single unbounded label multiplies series into a bill larger than the service. The AI-native turn (standard 1): because AI failures are silent and return 200, the *outcome* — measured by a standing online eval loop on production traffic — becomes the primary SLI, joined by per-request token/cost telemetry and GenAI-convention traces. And it closes with verification as a coverage map from architecture risks to tests that can fail, and an evidence loop where observability feeds detection, gates deploys, and observes whether the reliability responses worked. The through-line: coverage, not volume — a signal nobody queries, an alert nobody can act on, and a test that exercises no real risk are all cost without coverage.

## Chapter Structure

| File | Claim it carries |
|---|---|
| [00-chapter-file-map.md](00-chapter-file-map.md) | Reading order, approval dependency graph, prerequisites from Chapters 01–13 |
| [01-observability-model-and-the-verification-boundary.md](01-observability-model-and-the-verification-boundary.md) | Observability as queryable internal state; telemetry vs queries; the verification boundary |
| [02-metrics-red-use-and-golden-signals.md](02-metrics-red-use-and-golden-signals.md) | RED/USE/golden signals; latency as a distribution; where metrics stop |
| [03-structured-logs-and-wide-events.md](03-structured-logs-and-wide-events.md) | Wide structured events as the substrate; sampling economics; PII/secret governance |
| [04-distributed-tracing-and-context-propagation.md](04-distributed-tracing-and-context-propagation.md) | Traces as causal graphs; completeness = ∏ per-hop instrumentation; sampling; AI control flows |
| [05-profiling-continuous-and-ebpf.md](05-profiling-continuous-and-ebpf.md) | Flame graphs; continuous eBPF profiling (<1%); cost attributed to code; GPU profiling |
| [06-slo-instrumentation-and-alerting.md](06-slo-instrumentation-and-alerting.md) | SLI→SLO→error budget; symptom-based, burn-rate alerting; alert quality |
| [07-telemetry-economics-cardinality-and-sampling.md](07-telemetry-economics-cardinality-and-sampling.md) | Cardinality arithmetic; sampling; retention tiers; coverage-not-volume |
| [08-ai-native-observability.md](08-ai-native-observability.md) | Outcome quality as the primary SLI; the online eval loop; token/cost telemetry; LLM traces |
| [09-verification-and-the-test-taxonomy.md](09-verification-and-the-test-taxonomy.md) | The risk→test map; the pyramid; contract/load/chaos/regression; test trustworthiness |
| [10-production-verification-and-the-evidence-loop.md](10-production-verification-and-the-evidence-loop.md) | Canary/shadow verification; readiness gates; the evidence loop; the coverage stamp |
| [11-observability-review-templates.md](11-observability-review-templates.md) | The ten-section dossier and 20-point reviewer checklist |

## Source Corpus

| Source | What this chapter takes from it |
|---|---|
| [Majors, Fong-Jones, Miranda, *Observability Engineering* (O'Reilly 2022)](https://www.honeycomb.io/wp-content/uploads/2022/05/Observability-Engineering.pdf) | High-cardinality wide events; the novel-question test; observability vs monitoring |
| [Honeycomb, "They Aren't Pillars, They're Lenses" / "Structured Events"](https://www.honeycomb.io/blog/they-arent-pillars-theyre-lenses) | Telemetry vs queries; the observability-2.0 substrate; cardinality economics |
| [Wilkie, "The RED Method" (Weaveworks 2015)](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/) + [Gregg, "The USE Method"](https://www.brendangregg.com/usemethod.html) | Request-centric and resource-centric metrics; symptom paired to cause |
| [Google SRE Book & Workbook](https://sre.google/books/) | Four golden signals; SLI/SLO/error budgets; symptom-based and burn-rate alerting; readiness review; testing for reliability |
| [Dean & Barroso, "The Tail at Scale" (CACM 2013)](https://cacm.acm.org/research/the-tail-at-scale/) | Why latency is a distribution; tail compounding across fan-out |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) + [OpenTelemetry](https://opentelemetry.io/docs/specs/otel/) | Context propagation; the telemetry substrate and semantic conventions |
| [Sigelman et al., "Dapper" (Google 2010)](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) | Distributed tracing as spans + propagation |
| [Gregg, "Flame Graphs"](https://www.brendangregg.com/flamegraphs.html) + [Grafana eBPF profiling](https://grafana.com/blog/ebpf-profiling-pros-and-cons/) | Cost attributed to code; continuous profiling overhead (<1% eBPF) |
| [OpenTelemetry GenAI semantic conventions / "GenAI Observability"](https://opentelemetry.io/blog/2026/genai-observability/) | LLM/agent spans; token metrics; the AI telemetry grammar |
| [Fowler/Vocke, "The Practical Test Pyramid"](https://martinfowler.com/articles/practical-test-pyramid.html) + [Schroeder et al., "Open Versus Closed" (NSDI 2006)](https://www.usenix.org/legacy/event/nsdi06/tech/full_papers/schroeder/schroeder.pdf) | The test taxonomy; why load tests must be open-loop |

## Chapter Standards

1. Research-note structure per file: Abstract → numbered sections with formal models → ASCII figures ("Figure N.") → decision tables → approval gates → Output → verified primary-source references.
2. Observability is queryable internal state — arbitrary, unanticipated questions answerable from emitted telemetry — not pre-built dashboards; the novel-question test is the bar (file 01).
3. The substrate is wide, high-cardinality structured events; metrics, traces, and logs are derived lenses, not three lossy pre-aggregated stores (files 01, 03).
4. Latency is a distribution reported at p50/p95/p99/p99.9; the average is a lie the tail tells; success and failure latency are separated (standard: file 02).
5. Metrics carry RED (services), USE (resources), and the golden signals with saturation; high-cardinality questions go to events, never to metric labels (files 02, 07).
6. Trace completeness is a product of per-hop instrumentation (∏pᵢ); one dark hop breaks the chain — the chapter's composition law (standard 6, file 04).
7. Profiling is continuous and low-overhead (eBPF <~1%), attributing cost to the line of code, with the most expensive compute (GPU) profiled against derived capacity (standard 9 tie-in, file 05).
8. Alerting is symptom-based and burn-rate-driven: page on what the user feels, diagnose with causes; every page actionable, urgent, diagnosable (file 06).
9. Telemetry is priced: series count = ∏ label cardinalities (standard 9); high-cardinality on events; sampling keeps the rare; retention is tiered; coverage not volume (file 07).
10. AI failures are silent (200-status); the output's *quality* — via a standing online eval loop — is the primary SLI, with token/cost telemetry and GenAI-convention traces (standard 1, file 08).
11. Verification maps every architecture risk to a test that can fail under realistic conditions; the pyramid shape; contract/open-loop-load/chaos/AI-regression rungs populated (file 09).
12. Every stated law carries a worked number (0.9⁵≈0.59 trace completeness; 20-billion-series cardinality explosion; 43.2 min/month at 99.9%; eBPF <1% overhead; 910 ms p99 the mean hid).
13. Validity envelopes (standard 7): the health check that lies in gray failure, the closed-loop load test that hides collapse, the drifted gold set, the head-based sample that discards the outage's traces.
14. The when-NOT admission is first-class: metrics stop where cardinality starts; instrument for the questions that will be asked and stop; more telemetry is not better (files 02, 07).
15. Version/status claims are search-verified at write time (OTel GenAI conventions and SIG scope; eBPF overhead numbers; burn-rate thresholds; observability-2.0 framing).
16. Verification runs in production under observability that makes it safe (canary/shadow/progressive); readiness gates enforce coverage; the evidence loop closes observability into detection (file 10).
17. The chapter approves that the system is observable and verified; it does not re-approve the subsystems it observes — those are the prior chapters' approvals, made checkable (file 11 §4).
18. The README carries an Open Problems section (standard 8).

## Chapter Completion Gate

The chapter is complete for a given system only when its review can answer:

1. Can an unanticipated incident question be answered from already-emitted telemetry, without shipping new instrumentation and waiting for a recurrence?
2. Is latency reported as a distribution at percentiles, with success and failure separated — or is the average hiding the tail?
3. Is every hop instrumented so traces don't go dark, and is the trace-completeness product known?
4. Is the most expensive compute profiled continuously, and is cost attributed to the line of code?
5. Do alerts page on user-felt symptoms at a burn-rate-derived urgency — or on causes that cause fatigue?
6. Is the telemetry bill priced against cardinality, sampled to keep the rare, and designed from the questions it must answer?
7. For AI: is the output's quality the primary SLI via a standing online eval, and is per-request cost observed?
8. Does every architecture risk map to a test that can fail under realistic conditions?
9. Are load tests open-loop, chaos tests injecting real faults, and AI-regression gold sets undrifted?
10. Does production verification run under observability that makes it safe, gated by a readiness review, with the evidence loop closed?

## Open Problems

Stated honestly, per this chapter's standard: **(1) Observability cost scales super-linearly with the questions worth asking** — the high-cardinality telemetry that answers the novel incident is exactly the expensive kind, so there is a standing, unresolved tension between coverage and cost that sampling and event-substrates mitigate but do not eliminate; no methodology tells you in advance the minimal telemetry that would have answered the incident you have not had yet. **(2) The novel-question guarantee is unfalsifiable in advance**: you cannot prove a system is observable for questions you have not thought of — you only discover a blind spot when a novel failure hits it, so observability coverage is validated reactively, incident by incident. **(3) AI quality observability rests on evals that are themselves imperfect**: the online eval loop is only as good as its judge model (which has its own failure modes) and its gold set (which drifts, Chapter 12), so the primary signal for the silent-Byzantine failure is itself an approximation — a wrong answer the judge scores as right is a monitoring blind spot with no infra signal behind it. **(4) Verification cannot cover the emergent**: tests exercise anticipated risks, but the failures that cause the largest incidents (metastable, correlated, gray — Chapter 13) are emergent properties of scale and interaction that pre-production tests structurally cannot reproduce, which is why chaos-in-production exists and why some risks are only ever verified by the incident. **(5) Trace/telemetry propagation across trust and vendor boundaries is incomplete**: a request crossing into a third-party service, a serverless boundary, or an async system frequently loses context, so end-to-end causality — the composition law's ideal — degrades exactly where systems are most heterogeneous.

## Final Position

Observability and verification are how a system's claimed correctness becomes *evidenced* correctness — verifiable before deploy against tests that can fail, observable after against telemetry that can alert, with the loop between them closed so the design learns from every real failure instead of rediscovering it. This chapter is what makes the prior thirteen *checkable*: the SLIs they defined get emission paths, the failure modes they named get detection signals and tests, and the reliability responses they designed get the observation that proves they fired and worked. The book's final chapter turns from whether the system works to whether it is allowed to — and to whom it answers. The seam forward: [Chapter 15](../15-security-deployment-and-operational-governance/README.md) takes up security, deployment, and operational governance, where the telemetry this chapter emits becomes the audit log that proves who did what, the readiness gate becomes the deployment control that decides what may ship, and the trust boundaries — identity, tenant isolation, secret handling, supply-chain integrity — become the last set of contracts a production system must honor before it is not merely observable and reliable, but *governable*: safe to operate, accountable for its actions, and defensible against those who would turn its own capabilities against it.

## References

- [Majors, Fong-Jones, Miranda, *Observability Engineering* (O'Reilly, 2022)](https://www.honeycomb.io/wp-content/uploads/2022/05/Observability-Engineering.pdf)
- [Google SRE Book — "Monitoring Distributed Systems" and "Service Level Objectives"](https://sre.google/sre-book/monitoring-distributed-systems/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry — specification and GenAI semantic conventions](https://opentelemetry.io/docs/specs/otel/)
- [Dean & Barroso, "The Tail at Scale," CACM 2013](https://cacm.acm.org/research/the-tail-at-scale/)
