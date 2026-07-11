# SLO Instrumentation and Alerting

## Abstract

Telemetry is raw material; an **SLO** is the decision made from it. A Service Level Indicator (**SLI**) is a measured ratio of good events to total events (successful requests / all requests, requests-under-300ms / all requests); a Service Level Objective (**SLO**) is the target that ratio must hold over a window (99.9% over 30 days); and the **error budget** is the complement (0.1% = 43.2 minutes/month, Chapter 13 f02) — the amount of failure the system is *allowed*, spent deliberately rather than feared. This file is the discipline of turning the signals of files 02–05 into SLOs and turning SLOs into *alerts that are worth waking someone for* — because the failure mode of naive alerting is not missing incidents but the opposite: so many alerts (one per cause, per threshold, per component) that the pager becomes noise, on-call develops alert fatigue, and the one alert that mattered is lost among the hundred that did not. The governing principle, from [Google SRE](https://sre.google/sre-book/monitoring-distributed-systems/), is **symptom-based alerting**: **page on what the user feels, not on what a machine noticed** — alert on the SLI (the user-facing symptom: error rate, latency) and let the *causes* (high CPU, a full disk, a restarting pod) be *diagnostic* signals you consult after the symptom pages, not pages in themselves. A high CPU that does not breach the SLO is not an incident; a breached SLO with healthy-looking CPU still is — so the alert fires on the SLO, and CPU is where you look next, not what wakes you. The mechanism that makes SLO alerting both fast and quiet is **burn-rate alerting** (Chapter 13 f02, applied here as the instrumentation output): alert on the *rate* the error budget is being consumed, with a fast-burn threshold that pages on an acute outage and a slow-burn threshold that tickets a chronic drain, multiwindow to suppress the blips — the [14.4×/1h + 6×/6h page, 1×/3d ticket](https://sre.google/workbook/alerting-on-slos/) structure. The file's synthesis and the reason it sits after the signal files: an SLO is only as honest as the SLI that measures it, and the SLI is only as trustworthy as the instrumentation beneath it — a "99.9% available" SLO measured by a health check that passes during a gray failure (Chapter 13 f02) is a number that lies, so the SLI must measure the *outcome the user experiences* (file 08's lesson for AI: correctness, not just a 200 status), through the differential-observability lens that catches the failure the component's self-report misses.

## 1. SLI → SLO → Error Budget → Alert

```text
Figure 1. The chain from measured events to a page. Each link is a
design decision; the alert fires on the budget's BURN RATE, not on
a raw threshold or a cause.

  SLI   = good events / valid events
          e.g. (requests with status<500 AND latency<300ms) / all
          ▲ must measure the USER'S outcome, not a proxy (f08)
          │
  SLO   = SLI target over a window
          e.g. 99.9% over 28 days
          │
  ERROR = 1 − SLO  = the allowed failure
  BUDGET  0.1% × 28d ≈ 40 min  ← spent, not feared
          │
  BURN  = how fast the budget is being consumed (× normal)
  RATE    ┌─ 14.4× over 1h (2% of budget in 1h) → PAGE (acute)
          ├─ 6×   over 6h (5% in 6h)            → PAGE (serious)
          └─ 1×   over 3d (chronic drain)       → TICKET (not urgent)
          multiwindow: require short+long window both → no blips

  The alert fires HERE (burn rate on the user-facing SLI) — never
  on "CPU 90%" (a cause, not a symptom).
```

The chain's discipline is that **every link is chosen, not defaulted**: the SLI is chosen to measure the user's actual experience (not the easiest-to-collect proxy), the SLO target is chosen against the business need (not "as many nines as possible" — Chapter 13's cost curve), the budget is a resource to *spend* (on deploys, experiments, risk — a team under budget is being too conservative, a team over budget must slow down), and the alert fires on burn rate so its urgency matches the failure's speed. This converts alerting from "a threshold someone set once" into a principled system where the page means "the user-facing objective is at risk at this rate," which is the only alert an on-call engineer can neither ignore nor resent.

## 2. Symptom-Based Alerting — Page on the Symptom, Diagnose on the Cause

```text
Figure 2. The alerting inversion. Cause-based alerting pages on
every machine condition and drowns the signal; symptom-based pages
on the user's experience and uses causes as the diagnosis after.

  CAUSE-BASED (the anti-pattern):
    page: CPU>90%   page: disk>80%   page: pod restarted
    page: queue>1k  page: memory>85% page: replica lagging
    → 100 pages/week, most self-resolve, none is "the user is
      failing" — ALERT FATIGUE, and the real incident is buried

  SYMPTOM-BASED (the discipline):
    page: SLO burn rate (users are experiencing errors/slowness)
    ── ONE class of page, meaning "the objective is at risk" ──
       │
       └─► THEN consult causes as DIAGNOSTIC signals (not pages):
           CPU? disk? queue? saturation (USE, f02)? trace the slow
           span (f04)? profile the hot function (f05)?

  Rule: if a condition does not (yet) affect the SLI, it is a
  DASHBOARD, not a PAGE. High CPU that holds the SLO is capacity
  planning, not an incident.
```

The inversion is the single highest-leverage alerting decision: **alert on symptoms, diagnose with causes.** Cause-based alerting fails in two directions at once — it pages on conditions that do not matter (a CPU spike the system absorbed, a pod that restarted and recovered), *and* it misses novel failures whose cause nobody pre-alerted on (the file-01 unanticipated failure), because it can only alert on the causes someone thought to threshold. Symptom-based alerting fixes both: it pages only when the user is actually affected (whatever the cause, anticipated or not), and it keeps the pager quiet enough that a page *means something*. The causes do not disappear — they become the *diagnostic* layer (USE saturation, the slow trace span, the hot profile frame) consulted *after* the symptom pages, which is exactly the drill-down files 02–05 were built to support.

## 3. Alert Quality — The Properties of a Page Worth Sending

An alert that pages a human at 3 a.m. must clear a high bar, and the SRE discipline names the properties ([Rob Ewaschuk's "My Philosophy on Alerting"](https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/edit)):

| Property | The alert must be... | The failure it prevents |
|---|---|---|
| **Actionable** | Something the on-call can *do something about*, now | Pages for conditions with no human action (auto-healing noise) |
| **Symptomatic** | Tied to a user-visible symptom (the SLO) | Cause-alert fatigue; pages that don't matter |
| **Novel-catching** | Firing on the outcome, so it catches unanticipated causes too | Blindness to the failure nobody pre-thresholded |
| **Urgent (if paging)** | Requiring attention *before* the next business day | 3 a.m. pages that could have been a ticket |
| **Diagnosable** | Linked to the traces/profiles/dashboards that localize the cause | A page that says "SLO breached" with no path to *why* |

The tiering that follows: **pages** for fast-burn (acute, user-affecting-now, needs a human immediately), **tickets** for slow-burn (chronic, real, but fixable in hours), and **dashboards** for everything that is context but not yet an incident. A system that pages for tickets burns out its on-call; a system that only tickets its pages misses the acute outage. The burn-rate tiers of §1 are exactly this classification made mechanical — the alert's *speed of budget consumption* decides page-vs-ticket, so urgency is derived from the data, not guessed by whoever wrote the alert.

## 4. Approval Gates

| Gate | Evidence Required | Failure Condition |
|---|---|---|
| SLI-honesty gate | SLIs measure the user's actual outcome (correctness/latency the user feels, f08), through differential observability, not a self-reported proxy | "Available" measured by a health check that passes during gray failure; a proxy SLI that lies |
| SLO-chain gate | SLI→SLO→error budget defined; budget treated as a spendable resource; targets chosen against business need not max-nines | No SLO (alerting on raw thresholds); budget feared not spent; "as many nines as possible" |
| Symptom-alerting gate | Pages fire on SLO burn rate (symptoms); causes are diagnostic signals, not pages | Cause-based alerting (CPU/disk/pod) causing fatigue; the real incident buried in noise |
| Burn-rate gate | Multiwindow multi-burn-rate: fast-burn pages, slow-burn tickets; urgency derived from budget-consumption speed | Static thresholds; every alert a page; urgency guessed not measured |
| Alert-quality gate | Every page actionable, symptomatic, urgent, and diagnosable (linked to traces/profiles) | Non-actionable pages; "SLO breached" with no drill-down path; tickets paging at 3 a.m. |

## Output

The output of this file is the instrumentation that turns telemetry into decisions: SLIs that honestly measure the user's outcome, SLOs and error budgets that make failure a resource to spend rather than fear, and — the core discipline — symptom-based, burn-rate alerting that pages only when the user is actually affected, at an urgency the data derives, with the causes demoted to the diagnostic layer consulted after the page. This is what keeps the pager meaningful and the on-call sane, and it is the signal that feeds Chapter 13's detection: the burn-rate alert defined here is the same signal that triggers the isolation, degradation, rollback, and recovery that chapter designed.

## References

- [Google SRE Workbook — "Alerting on SLOs" (multiwindow, multi-burn-rate)](https://sre.google/workbook/alerting-on-slos/)
- [Google SRE Book — "Service Level Objectives" (SLI/SLO/error budget)](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE Book — "Monitoring Distributed Systems" (symptom-based alerting)](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Ewaschuk, "My Philosophy on Alerting" (actionable/symptomatic/urgent)](https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/edit)
