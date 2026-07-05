# Chapter 5 — Context Engineering and Memory

If you remember one chapter from this folder, make it this one. **Context engineering** — deciding exactly what goes into the model on each call — is the discipline that most determines whether an agent feels sharp or scattered. The model can only reason about what's in its context window; everything else may as well not exist. This chapter is about constructing that context well, and about the memory system that feeds it.

## Context is constructed, not stored

The most important reframing: context is not a thing you keep; it's a thing you **build fresh for every model call**. Each call, your orchestrator assembles:

- the system prompt (identity, rules, output protocols),
- the relevant slice of conversation history,
- the available tools,
- and injected information (what's available to act on, retrieved snippets, prior-turn summaries).

The model is stateless between calls. "Memory" is your database; "context" is the carefully-chosen subset of that memory you load into a given call. The skill is in the *choosing*.

## The context window is a budget

Every token you put in context costs money and latency, and crowds out other tokens. So treat the window as a **budget to allocate**, not a bucket to fill. The instinct to "give the model everything just in case" is wrong: it's expensive, it's slow, and — counterintuitively — it often *degrades* quality, because important details get diluted among irrelevant ones (the "lost in the middle" effect). Curate ruthlessly.

## Reference, don't embed

A powerful pattern for document- or data-heavy agents: **don't dump content into context; reference it and let the model pull what it needs via tools.** Instead of pasting five documents into the prompt, give the model short handles ("doc-0", "doc-1") and a `read_document` tool. The model reads only what the task requires.

This has three benefits:

1. **Smaller prompts** — you pay for content only when it's actually used.
2. **Forced grounding** — the model must explicitly fetch content, which makes it engage with the real text rather than half-remembered training data.
3. **Freshness** — referencing always pulls the *current* version, avoiding stale content (see below).

Use short, stable, human-meaningless-but-model-friendly labels for the handles, assigned deterministically, so the model can reference them reliably and can only reference things that actually exist.

## Distill external and tool data before it lands

When a tool returns a large payload — an API response, a long document, a database result — don't pour the raw firehose into context. **Distill it:** keep the decision-relevant fields, cap the long ones with a "there's more" flag, and offer a separate tool to fetch detail on demand. A giant unfiltered payload buries the signal and blows the budget. This is context engineering applied at the tool boundary, and it's where many agents quietly go wrong.

## The stale-content problem

A specific trap for agents that work with mutable data: if the model is allowed to "remember" content it read several turns ago, it will reason about a *stale* version after that content has changed. The fix is a discipline: require the model to re-fetch content each turn it needs it, and *tell it explicitly* that it does not retain content between turns. Yes, this costs a re-read. But for anything where correctness matters — and especially where the data can be edited — fresh-every-turn beats remembered-and-wrong. Reinforce the rule in both the system prompt and the tool descriptions.

## Prior-turn memory: lightweight continuity

The model needs to remember *what it did*, even if not the full content. A cheap, effective technique: after each turn, summarise the turn's actions into a short note ("generated draft.docx → doc-1; read source.docx → doc-0") and inject that summary into the next call. This gives the model continuity — it knows the handles for things it produced and won't redo work — without re-sending everything. It's a tiny amount of context for a large coherence gain.

## Managing long histories

Conversations grow past the context budget. Strategies, in rough order of preference:

- **Recent-window** — include the last N turns verbatim. Simple, and often enough.
- **Summarise-and-prepend** — periodically compress older turns into a running summary, keep recent turns verbatim. Preserves the gist while bounding tokens.
- **Selective recall** — store all history in the database and retrieve only the turns relevant to the current message (semantic search over history). More complex; useful for very long-lived conversations.
- **Event-log replay with selective inclusion** — store rich turn events durably, but include in context only what the current turn needs.

Whatever you choose, the principle holds: history lives in durable storage; you load a *curated slice* into context.

## Layering the context

Think of context as layers assembled in order:

1. **Standing instructions** — the system prompt: identity, universal rules, output protocols. Stable across calls.
2. **Task instructions** — anything specific to this task (a selected workflow/template, loaded on demand rather than baked into the system prompt).
3. **Situational injection** — what's available right now: the list of accessible documents, the user's current focus, retrieved snippets.
4. **History** — the curated conversation slice, plus the prior-turn summary.
5. **The current user message** — possibly annotated (e.g. mapping attachments to their handles).

Keeping these as distinct layers makes the assembly logic clear and lets you tune each independently. In particular, *loading task instructions on demand* (rather than concatenating every possible instruction into the system prompt) keeps every layer focused — the system prompt stays about universal behaviour, and task-specific detail arrives only when relevant.

## Map user references to model handles

A small but high-impact detail: when the user attaches or references something, annotate the message so the model is handed the *same handle it would use to act on it*. If the user attaches a file, prefix the message with "the user attached: doc-2 (contract.pdf)". Now the model knows that "the contract the user just mentioned" is `doc-2` and can read it directly. Without this mapping, the model has to guess which handle corresponds to the user's intent — a needless source of error.

## Memory beyond the conversation

"Memory" also includes things that persist across conversations: user preferences, organisation settings, reusable templates, and generated artifacts. These live in your data model (Chapter 9) and are loaded into context when relevant — a user's saved templates appear as available tools/workflows; their generated documents become referenceable handles. Design memory as durable state that you *selectively surface*, never as an ever-growing prompt.

## The quiet truth about agent quality

Teams obsess over model choice and prompt wording, but in practice the biggest quality wins come from context engineering: giving the model short stable handles, sweeping the right artifacts into reach, injecting a prior-turn summary, distilling tool outputs, and forcing fresh reads of mutable data. None of it is glamorous. All of it is where "it just works" actually comes from. Spend your effort here.

---

Next: [Chapter 6 — Prompt architecture](chapter-06-prompt-architecture.md)
