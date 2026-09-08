# Chapter 11 — Projects, Chats, and Context Building

This chapter explains the containers that organise work in KD — projects and chats — and, more importantly, the *context-building* step that assembles exactly what the model sees before each call. Getting this right is what separates a coherent assistant from one that forgets documents or hallucinates. The code is in `routes/chat.ts`, `routes/projectChat.ts`, and the `buildDocContext`, `buildProjectDocContext`, `enrichWithPriorEvents`, and `buildMessages` functions in `chatTools.ts`.

## Projects vs standalone chats

KD supports two modes:

- **Standalone chats** — a conversation with documents attached directly to messages. The `chatRouter` handles these. Documents are personal (project id null).
- **Project chats** — a conversation scoped to a *project*, which is a folder of documents (with subfolders) organised around a single legal matter. The `projectChatRouter` handles these, and the assistant gets extra tools (`list_documents`, `fetch_documents`, `replicate_document`) and a project-specific system-prompt appendix.

A **project** (`projects` table) has an owner (`user_id`), a name, an optional `cm_number` (a matter number), a visibility, and a `shared_with` array of emails. Documents and chats can both belong to a project. Subfolders (`project_subfolders`) form a tree for organising documents.

## The chat and message tables

- **`chats`** — id, optional `project_id`, `user_id`, `title`, created_at.
- **`chat_messages`** — id, `chat_id`, `role`, `content` (JSONB — for assistant messages this is the *event timeline* from Chapter 3), `files` (attachments), `workflow` (the selected workflow, if any), `annotations` (citations and edit data), created_at.

Storing the assistant's content as a JSONB **event array** rather than a plain string is what lets the frontend faithfully replay tool activity (doc-read chips, edit cards, download cards) on reload.

## Building document context — `buildDocContext`

Before each model call, KD must tell the model which documents are available and how to read them. `buildDocContext(messages, userId, db, chatId)` does this for standalone chats:

1. **Collect document ids from message attachments.** It scans every message's `files` for `document_id`s.
2. **Sweep prior assistant events.** Crucially, it also queries this chat's prior assistant messages and pulls `document_id`s out of `doc_created` and `doc_edited` events. Why? Because documents KD *generated* or *edited* aren't attached to a user message as a file — they only exist in the assistant's event history. Without this sweep, the model would lose access to a document it generated last turn and couldn't edit or re-read it. This is what keeps "make section 3 longer" working after a `generate_docx`.
3. **Load the documents.** It loads the collected ids, filtered to `user_id = this user` and `status = "ready"`, attaches their active version paths, and builds the two structures:
   - `docIndex` — label (`doc-0`) → `{document_id, filename, version_id, version_number}`.
   - `docStore` — label → `{storage_path, file_type, filename}`.

Labels are assigned deterministically (`doc-0`, `doc-1`, … in load order).

`buildProjectDocContext(projectId, userId, db)` is the project equivalent: it loads *all* ready documents in the project (ordered by creation), attaches version paths, and additionally builds a `folderPaths` map resolving each document's folder to a human path like "Pleadings / Drafts" by walking the subfolder tree. So in a project chat, the model sees every project document with its folder location.

## Prior-turn memory — `enrichWithPriorEvents`

The model is stateless between turns at the API level — each request resends the conversation. But KD wants the model to *remember what it just did* (so it doesn't, say, regenerate a document it already created). `enrichWithPriorEvents(messages, chatId, db, docIndex)`:

1. Loads the **most recent** assistant message's event array.
2. Builds a short bullet summary of the tool activity, mapping document ids back to their current labels: e.g.
   ```
   [Tool activity in your previous turn]
   - generate_docx → doc-1 ("nda_draft.docx")
   - read_document → doc-0 ("source_nda.docx")
   ```
3. Appends that summary to the last assistant message's content.

For `doc_replicated` events it emits one line per copy (so the model knows what each duplicate resolved to and can edit them). This lightweight memory means the model re-enters the conversation knowing the handles for everything it produced.

## Assembling the prompt — `buildMessages`

Finally, `buildMessages(messages, docAvailability, systemPromptExtra?, docIndex?)` produces the array sent to the model:

1. **System content** = `SYSTEM_PROMPT` + optional `systemPromptExtra` (project or tabular appendix) + an "AVAILABLE DOCUMENTS" block listing each label and filename (with folder path in projects) + the stale-content reminder ("You do NOT retain document content between turns… you MUST call read_document…").
2. **User/assistant turns**, with two enrichments:
   - If a user message has a selected `workflow`, the content is prefixed with `[Workflow: <title> (id: <id>)]` — the marker the system prompt watches for (Chapter 12).
   - If a user message has file attachments, the content is prefixed with `[The user attached the following document(s)…]` listing each file *with its label*, by mapping `document_id` → label via `docIndex`. So the model is handed the same handle it would use to call `read_document`.

The output is the `apiMessages` array passed to `runLLMStream`, whose first element is the `system` message.

## The project-chat system-prompt appendix

`projectChat.ts` defines `PROJECT_SYSTEM_PROMPT_EXTRA`, which is appended in project chats. It tells the model: you're in a folder of documents for one matter; use `list_documents` to discover files and `fetch_documents`/`read_document` to pull them; a document may be "displayed" in the side panel (passed as `displayed_doc`) — treat it as a hint about focus but don't assume it's the only relevant file; and it explains the `replicate_document` → `edit_document` pattern for "use this as a template" requests. This appendix is how the same agent core behaves appropriately for a multi-document workspace.

## Why context building is the real work

It's tempting to think the model is the system. But in practice, the quality of an agent is dominated by *what you put in front of the model*:

- Give it short, stable labels and it cites reliably.
- Sweep generated/edited docs into context and follow-ups work.
- Inject a prior-turn summary and it stops repeating itself.
- List available documents and remind it they're not retained, and it grounds every answer.
- Map attachments to labels and it never confuses which file the user meant.

None of this is glamorous, and all of it is in `buildDocContext` / `enrichWithPriorEvents` / `buildMessages`. This trio is where KD's "it just works" feeling actually comes from.

---

Next: [Chapter 12 — Workflows: reusable legal prompts](chapter-12-workflows.md)
