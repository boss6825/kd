# Chapter 13: Reliability: Retries, Idempotency, and Failure Handling

Agents are built on components that fail routinely: model APIs time out or rate-limit, tools hit flaky external services, the model itself produces malformed output. A reliable agent isn't one where nothing fails; it's one that *expects* failure and degrades gracefully. This chapter covers the patterns that make agents dependable.

## Assume everything fails

Adopt this stance up front. In a single agent turn, any of these can go wrong:

- The model API returns an error, times out, or rate-limits.
- The model returns malformed tool arguments, or asks for a tool that doesn't exist.
- A tool throws (an external API is down, a file is corrupt).
- The stream connection drops mid-turn.
- A downstream store (database, object storage) is briefly unavailable.

A naive agent crashes the whole turn on any of these. A reliable one has a defined response to each. Reliability is the sum of these defined responses.

## Defensive parsing of model output

The model is a probabilistic component; its output will sometimes be malformed. Guard every place you consume it:

- **Tool arguments**: parse defensively; if the JSON is malformed, default to empty arguments rather than throwing, and let the tool report a useful error.
- **Unknown tool names**: if the model calls a tool you don't have, return a "that tool isn't available" result so the model can recover, rather than erroring out.
- **Emitted protocols**: if the citation/structured block is missing or malformed, proceed without it; don't make a missing trailer fatal.
- **Missing tool results**: guarantee that every tool call the model made gets *some* result back (a real one or a synthesized error). Providers require this pairing; a missing result breaks the next call (Chapter 2).

The principle: **the model's mistakes should become recoverable signals, not crashes.** Often the best recovery is to feed the error back to the model as a tool result; it will frequently adjust and try again.

## Retries with backoff

For transient failures (timeouts, rate limits, 5xx from a provider or external API), retry, but correctly:

- **Only retry idempotent or safe operations.** A read is safe to retry; an action with side effects needs idempotency first (below).
- **Exponential backoff with jitter.** Wait progressively longer between attempts, with randomization, so you don't synchronize retries into a thundering herd against a recovering service.
- **Cap attempts.** A few retries, then surface a clear failure. Infinite retries just move the hang.
- **Respect rate-limit signals.** If a provider returns a retry-after, honor it rather than guessing.

Distinguish *retryable* errors (transient) from *terminal* ones (bad request, auth failure); retrying a terminal error just wastes time.

## Idempotency for actions with side effects

Retries are only safe if repeating an operation doesn't duplicate its effect. Design side-effecting operations to be **idempotent**: safe to run more than once with the same result:

- **Use deterministic keys / upserts.** "Create or update by this key" instead of "insert," so a retried create doesn't make duplicates.
- **Make processing steps re-runnable.** A reprocessed document shouldn't spawn duplicate versions or orphaned files; check-then-act, or key derived work so re-running converges.
- **Guard at natural unique constraints.** Let the database reject a duplicate (unique constraint) rather than relying solely on application checks.

Idempotency is what turns "retrying might double-charge / double-create" into "retrying is safe," which is what makes retries usable at all.

## Persist progress for resumability

For multi-step or long-running work, **persist each unit as it completes** so a failure doesn't lose finished work:

- Save the user's input before starting (a failed turn doesn't lose their message).
- In a bulk job, write each result as it's produced, with a status field. A dropped connection or crash leaves completed units saved; a retry resumes from where it stopped by finding the still-`pending` units.

This makes long jobs robust and is the same status-field discipline from Chapter 9, used here for recovery.

## Graceful degradation

Not every failure should fail the request. Decide, per dependency, whether its failure is fatal or degradable:

- **Optional enhancement fails → degrade.** If a document's preview rendering fails, keep the document usable for text and reading; don't reject the upload.
- **Core dependency fails → fail clearly.** If the model API is down, there's no answer to give; return an honest error.
- **External enrichment fails → continue without it.** If a research API is unavailable, answer from what you have and say what's missing, rather than crashing the turn.

Map each dependency to "fatal" or "degradable" deliberately, and wrap accordingly.

## Failing within a stream

Because agent responses are streamed (Chapter 8), failures often occur *after* you've started responding. Handle it:

- Wrap the orchestration so that on error you can still emit an `error` event and a terminating sentinel, so the client shows a clean failure rather than hanging.
- Don't lose persisted progress: the pre-saved user message and any incrementally-saved results survive.
- Clean up server-side resources (abort the in-flight model call) when the client disconnects, so abandoned turns stop burning tokens.

## Timeouts and circuit breakers

- **Set timeouts** on every external call (model and tools). A call without a timeout can hang a request indefinitely. Choose timeouts appropriate to each dependency.
- **Consider circuit breakers** for dependencies that fail in waves: after repeated failures, stop calling for a cooling-off period and fail fast, rather than piling requests onto a struggling service. This protects both you and the dependency.

## Caching as reliability

Caching slow or rate-limited external calls (Chapter 9) is also a reliability tactic: a cached response means a momentary upstream outage or rate-limit doesn't break a repeat request, and you stay under provider limits that would otherwise cause failures.

## Bound the agent's own runaway behavior

Some failures come from the agent, not its dependencies. The hard iteration cap (Chapter 2) prevents an infinite tool-calling loop; repetition detection catches a stuck agent; rate limits (Chapter 11) bound abuse. These are reliability mechanisms too: they keep a confused agent from consuming unbounded resources.

## Observability closes the loop

You can't improve reliability you can't see. Log failures with enough context (which turn, which tool, which document, the error) to diagnose them, and track failure rates so you know which dependency is the weak link (Chapter 15). Reliability work is iterative: instrument, find the top failure mode, fix it, repeat.

## The reliability checklist

- Parse all model output defensively; turn its mistakes into recoverable signals.
- Guarantee one result per tool call.
- Retry transient failures with capped exponential backoff and jitter; don't retry terminal errors.
- Make side-effecting operations idempotent so retries are safe.
- Persist progress so long work is resumable and input is never lost.
- Classify each dependency as fatal or degradable, and handle accordingly.
- Emit a clean error (not a hang) when a stream fails mid-flight.
- Set timeouts on every external call; consider circuit breakers.
- Cap iterations and detect stuck loops.
- Log and measure failures so you can drive them down.

A reliable agent feels calm: when something underneath it breaks, the user gets a clear message or a degraded-but-useful result, finished work is preserved, and nothing hangs or duplicates. That calm is entirely the product of expecting failure and designing for it.

---

Next: [Chapter 14: Cost, latency, and model tiering](chapter-14-cost-latency.md)
