# KV Cache Management and Paged Memory

## Abstract

The KV cache is the state that makes autoregressive generation affordable — attention over past tokens re-reads their cached keys/values instead of recomputing them — and its size is a derivation every review performs: **KV bytes per token = 2 (K and V) × n_layers × n_kv_heads × d_head × bytes-per-element**. Worked for Llama-3-70B (80 layers, 8 KV heads under GQA, head dim 128, FP16): 2·80·8·128·2 = **320 KB per token** — so one 8k-context sequence holds 2.6 GB, a 128k-context sequence holds **40 GB (half an H100)**, and file 02's envelope makes the consequence exact: KV competes with weights for both HBM *capacity* (the batch ceiling) and HBM *bandwidth* (the per-iteration read). The management problem this creates was solved by transplanting a fifty-year-old idea: pre-PagedAttention runtimes allocated each sequence's KV as one contiguous region sized for the maximum possible length, and the resulting internal fragmentation plus reservation waste consumed **60–80% of KV memory** in production traces; **PagedAttention** ([Kwon et al., SOSP 2023](https://arxiv.org/abs/2309.06180)) allocates KV in fixed-size blocks (typically 16 tokens) mapped through a per-sequence block table — virtual memory for attention state — cutting waste to under 4% and enabling the copy-on-write block *sharing* that makes prefix caching (Chapter 08 file 09's economics) an O(1) block-table operation rather than a copy. The file's second half is the compression ladder, because at long context the KV term dominates the envelope and every KV byte removed is bandwidth and batch ceiling returned: **architecture-side** — GQA (share KV heads across query heads: the 8-of-64 heads above is an 8× saving already priced into the model) and **MLA** (DeepSeek's latent-space compression: cache a low-rank latent instead of full K/V, ≈9× smaller than MHA *with* quality parity per DeepSeek's ablations — the frontier's current answer, shipping in DeepSeek-V3); and **serving-side** — KV quantization (FP8/INT4 KV at measured quality cost, file 06's gate applies) and eviction/offload tiers (Ch09 f09's priced preemption; Mooncake's DRAM/SSD pool).

## 1. Paged Memory — the Mechanism and What It Buys

```text
Figure 1. PagedAttention: block tables turn KV allocation into
paging, and prefix sharing into refcounting.

  sequence A: [blk 7][blk 2][blk 9][blk 4…]   ← logical order,
  sequence B: [blk 7][blk 2][blk 5]              physical anywhere
                 └──┬──┘
        shared system-prompt prefix: SAME physical blocks,
        refcount=2; divergence → copy-on-write of the last
        partial block only
  ─────────────────────────────────────────────────────────────
  what it buys, quantified:
  · fragmentation: 60–80% waste → <4% (the SOSP paper's traces)
    = 2–4× more concurrent sequences on the same HBM (file 02's
    batch ceiling, raised by bookkeeping alone)
  · prefix reuse: Ch08 f09's hit economics, executed as block-
    table pointers — hash-per-block (tokens + all prior tokens)
    keys the global block pool (vLLM V1 default-on)
  · the costs, honestly: block-table indirection in the attention
    kernel (~single-digit % — file 05's kernels absorbed it);
    block size trades internal fragmentation (large blocks)
    against table overhead (small blocks)
```

Operational rules the mechanism implies. **KV is a managed heap with SLIs**: allocation rate, occupancy by state (active / cached-reusable / free), and *preemption pressure* (Ch09 f09's eviction economics — swap-vs-recompute events per hour) are dashboard rows, because "GPU OOM" in a paged runtime is an admission bug (the scheduler over-admitted against the KV budget), not a mystery. **Cache keys inherit Chapter 08's closure law**: block hashes must incorporate everything that changes attention state — model version, tokenizer version, template — or prefix "hits" serve another model's attention (Ch08 f09's version-closure gate, enforced at the block pool). **Sharing is a tenancy surface**: cross-request block sharing is safe only because blocks are keyed by *exact token content* — a system that relaxed the hash to "similar" would be building Ch08 §2's semantic-cache wrongness into attention state itself.

## 2. The Compression Ladder

| Rung | Mechanism | Saving vs MHA | Cost / envelope |
|---|---|---|---|
| MQA (1 KV head) | All query heads share one K/V head | ~n_heads× (64×) | Measurable quality loss (~1.5 ppl in DeepSeek's ablations); largely superseded |
| GQA (grouped heads) | Query heads share g KV-head groups ([Ainslie et al.](https://arxiv.org/abs/2305.13245)) | n_heads/g× (8× typical) | Small quality cost; *the* deployed default (Llama-class) — a model-architecture decision you inherit, not a serving knob |
| MLA (latent) | Cache low-rank latent; up-project at use ([DeepSeek-V2](https://arxiv.org/abs/2405.04434)) | ≈9× vs MHA, ≈2× vs 8-group GQA | Quality *parity or better* per published ablations; extra up-projection compute (cheap where bandwidth binds); frontier-adopted (V3), spreading via conversion work (TransMLA-class) |
| KV quantization | FP8/INT4 KV elements | 2–4× more | Quality cost real and workload-dependent — file 06's eval gate applies to KV precision exactly as to weights |
| Offload/eviction | Cold KV to DRAM/SSD (Mooncake tiers) | Capacity, not bandwidth | Resume latency; Ch09 f09's swap-vs-recompute price list governs |

The review's reading of the ladder: the top three rungs are **model-selection criteria** (a serving team choosing between two comparable models should weight KV-per-token as heavily as quality benchmarks — it is the difference between 8 and 70 concurrent 8k sequences per GPU pair, file 02 §3), the bottom two are **serving decisions** with quality/latency gates. And the ladder composes: MLA + FP8 KV ≈ 18× less KV bandwidth and capacity per token than FP16 MHA — which at 128k context is the difference between "half an H100 per sequence" and "2.2 GB per sequence," i.e., between a demo and a product.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Derivation gate | KV bytes/token computed for the deployed model; the KV budget line in file 02's envelope; batch ceiling stated at the context mix | Context-length promises made without the 320-KB-class multiplication |
| Paging gate | Paged allocation with fragmentation measured (<5%-class); block-pool SLIs (occupancy by state, preemption pressure) standing | Contiguous max-length allocation; OOMs treated as weather instead of admission bugs |
| Closure gate | Block hashes cover model/tokenizer/template versions; cross-version reuse impossible by construction (G4 drills it) | Prefix hits serving stale attention state after a rollout |
| Ladder gate | KV-per-token weighted in model selection; serving-side rungs (KV quant, offload) admitted only through file 06's eval gate and Ch09's preemption pricing | 128k-context features shipped on an MHA-era memory diet; KV quantized by config flag without a quality run |
| Sharing-safety gate | Block sharing keyed by exact content; per-tenant isolation of any pool statistics that leak usage | Approximate KV sharing; cross-tenant timing signals from a shared block pool |

## Output

The output of this file is a KV design derived, paged, and compressed with its books open: bytes-per-token computed rather than discovered, block-table paging holding fragmentation under measurement with prefix sharing as refcounted block reuse under full version closure, and the compression ladder applied in the right register — architecture rungs as model-selection criteria, serving rungs behind quality gates — so the state that dominates long-context serving is a budgeted resource instead of an ambient surprise.

## References

- [Kwon et al., "Efficient Memory Management for Large Language Model Serving with PagedAttention" (SOSP 2023)](https://arxiv.org/abs/2309.06180)
- [Ainslie et al., "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints" (2023)](https://arxiv.org/abs/2305.13245)
- [DeepSeek-AI, "DeepSeek-V2" (2024) — Multi-head Latent Attention and its ablations](https://arxiv.org/abs/2405.04434)
- [vLLM — Automatic Prefix Caching design (block hashing; the paged pool as a cache)](https://docs.vllm.ai/en/latest/design/prefix_caching.html)
- [Qin et al., "Mooncake" (FAST 2025) — KV offload tiers at production scale](https://www.usenix.org/system/files/fast25-qin.pdf)
