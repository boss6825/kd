# Chapter 15: Observability and Evaluation

You cannot improve what you cannot see, and agents are unusually opaque: their behavior is probabilistic, multi-step, and dependent on context you assembled dynamically. This chapter covers two related disciplines, **observability** (seeing what an agent did) and **evaluation** (measuring whether it's any good). Together they turn "it seems to work" into "we know it works and we know when it regresses."

## Why agents are hard to observe

A traditional request is mostly deterministic: same input, same path, same output. An agent turn is none of those. The same prompt can take different paths (different tools, different order), the model's output varies run to run, and the quality is subjective ("was that a good answer?"). So agent observability needs to capture not just *that* something happened, but the full *trajectory*: what context went in, what the model decided, which tools ran with what inputs and outputs, and what came out.

## What to capture: the trace

The unit of agent observability is the **trace**: the complete record of one turn. A good trace includes:

- **Inputs**: the assembled context (system prompt version, the messages, the available tools), the user, the model and settings.
- **Each model call**: the request, the response, token counts (input/output/reasoning), latency, and finish reason.
- **Each tool call**: name, arguments, result (or error), and duration.
- **The loop shape**: how many iterations, in what order.
- **Outputs**: the final answer, emitted structured data (citations), and any artifacts produced.
- **Outcome**: success/failure, and any error details.

The **event timeline** you already build for streaming and persistence (Chapters 8, 9) is most of this for free: it's a structured, ordered record of the turn. Observability often means *also routing that timeline (plus the model-call metadata) to a tracing system* where you can search, aggregate, and inspect it.

## Tooling

Options range from rolling your own (structured logs keyed by a trace id, queryable in your log stack) to dedicated **LLM-observability platforms** that understand traces, spans, token costs, and prompt versions, and give you UIs to drill into a single turn or aggregate across many. Whatever you use, ensure:

- **A correlation id** threads through the whole turn (and ideally the whole conversation) so you can reconstruct it end to end.
- **Token and cost capture** per call, so you can attribute spend (Chapter 14).
- **Searchability** by user, model, tool, outcome, so you can answer "which tool fails most?" or "what did this user's failing turn look like?"

## Logging discipline

Even with a fancy platform, basic logging hygiene matters:

- **Structured, not free-text.** Log key-value fields (turn id, tool, document id, duration) so logs are queryable.
- **Context on every error.** A failure log should say which turn, which tool, which resource, and the error: enough to diagnose without reproducing.
- **Never log secrets** (Chapter 12) or sensitive document content; scrub them.
- **Log decisions, not just outcomes.** "Routed to mid-tier model because user has only a Gemini key" is more useful than "called Gemini."

## From observability to evaluation

Observability tells you what happened; evaluation tells you whether it was *good*. Evaluation is how you avoid the trap where a prompt tweak fixes one case and silently breaks five others.

### Build an eval set

Curate a set of representative inputs with known-good expectations: realistic user messages (and documents) paired with what a correct response looks like. Cover the common cases, the tricky ones, and past bugs (regression cases). This set is your safety net; run it whenever you change a prompt, a tool, or a model.

### What to measure

Agent quality is multi-dimensional. Useful metrics:

- **Task success**: did it accomplish the goal? (Often the hardest to measure automatically; may need a rubric.)
- **Grounding / faithfulness**: are factual claims actually supported by the source? For document agents, are citations correct (right location, verbatim quote)? This is checkable: verify each cited quote appears at the cited location.
- **Format compliance**: did it emit the required structured protocols correctly (parseable citation block, valid cell formats)? Deterministically checkable.
- **Tool-use correctness**: did it call the right tools, with valid arguments, in a sensible order? Did it avoid unnecessary calls?
- **Refusal/safety behavior**: does it refuse what it should and not over-refuse?
- **Cost and latency**: tokens and time per task (a quality regression can hide as a cost regression).

### How to grade

- **Deterministic checks** where possible: does the citation block parse? Do cited quotes match the source? Did it call the expected tool? These are cheap and reliable; prefer them.
- **LLM-as-judge** for subjective quality: use a model to grade an answer against a rubric. Useful at scale, but calibrate it (judges have biases) and spot-check against human judgment.
- **Human review** for the highest-stakes or most subjective cases, and to validate your automated graders.

### Run evals as part of change management

Treat prompts, tool definitions, and model choices as code: when you change them, run the eval set and compare to the baseline. A change that improves your target case but regresses others should be caught *before* it ships, not by users. This is the agent equivalent of a test suite, and it's what lets you iterate on a probabilistic system with confidence.

## Online signals

Beyond offline evals, watch production:

- **Explicit feedback**: thumbs up/down, corrections, regenerations. Aggregate by feature and model.
- **Implicit signals**: did the user accept the agent's proposed edit or reject it? Did they re-ask the same thing (a sign the first answer missed)? Did they abandon mid-turn?
- **Failure and degradation rates**: from your traces, which tools and dependencies fail most, and is it trending.

These tell you what your eval set can't: how the agent performs on the messy distribution of real use. Feed surprising production cases back into the eval set so it keeps reflecting reality.

## The virtuous loop

Observability and evaluation form a loop: traces show you what's happening and surface failures; you turn notable cases into eval examples; evals catch regressions when you change things; production signals reveal new gaps; those become new eval cases. An agent without this loop drifts; every change is a gamble. An agent with it improves steadily and safely. For probabilistic systems, this discipline isn't optional polish; it's how you engineer quality at all.

---

Next: [Chapter 16: Scaling and infrastructure](chapter-16-scaling-infra.md)
