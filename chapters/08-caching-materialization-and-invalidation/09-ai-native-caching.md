# AI-Native Caching

## Abstract

AI serving is the current frontier where every law in this chapter re-derives itself with the dials at maximum, because the cached artifacts are the most expensive bytes in the industry. Four cache classes structure the file. **KV/prefix caches** — reusing transformer attention state across requests sharing a token prefix — are the highest-leverage cache in AI serving: prefill compute is the cost being avoided, and the economics are strong enough that serving architectures have reorganized *around the cache* (vLLM's automatic prefix caching, hash-per-block over the prefix, is **enabled by default in vLLM V1** — a cache admission decision made for the ecosystem; Mooncake's KVCache-centric disaggregation, [FAST 2025](https://www.usenix.org/system/files/fast25-qin.pdf), trades pooled DRAM/SSD storage for recomputation and reports **59–498% effective capacity gains** under real traces within SLOs). **Exact-match and provider prompt caches** are file 03's key-closure discipline priced in dollars per token. **Semantic caches** — serving a stored response when a *similar* prompt arrives — are this chapter's cautionary instance: a cache whose key function is probabilistic, meaning its false-positive rate is a *correctness* SLI, not a tuning detail. **Embedding/feature caches** are ordinary look-aside caches whose producer version discipline (file 03's `model_v` in the key) is existential: an embedding cached under the wrong encoder version poisons every similarity computation downstream, silently. The through-line: model identity and version belong in every AI cache key, invalidation includes "the model changed," and the false-positive rate of any approximate cache is measured the way file 05 §3 measures coherence.

## 1. KV/Prefix Caching — the Cache the Architecture Reorganized Around

```text
Figure 1. Prefix reuse: requests sharing a prefix share its
attention state; only the suffix pays prefill.

  req A: [system prompt | tools | doc context | "summarize"]
  req B: [system prompt | tools | doc context | "list risks"]
                └────────── shared prefix ──────────┘
  block-hashed KV entries (hash = tokens of block + all prior
  tokens): B's prefill cost drops from O(full context) to
  O(suffix). Consequences, each a review item:
   · TTFT becomes BIMODAL (hit vs miss) → report hit/miss TTFT
     separately (Ch07 f09's SLI, split by cache outcome)
   · KV residency is THE capacity currency (Ch10): eviction
     policy on KV blocks = file 07's decision at GPU prices
   · cache-aware ROUTING: requests steer to workers holding
     their prefix (Ch02's control plane acting on cache state)
   · key closure: model version + sampling-irrelevant fields
     out, tokenizer/template version IN (file 03's law)
```

The design decisions this file owns at review. **Prompt structure is now a cache decision**: stable content (system prompt, tool schemas) belongs at the *front*, per-request content at the *back* — an ordering change that costs nothing and multiplies prefix-hit rates; provider prompt caching (explicit cache-control blocks on Anthropic-class APIs, automatic on others) makes the same structure directly billable, with cached input tokens priced at a fraction of fresh ones — the rare cache whose hit ratio appears on an invoice. **Tiering follows CacheLib's logic at new prices**: Mooncake/LMCache-class systems spill KV blocks from HBM to DRAM to SSD, and the admission question per block is file 07's byte-vs-miss arithmetic where a miss costs GPU-seconds of prefill — which is why "trade storage for computation" is the FAST paper's literal title. **Invalidation is version-shaped**: KV state is valid only for exactly this model + tokenizer + template; deploys invalidate by construction *if* versions are in the key (file 03's version-bump mechanism, mandatory here), and the failure mode of omitting them is attention state from the wrong model — garbage output, no error.

## 2. Semantic Caching — an Approximate Key Is a Correctness Decision

A semantic cache replaces file 03's referential-transparency guarantee with a similarity threshold: "close enough in embedding space" serves the stored answer. That single substitution changes the cache's failure class from *stale* to *wrong* — embedding models match texts with similar words and opposite meanings, so the false-positive path serves a confidently irrelevant answer — and the security literature has begun treating the key function as attack surface (crafted prompts that collide into a victim's cached response). The review posture, stated as a ladder: **exact-match first** (normalized prompt + model + params — zero correctness risk, and canonicalization recovers much of the hit rate teams buy semantic caching for), **provider prompt cache second** (prefix reuse without answer reuse), **semantic cache last and instrumented** — admitted only with: the false-positive rate measured continuously by shadow sampling (a fraction of hits also executes the model; divergence between cached and fresh answers is the SLI — Polaris's discipline, file 05 §3, applied to an approximate key), per-scope isolation (tenant/user in the key — a semantic cache shared across tenants is a data leak with cosine similarity as the access control), and product sign-off that the answer class tolerates approximation (navigational FAQs yes; anything with per-user facts, no). A semantic cache without a measured false-positive rate is an unmeasured wrongness generator with a hit-ratio dashboard.

## 3. Embedding Caches, Negative Knowledge, and the Version Law

The remaining classes are conventional machinery with one non-negotiable addition. **Embedding caches** (text → vector, memoized) obey the full file 01 contract, plus: `encoder_model_v` in the key (the law above — Chapter 06 file 06 made the same rule for stream-side embedding jobs; this is its serving-side twin), and invalidation on encoder rollout handled as a *re-embedding campaign* with priced GPU cost, not a purge (the cache is the cheap part; recomputing the corpus is the expense the version bump schedules). **Guardrail/moderation verdict caches** are negative-caching's AI instance (file 03 §3): caching "this input is disallowed" saves classifier calls, but a stale *allow* after a policy tightening is a compliance incident — verdict caches carry `policy_v` in the key and are first-tier targets of the policy-deploy invalidation path, with TTL backstops measured in minutes. **Retrieval-index freshness** is not re-argued here: a RAG index is a materialized view of the corpus, and file 08's lag/reconciliation contracts plus Chapter 06 file 06's freshness SLO govern it; Chapter 12 owns the retrieval-quality side of that boundary.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| KV-economics gate | Prefix-hit rate + hit/miss TTFT split as SLIs; prompt structure ordered for prefix stability; provider cache-control deliberate; KV tiering priced as byte-vs-prefill | Bimodal TTFT hidden in one average; per-request content ahead of stable content; KV eviction by default policy at GPU prices |
| Version-closure gate | model/tokenizer/template/encoder/policy versions in the relevant keys; deploys shown to invalidate by unreachability | Cross-version KV or embedding reuse; stale guardrail allows after policy tightening |
| Semantic-honesty gate | The §2 ladder applied in order; semantic layer (if any) has shadow-sampled false-positive SLI, per-tenant scope, product sign-off on the answer class | Semantic cache as default; FP rate unmeasured; cross-tenant semantic hits |
| Re-embedding gate | Encoder rollouts scheduled as priced re-embedding campaigns with dual-version serving during transition | Corpus half-embedded under two encoders serving one index |
| Boundary gate | RAG-index freshness governed by file 08/Ch06 contracts, cited not re-invented; Ch10 owns KV internals, cited | Cache design re-arguing retrieval quality or GPU scheduling here |

## Output

The output of this file is an AI-serving cache design where the most expensive bytes in the system are cached under full version closure, prompt and serving architecture are shaped around prefix reuse with its economics measured on the invoice, approximate caches are admitted only beneath a measured false-positive SLI and tenant isolation, and every "the model changed" event — weights, tokenizer, encoder, policy — is a designed invalidation with a priced recomputation plan.

## References

- [vLLM — Automatic Prefix Caching design (block hashing; default-on in V1)](https://docs.vllm.ai/en/latest/design/prefix_caching.html)
- [Qin et al., "Mooncake: Trading More Storage for Less Computation — a KVCache-centric Architecture for Serving LLM Chatbot" (FAST 2025)](https://www.usenix.org/system/files/fast25-qin.pdf)
- [Liu et al., "CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving" (SIGCOMM 2024)](https://arxiv.org/abs/2310.07240)
- [Anthropic — prompt caching documentation (explicit cache-control economics)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [GPTCache — semantic caching for LLMs (the approximate-key design this file's §2 disciplines)](https://github.com/zilliztech/GPTCache)
