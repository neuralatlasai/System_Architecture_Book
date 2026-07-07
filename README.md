# System Architecture Book

Principal Scientist orientation for production-grade data-intensive, AI-native, and distributed systems architecture.



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
| 11 | Agentic Orchestration and Tool Routing | Agent loops require bounded phases: observe, plan, act, verify, repair, finalize. Tool access must define schema, timeout, retry policy, validation, fallback, and security boundary; speculative tool calls create cost, latency, and trust failures. |
| 12 | Retrieval, Memory, and Grounding Architecture | RAG quality depends on ingestion, parsing, chunking, metadata, embedding choice, index structure, retrieval strategy, reranking, context packing, citation policy, and freshness guarantees. Memory writes require explicit privacy and deletion policy. |
| 13 | Reliability, Recovery, and Failure Domains | Failure handling must cover malformed input, model error, tool timeout, queue saturation, retry storm, stale index, schema drift, and deployment regression. Detection, mitigation, rollback, and degraded operation must be documented per failure class. |
| 14 | Observability, Profiling, and Verification | Production readiness requires metrics, structured logs, traces, alerts, load tests, regression tests, failure-injection tests, and profiling hooks. Measure p50/p95/p99 latency, queue wait, TTFT, TPOT, error rate, retry rate, cache hit ratio, resource saturation, and quality regressions. |
| 15 | Security, Deployment, and Operational Governance | Trust boundaries must cover identity, tenant isolation, secret handling, data retention, audit logs, network policy, model/tool permissions, supply-chain integrity, and rollback strategy. Deployment is acceptable only when observability and recovery paths are already verified. |

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

The architecture is acceptable only when component responsibilities, state ownership, execution paths, failure domains, security boundaries, and verification gates are concrete enough for an implementation team to build, operate, debug, and evolve the system without relying on undocumented assumptions.

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
