# Identity, Authentication, and Authorization

## Abstract

Every trust-boundary crossing (file 01) begins with the same two questions in strict order: **authentication** — *who is this?*, answered by a proven identity — and **authorization** — *are they allowed to do this specific thing to this specific resource?*, answered by a policy evaluated against that identity. Conflating them is the root of a class of breaches: a system that authenticates ("you are a valid user") and then skips per-object authorization ("...so you may read *any* order") is the [OWASP #1 API risk, Broken Object-Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — the authenticated user reading *another* user's data by changing an ID, because the system checked *who* but not *whether they may touch this object*. This file establishes identity as the foundation of all enforcement, across two principal classes the book must both handle. **Human identity** is the familiar case (authenticate via credentials + MFA, federate via OIDC, carry as a token), governed by the principle of **least privilege** (a principal is granted the minimum permissions its role requires — Saltzer & Schroeder's foundational rule) enforced through RBAC (roles) or ABAC (attributes), so a compromised human credential reaches only that human's minimal scope. **Workload identity** is the case distributed systems get wrong: services calling services need identities too, and the anti-pattern — long-lived shared API keys and passwords embedded in config — is a standing breach (a leaked key is a permanent credential with no expiry, no rotation, no attribution). The modern answer is [SPIFFE/SPIRE](https://spiffe.io/) (CNCF): every workload gets a cryptographic, *short-lived* identity (an SVID, ~1-hour default, auto-rotated), attested from its runtime properties rather than a shared secret, enabling mutual-TLS service-to-service auth with no manually-managed credentials — turning identity from a static secret to be stolen into a verifiable, expiring property of the workload. The chapter's hardest new case (standard 1, developed in f09) is **the agent as a principal**: an AI agent acting on a user's behalf needs an identity and a permission scope, and the question "*whose* authority does this tool call carry — the user's, the agent's, the developer's?" is a live delegation problem (**token exchange**, on-behalf-of flows, [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693)) that determines the blast radius when the agent is steered by a prompt injection (Chapter 11 f08). The synthesis and the first-principles arithmetic (standard 9): **the blast radius of a compromised identity equals its privilege scope**, so least privilege is not a best practice but the direct lever on how much a breach reaches — and identity, authenticated strongly and scoped minimally, is the boundary control every other boundary depends on.

## 1. Authentication Then Authorization — Never One Without the Other

```text
Figure 1. The two-question sequence at every boundary. Authn proves
identity; authz checks permission PER RESOURCE. Skipping the second
(per-object) check is OWASP's #1 API risk (BOLA).

  request ──► AUTHENTICATION: who is this? (proven, not claimed)
                │   credential + MFA / OIDC token / mTLS SVID (§3)
                │   result: a verified PRINCIPAL identity
                ▼
              AUTHORIZATION: may THIS principal do THIS action on
                │            THIS specific object?
                │   policy(principal, action, resource) → allow/deny
                ▼
          ┌─────────────────────────────────────────────┐
          │  BOLA (the #1 failure): authn passes, then   │
          │  the code fetches resource by ID from the    │
          │  request WITHOUT checking the principal owns  │
          │  it → user 123 reads order 999 by changing    │
          │  the URL. Authenticated ≠ authorized-for-this.│
          └─────────────────────────────────────────────┘

  Rule: authorization is per (principal, action, RESOURCE) — the
  object-level check is the one most often skipped and most often
  breached. "Logged in" is not "allowed to touch this row."
```

The sequence is inviolable and the object-level check is the one that matters: most authentication is done correctly (it is visible and tested — you cannot log in without it), while authorization, especially *per-object* authorization, is the silent gap because the happy path works (users usually request their own data, so the missing check is invisible until someone requests someone else's). This is why authorization is enforced at a **policy decision point** evaluated on every access against the specific resource — not assumed from authentication, not checked once at the edge and trusted thereafter (zero trust, file 01: every access re-authorized), and not left to the incidental fact that the UI only shows a user their own data (the API is the boundary, not the UI).

## 2. Least Privilege — The Blast Radius of an Identity

```text
Figure 2. Least privilege as blast-radius control (standard 9). A
compromised identity reaches exactly its privilege scope — no more,
no less. Minimizing scope minimizes the breach.

  blast radius of a compromised identity = its PRIVILEGE SCOPE

  over-privileged (the anti-pattern):
    service account with admin/* on the whole database
    → compromise = TOTAL: every table, every tenant, exfil + destroy

  least privilege (the discipline):
    service account with SELECT on 2 tables in 1 schema, no delete
    → compromise = BOUNDED: those 2 tables, read-only, one blast unit

  the arithmetic: if a principal can reach N resources with M
  actions, a breach of it reaches N×M. Least privilege drives both
  factors toward the minimum the role actually needs — turning a
  total compromise into a contained one (assume-breach, f01).

  scoping dimensions to minimize:
    · resources (which tables/buckets/services/tools — f09 for agents)
    · actions (read vs write vs delete vs admin)
    · time (short-lived credentials, §3 — a stolen 1h token expires)
    · conditions (from this network / this workload / with MFA)
```

Least privilege is the file's load-bearing principle because it is the *direct* control on assume-breach's core quantity (file 01): the blast radius of a compromise is the privilege scope of what was compromised, so every permission granted beyond strict necessity is blast radius added to the eventual breach. The discipline scopes on four dimensions — resources, actions, time, and conditions — and the time dimension connects to §3's short-lived credentials: a permission that expires in an hour bounds the breach *temporally* even if it cannot be bounded further in scope. The failure this prevents is the standing over-grant — the service account with admin on everything "to make it work," the API key with full scope "for convenience" — each of which converts an eventual credential compromise from a contained incident into a total one, the difference between a bad day and a company-ending breach.

## 3. Workload Identity — Killing the Long-Lived Shared Secret

The distributed-systems identity failure is service-to-service authentication done with **long-lived shared secrets**: an API key or password, embedded in config or environment, the same across instances, never rotated, valid forever. Every property is a security defect — it is a permanent credential (no expiry to limit a theft), shared (no attribution of which instance acted), static (stolen once, valid always), and stored (in config, in logs despite Chapter 14 f03, in a leaked repo). **SPIFFE/SPIRE** replaces it with cryptographic workload identity:

- **Short-lived**: an SVID defaults to ~1-hour validity and auto-rotates, so a stolen identity expires — the temporal blast-radius bound of §2 applied to workloads, turning "stolen once, valid forever" into "stolen once, valid for minutes."
- **Attested, not shared**: the identity is issued based on the workload's *verifiable runtime properties* (its Kubernetes service account, its node, its process), not a secret it holds — so there is no shared key to leak, and identity becomes a property the platform *proves* rather than a secret the workload *keeps*.
- **mTLS by default**: workloads present SVIDs to each other for mutual TLS, so every service-to-service call is mutually authenticated and encrypted (zero trust, file 01) with no application code managing credentials — Istio issues X.509-SVIDs natively, Envoy consumes them via SDS.

The reframing: **identity should be a verifiable, expiring property of a workload, not a static secret it stores** — which eliminates the entire failure class of leaked long-lived credentials (still, per industry data, among the most common breach root causes) by making the credential too short-lived to be worth stealing and unattached to any secret that *can* be stolen.

## 4. Delegation and the Agent Principal

```text
Figure 3. Delegation: whose authority does a downstream call carry?
Critical for agents (f09) — a prompt-injected agent's blast radius
is whatever authority its tool calls carry.

  user ──authenticates──► app ──calls──► downstream service / tool
                            │
              whose identity does the downstream call use?
   ┌──────────────────────┼───────────────────────────────┐
   ▼                      ▼                                 ▼
  app's own identity   user's delegated authority       a THIRD,
  (the app acts as     (on-behalf-of / token exchange,   scoped-down
   itself — wrong if    RFC 8693 — the call carries the   identity for
   the action is the    USER's scope, not the app's)      the task
   user's)              → correct for user actions;        (least priv
                          the downstream sees the real     for the
                          principal + can authz per-user   specific op)

  Agent case (f09): an agent calling tools must carry a SCOPED
  authority, so a prompt injection that hijacks the agent (Ch11 f08)
  can reach only the delegated scope — NOT the agent's full
  privileges, NOT the developer's. Delegation scope = injection
  blast radius. This is why "the agent runs as admin" is the
  lethal-trifecta amplifier.
```

Delegation determines *whose authority a call carries*, and getting it wrong is a privilege-escalation vulnerability: an app that calls downstream services *as itself* (with its own broad privileges) rather than *on behalf of the user* (with the user's narrow scope) means any user action runs at the app's privilege — so a flaw in the app reaches everything the app can, not just what the user could. **Token exchange** (RFC 8693) and on-behalf-of flows carry the *user's* delegated, scoped authority downstream, so the downstream service authorizes against the real principal. For agents (file 09) this is the security-critical case: an agent's tool calls must carry a *minimally-scoped* delegated identity, because a prompt injection that steers the agent (Chapter 11 f08's lethal trifecta) can invoke tools only within that scope — so "the agent has admin" or "the agent uses the app's full credentials" is the design that turns a successful injection into a total compromise, while a tightly-scoped, per-task delegated identity keeps the injection's blast radius to the delegated minimum.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Authn/authz-order gate | Authentication then per-(principal, action, resource) authorization at every access; object-level checks present | BOLA — authenticated users reaching others' objects by ID; authz checked once at the edge and trusted after |
| Least-privilege gate | Every identity scoped to the minimum resources/actions/time/conditions its role needs; blast radius = scope minimized | Over-privileged service accounts (admin/*); API keys with full scope "for convenience"; total-compromise blast radius |
| Workload-identity gate | Short-lived attested workload identities (SPIFFE/SVID) with mTLS; no long-lived shared secrets in config | Long-lived shared API keys/passwords in config; static, unrotated, unattributed service credentials |
| Delegation gate | Downstream calls carry the correct (usually the user's delegated, scoped) authority via token exchange; not the app's broad identity | Apps calling downstream as themselves at broad privilege; user actions running at app scope |
| Agent-principal gate | Agent tool calls carry a minimally-scoped delegated identity so injection blast radius = delegated scope | Agents running as admin or with the app's full credentials — a successful injection becoming total compromise |

## Output

The output of this file is identity as the foundational boundary control: authentication proving *who*, authorization checking *whether this principal may touch this specific resource* (the object-level check whose absence is the #1 API breach), and least privilege scoping every identity so the blast radius of its compromise is the minimum its role requires. Workload identity replaces the long-lived shared secret with short-lived attested credentials and mTLS, eliminating the leaked-key failure class, and delegation carries scoped authority downstream so an agent steered by injection reaches only its delegated minimum. Identity, strongly authenticated and minimally scoped, is the control on which every other boundary in the chapter depends.

## References

- [OWASP API Security — Broken Object-Level Authorization (API #1)](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [SPIFFE / SPIRE — workload identity (short-lived SVIDs, mTLS)](https://spiffe.io/)
- [RFC 8693 — OAuth 2.0 Token Exchange (delegation, on-behalf-of)](https://datatracker.ietf.org/doc/html/rfc8693)
- [Saltzer & Schroeder, "The Protection of Information in Computer Systems" (1975) — least privilege](https://www.cs.virginia.edu/~evans/cs551/saltzer/)
