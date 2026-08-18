# Chapter 2 — The Provider-Agnostic LLM Layer

KD lets each user pick which model answers their message — a Claude model, a Gemini model, or a GPT model — and it lets the operator configure which providers are even available. For this to work, the rest of the codebase must be completely ignorant of *which* provider is in play. That isolation is the job of `src/lib/llm/`. This chapter dissects it.

## The problem it solves

The three providers disagree about almost everything at the wire level:

- **Tool schema format.** OpenAI wants `{type: "function", function: {name, description, parameters}}`. Claude wants `{name, description, input_schema}`. Gemini wants `functionDeclarations` and *rejects* an empty `{type: "object", properties: {}}`.
- **Message format.** Claude uses content blocks and requires you to replay the assistant's original `tool_use` blocks. Gemini uses `parts` with `functionCall`/`functionResponse` and a `thoughtSignature` that must be echoed verbatim. OpenAI's Responses API uses `input` items and a `previous_response_id` to chain turns.
- **Streaming events.** Each emits a different event vocabulary for text, reasoning, and tool calls.
- **Thinking/reasoning.** Claude uses `thinking: {type: "adaptive"}`; Gemini uses `thinkingConfig`; OpenAI uses a `reasoning` summary.

If any of this leaked into the agent loop, adding a fourth provider would mean rewriting the whole system. Instead, KD defines **one neutral interface** and writes a small adapter per provider.

## The neutral vocabulary

`src/lib/llm/types.ts` defines the shared language every caller speaks:

- `LlmMessage` — `{ role: "user" | "assistant", content: string }`. Dead simple.
- `OpenAIToolSchema` — callers always write tools in OpenAI's function shape. (This is a pragmatic choice: it's the most widely documented format, so the tool definitions in `chatTools.ts` read naturally.)
- `NormalizedToolCall` — `{ id, name, input }`. What a tool request looks like after the provider's format is stripped away.
- `NormalizedToolResult` — `{ tool_use_id, content }`. What you hand back.
- `StreamCallbacks` — `onReasoningDelta`, `onReasoningBlockEnd`, `onContentDelta`, `onToolCallStart`. The events the orchestrator cares about.
- `StreamChatParams` — the full request: `model`, `systemPrompt`, `messages`, `tools`, `maxIterations`, `callbacks`, `runTools`, `apiKeys`, and `enableThinking`.

The key insight: **callers always speak OpenAI-style tools plus plain `{role, content}` messages; each provider translates internally.** That sentence is even written as a comment at the top of `types.ts`.

## The dispatcher

`src/lib/llm/index.ts` is tiny and is the only entry point the rest of the app uses:

```ts
export async function streamChatWithTools(params) {
  const provider = providerForModel(params.model);
  if (provider === "claude") return streamClaude(params);
  if (provider === "openai") return streamOpenAI(params);
  return streamGemini(params);
}
```

There's also `completeText` for one-shot, non-streaming, non-tool completions (used for chat-title generation and tabular extraction). It routes the same way.

`providerForModel` (in `models.ts`) is pure string inspection: ids starting with `claude` → Claude, `gemini` → Gemini, `gpt-` → OpenAI. Unknown ids throw.

## The model registry

`src/lib/llm/models.ts` is the catalogue of allowed model ids, grouped into three tiers:

- **Main** models (top-end, user-selectable per message): e.g. `claude-opus-4-7`, `gemini-3.1-pro-preview`, `gpt-5.5`.
- **Mid** models (used for tabular review): the Sonnet/Flash/mini class.
- **Low** models (title generation, lightweight extraction): the Haiku/Flash-Lite/nano class.

`resolveModel(id, fallback)` validates a requested id against the allow-list and falls back to a safe default (`DEFAULT_MAIN_MODEL = "gemini-3-flash-preview"`) if the id is unknown. This is a small but important guard: the model id arrives from the client, so it must be validated before being passed to a provider.

## The tool-schema adapters

`src/lib/llm/tools.ts` converts the canonical OpenAI tool schema into each provider's dialect:

- `toClaudeTools` maps `function.name/description/parameters` → `name/description/input_schema`.
- `toGeminiTools` maps to `functionDeclarations` and, critically, **omits the `parameters` key entirely when there are no properties**, because Gemini errors on an empty object schema.
- `normalizeSchema` walks the JSON-schema recursively, ensuring objects have a `properties` map and arrays have `items`, so Gemini doesn't choke on under-specified schemas.

This is the kind of un-glamorous compatibility code that determines whether "supports three providers" is real or aspirational.

## The three adapters

Each provider has its own file implementing the same `streamX(params): Promise<{ fullText }>` contract. All three share the *same loop structure*:

1. Convert messages and tools to the native format.
2. Loop up to `maxIterations` times:
   a. Open a streaming request.
   b. As deltas arrive, fire `onContentDelta` / `onReasoningDelta`.
   c. Collect any tool calls; fire `onToolCallStart` for each.
   d. If the turn ended *without* tool calls (or there's no `runTools`), break.
   e. Otherwise call `runTools(calls)`, append the assistant turn and the tool results to the running message list, and loop.
3. Return the accumulated text.

### Claude (`claude.ts`)

Uses the Anthropic SDK's `messages.stream`. It listens for `text` and (if `enableThinking`) `thinking` events. After `finalMessage()`, it walks the content blocks: `text` blocks accumulate into `fullText`, `tool_use` blocks become `NormalizedToolCall`s. If `stop_reason === "tool_use"`, it pushes **the original assistant content blocks** back into the message list (Claude requires this exact echo) and a `user` turn carrying `tool_result` blocks keyed by `tool_use_id`. Thinking is opted into with `thinking: {type: "adaptive"}` and `output_config: {effort: "high"}`.

### OpenAI (`openai.ts`)

There's no official SDK call here — KD talks directly to the **Responses API** (`/v1/responses`) with `fetch`, parsing the Server-Sent-Events stream by hand (`extractSseJson`). It chains turns using `previous_response_id` rather than resending the whole history, and on tool turns it sends back `function_call_output` items. Reasoning summaries are requested with `reasoning: {summary: "auto"}`. Note the careful handling of `pendingText`: when tools are present, visible text is buffered until the tool decision is known, to keep event ordering clean.

### Gemini (`gemini.ts`)

Uses `@google/genai`'s `generateContentStream`. Each streamed `part` is inspected: `part.thought` text is reasoning, ordinary `part.text` is content, and `part.functionCall` is a tool request. The subtle bit is **`thoughtSignature`**: Gemini 3 attaches a signature to reasoning/function-call parts that *must be echoed back verbatim* when you replay the model's turn, or the next request is rejected. The adapter preserves the whole part object to satisfy this. When thinking is disabled, it explicitly sets `thinkingConfig: {thinkingBudget: 0}` to skip thinking entirely and save tokens.

## Why "fullText" and not structured output

Each adapter returns just `{ fullText }`. The structure — which tools ran, what documents were touched, the citations — is reconstructed *outside* the adapter by the orchestrator, from the callback events and the tool results. This keeps the adapters as thin translators with no knowledge of KD's domain. The adapter's only job is: turn neutral input into native calls, turn native streaming into neutral callbacks, and manage the tool-call replay loop. Everything legal-specific lives a layer up.

## The payoff

Because of this layer, the agent loop in `chatTools.ts` calls exactly one function — `streamChatWithTools` — and never branches on provider. Adding a new provider means writing one `streamX.ts` file and adding ids to `models.ts`. Switching a user from Gemini to Claude mid-product is a one-field change. This is the single most leverage-dense abstraction in the codebase.

---

Next: [Chapter 3 — The agent loop and tool calling](chapter-03-agent-loop.md)
