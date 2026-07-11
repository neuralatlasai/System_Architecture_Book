# Ingestion, Parsing, and Chunking

## Abstract

The corpus is not found, it is *engineered*, and ingestion is where file 02's composition law sets its first and often lowest ceiling: an answer that a bad parse mangled or a bad chunk boundary split can never be retrieved, no matter how good the embedder — the recall lost here is lost for the life of the index. The pipeline has three stages, each a recall term. **Parsing** converts source formats (PDF, HTML, tables, slides, code) into clean text, and it is the silently-catastrophic stage: a PDF table flattened into column-major word salad, a two-column layout read straight across, an OCR'd scan with 5% character error — each produces text that embeds to nonsense and retrieves for nothing, and the failure is invisible because the pipeline *runs* (LLM-based parsers now handle much of this, at a cost and latency the ingestion budget must carry). **Chunking** splits documents into retrievable units, and it is the design decision with the widest quality spread: too large and the embedding is a blurry average of many topics (low precision, and the useful signal is diluted — Chapter 04 file 07's dimensionality intuition); too small and the answer is split across chunks that individually look irrelevant (low recall, the answer survives nowhere whole). The strategy ladder, with 2024–2025 evidence: fixed-size (baseline, boundary-blind), recursive/structural (respect document structure — the sane default), semantic (split at topic shifts), and the two frontier techniques that measurably move recall — **contextual retrieval** ([Anthropic, 2024](https://www.anthropic.com/news/contextual-retrieval): prepend an LLM-generated 50–100 token context to each chunk before embedding, cutting top-20 retrieval failures ~35% alone, ~49% with BM25, ~67% adding reranking, at ~$1.02 per million tokens with prompt caching) and **late chunking** ([Jina, 2024](https://arxiv.org/abs/2409.04701): embed the full document first, chunk after the transformer, so each chunk embedding is conditioned on document context — needs an 8k+ context embedder). **Metadata** — the third stage — attaches the source, timestamp, access scope, and structural position that make freshness (file 06's freshness SLO), access-control-at-retrieval (file 01's governance), and citation (file 08) *possible*; a chunk without provenance metadata is unattributable and ungovernable by construction.

## 1. The Three Ingest Stages as Recall Terms

```text
Figure 1. Ingest sets the first recall ceiling. Each stage can
drop the answer before any query is ever run.

  source ─► PARSE ─► CHUNK ─► + METADATA ─► embed (f04)
             │         │           │
   fidelity: │  boundary:│  provenance:│
   tables,   │  answer   │  source, ts,│
   layout,   │  split or │  access     │
   OCR, code │  diluted  │  scope, pos │
   → garbage │  → low    │  → freshness│
   embeds    │  recall/  │  + citation │
             │  precision│  + authz    │
  ─────────────────────────────────────────────────────────────
  the ingest quality gate (file 10, R1): a labeled query set,
  measure "is the answer present in SOME chunk, cleanly parsed?"
  — recall AT INGEST, before retrieval enters. If it's not in a
  chunk, the best retriever in the world returns nothing.
```

The governing discipline: **ingestion is a derived-state pipeline** (Chapter 03 file 05 — the index is derived from the corpus with lineage, a freshness SLO, and a rebuild path), so a re-chunk or re-parse is a *reprocessing campaign* with a cost and a version, not an ad-hoc script; and the chunking strategy is **eval-selected, not fashion-selected** — the ladder's rungs differ by corpus (dense prose vs tables vs code vs conversational logs each have a different best chunker), so the choice runs through file 10's R1 ingest-recall drill on *this* corpus, exactly as Chapter 08 file 07 chose eviction policies by trace simulation and Chapter 10 chose kernels by measured breakdown.

## 2. Chunking as the Precision/Recall Knob, Worked

The chunk-size trade is file 02's recall/precision tension made concrete and tunable. Large chunks (say 1000 tokens): high *recall* per chunk (the answer is probably inside one) but low *precision* (the embedding averages several topics, so it matches broadly and ranks the truly-relevant chunk against many near-misses, and it burns the packing budget — file 06 — with mostly-irrelevant tokens). Small chunks (say 150 tokens): high *precision* (each embedding is one focused idea) but recall risk (a two-sentence answer spanning a boundary lands half in each of two chunks, neither of which looks complete) and a metadata/storage multiplier (more chunks = more vectors = Chapter 04 file 07's index-size and cost). The resolutions the field converged on, each a dossier choice: **overlap** (adjacent chunks share a window so boundary-spanning answers survive in at least one — a cheap recall insurance whose cost is index-size inflation), **structural boundaries** (chunk at headings/paragraphs/function-definitions so splits fall where topics actually change, not at arbitrary token counts), and the frontier's insight that **the chunk you embed need not be the chunk you return** — contextual retrieval embeds a context-enriched chunk but the citation points at the real passage; late chunking decouples embedding-context from chunk-boundary entirely — which dissolves the size trade by making the embedding see more than the returned unit does. The number that justifies the frontier's cost: contextual retrieval's ~35% reduction in top-20 failures is, in file 02's terms, r_retr moving from (say) 0.80 to 0.87 — a ~9% lift on one stage that flows straight through the product to end-to-end availability, for a one-time ingest cost measured in single-digit dollars per million tokens.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Parse-fidelity gate | Parse quality measured on representative hard formats (tables, multi-column, scans, code); LLM-parse cost in the ingest budget where used | Flattened tables and column-salad embedding to nonsense; parse failures invisible because the pipeline runs |
| Chunking-eval gate | Chunk strategy selected by R1 ingest-recall on this corpus; size/overlap/boundary choices with their recall/precision trade stated | Chunking by default (512 tokens because a tutorial said so); one strategy across heterogeneous corpora |
| Ingest-recall gate | "Answer present in a clean chunk" measured as the first stage in file 02's chain; the ceiling it sets on the product acknowledged | End-to-end quality debugged downstream while the answer never made it into a chunk |
| Metadata gate | Every chunk carries source, timestamp, access scope, structural position; provenance sufficient for freshness, authz-at-retrieval, and citation | Chunks with no provenance — unattributable (file 08), ungovernable (file 01), un-fresh (file 06) |
| Reprocessing gate | Ingestion as a versioned derived-state campaign (Ch03 f05) with cost, rebuild path, and re-embedding accounting (Ch08 f09) | Ad-hoc re-chunk scripts; index and corpus version-skewed; re-embedding cost undiscovered |

## Output

The output of this file is an engineered corpus: parsed with measured fidelity so the source text is faithful, chunked by an eval-selected strategy that balances the recall/precision knob (with the frontier's decoupling of embedded-context from returned-unit where it pays), and stamped with the provenance metadata that makes freshness, access control, and citation possible — the first and lowest recall ceiling in file 02's chain, raised deliberately instead of accepted by accident.

## References

- [Anthropic, "Introducing Contextual Retrieval" (2024) — the context-prepend technique and its measured recall lift](https://www.anthropic.com/news/contextual-retrieval)
- [Günther et al., "Late Chunking: Contextual Chunk Embeddings" (Jina AI, 2024)](https://arxiv.org/abs/2409.04701)
- [Chapter 03 file 05 — ingestion as versioned derived state with lineage and rebuild](../03-state-ownership-and-consistency-model/05-derived-state-and-lineage.md)
- [Chapter 08 file 09 — re-embedding as a priced GPU campaign on corpus/embedder change](../08-caching-materialization-and-invalidation/09-ai-native-caching.md)
