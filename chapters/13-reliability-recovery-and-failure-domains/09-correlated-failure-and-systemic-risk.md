# Correlated Failure and Systemic Risk

## Abstract

Every availability estimate a team makes rests on an assumption of *independence* — "three replicas each at 99.9% give 99.9999%" — and that assumption is almost always wrong in the direction that matters, because the failures that cause outages are **correlated**: the three replicas share a power feed, a rack, a config, a library version, a control-plane dependency, or a deploy, and the fault that hits one hits all three at once. This file is the arithmetic of composition and the honest accounting for correlation, and its central number is the **serial-dependency availability law** (standard 6, the chapter's composition law): a request that must traverse *n* independent components each of availability *Aᵢ* succeeds with probability **A_system = ∏ Aᵢ**, which *falls* with every dependency added — ten components each at 99.99% yield 99.9% (four nines become three; the "chain of nines" erosion), and this is why a microservice call graph is an availability *liability* unless each hop is made non-blocking (fallbacks, file 05) or removed from the critical path. Redundancy *adds* availability but only against *independent* failures: *m* parallel replicas each at availability *A* give **1 − (1 − A)ᵐ** *if and only if* their failures are independent — and the correlated-failure correction is the whole game, because a **correlation coefficient** as small as a shared config or a common deploy collapses that formula toward the availability of the *shared* component, not the redundant set. The file makes three moves. It states the **availability-from-MTBF/MTTR** first-principles identity (standard 9): **A = MTBF / (MTBF + MTTR)**, which shows that halving MTTR (via detection, file 02, and drilled recovery, file 04) improves availability exactly as much as doubling MTBF, and is usually far cheaper — reframing reliability spend toward *recovery speed*. It names the **common-mode failure sources** that create hidden correlation (shared config, shared control plane, shared dependency, correlated load, common software version — Ch05 f01's geometry generalized). And it closes with the **research frontier** (standard 5): the theory of metastable failures is young and lacks predictive models, gray-failure detection remains largely reactive, and LLM-fleet reliability at scale is an emerging empirical field ([Llama-3's 419 interruptions in 54 days on 16k GPUs](https://arxiv.org/abs/2407.21783)) with no mature theory — an honest statement of what the discipline has *not* yet solved.

## 1. The Serial-Dependency Availability Law

```text
Figure 1. Availability composes multiplicatively along the critical
path. Each added serial dependency ERODES availability — the "chain
of nines." Redundancy adds nines only against INDEPENDENT failures.

  SERIAL (all must work):   A_sys = ∏ Aᵢ
    2 deps @ 99.99%   → 0.9999²  = 99.98%
    10 deps @ 99.99%  → 0.9999¹⁰ = 99.90%   ← lost a nine to the chain
    50 deps @ 99.99%  → 0.9999⁵⁰ = 99.50%   ← lost two

  PARALLEL (any one works), INDEPENDENT:  A = 1 − (1−Aᵢ)ᵐ
    2 replicas @ 99%  → 1 − 0.01²  = 99.99%
    3 replicas @ 99%  → 1 − 0.01³  = 99.9999%

  PARALLEL, CORRELATED (shared config/power/deploy, corr ρ):
    effective A → collapses toward the availability of the SHARED
    component. Three replicas behind one config push have the
    availability of THE CONFIG PUSH, not 1−(1−A)³. The redundancy
    you paid for is cancelled by the domain you didn't see (f01 §4).
```

The law's two lessons run opposite directions and both matter. **Serial dependencies erode**: every synchronous, must-succeed hop on the critical path multiplies availability *down*, so reliability architecture is partly the work of *removing hops from the critical path* — making dependencies optional (fallbacks), asynchronous, or cached, so their failure degrades (file 05) rather than fails. **Parallel redundancy adds — only if independent**: and since independence is the assumption most often violated, the redundancy calculation is worthless until the shared domains are found and either eliminated or priced into the correlation. A team that reports "six nines from triple redundancy" without auditing for the shared config, power, and deploy that all three replicas share is reporting fiction.

## 2. Availability From MTBF and MTTR — Why Recovery Speed Is Leverage

```text
Figure 2. The availability identity, and why MTTR is the cheap lever.

  A = MTBF / (MTBF + MTTR)
      mean time between failures / (that + mean time to recover)

  Fixed MTBF = 30 days (720 h). Vary MTTR:
    MTTR = 4 h   → A = 720/724   = 99.45%
    MTTR = 1 h   → A = 720/721   = 99.86%
    MTTR = 10 m  → A = 720/720.17 = 99.977%

  Same failure frequency; availability improved 30× by cutting
  recovery time alone. Detection (f02) + drilled recovery (f04) +
  automated rollback (f07) all attack MTTR — usually far cheaper
  than raising MTBF (which needs eliminating faults, a slog).
```

The identity reframes the whole reliability budget: **you can buy availability by failing less often (raise MTBF) or by recovering faster (lower MTTR), and the second is usually cheaper and more achievable.** Raising MTBF means eliminating fault sources — an open-ended, diminishing-returns effort. Lowering MTTR means faster detection (the file-02 burn-rate and differential-observability investment), rehearsed recovery (file-04 drills), automated rollback (file-07), and blast-radius containment so there is less to recover (file-03) — all concrete, bounded engineering. This is why mature reliability programs weight *recovery speed* heavily: the same availability target is reached at lower cost through MTTR than through MTBF, and MTTR improvements compound across *every* failure class at once.

## 3. Common-Mode Failure — Where Hidden Correlation Lives

| Shared thing | The correlation it creates | The independence it destroys |
|---|---|---|
| **Config / control plane** | One bad push hits every consumer at once (Cloudflare 2019, Meta 2021) | All redundancy downstream of the shared config |
| **Software version** | One bug ships to the whole fleet in one deploy | Replica independence — identical code fails identically |
| **Dependency** | A shared database/cache/service is a single point every replica needs | Any redundancy above the shared dependency |
| **Power / network / AZ** | Physical co-location fails together | "Independent" replicas in the same rack/zone |
| **Load / traffic** | A correlated spike (viral event, retry storm) hits all shards at once | Statistical-multiplexing assumptions; the load itself is the common mode |
| **Time** | Certificate expiry, leap second, timestamp rollover fire everywhere simultaneously | Everything — time is the ultimate shared dependency |

The audit this table drives (feeding file 10's dependency-graph check): for each claimed-redundant set, ask *what do these share*, and trace it to the deepest shared dependency — because the availability of a redundant set is capped by the availability of the least-available thing all its members share, and that thing is frequently invisible on the architecture diagram (the config system, the deploy pipeline, the certificate authority, the clock). The most damaging outages are common-mode: a single shared fault defeating redundancy that looked, on paper, like many nines.

## 4. The Frontier, Judged

The reliability discipline has unsolved problems worth stating honestly (standard 5, research frontier):

- **Metastable-failure theory is immature**: [Bronson (2021)](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf) and [Huang (2022)](https://www.usenix.org/conference/osdi22/presentation/huang-lexiang) gave the vocabulary and a taxonomy, but there is *no predictive model* that tells you, in advance, where a given system's vulnerable-to-metastable boundary sits — teams find it empirically, in production, during the outage. Capacity headroom is a hedge, not a calculation.
- **Gray-failure detection is still largely reactive**: differential observability (file 02) catches gray failure *after* the divergence appears; predicting which components will fail grayly, or detecting it in the first moments rather than after user impact, remains open.
- **LLM-fleet reliability is an emerging empirical field with no mature theory**: the [Llama-3 training corpus](https://arxiv.org/abs/2407.21783) (419 interruptions in 54 days across 16,384 GPUs, ~30% GPU/17% HBM-attributed) is data, not yet a predictive reliability model for large accelerator fleets; the correlated-failure structure of GPU clusters (shared cooling, shared power, shared network fabric, synchronized collective operations that make one straggler everyone's stall) is being characterized, not yet solved.
- **Correlation is hard to measure before the fact**: the correlation coefficient that collapses the redundancy formula (§1) is usually estimated only *after* a correlated outage reveals it — there is no good methodology for measuring failure correlation in advance short of the fault injection (file 10) that surfaces it.

The honest posture: reliability engineering has strong *practices* (this chapter's mechanisms) but incomplete *theory* for the hardest failure classes, so the discipline leans on defense-in-depth, drilling, and headroom precisely because it cannot yet predict where these failures will strike.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Serial-availability gate | Critical-path dependencies counted; A_system = ∏Aᵢ computed; hops made optional/async/cached to stop erosion | Availability claimed without counting the chain; a long synchronous call graph presented as reliable |
| Redundancy-independence gate | Every claimed-redundant set audited for shared domains; the correlation priced, not assumed away | "N nines from redundancy" with unaudited shared config/power/deploy collapsing it |
| MTTR-leverage gate | Availability budget attacks MTTR (detection, drills, rollback, containment) not only MTBF; A=MTBF/(MTBF+MTTR) computed | Reliability spend only on preventing faults; recovery speed untracked and un-drilled |
| Common-mode gate | Shared-thing audit (§3) done; deepest shared dependency of each redundant set identified and its availability treated as the cap | Hidden common mode (config, version, clock, CA) defeating redundancy undiscovered until the outage |
| Frontier-honesty gate | The unsolved classes (metastability prediction, gray-failure prediction, fleet reliability, correlation measurement) acknowledged; headroom/drilling used *because* prediction is unavailable | Overconfidence in availability math that assumes independence and predictable failure the theory cannot deliver |

## Output

The output of this file is the arithmetic and honest accounting of composed reliability: availability erodes multiplicatively along serial dependencies and adds through redundancy *only when failures are independent*, so the shared-domain audit is the load-bearing step behind every nines claim; the A = MTBF/(MTBF+MTTR) identity reframes reliability spend toward recovery speed as the cheaper lever; common-mode sources are enumerated so hidden correlation is found before it fires; and the immature frontier — metastability, gray-failure prediction, fleet reliability, correlation measurement — is stated honestly as the reason the discipline relies on defense-in-depth and drilling rather than prediction. The number that survives this file is a *correlation-audited* availability estimate, not an independence-assumed fiction.

## References

- [Bronson et al., "Metastable Failures in Distributed Systems," HotOS 2021](https://sigops.org/s/conferences/hotos/2021/papers/hotos21-s11-bronson.pdf)
- [Huang et al., "Metastable Failures in the Wild," OSDI 2022](https://www.usenix.org/conference/osdi22/presentation/huang-lexiang)
- [Meta, "The Llama 3 Herd of Models" (fleet-scale correlated-failure data)](https://arxiv.org/abs/2407.21783)
- [Google SRE Book — "Availability Table" and "Embracing Risk" (MTBF/MTTR, error budgets)](https://sre.google/sre-book/embracing-risk/)
- [Ford et al., "Availability in Globally Distributed Storage Systems," OSDI 2010 (correlated-failure measurement)](https://www.usenix.org/legacy/event/osdi10/tech/full_papers/Ford.pdf)
