# Chapter 13 — Reliability, Recovery, and Failure Domains

## Abstract

This chapter collects the failure modes every prior chapter named and left as a forward reference, and turns them into a *method*: a reliability design is approved only when every failure class answers the same four questions — **how is it detected, how is its blast radius bounded, how is service degraded rather than lost, and how is the system recovered**. Its governing stance is that reliability is not the absence of faults, which is unachievable, but the *bounded, detected, recoverable* consequence of faults that will certainly happen — so the chapter is organized around faults becoming errors becoming failures (Avizienis' chain), and around the three response axes that keep a failure from becoming an outage: isolate it (cells, bulkheads, shuffle sharding, with a 1/N blast-radius floor), recover from it (RTO/RPO chosen from arithmetic and proven by drills), and degrade under it (a feature ladder that sheds to protect the load-bearing core). Two failure *engines* get their own files because they cause the largest outages: feedback loops (retry storms and metastability, bounded on three axes by breakers, retry budgets, and jittered backoff) and deployments (the one deliberate, scheduled, global fault source, made safe by progressive delivery, automated rollback, and reversibility-by-construction). The arithmetic spine (standards 6 and 9) is availability composition: it *erodes* multiplicatively along serial dependencies (ten nines-of-four hops give three), *adds* through redundancy only when failures are independent, and A = MTBF/(MTBF+MTTR) reframes reliability spend toward recovery speed as the cheaper lever — with the honest caveat that the redundancy is fiction until the shared domains are audited. The AI-native turn: AI failures are silent Byzantine failures by default — a fluent wrong answer with a 200 status — so healthy infrastructure implies nothing about correctness, and the outcome eval becomes the primary reliability signal, the deploy gate, and the regression detector at once. The through-line: "we didn't think that could fail" is not a post-incident finding this method permits.

## Chapter Structure

| File | Claim it carries |
|---|---|
| [00-chapter-file-map.md](00-chapter-file-map.md) | Reading order, approval dependency graph, prerequisites from Chapters 01–12 |
| [01-failure-model-and-domain-taxonomy.md](01-failure-model-and-domain-taxonomy.md) | Fault→error→failure; the failure modes (gray/Byzantine as default); the eight classes; failure domains |
| [02-detection-and-time-to-detect.md](02-detection-and-time-to-detect.md) | MTTD dominates blast radius; burn-rate alerting; differential observability against gray failure |
| [03-blast-radius-and-failure-isolation.md](03-blast-radius-and-failure-isolation.md) | Cells (1/N floor); bulkheads; shuffle-sharding combinatorics; static stability |
| [04-recovery-objectives-and-state-restoration.md](04-recovery-objectives-and-state-restoration.md) | RPO/RTO per state class; RTO as arithmetic; the DR spectrum; the untested-backup trap |
| [05-degraded-operation-and-graceful-degradation.md](05-degraded-operation-and-graceful-degradation.md) | The feature ladder; independent fallbacks; the fail-open/closed decision; the return path |
| [06-retry-storms-circuit-breakers-and-metastability.md](06-retry-storms-circuit-breakers-and-metastability.md) | The feedback-loop engine; breakers, retry budgets, jitter — three axes bounded |
| [07-deployment-safety-and-rollback.md](07-deployment-safety-and-rollback.md) | Deploy as controlled fault injection; progressive delivery; automated rollback; reversibility; kill switches |
| [08-ai-native-failure-modes.md](08-ai-native-failure-modes.md) | Silent Byzantine AI failures; the outcome-eval as primary SLI; quality deploy-gate; model-as-dependency |
| [09-correlated-failure-and-systemic-risk.md](09-correlated-failure-and-systemic-risk.md) | A=∏Aᵢ; redundancy only if independent; A=MTBF/(MTBF+MTTR); common-mode; the frontier judged |
| [10-verification-of-reliability.md](10-verification-of-reliability.md) | Chaos engineering; drills RL1–RL10; standing canaries; the reliability-generation stamp |
| [11-reliability-review-templates.md](11-reliability-review-templates.md) | The ten-section dossier and 20-point reviewer checklist |

## Source Corpus

| Source | What this chapter takes from it |
|---|---|
| [Avizienis, Laprie, Randell, Landwehr, "Dependability Taxonomy" (IEEE TDSC 2004)](https://ieeexplore.ieee.org/document/1335465) | Fault/error/failure vocabulary; the four means (prevention/tolerance/removal/forecasting) |
| [Cristian, "Understanding Fault-Tolerant Distributed Systems" (CACM 1991)](https://dl.acm.org/doi/10.1145/102792.102801) | The failure-mode hierarchy: crash/omission/timing/Byzantine |
| [Huang et al., "Gray Failure" (HotOS 2017)](https://www.microsoft.com/en-us/research/publication/gray-failure-achilles-heel-cloud-scale-systems/) | Differential observability; the mode that defeats naive monitoring |
| [Google SRE Book & Workbook](https://sre.google/books/) | Error budgets, multiwindow multi-burn-rate alerting, cascading-failure and data-integrity discipline |
| [AWS Well-Architected — cell-based architecture](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html) + [shuffle-sharding](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/) | Blast-radius containment: the 1/N floor and the combinatorial isolation upgrade |
| [AWS Builders' Library — timeouts, retries, backoff-with-jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) + [static stability](https://aws.amazon.com/builders-library/static-stability-using-availability-zones/) | The feedback-loop defenses; isolation that survives the control plane |
| [Bronson et al., "Metastable Failures" (HotOS 2021)](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) + [Huang et al. (OSDI 2022)](https://www.usenix.org/conference/osdi22/presentation/huang-lexiang) | The self-sustaining feedback-loop failure class and its external-reduction exit |
| [Nygard, *Release It!* (2nd ed.)](https://pragprog.com/titles/mnee2/release-it-second-edition/) | Circuit breaker, bulkhead, and stability patterns |
| [Cloudflare, July 2 2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/) + [Meta, Oct 4 2021](https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/) + [GitLab, Jan 31 2017](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) | The incident corpus: global-unstaged-change and silent-backup-failure shapes as evidence |
| [Principles of Chaos Engineering](https://principlesofchaos.org/) + [Basiri et al. (IEEE Software 2016)](https://ieeexplore.ieee.org/document/7436642) | The verification method: falsifiable hypotheses, bounded blast, injection in production |
| [Meta, "The Llama 3 Herd of Models" (2024)](https://arxiv.org/abs/2407.21783) | Fleet-scale correlated-failure data: 419 interruptions in 54 days on 16,384 GPUs |

## Chapter Standards

1. Research-note structure per file: Abstract → numbered sections with formal models → ASCII figures ("Figure N.") → decision tables → approval gates → Output → verified primary-source references.
2. Every failure class answers the same four questions — detect, isolate, degrade, recover — each a mechanism designed here or a cited primitive; a class with an empty cell is undesigned, not unlikely (files 01, 11).
3. Gray and Byzantine failure are treated as the default mode, not the exception; every mechanism is judged on whether it catches the *silent* failure, not just crash-stop (file 01).
4. Detection is a first-class reliability lever: MTTD is budgeted against the SLO's error budget, alerting is burn-rate-based, observability is differential (file 02).
5. Blast radius is a design-time number computed from the partitioning (1/N for cells; combinatorial for shuffle shards), not a post-incident measurement (file 03).
6. Recovery objectives are chosen per state class from cost of loss; RTO is derived from arithmetic (`D/B + rebuild + warm + verify`); a backup counts only once a timed restore has proven it (file 04).
7. Between working and down is a designed spectrum: a feature ladder sheds to protect the core, fallbacks are independent and drilled, and every gating component declares fail-open or fail-closed (file 05).
8. The feedback-loop engine is bounded on all three axes — duration (breakers), magnitude (retry budgets), synchronization (jitter) — the composition law for protection (standard 6, file 06).
9. Deployment is treated as controlled fault injection: progressively delivered, automatically rolled back on SLI breach, reversible by construction, with kill switches decoupling deploy from release (file 07).
10. AI failures are silent Byzantine by default; the outcome/quality eval is the primary SLI, the deploy gate, and the regression detector — infra health implies nothing about correctness (standard 1, file 08).
11. Availability composes arithmetically: A=∏Aᵢ erodes along serial dependencies, redundancy adds only if independent, and A=MTBF/(MTBF+MTTR) makes MTTR the cheap lever (standards 6 & 9, file 09).
12. Every stated law carries a worked number (99.9% SLO = 43.2 min/month; 5 TB restore ≈ 5.1 h RTO; C(100,2) shuffle overlap 0.02%; 4ⁿ retry amplification; ten nines-of-four hops = three nines).
13. Validity envelopes on every mechanism (standard 7): the health check that lies, the fallback that shares the failure, the redundancy that shares a domain, the metastable boundary no model predicts.
14. The research frontier is judged honestly (standard 8): metastability lacks a predictive model, gray-failure detection is reactive, fleet reliability is empirical-not-theoretical, correlation is measured only after it fires.
15. Version/incident claims are search-verified at write time (multi-burn-rate thresholds; cell-architecture arithmetic; the 2019/2021/2017 postmortems; Llama-3 interruption counts).
16. Verification is chaos engineering with falsifiable hypotheses and bounded blast, the RL1–RL10 drill set mapping one exercise to each file's claim, standing canaries on a cadence, and a reliability-generation stamp (file 10).
17. The chapter approves the failure-handling method only; replication, log replay, admission, serving, agent verification, and retrieval are cited prerequisites (file 11 §4).
18. The README carries an Open Problems section (standard 8).

## Chapter Completion Gate

The chapter is complete for a given system only when its review can answer:

1. Does every failure class have a detection signal, a blast-radius bound, a degraded mode, and a recovery path — or is a class undesigned?
2. Is detection differential enough to catch gray failure, and is MTTD budgeted against the SLO?
3. What is the blast radius per fault class, computed from the partitioning — and does each isolation boundary share nothing on the hot path?
4. What are RPO and RTO per state class, and has a timed restore drill proven the RTO number?
5. What does the system do at each rung of resource starvation, and does every gating component declare fail-open or fail-closed?
6. Are retry storms bounded on all three axes (breaker, budget, jitter), and is there a designed exit from the metastable region?
7. Is every deploy progressively delivered, automatically rolled back on SLI breach, and reversible by construction?
8. For AI: is the outcome/quality eval the primary SLI and the deploy gate — or is the system flying on infra health alone?
9. Is the availability estimate correlation-audited, and is MTTR attacked as the cheap lever?
10. Does every reliability claim carry a current, dated drill stamp — or is it an un-drilled hypothesis?

## Open Problems

Stated honestly, per this chapter's standard: **(1) Metastable failure has no predictive model** — the vocabulary and taxonomy exist (Bronson, Huang), but nothing tells you in advance where a given system's vulnerable-to-metastable boundary sits; teams find it in production, during the outage, and hedge with headroom rather than calculate it. **(2) Gray-failure detection is reactive**: differential observability catches the divergence after it appears, but predicting which components will fail grayly, or detecting it in the first seconds rather than after user impact, is unsolved. **(3) Failure correlation is measured only after it fires**: the correlation coefficient that collapses every redundancy calculation is typically discovered by the correlated outage that reveals the shared domain — there is no good methodology for measuring failure correlation in advance short of the fault injection that surfaces it. **(4) Large-accelerator-fleet reliability is empirical, not theoretical**: the Llama-3 corpus (419 interruptions in 54 days) is data, not a predictive model; the correlated-failure structure of GPU clusters — shared cooling, power, network fabric, and synchronized collectives that make one straggler everyone's stall — is being characterized, not solved. **(5) AI quality regression has no complete detector**: the outcome eval is the primary defense, but it is only as good as its gold set (which ages, Chapter 12) and its judge (which has its own failure modes), so a subtle quality regression can pass the gate that was supposed to catch it — silent Byzantine failure remains the hardest class to verify against.

## Final Position

Reliability is the discipline of designing for the day everything fails at once, and this chapter's claim is that the day is survivable exactly to the extent that each failure was given, in advance, a detection signal, a blast-radius bound, a degraded mode, and a drilled recovery — with the arithmetic (availability composition, MTTD budgets, RTO derivations) making "reliable" a measured claim rather than a hope, and the drill stamps making it a *current* one. The book's final arc is operational: this chapter designed the responses to failure, but a response is only as good as the signal that triggers it and the evidence that proves it worked — which is the seam forward. [Chapter 14](../14-observability-profiling-and-verification/README.md) takes up observability, profiling, and verification: the metrics, structured logs, traces, and load/chaos/regression tests that make every failure mode in this chapter *visible* before it becomes an incident and *measurable* after — because a reliability design you cannot observe is a set of claims you cannot check, and the difference between a system that is reliable and one that is merely believed to be is the instrumentation that tells them apart.

## References

- [Avizienis et al., "Basic Concepts and Taxonomy of Dependable and Secure Computing," IEEE TDSC 2004](https://ieeexplore.ieee.org/document/1335465)
- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [Google SRE Workbook — "Alerting on SLOs"](https://sre.google/workbook/alerting-on-slos/)
- [AWS Well-Architected — Reducing the Scope of Impact with Cell-Based Architecture](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
