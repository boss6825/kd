# Chapter 14 — Cost, Latency, and Model Tiering

Agents can be expensive and slow if built naively, and both problems compound: an agent loop makes *multiple* model calls per turn, each potentially large. Cost and latency are not afterthoughts to optimize later — they're design constraints that shape your architecture. This chapter covers where the costs and delays come from and the levers that control them.

## Where cost comes from

LLM cost is driven by **tokens** — input (everything you send) and output (everything the model generates), usually priced separately with output more expensive. For an agent, the multipliers are:

- **Loop iterations.** Each tool round-trip is another model call that re-sends accumulated context. A 5-iteration turn can cost several times a single call.
- **Context size.** Every token of context is paid for on every call. Bloated prompts and dumped tool results are paid for repeatedly across the loop.
- **Model choice.** Top-tier models can cost 10–50× a small model per token. Using a flagship model for a trivial task is the most common waste.
- **Reasoning tokens.** Thinking/reasoning generates extra (billed) tokens. Valuable when it improves a hard answer; pure waste on a bulk job.

## Where latency comes from

Latency has overlapping sources:

- **Time to first token** — how long before the model starts responding. Streaming hides this, but it still gates perceived responsiveness.
- **Generation time** — proportional to output length and model speed.
- **Loop depth** — each iteration is a serial round-trip; a deep loop is slow even if each call is fast.
- **Tool latency** — slow external APIs (some take tens of seconds) stall the turn.
- **Context size** — larger inputs take longer to process (prefill).

## The master lever: model tiering

The highest-leverage optimization is **routing each task to the cheapest model that can do it well** (Chapter 4). A three-tier scheme:

- **Top tier** for the primary interactive task where quality is paramount.
- **Mid tier** for high-volume structured work (bulk extraction, classification) where you need throughput and lower cost and a capable-enough model suffices.
- **Low tier** for trivial background tasks (titles, quick reformats, yes/no checks).

This often cuts cost dramatically *and* improves perceived speed, because the cheap models are also faster. Map every task to a tier explicitly; the default of "use the best model everywhere" is the costliest mistake.

## Turn reasoning on and off per call

Reasoning is a per-call decision (Chapters 4, 8). On for hard interactive tasks where it improves quality and the user benefits from seeing it; **off** for bulk and one-shot jobs, where you should also explicitly zero the thinking budget where the provider allows, so you actually stop paying for it. A bulk extraction over a thousand documents with reasoning left on can multiply the bill for no benefit.

## Shrink and curate context

Since context is paid for on every loop iteration, controlling it is controlling cost:

- **Reference, don't embed** (Chapter 5). Don't paste documents into the prompt; let the model fetch via tools, paying for content only when used.
- **Distill tool results.** Cap long payloads, return decision-relevant fields, offer a "get more" tool. A giant unfiltered tool result is re-sent on every subsequent iteration — paying for it repeatedly.
- **Curate history.** Use a recent window or summarization rather than re-sending an ever-growing transcript.
- **Keep prompts focused.** Load task-specific instructions on demand instead of carrying every possible instruction in the system prompt on every call.

## Reduce loop iterations

Fewer iterations means fewer calls means less cost and latency:

- **Batching tools.** "Fetch these N documents" in one call avoids N serial iterations. "Extract all columns for this document in one call" instead of one call per cell.
- **Good tool design and descriptions** so the model picks the right tool first time instead of fumbling through several.
- **Cheap discovery tools** (list/find) so the model targets what it needs instead of reading everything and iterating.

## Parallelize independent work

When sub-tasks don't depend on each other, run them concurrently rather than serially. Bulk extraction across documents is embarrassingly parallel — fan out across documents instead of looping one at a time. This doesn't reduce total token cost, but it slashes wall-clock latency, which is often what users feel. (Mind provider rate limits when fanning out; Chapter 13.)

## Cache aggressively

- **Cache external API calls** (Chapter 9): repeated identical lookups become instant and free, and you stay under rate limits.
- **Exploit provider prompt caching** where available: keeping a stable prefix (system prompt, tool definitions) constant lets the provider cache it and charge less for repeated input. Structure your context so the invariant parts come first.

## Stream to mask latency

Streaming (Chapter 8) doesn't reduce real latency but transforms *perceived* latency. A turn that takes fifteen seconds feels responsive when the user sees reasoning, then tool activity, then the answer flowing in. Showing meaningful intermediate events ("reading contract.pdf") turns dead time into visible progress. This is a cost-free latency win and one of the best UX investments you can make.

## Right-size output

Output tokens are expensive and slow. Don't ask for more than needed: cap output length for bounded tasks (a title needs a handful of tokens, not a paragraph), and instruct the model to be concise where verbosity adds no value. For structured extraction, the format constraints (Chapter 6) also keep output tight.

## Measure before optimizing

Don't guess where the cost goes — instrument it (Chapter 15). Track tokens per turn, per task type, and per model; track loop depth and tool latency. Usually a small number of patterns dominate the bill (a heavy tool result re-sent every iteration; a flagship model used for a background task). Find those and fix them, rather than micro-optimizing prompts that barely move the needle.

## Metering and limits

Commercial agents need to *bound* cost per user. Build usage metering into the data model (Chapter 9) — per-user counters, reset windows, plan tiers — so you can enforce limits and attribute spend. BYOK (Chapter 12) shifts model cost to users entirely, which is itself a cost strategy for self-hosted products.

## The cost/latency playbook

1. **Tier your models** — cheapest capable model per task. (Biggest lever.)
2. **Reasoning off** for bulk/one-shot work; on for hard interactive tasks.
3. **Shrink context** — reference don't embed, distill tool results, curate history.
4. **Cut iterations** — batch tools, good descriptions, cheap discovery tools.
5. **Parallelize** independent work to cut wall-clock time.
6. **Cache** external calls and exploit prompt caching with a stable prefix.
7. **Stream** to mask the latency that remains.
8. **Right-size output** and cap where bounded.
9. **Measure** to find the real hotspots, then meter to bound per-user spend.

Cost and latency are won the same way: send fewer tokens to cheaper, faster models, fewer times, in parallel, and show progress while it happens.

---

Next: [Chapter 15 — Observability and evaluation](chapter-15-observability-eval.md)
