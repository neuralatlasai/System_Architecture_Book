# Retrieval Review Templates

## Abstract

This file assembles the chapter into its executable form: the dossier a team completes to put a retrieval, memory, and grounding system — retrieve-vs-fit admission to injection-boundary — in front of an architecture review, and the checklist the reviewer walks to approve it. The organizing principle is the chapter's root discipline made procedural: retrieval quality is a *product of stage recalls* (file 02), so every dossier section forces a per-stage recall number where the default would report an unactionable end-to-end score — did the answer survive parsing, survive chunking, survive the ANN, survive reranking, survive packing, and then get *used faithfully* by the generator. Evidence citations must satisfy file 10's stamp discipline: dated, six-field retrieval-generation-stamped, measured against a versioned gold set, and split into the two halves (did we fetch it, did we use it) that every quality investigation begins with.

## 1. Dossier Assembly

```text
Figure 1. Dossier assembly: each section is produced by one file's
gates; the checklist consumes the whole.

  f01 ─► §A admission & grounding contract   f06 ─► §F packing
  f02 ─► §B quality arithmetic               f07 ─► §G memory
  f03 ─► §C ingestion & chunking             f08 ─► §H grounding
  f04 ─► §D embedding & index                f09 ─► §I topology
  f05 ─► §E retrieval & rerank               f10 ─► §J evidence ledger
                     │
                     v
        reviewer checklist (§3) ─► approve system / findings
```

## 2. The Retrieval Surface Dossier

**§A Admission and grounding contract (file 01).** The retrieve/fit/train/call verdict per knowledge need with the token arithmetic and a re-decision date; the grounding contract (attribution required, abstention path, faithfulness in scope); corpus governance (freshness, access-control-at-retrieval, trust classification).

**§B Quality arithmetic (file 02).** Recall@k/precision@k per stage on a gold set; the survival-chain product; the weakest stage identified; the two-halves split (retrieval recall vs generation faithfulness); candidate count N and rerank depth derived from quality + latency SLO.

**§C Ingestion and chunking (file 03).** Parse fidelity on hard formats; the chunk strategy selected by R1 ingest-recall on this corpus; size/overlap/boundary trade; per-chunk provenance metadata; ingestion as versioned derived state with re-embed accounting.

**§D Embedding and index (file 04).** Embedder chosen by domain eval (not MTEB rank); Matryoshka dimension point; version-closure with re-embed campaign; ANN recall vs exact measured with the tuning point chosen as quality; filtered ANN preserving recall.

**§E Retrieval and rerank (file 05).** The recall-first/precision-later cascade; hybrid dense+sparse fusion measured to beat each alone; reranker chosen against latency SLO with depth stated; eval-gated query processing.

**§F Packing (file 06).** k chosen for the attention curve and budget (not recall@k); lost-in-the-middle ordering; dedup; provenance carried into the prompt; the instruction/budget/cache handoff contracts to Ch11/Ch10.

**§G Memory (file 07).** The memory hierarchy with paging; the extract→consolidate→retrieve loop with consolidation quality; Ch03 f09 governance (owned, retained/deletable incl. derived, isolated); read-back trust labeling.

**§H Grounding (file 08).** Faithfulness measured (vs mere citation-correctness); abstention as a designed SLI'd path; parametric-override resistance verified; the corpus injection-boundary analysis (Ch11 f08); the two-halves diagnostic.

**§I Topology (file 09).** Per-query-class topology (baseline/GraphRAG/agentic/text-to-query) with costs justified; the router eval-gated; GraphRAG's graph-build budget and freshness; agentic retrieval through Ch11's apparatus; the long-context re-decision.

**§J Evidence ledger (file 10).** R1–R10 status: date, result, six-field stamp; the versioned gold set and its refresh cadence; retrieval and grounding halves separated; standing SLIs with targets; the grounding canary gates.

## 3. Reviewer Checklist

| # | Check | Source gate | Common failure it catches |
|---:|---|---|---|
| 1 | Retrieve/fit/train/call decided with token arithmetic and a re-decision date | f01 admission | RAG by reflex; facts fine-tuned into weights; a vector DB with no knowledge problem |
| 2 | Grounding contract: attribution required, abstention defined, faithfulness in scope | f01 grounding | Fluent answers regardless of retrieval; citations as decoration |
| 3 | Corpus governed: freshness, access-control-at-retrieval, trust classification | f01 governance | Retrieval returning forbidden docs; the corpus as an ungoverned attacker channel |
| 4 | Recall@k/precision@k per stage on a gold set; the survival product computed | f02 metric + composition | End-to-end quality as the only number; 0.9⁴=0.66 unmeasured |
| 5 | The weakest stage identified as the tuning target; two halves split | f02 attribution + two-halves | Embedding-model roulette; the wrong (visible) stage tuned |
| 6 | Parse fidelity measured; chunk strategy R1-selected on this corpus | f03 parse + chunking | Flattened tables embedding to nonsense; chunking by default |
| 7 | Ingest recall measured as the first stage; provenance metadata per chunk | f03 ingest-recall + metadata | Downstream debugging while the answer never made a chunk; unattributable chunks |
| 8 | Embedder by domain eval; Matryoshka dims chosen; version-closed with re-embed budget | f04 embedder + dimension + closure | MTEB-rank embedder; "new embedder same index"; unbudgeted re-embed |
| 9 | ANN recall vs exact measured; tuning point a quality decision; filtered ANN preserves recall | f04 index-recall + filter | Library-default efSearch/nprobe dropping r_retr; post-filter emptying top-k; forbidden docs retrievable |
| 10 | Recall-first cascade; hybrid fusion beats each retriever alone | f05 cascade + hybrid | Narrow first stage capping recall; dense-only missing exact terms |
| 11 | Reranker against latency SLO with depth; query processing eval-gated | f05 rerank + query | No reranker on a large corpus; a query rewrite lowering recall unmeasured |
| 12 | k for the attention curve + budget; lost-in-the-middle ordering; dedup; provenance carried | f06 selection + order + provenance | join(top_20); answer buried mid-context; unattributable packed context |
| 13 | Packing handoff: answer-from-context + cite + abstain instructions; cache-order preserved | f06 handoff | Blended parametric+retrieved answers; cache-hostile packing |
| 14 | Memory hierarchy with paging and consolidation; consolidation quality measured | f07 hierarchy + consolidation | Flat memory dump; append-only store poisoning context with contradictions |
| 15 | Memory governed (owned, deletable incl. derived, isolated); read-back trust-labeled | f07 governance + isolation + read-trust | Cross-user memory leakage; undeletable derived copies; memory as an instruction channel |
| 16 | Faithfulness measured (vs correctness); abstention designed and SLI'd | f08 faithfulness + abstention | Post-rationalized citations; a system that never says "I don't know" |
| 17 | Parametric-override resistance verified; corpus injection-boundary analyzed | f08 override + injection | Stale training overriding fresh context; indirect injection via poisoned docs |
| 18 | Per-query-class topology with costs; router eval-gated; GraphRAG budgeted; agentic through Ch11 | f09 topology + GraphRAG + agentic | Monotopology; unbudgeted graph-build; the browsing-agent trifecta |
| 19 | The RAG-vs-long-context line re-decided per corpus; retrieval's governance value retained | f09 long-context-revisit | "RAG is dead" wholesale; losing attribution/freshness/access-control |
| 20 | R1–R10 with six-field stamps; gold set versioned and refreshed; halves separated | f10 all | Recall from a prior corpus cited as current; a stale gold set; blended halves |

## 4. Approval Statement

Approval of a retrieval surface dossier asserts: the decision to retrieve is earned against fitting, training, and calling; the pipeline's quality is a measured product of per-stage recalls with the failing stage attributable; the corpus is ingested, embedded, indexed, retrieved, reranked, and packed with each stage's recall known; memory is governed derived state; and outputs are grounded, attributed, and faithful — with abstention designed, parametric override resisted, and the corpus treated as an injection surface. It asserts *nothing* about the vector index mechanics (Chapter 04), the fleet serving the embedder and generator (Chapter 10), the agent loop consulting the pipeline (Chapter 11), or the caches around it (Chapter 08) — those approvals are prerequisites, cited by reference, never re-argued here.

## Output

The output of this file — and the chapter — is an executable review instrument: a ten-section dossier that forces retrieval quality into a per-stage recall product with a grounded, attributable generation half, and a twenty-point checklist that converts this chapter's gates into findings a review can actually produce.

## References

- [Chapter 12 file map — the approval dependency graph this dossier assembles](00-chapter-file-map.md)
- [Chapter 01 file 11 — evidence classification the ledger inherits](../01-architectural-objective-and-system-boundary/11-evidence-classification-and-architecture-review.md)
- [Es et al., "RAGAS" (2023) — the decomposed evaluation this template operationalizes](https://arxiv.org/abs/2309.15217)
