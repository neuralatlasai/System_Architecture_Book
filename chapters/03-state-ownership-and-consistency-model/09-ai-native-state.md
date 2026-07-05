# AI-Native State

## Abstract

AI systems did not invent new state physics; they invented new state items and then, as an industry, skipped the contracts. This file applies the chapter's machinery — ownership (file 01), consistency (file 02), lineage (file 05), lifecycle (file 06), recovery (file 08) — to the five state classes AI-native systems run on: KV cache, embeddings and vector indexes, agent memory, session/context state, and model artifacts with their registries. None of these gets new policy; each gets the uncomfortable discovery of which existing rule it has been violating. The sharpest case is agent memory, which current research treats as a capability problem (Letta/MemGPT's tiered memory hierarchies ([Packer et al., 2023](https://arxiv.org/abs/2310.08560)); Mem0/A-MEM's adaptive updates) while the security literature documents the consequence of the skipped contracts: memory that misattributes injected content as first-party experience, cannot say where a "fact" came from, and cannot forget on demand ([survey on long-term memory security, 2026](https://arxiv.org/html/2604.16548v1)). A memory write is a state mutation by an untrusted writer — file 01 has an opinion about that, and this file enforces it.

The brutal summary: most AI state today is unowned derived state with no lineage, no deletion path, and no rebuild story — Chapter 01 file 07's definition of unowned correctness, at GPU prices.

## 1. The Five Classes, Mapped

```text
Figure 1. AI-native state on the chapter's axes. Nothing here is
exempt from a rule; each item is just an instance the industry
ships without its contract.

  class            state kind         owner            hardest obligation
  ─────            (Ch01 f07)         (file 01)        (this chapter)
  KV cache         ephemeral/derived  serving engine   correctness of reuse
                                                       across requests (§2)
  embeddings +     derived            indexing         lineage + deletion
  vector index     (of docs×model)    pipeline         propagation (§3)
  agent memory     persistent +       memory service   writer trust, provenance,
                   derived            (NOT the model)  erasure (§4)
  session/context  ephemeral→         session service  read-your-writes across
                   persistent drift                    turns; retention drift (§5)
  model artifacts  persistent,        registry         version identity;
  + registry       control-plane      (Ch02 f08)       rollback compatibility (§6)
```

## 2. KV Cache

The KV cache is ephemeral derived state (a deterministic function of prefix tokens × model version), which is why cross-request reuse — the entire point of prefix caching and KV-aware routing (Ch02 file 05 §4) — is safe *only* under three checks that are this chapter's rules restated:

- **Identity**: a cache entry's key is (token prefix, model version, sampling-relevant config). Reusing KV across a model or tokenizer version change is the file 05 §1 identity violation, and it produces wrong output, not slow output.
- **Isolation**: a shared prefix cache is a shared cache; the Chapter 01 file 03 tenant rules apply. Cross-tenant prefix sharing leaks the *existence and content* of one tenant's prompts into another's latency profile (timing side channel) or worse, into retrieved KV. Tenant scope belongs in the cache key or the pool boundary — chosen deliberately.
- **Loss semantics**: eviction and node loss cost recompute (prefill), never correctness. Any design where KV loss changes *output* has smuggled state-of-record into a scratch buffer.

## 3. Embeddings and Vector Indexes

The chapter's rules land harder here than anywhere, because vector stores structurally resist them:

| Rule | The Vector-Store Collision |
|---|---|
| Lineage (file 05) | Every vector must carry (source doc version, chunker version, embedding model version). Without all three, "re-embed what changed" is impossible and the index degrades into unexplainable similarity soup |
| Identity (file 05 §1) | Two embedding-model versions in one index are unjoinable output sharing a coordinate space by accident; similarity across them is noise. Model upgrades are dual-index migrations (file 07 §3), not rolling updates |
| Deletion (file 06 §5) | Vectors don't support `WHERE subject = S` natively; erasure requires subject attribution stored *with* the vector and negative verification by semantic probe. An index built without attribution was built un-erasable — rebuilding it is the remediation, and it is expensive precisely because it was skipped |
| Authorization (Ch01 file 03 §3) | Filter-after-ranking leaks; permission scope must gate candidate retrieval. The vector index inherits the ACL complexity of every document it embeds — "it's just vectors" is the classification error [OWASP LLM08](https://genai.owasp.org/llm-top-10/) catalogs |
| Rebuild (file 05 §4) | The index must be regenerable from (document store × pipeline versions), with measured duration. Teams discover at incident time that the "index" contains vectors whose source documents were deleted years ago — the disguised-source-of-truth pattern, verbatim |

## 4. Agent Memory

Agent memory is where every rule in this chapter converges, because a memory write is a mutation of persistent state whose *author is a model processing untrusted input*. The tiered architectures (core/archival/recall in the MemGPT lineage ([Packer et al.](https://arxiv.org/abs/2310.08560))) answer the capacity question; the state contracts answer the questions incidents ask:

```yaml
memory_item:                   # the ownership tuple, instantiated
  content:
  owner: memory_service        # the model PROPOSES writes; the service,
                               # applying policy, COMMITS them (file 01:
                               # untrusted writers go through the owner)
  provenance:
    source: user_stated | tool_result | model_inference | retrieved_doc
    principal:                 # WHOSE memory this is — tenant + user scope
    episode:                   # journal reference (Ch02 file 08 §3)
    trust_class:               # first-party vs externally-injected — the
                               # distinction whose absence the security
                               # literature identifies as THE failure mode
  write_policy:                # validation before commit; injected content
                               # is never committed as first-party fact
  consistency: read_your_writes # an agent that stores a fact and doesn't
                               # retrieve it next turn is incoherent —
                               # session guarantees (file 02), not luck
  lifecycle:                   # file 06 verbatim: retention, correction
                               # (memories go STALE — the world changes),
                               # erasure on subject request, legal hold
  audit:                       # who/what wrote, under which policy version
```

Three consequences deserve their bluntness. **The model is not the owner** — an agent that can write its own memory unmediated is the file 01 side-door anti-pattern plus the Chapter 02 file 08 authority violation, and it converts one successful prompt injection into *persistent* compromise: the injected instruction gets remembered and replayed into every future context, which is exactly the misattribution failure the security survey documents ([2026 survey](https://arxiv.org/html/2604.16548v1)). **Provenance is not optional metadata** — retrieval-time trust decisions (does this memory enter the context of a high-consequence action?) are only possible if trust class was recorded at write time; it cannot be reconstructed later. **Erasure applies** — memory about a user is personal data with a derivation trail (file 06 §4's DAG walk includes the memory store, its embeddings, and its summaries), and "the model might have internalized it via fine-tuning" is a declared risk decision, not a shrug.

## 5. Session and Context State

Session state starts ephemeral and drifts persistent — conversation history becomes "context," context gets summarized, summaries get stored, and eighteen months later the "session" is a permanent record nobody classified. The contracts: an owner and a declared lifecycle *before* the drift (a session that outlives its request is persistent state, full stop); read-your-writes across turns as an explicit session guarantee (file 02 §2 — sticky routing or version tokens, not load-balancer luck); context compaction as a lossy derived transform (the summary is file 05 §5 generated state, with provenance to the turns it compressed — an agent acting on its own summary of a hallucinated summary is a lineage problem you can only debug if the lineage exists); and retention per data class, because conversations contain whatever users type into them, which means the session store inherits the *most* restrictive classification it has ever touched.

## 6. Model Artifacts and Registries

The registry is Chapter 02 file 08's control-plane object; this chapter adds its state contracts. A model version's identity includes weights, tokenizer, chat template, and sampling defaults — teams pin weights and let the template drift, then hunt "regressions" that are template diffs. Rollback compatibility is a file 07 matrix problem: rolling a model back while its KV caches, embeddings (§3), memory summaries (§4), and fine-tunes reference the new version walks backward through cells the plan never enumerated. And the registry itself needs file 08 recovery — a registry whose loss makes deployed model provenance unreconstructable turns every future audit question into archaeology.

## 7. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| KV gate | Cache identity includes model/config version; tenant scope in key or pool; loss costs recompute only | KV reuse across versions or tenants, or output depends on cache survival |
| Vector gate | Per-vector lineage (doc × chunker × model versions) + subject attribution; dual-index migration for model changes; rebuild measured | Mixed-version index, un-attributable vectors, or erasure answered with "we deleted the document" |
| Memory gate | Writes committed by the service under policy with trust-class provenance; model proposals never auto-committed; erasure walks memory's own DAG | The model writes its own memory; injected content is recallable as first-party fact |
| Session gate | Ownership and lifecycle declared before persistence drift; read-your-writes mechanized; compaction carries lineage | "Session" state discovered to be a permanent unclassified record |
| Registry gate | Model identity covers weights + tokenizer + template + defaults; rollback matrix enumerated across dependent state; registry has restore evidence | Version pins that pin half the artifact, or model rollback with orphaned dependent state |

## Output

The output of this file is the chapter's contracts instantiated for AI state: KV reuse that cannot change output, vector indexes that can be rebuilt and emptied of a person, memory whose every fact has an owner-mediated write and a trust class, sessions that were classified before they became permanent, and model artifacts whose identity and rollback are as versioned as the schema they effectively are.

## References

- [Packer et al., "MemGPT: Towards LLMs as Operating Systems," 2023](https://arxiv.org/abs/2310.08560)
- [Survey on the Security of Long-Term Memory in LLM Agents, 2026](https://arxiv.org/html/2604.16548v1)
- [OWASP Top 10 for LLM Applications 2025 — LLM08 Vector and Embedding Weaknesses](https://genai.owasp.org/llm-top-10/)
- [NVIDIA Dynamo — KV-cache-aware routing (the reuse this file's contracts make safe)](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [Meta Engineering — Privacy-Aware Infrastructure (derived sensitivity and lineage)](https://engineering.fb.com/2026/06/25/security/privacy-aware-infrastructure-in-the-ai-native-era-an-asset-classification-case-study/)
