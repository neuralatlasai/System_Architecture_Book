# Reliability Review Templates

## Abstract

This file assembles the chapter into its executable form: the dossier a team completes to put a reliability design in front of an architecture review, and the checklist the reviewer walks to approve it. The organizing principle is the chapter rule (file 00) made procedural: **every failure class in the file-01 taxonomy gets a row, and every row answers the four questions — detect, isolate, degrade, recover** — with each answer either a mechanism designed in this chapter or a cited primitive from another, and each backed by a dated drill stamp (file 10). The dossier forces the numbers the chapter derives — MTTD against the error budget (file 02), blast radius as 1/N (file 03), RTO/RPO from arithmetic (file 04), availability as a *correlation-audited* product (file 09) — where the default would report reassuring prose with no measurement behind it. A reliability review that produces "looks robust" has failed; a reliability review that produces "RL6 restore drill 2026-06-14 measured RTO 4.9h against a 2h SLA — gap, remediation owned" has done its job.

## 1. Dossier Assembly

```text
Figure 1. Dossier assembly: each section is produced by one file's
gates; the checklist consumes the whole. The failure-class register
(§A) is the spine — every other section answers a column of it.

  f01 ─► §A failure-class & domain register   f07 ─► §G deploy safety
  f02 ─► §B detection & MTTD budget           f08 ─► §H AI failure modes
  f03 ─► §C blast radius & isolation          f09 ─► §I correlated-failure
  f04 ─► §D recovery objectives (RTO/RPO)             & availability math
  f05 ─► §E degraded operation                f10 ─► §J drill evidence ledger
  f06 ─► §F feedback-loop defense                     │
                     │                                 v
                     └──────────► reviewer checklist (§3)
                                  ─► approve design / findings
```

## 2. The Reliability Surface Dossier

**§A Failure-class & domain register (file 01).** Every failure class (the eight, plus the workload's own) with its failure mode(s); the failure domains including shared/non-obvious ones; the four-question answer per class (detect/isolate/degrade/recover), each pointing to a mechanism or a cited primitive. *This register is the spine — a class with an empty cell is an undesigned failure.*

**§B Detection & MTTD budget (file 02).** Incident-duration decomposition tracked (MTTD/MTTM/MTTR-full separately); detection latency costed against the SLO's error budget; burn-rate alerts on user-facing SLIs; differential observability (self vs external, infra vs outcome); liveness shallow, readiness deep.

**§C Blast radius & isolation (file 03).** Blast radius per fault class computed from the partitioning; cells complete/independent/fixed-size with a simple stateless router; shuffle sharding where multi-tenant poison threatens, with computed overlap; static stability (isolation holds when the control plane is down).

**§D Recovery objectives (file 04).** RPO/RTO per state class from cost of loss; RTO derived as `D/B + rebuild + warm + verify`; DR tier matched to each class; state classes recovered by nature (recompute/restore-replay/abandon); restore proven by a timed, validated drill.

**§E Degraded operation (file 05).** Feature ladder classified by "is its loss an outage," auto-shedding on the detection signal; fallbacks independent, ready, drilled, observable; fail-open/closed declared per gating component from error-cost asymmetry; gradual health-gated return path.

**§F Feedback-loop defense (file 06).** Metastable loops identified with headroom + an external-reduction exit; circuit breakers on cross-service calls; retry budgets bounding amplification as a fraction of throughput; jittered backoff — all three axes (duration/magnitude/synchronization) bounded.

**§G Deployment safety (file 07).** Progressive delivery with per-stage SLI gates; automated SLI-driven rollback; reversibility by construction (expand/contract for stateful changes); kill switches decoupling deploy from release; one-way doors identified and given the slowest rollout.

**§H AI failure modes (file 08).** Outcome/quality eval as the *primary* SLI; quality deploy-gate against a versioned gold set with auto-rollback; abstention as a designed mode; determinism posture declared; model version pinned, eval-gated, with a ready fallback.

**§I Correlated-failure & availability math (file 09).** A_system = ∏Aᵢ computed along the critical path; every redundant set audited for shared domains and correlation priced; A = MTBF/(MTBF+MTTR) with MTTR attacked as the cheap lever; common-mode sources enumerated; frontier limits acknowledged.

**§J Drill evidence ledger (file 10).** RL1–RL10 status: date, fault injected, measured MTTD/MTTM/RTO/RPO, environment, result; standing canaries (detection, restore, quality-regression) on a cadence; every reliability claim carrying a current stamp.

## 3. Reviewer Checklist

| # | Check | Source gate | Common failure it catches |
|---:|---|---|---|
| 1 | Every failure class has a register row with all four questions answered | f01 class-coverage | "We didn't think that could fail"; a class with an undesigned consequence |
| 2 | Failure modes include gray/Byzantine, not just crash-stop; shared domains named | f01 failure-mode + domain | Fault-tolerance assuming fail-stop; hidden shared domains collapsing redundancy |
| 3 | Incident duration decomposed; MTTD costed against the error budget | f02 decomposition + budget | "Lasted 90 min" with no MTTD; detection latency invisible and unimproved |
| 4 | Burn-rate alerts on user-facing SLIs; differential observability present | f02 burn-rate + differential | Static thresholds; self-reported health only; gray failure invisible |
| 5 | Blast radius per fault class computed from partitioning; cells share nothing on the hot path | f03 boundary + cell | Redundancy mistaken for isolation; leaked isolation via a shared store |
| 6 | Shuffle sharding (where needed) with computed overlap; static stability holds control-plane-down | f03 shuffle + static-stability | One tenant sinking a cell; isolation that unwinds when the router fails |
| 7 | RPO/RTO per state class; RTO = D/B + rebuild + warm + verify, not transfer alone | f04 objectives + arithmetic | One nightly RPO on the ledger; RTO quoted as byte-transfer only |
| 8 | DR tier matched to cost; restore proven by a timed, validated drill | f04 strategy-fit + drill | Active-active on recomputable state; backups never restored from (GitLab-2017 shape) |
| 9 | Feature ladder auto-sheds to protect the core; fallbacks independent, drilled, observable | f05 ladder + fallback | All-or-nothing behavior; fallbacks sharing the failed dependency; silent degradation |
| 10 | Fail-open/closed declared per gating component; gradual health-gated return path | f05 fail-mode + return | Auth failing open / limiter failing closed; thundering recovery re-breaking the dependency |
| 11 | Metastable loops identified with an external-reduction exit; breaker + budget + jitter all present | f06 metastability + composition | "Wait for recovery" on a self-sustaining loop; one of the three storm axes unbounded |
| 12 | Retry amplification bounded as a fraction of throughput, not per-request count | f06 retry-budget | Per-caller retries amplifying to 4ⁿ across tiers |
| 13 | Progressive delivery with per-stage SLI gates; first stage small | f07 staged-rollout | Global/unstaged deploys (Cloudflare/Meta shape); "passed CI" as sufficient |
| 14 | Automated SLI-driven rollback, drilled; changes reversible by construction (expand/contract) | f07 rollback + reversibility | Human-only revert; a change whose rollback breaks the version rolled back to |
| 15 | Kill switches decouple deploy from release; flag system governed; one-way doors flagged | f07 kill-switch + one-way | No sub-second feature reversal; an ungoverned flag system as a hidden global-blast surface |
| 16 | Outcome/quality eval is the primary SLI; AI deploys quality-gated with auto-rollback | f08 outcome-SLI + quality-gate | AI deploys on infra health alone; silent quality regression shipping green |
| 17 | Abstention designed; determinism posture declared; model pinned, eval-gated, fallback ready | f08 grounding + determinism + model-dep | A system that never abstains; "latest" in prod; unreproducible failures |
| 18 | A_system = ∏Aᵢ computed; every redundant set audited for shared domains | f09 serial + independence | Nines claimed without counting the chain or auditing correlation |
| 19 | MTTR attacked as the cheap availability lever; common-mode sources enumerated | f09 MTTR + common-mode | Spend only on MTBF; hidden common mode (config, version, clock, CA) undiscovered |
| 20 | RL1–RL10 executed with dated, measured stamps; standing canaries on a cadence | f10 all | Reliability claims asserted without drills; an 18-month-old stamp on a changed architecture |

## 4. Approval Statement

Approval of a reliability surface dossier asserts: every failure class has a designed detection, blast-radius bound, degraded mode, and recovery path; detection latency, blast radius, and recovery objectives are *measured numbers* costed against the SLO, not prose; the feedback-loop and deployment failure engines are bounded on every axis; the AI-native silent-Byzantine classes are caught by outcome evals rather than infra health; the availability estimate is correlation-audited rather than independence-assumed; and every claim carries a current drill stamp. It asserts *nothing* about the internal correctness of the primitives it composes — replication (Chapter 05), log replay (Chapter 06), admission (Chapter 09), serving (Chapter 10), agent verification (Chapter 11), retrieval (Chapter 12) — those approvals are prerequisites, cited by reference, never re-argued here. This chapter approves the failure-handling method; it does not re-approve the mechanisms.

## Output

The output of this file — and the chapter — is an executable review instrument: a ten-section dossier spined on a failure-class register where every class answers detect/isolate/degrade/recover, and a twenty-point checklist that converts this chapter's gates into findings a review can actually produce. A reliability design leaves this review with a ledger of measured, drilled, correlation-audited properties — or with a list of the failure classes still undesigned and the claims still un-drilled.

## References

- [Chapter 13 file map — the approval dependency graph this dossier assembles](00-chapter-file-map.md)
- [Chapter 01 file 11 — evidence classification the drill ledger inherits](../01-architectural-objective-and-system-boundary/11-evidence-classification-and-architecture-review.md)
- [AWS Well-Architected Framework — Reliability Pillar (the review discipline this operationalizes)](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
