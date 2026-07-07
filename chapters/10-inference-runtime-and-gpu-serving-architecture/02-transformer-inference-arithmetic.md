# Transformer Inference Arithmetic

## Abstract

Every serving decision in this chapter is downstream of arithmetic that fits on one page, and this file derives it from device physics rather than citing it — the chapter's rule (standard 9) being that a capacity claim which cannot be traced to FLOPs, bytes, and bandwidth is a rumor. The primitives: a dense transformer forward pass costs **≈ 2·P FLOPs per token** (P = parameters; one multiply-accumulate per weight); producing one token at batch 1 requires **reading every weight byte** (plus the sequence's KV cache) from HBM; and a device is characterized by its compute peak, its memory bandwidth, and their ratio — the **ridge point** of the roofline model ([Williams et al., CACM 2009](https://dl.acm.org/doi/10.1145/1498765.1498785)): for an H100 SXM, ≈989 dense BF16 TFLOPS over 3.35 TB/s ≈ **295 FLOPs/byte**. Decode at batch 1 has arithmetic intensity ≈ 2P FLOPs / 2P bytes ≈ **1 FLOP per byte** — two orders of magnitude below the ridge — which is the entire explanation for why **decode is memory-bandwidth-bound** and why the per-token latency floor is a *division*: a 70B model in FP16 is 140 GB of weights, and 140 GB / 3.35 TB/s ≈ **42 ms/token — a ~24 tokens/s ceiling at batch 1 that no kernel can beat**, only precision (fewer bytes) or batching (more tokens per byte-read) can move. **Prefill** is the opposite regime: processing S prompt tokens reuses each weight read S-fold, pushing intensity past the ridge into compute-bound territory (an 8k-token prompt on that 70B model costs ≈ 2·70e9·8192 / 989e12 ≈ **1.2 s of pure compute** at theoretical peak). One machine, two workloads on opposite sides of the roofline — the fact from which batching (file 04), phase separation (Ch09 f09), quantization (file 06), and KV compression (file 03) all follow as corollaries.

## 1. The Roofline, Applied

```text
Figure 1. The roofline for one H100 SXM, with the two inference
phases placed on it.

 attainable        ridge ≈ 295 FLOPs/byte
 TFLOPS   │             ╱────────────── 989 (compute roof)
          │           ╱ ▲
          │         ╱   │ PREFILL: intensity ≈ S (tokens reusing
          │       ╱     │ each weight read) → S ≳ 300 puts long
          │     ╱       │ prompts AT THE ROOF: compute-bound
          │   ╱ ▲
          │ ╱   │ DECODE @ batch B: intensity ≈ B for the weight
          │╱    │ pass (B tokens per read) — but KV reads are
          └──────────── per-sequence and do NOT amortize, so
           1   295      attention stays bandwidth-bound even
        FLOPs/byte      when the MLP crosses the ridge

  Consequences, each one a later file:
  · batch-1 decode wastes ~99.7% of the compute roof → batching
    exists (file 04); its crossover is B* ≈ ridge ≈ 300
  · bytes are the decode currency → quantization pays linearly
    (FP8 halves the floor: 70 GB / 3.35 ≈ 21 ms), and KV bytes
    compete with weight bytes for the same bandwidth (file 03)
  · prefill and decode want different hardware ratios → the
    disaggregation debate (Ch09 f09)
```

**Validity envelope (standard 7)**: this arithmetic assumes a dense decoder-only transformer at theoretical peaks. Corrections the dossier must apply: real kernels reach 40–80% of roofs (file 05 — that gap *is* the kernel engineering agenda); MoE replaces P with *active* parameters per token for FLOPs but not for weight-residency (file 07); speculation changes tokens-per-iteration (file 06); and long-context attention adds an S-scaling KV-read term to decode that eventually dominates the weight term — at which point the model's *attention design* (GQA/MLA, file 03) matters more than its parameter count.

## 2. MFU, MBU, and the Honest Utilization Number

Two efficiency ratios convert the roofline into fleet accounting. **MFU** (model FLOPs utilization, from the [PaLM paper](https://arxiv.org/abs/2204.02311)): observed tokens/s × theoretical FLOPs-per-token ÷ device peak FLOPs — the compute-side truth, meaningful for prefill-heavy and training work (55% is excellent at scale; MegaScale reports 55.2%). **MBU** (model bandwidth utilization): observed tokens/s × bytes-that-must-move-per-token ÷ device bandwidth — the decode-side truth, and the one dashboards omit: a decode fleet at 8% MFU might be at *85% MBU*, i.e., running close to its real roof while looking idle on the compute metric that GPUs are priced by. The review rule: **report the utilization against the binding resource** — MFU for compute-bound phases, MBU for bandwidth-bound ones — because optimizing a decode fleet's MFU is optimizing the wrong denominator, and "our GPUs are only 10% utilized" has launched more wrong projects than any other sentence in this domain.

## 3. The Composition Law — the Capacity Envelope

The chapter's composition law: a serving deployment's capacity is **min over four resources**, each with a per-token or per-sequence demand, and the binding constraint *shifts* with batch size, context length, and precision — so the envelope is a computed surface, not a spec-sheet number:

```text
Figure 2. envelope = min(compute, bandwidth, capacity, interconnect)

  resource       demand                      binds when…
  ─────────────────────────────────────────────────────────────
  HBM capacity   weights + Σ KV + activations   FIRST, always:
    worked: 70B FP16 = 140 GB > 80 GB H100 → the model does not
    fit — TP≥2 before any request is served (file 07); with 2×80
    GB: 160−140 = 20 GB for KV → at 320 KB/token (file 03) ≈
    62k tokens of KV total ≈ eight 8k-context sequences: THE
    BATCH CEILING IS A MEMORY FACT, and it caps the achievable
    intensity from Figure 1
  HBM bandwidth  (weight bytes)/iteration + KV reads   decode,
                 small-batch, long-context regimes
  compute        2·P_active FLOPs/token        prefill, large-
                 batch decode past B*
  interconnect   TP all-reduce per layer       multi-GPU: NVLink
                 (~900 GB/s) inside a node vs PCIe/network across
                 nodes — a 100× cliff that decides topology (f07)
  ─────────────────────────────────────────────────────────────
  The envelope couples to Ch09: its output (max concurrent
  sequences, tokens/s at SLO) is exactly the two-resource budget
  Ch09 f09's admission debits against.
```

The worked chain above is the file's method demonstrated end-to-end: capacity → forced parallelism → KV budget → batch ceiling → achievable intensity → position on Figure 1's roofline → tokens/s at SLO — six derivation steps from public device parameters to an admission budget, each checkable, no benchmarks required (benchmarks then *validate* the chain, G1). A dossier that presents measured throughput without this chain cannot answer the only questions that matter at review: *which resource binds, what would relieve it, and what does the next unit of capacity buy?*

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Derivation gate | The §3 chain computed for each deployment (model, precision, HW, context mix) with the binding resource named per phase | Capacity claims from vendor decks or blog benchmarks with no arithmetic underneath |
| Roofline gate | Every proposed optimization placed on Figure 1: which term (bytes, FLOPs, intensity) it moves, in which phase | Kernel work sold for a bandwidth-bound phase's throughput; "faster" with no resource named |
| Utilization-honesty gate | MFU *and* MBU reported per phase against the binding resource | Decode fleets condemned as idle at 10% MFU while bandwidth-saturated |
| Envelope-coupling gate | The envelope's outputs handed to Ch09 f09's admission as budgets; recomputed on model/precision/HW change | Admission budgets stale against a quantized or re-sharded fleet |
| Envelope-of-the-model gate | The §1 validity corrections applied (kernel efficiency, MoE active params, KV scaling with context) | Theoretical peaks used as promises; dense arithmetic applied to a MoE fleet |

## Output

The output of this file is the chapter's arithmetic spine: per-token FLOPs and bytes derived from the model, the roofline placing prefill and decode on opposite sides of a device's ridge point, the 42-ms batch-1 floor computed rather than benchmarked, MFU/MBU as phase-honest utilization, and the four-resource capacity envelope whose minimum — recomputed per model, precision, and topology — is the budget every admission decision above this runtime spends.

## References

- [Williams, Waterman, Patterson, "Roofline: An Insightful Visual Performance Model" (CACM 2009)](https://dl.acm.org/doi/10.1145/1498765.1498785)
- [Chowdhery et al., "PaLM" (2022) — the MFU definition (Appendix B)](https://arxiv.org/abs/2204.02311)
- [NVIDIA H100 datasheet — the device constants used in every worked number](https://www.nvidia.com/en-us/data-center/h100/)
- [Pope et al., "Efficiently Scaling Transformer Inference" (MLSys 2023) — the inference-arithmetic method this file follows](https://arxiv.org/abs/2211.05102)
- [Kwon et al., PagedAttention (SOSP 2023) — the KV-capacity pressure §3's worked chain quantifies](https://arxiv.org/abs/2309.06180)
