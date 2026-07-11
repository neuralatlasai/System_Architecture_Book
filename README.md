# System Architecture Book

**A Principal-Scientist-level treatment of production-grade data-intensive, AI-native, and distributed systems architecture — complete in fifteen chapters.**

## What This Book Is

This is a working architect's reference, not a survey. Its thesis is a single sentence carried through every chapter: **an architecture is a set of contracts, and a system is acceptable for production only when every contract is concrete enough to build, quantified enough to reason about, observable enough to check, reliable enough to survive its own failures, and defensible enough to withstand an adversary — with evidence, at every layer, that proves it rather than asserts it.**

Each chapter takes one architectural concern from its first principles to its production edge: it draws the boundary, states the formal model, quantifies the cost with worked arithmetic, admits when *not* to use the machinery, judges the current research frontier with an explicit adoption verdict, and ends with approval gates that can *fail* a design. The treatment is uniformly AI-native — every discipline is re-derived for LLM inference, agents, and retrieval, not bolted on — because the hardest production systems today are the ones where a GPU-second is the expensive byte, a confident wrong answer returns a 200, and an untrusted document shares the model's instruction channel.

## The Arc

The fifteen chapters compose into five movements:

- **Foundations (1–3)** — the objective and boundary, the control/data-plane split, and state ownership: what the system *is* and who owns what.
- **Data & distribution (4–6)** — storage engines and query paths, replication and quorum, event logs and backpressure: how data is laid out, distributed, and moved.
- **The request path (7–9)** — API contracts, caching and materialization, scheduling and admission: how work enters, is served cheaply, and is protected under load.
- **The AI serving stack (10–12)** — inference runtime and GPU serving, agentic orchestration, retrieval and grounding: how models, agents, and knowledge are served correctly and affordably.
- **The operational trilogy (13–15)** — reliability and failure domains, observability and verification, security and governance: how the whole survives its own failures, proves it is working, and withstands an adversary — the three chapters that decide whether any of the prior twelve reaches a user.

Read in order, the seams are explicit (each chapter opens the next); read as a reference, each chapter is self-contained with its prerequisites cited.

## Chapter Index

| Chapter | Title | Architecture Conclusion |
|---:|---|---|
| 1 | [Architectural Objective and System Boundary](chapters/01-architectural-objective-and-system-boundary/README.md) | A system cannot be evaluated until its objective, workload, users, input contracts, output contracts, and external dependencies are fixed. The boundary must separate implemented behavior from intended behavior. |
| 2 | [Control Plane and Data Plane Separation](chapters/02-control-plane-and-data-plane-separation/README.md) | Policy, scheduling, routing, configuration, admission control, and metadata belong in the control plane. Request execution, storage I/O, retrieval payloads, tensor movement, and streaming belong in the data plane. Mixing them is acceptable only with measured latency and failure-isolation justification. |
| 3 | [State Ownership and Consistency Model](chapters/03-state-ownership-and-consistency-model/README.md) | Every state item must have an owner, lifecycle, consistency contract, invalidation path, and recovery behavior. Ephemeral, persistent, shared, and derived state require different correctness guarantees. |
| 4 | [Data Modeling, Storage Engines, and Query Paths](chapters/04-data-modeling-storage-engines-and-query-paths/README.md) | Data layout must match access patterns. Indexes, materialized views, logs, and denormalized projections are architecture decisions because they move cost between write path, read path, storage amplification, and recovery complexity. |
| 5 | [Replication, Partitioning, and Quorum Semantics](chapters/05-replication-partitioning-and-quorum-semantics/README.md) | Distribution improves capacity only when partition ownership, replication lag, quorum reads/writes, rebalancing, and conflict handling are explicit. Undocumented consistency behavior becomes a latent correctness defect. |
| 6 | [Event Logs, Streams, and Backpressure](chapters/06-event-logs-streams-and-backpressure/README.md) | Logs provide replayable ordering, recovery, and decoupling, but they also introduce offset ownership, consumer lag, duplicate delivery, poison events, and retention constraints. Backpressure must be a first-class control path, not an operational afterthought. |
| 7 | [API Contracts and Request Lifecycle](chapters/07-api-contracts-and-request-lifecycle/README.md) | A production API must specify schema, idempotency key behavior, timeout budget, retry semantics, pagination boundary, status codes, authentication context, authorization decision, and partial-failure response shape. |
| 8 | [Caching, Materialization, and Invalidation](chapters/08-caching-materialization-and-invalidation/README.md) | A cache is correct only when key construction, freshness, TTL, invalidation trigger, stampede control, admission policy, and fallback path are defined. Cache hit ratio without correctness semantics is not an architecture metric. |
| 9 | [Scheduling, Queues, and Resource Admission](chapters/09-scheduling-queues-and-resource-admission/README.md) | Admission control protects the system by rejecting or delaying work before shared resources saturate. Queue depth, priority policy, fairness, cancellation, retry backoff, and deadline propagation determine tail latency under load. |
| 10 | [Inference Runtime and GPU Serving Architecture](chapters/10-inference-runtime-and-gpu-serving-architecture/README.md) | Model serving must separate tokenizer path, prefill, decode, KV-cache allocation, batching, streaming, backpressure, and placement. TTFT, TPOT, memory bandwidth, cache fragmentation, and concurrency limits define the real capacity envelope. |
| 11 | [Agentic Orchestration and Tool Routing](chapters/11-agentic-orchestration-and-tool-routing/README.md) | Agent loops require bounded phases: observe, plan, act, verify, repair, finalize. Tool access must define schema, timeout, retry policy, validation, fallback, and security boundary; speculative tool calls create cost, latency, and trust failures. |
| 12 | [Retrieval, Memory, and Grounding Architecture](chapters/12-retrieval-memory-and-grounding-architecture/README.md) | RAG quality depends on ingestion, parsing, chunking, metadata, embedding choice, index structure, retrieval strategy, reranking, context packing, citation policy, and freshness guarantees. Memory writes require explicit privacy and deletion policy. |
| 13 | [Reliability, Recovery, and Failure Domains](chapters/13-reliability-recovery-and-failure-domains/README.md) | Failure handling must cover malformed input, model error, tool timeout, queue saturation, retry storm, stale index, schema drift, and deployment regression. Detection, mitigation, rollback, and degraded operation must be documented per failure class. |
| 14 | [Observability, Profiling, and Verification](chapters/14-observability-profiling-and-verification/README.md) | Production readiness requires metrics, structured logs, traces, alerts, load tests, regression tests, failure-injection tests, and profiling hooks. Measure p50/p95/p99 latency, queue wait, TTFT, TPOT, error rate, retry rate, cache hit ratio, resource saturation, and quality regressions. |
| 15 | [Security, Deployment, and Operational Governance](chapters/15-security-deployment-and-operational-governance/README.md) | Trust boundaries must cover identity, tenant isolation, secret handling, data retention, audit logs, network policy, model/tool permissions, supply-chain integrity, and rollback strategy. Deployment is acceptable only when observability and recovery paths are already verified. |

## The Method — How Every Chapter Is Built

Each chapter is a set of research notes with a fixed structure: an **Abstract** stating the claim, numbered sections with **formal models**, ASCII **figures** (captioned "Figure N.", no external rendering), **decision tables**, an **approval-gates** table whose conditions can fail a design, an **Output** statement, and **References** to verified primary sources only (peer-reviewed papers, standards bodies, official engineering writing). Every chapter carries a file map, eleven-or-more concept files, a review-templates file (a dossier plus a ~20-point reviewer checklist), and a README with a source-corpus table, a completion gate, and an Open Problems section.

Nine standards accumulated across the book and bind every chapter from their introduction onward — the discipline that makes the treatment principal-scientist rather than a survey:

1. **AI-native instantiation** — every discipline is re-derived for inference, agents, and retrieval, not appended.
2. **Worked numeric example** — every stated law carries an actual calculation (0.9⁴≈0.66 stage recall; 42 ms batch-1 decode floor; 43.2 min/month at 99.9%; 4ⁿ retry amplification; 20-billion-series cardinality; blast-radius = privilege scope).
3. **When-NOT-to-use** — every chapter admits where its machinery is the wrong choice.
4. **Version-status verified** — GA/preview/default and threat claims are web-verified at write time and stated inline.
5. **Research frontier, judged** — recent work is presented with an explicit adoption verdict, not neutral summary.
6. **Composition law** — how the machinery compounds is stated with algebra and a worked number (retrieval's product-of-recalls; reliability's availability multiplication; observability's ∏ per-hop trace completeness; security's weakest-link).
7. **Validity envelopes** — every model states its assumptions, the production conditions that break it, and the consequence.
8. **Open Problems** — every chapter names what its discipline has *not* solved.
9. **First-principles arithmetic** — capacity and cost are derived from device and workload parameters; benchmarks validate the derivation, they do not replace it.

## Reading Protocol

For each chapter:
- Define the objective and non-negotiable constraints.
- Draw the system boundary before naming components.
- Separate control plane from data plane.
- Classify state by ownership and lifetime.
- Specify request flow, data flow, and recovery flow.
- Quantify latency, throughput, memory, compute, and I/O pressure.
- Document rejected alternatives and the reason they fail under the target workload.
- Attach verification gates that can fail the design.

## Architecture Review Checklist

Objective:
- Workload, SLO, tenant model, input contract, output contract, and external dependency list are explicit.

State:
- Ephemeral, persistent, shared, and derived state have owners, consistency rules, invalidation policies, and recovery paths.

Execution:
- Request lifecycle includes admission, scheduling, authorization, execution, retries, cancellation, streaming, and final response emission.

Reliability:
- Each known failure mode has detection, mitigation, degraded behavior, rollback, and operator-visible signal.

Performance:
- Critical path identifies queue wait, network hop count, serialization cost, storage I/O, compute hotspot, memory pressure, and tail-latency amplifier.

Security:
- Authentication, authorization, tenant isolation, secret access, audit logging, data retention, and tool permission boundaries are enforced at explicit interfaces.

Verification:
- Unit, integration, contract, load, chaos, regression, and observability tests map directly to architecture risks.

## Book Conclusion

The book completes a single argument. An architecture is acceptable only when component responsibilities, state ownership, execution paths, failure domains, security boundaries, and verification gates are concrete enough for an implementation team to build, operate, debug, evolve, **and defend** the system without relying on undocumented assumptions. The first twelve chapters make each subsystem *correct*; the operational trilogy (13–15) makes the whole *survivable, checkable, and defensible* — and the recurring move across all fifteen is the same: name the boundary, state the contract, quantify the cost, admit the alternative, and gate the claim on evidence that can fail.

A system built this way is not merely *believed* to work. It is *shown* to work — reliably, observably, and defensibly — which is the only kind of correct that reaches a user. That standard, not any single technology, is what the book asks an architecture to meet.

## References

Books and research:

- Kleppmann, [*Designing Data-Intensive Applications*](https://dataintensive.net/)
- [Google SRE Book and SRE Workbook](https://sre.google/books/)
- [Dean & Barroso, "The Tail at Scale," CACM 2013](https://cacm.acm.org/research/the-tail-at-scale/)
- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [Huang et al., "Gray Failure," HotOS 2017](https://www.microsoft.com/en-us/research/publication/gray-failure-achilles-heel-cloud-scale-systems/)
- [Jepsen — consistency models and safety analyses](https://jepsen.io/consistency)

Production engineering corpora:

- [AWS Builders' Library](https://aws.amazon.com/builders-library/)
- [Netflix Tech Blog](https://netflixtechblog.com/)
- [Meta Engineering](https://engineering.fb.com/)
- [Uber Engineering](https://www.uber.com/en-US/blog/engineering/)
- [Cloudflare Blog](https://blog.cloudflare.com/)
- [OpenAI Engineering](https://openai.com/news/engineering/)
- [Anthropic Engineering](https://www.anthropic.com/engineering)

Standards:

- [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [IETF Idempotency-Key header draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
