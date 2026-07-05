# Event Schema Governance and Evolution

## Abstract

An event schema is an API with three properties that make it *harder* to govern than a request/response contract: the producer cannot see its consumers (fan-out is open-ended by design), the consumers cannot negotiate (there is no per-request version header — the record on the log is what it is), and retention makes every version ever produced *permanently readable* (a 90-day-retention topic means every consumer must handle 90 days of schema archaeology; an event-sourced topic means forever, file 07 §4). Schema-registry governance — producers validated against a compatibility rule *before* a record reaches the log ([Confluent Schema Registry's compatibility model](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)) — is the enforcement machinery, and this file's core discipline is reading its modes correctly: compatibility direction is about *who upgrades first*, the default (BACKWARD) is non-transitive and therefore weaker than most teams assume, and under log retention the honest baseline for shared topics is transitive FULL compatibility, because "the consumer will be upgraded before it sees old data" is exactly the assumption replay (file 05) violates. This is Chapter 03 file 07's migration matrix transposed to events, with the deployment-order theorems inverted by the log's persistence.

## 1. Compatibility Direction — Who Upgrades First

The registry vocabulary, decoded operationally:

| Mode | Guarantee | Deployment-order consequence |
|---|---|---|
| BACKWARD | New *reader* schema reads data written with the previous schema | Upgrade **consumers first** — they must handle old data (which, on a log, they will *always* see: the retained tail) |
| FORWARD | Data written with the new schema is readable by the previous *reader* | Upgrade **producers first** — old consumers survive new data |
| FULL | Both | Either order — the only mode that doesn't encode a deployment-sequencing assumption |
| *_TRANSITIVE | Checked against **all** registered versions, not just the latest | The only variants that survive replay and long retention (§2) |

The evolution-rule mechanics under Avro-class schemas ([Avro specification](https://avro.apache.org/docs/current/specification/)) reduce to a short law table: adding a field with a default is backward-compatible (old data lacks it, the default fills it); removing a field with a default is forward-compatible; renaming is a remove+add (i.e., a break wearing a refactor's clothes); changing a type is a break unless it is a sanctioned promotion. Teams that memorize the table stop breaking each other; teams that don't, rediscover it one incident per rule.

## 2. Why Non-Transitive Defaults Fail on Logs

BACKWARD (the common default) checks new-vs-*latest* only. The trap, drawn:

```text
Figure 1. Non-transitive compatibility vs the retained tail.

  registry checks:   v3 ~ v2 ✓     v2 ~ v1 ✓     (pairwise only)
  but on the log:    v1 records still inside retention
                     v3-generation consumer reads the tail:
                     v3 ~ v1  ── NEVER CHECKED — may be broken

  timeline ──────────────────────────────────────────►
  log:  [v1 v1 v1 | v2 v2 | v3 v3 ...]
                   ◄──── retention window ────►
  replay/bootstrap reads ALL of it with TODAY'S reader.

  Rule: compatibility scope must cover every version that can
  still be READ — i.e., every version inside retention (or ever,
  for compacted/event-sourced topics). That is *_TRANSITIVE,
  by definition.
```

The corollary rule for **retiring** old schema versions is the same arithmetic in reverse: a version may leave the "must-read" set only when no record written with it remains readable — produced-before date + retention horizon (file 07 §1) is the earliest retirement date, and for compacted topics the answer is "when every key written with it has been overwritten," which nobody can prove cheaply — hence compacted and event-sourced topics ratchet toward *supporting every version forever or running explicit upcasting migrations* (rewrite the topic through a translator — Chapter 03 file 07's expand–contract, at topic scale).

## 3. Governance Machinery — the Gate Is Pre-Produce

The registry's architectural value is *where* it sits: validation at produce time, before the bad record is durable, fanned out, and inside someone's retention window. Post-hoc consumer-side tolerance ("be liberal in what you accept") is precisely wrong for logs — a tolerated malformation becomes a permanent inhabitant of the retained tail that every future consumer must also tolerate. The machinery checklist:

- **Registry-enforced produce path**: serializers that register/validate against the subject's compatibility rule; unregistered-schema produces rejected. A registry that exists but is advisory is a suggestion, not governance.
- **Compatibility mode per subject under change control**: mode *downgrades* (FULL→BACKWARD, transitive→non-) widen the break surface for every consumer and get API-break treatment (Chapter 01 file 04's deprecation machinery), not a config PR.
- **Consumer registry**: the social half — who reads this topic, owned by whom, paged how. The log hides consumers by design; governance must un-hide them, because "who do we even notify" is the first question of every schema incident and the registry of record must answer it.
- **Envelope standard**: origin-assigned event ID (file 02 §3), event type, schema version/ID, occurred-at (event time, file 06), source, and trace context (Chapter 01's W3C import) — the fields that make dedup, time semantics, DLQ triage (file 05 §3), and lineage possible are *envelope* fields, standardized once, not re-invented per topic. CloudEvents ([spec](https://github.com/cloudevents/spec)) is the neutral standard shape where cross-organization interop matters; internally, the requirement is the field set, not the brand.

## 4. Semantic Evolution — the Breaks No Registry Catches

Structural compatibility is necessary and insufficient: a field whose *meaning* shifts (amount changes currency assumptions; status gains a new enum value old consumers ignore silently; timestamps switch timezone discipline) passes every registry check and still corrupts every downstream. The defenses are organizational with technical teeth: semantic changes ride *new fields* alongside deprecated old ones (never re-inhabit an existing field), enum additions are announced through the consumer registry with a tolerance deadline, and event documentation lives *with the schema* in the registry, versioned — because six months later, inside a replay, the schema comment is the only surviving witness to what `status=7` meant. The test-side enforcement: consumer-driven contract tests pinned to the oldest in-retention version, run in producer CI — the producer's build breaks *before* the consumer's runtime does.

## 5. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Scope gate | Compatibility scope covers every version inside retention: transitive modes on shared topics; FULL_TRANSITIVE default for multi-team topics; retirement dates derived from retention arithmetic | Non-transitive BACKWARD as an unexamined default; version retirement by assumption |
| Enforcement gate | Produce-path registry validation mandatory; advisory registries treated as absent; mode changes under API-break change control | Producers able to write unvalidated schemas; compatibility downgraded via config PR |
| Envelope gate | Standard envelope (event ID, type, schema ID, event time, source, trace context) on every topic; CloudEvents where interop crosses org boundaries | Per-topic bespoke envelopes; dedup/time/lineage fields missing where files 02/05/06 require them |
| Consumer-registry gate | Every topic's consumer set recorded with owners; schema-change notification path exercised | "Who reads this?" unanswerable; breaking-change notification via incident |
| Semantic gate | Semantic shifts via new fields + deprecation; enum-tolerance policy stated per consumer; contract tests against oldest in-retention version in producer CI | Meaning changes inside existing fields; producer CI green while an in-retention version breaks |

## Output

The output of this file is event-contract governance that survives the log's memory: transitive compatibility scoped to everything still readable, produce-time enforcement that keeps malformations out of the retained tail, a standard envelope carrying the identity/time/lineage fields the rest of this chapter depends on, an un-hidden consumer registry, and semantic-evolution discipline for the breaks no serializer can see.

## References

- [Confluent Schema Registry — Schema Evolution and Compatibility (modes, transitivity, upgrade-order semantics)](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)
- [Apache Avro specification — schema resolution rules (the compatibility law table)](https://avro.apache.org/docs/current/specification/)
- [CloudEvents specification — the neutral event-envelope standard (CNCF)](https://github.com/cloudevents/spec)
- [Kleppmann, *Designing Data-Intensive Applications* — encoding, evolution, and dataflow between services](https://dataintensive.net/)
- [W3C Trace Context — the envelope's distributed-tracing fields (imported via Chapter 01)](https://www.w3.org/TR/trace-context/)
