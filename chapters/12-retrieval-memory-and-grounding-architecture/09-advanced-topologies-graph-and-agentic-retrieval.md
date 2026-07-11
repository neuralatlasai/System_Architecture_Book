# Advanced Topologies — Graph and Agentic Retrieval

## Abstract

The baseline pipeline (files 03–08) is single-shot: one query, one retrieval, one generation — and it fails on two query classes the frontier techniques exist to serve, each admitted here with an honest adoption judgment (standard 8). **Multi-hop / global queries** defeat single-shot retrieval because the answer requires *connecting* information no single passage contains ("which of our vendors are affected by the CVE in library X" needs the CVE→library→vendor chain; "what are the themes across these 500 documents" needs cross-document synthesis no chunk holds). **GraphRAG** ([Microsoft, 2024](https://arxiv.org/abs/2404.16130)) addresses the global case by building a knowledge graph from the corpus at ingest (LLM-extracted entities and relations) plus community summaries, so a global query retrieves over *structure and summaries* rather than isolated chunks — measurably better on cross-document synthesis, at a real cost the judgment must state: graph construction is an expensive LLM-heavy ingest campaign (Chapter 08 file 09's re-embed economics, multiplied), the graph is a derived-state artifact needing its own freshness and rebuild discipline (Chapter 03 file 05), and it wins on *global/thematic* queries while adding little on *local factoid* queries the baseline already serves — so GraphRAG is a targeted tool for synthesis-heavy corpora, not a default upgrade. **Agentic / iterative retrieval** addresses multi-hop by putting retrieval *inside* the agent loop (Chapter 11): retrieve, inspect, reformulate, retrieve again — Self-RAG's reflect-and-critique, plan-then-retrieve, and the query-decomposition of file 05 executed iteratively — which turns retrieval from a fixed pipeline stage into an agent capability, priced by Chapter 11 file 02's episode arithmetic (each hop is model calls + retrieval latency, and the pⁿ survival law now applies to the *chain of retrievals*) and governed by Chapter 11's whole apparatus (budgets, verification, the injection surface widening with every autonomous fetch). The synthesis the chapter wants remembered: these are not "better RAG," they are *different admission decisions* — the baseline serves local factoid retrieval cheaply, GraphRAG serves global synthesis expensively, agentic serves multi-hop reasoning at episode cost — and file 01's admission table extends to *which retrieval topology*, chosen per query class by the same measured trade, not adopted wholesale because the frontier is fashionable.

## 1. The Topology Admission Table

```text
Figure 1. The retrieval router: query class selects topology, and
each topology carries a different cost model. Monotopology (one
branch for all queries) is the failure this routing prevents.

  incoming query
        │
        ▼
  ┌───────────────┐   classify (file 10-eval'd)
  │ query router  │──────────────────────────────┐
  └───────┬───────┘                               │
          │                                       │
   ┌──────┼───────────┬───────────────┬───────────┴─────┐
   ▼      ▼           ▼               ▼                 ▼
 local  global     multi-hop      structured        mixed/
 factoid thematic   A→B→C         count/join        unknown
   │      │           │               │                │
   ▼      ▼           ▼               ▼                ▼
 BASELINE GraphRAG  AGENTIC LOOP   TEXT-TO-QUERY   (route again)
 f03-08  graph +    Ch11 loop:     system of
 single- community  retrieve→      record; NOT
 shot    summaries  inspect→       retrieval
   │      │          reretrieve      │
   ▼      ▼           │               ▼
 cheapest LLM-heavy   ▼            fresh, exact
 correct  ingest;   episode cost;  (file 01's
 for      derived   pⁿ over hops;  "call a tool")
 factoid  graph to  injection
          keep      surface widens
          fresh     per hop
```

| Query class | Topology | Why / the honest cost |
|---|---|---|
| Local factoid ("what is X's Y") | **Baseline single-shot** (files 03–08) | The answer is in one passage; retrieve, rerank, ground. Cheapest, and correct — do not over-engineer it |
| Global / thematic ("themes across the corpus", "summarize everything about X") | **GraphRAG** (graph + community summaries) | Cross-document synthesis no chunk holds; costs an LLM-heavy graph-build ingest (Ch08 f09 ×) and a derived graph to keep fresh (Ch03 f05); little gain on local queries |
| Multi-hop ("A→B→C chains", "which vendors affected by...") | **Agentic / iterative retrieval** (Ch11 loop) | Needs retrieve-inspect-reretrieve; priced at episode cost (Ch11 f02's pⁿ over the retrieval chain); widens the injection surface per hop |
| Structured / relational ("count", "join", "filter over fields") | **Text-to-query over the system of record** (not retrieval) | The answer is a database query, not a passage — retrieval of a stale snapshot is the wrong shape (file 01's "call a tool") |
| Mixed / unknown | **Router** over the above, per query | Route by query classification (file 01's admission, per-query); the router is eval-gated config, not vibes |

The governing rule: **topology is a per-query-class admission decision**, and the failure this table prevents is monotopology — forcing every query through GraphRAG (paying synthesis cost on factoid queries) or through an agentic loop (paying episode cost on one-shot lookups) or through baseline RAG (failing every multi-hop and global query silently). A mature retrieval system routes, and the router is measured (file 10) like any other classifier.

## 2. The Frontier, Judged

**GraphRAG's adoption judgment**: production-real and genuinely better on global synthesis (Microsoft's evals show it on query-focused summarization the baseline cannot do), but the cost structure is the gate — graph construction is a large one-time-per-corpus-version LLM campaign, the graph is derived state with freshness and rebuild obligations, and the win is query-class-specific; adopt it *for the corpora and queries that need cross-document synthesis*, measure it against the baseline on *your* query mix, and budget the ingest. Lighter graph techniques (entity linking over chunks, without full community summarization) sit on a cost/benefit spectrum the dossier should place itself on. **Agentic-retrieval's adoption judgment**: the direction the field is moving (retrieval as an agent capability, not a fixed stage — "RAG in the age of agents"), powerful for multi-hop and adaptive retrieval, but it inherits *all* of Chapter 11's costs and risks: episode-cost economics (each hop is a generation call), the pⁿ reliability law over the retrieval chain (a 4-hop retrieval at 0.9-per-hop survival is 0.66 — file 02's law, now over hops), the verification burden (an agent that retrieves the wrong thing and reasons confidently over it), and the injection surface widening with every autonomous fetch of untrusted content (Chapter 11 file 08 — an agentic RAG that browses is the lethal trifecta with a search bar); so agentic retrieval is admitted through Chapter 11's full apparatus, not as a retrieval-layer tweak. **The long-context pressure** (file 01, revisited): as context windows grow, the *baseline* pipeline's job shrinks for mid-size corpora (fit more, retrieve less), but retrieval does not die — it moves up the value chain to *governance* (access control, freshness, attribution — the things long-context alone cannot provide) and to the *large/private/fresh* corpora long-context still cannot hold, which is why "RAG is dead" recurs and is wrong: the mechanics shift, the grounding contract (file 01, file 08) does not.

## 3. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Topology-admission gate | Per query class: the topology chosen from §1 with its cost justified; a router where the mix is heterogeneous | Monotopology (all queries through GraphRAG, or agentic, or baseline); topology by fashion |
| GraphRAG gate | Adopted only for synthesis-heavy query classes, measured against baseline on the real query mix; graph-build cost budgeted; graph freshness/rebuild as derived state (Ch03 f05) | GraphRAG as a default upgrade; the graph-build campaign cost undiscovered; a stale graph nobody rebuilds |
| Agentic-retrieval gate | Admitted through Chapter 11's apparatus (episode budget, pⁿ-over-hops reliability, verification, widened injection surface) | Agentic RAG as a retrieval tweak; unbudgeted hop chains; the browsing-agent lethal trifecta |
| Router gate | The query-class router eval-gated and measured (file 10); routing errors' cost stated | Routing by vibes; a router silently sending multi-hop queries to single-shot retrieval |
| Long-context-revisit gate | The RAG-vs-long-context line re-decided per corpus as windows grow (file 01's re-decision date); retrieval's governance value retained where it moves | "RAG is dead" adopted wholesale; losing attribution/freshness/access-control by dumping everything in context |

## Output

The output of this file is a topology decision extended to retrieval itself: the baseline for local factoids, GraphRAG for global synthesis at its stated cost, agentic retrieval for multi-hop through Chapter 11's full apparatus, and a system of record for structured queries — routed per query class by a measured classifier, with the frontier techniques judged on their real costs rather than adopted as fashion, and the grounding contract preserved as the one thing that survives every shift in the retrieve-vs-long-context line.

## References

- [Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" (Microsoft, 2024)](https://arxiv.org/abs/2404.16130)
- [Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection" (2023)](https://arxiv.org/abs/2310.11511)
- [Chapter 11 file 02 — the episode arithmetic and pⁿ law agentic retrieval is priced by](../11-agentic-orchestration-and-tool-routing/02-agent-failure-arithmetic-and-episode-economics.md)
- [Chapter 01 file 04 (via Ch12 file 01) — the retrieve-vs-long-context admission the frontier keeps re-litigating](../01-architectural-objective-and-system-boundary/04-input-output-and-api-contracts.md)
