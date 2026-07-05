# Chapter 4 — Model-Provider Abstraction and Multi-Model Strategy

The model you build on today will not be the best model in six months, and the best model for one task is rarely the best for another. Both facts point to the same architectural decision: **decouple your agent from any specific model provider.** This chapter explains why, how to do it cleanly, and how to route work intelligently across model tiers.

## Why decouple

Three forces make provider abstraction worth the effort even if you launch with a single model:

1. **Models change constantly.** New versions ship monthly; prices fall; capabilities shift. If switching models means rewriting your agent, you're stuck on yesterday's model.
2. **Different tasks want different models.** A complex drafting task wants a top-tier model; generating a chat title wants the cheapest one. Bulk extraction across a thousand documents wants a fast mid-tier model. You can't serve all of these well with one hard-wired choice.
3. **Risk and economics.** A second provider is insurance against an outage, a price hike, or a policy change at any one vendor. And letting users bring their own provider key (Chapter 12) requires supporting whichever provider they chose.

## What makes providers hard to abstract

Providers disagree at the wire level about nearly everything:

- **Tool-schema format** — each wants its own shape, and some reject edge cases (an empty parameter object) that others accept.
- **Message format** — content blocks vs. parts vs. input items; some require you to replay the model's prior turn verbatim, sometimes including opaque signatures that must be echoed exactly.
- **Streaming events** — different event vocabularies for text, reasoning, and tool calls.
- **Reasoning/thinking** — different switches and different ways the reasoning is surfaced.
- **History chaining** — some resend full history; some use a server-side "previous response id."

If any of this leaks into your agent loop, every provider-specific quirk becomes load-bearing and a fourth provider means a rewrite.

## The adapter pattern

The clean solution is a **provider adapter layer**: define one neutral interface that the rest of your system speaks, and write a thin adapter per provider that translates to and from the native API. Concretely:

1. **Neutral types.** Define your own minimal vocabulary: a message (`{role, content}`), a tool schema (pick one canonical format — most teams use the widely-documented function-calling shape), a normalized tool call (`{id, name, input}`), a normalized tool result (`{id, content}`), and a set of streaming callbacks (`onText`, `onReasoning`, `onToolCall`).
2. **A dispatcher.** One function — `streamChatWithTools(params)` — that inspects the requested model id, picks the provider, and calls the right adapter. The rest of your code calls only this.
3. **One adapter per provider.** Each implements the same contract: convert neutral input to native, run the streaming tool-call loop, convert native streaming back to your neutral callbacks, and return the accumulated result. The tool-call replay loop (append model turn, append results, repeat) lives *inside* the adapter, so the provider-specific replay rules are encapsulated.
4. **Schema converters.** Small functions that turn your canonical tool schema into each provider's dialect, handling the edge cases (omit empty parameter objects, ensure arrays have item types, etc.).

The payoff: your agent loop calls exactly one function and never branches on provider. Adding a provider is one new adapter file plus registering its model ids. Switching a user from one model to another is a single field change.

## Keep the adapter thin and domain-free

A disciplined adapter knows *nothing* about your domain. It doesn't know what a "document" or a "citation" is. Its only job is: neutral input → native call → neutral streaming out → accumulated text. All the domain logic — which tools ran, what they touched, how to format the answer — is reconstructed *above* the adapter, from the callbacks and tool results. This separation keeps adapters small and interchangeable, and keeps your domain logic in one place rather than smeared across three provider files.

## A model registry and validation

Centralise the list of allowed model ids in one place — a **registry**. This does double duty:

- **Provider inference.** A simple id-prefix rule (or an explicit map) tells the dispatcher which provider owns a model.
- **Validation.** The model id often arrives from the client (the user picked it). Validate it against the registry's allow-list before passing it to a provider, and fall back to a safe default for unknown ids. Never hand an unvalidated, client-supplied model id straight to an API.

## Model tiering: the multi-model strategy

Once you can call any model trivially, route work to the *right* model. A common and effective scheme is three tiers:

- **Top tier** — the most capable (and expensive) models, for the primary interactive task where quality matters most: complex reasoning, drafting, the main chat.
- **Mid tier** — fast, capable-enough models for high-volume structured work: bulk extraction, classification, where you run many calls and need throughput and lower cost.
- **Low tier** — the cheapest, fastest models for trivial background tasks: generating a title, a quick reformat, a yes/no check.

Map tasks to tiers deliberately. Interactive chat → top tier with reasoning on. Bulk extraction → mid tier with reasoning off. Title generation → low tier. This single discipline can cut costs dramatically while *improving* perceived performance, because cheap tasks finish faster.

A nice refinement: when users bring their own keys, route background tasks to whichever provider they actually have a key for, picking that provider's cheapest model. The tiering becomes "cheapest available model of an available provider."

## Reasoning/thinking as a per-call decision

Modern models can expose a reasoning/thinking mode. Treat it as a **per-call toggle**, not a global setting:

- **On** for interactive surfaces where the user benefits from seeing the agent think, or where the task is genuinely hard.
- **Off** for bulk and one-shot jobs where the reasoning stream just burns tokens and time.

Your neutral interface should carry an `enableThinking`-style flag, and each adapter translates it to that provider's mechanism (and, when off, explicitly zeroes the thinking budget where the provider allows, to actually save the tokens).

## What you gain

With a provider abstraction and a tiering strategy in place:

- You can adopt a new model the day it ships by adding an id.
- You can A/B two models by changing a parameter.
- You can serve cost-sensitive bulk jobs and quality-sensitive interactive jobs from the same codebase.
- You can offer BYOK across providers.
- You're insulated from any single vendor's outage or price change.

This layer is among the highest-leverage abstractions in any agent. Build it early — retrofitting it after provider quirks have spread through your code is far more painful than building it up front.

---

Next: [Chapter 5 — Context engineering and memory](chapter-05-context-engineering.md)
