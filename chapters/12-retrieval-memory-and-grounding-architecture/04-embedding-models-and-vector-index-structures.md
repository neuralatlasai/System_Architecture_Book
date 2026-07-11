# Embedding Models and Vector Index Structures

## Abstract

Embeddings map text to vectors whose geometry approximates meaning, and this file owns two coupled decisions — which embedder, which index — that together set the retrieve-stage recall term (r_retr) in file 02's product. **Embedding selection** is an eval decision with three axes the dossier must separate: *quality* (MTEB and domain-specific benchmarks — but the leaderboard measures general tasks, and the only number that matters is retrieval quality on *your* corpus and query distribution, which is why embedder choice runs through file 10's drill, not the leaderboard); *dimension* (higher dims store more but cost more to store and search — and **Matryoshka representation learning**, now the industry default across Cohere v4, OpenAI text-3, Gemini, Voyage, and others, front-loads importance into early dimensions so a vector can be *truncated* — 512 dims retaining 94–98% of full nDCG@10, 256 dims above 88%, for a 4–8× storage and compute cut, [MRL](https://arxiv.org/abs/2205.13147)); and *operational fit* (context length for late chunking, multilingual coverage, API-vs-self-host — Chapter 10 file 01's buy-vs-run applied to the embedder, and the version-closure law of Chapter 08 file 09: the embedding model is part of the index version, and changing it invalidates every vector, forcing a full re-embed). **Index selection** is Chapter 04 file 07's territory, cited and specialized: the vectors live in an approximate-nearest-neighbor index whose defining trade is **recall vs latency vs memory** — HNSW (graph-based, high recall, memory-hungry — the quality default), IVF-PQ (quantized, memory-cheap, recall-lossy — the scale default), DiskANN (SSD-resident, billion-scale on modest RAM) — and the non-negotiable discipline Chapter 04 established and this chapter inherits: **ANN recall is a measured SLI, not a library default**, because an index tuned for speed silently drops the r_retr term (an HNSW `efSearch` or IVF `nprobe` set low returns fast, plausible, *incomplete* results, and the missing gold passage is invisible without a recall measurement against exact search). The chapter-specific addition: **filtered retrieval** — the query almost always carries constraints (this tenant, this date range, this document set — file 01's access-control-at-retrieval), and naive post-filtering breaks the ANN's recall guarantees (filter after top-k and the top-k may contain nothing that passes the filter), so filtered ANN is a design requirement, not a WHERE clause bolted on.

## 1. The Embedding Decision

```text
Figure 1. Three axes, evaluated on YOUR corpus — not the
leaderboard.

  QUALITY:    retrieval nDCG@10 on a domain gold set (MTEB is a
              starting filter, not the answer; domain shift is
              real — a legal-corpus winner may lose on code)
  DIMENSION:  Matryoshka → pick the truncation point on the
              storage/compute vs recall curve:
                full   dims → 100%   nDCG, 1× storage
                512    dims → 94-98% nDCG, ~0.2-0.4× storage
                256    dims → ≥88%   nDCG, ~0.1-0.2× storage
              (Ch04 f07's index cost is LINEAR in dims — this is
               a direct capacity lever)
  OP FIT:     context length (late chunking needs 8k+), languages,
              API vs self-host (Ch10 f01 buy-vs-run for the
              embedder), and VERSION = INDEX VERSION (Ch08 f09):
              a new embedder ⇒ full re-embed campaign, priced
```

The disciplines. **The leaderboard is a filter, not a decision**: MTEB narrows the field; the domain eval (file 10, R2) picks the winner, because retrieval quality is corpus-and-query-specific and the general benchmark systematically mis-ranks for specialized corpora. **Query and document embeddings must match**: they come from the same model (and, for asymmetric models, the correct query-vs-passage encoding side — a subtle bug that silently halves recall). **The embedder is a versioned dependency**: pinned, in the index version, with a re-embed campaign budgeted for every change (Chapter 08 file 09's law — the cache is cheap, recomputing the corpus is the expense), and dual-index serving during the transition so retrieval quality does not dip mid-migration.

## 2. The Index — Recall as the Governing SLI

Chapter 04 file 07 owns index mechanics; this file owns their consequence for retrieval quality, which is one rule stated three ways. **ANN is approximate by definition**, so its recall against exact search is < 1 and *tunable* — HNSW's `efSearch`, IVF's `nprobe`, PQ's code size all trade recall for speed/memory — and the tuning point is a *quality decision priced in file 02's product*, not an ops default: a recall@10-vs-exact of 0.95 means the index alone caps end-to-end availability at 0.95× whatever the other stages deliver. **The measurement is against ground truth**: build the exact top-k (brute force on a sample) and measure what the ANN returns against it (file 10, R3) — the only way to know the index's recall, and the number most teams never compute, shipping a "fast" index that quietly costs them answers. **Scale changes the index, not the discipline**: a million vectors run HNSW in RAM; a billion vectors force IVF-PQ or DiskANN and a lower recall floor that the quality budget must accept explicitly — the arithmetic (vectors × dims × bytes-per-dim vs RAM, Chapter 04 file 07's capacity math, and the Matryoshka lever above) decides the structure, and the recall floor it implies is a stated trade. **Filtered retrieval preserves recall by construction**: metadata filters (tenant, date, doc-set — file 03's provenance, file 01's authz) must be applied *inside* the ANN traversal (filtered HNSW, IVF with filter-aware probing) or as a pre-filter over a partitioned index, never as a post-filter that lets the top-k come back empty of anything the user is allowed to see — and access-control filters specifically are a *correctness and security* requirement (returning a forbidden document is Chapter 07 file 08's leak, executed by the index), tested by file 10's R7.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Embedder-eval gate | Retrieval quality on a domain gold set (R2), not leaderboard rank; query/passage encoding sides correct | Embedder chosen by MTEB rank; asymmetric encoding bug halving recall; domain shift unmeasured |
| Dimension gate | The Matryoshka truncation point chosen on the storage/compute-vs-recall curve; dims as a stated capacity lever | Full dims by default; index cost unexamined; truncation quality untested |
| Version-closure gate | Embedder pinned in the index version; re-embed campaign budgeted per change (Ch08 f09); dual-index during migration | "New embedder, same index"; retrieval-quality dip mid-migration; skewed embed versions |
| Index-recall gate | ANN recall@k measured against exact search (R3); the tuning point chosen as a file 02 quality decision; the recall floor stated | Library-default `efSearch`/`nprobe`; a "fast" index dropping the r_retr term invisibly |
| Filter gate | Access-control and metadata filters applied inside/around the ANN preserving recall (filtered ANN, not post-filter); authz-filter correctness tested (R7) | Post-filtered top-k returning empty; forbidden documents retrievable; filters breaking recall guarantees |

## Output

The output of this file is the retrieve-stage foundation: an embedder chosen by domain eval and dimensioned on the Matryoshka curve, pinned as a versioned dependency whose change is a budgeted re-embed, feeding an ANN index whose recall against exact search is measured and chosen as a quality decision — with access-control and metadata filters applied so they preserve recall instead of silently emptying it, so the r_retr term in file 02's product is a known, governed number rather than a library default.

## References

- [Kusupati et al., "Matryoshka Representation Learning" (NeurIPS 2022) — truncatable embeddings](https://arxiv.org/abs/2205.13147)
- [Muennighoff et al., "MTEB: Massive Text Embedding Benchmark" — the starting filter, not the decision](https://arxiv.org/abs/2210.07316)
- [Malkov & Yashunin, "HNSW" (2016) — the graph index and its recall/latency knobs](https://arxiv.org/abs/1603.09320)
- [Chapter 04 file 07 — vector index mechanics, capacity math, and filtered ANN this file inherits](../04-data-modeling-storage-engines-and-query-paths/07-vector-and-hybrid-search-paths.md)
- [Chapter 08 file 09 — embedding-version closure and the re-embed campaign](../08-caching-materialization-and-invalidation/09-ai-native-caching.md)
