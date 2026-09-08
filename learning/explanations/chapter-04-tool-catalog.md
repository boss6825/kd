# Chapter 4 — The Tool Catalog

Tools are how KD *does* things rather than just talking about them. A tool is a function the model can call, described to the model by a JSON schema. KD defines its tools as OpenAI-style schemas in `src/lib/chatTools.ts`, grouped into several exported arrays. This chapter is a guided tour of every tool, why it exists, and what makes a good tool definition.

## How tools are grouped

KD splits its tools into arrays so different chat surfaces can offer different capabilities:

- **`TOOLS`** — the base set available in every chat: `read_document`, `find_in_document`, `generate_docx`, `edit_document`, `search_case_law`, `read_judgment`, `get_judgment_meta`, `find_indian_case`, `get_indian_case_order_analysis`.
- **`WORKFLOW_TOOLS`** — `list_workflows`, `read_workflow`. Added to every chat.
- **`PROJECT_EXTRA_TOOLS`** — `list_documents`, `fetch_documents`, `replicate_document`. Added only in project chats, where there's a folder of documents to browse.
- **`TABULAR_TOOLS`** — `read_table_cells`. Added only in the tabular-review chat surface.

Recall from Chapter 3 that `runLLMStream` composes the active list as `[...TOOLS, ...WORKFLOW_TOOLS, ...extraTools]`. The route decides which extras to pass.

## The document tools

### `read_document`
> "Read the full text content of a document attached by the user. Always call this before answering questions about, summarising, or citing from a document."

Takes a single `doc_id` (a chat-local label like `doc-0`). This is the most-used tool. The description deliberately commands "Always call this before…" because the system prompt also tells the model it does not retain document content across turns — the two reinforce each other.

### `find_in_document`
> "Search for specific strings inside a document — a Ctrl+F equivalent."

Takes `doc_id`, `query`, optional `max_results` and `context_chars`. Matching is case-insensitive and whitespace-tolerant. This exists so the model can do *targeted* lookups (find a clause title, a party name) without paying the token cost of reading an entire 80-page agreement. Good agents give the model both a "read everything" and a "find the needle" tool, because the right choice depends on the task.

### `list_documents` (project only)
Returns every document in the project with its `doc_id`, filename, and type. The model calls this to discover what's available before deciding what to read.

### `fetch_documents` (project only)
Reads *multiple* documents in one call (`doc_ids: string[]`). This is a batching optimisation — instead of N round-trips of `read_document`, the model can pull several files at once.

### `replicate_document` (project only)
> "Make byte-for-byte copies of an existing project document as new project documents."

Takes `doc_id`, optional `count` (max 20), optional `new_filename`. This supports the "use this NDA as a template, give me three drafts to adapt" pattern: it duplicates the file (preserving formatting), creates new document rows, and returns fresh `doc_id` slugs the model can immediately edit. Crucially it copies *bytes*, so all the original Word formatting survives — far better than regenerating from scratch.

### `generate_docx`
> "Generate a Word (.docx) document from structured content."

This is the richest schema in the catalog. It takes a `title`, an optional `landscape` flag, and a `sections` array. Each section can have a `heading` (with a `level` of 1–3), `content` prose, a `pageBreak` flag, and/or a `table` (with `headers` and `rows`). This structured shape is what lets KD apply legal numbering and formatting deterministically (Chapter 8) rather than trusting the model to format raw text.

### `edit_document`
> "Propose edits to a user-attached .docx as tracked changes. Each edit is a precise, minimal substitution of specific words/characters, NOT a whole-line or paragraph replacement."

Takes `doc_id` and an `edits` array. Each edit has `find`, `replace`, `context_before`, `context_after`, and an optional `reason`. The `context_before`/`context_after` fields (~40 chars each) are how an edit is anchored unambiguously in the document. The result is Word tracked changes the user can accept or reject (Chapter 9). The schema's description is doing heavy lifting here — it teaches the model to make surgical edits, not blunt replacements.

## The legal-research tools

### `search_case_law`
Searches Indian Kanoon for precedents. Takes a `query` (supporting phrase quoting and `ANDD`/`ORR`/`NOTT` operators and embedded filters), plus `doctypes`, `fromdate`, `todate`, `pagenum`. Returns a list of judgments, each with a `judgment_id` to drill into.

### `read_judgment`
Fetches the full text and metadata of one judgment by `judgment_id`, plus lists of cases it cites and cases that cite it (`max_cites`, `max_citedby`).

### `get_judgment_meta`
Metadata only — cheaper when you just need to verify a citation exists without pulling the full text. The presence of a "cheap version" of a tool is a deliberate cost optimisation.

### `find_indian_case`
A *unified* entry point to the live eCourts system. If given a 16-character `cnr` it returns the full case record; otherwise it searches by `query` and/or named filters (`petitioner`, `respondent`, `advocate`, `judge`, `court_code`, `case_status`, filing dates, `page`) and returns matching cases each with a CNR to drill into. One tool, two modes — the description spells out the search-then-drill workflow.

### `get_indian_case_order_analysis`
Pulls a rich AI analysis of a specific court order from a case (executive summary, outcome, statutes, ratio decidendi, reasoning, directions). Takes `cnr`, `order_filename`, and a `wait_for_analysis` flag that controls whether to poll for the (slow, 10–60s) analysis to be ready.

## The workflow tools

### `list_workflows`
Returns every workflow available to the user (built-in + owned + shared) with id and title.

### `read_workflow`
Loads the full prompt of one workflow by id. The system prompt instructs the model that when a message begins with a `[Workflow: ...]` marker, it must immediately call `read_workflow` with that id and follow the loaded instructions (Chapter 12).

## The tabular tool

### `read_table_cells`
Lets the tabular-review chat assistant read already-extracted cell values, optionally filtered by `col_indices`/`row_indices`. This lets a user ask follow-up questions about a populated review ("which contracts have a governing law of New York?") without re-extracting.

## What makes these tool definitions good

Reading the catalog as a whole, a few principles stand out — they're worth copying:

1. **Descriptions teach behaviour, not just syntax.** `edit_document` doesn't just say "edits a document"; it says "minimal substitution… NOT a whole-line replacement" and "anchor each edit with short before/after context." The description is a mini prompt.
2. **Tools encode the intended workflow.** `search_case_law` → `read_judgment`, and `find_indian_case` (search) → `find_indian_case` (drill) → `get_indian_case_order_analysis`. The descriptions explicitly chain the tools so the model learns the sequence.
3. **Cheap and expensive variants coexist.** `get_judgment_meta` vs `read_judgment`; `find_in_document` vs `read_document`. Giving the model a low-cost option for the common case saves tokens and latency.
4. **Schemas are tight.** Enumerated formats, `minimum`/`maximum` bounds (`count` max 20), and `required` arrays constrain what the model can send, reducing malformed calls.
5. **Surface-appropriate scoping.** A general chat can't `list_documents` because there's no folder; a tabular chat gets `read_table_cells` because there's a table. Tools appear only where they make sense, which keeps the model focused.

## How a tool definition becomes a model-callable function

To close the loop with Chapter 2: these OpenAI-style schemas are passed as `tools` to `streamChatWithTools`, which hands them to `toClaudeTools`/`toGeminiTools`/`toResponseTools` for translation. So the same array literal in `chatTools.ts` works across all three providers. Adding a tool is purely additive: write the schema, add a branch in `runToolCalls`, and every provider can call it.

---

Next: [Chapter 5 — The system prompt and prompt engineering](chapter-05-system-prompt.md)
