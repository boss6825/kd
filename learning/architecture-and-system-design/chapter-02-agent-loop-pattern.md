# Chapter 2 — The Agent Loop Pattern

The agent loop is the heart of every agent. This chapter examines it as a pattern: its essential shape, its variants, how it terminates, and the safety properties you must build in. Get the loop right and the rest of the system has a solid spine to hang off.

## The essential loop

Stripped to its core, every agent loop is:

```
messages = [system_prompt, ...history, user_message]
repeat up to N times:
    response = model.call(messages, tools)
    if response has no tool calls:
        return response.text          # the model is done
    results = run(response.tool_calls)  # execute the actions
    messages.append(response)           # record what the model did
    messages.append(results)            # record what the tools returned
```

That's it. The model is given the conversation and the tool catalog; it either answers or asks for tools; if it asks, you run them, append both the request and the results, and call again. The loop ends when the model answers without requesting tools (or a cap is hit).

This simple structure is deceptively powerful: by chaining tool calls, the model can read a file, use what it learned to search an API, use *those* results to draft a document, and finally summarise — all from a single user message, with the loop carrying it through.

## Why both the request and the result must be appended

A subtlety that trips up first implementations: when the model requests a tool, you must append **both** the model's tool-request turn *and* the tool-result turn before the next call. The providers require this pairing — the model needs to see "I asked for X, and X returned Y" to continue coherently. Most provider APIs also require that *every* tool call in a turn gets a corresponding result. Skipping a result, or mismatching ids, breaks the next call. A robust loop therefore guarantees a result for every call, synthesising an error result if a tool failed to produce one.

## Termination and the safety cap

The loop needs two stopping conditions:

1. **Natural termination** — the model produces a final answer with no tool calls.
2. **A hard iteration cap** — a maximum number of loop turns (commonly 5–15).

The cap is non-negotiable. Without it, a confused model can loop forever — calling a tool, getting a result it doesn't like, calling again, ad infinitum — burning tokens and money. The cap converts "infinite loop" into "bounded, eventually-terminating process." When the cap is hit, return whatever the model has produced so far (or a graceful "I wasn't able to complete this") rather than erroring.

A second guard worth considering: detect **non-productive loops** — the same tool called with the same arguments repeatedly — and break early. The model is signalling it's stuck.

## Where the loop lives

A key design decision: does *your* orchestrator drive the loop, or does the provider's SDK? There are two common arrangements:

- **You own the loop explicitly** — your code does the `repeat` and decides when to stop. Maximum control and visibility; you can inject logic between turns.
- **The provider SDK owns the loop** and calls back to you for tool execution — you supply a "run these tools" function and the SDK iterates internally.

A clean hybrid (and a good default) is to own a thin loop that delegates tool execution through a callback, so your orchestrator stays declarative while the provider-specific iteration is encapsulated. Either way, the *control* — the cap, the termination logic, the event recording — should be yours, not buried in a library.

## Variants of the loop

The basic single loop scales surprisingly far, but you'll encounter variants:

### Single-loop (ReAct-style)

One model, one loop, tools available. The model reasons and acts in an interleaved stream. This is the workhorse and is sufficient for most agents — including document assistants. Start here; don't reach for more complexity until you've proven you need it.

### Planner–executor

A first model call produces a *plan* (a list of steps), then a loop executes each step, possibly with its own sub-loops. Useful when tasks are long and benefit from explicit decomposition, or when you want the plan visible/editable by the user. The cost is added complexity and latency; the benefit is structure and steerability.

### Multi-agent

Several specialised agents (each its own loop, prompt, and tools) coordinate — a "researcher" hands off to a "writer," or a "supervisor" routes work to "workers." Powerful for genuinely heterogeneous tasks, but it multiplies cost, latency, and failure modes, and the coordination overhead is real. Most products that *think* they need multi-agent actually need better tools and context in a single loop. Reach for it only when sub-tasks are truly independent and benefit from isolation.

### Reflection / critique loops

After producing output, the agent critiques its own work and revises. Improves quality on hard tasks at the cost of extra calls. Often implemented as an explicit "now check your answer" step rather than a separate agent.

## The event timeline

A loop that just returns final text throws away everything interesting that happened along the way. A production loop should emit an **ordered event timeline** as it runs: "model reasoned," "called tool X," "tool X returned," "model wrote text." This timeline is gold:

- It drives a rich UI (showing tool activity as it happens — Chapter 8).
- It's the durable record of the turn (persisted as the conversation's content — Chapter 9).
- It's the raw material for observability and debugging (Chapter 15).

Design the loop to record an explicit, typed event for every meaningful action, in order. Don't try to reconstruct what happened from the final text afterward — capture it as it occurs.

## Statelessness within, state at the edges

The loop itself is best kept **stateless** — it takes the assembled context in, runs, and returns a result plus events. Persistence happens at the edges: load history *before* the loop, save the outcome *after*. This keeps the loop a pure function of its inputs, which makes it testable, retryable, and easy to reason about. (More in Chapter 9.)

## Common failure modes to design against

- **Runaway iteration** → the hard cap.
- **Stuck loops** (same call repeated) → repetition detection.
- **Missing tool results** → guarantee one result per call.
- **Malformed tool arguments** → parse defensively, default to empty, return a useful error the model can recover from.
- **Tool exceptions** → catch them and feed the error back as a tool result, so the model can adapt rather than the whole turn crashing.

The theme: the loop is where the model's unreliability meets your code, so the loop is where you must be most defensive.

---

Next: [Chapter 3 — Tool design](chapter-03-tool-design.md)
