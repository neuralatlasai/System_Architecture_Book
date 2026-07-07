# Serving Review Templates

## Abstract

This file assembles the chapter into its executable form: the dossier a team completes to put a serving deployment — buy-vs-run verdict to canary spine — in front of an architecture review, and the checklist the reviewer walks to approve it. The organizing principle is the chapter's root discipline made procedural: every serving claim must trace to arithmetic (which resource binds, per file 02's chain), every optimization must name the term it moves (TTFT or TPOT, bytes or FLOPs, for which class), and every technique that can touch outputs must carry its eval evidence — because this is the chapter where "faster" can silently mean "different answers," and the dossier's job is to make that impossibility structural. Evidence citations must satisfy file 10's stamp discipline: dated, serving-generation-stamped (model/engine/config/fleet/mix), open-loop-in-tokens where load-generated, and re-minted by the canary spine where the pipeline can carry them.

## 1. Dossier Assembly

```text
Figure 1. Dossier assembly: each section is produced by one file's
gates; the checklist consumes the whole.

  f01 ─► §A verdict & anatomy       f06 ─► §F precision & speculation
  f02 ─► §B the arithmetic chain    f07 ─► §G parallelism & MoE
  f03 ─► §C KV design               f08 ─► §H fleet operations
  f04 ─► §D the frontier position   f09 ─► §I topology & routing
  f05 ─► §E kernels & CPU stages    f10 ─► §J evidence ledger
                     │
                     v
        reviewer checklist (§3) ─► approve deployment / findings
```

## 2. The Serving Surface Dossier

**§A Verdict and anatomy (file 01).** The buy-vs-run table applied per model class with SLO-honest crossover arithmetic and a re-decision date. The pipeline instantiated; TTFT/TPOT decomposition per work class; the cancellation path with its measured abort-to-cull latency; CPU-stage throughput against GPU capacity.

**§B The arithmetic chain (file 02).** The six-step derivation per deployment: capacity → parallelism → KV budget → batch ceiling → roofline position → tokens/s at SLO, with the binding resource named per phase, MFU/MBU reported against it, and G1's validation within the stated kernel-efficiency band.

**§C KV design (file 03).** Bytes-per-token computed; paging with fragmentation and pool SLIs; block-hash closure over model/tokenizer/template; the compression ladder's position (architecture rungs weighted in model selection; serving rungs behind the eval gate); preemption economics per Ch09.

**§D The frontier position (file 04).** G2's sweep at the production mix; the chosen point with its SLO rationale; chunk/budget tuning with the triangle stated; G5's interference numbers and the disaggregation decision made against them; CUDA-graph bucket coverage and eager-fallback rate.

**§E Kernels and CPU stages (file 05).** G3's op breakdown; kernel provenance (generation, engagement) verified in the deployed build; fusion coverage; tokenizer/sampler/streamer throughput with structured-output sampling via compiled automata.

**§F Precision and speculation (file 06).** Per (model, format, workload): the eval deltas beside the latency wins; quantization config inside the version everywhere; the speculation speedup-vs-batch curve with adaptive engagement (or the static choice justified); acceptance-rate SLIs with drift alarms.

**§G Parallelism and MoE (file 07).** The interconnect map with wire-bytes arithmetic per scheme; degrees at G7's measured knee; heterogeneity/degraded-link behavior; MoE's two denominators separated; overflow policy through the eval gate; per-expert SLIs and the hot-expert playbook.

**§H Fleet operations (file 08).** Health machinery (telemetry + active probes) with slowest-participant alarms; failure domains in group units with N+k at measured rates; the G8 cold-start budget; stream-aware drain with its deploy-velocity bound; the one-unit serving artifact with G10's canary and rehearsed rollback.

**§I Topology and routing (file 09).** The router's cost function and signals; G9's hot-prefix flood result; advisory-state/authoritative-admission separation; pool design (disaggregation priced on the interconnect, per-pool frontier points and scaling signals); adapter multiplexing tenancy; token-metric autoscaling with the cold-start gap bridged.

**§J Evidence ledger (file 10).** G1–G10 status: date, result, five-field stamp; the determinism posture declared and honored; standing SLIs with derived bounds printed; gaps as *assumed* with expiry; the canary spine's promotion gates.

## 3. Reviewer Checklist

| # | Check | Source gate | Common failure it catches |
|---:|---|---|---|
| 1 | Buy-vs-run decided with SLO-honest utilization and a re-decision date | f01 buy-vs-run | Self-hosting by identity; 70%-utilization fictions |
| 2 | Every optimization names its term (TTFT/TPOT, phase, class) | f01 anatomy + f02 roofline | "Faster" with no term; TTFT sold, TPOT paid |
| 3 | Cancellation culls at iteration boundaries; abort-to-cull measured | f01 cancellation | GPUs decoding to disconnected sockets |
| 4 | The §B chain computed; binding resource named; MFU *and* MBU per phase | f02 derivation + honesty | Vendor-deck capacity; 10%-MFU panic on a bandwidth-saturated fleet |
| 5 | Envelope outputs handed to Ch09's admission as budgets, recomputed on change | f02 coupling | Admission debiting stale budgets |
| 6 | KV bytes/token derived; paging SLIs standing; batch ceiling stated at the mix | f03 derivation + paging | Context promises without the multiplication; OOM-as-weather |
| 7 | Block-hash closure over model/tokenizer/template; G4 clean per rollout | f03 closure | Prefix hits serving the previous model's attention |
| 8 | KV-per-token weighted in model selection; KV quant/offload gated | f03 ladder | 128k features on an MHA memory diet |
| 9 | G2's frontier swept at the mix; the deployed point has an SLO rationale | f04 frontier | Config defaults as strategy; one knee for two SLO classes |
| 10 | Interference measured (G5); disaggregation decided against the number | f04 interference | Stall-free by citation; disaggregation by fashion |
| 11 | Graph/shape-bucket coverage matches traffic; fallback rate as SLI | f04 launch-overhead | Benchmarks on graphs, production on eager |
| 12 | G3 breakdown current; kernel provenance and fusion engagement verified in the build | f05 all | Paper speedups for kernels the build doesn't run; the unexplained 15% |
| 13 | CPU stages provisioned; structured output via compiled automata; UTF-8-safe streaming | f05 CPU-stage | The single-threaded tokenizer; JSON mode as TPOT tax |
| 14 | Quantization through workload-shaped evals; config inside the version everywhere | f06 eval + closure | Config-flag FP8; "same model, just quantized" |
| 15 | Numerics re-evaled on engine bumps (G6 in canary) | f06 re-eval | Quality drift inside performance upgrades |
| 16 | Speculation's speedup-vs-batch curve measured; engagement adaptive or justified; acceptance SLI standing | f06 speculation | Batch-1 benchmarks billed at batch 48; the drafter that stopped helping |
| 17 | Wire-bytes arithmetic against the interconnect map; degrees at the G7 knee; TP inside its domain | f07 topology + degree | Scaling projections over the 20× cliff; max-TP reflexes |
| 18 | MoE: capacity on total params, FLOPs on active; overflow gated; per-expert SLIs + skew drill | f07 MoE | Fleets sized on the marketing denominator; silent token drops |
| 19 | Health telemetry + active probes; slowest-participant alarms; domains in group units, N+k at measured rates | f08 health + domain | The flaky lane taxing eight GPUs; spares counted in devices |
| 20 | G8 cold-start budget met fleet-wide; drain stream-aware with the velocity bound stated | f08 cold-start + drain | Container-time assumptions on 140-GB artifacts; kill-deploys mid-stream |
| 21 | The serving artifact one-versioned; G10 canary gates on quality *and* latency; rollback rehearsed; rollout warmed as a cache-cold event | f08 rollout | Engine bumps outside the version; rollback timed in the incident |
| 22 | Routing on token-cost + cache-match; bounded affinity (G9); advisory state, authoritative admission | f09 router + authority | Round-robin ahead of prefix caches; match-herded hotspots |
| 23 | Pools: disaggregation priced on the fabric; per-pool frontier points and scaling signals; adapters under tenancy discipline | f09 pool + multiplex | Phase pools the arithmetic condemned; the noisy adapter |
| 24 | Autoscaling on token metrics with envelope-derived thresholds; the cold-start gap bridged by design | f09 scaling | QPS triggers on 1000×-variable work; reactive-only scaling |
| 25 | Determinism posture declared and honored (documented nondeterminism, or bitwise-proven invariance) | f10 determinism | Reproducibility implied to evals/caches that serving cannot deliver |
| 26 | Ledger current: five-field stamps, open-loop-in-tokens attested, canary spine standing, bounds printed beside measurements | f10 all | Envelope numbers from the pre-quantization fleet |

## 4. Approval Statement

Approval of a serving surface dossier asserts: the deployment exists under an earned buy-vs-run verdict; its capacity is a derived, validated chain from device physics to admission budgets; its memory, batching, kernels, precision, parallelism, and routing decisions each name the resource they move and carry the evidence their risk class demands — eval-gated where outputs are touchable, measured where load is the question; and its fleet operates against published failure rates with rollouts that canary quality and latency as one gate. It asserts *nothing* about the admission policies above the runtime (Chapter 09), the caching contracts around it (Chapter 08), the API lifecycles in front of it (Chapter 07), or the agent loops that consume it (Chapter 11) — those approvals are prerequisites, cited by reference, never re-argued here.

## Output

The output of this file — and the chapter — is an executable review instrument: a ten-section dossier that forces every serving claim back to its arithmetic and every risky acceleration through its eval, and a twenty-six-point checklist that converts this chapter's gates into findings a review can actually produce.

## References

- [Chapter 10 file map — the approval dependency graph this dossier assembles](00-chapter-file-map.md)
- [Chapter 01 file 11 — evidence classification the ledger inherits](../01-architectural-objective-and-system-boundary/11-evidence-classification-and-architecture-review.md)
- [Google SRE Workbook — canarying releases (the G10 spine's discipline)](https://sre.google/workbook/canarying-releases/)
