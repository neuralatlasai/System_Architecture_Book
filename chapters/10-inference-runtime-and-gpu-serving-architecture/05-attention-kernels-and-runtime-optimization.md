# Attention Kernels and Runtime Optimization

## Abstract

File 02 placed the workloads on the roofline; this file owns the gap between the roofline and reality — kernel efficiency, the 40–80% factor that separates theoretical peaks from delivered tokens — and its centerpiece is the result that reorganized the field: attention's cost was never primarily FLOPs but *memory traffic*. Naive attention materializes the S×S score matrix in HBM (quadratic bytes moved at quadratic sequence length); **FlashAttention** ([Dao et al., NeurIPS 2022](https://arxiv.org/abs/2205.14135)) computes exact attention in tiles that live in on-chip SRAM, streaming K/V blocks through and never writing the score matrix — an *IO-complexity* redesign (fewer bytes, same FLOPs) that turned a bandwidth-catastrophe into a compute-shaped kernel. The lineage since is hardware co-evolution, with statuses stated per the book's rule: **FlashAttention-2** (parallelism/partitioning rework — the deployed default across engines); **FlashAttention-3** ([Shah et al., 2024](https://arxiv.org/abs/2407.08608)) exploits Hopper's asynchrony (TMA, warp specialization, FP8 paths — reported ~75% H100 utilization at FP16, ~1.2 PFLOPS FP8; production-real on Hopper via engine integrations while the standalone library long carried a beta label — verify the *engine's* kernel provenance, not the paper's claim). Around attention sits the rest of the iteration, and the review discipline is the same: **fusion** (every unfused elementwise op is a round-trip of activations through HBM — RMSNorm/rotary/residual fusions are bandwidth reclamation, not micro-optimization); **decode-specialized attention** (batch-1-per-query attention over paged KV is its own kernel family — FlashDecoding-class split-K work — because prefill kernels assume query-length parallelism decode does not have); and the CPU-side stages file 01 flagged, led by **structured reuse**: SGLang's RadixAttention ([Zheng et al.](https://arxiv.org/abs/2312.07104)) keeps the prefix pool as a radix tree so agentic/multi-turn workloads (Chapter 11's traffic) hit shared prefixes at tree-lookup cost — the serving-side twin of Chapter 08 file 09's prompt-structure economics — plus grammar-constrained sampling for structured output, whose naive form serializes a vocabulary-sized mask onto the sampler's critical path (the compiled-automaton implementations exist precisely because the naive one became a TPOT tax).

## 1. IO-Aware Attention — the Argument in Bytes

```text
Figure 1. Why tiling wins: bytes moved, naive vs Flash-class,
per attention head, sequence length S, head dim d (bytes ∝ counts
× element size).

  naive:  read Q,K → WRITE S×S scores → read scores → softmax →
          WRITE S×S probs → read probs,V → write O
          HBM traffic ≈ O(S²)            (S=8k: the S² terms are
                                          ~64M elements/head — at
                                          FP16, ~128 MB/head/layer)
  Flash:  tile Q into SRAM; stream K,V tiles; online softmax
          keeps running max/sum; scores NEVER touch HBM
          HBM traffic ≈ O(S²d / SRAM_size) fewer bytes — in
          practice ~10× traffic reduction, exact same output
  ─────────────────────────────────────────────────────────────
  the lesson generalizes past attention: on a machine whose ridge
  is ~300 FLOPs/byte, KERNEL DESIGN IS TRAFFIC DESIGN — count the
  bytes a kernel moves before the FLOPs it computes (file 02's
  law, applied at the SRAM/HBM boundary instead of the HBM/model
  boundary)
```

**Validity envelope (standard 7)**: Flash-class kernels are exact (no quality gate needed — unlike file 06's techniques), but their *speedup* claims assume the attention op dominates and the hardware matches the kernel generation (FA3's gains are Hopper-specific; Ampere fleets run FA2 physics); at short sequence lengths attention is a small fraction of the iteration and kernel choice barely moves TPOT — measure the op-level time breakdown (G3) before buying kernel work.

## 2. The Rest of the Iteration — Fusion, Decode Kernels, and the CPU Stages

The op-time breakdown (G3's artifact) is the file's governing instrument: a decode iteration is attention + MLP GEMMs + a tail of normalization, rotary, residual, and sampling ops, and the tail's share is pure HBM round-trips that fusion removes — engines ship these fusions (fused RMSNorm+rotary, fused MLP activations); the review's job is verifying *this deployment's* engine build actually engages them for *this model's* architecture (custom architectures silently fall back to unfused eager paths, and the 15% TPOT regression has no alarm because nothing failed). Decode attention over paged KV needs its own parallelization (split along KV length, reduce partials — the FlashDecoding shape) because decode has one query token per sequence: no query-axis parallelism to fill SMs. And the CPU stages carry three named review items: **tokenizer throughput** (long-context ingestion tokenizes megabytes; a single-threaded tokenizer in front of TP=8 is a real incident pattern), **sampler cost** (guided/JSON decoding via compiled FSMs, not per-token vocabulary masks in Python), and **detokenize/stream** (incremental detokenization with UTF-8 boundary care — the multi-byte-character bug class every engine has fixed at least once; Ch07 f09's framing contract starts here).

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Breakdown gate | G3's op-level time breakdown per phase at the production mix; the top-3 ops named with their binding resource | Kernel investments chosen without knowing where iteration time goes |
| Kernel-provenance gate | Attention kernel generation (FA2/FA3-class, decode-specialized paths) verified in the deployed engine build for the deployed hardware and model architecture | Paper-level speedups cited for kernels the build doesn't engage; custom-architecture fallbacks to eager unfused paths, unalarmed |
| Fusion gate | Fusion coverage of the non-attention tail confirmed for this model; eager-fallback rate as an SLI (with file 04's graph coverage) | The 15%-slower deploy nobody can explain; activations round-tripping HBM between every elementwise op |
| CPU-stage gate | Tokenizer/sampler/detokenizer throughput measured against fleet ingest; structured-output sampling via compiled automata; UTF-8-safe streaming | The single-threaded tokenizer in front of eight GPUs; JSON mode as a TPOT tax; mojibake at chunk boundaries |
| Exactness boundary gate | The file's techniques (exact kernels, fusion) clearly separated from file 06's quality-bearing ones in the dossier | Quantized attention paths slipped in under "kernel upgrade" without the eval gate |

## Output

The output of this file is the delivered-performance layer of the chapter's arithmetic: attention served by IO-aware exact kernels whose generation and engagement are verified rather than assumed, the iteration's tail fused so activations stop commuting through HBM, decode-shaped parallelism where decode's geometry demands it, and the CPU stages — tokenizer, sampler, streamer — provisioned and engineered as the pipeline members they are, all governed by a measured op-level breakdown instead of a benchmark's rumor.

## References

- [Dao et al., "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" (NeurIPS 2022)](https://arxiv.org/abs/2205.14135)
- [Dao, "FlashAttention-2" (2023) — the deployed-default generation](https://arxiv.org/abs/2307.08691)
- [Shah et al., "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision" (2024)](https://arxiv.org/abs/2407.08608)
- [Zheng et al., "SGLang: Efficient Execution of Structured Language Model Programs" — RadixAttention](https://arxiv.org/abs/2312.07104)
- [Dao-AILab/flash-attention — kernel provenance ground truth for deployed builds](https://github.com/Dao-AILab/flash-attention)
