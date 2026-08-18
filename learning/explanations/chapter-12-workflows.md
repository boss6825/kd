# Chapter 12 — Workflows: Reusable Legal Prompts

Lawyers do the same kinds of analysis over and over: summarise a credit agreement, generate a conditions-precedent checklist, review a shareholder agreement. A **workflow** in KD is a saved, reusable prompt template for one of these recurring tasks. This chapter explains how workflows are defined, stored, loaded, shared, and applied. The code is in `src/lib/builtinWorkflows.ts`, `routes/workflows.ts`, the `buildWorkflowStore`/`WORKFLOW_TOOLS` parts of `chatTools.ts`, and the `workflows`/`workflow_shares`/`hidden_workflows` tables.

## What a workflow is

A workflow is essentially three fields: an `id`, a `title`, and a `prompt_md` — a markdown instruction block that tells Mike exactly what to produce. There are two origins:

- **Built-in workflows** (`builtinWorkflows.ts`) — shipped with the product, available to everyone.
- **User workflows** (`workflows` table) — created by users, optionally shared with colleagues by email.

## The built-in workflows

`BUILTIN_WORKFLOWS` is an array of three carefully-written templates:

1. **Generate CP Checklist** (`builtin-cp-checklist`) — instructs the model to read a credit/financing document and produce a Conditions Precedent checklist *as a downloadable Word document* via `generate_docx`, in **landscape**, with one table per category (Corporate, Financial, Legal, Security) and exactly four columns (Index, Clause Number, Clause, Status), Status left blank for the user. It even includes a self-check step ("double-check that every table has exactly the four columns…").
2. **Credit Agreement Summary** (`builtin-credit-summary`) — a 21-point summary template covering lenders, borrowers, guarantors, facilities, interest, covenants, events of default, governing law, and more, instructing the model to quote clause references and flag non-market terms. This one is delivered *inline* (not as a docx) unless the user asks otherwise.
3. **Shareholder Agreement Summary** (`builtin-sha-summary`) — a 15-point template covering share classes, board governance, reserved matters, pre-emption, drag/tag-along, anti-dilution, deadlock, etc., delivered as a downloadable Word document.

Reading these templates is itself a lesson in domain prompt design: they're long, specific, numbered, and they tell the model both *what to extract* and *how to deliver it*. The expertise of an experienced finance lawyer is encoded directly into the `prompt_md`.

## Storing user workflows

The `workflows` table holds user-created workflows: `id`, `user_id`, `title`, `type` (e.g. `"assistant"` for chat workflows vs tabular workflows), `prompt_md`, `columns_config` (for tabular workflows), `practice`, and an `is_system` flag. Two companion tables manage visibility:

- **`workflow_shares`** — shares a workflow with another user by email, with an `allow_edit` flag. Unique per (workflow, email).
- **`hidden_workflows`** — lets a user hide a built-in or shared workflow they don't want cluttering their list.

The `workflowsRouter` (`routes/workflows.ts`) provides CRUD over these — creating, updating, sharing, hiding, and listing workflows the user can see.

## Loading the workflow store — `buildWorkflowStore`

Before each chat, `buildWorkflowStore(userId, userEmail, db)` assembles a `WorkflowStore` (a `Map<id, {title, prompt_md}>`) that the workflow tools read from. It layers three sources, last-write-wins:

1. **Seed built-ins** — every `BUILTIN_WORKFLOWS` entry.
2. **Overlay user-owned** assistant workflows (those with a `prompt_md` and `type = "assistant"`).
3. **Overlay shared** assistant workflows — it looks up `workflow_shares` for the user's email, collects the shared workflow ids, loads those, and adds them.

The result is every workflow this specific user can run, keyed by id, ready for the tools.

## The workflow tools

Two tools (in `WORKFLOW_TOOLS`, added to every chat) expose the store to the model:

- **`list_workflows`** — returns each available workflow's id and title.
- **`read_workflow`** — given an id, returns that workflow's full `prompt_md`. When called, it also immediately emits a `workflow_applied` SSE frame and records the application, so the UI can show "Applied: Credit Agreement Summary" before the model even responds.

## How a workflow gets applied

The application flow ties together the prompt, the message assembly, and the tools:

1. **The user selects a workflow** in the UI alongside their message. The frontend sends the message with a `workflow: {id, title}` field.
2. **`buildMessages` injects the marker.** As covered in Chapter 11, a user message with a workflow is prefixed with `[Workflow: <title> (id: <id>)]`.
3. **The system prompt commands application.** The WORKFLOWS section of `SYSTEM_PROMPT` says: when a message begins with that marker, you MUST immediately call `read_workflow` with that exact id and follow the loaded instructions for this turn, before any other output — and don't ask the user to confirm, because the selection *is* the instruction.
4. **The model calls `read_workflow`**, gets the `prompt_md`, and executes it — reading the relevant documents, then producing the summary or generating the checklist as the template dictates.

So a workflow is, mechanically, just a stored prompt that gets loaded on demand and injected via a tool. But the indirection is valuable: the heavy, expert-written instructions don't bloat the system prompt or the user's message; they're loaded only when needed, and they can be created, edited, and shared by users without touching code.

## Why this design

- **Separation of the standing prompt from task prompts.** The system prompt defines Mike's universal behaviour; workflows define task-specific behaviour, loaded lazily. This keeps every prompt focused.
- **Users as prompt authors.** Because workflows are data, a power user (or a firm's knowledge-management team) can encode their house style and checklists without engineering involvement.
- **Sharing models real teams.** `workflow_shares` and `hidden_workflows` reflect how a firm actually works: one person builds the "our standard NDA review" workflow and shares it; others can use or hide it.
- **The same machinery serves tabular reviews.** Workflows with `columns_config` drive the tabular feature (Chapter 13), so "a saved analysis template" is one concept across both chat and spreadsheet surfaces.

---

Next: [Chapter 13 — Tabular review: bulk extraction at scale](chapter-13-tabular-review.md)
