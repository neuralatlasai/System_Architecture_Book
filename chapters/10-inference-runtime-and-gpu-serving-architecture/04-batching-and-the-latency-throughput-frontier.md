# Batching and the Latency-Throughput Frontier

## Abstract

Batching is the only mechanism that moves decode up the roofline — file 02's arithmetic made batch size the intensity dial (B tokens per weight read), and this file owns its execution and its price. The price is structural, not incidental: every sequence in an iteration shares that iteration's wall-clock, so **batch size buys throughput with everyone's TPOT** — the relationship between tokens/s (fleet) and ms/token (per user) is a Pareto frontier, and a serving configuration is a *chosen point* on it (Chapter 09 file 09 demanded the position be stated; this file supplies the curve). The execution machinery is continuous batching's runtime half (admission was Ch09's): per-iteration batch recomposition over the paged KV pool (file 03), **chunked prefill** interleaving prompt-processing slices into decode iterations so TTFT work stops stalling TPOT work (Sarathi's stall-free schedule, executed at the batch composer), and the systems detail that dominates small-batch regimes: **launch overhead** — a decode iteration is dozens of small kernels whose per-launch CPU cost rivals their GPU cost at low batch, which is why runtimes capture the decode step as a **CUDA graph** (one launch replays the whole iteration) and why vLLM V1's re-architecture targeted exactly the scheduler-to-GPU gap (zero-copy, pinned-memory paths). The file's worked frontier: the same 70B/2×H100 deployment from file 02 §3 at batch 1 decodes at ~24 tok/s/user (the bandwidth floor) and ~24 tok/s fleet-wide; at batch 32, per-user TPOT degrades ~1.5–2× (KV reads and attention now share the iteration) while fleet throughput rises ~20×+ — and *which point is correct is a product decision* (interactive chat wants the left edge; batch summarization wants the right), which is why one fleet serving both classes without Ch09 f06's class separation is serving neither.

## 1. The Frontier, and Choosing a Point on It

```text
Figure 1. The latency-throughput frontier (one model, one topology;
axes move with precision and context mix).

  fleet tok/s
      │                                ● B=64   ← batch jobs,
      │                          ● B=32           evals, offline
      │                    ●
      │              ● B=8        the KNEE: where marginal
      │        ●                  throughput per TPOT-ms spent
      │  ● B=1                    collapses — find it by G2's
      └──────────────────────────  sweep, not by folklore
        24 ms      ~35–50 ms     per-user TPOT →

  rules the curve imposes:
  · the config IS the point: max batch tokens, chunk size, max
    KV occupancy — each dossier states its point and the SLO
    that chose it
  · heterogeneous SLOs ⇒ separate pools or weighted admission
    (Ch09 f06) — one knee cannot serve two masters
  · the curve SHIFTS: quantization moves the floor (file 06),
    context mix moves the KV share (file 03) — re-sweep on
    serving-generation change (G2's stamp)
```

## 2. Composing the Iteration — Chunked Prefill and Interference

The batch composer's problem each iteration: some admitted sequences need prefill (thousands of tokens of compute), others need one decode step each (bandwidth), and a naive composer that admits a whole prefill stalls every decode for the prefill's duration — the TPOT spikes that made static systems unshippable for chat. Chunked prefill is the settled fix (Ch09 f09 chose it; here is its execution contract): prefills are sliced to a **token budget per iteration** (chunk size), each iteration carrying all decodes + at most one chunk's worth of prefill, so decode cadence stays flat while prefill progresses in the gaps. The tuning triangle the dossier must state: chunk size up → TTFT down, TPOT jitter up; token budget up → throughput up, worst-case iteration time up; and the **interference floor is measurable, not zero** — a decode iteration sharing the GPU with a prefill chunk pays cache/bandwidth contention even when stall-free on paper, which is G5's noisy-batchmate drill (measure TPOT distribution with and without co-resident prefill at the production mix) and the honest input to the disaggregation decision (Ch09 f09: when the measured interference at your mix exceeds the KV-transfer cost, separate the pools; not before). **Envelope note (standard 7)**: chunked prefill's flat-TPOT claim assumes prefill chunks are compute-bound and decodes bandwidth-bound (complementary resources); very short prompts (chunks below the intensity crossover) and very long contexts (decode attention itself compute-heavy) erode the complementarity — the technique's benefit is mix-dependent and re-measured, not assumed.

## 3. The Small-Batch Regime — Launch Overhead and CUDA Graphs

At the frontier's left edge the GPU is not the bottleneck — the CPU feeding it is. A decode iteration executes O(layers) small kernels; at 5–10 µs of launch overhead each, an 80-layer model's iteration can spend *milliseconds* in the CUDA driver while the kernels themselves (bandwidth-bound, tiny at low batch) finish faster than they launch. **CUDA graphs** amortize this: capture the iteration's kernel DAG once, replay it as a single launch — standard practice in production engines, with the operational costs the dossier must carry: graphs are captured per *shape bucket* (batch size × context bucket), so warmup must exercise the bucket set (file 08's cold-start inventory grows), memory is retained per captured graph, and shape-diverse traffic degrades to eager mode (the G1 validation run must include the traffic's real shape distribution, or the benchmark ran a different system than production does). The same left-edge accounting covers the sampler (top-p over a 128k-token vocabulary is a real kernel, not a footnote) and Python-in-the-loop overheads that V1-class re-architectures exist to remove — the general law: **at low batch, count CPU microseconds with the same seriousness as GPU bandwidth**, because the roofline says the GPU work is small and Amdahl says everything else therefore matters.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Frontier gate | The G2 sweep (batch/chunk/budget vs TTFT/TPOT/throughput) at the production mix; the chosen point stated with its SLO rationale | Config defaults as the frontier position; one pool serving incompatible SLO classes |
| Interference gate | G5's noisy-batchmate measurement (TPOT distribution ± co-resident prefill); the disaggregation decision made against this number | Stall-free claimed from the paper rather than measured at the mix; TPOT jitter shipped as model variance |
| Composition gate | Chunk size / token budget stated with the tuning-triangle trade; envelope conditions (§2) checked against the prompt-length mix | Chunked prefill cargo-culted onto a short-prompt workload it cannot help |
| Launch-overhead gate | CUDA-graph (or equivalent) coverage of the shape buckets traffic actually hits; warmup exercises the bucket set; eager-fallback rate as an SLI | Millisecond driver overhead at the left edge; benchmarks on graph-covered shapes, production on eager fallbacks |
| Re-sweep gate | Frontier re-measured on serving-generation change (model, precision, topology, engine) | Last quarter's knee steering this quarter's fleet |

## Output

The output of this file is a batching design that knows what it bought and what it paid: a measured latency-throughput frontier with the deployment's point chosen by SLO rather than default, iteration composition that keeps prefill from taxing decode with the residual interference measured instead of denied, and the small-batch CPU economics — launches, graphs, sampler — accounted with the same rigor as HBM bandwidth, because at the frontier's left edge they are the bottleneck.

## References

- [Yu et al., "Orca" (OSDI 2022) — iteration-level batching, the mechanism this file executes](https://www.usenix.org/conference/osdi22/presentation/yu)
- [Agrawal et al., "Sarathi-Serve" (OSDI 2024) — chunked prefill and the stall-free schedule](https://www.usenix.org/conference/osdi24/presentation/agrawal)
- [vLLM V1 — the scheduler/executor re-architecture targeting exactly this file's overheads](https://vllm.ai/blog/2025-01-27-v1-alpha-release)
- [NVIDIA — CUDA Graphs (launch-overhead amortization)](https://developer.nvidia.com/blog/cuda-graphs/)
- [Pope et al., "Efficiently Scaling Transformer Inference" (MLSys 2023) — the batch/latency trade formalized](https://arxiv.org/abs/2211.05102)
