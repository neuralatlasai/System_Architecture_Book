# Chapter 10 — Inference Runtime and GPU Serving Architecture

## Abstract

This chapter's claim is that inference serving is a physics problem before it is a systems problem: a dense transformer must move ~2 bytes per parameter past the compute for every token it decodes, and that single fact — placed against a device whose compute-to-bandwidth ratio is ~300 FLOPs/byte — derives the field's entire agenda: why decode is bandwidth-bound and prefill is not (the roofline), why batching exists and what it costs (the latency-throughput frontier), why the KV cache is the currency of long context (320 KB/token compounding into half a GPU per sequence), why precision is a serving decision (bytes are the denominator), why speculation helps exactly when the fleet is idle, and why parallelism is an interconnect budget with a 20× cliff in the middle of it. The chapter is written to the standard it introduces (standard 9): every capacity claim is *derived* from device parameters with the arithmetic shown — the 42-ms batch-1 floor for a 70B model on an H100 is a division, not a benchmark — and benchmarks appear only to validate derivations. Around the arithmetic sit the disciplines the machinery demands: eval gates wherever numerics or sampling can change outputs, version closure treating quantization and engine builds as part of model identity, fleet operations run against published GPU failure rates, routing that speaks token-cost and cache-match instead of QPS, and a verification regime whose canary spine gates every change on quality and latency as one promotion decision.

## Chapter Structure

| File | Claim it carries |
|---|---|
| [00-chapter-file-map.md](00-chapter-file-map.md) | Reading order, approval dependency graph, prerequisites from Chapters 01–09 |
| [01-the-serving-runtime-and-the-buy-vs-run-decision.md](01-the-serving-runtime-and-the-buy-vs-run-decision.md) | The token pipeline's anatomy and contracts; when NOT to run your own inference |
| [02-transformer-inference-arithmetic.md](02-transformer-inference-arithmetic.md) | The roofline; the 42-ms floor derived; MFU/MBU; the four-resource capacity envelope (the composition law) |
| [03-kv-cache-management-and-paged-memory.md](03-kv-cache-management-and-paged-memory.md) | 320 KB/token derived; PagedAttention (60–80% waste → <4%); the GQA/MLA/quantization compression ladder |
| [04-batching-and-the-latency-throughput-frontier.md](04-batching-and-the-latency-throughput-frontier.md) | The frontier as a chosen point; chunked-prefill execution and measured interference; CUDA graphs at the left edge |
| [05-attention-kernels-and-runtime-optimization.md](05-attention-kernels-and-runtime-optimization.md) | IO-aware attention (bytes, not FLOPs); kernel provenance; fusion; the CPU stages that starve GPUs |
| [06-quantization-and-speculative-decoding.md](06-quantization-and-speculative-decoding.md) | Precision behind workload-shaped eval gates; speculation's load envelope (2.3× at batch 4 → 1.0× at 32) |
| [07-parallelism-and-multi-gpu-serving.md](07-parallelism-and-multi-gpu-serving.md) | TP/PP/EP as wire-bytes arithmetic; the NVLink/IB cliff; MoE's two denominators and routing skew |
| [08-reliability-and-fleet-operations.md](08-reliability-and-fleet-operations.md) | GPU failure taxonomy at published rates; cold-start budgets; stream-aware drains; the one-unit serving artifact |
| [09-serving-topologies-and-the-inference-gateway.md](09-serving-topologies-and-the-inference-gateway.md) | Cache-aware routing with bounded affinity; disaggregated pools; LoRA multiplexing; token-metric autoscaling |
| [10-verification-of-serving-contracts.md](10-verification-of-serving-contracts.md) | Drills G1–G10 pairing performance with output stability; the determinism posture; five-field serving-generation stamps |
| [11-serving-review-templates.md](11-serving-review-templates.md) | The ten-section dossier and 26-point reviewer checklist |

## Source Corpus

| Source | What this chapter takes from it |
|---|---|
| [Williams et al., "Roofline" (CACM 2009)](https://dl.acm.org/doi/10.1145/1498765.1498785) + [Pope et al., "Efficiently Scaling Transformer Inference" (MLSys 2023)](https://arxiv.org/abs/2211.05102) | The performance model and its transformer-inference application — file 02's method |
| [Kwon et al., "PagedAttention" (SOSP 2023)](https://arxiv.org/abs/2309.06180) | Paged KV memory; the 60–80% fragmentation finding; block-level sharing |
| [Dao et al., FlashAttention (NeurIPS 2022)](https://arxiv.org/abs/2205.14135) / [FA2](https://arxiv.org/abs/2307.08691) / [Shah et al., FA3 (2024)](https://arxiv.org/abs/2407.08608) | IO-aware exact attention; the kernel lineage with per-generation hardware coupling |
| [Ainslie et al., GQA (2023)](https://arxiv.org/abs/2305.13245) + [DeepSeek-V2 — MLA (2024)](https://arxiv.org/abs/2405.04434) + [DeepSeek-V3 (2024)](https://arxiv.org/abs/2412.19437) | The KV compression ladder's architecture rungs; frontier MoE/EP serving topology |
| [Yu et al., Orca (OSDI 2022)](https://www.usenix.org/conference/osdi22/presentation/yu) + [Agrawal et al., Sarathi-Serve (OSDI 2024)](https://www.usenix.org/conference/osdi24/presentation/agrawal) + [Zhong et al., DistServe (OSDI 2024)](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin) | Iteration batching, chunked prefill, disaggregation — the execution layer under Ch09's decisions |
| [Leviathan et al. (ICML 2023)](https://arxiv.org/abs/2211.17192) + [Chen et al. (2023)](https://arxiv.org/abs/2302.01318) + [EAGLE-3 (2025)](https://arxiv.org/abs/2503.01840) | Speculative decoding's distribution-preservation proof and its measured load envelope |
| [GPTQ](https://arxiv.org/abs/2210.17323) / [AWQ (MLSys 2024)](https://arxiv.org/abs/2306.00978) + [NVIDIA Transformer Engine](https://docs.nvidia.com/deeplearning/transformer-engine/user-guide/index.html) | The quantization ladder and its hardware paths (FP8/FP4 statuses verified at write time) |
| [Shoeybi et al., Megatron-LM (2019)](https://arxiv.org/abs/1909.08053) | Tensor parallelism's formulation — file 07's wire-bytes arithmetic |
| [Grattafiori et al., "The Llama 3 Herd of Models" (2024)](https://arxiv.org/abs/2407.21783) | The GPU reliability corpus: 419 interruptions / 54 days / 16,384 H100s |
| [Zheng et al., SGLang (2023)](https://arxiv.org/abs/2312.07104) + [SGLang v0.4 router](https://www.lmsys.org/blog/2024-12-04-sglang-v0-4/) + [llm-d](https://llm-d.ai/) + [NVIDIA Dynamo (1.0 GA, 2026)](https://developer.nvidia.com/dynamo) | RadixAttention; cache-aware routing; the inference-gateway consolidation (statuses verified) |
| [Sheng et al., S-LoRA (MLSys 2024)](https://arxiv.org/abs/2311.03285) | Adapter multiplexing at scale |
| [Thinking Machines Lab, "Defeating Nondeterminism in LLM Inference" (2025)](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/) + [SGLang deterministic mode](https://www.lmsys.org/blog/2025-09-22-sglang-deterministic/) | Batch invariance — the determinism posture file 10 makes mandatory to declare |
| [NVIDIA DCGM](https://developer.nvidia.com/dcgm) + [Xid reference](https://docs.nvidia.com/deploy/xid-errors/index.html) + [H100 datasheet](https://www.nvidia.com/en-us/data-center/h100/) | Health telemetry, the hard-fault taxonomy, and the device constants under every worked number |

## Chapter Standards

1. Research-note structure per file: Abstract → numbered sections with formal models → ASCII figures ("Figure N.") → decision tables → approval gates → Output → verified primary-source references.
2. **First-principles capacity arithmetic (standard 9, introduced here, binding for subsequent chapters): every capacity/latency claim is derived from device parameters (FLOPs, bandwidth, capacity, interconnect) with the arithmetic shown; benchmarks validate derivations, never replace them.**
3. The when-NOT decision is first-class: buy-vs-run with SLO-honest utilization and a re-decision date (file 01 §1).
4. Every optimization names the term it moves (TTFT/TPOT, bytes/FLOPs, which phase, which class) — "faster" is not a reviewable claim.
5. The composition law is the four-resource capacity envelope (file 02 §3), computed per deployment, recomputed per generation, and handed to Ch09's admission as budgets.
6. Validity envelopes on every model and technique (standard 7): the roofline's corrections, chunked prefill's mix-dependence, speculation's load curve, the scheme table's homogeneity assumptions.
7. Anything that can change outputs ships only through workload-shaped eval gates, with the delta recorded beside the win (file 06); exact techniques are kept structurally separate from quality-bearing ones.
8. Version closure is total: weights + quantization + engine + kernels + serving config are one artifact, in every cache key, route, eval record, and rollback (files 03/06/08).
9. Utilization is reported against the binding resource — MBU for bandwidth-bound phases, MFU for compute-bound — never the wrong denominator.
10. Fleet reliability is engineered at published failure rates, in parallelism-group units, with active probes for the degradations that fail nothing.
11. Cold starts, drains, and rollouts are budgeted lifecycle events; the rollout is also a cache-invalidation event and is warmed accordingly.
12. Routing speaks token-cost and cache-match with bounded affinity; router state is advisory, worker admission authoritative.
13. Every stated law/formula carries at least one worked numeric example (42 ms; 320 KB/token; 40 GB at 128k; 2.6 MB/token TP traffic; 2.3×→1.0× speculation decay; 419/54/16,384).
14. The research frontier (≤3-year-old peer-reviewed work) is evaluated with explicit adoption-status judgments (MLA, FA3, FP4, EAGLE-3, Dynamo/llm-d — all dated).
15. Version-status claims are search-verified at write time and stated inline (vLLM V1; FA3's engine-vs-library status; Dynamo 1.0 GA March 2026; gang scheduling via Ch09).
16. The determinism posture is declared and honored: documented nondeterminism, or bitwise-proven batch invariance — never implied reproducibility (file 10).
17. Verification pairs performance drills with output-stability drills under five-field serving-generation stamps; load is generated open-loop in tokens; the canary spine (G10) is the standing re-minting machine.
18. The chapter approves serving-runtime and fleet decisions only; admission, caching, API lifecycles, and agent loops are cited prerequisites (file 11 §4).
19. The README carries an Open Problems section (standard 8).

## Chapter Completion Gate

The chapter is complete for a given system only when its review can answer:

1. Why are we running our own inference — with the crossover arithmetic at SLO-permitted utilization, and when is that decision re-examined?
2. For each deployment: what does the six-step derivation chain yield, which resource binds per phase, and how close did G1's validation land?
3. What is KV bytes-per-token, what batch ceiling does it imply at the context mix, and where does the deployment sit on the compression ladder?
4. Where on the measured latency-throughput frontier does each pool run, chosen by which SLO, and what does G5 say interference costs?
5. Which kernel generations are actually engaged in the deployed build, and what does the op breakdown say the next optimization should be?
6. For every quantization and speculation decision: what eval delta was recorded beside the win, and what does the speedup-vs-load curve say about when it pays?
7. What does the wire-bytes arithmetic say about each parallelism degree, and where is the measured scaling knee?
8. At published failure rates, how many group-unit spares does the fleet carry, and how long are the measured cold-start and rollback budgets?
9. What does the router know (cost function, signals), and what happened in the hot-prefix flood?
10. What determinism promise does this fleet make, and how is it proven — or documented as absent?

## Open Problems

Stated honestly, per this chapter's standard: **(1) Deterministic serving at production efficiency** — batch-invariant kernels prove bitwise stability is achievable, but the throughput cost of invariance at scale, and determinism across engine/hardware generations, remain open; the industry's default posture is still documented nondeterminism. **(2) The aggregation-vs-disaggregation frontier** (inherited from Ch09, unresolved from this side too): the break-even surface across prompt/output ratios, SLO tightness, and fabric cost has no closed form — per-fleet measurement remains the only honest method. **(3) MoE serving under adversarial or shifted routing distributions**: capacity factors bound instantaneous skew, but worst-case expert-load guarantees under distribution shift — and the quality accounting of overflow policies at scale — are unsettled. **(4) Quality-preserving compression's limits**: each rung (FP4, aggressive KV quantization, extreme sparsity) ships with workload-conditional evidence; a predictive theory of *which* workloads a given compression harms does not exist, which is why this chapter's answer is an eval gate rather than a formula. **(5) Energy and carbon per token** as a first-class serving metric: the arithmetic exists (joules per byte moved, per FLOP), but standardized accounting and SLO integration are immature — a gap this book expects the field to close within the shelf life of this chapter.

## Final Position

A serving fleet is a machine for turning capital expenditure into tokens under promises, and this chapter's discipline is that every link in that conversion — bytes moved, iterations composed, precision chosen, GPUs pooled, requests routed — is derived, gated, and stamped rather than benchmarked into folklore. The seam forward: this chapter produced tokens under contract; [Chapter 11](../11-agentic-orchestration-and-tool-routing/README.md) turns to the loops that *consume* them — agentic orchestration and tool routing, where the model's output becomes the system's next input, episode budgets meet tool schemas, and every contract this book has built gets exercised by a caller that iterates at machine speed.

## References

- [Pope et al., "Efficiently Scaling Transformer Inference" (MLSys 2023)](https://arxiv.org/abs/2211.05102)
- [Kwon et al., "PagedAttention" (SOSP 2023)](https://arxiv.org/abs/2309.06180)
- [Grattafiori et al., "The Llama 3 Herd of Models" (2024)](https://arxiv.org/abs/2407.21783)
- [Thinking Machines Lab, "Defeating Nondeterminism in LLM Inference" (2025)](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)
