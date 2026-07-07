# Tool Contracts and the Action Interface

## Abstract

A tool is an API contract whose consumer is a model, and that one clause changes the engineering in both directions. Downward, every law of Chapter 07 applies verbatim and the root README's list is the checklist: each tool declares **schema** (a contract artifact — Ch07 f01's discipline, with the model as the consumer whose "Hyrum's Law" is the training distribution), **timeout** (a budget inside the episode's budget — Ch07 f03's decomposition, because a hung tool is a hung episode), **retry policy** (safe only against the tool's declared idempotency — Ch07 f04's keys thread through tool-executed mutations, so a retried turn cannot re-execute a payment), **validation**, **fallback** (what the loop does when the tool is down — degrade, substitute, or escalate, chosen per tool), and **security boundary** (the authority it acts with — file 08's least-privilege delegation, never ambient). Upward, the consumer's peculiarity creates a design discipline APIs never needed: the model chooses *whether and how* to call from the schema text alone, so **the tool's description, parameter names, and error messages are load-bearing prompt engineering** — the measured finding of the field's tool-design guidance is that agents succeed or fail on tool *ergonomics*: unambiguous names in a flat namespace (near-duplicate tools measurably degrade selection), descriptions that say when *not* to use the tool, parameters that cannot be half-right, responses that return the 500 tokens that steer rather than the 50k that drown (file 02's δ), and errors that are *actionable instructions* ("file not found; similar paths: …") rather than stack traces — because an error message consumed by a model is a prompt that either steers the repair phase or feeds the doom loop ([Anthropic, "Writing effective tools for agents"](https://www.anthropic.com/engineering/writing-tools-for-agents)). The consolidation layer is **MCP** ([spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)): tools/resources/prompts as a standard surface with OAuth 2.1 authorization — which standardizes the *plumbing* while leaving every contract above (authority, idempotency, response design, the trifecta analysis of file 08) exactly where this chapter puts it: on the integrator.

## 1. The Per-Tool Contract Table

```text
Figure 1. The tool registry row — one per tool, no blank cells.
The harness enforces what the schema declares.

  ┌──────────────┬─────────────────────────────────────────────┐
  │ schema        │ versioned artifact; params typed/enumed;    │
  │               │ description says when NOT to use (f01's     │
  │               │ admission, written into the tool itself)    │
  │ timeout       │ derived from episode budget (Ch07 f03);     │
  │               │ long work → LRO handle, not a long wait     │
  │ idempotency   │ read / idempotent-write / keyed-write /     │
  │               │ NON-idempotent (retry forbidden; approval   │
  │               │ gate per f08) — the retry policy DERIVES    │
  │ side effects  │ declared: none / reversible / irreversible  │
  │               │ → drives f08's approval + sandbox tiers     │
  │ response      │ token-budgeted; pagination for big results; │
  │               │ errors as steering text                     │
  │ authority     │ the credential it acts with (delegated,     │
  │               │ scoped — f08); NEVER inherited ambient      │
  │ fallback      │ down → degrade / substitute / escalate      │
  └──────────────┴─────────────────────────────────────────────┘
```

Three registry-level rules complete the table. **Curation beats coverage**: tool selection error rises with registry size and similarity — a registry is *engineered* (merged near-duplicates, task-scoped subsets loaded per episode phase, deliberate naming taxonomy), not accumulated; "add another tool" carries the same review weight as "add another endpoint." **Versioning is Ch07 f07 with a twist**: the consumer cannot read a changelog — a changed tool description or parameter shape shifts model behavior *silently*, so tool versions are pinned per harness version and changes go through file 09's eval canary, exactly as a model change would. **Code execution is the escape hatch with its own contract**: for long tails of one-off operations, a sandboxed code-execution tool outperforms a hundred bespoke tools (composability, and the model's strongest trained skill) — priced at file 08's full sandbox discipline, because "run arbitrary code" is the maximal-authority tool and must be boxed accordingly.

## 2. MCP and the Integration Boundary

What MCP settles: discovery (a server advertises tools/resources with schemas), transport and sessions (Streamable HTTP — Ch07 f09's machinery), and authorization plumbing (OAuth 2.1 — Ch07 f08 §4's delegation, standardized). What it deliberately does not settle — the review's checklist for every MCP integration: **trust** (an MCP server is a third-party dependency executing in your authority chain: its tool descriptions enter your prompts — a malicious or compromised server is a prompt-injection vector by construction, file 08's supply-chain row), **quality** (server-provided descriptions and responses are rarely tuned for *your* agent's tasks — wrap, filter, and token-budget them; the registry rules of §1 apply to imported tools doubly), and **authority** (the server's credentials must be scoped to the delegation chain, not to a service account with standing power — the GitHub-MCP exploit shape, where one server combining private-repo read, public-issue read, and PR-write assembled file 08's lethal trifecta in a single integration, is the standing cautionary instance). The rule that compresses all three: **importing a tool imports a contract, and contracts get reviewed** — an MCP server added to a production agent without the §1 table filled per imported tool is a dependency added without a dossier.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Contract gate | The §1 registry row complete per tool; timeouts derived; retry policy consistent with declared idempotency; fallbacks chosen | Tools as bare function bindings; retries against non-idempotent mutations; blank cells defaulted |
| Ergonomics gate | Descriptions/errors written as steering text and *eval-tested* (tool-selection and repair-success rates per tool, file 09) | 50k-token responses; stack traces as error surfaces; near-duplicate tools degrading selection |
| Registry gate | Curated, task-scoped toolsets; naming taxonomy; additions reviewed with the same weight as endpoints | Registry sprawl; every team's tool auto-loaded into every episode |
| Version gate | Tool schemas/descriptions pinned per harness version; changes through the eval canary | Silent description edits shifting production behavior |
| Import gate | Per MCP/third-party tool: the §2 trust/quality/authority checklist + the §1 table; server updates treated as dependency updates | Servers integrated on vibes; imported descriptions entering prompts unreviewed; ambient-authority credentials |

## Output

The output of this file is an action interface under contract: every tool a registry row with schema, budget, idempotency, side-effect class, authority, and fallback declared and harness-enforced; descriptions and errors engineered as the steering text they are and proven by per-tool eval rates; the registry curated like the API surface it is; and imported tool surfaces — MCP included — reviewed as the third-party contracts they are, with the plumbing standardized and the responsibility exactly where it always was.

## References

- [Anthropic, "Writing effective tools for agents" — tool ergonomics as measured engineering](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Model Context Protocol specification (2025-11-25) — tools, resources, authorization](https://modelcontextprotocol.io/specification/2025-11-25)
- [Chapter 07 file 01 — the contract-artifact discipline tools inherit](../07-api-contracts-and-request-lifecycle/01-the-contract-artifact-and-schema-first-design.md)
- [Chapter 07 file 04 — idempotency keys through tool-executed mutations](../07-api-contracts-and-request-lifecycle/04-idempotency-and-safe-retries.md)
- [Simon Willison, "The lethal trifecta" — the GitHub MCP exploit as the import-boundary cautionary instance](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
