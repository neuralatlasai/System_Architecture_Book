# Chapter 12 File Map — Retrieval, Memory, and Grounding Architecture

## Reading Order

| Order | File | Owns |
|---:|---|---|
| 1 | [01-the-retrieval-admission-decision-and-grounding-contract.md](01-the-retrieval-admission-decision-and-grounding-contract.md) | When NOT to retrieve (RAG vs long-context vs fine-tune vs tool); the grounding contract; the pipeline anatomy |
| 2 | [02-retrieval-quality-arithmetic-and-the-pipeline-composition-law.md](02-retrieval-quality-arithmetic-and-the-pipeline-composition-law.md) | Recall/precision derived; the stage-composition law (quality = product of stage recalls); attributing the lost answer |
| 3 | [03-ingestion-parsing-and-chunking.md](03-ingestion-parsing-and-chunking.md) | The corpus as engineered input; parsing fidelity; chunking as the first recall ceiling; contextual/late chunking |
| 4 | [04-embedding-models-and-vector-index-structures.md](04-embedding-models-and-vector-index-structures.md) | Embedding selection (MTEB, Matryoshka, domain fit); HNSW/IVF-PQ/DiskANN; recall-vs-cost as the index SLI |
| 5 | [05-retrieval-hybrid-search-and-reranking.md](05-retrieval-hybrid-search-and-reranking.md) | Dense + sparse + RRF; the recall→precision two-stage; cross-encoder and late-interaction reranking; filtered retrieval |
| 6 | [06-context-packing-and-the-generation-boundary.md](06-context-packing-and-the-generation-boundary.md) | Lost-in-the-middle; ordering, dedup, budget; the packing→generation handoff to Chapter 11 |
| 7 | [07-memory-architecture-for-agents.md](07-memory-architecture-for-agents.md) | The memory hierarchy (working/episodic/semantic); write/consolidate/retrieve; memory as Chapter 03 state |
| 8 | [08-grounding-attribution-and-faithfulness.md](08-grounding-attribution-and-faithfulness.md) | Citation as contract; faithfulness vs correctness; the retrieval injection surface; hallucination bounds |
| 9 | [09-advanced-topologies-graph-and-agentic-retrieval.md](09-advanced-topologies-graph-and-agentic-retrieval.md) | GraphRAG; agentic/iterative retrieval; multi-hop; the frontier with adoption judgments |
| 10 | [10-verification-of-retrieval-and-grounding.md](10-verification-of-retrieval-and-grounding.md) | Drill catalog R1–R10; the retrieval SLI set; retrieval-generation evidence stamps |
| 11 | [11-retrieval-review-templates.md](11-retrieval-review-templates.md) | The retrieval surface dossier and reviewer checklist |

## Approval Dependency Graph

```text
Figure 1. Approval dependencies. The admission decision [01] and
quality arithmetic [02] gate the pipeline; each stage [03→06] is a
recall multiplier in [02]'s composition; grounding [08] and memory
[07] sit atop the pipeline; everything feeds verification [10] →
templates [11].

  [01 admission + grounding contract]
        │
        v
  [02 quality arithmetic + composition law]  ◄── the load-bearing file
        │
        ├──► [03 ingestion/chunking] ──► [04 embedding/index]
        │              │                        │
        │              └──► [05 retrieval/rerank]│
        │                        │               │
        │                        v               │
        │              [06 context packing] ◄────┘
        │                        │
        ├──► [07 memory architecture]
        │                        │
        └──► [08 grounding/attribution] ◄── [09 graph/agentic]
                                 │
                                 v
                        [10 verification] ──► [11 templates]
```

## Prerequisites From Earlier Chapters

| Prerequisite | Where it is established | Consumed by |
|---|---|---|
| Vector/hybrid search paths; recall as an SLI; filtered ANN; index selection | [Ch04 file 07](../04-data-modeling-storage-engines-and-query-paths/07-vector-and-hybrid-search-paths.md) | [04], [05] |
| Derived state with lineage, freshness SLO, and rebuild path | [Ch03 file 05](../03-state-ownership-and-consistency-model/05-derived-state-and-lineage.md), [Ch03 file 09](../03-state-ownership-and-consistency-model/09-ai-native-state.md) | [03], [07] |
| The log as the freshness/ingestion transport; consumer lag; replay | [Ch06 file 06](../06-event-logs-streams-and-backpressure/06-stream-processing-and-stateful-computation.md) | [03] |
| Re-embedding as a priced GPU campaign; embedding-version closure | [Ch08 file 09](../08-caching-materialization-and-invalidation/09-ai-native-caching.md) | [03], [04] |
| Context as a budgeted ledger; the agent consumes retrieval per need | [Ch11 file 04](../11-agentic-orchestration-and-tool-routing/04-context-engineering-and-agent-memory.md) | [06], [07] |
| The retrieval injection surface (attacker text enters via documents) | [Ch11 file 08](../11-agentic-orchestration-and-tool-routing/08-security-sandboxing-and-blast-radius.md) | [08] |
| TTFT/TPOT and token cost of the generation call | [Ch10 README](../10-inference-runtime-and-gpu-serving-architecture/README.md) | [02], [06] |
| Evidence classification (tested / observed / assumed) | [Ch01 file 11](../01-architectural-objective-and-system-boundary/11-evidence-classification-and-architecture-review.md) | [10], [11] |

## Chapter Rule

This chapter approves *retrieval, memory, and grounding decisions*: whether to retrieve at all, how the corpus is ingested and chunked, how it is embedded and indexed, how candidates are retrieved and reranked, how context is packed, how memory persists, and how outputs are grounded and attributed. It does not approve the storage engine under the vector index (Chapter 04 owns index mechanics — cited, not re-argued), the serving fleet that runs the embedder and generator (Chapter 10), the agent loop that consults the pipeline (Chapter 11), or the caches around it (Chapter 08). Model quality — whether the generator faithfully uses what it is given — is measured here as a grounding SLI, not assumed.
