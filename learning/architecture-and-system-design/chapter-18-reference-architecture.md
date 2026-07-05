# Chapter 18 — Reference Architecture and a Design Checklist

This final chapter assembles everything into a single reference architecture and a checklist you can carry into your own design review. Treat it as the one-page (well, several-page) summary of the whole folder.

## The reference architecture

A complete, production-grade agent — the kind the earlier chapters describe — has this shape:

```
                          ┌─────────────────────────────────────────┐
                          │                 Client                  │
                          │   (renders streamed event timeline)     │
                          └───────────────┬─────────────────────────┘
                                          │  request + SSE stream
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               API / Web tier                                   │
│  • Edge hardening: security headers, CORS, rate limiting                       │
│  • Auth middleware (identity)            ─────────────► [Auth system]           │
│  • Authorization helpers (access checks)                                       │
│  • Input validation                                                            │
│  • Routes per resource (chat, documents, projects, …)                          │
└───────────────┬────────────────────────────────────────────────┬──────────────┘
                │                                                  │
                ▼                                                  ▼
┌───────────────────────────────────────┐         ┌──────────────────────────────┐
│            Agent core                  │         │      Document pipeline        │
│  • Context builder (assemble prompt)   │         │  ingest → store → convert →   │
│  • Orchestrator (the loop, streaming,  │         │  extract → version → ready    │
│    event timeline)                     │         └───────────────┬──────────────┘
│  • Tool executor (dispatch + results)  │                         │
│  • System prompt + emitted protocols   │                         │
└───────┬───────────────────────┬────────┘                        │
        │                       │                                  │
        ▼                       ▼                                  ▼
┌────────────────┐   ┌────────────────────────┐         ┌──────────────────────┐
│ Provider layer │   │        Tools           │         │   Object storage     │
│ (adapter +     │   │ read/find/list/fetch,  │◄───────►│   (file bytes)       │
│  registry +    │   │ generate, edit,        │         └──────────────────────┘
│  tiering)      │   │ research/integrations  │                  ▲
└──────┬─────────┘   └───────────┬────────────┘                  │
       │                         │                               │
       ▼                         ▼                               │
┌────────────────┐   ┌────────────────────────┐         ┌────────┴─────────────┐
│ Model providers│   │   External APIs        │         │   Relational DB      │
│ (Claude/Gemini/│   │   (+ cache table)      │◄───────►│  users, convos(events),│
│  OpenAI/…)     │   └────────────────────────┘         │  artifacts, versions, │
└────────────────┘                                      │  edits, sharing,      │
                                                        │  secrets(encrypted)   │
   [Secrets manager / env] ──► operator + user keys     └──────────────────────┘
   [Observability/tracing]  ◄── traces, tokens, events
   [Queue + workers]        ◄── heavy/async work (as scale demands)
```

The data flows: a request is authenticated, authorized, and validated at the API tier; the agent core builds context (loading durable state), runs the loop (calling the provider layer and tools), and streams an event timeline back; tools read/write object storage, the database, and external APIs; everything durable lives in the database and object storage; secrets come from the environment/manager; traces flow to observability; heavy work goes to workers via a queue when scale requires.

## How the chapters map onto it

- **API tier** — security & multi-tenancy (Ch 11), reliability at the edges (Ch 13), scaling/statelessness (Ch 16).
- **Agent core** — the loop (Ch 2), context engineering (Ch 5), prompt architecture (Ch 6), streaming/events (Ch 8).
- **Provider layer** — abstraction & tiering (Ch 4), cost/latency (Ch 14).
- **Tools** — tool design (Ch 3), retrieval strategy (Ch 7), integrations (Ch 7, 17).
- **Document pipeline** — file processing (Ch 10).
- **Data tier** — data modeling (Ch 9), storage & downloads.
- **Cross-cutting** — secrets/BYOK (Ch 12), observability/eval (Ch 15), domain/compliance (Ch 17), anatomy & vocabulary (Ch 1).

## The design checklist

Take this into a design review. Each item maps to a chapter for detail.

### Foundations
- [ ] Is the **agent loop** explicit, with a hard iteration cap and a guaranteed result per tool call? (Ch 2)
- [ ] Are **app servers stateless**, with all durable state in shared stores? (Ch 16)
- [ ] Is the **provider abstraction** in place, so swapping/adding a model is additive? (Ch 4)
- [ ] Is there a **model registry** that validates client-supplied model ids? (Ch 4)

### Context & prompts
- [ ] Is context **constructed per call** and curated to a budget, not stuffed? (Ch 5)
- [ ] Do you **reference content via tools** rather than embedding it, with short stable handles? (Ch 5, 7)
- [ ] Do you **distill/cap** large tool and API payloads before they hit context? (Ch 5, 7)
- [ ] Is there **prior-turn memory** and a **stale-content** discipline (re-fetch mutable data)? (Ch 5)
- [ ] Does the **system prompt** carry only invariant behavior, with task instructions loaded on demand? (Ch 6)
- [ ] Are there **emitted protocols** (e.g. citations) the model produces and your code parses deterministically? (Ch 6)

### Tools
- [ ] Is each tool **right-sized** to a user-level action, with a **teaching description**? (Ch 3)
- [ ] Are there **cheap/expensive** and **batch** variants where useful? (Ch 3)
- [ ] Are **schemas tight** (enums, bounds, required, field descriptions)? (Ch 3)
- [ ] Do tools with formatted output take **structured input** and format deterministically in code? (Ch 3)
- [ ] Do tool **results return useful errors** (not exceptions) the model can recover from? (Ch 3, 13)
- [ ] Are tools **scoped to the surface** where they make sense? (Ch 3)

### Data & artifacts
- [ ] Are conversations stored as **event logs**, not transcripts, for faithful replay? (Ch 9)
- [ ] Do you **persist the user message before** the turn and the outcome after? (Ch 9)
- [ ] Are artifacts **versioned and immutable**, with a current-version pointer and a `source` audit field? (Ch 9)
- [ ] Are async/multi-step flows driven by explicit **status state machines**? (Ch 9)
- [ ] Is **sharing modeled explicitly** in the schema? (Ch 9, 11)

### UX
- [ ] Is the orchestrator built to **stream an event timeline**, with the same events persisted? (Ch 8)
- [ ] Do you **hide machine protocols** from the visible stream while parsing them? (Ch 6, 8)
- [ ] Do you **flush text before tool calls** so the timeline stays chronological? (Ch 8)
- [ ] Is **reasoning surfaced or hidden** per call appropriately? (Ch 4, 8)

### Security
- [ ] Does **every protected route** authenticate via one middleware and **authorize via centralized helpers**? (Ch 11)
- [ ] Are **list/batch inputs filtered** to accessible resources before acting? (Ch 11)
- [ ] Is the agent's **blast radius bounded** by least-privilege tools, with **human-in-the-loop** for consequential actions? (Ch 11)
- [ ] Have you designed against **prompt injection** (untrusted content can't gain authority; actions authorized against the user)? (Ch 11)
- [ ] Are **user secrets encrypted** (AES-GCM, per-record IV, key from env, fail closed) and **never exposed to clients**? (Ch 12)
- [ ] Is credential resolution **user-beats-operator with fallback**, exposing status not secrets? (Ch 12)

### Reliability
- [ ] Is **all model output parsed defensively**, turning mistakes into recoverable signals? (Ch 13)
- [ ] Are transient failures **retried with capped backoff + jitter**, terminal ones not? (Ch 13)
- [ ] Are side-effecting operations **idempotent**? (Ch 13)
- [ ] Is progress **persisted for resumability**, and each dependency classified fatal vs degradable? (Ch 13)
- [ ] Do **streams fail cleanly** (error event + sentinel), with resource cleanup on disconnect? (Ch 8, 13)
- [ ] Are there **timeouts** on every external call? (Ch 13)

### Cost & performance
- [ ] Are tasks **tiered** to the cheapest capable model, with reasoning off for bulk? (Ch 4, 14)
- [ ] Do you **reduce iterations** (batching, good descriptions, discovery tools) and **parallelize** independent work? (Ch 14)
- [ ] Do you **cache external calls** and exploit **prompt caching** with a stable prefix? (Ch 9, 14)
- [ ] Is **usage metered** for per-user limits/attribution? (Ch 9, 14)

### Observability & quality
- [ ] Do you capture **per-turn traces** (context, model calls, tokens, tool calls, outcome)? (Ch 15)
- [ ] Is there an **eval set** run on every prompt/tool/model change, with deterministic checks where possible? (Ch 15)
- [ ] Do you watch **production signals** (feedback, accept/reject, failures) and feed cases back into evals? (Ch 15)

### Domain (if regulated)
- [ ] Are **claims grounded and citations precise/verbatim/machine-checkable**? (Ch 17)
- [ ] Does the agent produce the professional's **native artifacts** and **propose rather than impose**? (Ch 17)
- [ ] Is there a complete **immutable audit trail**, and **confidentiality/data-handling** appropriate to the regime? (Ch 17)
- [ ] Is **confidence calibrated** and scope respected (information vs advice)? (Ch 17)

## The build order, one more time

If you're starting fresh: skeleton & schema → provider layer → ingestion → agent loop → tools → prompt & citations → generation → editing → context assembly → auth & access → secrets → integrations → workflows → bulk extraction → storage/downloads, with observability, reliability, and cost discipline woven through from the start. (Chapter 19 of the explanations folder walks this order concretely.)

## Closing thought

Across every chapter, one belief recurs: **the model is the easy part.** The provider makes it smart; you make it useful, safe, grounded, reliable, observable, and affordable. A great agent is great *systems engineering* with a capable model at the center — the right context in front of it, well-designed tools around it, faithful records behind it, and disciplined operations beneath it. Build those, and the model will shine. Skip them, and no model can save you.

That's the whole craft. Go build something people can trust.
