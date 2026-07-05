# Chapter 1 — Anatomy of an AI Agent

Before you can design an agent, you need a clear mental model of its parts. This chapter lays out that anatomy and the vocabulary the rest of the folder uses. Every term here recurs throughout, so it's worth getting precise.

## The spectrum: prompt → chatbot → agent

It helps to place "agent" on a spectrum:

- **A single prompt** takes input and returns output once. No memory, no actions. (A summariser, a classifier.)
- **A chatbot** holds a conversation — it has history — but it still only *talks*. It can't do anything in the world.
- **An agent** is a model in a loop that can *take actions* through tools, observe their results, and decide its next step, repeating until a task is done. It can read a file, call an API, write a document, and chain these together.

The defining feature of an agent is the **loop with tools**. Everything else in this folder elaborates on the pieces that make that loop useful, safe, and reliable.

## The six parts

A production agent has six conceptual parts. Hold all six in your head and most design questions become "which part does this belong to?"

### 1. The model

The LLM itself — the reasoning engine. You usually don't build this; you call it via a provider API. Key properties you'll design around: its context window (how much it can read at once), whether it supports tool/function calling, whether it can stream, and whether it exposes a reasoning/thinking mode. Treat the model as a powerful but stateless, occasionally-unreliable component you orchestrate — not as the system itself.

### 2. The loop (orchestrator)

The control structure that drives the model: call the model, see if it asked for tools, run them, feed results back, repeat until it produces a final answer. This is the agent's "main function." It owns iteration limits, streaming, and the bridge between the model's requests and your code's actions. (Chapter 2.)

### 3. The tools

The actions the agent can take, each described to the model by a schema (name, description, parameters). A tool might read a document, search a database, send an email, or generate a file. Tools are how the agent affects the world and gathers information beyond its training. The set of tools defines the agent's *capabilities*. (Chapter 3.)

### 4. The context

Everything assembled and sent to the model on a given call: the system prompt, the conversation history, the available tools, and any injected information (available documents, retrieved snippets, prior-turn summaries). Context is *constructed fresh* for each call. This is the most underappreciated part and the one that most determines quality. (Chapter 5.)

### 5. The memory / state

What persists across calls and across sessions: conversation history, generated artifacts, the status of long-running work, user preferences. The model is stateless between API calls; memory is how continuity is created. It usually lives in a database and is *selectively* loaded into context. (Chapters 5, 9.)

### 6. The surrounding system

Everything that makes the agent a real product rather than a demo: authentication and authorization, storage, streaming transport, secrets management, rate limiting, observability, error handling, and the data model. This is the bulk of the engineering, and it's where agents succeed or fail in production. (Chapters 8–18.)

## How the parts interact in one turn

Walk through a single user request to see the parts cooperate:

1. The request arrives. The **surrounding system** authenticates the user and authorizes what they can touch.
2. The **orchestrator** assembles **context**: it loads relevant **memory** (history, available artifacts), builds the system prompt, and gathers the **tools** available on this surface.
3. The orchestrator calls the **model** with that context.
4. The model streams reasoning and text, and may request **tools**. The orchestrator runs each tool (these may touch the surrounding system — storage, external APIs), and feeds results back into the **loop**.
5. The model produces a final answer. The orchestrator streams it to the user and writes the outcome into **memory**.

Every chapter in this folder is, in effect, a deep look at one of these steps.

## A crucial reframing: the model is the easy part

Newcomers assume the model is the system and the rest is glue. The opposite is closer to the truth. The provider gives you a smart model for a few cents a call. Your design work is everything around it:

- *Context engineering* — deciding what the model sees — is where most quality lives.
- *Tool design* — what actions exist and how they're described — is where most capability and reliability live.
- *The surrounding system* — auth, storage, streaming, state, observability — is where most of the *engineering effort* lives.

If you remember one thing from this chapter, make it this: **you are not building a model; you are building the system that makes a model useful, safe, and reliable.** The chapters ahead are a tour of that system, part by part.

## Two stances toward the model

Finally, two stances worth naming because they shape design:

- **The model as a smart but unreliable collaborator.** It will occasionally produce malformed output, hallucinate, or call a tool wrong. Design defensively: validate its outputs, give every tool call a defined result, and degrade gracefully. (This stance drives Chapter 13.)
- **The model as a component you can swap.** Today's best model won't be next quarter's. Decouple from any specific provider so you can change models without rewriting your agent. (This stance drives Chapter 4.)

Hold both stances and you'll make architecture decisions that age well.

---

Next: [Chapter 2 — The agent loop pattern](chapter-02-agent-loop-pattern.md)
