# Security Verification

## Abstract

Every control in this chapter is a *claim* — "this boundary is enforced," "this identity is least-privileged," "this injection is contained," "this egress is denied" — and, exactly as Chapters 13 and 14 insisted for reliability and observability, a security claim is worthless until it has been *tested against an adversary*, because the control you never verified is the control that fails when someone finally attacks it, and the assume-breach posture (file 01) demands you find the gap before the attacker does. This file owns security verification: the practices that turn security from asserted to *evidenced*. They form a ladder from cheap-and-continuous to expensive-and-adversarial. **Automated scanning** runs in the pipeline (file 08): SAST (static analysis of source for vulnerable patterns), DAST (dynamic testing of the running system), dependency/SCA scanning (known-vulnerable libraries — the SBOM of file 06 made actionable), secret scanning (credentials in code — file 04's failure caught pre-commit), and IaC scanning (misconfigured infrastructure) — the fast, broad, shift-left layer that catches the known and the obvious continuously. **Threat modeling** (file 01's STRIDE-per-boundary) is the design-time practice that finds the *architectural* flaw scanning cannot see (a missing boundary, an over-trusted component). **Penetration testing and red-teaming** are the adversarial layer: a pentest probes for exploitable vulnerabilities, and a red team *simulates a real attacker* against the whole system (including people and process) to test not just whether vulnerabilities exist but whether the *detection and response* (files 07, and Chapter 14) actually catch them — the assume-breach exercise that verifies containment and detection, not just prevention. The AI-native addition (standard 1) is **AI red-teaming**: adversarial testing of the model and AI system specifically — prompt-injection attempts, jailbreaks, excessive-agency exploitation, data-extraction — now a first-class practice (and increasingly a regulatory expectation) because the AI threat surface (file 09) is novel, evolving, and not covered by traditional application scanning. The file closes the chapter's evidence discipline with the **security-verification stamp**: a dated record per system of what was tested, by what method, with what result, and when — because a "penetration tested" claim from two years ago on a since-changed architecture is not evidence, and security, like reliability (Chapter 13 f10), decays without re-verification. The synthesis and the book's final verification principle: **security is proven by adversarial testing, continuously and at every layer, or it is merely believed** — and a control that has not been attacked in a test is a hypothesis waiting for an attacker to falsify it in production.

## 1. The Security-Verification Ladder

```text
Figure 1. The verification ladder, cheap/continuous → expensive/
adversarial. Each rung catches what the rungs below cannot. Shift
left (automate the bottom) so the top (human adversary) finds the
architectural and novel flaws, not the known ones.

  rung                 catches                    cadence
  ───────────────────  ─────────────────────────  ──────────────
  RED TEAM             real-attacker simulation;   periodic,
  (+ AI red-team)      tests DETECTION + response  adversarial
                       (assume-breach, incl.       (the top: humans
                       injection/jailbreak, f09)   vs the whole system)
  PENETRATION TEST     exploitable vulnerabilities periodic
                       probed by a human tester
  THREAT MODELING      architectural flaws: missing at design time
  (STRIDE, f01)        boundaries, over-trust      + on change
  AUTOMATED SCANNING   known-vulnerable deps (SCA/  CONTINUOUS
  SAST/DAST/SCA/       SBOM), code patterns (SAST), in the pipeline
  secret/IaC scan      running-system flaws (DAST),  (f08, shift-left)
                       secrets in code, misconfig

  Rule: automate the bottom (fast, broad, known); reserve the human
  adversarial rungs for the architectural and NOVEL flaws automation
  cannot see. A red team that finds only what a scanner would have is
  a wasted red team — and an un-scanned obvious bug in a pentest is a
  wasted pentest.
```

The ladder's discipline is *matching the method to the flaw class*: automated scanning is cheap, continuous, and broad but catches only the *known* (known-vulnerable dependencies, known-bad patterns, secrets, misconfigurations), so it must be shift-left and always-on (in the pipeline, file 08) to keep the known-and-obvious from ever shipping; threat modeling catches the *architectural* flaw (the missing boundary, the over-trusted component) that no scanner sees because it is a design property, not a code pattern; and penetration testing and red-teaming catch the *exploitable* and the *novel* — the chained vulnerability, the logic flaw, the attack the automation was not written to find — with a human adversary. The efficiency rule mirrors Chapter 14's test pyramid: automate the bottom so the expensive human rungs are spent on what only humans find, because a red team rediscovering what a scanner would have caught is wasted adversarial effort, and an obvious unscanned bug surfacing in a pentest is a process failure below it.

## 2. Red-Teaming — Verifying Detection and Response, Not Just Prevention

Penetration testing asks "are there exploitable vulnerabilities?"; **red-teaming** asks the assume-breach question (file 01): "when a real attacker gets in, do we *detect and respond*?" — and it is the only verification that tests the containment-and-detection half of the security posture, because it exercises the whole system against a simulated adversary, including the audit logging (file 07), the anomaly detection (Chapter 14), and the human incident response. A red team that breaches a component and moves laterally verifies whether the segmentation (file 05) actually contained them, whether the audit log (file 07) actually captured the intrusion, whether the monitoring actually alerted, and whether the response actually engaged — testing the *system's immune response*, not just its walls. This is the security twin of Chapter 13's chaos engineering and Chapter 14's evidence loop: chaos verifies the reliability responses fire under fault; red-teaming verifies the security responses fire under attack — and both exist because a response that has never been triggered in a test is a response you cannot trust in the incident. The purple-team refinement (red and blue cooperating) turns each exercise into detection-and-response improvement, closing the loop so the finding becomes a new alert, a new control, a new runbook.

## 3. AI Red-Teaming and the Security Stamp

```text
Figure 2. AI red-teaming tests the file-09 threat surface directly,
and the security stamp records what was verified, when, with what
result — so a security claim carries its evidence and its age.

  AI RED-TEAM probes (the f09 surface, adversarially):
    · prompt injection (direct + indirect via retrieved content/tools)
    · jailbreaks (bypassing safety guardrails)
    · excessive-agency exploitation (can an injection reach tools it
      shouldn't? exfiltrate? take irreversible action?)
    · data extraction (training-data / system-prompt / context leak)
    · the lethal trifecta end-to-end (can data actually get OUT?)

  SECURITY-VERIFICATION STAMP (per system, dated):
    { control/boundary tested, method (scan/pentest/red-team/AI-red-
      team), result (pass / findings + severity), scope + version,
      date, remediation status }

  Rule: a "secure / pentested / red-teamed" claim is only as current
  as its last stamp on THIS architecture. Security decays (new code,
  new deps, new attacks) — re-verify on a cadence, like Ch13 drills.
```

**AI red-teaming** is the adversarial verification of the file-09 threat surface, and it is a distinct practice because the AI attack classes — prompt injection (direct and indirect), jailbreaks, excessive-agency exploitation, data extraction, the lethal-trifecta end-to-end — are not found by traditional application scanning or a conventional pentest, which are not built to reason about a model that can be steered by its inputs. It probes whether the containment of file 09 actually holds: can an indirect injection via a retrieved document reach a tool it should not? can the agent be steered to exfiltrate, or is egress control (file 05) holding? can training data or the system prompt be extracted? — testing the AI-specific controls against an adversary who is trying to defeat them, which is now both a maturity expectation and, for higher-risk systems, a regulatory one (the AI Act, file 07). The **security-verification stamp** closes the chapter's evidence discipline (the analog of Chapter 13's reliability stamp and Chapter 14's coverage stamp): a dated, per-system record of what boundary or control was tested, by what method, with what result and severity, on what version — so a security claim carries *when it was last proven and against what*, and the staleness that makes an old "pentested" badge worthless (new code, new dependencies, new attack techniques) is visible. Security, like reliability, decays without re-verification, so the stamp is re-earned on a cadence, not once.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Scanning gate | SAST/DAST/SCA/secret/IaC scanning continuous in the pipeline (f08), shift-left | Known-vulnerable dependencies shipping; secrets in code uncaught; scanning as a rare manual step |
| Threat-model gate | STRIDE-per-boundary threat modeling at design and on change; architectural flaws found before build | Threat modeling skipped; missing boundaries and over-trust discovered only in an incident |
| Adversarial gate | Penetration testing and red-teaming on a cadence; red team tests detection + response, not just prevention | Prevention-only verification; the containment/detection half (audit, alerting, response) never exercised |
| AI-red-team gate | Adversarial AI testing (injection, jailbreak, excessive-agency, extraction, trifecta end-to-end) against the f09 controls | The novel AI attack surface unverified by traditional scanning/pentest; containment claims untested |
| Security-stamp gate | A dated per-system verification stamp (control, method, result, version); re-verified on a cadence | "Secure/pentested" claims with no recent stamp; a stale badge on a changed architecture |

## Output

The output of this file is security proven by adversarial testing rather than asserted: a ladder from continuous automated scanning (the known and obvious, shift-left in the pipeline) through design-time threat modeling (architectural flaws) to penetration testing and red-teaming (the exploitable, the novel, and — uniquely — whether detection and response actually fire under attack), with AI red-teaming verifying the novel injection/jailbreak/excessive-agency surface that traditional methods miss. The security-verification stamp records what was tested, how, with what result, and when — so every security claim carries its evidence and its age, and the decay that makes old assurances worthless is re-verified on a cadence. A control that has not been attacked in a test is, by this chapter's standard, a hypothesis awaiting an attacker.

## References

- [OWASP — Web Security Testing Guide (pentest methodology)](https://owasp.org/www-project-web-security-testing-guide/)
- [MITRE ATLAS — adversarial testing tactics for AI systems (AI red-teaming reference)](https://atlas.mitre.org/)
- [NIST SP 800-115 — Technical Guide to Information Security Testing and Assessment](https://csrc.nist.gov/pubs/sp/800/115/final)
- [Chapter 13 file 10 — chaos/drill verification, whose adversarial twin this file is](../13-reliability-recovery-and-failure-domains/10-verification-of-reliability.md)
