# Orchestration Topologies — Single and Multi-Agent

## Abstract

The multi-agent question produced the field's most public architecture disagreement, and this file's position is that both sides are right about different workloads — the debate resolves into a *criterion*, not a winner. Cognition's argument ([Devin team, "Don't Build Multi-Agents"](https://cognition.ai/blog/dont-build-multi-agents)): sub-agents that cannot see each other's work make conflicting implicit decisions, and stitching their outputs recreates the coordination problem with less context than a single agent had — so for **write-heavy, tightly-coupled work** (a coherent codebase change, one document with one voice), a single full-context agent dominates, and the two principles are *share full context/traces* and *actions carry implicit decisions — parallel deciders conflict*. Anthropic's result ([multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)): an orchestrator-worker topology outperformed a single-agent baseline by 90.2% on research evals — because **read-heavy, decomposable work** (searching, gathering, verifying across many independent directions) parallelizes with *low merge conflict* (findings compose; sentences don't), and the token math is explicit: multi-agent burned ~15× a chat's tokens and paid for itself only because the task's value cleared the bill. The synthesis this file operationalizes: **parallelize reads, serialize writes** — fan out for exploration/gathering/verification where sub-agent isolation is also the anti-poisoning tool (files 02/04), converge to a single full-context agent wherever outputs must cohere — and every fan-out obeys the delegation contract Anthropic's postmortems teach: a sub-agent task is a *written brief* (objective, output format, tool/source guidance, boundaries — a vague brief duplicates work and returns Super-Mario-plus-bird integrations), sized to the task (their finding: agents over-spawn for simple queries unless told the effort class), with results returned as *structured findings, not transcripts* (the orchestrator needs conclusions and evidence pointers — importing a worker's whole trace re-inflates file 02's quadratic and re-couples the contexts isolation just decoupled).

## 1. The Topology Table

| Topology | Shape | Right for | The failure it invites |
|---|---|---|---|
| Single agent, full context | One loop, one context (compaction as needed, file 04) | Write-heavy coherent outputs; long chains of dependent decisions — **the default** | Context exhaustion on huge tasks (mitigate: compaction, checkpoints) — not coordination failure |
| Orchestrator–workers | Lead plans/decomposes; parallel sub-agents execute briefs; lead merges | Read-heavy decomposable work (research, codebase survey, multi-source verification); Ch09's gang arithmetic prices the parallel admission | Vague briefs → duplicated/conflicting work; transcript-dumping → context re-coupling; over-spawning on simple tasks |
| Specialist handoff | Sequential agents with different toolsets/policies; explicit baton pass | Phase changes with different authority/tools (plan in read-only mode → execute with write grants — a *security* topology as much as an efficiency one, file 08) | State lost at the baton pass — the handoff artifact is a contract (file 07's checkpoint), not a chat summary |
| Peer/A2A federation | Agents across org/vendor boundaries discover and delegate ([A2A protocol](https://a2a-protocol.org/) — Linux Foundation since June 2025, 150+ orgs; adoption real, cross-vendor production still early — status per standard 15) | Cross-boundary delegation where the counterparty is *another company's* agent | Everything in file 08, squared: the remote agent is an untrusted tool with agency — authority, injection, and audit at the federation boundary |

The criterion, restated as the review question: **where do this task's outputs merge, and what conflicts there?** If independent findings merge (facts, test results, search hits) — fan out. If decisions merge (code, designs, narrative) — one decider. Mixed tasks decompose along exactly that line: parallel evidence-gathering feeding a single synthesizing writer, which is the shape both camps' production systems converge on in practice.

## 2. The Delegation Contract and the Merge Discipline

```text
Figure 1. The orchestrator-worker seam — briefs down, findings up.

  orchestrator (full episode context, owns the plan)
      │ BRIEF, per worker:            │ FINDINGS, per worker:
      │  · objective + success        │  · conclusions
      │    criteria                   │  · evidence pointers
      │  · output format (schema!)    │    (identifiers, not
      │  · tools/sources to use       │    payloads — f04's
      │  · boundaries + effort class  │    just-in-time rule)
      │  · budget (Ch09 f09 debit)    │  · confidence + gaps
      ▼                               ▲   · budget consumed
  workers: isolated contexts (f04) — no sibling visibility,
  no orchestrator history; parallel; individually budgeted,
  checkpointed (f07), and traced (f09)
  ─────────────────────────────────────────────────────────────
  merge rules: findings are DATA the orchestrator reasons over
  (labeled, sourced — f04's read-trust); conflicts between
  workers are surfaced as conflicts, not silently averaged;
  the orchestrator may re-brief, never re-run-and-hope
```

The composition arithmetic that governs the choice (file 02 applied): fan-out multiplies *cost* by worker count but divides *wall-clock* for the parallelizable phase, and — the subtle term — changes the failure structure: k independent workers on independent sub-questions fail independently (good: one bad worker loses one finding), while k workers whose outputs must integrate fail *jointly* (bad: one misread brief poisons the merge — the pⁿ exponential now has a max(), not a product, over correlated branches). The honest overhead line: orchestration itself consumes model calls (planning, briefing, merging), so below a task-size threshold the orchestrator *is* the overhead — Anthropic's own guidance scales effort to query complexity, and the dossier states the threshold rather than fanning out on reflex.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Criterion gate | Per task class: the merge analysis (findings vs decisions) with the topology derived from it; single-agent as the stated default | Multi-agent by fashion; parallel writers on coupled outputs; the Cognition failure shipped |
| Brief gate | Delegation briefs as schema'd artifacts (objective, format, tools, boundaries, effort class, budget); brief quality eval-tested | "Research topic X" briefs; over-spawning on simple queries; workers inventing their own scope |
| Merge gate | Findings as structured, sourced data; conflicts surfaced; no transcript-dumping into the orchestrator | Worker traces pasted whole; silent averaging of contradictory findings |
| Economics gate | The fan-out bill (×k tokens + orchestration overhead) priced against the wall-clock and quality gain; the task-size threshold stated | 15× token bills on tasks a single loop handles; orchestrators orchestrating trivia |
| Federation gate | A2A-class cross-boundary delegation under file 08's full authority/injection/audit discipline; counterparty agents treated as untrusted tools with agency | Remote agents trusted as colleagues; delegation across org boundaries without the trifecta analysis |

## Output

The output of this file is a topology decision made by the merge criterion rather than the hype cycle: single full-context loops as the default and the only sane shape for coupled writes, orchestrator-worker fan-outs where independent reads parallelize under schema'd briefs and structured findings, handoffs as authority transitions with contract-grade baton passes, and federation admitted only under the full security discipline — with the fan-out's token bill and orchestration overhead priced before the first worker spawns.

## References

- [Anthropic, "How we built our multi-agent research system" — orchestrator-workers, the 90.2% result, and its production lessons](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Cognition, "Don't Build Multi-Agents" — the context-coupling argument and its two principles](https://cognition.ai/blog/dont-build-multi-agents)
- [A2A Protocol — cross-vendor agent delegation (Linux Foundation, June 2025)](https://a2a-protocol.org/)
- [Chapter 09 file 09 §3 — gang/episode admission for parallel workers](../09-scheduling-queues-and-resource-admission/09-ai-workload-scheduling.md)
