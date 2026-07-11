# Context Packing and the Generation Boundary

## Abstract

Retrieval ends and generation begins at the packing stage — the assembly of reranked passages into the prompt the model actually reads — and it is the last recall term in file 02's product (r_pack) and the one most often left to a naive `"\n".join(chunks)`. Three forces make packing a design stage rather than a concatenation. **Position matters**: the lost-in-the-middle result ([Liu et al., 2023](https://arxiv.org/abs/2307.03172)) is a measured, robust U-shaped curve — models attend most to the beginning and end of context and *measurably lose* information in the middle — so a gold passage packed at position 8 of 15 can be present-but-unused, which means ordering is a quality lever (put the highest-reranked passages at the edges, not buried), and it is *also* the quantitative refutation of "just retrieve more": beyond a point, adding passages pushes the answer into the lost middle and *lowers* answered-query rate even as recall@k rises. **Budget matters**: the packing budget is a slice of Chapter 11 file 04's context ledger and Chapter 10's token bill — every packed token costs money and latency and competes with the model's own working space, so packing is a *selection under a budget* (which k, deduplicated, within T tokens), not "everything that was retrieved." **Coherence matters**: near-duplicate passages waste budget and bias the model toward the over-represented claim; passages stripped of their provenance cannot be cited (file 08); passages in random order force the model to reconstruct structure it was given no help with. The packing contract, then: **select the top-k that fit the budget, deduplicate, order for the attention curve, and carry each passage's provenance into the prompt** so the generation boundary hands the model a curated, attributable, budget-respecting context — and this is the handoff to Chapter 11 (the agent consuming retrieval per its ledger) and Chapter 10 (the fleet serving the generation call), each cited, not re-argued.

## 1. The Packing Decisions

```text
Figure 1. Packing = selection + dedup + order + provenance, under
a token budget — the last recall term (r_pack) in file 02.

  reranked top-k ─► SELECT within budget T:
     │   how many passages fit AND help? (more ≠ better —
     │   lost-in-the-middle caps useful k below what fits)
     ├─► DEDUP: near-duplicate passages waste budget + bias
     │   the model toward the repeated claim
     ├─► ORDER for the U-curve: best passages at HEAD and TAIL,
     │   weakest in the middle (or re-order so the answer-bearing
     │   passage is at an edge)
     └─► CARRY PROVENANCE: each passage tagged with source id +
         position so the model can cite (f08) and the answer is
         attributable
     ─────────────────────────────────────────────────────────
     result → the generation prompt (Ch11 ledger / Ch10 tokens)
     the anti-pattern: "\n".join(top_20) — no dedup, no order,
     answer in the middle, budget blown, nothing citable
```

The governing arithmetic, worked: suppose reranking yields 20 candidate passages and the answer is in the one ranked #6. Packed naively as 20 passages in rank order, #6 lands mid-context — lost-in-the-middle territory — and the model may not use it despite perfect retrieval (retrieval recall = 1.0, answered = 0: the two-halves failure of file 02 §2, on the generation side). Packed as top-8 with #1 and #6 placed at the head and tail, the answer is at an attended edge and the budget shrinks 60% — better quality *and* cheaper, the packing stage earning its place in the dossier. The rule the example teaches: **k is chosen for the attention curve and the budget, not for recall@k** — the retrieval stages maximize recall, the packing stage converts as much of it as the model can actually use, and those are different optima.

## 2. The Generation Boundary and Its Contracts

Packing is where retrieval's contracts become generation's obligations, and three cross into Chapter 11 / Chapter 10 as *cited* prerequisites this file must hand over cleanly. **The instruction contract**: the prompt tells the model to answer *from the provided context*, to *cite* which passage grounds each claim, and to *abstain* when the context does not answer (file 01's grounding contract, file 08's faithfulness) — packing without these instructions produces a model that blends parametric memory and retrieved text with no attribution, the post-rationalized-citation failure. **The budget contract** (Chapter 11 file 04): packed context is a named tenant in the agent's ledger and a line in Chapter 10's token bill, so its size is governed — an agent that packs 20 passages every turn re-reads them every turn (file 02's quadratic in Chapter 11), which is why just-in-time retrieval (retrieve when needed, pack what's needed) beats front-loading. **The cache contract** (Chapter 08 file 09): stable context (system prompt, tool schemas) precedes volatile retrieved passages so the prefix cache covers the stable head — a packing order that interleaves them forfeits the discount. The seam is clean: this chapter *produces* the context and its provenance; Chapter 11 *owns* how the agent budgets and loops over it; Chapter 10 *serves* the generation; and the grounding *verification* that the model actually used the context faithfully is file 08, next.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Selection gate | k chosen for the attention curve and token budget (not recall@k); the more-passages-lowers-quality effect measured (R6) | `join(top_20)`; k maximizing recall while burying the answer; budget blown on unused passages |
| Order gate | Passages ordered for the lost-in-the-middle U-curve; answer-bearing passages at attended edges | Rank-order packing dropping the answer into the lost middle; ordering left to retrieval rank |
| Dedup gate | Near-duplicate passages removed; the model not biased by repetition; budget not wasted | Duplicate passages inflating a claim's apparent support; budget consumed by redundancy |
| Provenance gate | Each packed passage carries source id + position into the prompt; citation possible downstream (f08) | Provenance stripped at packing; answers that cannot be attributed |
| Handoff gate | The instruction contract (answer-from-context, cite, abstain), budget contract (Ch11 ledger), and cache order (Ch08 f09) all satisfied at the boundary | Blended parametric+retrieved answers with no citation; cache-hostile packing order; unbudgeted context growth |

## Output

The output of this file is a packing stage that converts retrieval recall into usable, attributable, budget-respecting context: top-k selected for the attention curve rather than for recall, deduplicated and ordered so the answer sits where the model attends, each passage carrying its provenance for citation, and the generation boundary handing Chapter 11 and Chapter 10 a prompt whose instruction, budget, and cache contracts are all satisfied — the last recall term in file 02's product, raised as deliberately as the first.

## References

- [Liu et al., "Lost in the Middle: How Language Models Use Long Contexts" (2023)](https://arxiv.org/abs/2307.03172)
- [Chapter 11 file 04 — the context ledger this packing feeds and the quadratic re-read cost it must respect](../11-agentic-orchestration-and-tool-routing/04-context-engineering-and-agent-memory.md)
- [Chapter 10 file 02 — the token economics of the generation call packing sizes](../10-inference-runtime-and-gpu-serving-architecture/02-transformer-inference-arithmetic.md)
- [Chapter 08 file 09 — prefix-cache ordering the packing layout must preserve](../08-caching-materialization-and-invalidation/09-ai-native-caching.md)
