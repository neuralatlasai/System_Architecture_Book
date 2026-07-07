# Quantization and Speculative Decoding

## Abstract

This file owns the two acceleration families that — unlike files 03–05's exact techniques — *can change what the model outputs*, and its governing rule is therefore an evidence rule: **any technique that touches numerics or sampling distribution ships only through an eval gate** — task-representative evaluations, run per technique per model, with the quality delta written into the dossier next to the latency win (a 2× throughput gain at an unmeasured quality cost is not an optimization; it is an unpriced trade someone else's product review will discover). **Quantization** is file 02's arithmetic monetized: decode moves bytes, so halving element width halves the floor — FP16→FP8 takes the 70B batch-1 floor from ~42 ms to ~21 ms and doubles the KV budget; the deployed ladder is weight-only INT8/INT4 (GPTQ/AWQ-class — calibration-based, strongest where capacity binds and batch is small), W8A8-FP8 (Hopper-native tensor-core path — the production workhorse: near-parity quality on most workloads with hardware-speed matmuls), and FP4-class formats (NVFP4/MXFP4 on Blackwell's 4-bit tensor cores — real silicon and real engine support, but the quality envelope per workload is still being mapped; frontier-adopted, not yet a default: verify per model, per task). **Speculative decoding** ([Leviathan et al.](https://arxiv.org/abs/2211.17192), [Chen et al.](https://arxiv.org/abs/2302.01318)) attacks latency without touching quality *by construction*: a cheap drafter proposes k tokens, the target model verifies them in one parallel pass, and rejection sampling guarantees the output distribution equals the target's — the free lunch is real but its bill arrives elsewhere: the technique spends *spare compute* to save *sequential bandwidth passes*, so its speedup is a function of exactly the resource slack that vanishes under load — the EAGLE-3 numbers make the envelope quantitative (~2.3× at batch 4, ≈ break-even at batch 32, ~1.38× at batch 64 in SGLang), which converts "should we run speculation" from an ideology into a load-curve lookup.

## 1. The Quantization Ladder and Its Gate

```text
Figure 1. Precision as a position on file 02's envelope.

  format        bytes/wt   batch-1 floor(70B/H100)   status
  ─────────────────────────────────────────────────────────────
  FP16/BF16       2         ~42 ms   the baseline
  FP8 (W8A8)      1         ~21 ms   Hopper-native; production
                                     default-candidate; near-
                                     parity on most evals
  INT4 weight-    0.5       ~11 ms*  capacity/small-batch tool;
  only (AWQ/GPTQ)          *dequant  quality dip task-dependent;
                            overhead activations still 16-bit
  FP4 (NVFP4/     0.5       Blackwell tensor-core path (B200:
  MXFP4)                    ~9 dense PFLOPS FP4); frontier-
                            adopted, envelope still being
                            mapped — per-model verification
  KV quantization (file 03's rung): same gate, its OWN eval —
  KV precision errors compound over sequence length
  ─────────────────────────────────────────────────────────────
  the gate: task-representative evals per (model, format,
  workload) with deltas recorded — benchmark parity on MMLU
  does NOT certify your legal-summarization workload
```

Three disciplines around the ladder. **The eval is workload-shaped**: published parity claims average over benchmarks; the gate runs *your* task distribution, at *your* context lengths (quantization error is not uniform across regimes — long-context and low-resource-language degradation are the classic silent casualties). **Quantized is a different model for closure purposes**: Chapter 08 file 09's version law applies — the quantization config is part of the model version in every cache key, routing decision, and eval record; "the same model, just FP8" has produced too many unexplained regressions to permit the phrase in a dossier. **Numerics drift across engine versions**: kernel changes shift accumulated error even at fixed format — the eval gate re-runs on serving-generation change (G6), not once at adoption.

## 2. Speculative Decoding — the Free Lunch and Its Envelope

Mechanics worth stating precisely because the guarantee depends on them: drafter proposes γ tokens; target scores all γ+1 positions in one forward pass (parallel — this is why verification is cheap: it is a prefill-shaped op); accepted prefix keeps, first rejection resamples from the corrected distribution — **output distribution provably identical to target-only decoding**, so no eval gate on *quality* is needed (the gate moves to *performance*, where the claims actually live). The drafter ladder: independent small models (simple, extra memory), self-drafting heads (Medusa-class), and feature-level drafters (EAGLE lineage; [EAGLE-3](https://arxiv.org/abs/2503.01840) is the current reference — up to ~6.5× at batch 1 with training-time improvements to acceptance length). **The envelope (standard 7), which is the review's whole business here**: speedup ≈ (accepted tokens per verify) / (drafter cost + verify cost), and every term degrades with load — at high batch the "spare" compute the verify pass borrowed is gone (decode itself approaches compute-bound, file 02 §1), the drafter's memory steals KV budget (file 03's batch ceiling), and acceptance rates fall on distribution-shifted traffic (the drafter was trained on something) — hence the published curve: 2.3× (batch 4) → 1.0× (batch 32) → 1.38× (batch 64, better kernels). The design consequence: **speculation is a low-load latency tool, ideally adaptive** — engaged when batch occupancy is low (latency-critical, capacity spare) and disengaged as the fleet fills (where it costs throughput) — and a static-on configuration is wrong at one end of every day's load curve. Acceptance rate per traffic class is the standing SLI; a drafter whose acceptance decays (model drift, traffic shift) is silently converting a speedup into a slowdown, with no error anywhere.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Eval gate | Per (model, format, workload): task-representative eval deltas recorded beside the latency win; long-context and edge-distribution slices included | Config-flag quantization; MMLU parity certifying a domain workload; KV quant skipping its own eval |
| Closure gate | Quantization config in the model version everywhere (cache keys, routing, eval records, rollbacks) | "Same model, just FP8" as a deploy description |
| Re-eval gate | Numerics re-evaluated on engine/kernel upgrades (G6); the eval harness itself versioned | Quality drift shipped inside a "performance-only" engine bump |
| Speculation-envelope gate | The speedup-vs-batch curve measured at the production mix; adaptive engagement (or the static choice justified against the load curve); drafter memory debited in file 03's budget | Speculation benchmarked at batch 1 and billed at batch 48; drafter KV squeezing the batch ceiling unaccounted |
| Acceptance-SLI gate | Acceptance rate per traffic class standing, with drift alarms | The drafter that quietly stopped helping months ago |

## Output

The output of this file is an acceleration portfolio with its books balanced: precision chosen as a position on the capacity envelope and admitted only through workload-shaped eval gates with full version closure, and speculation deployed as what it provably is — a distribution-preserving latency tool whose speedup is a measured function of load, engaged adaptively where the curve says it pays and retired where it doesn't — so every claimed win names its price and the dashboard that watches it.

## References

- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (ICML 2023)](https://arxiv.org/abs/2211.17192)
- [Chen et al., "Accelerating Large Language Model Decoding with Speculative Sampling" (2023)](https://arxiv.org/abs/2302.01318)
- [Li et al., "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test" (2025)](https://arxiv.org/abs/2503.01840)
- [Frantar et al., "GPTQ" (2022)](https://arxiv.org/abs/2210.17323) / [Lin et al., "AWQ" (MLSys 2024)](https://arxiv.org/abs/2306.00978) — the weight-only calibration lineage
- [NVIDIA — FP8/FP4 tensor-core formats and Transformer Engine (the hardware side of the ladder)](https://docs.nvidia.com/deeplearning/transformer-engine/user-guide/index.html)
