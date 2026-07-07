# Chapter 11 — Agentic Orchestration and Tool Routing

## Abstract

This chapter closes the loop the book has been building toward: the caller that iterates at machine speed, turning the model's output into the system's next input and exercising every contract the previous ten chapters established. Its governing claim is that an agent is autonomy wrapped in an envelope, and the envelope — not the model — is the engineering: a harness that owns the budgets, tools, context, checkpoints, and traces, so that the model's discretion operates inside limits that code enforces. The chapter is built on two exponentials it derives rather than asserts (standard 9): episode success as pⁿ (why a 95%-per-step agent finishes a 20-step task 36% of the time, and why verification is the only intervention that breaks the curve), and episode cost as a quadratic in turns (why prefix caching, compaction, and tool-response hygiene are economic necessities, not optimizations). Around the arithmetic sit the disciplines the machinery demands: an admission decision that prefers workflows to agents wherever structure is known; tools as contract artifacts whose descriptions are load-bearing prompt engineering; context as a budgeted ledger tuned against the model's measured attention-decay curve; a topology choice resolved by a merge criterion rather than a hype cycle; verification as a strength-ordered ladder honest about its gap; and a security posture that assumes the model *will* be steered — breaking the lethal trifecta structurally because prompt injection remains unsolved. The through-line: you cannot make the model trustworthy, so you make the system bound what an untrustworthy model can do.

## Chapter Structure

| File | Claim it carries |
|---|---|
| [00-chapter-file-map.md](00-chapter-file-map.md) | Reading order, approval dependency graph, prerequisites from Chapters 01–10 |
| [01-the-agent-admission-decision-and-loop-anatomy.md](01-the-agent-admission-decision-and-loop-anatomy.md) | When NOT to build an agent; the bounded loop; the harness as the system boundary |
| [02-agent-failure-arithmetic-and-episode-economics.md](02-agent-failure-arithmetic-and-episode-economics.md) | pⁿ and its correlated-failure envelope; pass^k; the quadratic cost and its discounts |
| [03-tool-contracts-and-the-action-interface.md](03-tool-contracts-and-the-action-interface.md) | Tools as contracts for a model consumer; ergonomics as prompt engineering; MCP as consolidation |
| [04-context-engineering-and-agent-memory.md](04-context-engineering-and-agent-memory.md) | Context as a budgeted ledger; curation/compaction/isolation; memory as owned derived state |
| [05-orchestration-topologies-single-and-multi-agent.md](05-orchestration-topologies-single-and-multi-agent.md) | The multi-agent debate resolved by the merge criterion; briefs and findings; federation |
| [06-routing-model-tiers-and-escalation.md](06-routing-model-tiers-and-escalation.md) | Task/step routing; cheapest-adequate tiers; signal-triggered escalation ladders |
| [07-verification-repair-and-checkpoint-discipline.md](07-verification-repair-and-checkpoint-discipline.md) | The verifier ladder and its gap; bounded informed repair; durable-execution checkpoints |
| [08-security-sandboxing-and-blast-radius.md](08-security-sandboxing-and-blast-radius.md) | Prompt injection and the lethal trifecta; least-privilege; sandboxing; the incident corpus |
| [09-agent-observability-and-evaluation.md](09-agent-observability-and-evaluation.md) | Episode traces; the agent SLI set; the three-layer eval harness as a canary gate |
| [10-verification-of-agent-contracts.md](10-verification-of-agent-contracts.md) | Drills T1–T10 pairing capability with safety; six-field episode-generation stamps |
| [11-agent-review-templates.md](11-agent-review-templates.md) | The ten-section dossier and 24-point reviewer checklist |

## Source Corpus

| Source | What this chapter takes from it |
|---|---|
| [Anthropic, "Building effective agents"](https://www.anthropic.com/research/building-effective-agents) | The workflow-vs-agent discipline; the pattern catalog; the routing/effort-scaling guidance |
| [Anthropic, "Effective context engineering for AI agents"](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context as scarce resource; curation, compaction, just-in-time; the rot curve |
| [Anthropic, "Writing effective tools for agents"](https://www.anthropic.com/engineering/writing-tools-for-agents) | Tool ergonomics as measured engineering; error text as steering |
| [Anthropic, "How we built our multi-agent research system"](https://www.anthropic.com/engineering/multi-agent-research-system) + [Cognition, "Don't Build Multi-Agents"](https://cognition.com/blog/dont-build-multi-agents) | The multi-agent debate; the read/write merge criterion; delegation briefs; the 15× token math |
| [Yao et al., "ReAct" (2022)](https://arxiv.org/abs/2210.03629) | The reason-act-observe loop's canonical formulation |
| [Yao et al., "τ-bench" (2024)](https://arxiv.org/abs/2406.12045) | pass^k reliability; outcome-state evaluation |
| [OWASP Top 10 for LLM Applications (2025)](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | Prompt injection (#1); excessive agency; the security taxonomy |
| [Simon Willison, "The lethal trifecta"](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) | The private-data + untrusted-content + exfiltration combination and its structural defense |
| [The Register, "Replit deleted production database" (July 2025)](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/) | The blast-radius incident this chapter's gates exist to prevent |
| [Model Context Protocol (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25) + [A2A Protocol (LF, 2025)](https://a2a-protocol.org/) | Tool and agent-to-agent interoperability standards; the import/federation boundaries |
| [Temporal, "Durable execution for AI agents"](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai) | The checkpoint/replay pattern for resumable episodes |

## Chapter Standards

1. Research-note structure per file: Abstract → numbered sections with formal models → ASCII figures ("Figure N.") → decision tables → approval gates → Output → verified primary-source references.
2. The when-NOT decision is first-class: the workflow-vs-agent admission table, with verifiability as a precondition (file 01).
3. Autonomy is a harness-enforced envelope; every limit is code-owned; the model requests, the harness grants.
4. The governing arithmetic is derived (standard 9): pⁿ failure with its correlated-failure envelope, and quadratic cost with its discounts (file 02).
5. Reliability is reported as pass^k, never pass@k; success rates travel with cost and latency distributions.
6. Tools are contract artifacts (Chapter 07 inherited) whose descriptions and errors are load-bearing prompt engineering, eval-tested per tool.
7. Context is a budgeted ledger tuned against the measured rot curve; memory is owned derived state (Chapter 03 inherited) with write gates and read labels.
8. Topology follows the merge criterion (findings parallelize, decisions serialize); single-agent is the default; fan-out is priced.
9. Verification is a strength-ordered ladder (executable > structural > calibrated-judge > self-assessment) spent at the decisive steps and honest about its gap.
10. Episodes are durable, checkpointed, resumable state (Chapter 07 LRO inherited); checkpoints re-anchor the failure exponential.
11. Security assumes the model will be steered: the lethal trifecta is broken structurally; authority is least-privilege and delegated; blast radius is bounded and audited.
12. Every stated law/formula carries a worked numeric example (pⁿ table; p→p′ lift; 2.8M-token episode; 37% tier-routing bill; pass^k = p^k).
13. Validity envelopes on every model and technique (standard 7): the independence assumption's two-way failure, the rot curve's model-dependence, the router's error rates, the judge's calibration half-life.
14. The research frontier and its debates are represented honestly (standard 8 applied inline): the multi-agent disagreement resolved as a criterion, the verifier gap admitted, A2A's early adoption stated.
15. Version-status claims are search-verified at write time and stated inline (MCP 2025-11-25; A2A under Linux Foundation since June 2025; OWASP 2025 edition).
16. Verification pairs capability drills with safety drills under six-field episode-generation stamps; reliability is large-N and pass^k; the canary spine gates every prompt/tool/model/route change (file 10).
17. The chapter approves agent-system decisions only; wrapped APIs, serving, admission, and retrieval are cited prerequisites (file 11 §4).
18. The README carries an Open Problems section (standard 8).

## Chapter Completion Gate

The chapter is complete for a given system only when its review can answer:

1. Why is this an agent rather than a workflow or one call — and can its success actually be verified?
2. What does the pⁿ arithmetic project at the production step-count, and what does verification lift it to?
3. What is the episode's token ledger and pass^k, and what budget do they derive?
4. For every tool: the complete contract row, its measured ergonomics, and — if imported — its trust/authority review?
5. What is the context ledger, and how are compaction loss and memory ownership governed?
6. What does the merge criterion say the topology should be, and is single-agent the justified default?
7. How is each decisive step verified, where is the verifier gap, and how are episodes checkpointed and resumed?
8. What is the injection-surface inventory, and does any agent hold the whole lethal trifecta?
9. What authority does each tool act with, what gates the irreversible actions, and what bounds the blast radius?
10. What do the episode traces and the canary-gated eval harness show — and what is the evidence half-life?

## Open Problems

Stated honestly, per this chapter's standard: **(1) Prompt injection is unsolved** — instructions and data share one channel, and no prompt-level defense closes the gap; this chapter's answer is structural containment (break the trifecta, least privilege, sandboxing, audit), which *bounds* the damage but does not prevent the steering — a genuinely open research problem the field has not cracked. **(2) The verifier gap**: for open-ended outputs without executable or structural ground truth, there is no verifier stronger than calibrated judges plus human review — which caps what agents can responsibly own end-to-end and makes "verifiable" an admission criterion rather than an assumption. **(3) The multi-agent question is workload-dependent and under-theorized**: the read/write merge criterion is a useful heuristic, not a theory — the field lacks a predictive account of when coordination overhead exceeds parallelization benefit. **(4) Long-horizon reliability**: pⁿ says even small per-step error compounds fatally over long horizons, and while verification and checkpointing help, agents that reliably execute hundred-step tasks remain at the edge of current capability — the horizon at which autonomy is trustworthy is shorter than the horizon at which it is marketed. **(5) Evaluation of open-ended agency**: no eval fully captures the quality of open-ended work, judges are gameable and version-fragile, and offline suites drift from production — so agent evidence has a short half-life and honest measurement remains partly unsolved.

## Final Position

An agent is the point where every contract in this book gets exercised by a caller that never tires and cannot be trusted — and this chapter's discipline is that the system, not the model, holds the line: budgets bound the cost, verification breaks the failure exponential, checkpoints make long work durable, and a security envelope bounds what a steered model can reach. The seam forward: agents in this chapter consulted retrieval and memory as a cited prerequisite; Chapter 12 turns to that pipeline directly — retrieval, memory, and grounding architecture, where ingestion, chunking, embedding, index structure, reranking, context packing, and citation policy determine whether the knowledge an agent reasons over is trustworthy, fresh, and attributable, or a confident hallucination with a vector index behind it.

## References

- [Anthropic, "Building effective agents"](https://www.anthropic.com/research/building-effective-agents)
- [Yao et al., "τ-bench" (2024)](https://arxiv.org/abs/2406.12045)
- [OWASP Top 10 for LLM Applications (2025)](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Simon Willison, "The lethal trifecta"](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
