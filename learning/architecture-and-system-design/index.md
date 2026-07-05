# Architecture and System Design for AI Agents

> A general, technology-agnostic guide to designing AI agents — the systems, patterns, trade-offs, and best practices that apply when you build an LLM-powered agent that uses tools, processes documents, and acts on a user's behalf.

This folder is the conceptual companion to [`../explanations`](../explanations/index.md). Where that folder explains *how the KD legal-assistant backend works*, this folder steps back and discusses *how to design any agent like it* — independent of KD's specific code, its legal domain, or its particular choice of database and cloud provider.

The goal is to give you a durable mental toolkit. After reading, you should be able to look at a new agent project and reason confidently about its architecture: where the boundaries should be, what to build first, which patterns earn their complexity, where the failure modes hide, and how to make it secure, reliable, observable, and affordable.

## Who this is for

Anyone designing an LLM agent: the engineer about to build their first one, the architect reviewing a design, or the technical lead deciding what to standardise across a team. The examples lean on the *kind* of agent KD is — a document-centric professional assistant that reads, drafts, edits, and researches — because that class of agent exercises nearly every interesting design decision. But the principles generalise to coding agents, support agents, research agents, and operations agents.

## What an "agent" means here

Throughout this folder, an **agent** is an LLM placed inside a loop that lets it take actions through **tools**, observe the results, and decide what to do next, until a task is complete. This is more than a chatbot (which only talks) and more than a single prompt (which only answers once). The loop, the tools, the context that's assembled for each model call, and the surrounding system that makes it safe and reliable — those are the subject of system design for agents.

## How to read this folder

The chapters move from the core agent abstractions outward to the production concerns. You can read straight through for a complete education, or jump to the chapter matching a decision you're facing.

### Chapters

1. **[Anatomy of an AI agent](chapter-01-anatomy.md)** — The mental model: model, loop, tools, context, memory, and the surrounding system. The vocabulary the rest of the folder uses.
2. **[The agent loop pattern](chapter-02-agent-loop-pattern.md)** — The central control structure, its variants (single-loop, planner-executor, multi-agent), termination, and safety caps.
3. **[Tool design](chapter-03-tool-design.md)** — How to design tools and their schemas so a model uses them correctly: granularity, descriptions, the cheap/expensive pairing, and error feedback.
4. **[Model-provider abstraction and multi-model strategy](chapter-04-provider-abstraction.md)** — Why and how to decouple from any one model, and how to route work across model tiers.
5. **[Context engineering and memory](chapter-05-context-engineering.md)** — The discipline that most determines agent quality: what goes into each model call, and how to manage history and state.
6. **[Prompt architecture](chapter-06-prompt-architecture.md)** — System prompts, layered instructions, emitted protocols, and how to make prompts maintainable.
7. **[Retrieval: RAG vs tools vs long context](chapter-07-retrieval-strategies.md)** — How to get the right information in front of the model, and when each strategy wins.
8. **[Streaming and real-time UX](chapter-08-streaming-ux.md)** — Why streaming is architectural, the event-timeline pattern, and designing for a responsive agent UI.
9. **[Data modeling for agents](chapter-09-data-modeling.md)** — Conversations as event logs, versioned artifacts, audit trails, and state machines.
10. **[Document and file processing pipelines](chapter-10-document-pipelines.md)** — Ingestion, conversion, extraction, and the synchronous-vs-asynchronous decision.
11. **[Security, auth, and multi-tenancy](chapter-11-security-multitenancy.md)** — Identity, authorization, isolation, and the special risks agents introduce (prompt injection, tool abuse).
12. **[Secrets and bring-your-own-key](chapter-12-secrets-byok.md)** — Encrypting credentials, key resolution precedence, and the BYOK pattern.
13. **[Reliability: retries, idempotency, and failure handling](chapter-13-reliability.md)** — Designing for the fact that models and tools will fail, and doing so gracefully.
14. **[Cost, latency, and model tiering](chapter-14-cost-latency.md)** — The economics of agents and the levers that control them.
15. **[Observability and evaluation](chapter-15-observability-eval.md)** — Seeing inside an agent, and measuring whether it's actually good.
16. **[Scaling and infrastructure](chapter-16-scaling-infra.md)** — From one box to many: statelessness, queues, storage, and where the bottlenecks are.
17. **[Domain-specific and regulated-industry agents](chapter-17-domain-and-compliance.md)** — Building agents for law, medicine, finance: grounding, citations, audit, and compliance.
18. **[Reference architecture and a design checklist](chapter-18-reference-architecture.md)** — A complete reference diagram and a checklist to take into your own design review.

---

## A guiding belief

The single most important idea in this folder is that **the model is the easy part**. The providers have done the hard work of making the model smart. Your job — the system design — is everything *around* the model: getting the right context in front of it, giving it well-designed tools, capturing what it does, keeping it grounded and safe, and making the whole thing reliable and affordable. A great agent is mostly great engineering with a model at the center, not a great model with some glue. These chapters are about that engineering.
