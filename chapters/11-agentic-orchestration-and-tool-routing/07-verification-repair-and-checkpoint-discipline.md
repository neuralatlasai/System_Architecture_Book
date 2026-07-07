# Verification, Repair, and Checkpoint Discipline

## Abstract

File 02 proved verification is the only intervention that breaks the failure exponential (p → p′ lifting 20-step success from 36% to 75%), which makes this file's question the chapter's most consequential: *how does an agent system actually know a step or an episode succeeded?* The mechanism ladder, in descending strength: **executable verification** (tests pass, code compiles, the query returns, the migration's row counts reconcile — ground truth the environment provides, and the reason coding agents lead the field: their domain ships with verifiers); **structural verification** (schema conformance, invariant checks, reconciliation against sources — Chapter 07's contract machinery pointed at the agent's own outputs); **LLM-as-judge** (a second model scores the work against a rubric — genuinely useful and *bounded*: judges inherit model failure modes, drift with their own versions, agree with humans well on clear rubrics and poorly on taste, and are gameable by the very model they judge — so judges are calibrated against human-labeled samples, their agreement rate is a measured number with an expiry (file 09), and they gate *escalation*, never *irreversible action*); and **self-assessment** (the model's own "done" — a loop-termination signal, never verification). The **repair discipline** bounds what happens on failure: n attempts per failure class with *different information* each time (append the verifier's specific finding — Ch07 f05's actionable-error law applied to the agent's own loop; a retry with the same context is file 02's correlated failure re-rolled), loop detection (same step failing the same way twice → escalate, don't burn budget), and rollback-first for side-effectful failures (undo then retry, never retry-on-top — Ch03's compensation machinery). The **checkpoint discipline** makes episodes durable state: long-horizon work survives process death, deploys (Ch10 f08's drains), and human-approval pauses only if progress is externalized — the durable-execution pattern (Temporal-class engines and the agent frameworks' checkpointing layers): persist the episode state machine (plan, step results, context summary, budget spent) at phase boundaries, resume by replay-or-restore — which is Chapter 07 file 09's LRO contract (R1: durable state; R3: idempotent steps) applied to the loop itself, with the corollary that **checkpoints are also the re-anchoring points** that restore file 02's quasi-independence: a verified checkpoint is ground truth the next phase builds from, not narrative the next phase inherits.

## 1. The Verifier Ladder and Its Placement

```text
Figure 1. Verification strength vs cost — and where to spend it.

  strength ▲  executable (tests, compilers, reconciliation)
           │    └─ USE WHEREVER THE DOMAIN OFFERS IT; designing
           │       tasks so outputs ARE executable is the
           │       highest-leverage design move in this file
           │  structural (schemas, invariants, cross-checks)
           │    └─ cheap, mechanical: every tool output, every
           │       finalize phase
           │  LLM-judge (rubric'd second model)
           │    └─ calibrated vs human labels; agreement rate
           │       measured + expiring; gates escalation only
           │  self-assessment
           │    └─ termination signal. NOT verification.
  ─────────────────────────────────────────────────────────────
  placement (f02's envelope): verify at the DECISIVE steps —
  side-effect boundaries, phase exits, merge points (f05) —
  not uniformly; uniform verification doubles cost for tail
  benefit, skipped verification at an irreversible step is
  the Replit shape (f08)
```

The verifier-gap statement, honestly (feeding the README's open problems): for open-ended outputs without executable or structural anchors — strategy documents, research syntheses, designs — the field has no verifier stronger than calibrated judges plus human review, which is why file 01's admission table made *verifiability a precondition*: a task whose success cannot be checked at any rung above self-assessment is a task the agent system cannot responsibly own end-to-end; it can draft, a human must verify — and the dossier says so.

## 2. Repair and the Checkpoint Machinery

**Repair, bounded and informed**: per failure class — transient tool error (retry per file 03's contract), wrong output caught by verifier (re-attempt with the finding appended, ≤n), wrong *plan* revealed by repeated step failure (re-plan from last checkpoint, ≤m), environmental (escalate per file 06's ladder). The two anti-patterns the bounds exist to kill: the **doom loop** (same action, same failure, mounting apology — detected mechanically by step-signature repetition) and **repair-on-top of un-rolled-back side effects** (attempt 2 operating on the debris of attempt 1 — the harness rolls back or isolates before re-attempting, which requires tools to have declared their reversibility in file 03's table). **Checkpoints as the LRO contract**: at each phase boundary the harness persists `{plan version, verified results, context summary, budget ledger, pending approvals}` durably (Ch03's state machinery — this is a state store, with an owner and retention); resume restores state and *re-verifies the last checkpoint's ground truth* before continuing (the world may have moved during the pause — the re-anchoring that makes long pauses safe); and idempotency keys (Ch07 f04) make resumed steps safe against the crash-after-act-before-record window. The operational payoffs compound: deploys drain by checkpointing episodes rather than killing them (Ch10 f08's stream-aware drain, one level up), human-approval gates (file 08) become cheap pauses instead of held processes, and the failure exponential meets its second structural fix — an episode of three verified, checkpointed phases of 7 steps each fails like three short episodes, not one long one.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Ladder gate | Per task class: the verification mechanism per rung, with executable/structural anchors used wherever the domain offers them; the verifier-gap admission where they don't | Self-assessment as verification; judge-gated irreversible actions; unverifiable tasks owned end-to-end |
| Judge-calibration gate | LLM judges calibrated against human-labeled samples; agreement rates measured, versioned, expiring; judge prompts under file 09's canary | Uncalibrated judges as ground truth; judge drift shipped inside model bumps |
| Placement gate | Verification at decisive steps (side effects, phase exits, merges) with the placement rationale | Uniform verify-everything cost; naked irreversible steps |
| Repair gate | Bounded, informed re-attempts per failure class; step-signature loop detection; rollback-before-retry for side-effectful failures | Doom loops burning budgets; attempt 2 on attempt 1's debris |
| Checkpoint gate | Phase-boundary durable checkpoints with the five-field state; resume re-verifies ground truth; idempotent steps; deploys drain via checkpoint | Episodes that die with processes; resumes that trust stale world-state; the budget cliff losing everything |

## Output

The output of this file is the machinery that makes file 02's arithmetic move: verification as a strength-ordered ladder spent at the decisive steps with the verifier gap admitted where it exists, judges used as calibrated instruments rather than oracles, repair bounded and informed with rollback ahead of retry, and episodes checkpointed into durable, resumable, re-anchored state — so long-horizon work fails like a sequence of short verified phases instead of one long roll of the exponential dice.

## References

- [Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (NeurIPS 2023) — judge agreement and its limits](https://arxiv.org/abs/2306.05685)
- [Temporal, "Durable execution for AI agents" — the checkpoint/replay pattern productionized](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai)
- [Chapter 07 file 09 — the LRO contract (durable state, idempotent creation) the checkpoint discipline instantiates](../07-api-contracts-and-request-lifecycle/09-streaming-long-running-and-ai-request-lifecycles.md)
- [Chapter 07 file 04 — idempotency through the crash-after-act window](../07-api-contracts-and-request-lifecycle/04-idempotency-and-safe-retries.md)
