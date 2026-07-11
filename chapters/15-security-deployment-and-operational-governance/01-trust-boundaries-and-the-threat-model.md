# Trust Boundaries and the Threat Model

## Abstract

Security begins with a model, and the model is not a list of controls but a map of **trust boundaries** — the lines in a system across which data or requests move from a less-trusted zone to a more-trusted one, where an assumption of good behavior is being made and must instead be *enforced*. A trust boundary is where the browser meets the API, where a tenant's request meets shared infrastructure, where an untrusted document meets a model's context (Chapter 11's lethal trifecta), where third-party code meets your build (Chapter 15 f06's supply chain), where a service meets another service. The security discipline is: **enumerate the boundaries, enumerate what an attacker could do at each (the threat model), and enforce a control at each that does not assume the crossing is benign.** The governing posture is **zero trust** ([NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final)): there is no trusted network, no "inside" where authentication can be skipped — every access to every resource is authenticated, authorized, and encrypted *regardless of origin*, because the assumption that the internal network is safe is the assumption every breach exploits after its first foothold. Paired with it is **assume breach**: design as though a component *is already compromised*, and ask not "is this secure?" (a question with no true answer) but "**when this is breached, what can the attacker reach, and how fast will we detect it**" — which reframes security from prevention alone to *containment and detection*, the same blast-radius and observability disciplines of Chapters 13–14 applied to an adversary rather than a fault. The threat model is made systematic by **STRIDE** (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege — the categories that turn "what could go wrong" into a checklist per boundary). And the chapter's composition law (standard 6) is the hard, counterintuitive arithmetic of security: **it does not add or multiply favorably — it is governed by the weakest link.** A system's security is the *minimum* over its attack paths, because the attacker takes the easiest one, so ten strong boundaries and one weak one is a weak system, not a 90%-strong one; the only thing that composes *in the defender's favor* is **defense in depth** — independent layers on a *single* path, where the attacker must defeat *all* of them, so breach probability on that path is the product of per-layer bypass rates. The synthesis: security is designed boundary by boundary, enforced under zero trust, contained under assume-breach, and honestly accounted as a weakest-link property that only defense-in-depth improves.

## 1. Trust Boundaries — The Map Security Is Drawn On

```text
Figure 1. A request's trust boundaries. Each ║ is a crossing where
trust is otherwise assumed and must instead be ENFORCED. The prior
chapters' boundaries are all trust boundaries here.

  internet    ║  edge/API   ║  service   ║  data      ║  tenant's
  (untrusted) ║  (authn'd)  ║  mesh      ║  store     ║  private
              ║             ║            ║            ║  data
   attacker ──╫─ authn ─────╫─ authz ────╫─ isolation ╫─ encryption
   or user    ║  identity   ║  least     ║  per-tenant║  + access
              ║  (f02)      ║  privilege ║  (f03)     ║  control
              ║             ║  (f02)     ║            ║
   ── plus the non-network boundaries the book has drawn: ──
   untrusted document ║ model context    (Ch11 trifecta, f09)
   third-party code   ║ your build       (supply chain, f06)
   model output       ║ downstream action (treat as untrusted, f09)
   operator           ║ production        (change control, f08)

  Rule: at EVERY ║, name the threat (STRIDE, §2) and the control
  that enforces the crossing. An un-enforced boundary is a TRUSTED
  one — and trust is what the attacker's first foothold converts
  into reach.
```

The map is the deliverable: a system's security design *is* the enumeration of its trust boundaries with an enforcement control at each, and the most common security failure is not a weak control but a *missing boundary* — a crossing nobody modeled as a boundary, so nothing enforces it (the internal service that trusts any caller because "it's on our network," the model that trusts retrieved content because it "came from our corpus"). Zero trust is the principle that eliminates the missing-boundary failure by refusing to grant trust based on *location*: there is no network position that confers trust, so every boundary is enforced, and the attacker's foothold in one zone buys nothing in the next.

## 2. The Threat Model — STRIDE Per Boundary

```text
Figure 2. STRIDE: the six threat categories, each with the property
it violates and the control class that answers it. Run per boundary.

  threat                violates          answered by (control)
  ────────────────────  ───────────────   ────────────────────────
  Spoofing              authenticity      authentication / identity
                                          (f02: who is this, proven)
  Tampering             integrity         signing, hashing, mTLS,
                                          integrity checks (f06)
  Repudiation           accountability    tamper-evident audit logs
                                          (f07: who did what)
  Information disclosure confidentiality  encryption, access control,
                                          isolation (f03, f04)
  Denial of service     availability      rate limiting, quotas,
                                          admission (Ch09) as security
  Elevation of privilege authorization    least privilege, authz
                                          (f02: can they do this)

  Method: for each trust boundary (§1), walk the six categories and
  name the control. A category with no control at a boundary is a
  threat with no defense — the finding a threat model exists to
  produce BEFORE the attacker produces it.
```

STRIDE's value is that it makes threat modeling *complete and repeatable* rather than a creative exercise limited by the modeler's imagination: at each boundary, the six categories are walked, and each either has a control or is a documented, accepted risk — never an unconsidered gap. The mapping to controls is the chapter's structure in miniature: spoofing → identity (f02), tampering → supply-chain integrity (f06), repudiation → audit (f07), disclosure → isolation and secrets (f03–f04), DoS → the admission of Chapter 09 reframed as a *security* control (an attacker's load is still load), and elevation → least-privilege authorization (f02). The threat model is where the abstract "be secure" becomes a specific list of controls to build and risks to accept.

## 3. Assume Breach — Containment and Detection Over Prevention

Prevention is necessary and insufficient: a sufficiently determined or lucky attacker gets a foothold (a leaked credential, an unpatched CVE, a successful phish, a poisoned dependency), so a security design that *only* prevents has no answer for the day prevention fails — and it always eventually fails. **Assume breach** designs for that day: it treats every component as potentially already compromised and asks the containment-and-detection questions that are the security twins of Chapters 13–14:

- **Blast radius of compromise** (the Chapter 13 f03 question, adversarial): if *this* component / credential / service is owned, what can it reach? The answer is its *privilege scope*, and **least privilege** (f02) is the discipline of making that answer as small as possible — a compromised component that can reach only what it strictly needs is a contained breach, not a total one.
- **Detection of compromise** (the Chapter 14 question, adversarial): how fast will we *know*? The audit log (f07), the anomaly in the telemetry (Ch14), the egress that should not exist (f05) — the security signals that turn an undetected months-long breach into a caught-and-contained incident.
- **Lateral movement** as the thing to deny: an attacker's foothold is only as valuable as what it lets them reach *next*, so the boundaries between internal components (zero trust, §1) are exactly what convert a single-component breach into a contained one rather than a beachhead for the whole system.

The posture's reframing is the same one Chapter 13 made for faults: you cannot prevent all breaches, so you design so that a breach is *bounded, detected, and recoverable* — which makes security an application of the book's reliability disciplines to an adversary who, unlike a fault, is actively looking for the boundary you forgot to enforce.

## 4. The Composition Law — Weakest Link, and the Only Thing That Helps

```text
Figure 3. Security composes as the WEAKEST link across attack paths;
only defense-in-depth (layers on ONE path) composes favorably. This
is standard 6 for security — and it runs opposite to redundancy.

  ACROSS ATTACK PATHS (the attacker picks the easiest):
    system breach probability = MAX over paths of (path's ease)
    → 10 strong boundaries + 1 weak = a WEAK system, not 90% strong
    → the attacker does not average your controls; they find the min

  ALONG ONE PATH (defense in depth — independent layers):
    attacker must defeat ALL layers on the path:
    P(breach this path) = ∏ (per-layer bypass probability)
    e.g. 3 independent layers each 10% bypassable:
       0.10 × 0.10 × 0.10 = 0.001  ← depth earns the nines here
    BUT only if the layers are INDEPENDENT — a shared weakness
    (one credential, one flawed library) collapses the product to
    a single layer (the correlated-failure law, Ch13 f09, adversarial)

  Consequence: spend on the WEAKEST boundary (raise the min), then
  on DEPTH along the critical paths (multiply the bypass) — never on
  a 10th lock for the door that is already the strongest.
```

The composition law is the chapter's most important and most counterintuitive claim: **security does not average.** A reliability engineer can add redundancy and multiply nines (Chapter 13 f09); a security engineer cannot, because the attacker is not a random fault sampling all paths — the attacker is an optimizer who finds and takes the single weakest path, so the system's security is the *minimum* over its boundaries, and the marginal investment must go to the *weakest* one (raising the floor), not the strongest one (which the attacker was never going to attempt). The one favorable composition is defense in depth — *independent* layers on a single path, where the attacker must defeat all, so bypass probability is the product — but its critical caveat is the adversarial form of Chapter 13's correlated-failure law: layers that share a weakness (one credential unlocking all, one library flawed in all) are not independent, and the product collapses to a single layer. Security spend is therefore triaged by the law: find the weakest link and strengthen it, then add *independent* depth to the paths that lead to the highest-value assets — and never mistake ten locks on the strong door for security while the window is open.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Boundary-map gate | Every trust boundary enumerated (network and non-network: doc→context, code→build, output→action, operator→prod); an enforcement control at each | A missing boundary (a crossing nobody modeled); trust granted by network location |
| Zero-trust gate | No trusted network; every resource access authenticated, authorized, encrypted regardless of origin | An "internal" zone where authn is skipped; a foothold that grants reach to the next zone free |
| Threat-model gate | STRIDE walked per boundary; each category has a control or a documented accepted risk | Threat modeling as ad-hoc imagination; a STRIDE category with an unconsidered gap |
| Assume-breach gate | Blast-radius-of-compromise, detection speed, and lateral-movement denial answered per component | A design that only prevents, with no answer for the day prevention fails |
| Composition gate | Security spend triaged to the weakest link first, then independent defense-in-depth on critical paths; layer independence verified | A 10th control on the strongest boundary while the weakest is unaddressed; "independent" layers sharing one credential/library |

## Output

The output of this file is the security model the chapter is built on: a map of trust boundaries — every crossing where trust is otherwise assumed — with an enforcement control at each, drawn under the zero-trust posture that no network location confers trust and the assume-breach posture that asks what a compromise reaches and how fast it is detected rather than pretending compromise will not happen. STRIDE makes the threat enumeration complete per boundary, and the composition law sets the honest arithmetic: security is a weakest-link property that the attacker's optimization exposes, improved only by strengthening the floor and adding independent depth to the critical paths — the frame every subsequent file's specific boundary is enforced within.

## References

- [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final)
- [Shostack, *Threat Modeling: Designing for Security* — STRIDE per boundary](https://shostack.org/books/threat-modeling-book)
- [Microsoft — The STRIDE Threat Model](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [Saltzer & Schroeder, "The Protection of Information in Computer Systems" (1975) — least privilege, defense in depth, fail-safe defaults](https://www.cs.virginia.edu/~evans/cs551/saltzer/)
