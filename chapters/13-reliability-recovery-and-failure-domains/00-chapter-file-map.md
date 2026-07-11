# Chapter 13 — File Map and Reading Order

## What This Chapter Owns

Every prior chapter named its failure modes and left detection, mitigation, and recovery as forward references — Chapter 06's poison events and consumer lag, Chapter 07's retry amplification, Chapter 08's stampede and staleness, Chapter 09's congestive collapse, Chapter 10's KV exhaustion and GPU interruptions, Chapter 11's agent failure exponential, Chapter 12's silent retrieval regression. This chapter is where those references are collected into a *method*: a reliability system is not a list of mitigations, it is a discipline that takes each failure class through the same four questions — **how is it detected, how is its blast radius bounded, how is service degraded rather than lost, and how is the system recovered** — and requires an answer for each before the design is approved. The chapter's root claim: reliability is not the absence of faults (unachievable) but the *bounded, detected, recoverable* consequence of faults that will happen. What this chapter does **not** own: the specific mechanisms it composes — replication (Chapter 05), log replay (Chapter 06), retry/idempotency contracts (Chapter 07), cache fallback (Chapter 08), admission and load shedding (Chapter 09), serving placement (Chapter 10), agent verification (Chapter 11) — each is designed in its home chapter and *cited* here as a reliability primitive, never re-derived. This chapter approves the failure-handling method that binds them; it does not re-approve the primitives.

## Reading Order

```text
Figure 1. Dependency graph. Files 01–02 establish the model and the
first lever (detection); 03–05 are the three response axes (isolate,
recover, degrade); 06–07 are the two highest-frequency failure
engines (feedback loops, deployments); 08 is the AI-native class set;
09 is the systemic/correlated layer; 10–11 verify and template.

  01 failure model & domain taxonomy
        │  (fault→error→failure; the failure classes; blast domains)
        ▼
  02 detection & time-to-detect ──────────────┐
        │  (MTTD; health checks; burn-rate)    │
        ▼                                        │
  ┌─────────────┬──────────────┬───────────────┘
  ▼             ▼              ▼
  03 blast      04 recovery    05 degraded
  radius &      objectives &   operation &
  isolation     restoration    graceful
  (cells,       (RTO/RPO,      degradation
  bulkheads,    backup/replay) (shed, fallback,
  shuffle)                      fail-open/closed)
        │             │              │
        └──────┬──────┴──────────────┘
               ▼
  06 retry storms, circuit breakers, metastability
        │  (the feedback-loop failure engine)
        ▼
  07 deployment safety & rollback
        │  (the highest-blast-radius mutation class)
        ▼
  08 AI-native failure modes
        │  (model error, stale index, drift, silent regression)
        ▼
  09 correlated failure & systemic risk
        │  (common-mode, gray failure, availability math)
        ▼
  10 verification (chaos, game-days, DR drills)
        ▼
  11 review templates (dossier + checklist)
```

## Approval Dependency Graph

| File | Produces | Consumes (prerequisite, cited not re-argued) |
|---|---|---|
| 01 | The failure model and the domain taxonomy | Ch01 f05 boundary; Ch05 f01 correlated-failure geometry |
| 02 | Detection contracts and MTTD budgets | Ch14 (observability, forward); SRE burn-rate |
| 03 | Blast-radius bounds and isolation boundaries | Ch05 f07 partitioning; Ch02 f03 static stability |
| 04 | Recovery objectives (RTO/RPO) and restoration | Ch03 f05 derived-state recovery; Ch06 f07 checkpoint/replay |
| 05 | Degraded-operation modes and the fail-open/closed decision | Ch09 f04 load shedding; Ch08 f06 cache fallback |
| 06 | Feedback-loop defenses (breakers, buckets) | Ch07 f03 retry; Ch09 f07 admission; Bronson metastability |
| 07 | Deployment safety and rollback | Ch02 f06 config rollout; Ch03 f07 schema migration |
| 08 | The AI-native failure-class set | Ch10 reliability corpus; Ch11 f02 arithmetic; Ch12 f10 retrieval SLIs |
| 09 | Correlated-failure analysis and availability arithmetic | Ch05 f01; Huang gray failure; Ch10 Llama-3 corpus |
| 10 | The verification instrument (chaos, drills) | Ch01 f11 evidence classes; all prior drill sets |
| 11 | The review dossier and checklist | every file above |

## Chapter Rule

A reliability design is approved only when **every failure class in the file-01 taxonomy has a row** in the file-11 dossier stating its detection signal, its blast-radius bound, its degraded mode, and its recovery path — and each of those four is either a cited primitive from another chapter or a mechanism designed here. A missing row is not "unlikely," it is *undesigned*: the failure will still occur, but its consequence will be unbounded, undetected, or unrecoverable. The chapter's discipline is that "we didn't think that could fail" is not a post-incident finding this method permits.

## References

- [Avizienis, Laprie, Randell, Landwehr, "Basic Concepts and Taxonomy of Dependable and Secure Computing," IEEE TDSC 2004](https://ieeexplore.ieee.org/document/1335465)
- [AWS Well-Architected — Reducing the Scope of Impact with Cell-Based Architecture](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html)
