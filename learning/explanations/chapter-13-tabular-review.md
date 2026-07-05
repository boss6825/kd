# Chapter 13 — Tabular Review: Bulk Extraction at Scale

Reading one document is useful; extracting the same fields from a *hundred* documents into a spreadsheet is transformative. KD's **tabular review** feature does exactly that: the user defines columns (each a question like "What is the governing law?"), points them at a set of documents, and KD fills in a grid — one cell per (document, column). This chapter explains the data model and the extraction engine in `routes/tabular.ts` and the supporting tables.

## The concept

A tabular review is a matrix:

- **Rows** = documents.
- **Columns** = extraction prompts, each with a `name`, an instruction, and an output `format`.
- **Cells** = the extracted value for one column from one document, plus citations.

Think of it as "run this set of questions against every contract and give me a table I can scan." It's how a lawyer reviews a deal room of fifty agreements without reading each end to end.

## The tables

- **`tabular_reviews`** — the review itself: `id`, optional `project_id`, `user_id`, `title`, `columns_config` (JSONB defining the columns), `document_ids` (JSONB list of rows), optional `workflow_id`, `practice`, and a `shared_with` email array.
- **`tabular_cells`** — one row per `(review_id, document_id, column_index)`: the extracted `content`, `citations` (JSONB), and a `status` (`pending`/`generating`/`done`/`error`).
- **`tabular_review_chats`** and **`tabular_review_chat_messages`** — a chat surface scoped to a review, so users can ask follow-up questions about the populated grid.

The `columns_config` being data (not code) means a review's structure is fully user-defined, and can be seeded from a workflow with a `columns_config` (Chapter 12).

## Column formats

A column has a `format` that constrains the model's output. `formatPromptSuffix(format, tags)` in `tabular.ts` turns the format into a precise instruction appended to the column prompt. The formats include:

- **`bulleted_list`** — the summary must be a markdown bullet list, each item prefixed `* `.
- **`number`**, **`percentage`**, **`monetary_amount`** — a single value only, no explanation.
- **`currency`** — currency codes wrapped in `[[USD]]` style brackets.
- **`yes_no`** — `[[Yes]]` or `[[No]]`, and the `reasoning` field *must* include an inline citation `[[page:N||quote:…]]`.
- **`date`** — a date in `DD Month YYYY` form (or a range), again with a mandatory citation in `reasoning`.
- **tag formats** — exactly one tag from a provided list, wrapped in `[[ ]]`, with a mandatory citation.

The double-square-bracket convention (`[[Yes]]`, `[[USD]]`, `[[page:N||quote:…]]`) is a parsing-friendly format the frontend can reliably extract from the model's JSON, similar in spirit to the `<CITATIONS>` protocol but inline per cell.

## The extraction engine

The interesting engineering is the `/generate` flow, which fills the grid. The structure (visible in the route) is:

1. **Iterate documents** (rows). The route processes documents, and uses `Promise.all` to run extraction across documents concurrently — bulk extraction is embarrassingly parallel, so KD fans out.
2. **One LLM call per document, all columns at once.** Rather than one model call per cell (which would be N×M calls), KD issues a single call per document that extracts *all* columns for that document, with the model streaming "one JSON line per column." This is a big cost and latency win: M columns cost one call per document, not M.
3. **Stream cell updates.** As each column's result arrives, the route:
   - Marks the cell `generating` and emits a `cell_update` SSE frame (so the UI shows the cell spinning).
   - On success, writes the result to `tabular_cells` (`status: done`, with content and citations) and emits a `cell_update` with the value.
   - On error, sets the cell `status: error` and emits accordingly.
4. **Persist incrementally.** Each cell is saved as it completes, so a long extraction is resumable and partial results are never lost.

The model used for tabular extraction is the user's configured **mid-tier** model (`tabular_model` on the profile, defaulting to `gemini-3-flash-preview`), resolved by `getUserModelSettings`. Tabular extraction also runs with **thinking disabled** — it's a bulk, structured-output job where the reasoning stream would just waste tokens and time, exactly the case the `enableThinking: false` path in the LLM layer was built for (Chapter 2).

## Column-prompt authoring

The route can also *write* column prompts for the user. There's a helper that calls `completeText` with an instruction: *"You write high-quality column prompts for legal tabular review workflows. Return only valid JSON {prompt: string}. The prompt must focus solely on what to extract — never on how to format."* So a user can describe a column in plain language and KD turns it into a well-formed extraction prompt — and the *formatting* concern stays separate (handled by `formatPromptSuffix`). This separation of "what to extract" from "how to format" is a clean design that keeps prompts reusable across formats.

## The follow-up chat

Once a grid is populated, the user can open a chat on the review. That chat uses the same `runLLMStream` engine but with `TABULAR_TOOLS` (the `read_table_cells` tool) and a `tabularStore` holding the columns, documents, and extracted cells. So the model can answer "which of these contracts have a New York governing law?" by reading the already-extracted cells rather than re-reading every document — fast and cheap. This reuse of the core agent loop for a different surface is a recurring pattern: the loop is generic, the *tools and store* specialise it.

## Access control

Tabular reviews can be shared two ways (handled by `ensureReviewAccess` in `access.ts`, Chapter 15): indirectly through their project (anyone with project access), or directly via the review's own `shared_with` email list (for standalone reviews). And `filterAccessibleDocumentIds` guards the document ids a caller can attach to a review, so a user can't sneak arbitrary document UUIDs into a review they share access to.

## Why tabular review is architecturally elegant

- **It reuses everything.** Documents, versions, storage, the LLM layer, the agent loop, workflows, access control — tabular review is mostly *composition* of pieces built for chat. The only genuinely new code is the grid model and the fan-out extraction.
- **It optimises for the bulk case.** Concurrency across documents, one call per document for all columns, thinking off, mid-tier model — every choice is tuned for throughput and cost, in deliberate contrast to the latency-and-quality tuning of interactive chat.
- **Structured output is enforced, then parsed.** The `format` suffixes and `[[ ]]` conventions make the model's output machine-readable, so a grid of typed values (numbers, dates, tags, yes/no with citations) falls out reliably.

---

Next: [Chapter 14 — Legal research integrations](chapter-14-legal-research.md)
