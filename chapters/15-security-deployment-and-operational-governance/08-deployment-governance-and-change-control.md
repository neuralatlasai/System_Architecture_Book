# Deployment Governance and Change Control

## Abstract

Deployment is the most powerful operation in any system — it is the act of *changing what the system is*, applied (absent controls) with the highest privilege to production — so it is simultaneously the largest reliability risk (Chapter 13 f07 showed change as the leading cause of incidents) and a first-class *security* concern this file owns: the deploy pipeline is a high-value attack surface (compromise it and you ship malicious code signed by the trusted pipeline — the supply-chain attack of file 06 from the inside), and a deployment is a privileged action that must be governed like any other. The root-README thesis this file operationalizes: **deployment is acceptable only when observability and recovery paths are already verified** — because shipping a change into a system you cannot observe (Chapter 14) or recover (Chapter 13) is not a deployment, it is an un-instrumented, un-reversible bet, and the readiness gate of Chapter 14 f10 is where this becomes a hard precondition. The governance disciplines: **change control** (changes are reviewed, approved, and recorded — the audit trail of file 07 applied to "what changed and who approved it," the first question of every incident), **separation of duties / four-eyes** (a production deployment, like any high-risk operation, requires a second authorized approver so no single compromised or malicious principal can ship to production alone — file 07's principle at the deploy boundary), **least-privilege CI/CD** (the pipeline and its credentials are scoped minimally and hardened, because a pipeline with broad standing production credentials is a single compromise away from total control — the deploy system is itself subject to files 02 and 04), and **progressive delivery as a security control** (Chapter 13 f07's staged rollout, reframed: a canary bounds the blast radius of a *malicious or compromised* deploy exactly as it bounds a buggy one, and automated rollback on the security-relevant SLIs — an anomaly, an egress spike — reverts it fast). The **break-glass** discipline handles the exception: emergency access that bypasses normal controls exists (incidents demand it), but it is *heavily audited, time-boxed, and alerting* — so the emergency path is not a permanent backdoor but a logged, reviewed exception. The synthesis and the book's operational closing discipline: **the operation that changes the system is governed as the highest-privilege action it is** — reviewed, approved by more than one party, executed by a least-privileged hardened pipeline, gated on the prior chapters' verification, rolled out progressively, and fully audited — because the deploy is where reliability, security, and governance meet, and an ungoverned deploy pipeline is the single control whose compromise undoes every other control in this book.

## 1. Deployment as a Governed, Highest-Privilege Operation

```text
Figure 1. The governed deployment path. Each gate is a control; the
deploy is treated as the highest-privilege action it is, not a
routine convenience.

  change proposed
     │  ── change control: reviewed, approved, RECORDED (f07 audit)
     ▼
  built by a hardened, least-privilege pipeline (f02/f04)
     │  ── supply-chain integrity: signed, provenance-attested (f06)
     ▼
  APPROVED to deploy — separation of duties: 2nd approver (four-eyes)
     │  ── no single principal ships to prod alone
     ▼
  READINESS GATE (Ch14 f10): observability + recovery VERIFIED
     │  ── deployment acceptable ONLY when these are proven
     ▼
  PROGRESSIVE ROLLOUT (Ch13 f07): cell → 1% → ... gated on SLIs
     │  ── bounds blast radius of a bad OR malicious deploy;
     │     auto-rollback on breach (incl. security-relevant SLIs)
     ▼
  deployed, fully audited (who changed what, when, approved by whom)

  A deploy that skips any gate is an ungoverned change to production
  — the highest-privilege operation, done without the controls its
  power demands.
```

The figure is the file's thesis made procedural: a deployment traverses a chain of governance gates — reviewed and recorded, built by a hardened pipeline, approved by a second party, gated on verified observability and recovery, rolled out progressively, and audited — each a control matched to the operation's power. The reframing from Chapter 13 (deploy as controlled *fault* injection) to this chapter is deploy as a *privileged* operation and a *security* boundary: the controls that make it reliable (staging, rollback) are the same controls that make it secure (blast-radius bounding of a malicious change, fast revert of a compromised one), which is why deployment governance is where the book's reliability and security disciplines converge on a single operation.

## 2. The Deploy Pipeline as an Attack Surface

The CI/CD pipeline is a high-value target because it has what an attacker wants: the ability to run code and ship it to production, trusted. Securing it applies this chapter's own controls to the pipeline itself:

- **Least-privilege pipeline credentials** (file 02): the pipeline's production access is scoped minimally and, ideally, short-lived (per-deploy credentials, not standing production admin), so a compromised pipeline reaches only what a specific deploy needs — because a pipeline with broad standing production credentials is a single compromise away from total control, and pipeline compromises are a documented, high-impact attack class.
- **Supply-chain integrity of the pipeline** (file 06): the build tools, CI plugins, and base images the pipeline uses are themselves dependencies in the trust model — a poisoned CI plugin is a supply-chain attack on every artifact the pipeline builds — so the pipeline's own inputs are vetted, pinned, and provenance-checked.
- **Separation between build and deploy authority** (file 07): the ability to *build* an artifact and the ability to *deploy* it to production are separated, so compromising the build system does not automatically grant production deployment, and the four-eyes approval sits at the deploy boundary where the privilege is highest.
- **The pipeline's actions are audited** (file 07): every build and deploy is attributably logged, so a malicious or anomalous deploy is investigable and detectable (the security-monitoring loop) — the pipeline is not exempt from the accountability every other privileged actor is subject to.

The principle: **the deploy pipeline is subject to the same security discipline as the production system it deploys to** — least privilege, supply-chain integrity, separation of duties, and audit — because it is, in privilege terms, *more* powerful than any single production component (it can change all of them), and an ungoverned pipeline is the highest-leverage single point of compromise in the architecture.

## 3. Break-Glass — The Governed Exception

```text
Figure 2. Break-glass: emergency access that bypasses normal
controls, made safe by being logged, time-boxed, and alerting —
an exception, not a backdoor.

  incident demands access normal controls would slow/deny
     │
     ▼
  BREAK-GLASS access granted — but:
     · logged in full (who, what, when — f07 audit, immutable)
     · TIME-BOXED (auto-revokes; not permanent, f02/f04)
     · ALERTS on use (a break-glass event pages security — its use
       is itself a signal reviewed after)
     · scoped as tightly as the emergency allows
     · reviewed after the incident (was it justified? abused?)

  Anti-pattern: a standing "emergency" admin credential that is
  always available, unlogged, and never reviewed = a permanent
  backdoor wearing an emergency label. Break-glass is an audited,
  expiring EXCEPTION, not a bypass you leave lying around.
```

Break-glass acknowledges reality: incidents sometimes demand access that normal least-privilege and four-eyes controls would slow or block, and pretending otherwise leads teams to build permanent bypasses (the standing admin credential "for emergencies") that are worse than the controls they circumvent. The governed form makes the emergency path *safe*: it is granted when needed but **logged completely, time-boxed to auto-revoke, alerting on use, and reviewed after** — so break-glass is an audited, expiring exception whose every use is a security event examined afterward, not a permanent, unlogged backdoor. The distinction is the file's discipline for exceptions generally: a bypass that is logged, bounded, and reviewed preserves accountability even when it relaxes prevention; a bypass that is standing, unlogged, and unreviewed is the backdoor an attacker (or a careless insider) most hopes to find.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Change-control gate | Changes reviewed, approved, and recorded (auditable "what changed, who approved"); the incident's first question answerable | Undocumented changes; "what changed?" unanswerable; deploys with no approval record |
| Separation-of-duties gate | Production deploys require a second authorized approver (four-eyes); build and deploy authority separated | A single principal shipping to production alone; build compromise granting deploy |
| Readiness-precondition gate | Deployment gated on verified observability (Ch14) and recovery (Ch13) — the root-README thesis enforced | Shipping into an unobservable/unrecoverable system; the readiness gate skipped |
| Pipeline-security gate | Least-privilege, short-lived pipeline credentials; pipeline inputs supply-chain-vetted (f06); pipeline actions audited | A pipeline with broad standing production admin; poisoned CI plugins; unaudited deploys |
| Break-glass gate | Emergency access logged, time-boxed, alerting, and reviewed — not a standing bypass | A permanent unlogged "emergency" admin credential; a backdoor wearing an emergency label |

## Output

The output of this file is deployment governed as the highest-privilege operation it is: changes reviewed, approved by a second party, and recorded; built and shipped by a least-privilege, supply-chain-vetted, audited pipeline whose own compromise is contained; gated on the prior chapters' observability and recovery being verified before a change is acceptable; rolled out progressively so a malicious or compromised deploy is blast-radius-bounded and fast-reverted; and with emergency access handled as a logged, time-boxed, reviewed exception rather than a standing backdoor. The deploy is where the book's reliability, security, and governance disciplines converge, and governing it is the operational precondition for trusting everything the system does after it ships.

## References

- [Google SRE Book — "Release Engineering" (hermetic, audited, least-privilege release)](https://sre.google/sre-book/release-engineering/)
- [SLSA — securing the build/deploy pipeline (from file 06, applied to CI/CD)](https://slsa.dev/spec/v1.0/threats)
- [Chapter 13 file 07 — progressive delivery and rollback (reframed here as security controls)](../13-reliability-recovery-and-failure-domains/07-deployment-safety-and-rollback.md)
- [Chapter 14 file 10 — the readiness gate this file makes a security precondition](../14-observability-profiling-and-verification/10-production-verification-and-the-evidence-loop.md)
