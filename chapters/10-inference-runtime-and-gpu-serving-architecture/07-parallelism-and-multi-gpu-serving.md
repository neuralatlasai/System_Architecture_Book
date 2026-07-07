# Parallelism and Multi-GPU Serving

## Abstract

Multi-GPU serving exists for two reasons with different physics — **the model doesn't fit** (file 02 §3's capacity bind: 140 GB of FP16 70B against 80 GB of H100 forces sharding before the first request) and **the latency floor is too high** (sharding the weight-read across N GPUs divides the bandwidth floor by ~N: tensor-parallel 70B across 4×H100 reads 35 GB/GPU per token ≈ 10.5 ms — the only way below a single device's 42 ms) — and every parallelism scheme is a position in one trade: computation divided against **communication added**, priced by an interconnect hierarchy whose cliffs dwarf every other constant in this chapter (NVLink ≈ 900 GB/s per H100 inside the domain; InfiniBand ≈ 50 GB/s/NIC across nodes; a ~20× step that makes topology the first fact of any parallelism plan). **Tensor parallelism (TP)** splits every layer's matrices across GPUs with an all-reduce per layer boundary — it shrinks per-token latency (the divided weight read) but demands NVLink-class links and burns them per token: at TP=4, a 70B model's per-token all-reduce traffic (2 bytes × hidden dim 8192 × 2 all-reduces × 80 layers ≈ 2.6 MB/token/GPU-pair-hop) is trivial per token but its *latency* (μs-class collective launches × 160 collectives) sets a floor that keeps TP inside nodes. **Pipeline parallelism (PP)** cuts the model into stage groups with only activations crossing the seams — cheap links suffice, but a *pipeline serves latency badly* (a token traverses every stage serially; bubbles waste capacity at low batch), making PP the cross-node capacity tool, not the latency tool. **Expert parallelism (EP)** is MoE's native scheme — experts distributed across GPUs, tokens routed per layer to their experts' hosts — and it inherits MoE's serving asymmetry: FLOPs per token track *active* parameters while memory and placement track *total* parameters (file 02's envelope correction), plus the failure mode the other schemes don't have: **routing skew** — hot experts turn a balanced fleet into a hotspot fleet (Chapter 04 file 01's hot-partition physics, relocated into the forward pass), which is why EP deployments carry per-expert load SLIs and capacity-factor limits the way sharded databases carry per-shard heat maps.

## 1. The Scheme Table and the Interconnect Envelope

```text
Figure 1. What crosses the wire, per scheme — the communication
term that prices each.

  TP (intra-layer):  all-reduce per layer boundary, PER TOKEN
      → needs NVLink-domain latency/bandwidth; TP degree stops
        at the domain edge (8 for HGX-class hosts)
  PP (inter-layer):  activations at stage seams, per microbatch
      → survives cross-node links; adds pipeline depth to TTFT
        and bubbles at low occupancy
  EP (MoE):          token routing (all-to-all) per MoE layer
      → all-to-all is the most topology-sensitive collective;
        wants fat, uniform bisection (rail-optimized fabrics)
  DP (replicas):     nothing (independent replicas; the router
      → file 09)     is the "collective"
  ─────────────────────────────────────────────────────────────
  composition in practice: TP inside the node, PP or DP across
  nodes, EP across the MoE dimension — and the ENVELOPE RULE:
  compute the per-token wire bytes × collective count against
  the link budget BEFORE believing any scaling projection
  (standard 9's derivation duty, applied to the fabric)
```

**Choosing, as arithmetic**: TP degree = the smallest that (a) fits weights + KV budget (file 02 §3) and (b) meets the TPOT floor — never more, because each doubling halves the per-GPU weight read but adds collective latency and halves neither KV traffic nor the sampler; the marginal TPOT gain shrinks while the fabric bill grows (G7's scaling sweep makes the knee visible: TP=2→4 typically strong, 4→8 marginal, 8→16 across nodes usually negative for latency). **Envelope note (standard 7)**: the clean scheme taxonomy assumes homogeneous devices and uniform links; mixed fleets (H100+A100 generations), partially-populated NVLink domains, and oversubscribed fabrics break the symmetry assumptions collectives are tuned for — the all-reduce runs at the *slowest participant's* rate, which is how one degraded link (file 08's failure classes) becomes a fleet-wide TPOT regression with no failed component.

## 2. MoE Serving — Routing Skew and the Two-Denominator Problem

MoE's serving promise — frontier quality at small active-parameter FLOPs (DeepSeek-V3-class: 671B total, ~37B active) — arrives with two denominators the dossier must keep separate: *compute* scales with active params (the cheap denominator marketing quotes) while *memory capacity, weight residency, and EP fabric traffic* scale with total params (the expensive denominator capacity planning must use). The operational core is the router: token→expert assignment is load-sensitive by construction, and skew is the steady state, not the anomaly — training-side tricks (aux losses, bias adjustment) bound it statistically, but serving must handle the instantaneous case: **capacity factors** (per-expert token budgets per batch; overflow tokens dropped-to-dense or re-routed — a *quality* decision requiring file 06's eval gate, since overflow handling changes outputs), **per-expert load/latency SLIs** (the hot-expert dashboard; G7 drills a skewed-traffic scenario deliberately), and placement that respects the all-to-all (experts spread to maximize bisection use, replicated where persistently hot — the same replicate-the-hot-key move as Chapter 08 file 07's cache answer, because it is the same problem). The honest status note: multi-node EP at frontier scale is production-real (DeepSeek's published inference topology) and remains the most operationally demanding deployment shape this chapter covers — a team without dedicated inference-infra capacity should treat frontier-MoE self-hosting as file 01's table already told them to.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Topology gate | The interconnect map (domains, link rates, oversubscription) with each scheme's wire-bytes × collectives computed against it (§1's envelope rule) | Scaling projections that ignore the 20× NVLink/IB cliff; TP spanning nodes |
| Degree gate | TP/PP/EP degrees chosen by the fit + floor arithmetic with G7's scaling sweep showing the knee | Max-TP by default; parallelism degrees inherited from a different model's config |
| Heterogeneity gate | Mixed-generation and degraded-link behavior measured; slowest-participant effects alarmed (with file 08's link health) | The one flaky NVLink lane presenting as a fleet-wide model slowdown |
| MoE-denominator gate | Capacity/costing on total params, FLOPs on active; overflow policy through the eval gate; per-expert SLIs standing | Fleets sized on the 37B number for the 671B bill; token drops changing quality unmeasured |
| Skew gate | G7's skewed-traffic drill; hot-expert playbook (capacity factors, replication) exercised | Routing skew discovered as inexplicable p99; hot experts without the hot-key toolkit |

## Output

The output of this file is a parallelism design that is an interconnect budget before it is a scheme choice: TP sized by the fit-and-floor arithmetic and confined to its NVLink domain, PP and replicas carrying the cross-node scale, MoE served with its two denominators separated and its router treated as the load-skew generator it is — every degree and placement justified by wire-bytes arithmetic and a measured scaling knee rather than by the largest number the cluster supports.

## References

- [Shoeybi et al., "Megatron-LM" (2019) — tensor parallelism's canonical formulation](https://arxiv.org/abs/1909.08053)
- [Pope et al., "Efficiently Scaling Transformer Inference" (MLSys 2023) — the TP/PP latency-throughput trades formalized](https://arxiv.org/abs/2211.05102)
- [DeepSeek-AI, "DeepSeek-V3 Technical Report" — frontier MoE inference topology (EP at scale)](https://arxiv.org/abs/2412.19437)
- [NVIDIA — NVLink and NVSwitch (the intra-domain numbers)](https://www.nvidia.com/en-us/data-center/nvlink/)
- [Ghodsi et al., DRF (NSDI 2011) — the multi-resource sharing arithmetic EP fleets inherit via Ch09 f06](https://www.usenix.org/conference/nsdi11/dominant-resource-fairness-fair-allocation-multiple-resource-types)
