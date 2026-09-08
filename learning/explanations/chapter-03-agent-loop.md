# Chapter 3 — The Agent Loop and Tool Calling

This is the chapter that explains what makes KD an *agent* rather than a chatbot. An agent is a model wrapped in a loop that lets it take actions — call tools, observe results, and decide what to do next — until it has finished the task. KD's loop lives in two functions inside `src/lib/chatTools.ts`: `runLLMStream` (the orchestrator) and `runToolCalls` (the executor). This chapter walks through both.

## The mental model

A single user message can trigger many model "turns". The model might:

1. Decide it needs to read `doc-0`, so it emits a `read_document` tool call.
2. KD runs the tool, gets the document text, feeds it back.
3. The model reads it and decides it also needs to search case law, so it emits `search_case_law`.
4. KD runs that, feeds results back.
5. The model now has everything and writes its final prose answer plus a `<CITATIONS>` block.

Each numbered step is one iteration of the loop. The loop continues while the model keeps asking for tools, and stops when the model produces a plain answer (or a safety cap is reached). KD caps iterations at **10** (`maxIterations: 10`).

## `runLLMStream` — the orchestrator

`runLLMStream` is given everything it needs: the assembled `apiMessages`, the `docStore`/`docIndex`, the user and db handles, a `write` function for SSE output, optional `extraTools` (project or tabular tools), a `workflowStore`, the chosen `model`, the user's `apiKeys`, and a `projectId`.

### Setting up the toolset

It first composes the active tool list:

```ts
const activeTools = extraTools?.length
  ? [...TOOLS, ...WORKFLOW_TOOLS, ...extraTools]
  : [...TOOLS, ...WORKFLOW_TOOLS];
```

So every chat gets the base `TOOLS` (document reading, drafting, editing, case-law, eCourts) plus `WORKFLOW_TOOLS`, and project chats additionally get `PROJECT_EXTRA_TOOLS` while tabular chats get `TABULAR_TOOLS`. The tool catalog is the subject of Chapter 4.

### Splitting out the system prompt

The first message in `apiMessages` is the `system` role. The orchestrator pulls that out as `systemPrompt` and maps the rest into neutral `LlmMessage`s, because the LLM layer takes the system prompt as a separate parameter (Chapter 2).

### The streaming-text state machine

A surprisingly intricate part of `runLLMStream` is how it streams visible text while *hiding* the `<CITATIONS>` block from the user. The model is instructed to append a `<CITATIONS>...</CITATIONS>` block at the very end of its answer. That block is machine-readable plumbing, not something the user should see streaming by.

So the orchestrator keeps a small buffer (`visibleTailBuffer`) and a flag (`citationsOpenSeen`). As content deltas arrive in `streamVisibleContent`:

- It concatenates the new delta onto the tail buffer.
- It looks for the `<CITATIONS>` open tag. If found, it streams everything *before* the tag and then stops streaming visible text entirely (sets `citationsOpenSeen = true`).
- If not found, it streams everything except the last few characters (enough to detect a tag split across two deltas) and keeps those buffered.

This means the user sees the prose answer flow naturally and never sees the citation JSON, even though both arrive in the same token stream. The full text (including the block) is still accumulated in `fullText` for later parsing.

### The event timeline

As the model works, the orchestrator builds an `events` array — an ordered, structured record of what happened in this turn. Event types include `content`, `reasoning`, `doc_read`, `doc_find`, `doc_created`, `doc_replicated`, `workflow_applied`, and `doc_edited`. This timeline is what gets persisted as the assistant message's `content`, and it's what the frontend replays to reconstruct the conversation (showing "read NDA.docx" chips, edit cards, download cards, and so on).

There's a `flushText` helper that, whenever the model transitions from writing text to calling a tool, pushes the accumulated visible text as a `content` event — so events stay in chronological order relative to tool activity.

### The call to the model

With all that set up, it calls `streamChatWithTools` once, passing:

- `enableThinking: true` — interactive chat *does* show the reasoning stream, so thinking is on. (Bulk jobs like tabular extraction turn it off.)
- `callbacks` — `onContentDelta` accumulates and streams visible text; `onReasoningDelta` streams `reasoning_delta` SSE frames; `onReasoningBlockEnd` records the reasoning event; `onToolCallStart` flushes text and emits a `tool_call_start` frame so the UI can show "Working…" immediately.
- `runTools` — the bridge to the executor (below).

When `streamChatWithTools` returns, the orchestrator flushes any remaining text, parses citations from `fullText`, writes a final `citations` SSE frame and the `[DONE]` sentinel, and returns `{ fullText, events }`.

## `runTools` — the bridge

The `runTools` callback is how the provider-agnostic loop hands tool execution back to KD's domain logic. When the model emits tool calls, the adapter calls `runTools(calls)`. KD's implementation:

1. Flushes any pending visible text (so it appears before the tool's output).
2. Converts each `NormalizedToolCall` into KD's internal `ToolCall` shape (`{id, function: {name, arguments}}`), JSON-stringifying the input.
3. Calls `runToolCalls(...)` — the big dispatcher.
4. Translates every category of result (`docsRead`, `docsFound`, `docsCreated`, `docsReplicated`, `workflowsApplied`, `docsEdited`) into `events`.
5. Maps the tool results back by `tool_call_id`, and — importantly — **guarantees a result for every tool call**. If some tool branch failed to produce a result, it synthesises an error result (`Tool 'X' is not available.`). This matters because every provider requires a tool_result for every tool_use it sent; a missing one breaks the next request.

That last point is a production-hardening detail worth internalising: the contract with the model is "you sent N tool calls, you get N results back, no exceptions."

## `runToolCalls` — the executor

`runToolCalls` (around line 2139 of `chatTools.ts`) is a long `for` loop over the tool calls with a branch per tool name. For each call it:

- Parses `tc.function.arguments` as JSON (defensively — malformed args become `{}`).
- Dispatches on `tc.function.name`.
- Pushes a `{role: "tool", tool_call_id, content}` result.
- Records side-effect metadata into the appropriate output array (e.g. `docsRead.push({filename, document_id})`).

It also takes `write` so individual tools can stream their own SSE frames (for example, `read_workflow` emits a `workflow_applied` frame the instant it loads a workflow, before the model has even responded).

A few representative branches:

- **`read_document`** — resolves the doc label, reads the content, prepends a "citation reminder" string, and returns it as the tool result.
- **`find_in_document`** — runs the Ctrl-F-style search and reports a `total_matches` count.
- **`list_documents`** — returns the docStore entries as JSON.
- **`fetch_documents`** — reads several documents in one call, concatenating them with separators.
- **`read_workflow`** — loads the workflow prompt from the store and marks it applied.

Document generation and editing (`generate_docx`, `edit_document`, `replicate_document`) and the research tools (`search_case_law`, `read_judgment`, `find_indian_case`, etc.) are handled in their own branches and are covered in Chapters 8, 9, and 14.

## Why this design is robust

- **One model call, internal looping.** From the route's perspective there's a single `await streamChatWithTools`; the iteration is hidden inside the adapter. The orchestrator influences it purely through the `runTools` callback and the callbacks. This keeps the orchestrator declarative.
- **Events are the source of truth for UI.** Rather than trying to reconstruct what happened from the final text, KD records an explicit event for every meaningful action as it happens. Replay is then trivial and lossless.
- **Defensive at every seam.** Bad JSON args, missing tool results, and unknown tool names all have defined fallbacks. An agent that talks to an LLM must assume the LLM will sometimes produce surprising output, and degrade gracefully rather than crash.
- **The citation buffer.** Streaming UX and machine-readable trailing metadata coexist by buffering just enough to detect the boundary. It's a small state machine, but it's the difference between a clean answer and leaking JSON into the user's face.

---

Next: [Chapter 4 — The tool catalog](chapter-04-tool-catalog.md)
