# Secret Management and Data Protection

## Abstract

Secrets — credentials, API keys, tokens, encryption keys, certificates — are the material an attacker most wants, because a stolen secret is *authenticated access* that bypasses the identity boundary of file 02 entirely, and leaked credentials remain, year after year, among the most common breach root causes. This file owns two related disciplines: **secret management** (how secrets are stored, distributed, rotated, and revoked so they are hard to steal and useless when stolen) and **data protection** (how data is encrypted at rest and in transit so that a breach of the storage layer yields ciphertext, not cleartext). The governing failure to eliminate is **the standing secret**: a long-lived credential embedded in source code, a config file, an environment variable, a container image, or — despite Chapter 14 f03 — a log, where it sits permanently valid, widely copied, and one leak away from a breach with no expiry to save you. The modern discipline inverts every property of the standing secret. **Centralize** in a secrets manager (Vault, cloud KMS/secrets services) so secrets are never in code or images — the application fetches them at runtime from a system that controls access and logs every retrieval, turning a scattered, un-auditable sprawl into a single governed, audited surface. **Make them dynamic and short-lived**: rather than a static database password, the secrets manager *generates* a credential on demand, scoped and time-boxed (a database credential valid for one hour, then auto-revoked), so a stolen secret expires before it is useful — the temporal blast-radius bound of file 02 §3 applied to every secret. **Encrypt data under envelope encryption**: data is encrypted with a data key, the data key is encrypted ("wrapped") by a key-encryption key held in a KMS/HSM that never releases it, so protecting terabytes reduces to protecting one key, rotation re-wraps the data key without re-encrypting the data, and *destroying the key destroys the data* — the crypto-shredding that makes deletion (Chapter 03 f09) real even across backups and derived copies. **Encrypt in transit always** (TLS/mTLS, file 02's SVIDs), because zero trust (file 01) has no network segment where cleartext is safe. The synthesis and the discipline's north star: **a secret should be short-lived, centrally governed, never in code, and useless if stolen** — and data should be encrypted such that breaching the store yields bytes no one can read and destroying a key is destroying the data, so that the two things attackers pursue hardest, credentials and data, are the two things this file makes least worth stealing.

## 1. The Standing Secret — The Failure to Eliminate

```text
Figure 1. The standing secret and its inversions. Every property of
the long-lived embedded secret is a defect; the discipline inverts
each one.

  STANDING SECRET (the anti-pattern)      →  THE INVERSION
  ────────────────────────────────────      ──────────────────────
  in source code / config / image / env   →  centralized in a
    (scattered, copied, in git history,       secrets manager,
     in the leaked repo forever)              fetched at runtime,
                                              never in code (§2)
  long-lived (valid forever)               →  short-lived / dynamic,
    (stolen once = access until noticed,      auto-expiring &
     which is often never)                     auto-revoked (§2)
  shared across instances                  →  per-workload identity
    (no attribution; rotate = rotate all)     (SPIFFE, f02) or
                                              per-fetch dynamic secret
  static (same value over time)            →  rotated automatically;
                                              rotation is routine, not
                                              an incident (§3)
  plaintext at rest                        →  encrypted; the store of
                                              secrets is itself KMS-
                                              protected (§3)

  Rule: assume every secret WILL leak (assume breach, f01). Design
  so that a leaked secret is already expired, narrowly scoped, and
  attributable — not a permanent skeleton key.
```

The standing secret is the failure because it violates assume-breach (file 01) at its most basic: it is designed as though it will never leak, so when it does (in a committed `.env`, a leaked image layer, a logged connection string, a compromised laptop) it is a permanent, broad, un-attributable credential. Every inversion in the figure applies the chapter's principles — centralization (governed, audited access), short-lived/dynamic (temporal blast bound, file 02 §3), per-workload (attribution, file 02 §3), rotation (a stale secret is a growing risk) — so that the *inevitable* leak (assume breach) yields a credential that is already expired or narrowly scoped rather than a skeleton key. The single highest-leverage move is **getting secrets out of code and images into a runtime-fetched manager**, because that alone eliminates the most common leak vector (the secret in the repo, the image, the git history) and makes every subsequent discipline (rotation, dynamic generation, revocation) possible.

## 2. Centralized, Dynamic, Short-Lived Secrets

The secrets manager (Vault, cloud KMS/secrets manager) is the control point that makes secrets governable:

- **Runtime fetch, never embedded**: the application authenticates to the secrets manager *with its workload identity* (file 02 — the one credential it needs, itself short-lived) and fetches secrets at startup or on demand, so no secret lives in code, config, image, or environment — the manager is the single audited surface where every secret access is logged (which workload fetched which secret when, the audit trail of file 07).
- **Dynamic secrets**: the strongest form — the manager *generates* the credential on request rather than storing a static one, scoped to the task and time-boxed (a database credential created for this workload, valid one hour, auto-revoked after), so there is no long-lived secret to steal at all; the credential exists only for its brief window and is unique per fetch (full attribution). This is the temporal blast-radius bound (file 02 §3) taken to its limit: the secret expires faster than an attacker can typically use it.
- **Revocation and rotation as routine**: because secrets are centralized and often dynamic, rotating or revoking is a control-plane operation, not a coordinated redeployment — a suspected compromise is answered by revoking the credential (immediate) rather than by the slow, error-prone scramble of finding and replacing an embedded secret everywhere it was copied.

The reframing mirrors file 02's identity move: **a secret should be generated, scoped, and expiring rather than stored, broad, and permanent** — so that secret management shifts from *guarding* long-lived material (a losing game against copying and leakage) to *minimizing the window and scope* in which any secret is valid (a game the defender can win).

## 3. Data Protection — Envelope Encryption and Crypto-Shredding

```text
Figure 2. Envelope encryption. Data is encrypted by a data key; the
data key is wrapped by a KMS-held key-encryption key. Protecting all
data reduces to protecting one key — and destroying it shreds data.

   data ──encrypt with──► DATA KEY (DEK) ──stored WRAPPED alongside
                             │                the ciphertext
                             │ wrapped (encrypted) by
                             ▼
                          KEY-ENCRYPTION KEY (KEK)
                             │  lives in KMS/HSM, NEVER exported,
                             │  all use is logged (f07 audit)
                             ▼
   to read: KMS unwraps the DEK (authz'd, logged) → decrypt data
   to rotate: re-wrap the DEK under a new KEK — NO data re-encryption
   to DELETE (crypto-shred): destroy the KEK → every copy of the
     data, incl. backups + derived (Ch03 f09), is now unreadable
     ciphertext, everywhere, at once — deletion that actually deletes

  Encrypt at rest (this) AND in transit (TLS/mTLS, f02 SVIDs) —
  zero trust (f01) has no network where cleartext is safe.
```

Envelope encryption is the mechanism that makes data protection both *practical* and *powerful*: practical because protecting arbitrary volumes of data reduces to protecting one key-encryption key in a KMS/HSM that never releases it (and logs every use — the audit of file 07), and powerful because it delivers three properties at once. **Breach resistance**: a compromise of the storage layer yields ciphertext plus wrapped data keys the attacker cannot unwrap without the KMS, so the data is protected even when the store is not (defense in depth, file 01, for data at rest). **Cheap rotation**: rotating the KEK re-wraps the (small) data key without re-encrypting the (large) data. **Real deletion via crypto-shredding**: destroying the key renders *all* copies of the data — including backups and the derived copies (embeddings, caches, indexes) that a row-delete never reaches — cryptographically unrecoverable at once, which is how Chapter 03 f09's deletion obligation is actually met across a system where data has been copied and derived far beyond the source table. Paired with encryption in transit (TLS/mTLS everywhere, per zero trust), envelope encryption makes both the data at rest and the data in motion useless to an attacker who breaches the layer carrying it.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| No-standing-secret gate | No secrets in code/config/image/env/logs; all fetched at runtime from a governed manager | Secrets in source, git history, image layers, or logs (Ch14 f03); long-lived skeleton keys |
| Dynamic/short-lived gate | Dynamic, scoped, time-boxed secrets where possible; automatic rotation; revocation as a control-plane op | Static long-lived credentials; rotation as a rare manual scramble; no fast revocation path |
| Centralization-audit gate | A single secrets manager with per-fetch audit (which workload, which secret, when) | Scattered secret sprawl; no audit trail of secret access; unattributable credential use |
| Envelope-encryption gate | Data encrypted under DEKs wrapped by KMS/HSM-held KEKs; encryption at rest and in transit (TLS/mTLS) | Plaintext at rest; cleartext on "internal" networks; app-held keys a breach exposes |
| Crypto-shred gate | Deletion via key destruction reaching backups and derived copies (Ch03 f09) | Row-delete leaving recoverable copies in backups/embeddings/caches; deletion that does not delete |

## Output

The output of this file is the elimination of the standing secret and the encryption of data such that a breach yields nothing readable: secrets centralized in a governed manager, fetched at runtime, generated dynamically and expiring quickly so a stolen credential is already useless; and data protected by envelope encryption where one KMS-held key guards all data, rotation is cheap, and destroying the key crypto-shreds every copy — the mechanism that makes deletion real across backups and derived state. Encrypted in transit under zero trust and at rest under keys the storage breach cannot reach, the two assets attackers pursue hardest — credentials and data — are made the least worth stealing.

## References

- [HashiCorp Vault — dynamic secrets and secret lifecycle](https://developer.hashicorp.com/vault/docs/what-is-vault)
- [NIST SP 800-57 — Recommendation for Key Management](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)
- [AWS KMS — envelope encryption (DEK/KEK) and crypto-shredding](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- [Chapter 03 file 09 — the deletion/retention obligation crypto-shredding fulfills](../03-state-ownership-and-consistency-model/09-ai-native-state.md)
