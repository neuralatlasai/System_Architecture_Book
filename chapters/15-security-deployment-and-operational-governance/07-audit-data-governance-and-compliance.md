# Audit, Data Governance, and Compliance

## Abstract

The controls of the prior files *prevent* and *contain*; this file makes the system **accountable** — able to prove, after the fact, *who did what, to what, and when*, and to demonstrate that data is handled according to the obligations that bind it. Accountability is a security property in its own right (STRIDE's Repudiation, file 01): a system that cannot prove who took an action cannot investigate a breach, attribute an insider action, satisfy a regulator, or even trust its own history. The instrument is the **audit log** — an append-only, tamper-evident record of every security-relevant action (authentications, authorizations, privileged operations, data access, configuration and deployment changes, secret retrievals) — and its defining requirements distinguish it from ordinary logging (Chapter 14 f03): it must be **complete** (every privileged action, or the gaps are where wrongdoing hides), **tamper-evident** (an attacker who breaches the system must not be able to erase their tracks — so audit logs are append-only, integrity-protected, and shipped to a store the audited principals cannot modify, ideally under separation of duties), and **attributable** (tied to the authenticated identity of file 02, not an anonymous service account, or the "who" is unanswerable). This is where Chapter 14's telemetry becomes a *security* control: the same wide events, but selected for security-relevance, integrity-protected, and retained to the compliance horizon. The second half of the file is **data governance**: the obligations on data — classification (what sensitivity is this?), retention (how long may/must it be kept?), deletion (Chapter 03 f09's right-to-erasure, made real by the crypto-shredding of file 04), residency (where may it live?), and consented use (what was the user told it would be used for?) — driven by regulation (GDPR, sector rules, and increasingly the EU **AI Act** and its risk-tiered obligations on AI systems). The AI-native dimension (standard 1, developed in f09) sharpens accountability into a hard problem: an AI system makes *decisions* that may affect people, and "why did the system produce this output" must be answerable — which is where the attribution stamps of Chapters 10 and 12 (which model version, which prompt, which retrieved context produced this answer) become the *audit trail of an AI decision*, and where the non-determinism of Chapter 13 f08 makes reconstruction genuinely hard. The synthesis: **a production system must be able to prove its own history** — who acted, what data was touched, why a decision was made — through a complete, tamper-evident, attributable audit trail and a data-governance regime that satisfies the obligations its data carries, because a system that cannot account for itself is neither investigable after a breach nor defensible before a regulator.

## 1. The Audit Log — Complete, Tamper-Evident, Attributable

```text
Figure 1. The audit log's three requirements, and why each matters.
Ordinary logging (Ch14 f03) is for debugging; the audit log is for
accountability and survives an attacker who breached the system.

  requirement       means                        failure if absent
  ────────────────  ───────────────────────────  ──────────────────
  COMPLETE          every security-relevant       the unlogged action
                    action logged: authn, authz,  is where wrongdoing
                    privileged ops, data access,   hides; gaps =
                    config/deploy change, secret   blind spots an
                    fetch                          attacker uses
  TAMPER-EVIDENT    append-only, integrity-        an attacker who
                    protected, shipped to a store  breaches the system
                    the audited CANNOT modify      erases their tracks
                    (separation of duties)         → no investigation
  ATTRIBUTABLE      tied to the authenticated      "a service account
                    identity (f02), not an          did it" = the who
                    anonymous shared account        is unanswerable

  Ch14's telemetry BECOMES the audit log when: selected for
  security-relevance, integrity-protected, attributed to identity,
  and retained to the compliance horizon (not sampled away, f14/f07).
```

The audit log's requirements are what separate it from the observability telemetry of Chapter 14, even though it is built from the same emission: observability can be sampled (Chapter 14 f07 — keep the rare), but the audit log must be *complete* for the actions in its scope (a sampled audit log has holes exactly where an attacker operates); observability lives in the system it observes, but the audit log must be *tamper-evident* and stored beyond the reach of the principals it audits (an attacker who can delete the log of their intrusion has defeated the investigation before it starts); and observability can attribute to a service, but the audit log must attribute to the *authenticated identity* (file 02) or it cannot answer the question it exists for. The design consequence: the audit log is a distinct, hardened path — append-only storage, integrity protection (hash chains or a write-once store), shipped off-box under separation of duties (the people who operate the system cannot alter its audit trail) — and it is the control that makes every other control *investigable*, because a breach you cannot reconstruct is a breach you cannot learn from or prove.

## 2. Separation of Duties and the Audit as a Security Control

The audit log is not merely a record but an active control when paired with **separation of duties** — the principle that no single principal can both take a sensitive action *and* erase the evidence of it, or unilaterally complete a high-risk operation:

- **The auditor is not the audited**: the audit trail is written to and controlled by a function separate from the one being audited (operators cannot alter operator logs), so the tamper-evidence is organizational as well as technical — the classic control against the insider and against the attacker who gains operator access.
- **High-risk operations require more than one party** (four-eyes): a production deployment, a secret rotation, a data export, a permission grant — the operations whose abuse is most damaging — require a second authorized approver, so a single compromised or malicious principal cannot execute them alone (the control developed for deployment in file 08).
- **The audit log deters and detects**: knowing actions are attributably logged deters insider abuse, and *monitoring* the audit log (Chapter 14's alerting applied to security events — an unusual privileged access, a secret fetched at 3 a.m. from a new location, a burst of authz denials) *detects* the breach in progress, closing the assume-breach detection loop (file 01) with the security signal the audit log uniquely provides.

The audit trail thus does triple duty: it is the *forensic* record (reconstruct what happened after a breach), the *deterrent* (attributable actions discourage abuse), and the *detection* substrate (monitored for the anomaly that signals a breach in progress) — which is why it is a security control, not just a compliance checkbox.

## 3. Data Governance — Obligations on Data, and the AI Decision Trail

Data carries obligations independent of the system holding it, and governance is the discipline of honoring them:

| Obligation | The question | The control (and where) |
|---|---|---|
| **Classification** | How sensitive is this data? | Data classified at ingestion; sensitivity drives isolation (f03), encryption (f04), retention |
| **Retention** | How long may/must it be kept? | Retention policy per class; auto-expiry; over-retention is a liability (more to breach) |
| **Deletion / erasure** | Can we truly delete it on request? | Crypto-shredding (f04) reaching backups + derived copies (Ch03 f09); the right-to-erasure made real |
| **Residency** | Where may it physically live? | Regional isolation; data-locality controls; a compliance + isolation (f03) concern |
| **Consented use** | What was the user told? | Purpose limitation; a model trained on data used beyond its consent is a governance breach |

The AI-native sharpening (standard 1) is that AI systems add two hard governance problems. First, **training data governance**: data used to train or fine-tune a model is used in a way that is hard to reverse (the model has *learned* from it — deletion from the training set does not un-learn it), so consent and licensing of training data is a governance obligation with no easy remediation, and a model trained on data beyond its consented use is a breach that cannot be crypto-shredded away. Second, **the AI decision audit**: when an AI system makes a consequential decision, accountability requires answering *why* — and the answer is the attribution stamp of Chapters 10 and 12 (this output came from *this* model version, *this* prompt, *this* retrieved context), which is the audit trail of an AI decision, complicated by the non-determinism (Chapter 13 f08) that makes exact reconstruction hard. Regulation is codifying these: GDPR's erasure and purpose-limitation, and the EU AI Act's risk-tiered obligations (transparency, human oversight, and record-keeping for higher-risk AI systems) make the AI decision trail a *legal* requirement, not only a good practice — so the stamps that Chapters 10 and 12 introduced for quality are, here, the mechanism of AI accountability.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Audit-completeness gate | Every security-relevant action (authn, authz, privileged ops, data access, config/deploy, secret fetch) logged | Gaps in the audit trail; privileged actions unlogged; wrongdoing with no record |
| Tamper-evidence gate | Audit logs append-only, integrity-protected, stored beyond the audited principals' reach (separation of duties) | An attacker/operator able to erase their tracks; audit logs in the system they audit |
| Attribution gate | Actions tied to authenticated identity (f02), not anonymous shared accounts | "A service account did it"; unattributable privileged actions |
| Separation-of-duties gate | Auditor ≠ audited; high-risk operations require a second approver (four-eyes); audit log monitored for anomalies | A single principal able to act and erase evidence; unilateral high-risk operations; audit log unmonitored |
| Data-governance gate | Data classified, retained/deleted per obligation (crypto-shred reaching derived copies), residency + consent honored; AI training-data consent and decision-audit (stamps) in place | Over-retention as liability; deletion that misses derived copies; training data used beyond consent; AI decisions with no "why" trail |

## Output

The output of this file is accountability: a complete, tamper-evident, attributable audit log — Chapter 14's telemetry hardened into a forensic, deterrent, and detection control that survives an attacker who breached the system — enforced under separation of duties so no principal can both act and erase the evidence, and a data-governance regime that honors the classification, retention, deletion, residency, and consent obligations data carries. The AI-native extension makes the attribution stamps of Chapters 10 and 12 the audit trail of an AI decision and recognizes training-data consent as a governance obligation with no easy undo — because a production system, especially one that decides, must be able to prove its own history to an investigator and a regulator alike.

## References

- [Chapter 14 — the telemetry this file hardens into an audit trail](../14-observability-profiling-and-verification/README.md)
- [Chapter 03 file 09 — retention and right-to-erasure, realized by crypto-shredding](../03-state-ownership-and-consistency-model/09-ai-native-state.md)
- [NIST SP 800-92 — Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final)
- [EU AI Act — risk-tiered obligations (record-keeping, transparency, human oversight)](https://artificialintelligenceact.eu/the-act/)
