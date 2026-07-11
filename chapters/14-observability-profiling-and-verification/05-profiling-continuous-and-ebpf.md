# Profiling — Continuous and eBPF

## Abstract

Traces localize latency to a *span* (this service, this call — file 04); profiling localizes cost to a *line of code* — which function, which call stack, is spending the CPU, allocating the memory, holding the lock, or waiting on the I/O. It answers the question the trace hands off: the trace says "inventory.db.query took 610 ms," the profile says "*because* 400 ms of it is in the JSON deserializer called three levels deep in a loop." The signal is a **flame graph** ([Brendan Gregg](https://www.brendangregg.com/flamegraphs.html)): stacks sampled at a fixed frequency and aggregated so the *width* of each frame is the fraction of samples (≈ the fraction of time or resource) spent in that stack — the widest frames at the bottom-to-top are where the money goes, readable at a glance. The shift this file argues, mirroring file 04's continuous-over-on-demand posture, is **continuous profiling**: rather than attaching a profiler to reproduce a problem after it is reported (by which time the conditions are gone), sample the whole fleet *continuously and always*, at low frequency, so the profile of any moment — including the moment of an incident that will never reproduce — is already recorded and queryable. The enabler is **eBPF** ([Parca](https://www.parca.dev/), [Grafana Pyroscope](https://grafana.com/docs/pyroscope/latest/)): kernel-level sampling that profiles *every process without code changes or recompilation* at an overhead low enough for always-on production use — the [measured numbers](https://grafana.com/blog/ebpf-profiling-pros-and-cons/) are **under ~1% for eBPF-based whole-system profilers, ~2–5% for language sampling profilers** — which is the arithmetic (standard 9) that makes continuous profiling admissible: a <1% overhead to always know where every CPU-second goes is a trade every performance-sensitive fleet should take, because the alternative (profiling only during incidents) misses the incidents that do not reproduce and the slow, chronic waste that never triggers an incident at all but shows up on the bill every month. The file's synthesis: profiling is how "the service is slow / expensive" becomes "*this function* is slow / expensive," and for the compute-dominated systems of this book — where a GPU-second (Chapter 10) or a wasted allocation at fleet scale is real money — continuous profiling is the signal that ties a cost line on the invoice to a line in the source, and the one most teams discover they were missing only after it shows them a hotspot they had no other way to see.

## 1. The Flame Graph — Cost Attributed to Code

```text
Figure 1. A flame graph. Width = fraction of samples (≈ time/CPU)
in that stack. Read the wide frames: that is where the resource
goes. Height is call depth, not cost.

  [═══════════════ handle_request  100% ═══════════════════════]
  [═══ serialize 8% ═][════════ query_inventory 70% ═════════][auth 12%]
                      [═════ db_execute 66% ═══════════════]
                      [══ parse_result 40% ══][fetch 24%]
                      [ json_decode 38% ◄── the hotspot ]

  Reading: 70% of CPU is under query_inventory, and 38% of the
  WHOLE request is in json_decode inside it — a single function
  eating more than a third of every request's CPU. No metric or
  trace shows this; only the profile attributes cost to the LINE.
  Fix json_decode (or stop calling it in a loop) → 38% back.

  Profile TYPES (each its own flame graph over a different resource):
    CPU        — where cycles go (the classic)
    alloc/heap — where memory is allocated (GC pressure, leaks)
    lock/block — where threads wait on contention (Ch09 saturation)
    off-CPU    — where time goes waiting on I/O, not computing
```

The flame graph's value is that it makes a whole class of problems *visible that are invisible to every other signal*: a function eating a third of every request's CPU produces no error, no failed span, no saturation alert — the request succeeds, just expensively — so it never triggers an incident and never appears in RED/USE/trace views, yet it is a third of the compute bill. Only the profile, attributing resource consumption to the call stack, surfaces it. The multiple profile *types* matter because the bottleneck is not always CPU: a service that is slow while its CPU is idle is waiting (off-CPU / block profile — I/O or lock contention, Chapter 09's saturation made line-level), and profiling the wrong resource looks at an idle CPU flame graph and concludes falsely that nothing is wrong.

## 2. Continuous Profiling — Always-On, Because Incidents Don't Reproduce

```text
Figure 2. On-demand vs continuous profiling. The incident's profile
is only available if you were ALREADY profiling when it happened.

  ON-DEMAND (attach a profiler when a problem is reported):
    problem occurs ──► reported ──► attach profiler ──► try to
    reproduce ──► conditions GONE ──► "cannot reproduce" ✗
    (and: nothing profiles the chronic waste that never gets
     reported because it never causes an incident)

  CONTINUOUS (sample the whole fleet, always, at low frequency):
    every moment's profile ALREADY recorded + queryable
    ──► incident at 03:14? query the 03:14 profile, done ✓
    ──► chronic 38% json_decode waste? visible on the steady-state
        profile every day, fixed before it's ever an "incident" ✓

  The trade (standard 9, the overhead arithmetic):
    eBPF whole-system profiler:  < ~1% overhead
    language sampling profiler:  ~2–5% overhead
  A <1% always-on cost to never miss a hotspot or an unreproducible
  incident's profile is the trade performance-sensitive fleets take.
```

The argument is the same one file 04 made for continuous tracing and file 03 for always-on events: **the profile you need is the one from a moment that has already passed**, and you cannot go back and profile it unless you were profiling then. Continuous profiling also catches what on-demand structurally cannot — the *chronic* waste that never causes an incident (the function that has always eaten 38% of CPU, so nothing ever flagged it as a regression) but is pure cost, visible only when you look at the steady-state profile and ask "why is *that* so wide." The eBPF overhead numbers are what make "always on" affordable: profiling the entire fleet, all processes, no code changes, for a single-digit-percent tax — and often a *net negative* cost once the hotspots it reveals are fixed.

## 3. Profiling the Compute That Costs the Most — GPU and Inference

For the inference systems of Chapter 10, profiling is not a nicety but the tool that ties the roofline model to reality: the chapter derived that a batch-1 decode is memory-bandwidth-bound at a 42 ms floor, and profiling is how you *verify* the serving path actually hits that floor rather than wasting cycles — GPU profilers (kernel timelines, occupancy, memory-bandwidth utilization / MBU) are the flame-graph analog for accelerators, showing whether the GPU is doing matrix math or stalled on memory movement, whether kernels are fused or launching serially, whether the batch is actually filling the device (Chapter 10's MFU/MBU as a *profiled* number, not just a derived one). The discipline: **the most expensive compute deserves the most profiling**, and in an AI system the GPU-seconds are the most expensive compute, so the serving path is profiled to confirm its measured utilization matches its derived capacity — the gap between them is waste with a dollar figure, and the profile is where that gap becomes a specific kernel or a specific un-fused operation to fix. This is the file-05 instance of the book's recurring move (Chapter 10's first-principles arithmetic, standard 9): derive the capacity from device parameters, then *profile to validate* the real path achieves it — benchmarks and profiles confirm the derivation; they do not replace it.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| Attribution gate | Cost (CPU/alloc/lock/off-CPU) attributed to code via flame graphs; the right resource profiled for the symptom | "The service is slow/expensive" with no line-level attribution; profiling CPU while the bottleneck is I/O wait |
| Continuous gate | Fleet profiled continuously and always, so any past moment's profile (incl. an unreproducible incident's) is queryable | On-demand-only profiling that misses unreproducible incidents and chronic waste; "cannot reproduce" as an investigation dead-end |
| Overhead gate | Profiler overhead measured and budgeted (eBPF <~1%, language ~2–5%); the always-on trade justified | Un-budgeted profiling overhead; or no profiling because "it's too expensive" without measuring the actual single-digit cost |
| Compute-priority gate | The most expensive compute (GPU/inference) profiled to validate measured utilization against derived capacity | GPU serving path unprofiled; the gap between roofline capacity and real MFU/MBU unmeasured and unpriced |
| Off-CPU gate | Time-spent-waiting profiled (off-CPU/block), not just CPU, so idle-CPU-but-slow cases are diagnosable | Concluding "nothing is wrong" from an idle CPU flame graph while the service waits on locks or I/O |

## Output

The output of this file is profiling as the line-level cost-attribution signal: flame graphs that make visible the expensive-but-successful code no metric, trace, or alert reveals, gathered continuously via low-overhead eBPF so the profile of any moment — including the incident that will never reproduce and the chronic waste that never alerts — is already recorded and queryable. For the compute-dominated systems of this book the most expensive resource gets the most profiling, tying the roofline capacity of Chapter 10 to the real serving path and turning the gap between them into a specific kernel to fix — profiling validating the first-principles derivation, never replacing it.

## References

- [Gregg, "Flame Graphs" (the visualization and method)](https://www.brendangregg.com/flamegraphs.html)
- [Grafana Labs, "eBPF profiling pros and cons" (overhead measurements)](https://grafana.com/blog/ebpf-profiling-pros-and-cons/)
- [Parca — continuous profiling with eBPF (whole-fleet, no code changes)](https://www.parca.dev/)
- [Grafana Pyroscope — continuous profiling documentation](https://grafana.com/docs/pyroscope/latest/introduction/continuous-profiling/)
