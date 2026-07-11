# Retrieval Quality Arithmetic and the Pipeline Composition Law

## Abstract

Retrieval quality is measurable, decomposable, and — this chapter's central claim (standard 9) — *multiplicative down the pipeline*, and a team that cannot state these numbers is tuning a system it cannot see. The primitives, derived not cited: for a query whose answer lives in some set of gold passages, **recall@k** is the fraction of gold passages present in the top-k returned (did the answer *survive* to this stage), and **precision@k** is the fraction of the top-k that are relevant (how much noise the generator must ignore) — and the two trade, which is why the pipeline is built as a **recall-first, precision-later** cascade (retrieve wide to catch the answer, rerank narrow to concentrate it, file 05). The composition law that governs everything: an answer must survive *every* stage, so if chunking preserves the answer with probability r_chunk, embedding+index retrieves it with recall r_retr, reranking keeps it with r_rank, and packing includes it with r_pack, then **end-to-end answer availability ≈ r_chunk · r_retr · r_rank · r_pack** — worked: four stages at a respectable 0.9 each yield **0.9⁴ ≈ 0.66**, so a third of answerable queries fail *before generation even begins*, and no generator quality recovers a passage that was dropped at ingest. This is the retrieval dual of Chapter 11's pⁿ agent-failure law and Chapter 09's tandem-stage stability — the same multiplicative-survival structure, now over knowledge stages — and it carries the same design corollary: **the leverage is the weakest stage, and the diagnostic discipline is attributing the lost answer to the stage that dropped it** (a system reporting 66% end-to-end with no per-stage recall cannot tell whether to fix the chunker or the reranker, and will usually tune the most visible stage rather than the failing one). The file closes on the metric that connects retrieval to the product — grounded-answer quality is *not* retrieval recall (the generator can waste perfect context or ground a claim in a wrong passage), so the pipeline needs both **retrieval SLIs** (recall/precision per stage) and **generation SLIs** (faithfulness, answer relevancy — file 08), because the end-to-end number is the product of "did we fetch it" and "did we use it," and optimizing one while blind to the other is the field's most common wasted quarter.

## 1. The Metrics, Derived

```text
Figure 1. Recall and precision, per stage, with the survival chain.

  query q, gold passages G (the passages that answer q)
  stage returns set S_k (top-k):
     recall@k    = |S_k ∩ G| / |G|     ← did the answer SURVIVE
     precision@k = |S_k ∩ G| / k        ← how much NOISE remains
     (ranking-aware variants — nDCG@k, MRR — weight by position,
      which matters because file 06's lost-in-the-middle makes
      RANK within the survivors a quality term too)

  the survival chain (composition law):
     P(answer usable) ≈ Π_stage r_stage
     ┌─────────────┬──────────────────────────────────────┐
     │ chunk r=0.90 │ answer split across chunks / lost in │
     │              │ a bad boundary (f03)                 │
     │ retrieve 0.90│ embedding miss / index recall < 1    │
     │              │ (f04) — the recall@k of the ANN      │
     │ rerank  0.90 │ true passage ranked below the cutoff │
     │              │ (f05)                                │
     │ pack    0.90 │ dropped for token budget / buried    │
     │              │ mid-context (f06)                    │
     └─────────────┴──────────────────────────────────────┘
     0.9^4 ≈ 0.66  → 34% of answerable queries dead pre-generation
     lift the WEAKEST: 0.90→0.97 on the min stage beats 0.90→0.95
     on three others; measure per-stage or tune blind
```

The envelope (standard 7): the clean product assumes stage-independence, and reality bends it both ways — a hard query fails *correlated* stages (an ambiguous query that embeds poorly also chunks and reranks poorly: worse than the product), while a redundant corpus (the answer in many passages) makes any single stage's miss survivable through the others (better than the product). Both corrections are measured, not assumed: the per-query recall distribution (not just the mean) reveals whether failures concentrate on a hard subset (fix the query understanding — file 05's rewriting, file 09's agentic retrieval) or spread uniformly (fix the weak stage).

## 2. Attributing the Lost Answer

The composition law's operational payoff is a *diagnostic protocol*, because "our RAG quality is 66%" is not actionable and "the chunker drops 10%, the ANN drops 8%, the reranker's cutoff drops 12%, packing drops 4%" is. The protocol (file 10 mechanizes it as R-drills): build a labeled set of queries with known gold passages, then measure recall *at each stage boundary* — recall after chunking (is the answer in some chunk at all?), after retrieval (is a gold chunk in the top-N candidates?), after reranking (did it survive to top-k?), after packing (did it reach the generator's context?) — and the stage where recall drops is the stage to fix. This is the single most valuable instrument in the chapter and the one most pipelines lack: without per-stage recall, teams debug end-to-end quality by swapping embedding models (visible, satisfying, often not the problem) when the loss was a chunker splitting tables mid-row or a reranker cutoff set by folklore. The generation-side twin: when retrieval recall is high (the answer *was* in context) but answer quality is low, the failure is generation — faithfulness (grounded in the wrong passage) or utilization (the answer was mid-context and lost, file 06) — and file 08's grounding SLIs localize *that* half. Two numbers, two halves: **did we fetch it (retrieval recall) and did we use it (grounded-answer quality)**, and every quality investigation starts by asking which half broke.

## 3. Cost and Latency Compose Too

The pipeline's cost is per-stage and mostly *offline-heavy, online-cheap by design*: ingest/embed is a one-time (per corpus version) GPU campaign (Chapter 08 file 09's re-embedding economics — priced at GPU rates, re-run on embedder-version change), while query-time is embed-query (one forward pass) + ANN search (sub-linear, file 04) + rerank (a cross-encoder pass over N candidates — the online cost that scales with candidate count, file 05's budget) + the generation call (Chapter 10's token bill, usually dominant). The latency chain is additive like Chapter 09's tandem stages: query-embed + ANN + rerank + generation, with rerank and generation the movable terms — and the design tension file 05 prices: more candidates and heavier rerankers buy recall/precision at latency and dollars, so the candidate count N and the rerank depth are budget decisions derived from the quality target and the latency SLO, not defaults. The RAG-vs-long-context arithmetic from file 01 lands here quantitatively: RAG's 8–82× token savings come from sending the generator *k passages* instead of the *whole corpus*, so the packing budget (file 06) is simultaneously a quality lever (more context, better recall) and the cost lever that justifies the pipeline's existence.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Metric gate | Recall@k and precision@k defined per stage with a labeled gold set; ranking-aware metrics where position matters | End-to-end quality as the only number; no gold set; "it seems to work" |
| Composition gate | The per-stage survival chain measured; the product computed; the weakest stage identified as the tuning target | Debugging by embedding-model roulette; the 0.9⁴ = 0.66 reality unmeasured |
| Attribution gate | Per-stage recall boundaries instrumented (R-drills); the lost-answer protocol runnable; retrieval-recall vs generation-quality split | Quality investigations with no stage attribution; the wrong (visible) stage tuned |
| Two-halves gate | Both retrieval SLIs (recall/precision) and generation SLIs (faithfulness/relevancy) measured; investigations start by localizing the broken half | Retrieval optimized while the generator wastes it, or vice versa |
| Budget gate | Candidate count N and rerank depth derived from quality target + latency/cost SLO; offline vs online cost split stated | N and rerank depth as defaults; the token-savings rationale unquantified |

## Output

The output of this file is the chapter's arithmetic spine: recall and precision derived per stage, the composition law that makes answer availability the product of stage recalls (0.9⁴ ≈ 0.66, so a third of answers die before generation), the lost-answer attribution protocol that turns an unactionable end-to-end number into a stage to fix, and the two-halves discipline — did we fetch it, did we use it — that keeps quality work aimed at the failing half instead of the visible one.

## References

- [Manning, Raghavan, Schütze, *Introduction to Information Retrieval* — recall/precision/nDCG, the metric foundations](https://nlp.stanford.edu/IR-book/)
- [Es et al., "RAGAS: Automated Evaluation of Retrieval Augmented Generation" (2023) — context precision/recall + faithfulness as a decomposed metric set](https://arxiv.org/abs/2309.15217)
- [Chapter 11 file 02 — the pⁿ survival law this file's composition mirrors for knowledge stages](../11-agentic-orchestration-and-tool-routing/02-agent-failure-arithmetic-and-episode-economics.md)
- [Chapter 04 file 07 — the ANN recall-as-SLI the retrieve stage inherits](../04-data-modeling-storage-engines-and-query-paths/07-vector-and-hybrid-search-paths.md)
