# Chapter 19 — Putting It Together: Build Your Own Lawyer Agent

This final chapter is a synthesis. Having dissected every part of KD, we now assemble the lessons into a from-scratch blueprint for building a comparable agent — one that helps lawyers (or any domain professional working with documents) read, draft, edit, and research. Treat it as a checklist and a build order. Each step references the chapter where KD does the same thing, so you can return for detail.

## The build order

### 1. Stand up the skeleton (Chapter 1)

Start with an Express + TypeScript server. Add `helmet`, `cors` locked to your frontend origin, `express.json()` with a generous limit, and rate limiters per route class. Mount routers for the resources you'll have (chats, documents, projects). Add a `/health` endpoint. Wire environment config. This is pure plumbing — keep it boring.

### 2. Choose a database and define the schema (Chapter 18)

Pick Postgres and a typed query builder (KD uses Drizzle). Model, at minimum:

- `users` (or use your auth library's tables),
- `documents` + `document_versions` (separate bytes-location from identity — this pays off immediately),
- `chats` + `chat_messages` (store assistant content as **JSON events**, not text),
- key/secret tables if you'll support BYOK.

Add the version `source` enum and the edit-status enum early; they shape everything downstream.

### 3. Build the provider-agnostic LLM layer (Chapter 2)

Before writing any agent logic, build the abstraction that hides your model providers. Define neutral types (`LlmMessage`, `NormalizedToolCall`, `NormalizedToolResult`, `StreamCallbacks`), a `streamChatWithTools(params)` dispatcher, and one adapter per provider that implements the tool-call replay loop and normalises streaming. Write the tool-schema converters. **Do this first** — retrofitting multi-provider support later is painful, and even if you launch with one provider, the seam keeps your agent loop clean.

### 4. Implement document ingestion (Chapter 6)

Accept uploads (validate types), store bytes in object storage under user-scoped keys, render a display PDF (LibreOffice for Office formats), extract a structure outline, and run a `processing → ready → error` status machine. Create the V1 version row. Don't load anything but `ready` documents into context.

### 5. Build the agent loop (Chapter 3)

Write the orchestrator: split out the system prompt, call `streamChatWithTools` with callbacks that stream content/reasoning and an event timeline, and a `runTools` bridge to your tool executor. Guarantee a result for every tool call. Stream via SSE. Build the executor as a `switch` over tool names. Cap iterations.

### 6. Define your tools (Chapter 4)

Start with the essentials: `read_document`, `find_in_document`, and (for collections) `list_documents`/`fetch_documents`. Write descriptions that *teach behaviour* ("always read before answering"; "minimal substitution, not whole-line"). Keep schemas tight (enums, bounds, required). Add a cheap variant alongside each expensive one.

### 7. Write the system prompt and a citation protocol (Chapters 5, 7)

Define the persona, the grounding rules ("never fabricate document content"), and — critically — a **machine-readable citation format** the model emits and you parse deterministically. Paginate document text with `[Page N]` markers and tie citations to them. Reinforce "read before you cite" both in the prompt and inside tool results.

### 8. Add document generation (Chapter 8)

Give the model a `generate_docx`-style tool that takes **structured** sections, not raw text. Apply your domain's formatting (numbering, fonts, tables, signature pages) deterministically in code. Tell the model what *not* to do (don't type numbers, don't repeat the title). Store the result as a real document so it can be edited next.

### 9. Add tracked-change editing (Chapters 9, 10)

This is the hardest and most differentiating piece for a legal product. Build an `edit_document` tool taking minimal `find`/`replace` substitutions with `context_before`/`context_after` anchors. Implement an OOXML engine that locates text across runs, diffs minimally, and emits `w:ins`/`w:del` markup. Wrap it with versioning: new `assistant_edit` version, one `document_edits` row per change, and the **single-version-per-turn** collapse rule. Build an accept/reject flow that collapses individual changes into new versions.

### 10. Assemble context carefully (Chapter 11)

This is where agent quality actually lives. Give documents short stable labels; sweep generated/edited docs into context; inject a prior-turn activity summary; list available documents and remind the model it doesn't retain content; map attachments to labels. None of this is glamorous; all of it matters.

### 11. Add auth and access control (Chapter 15)

Pick an auth library (Better Auth works well self-hosted). Put a `requireAuth` middleware on every protected route. Centralise authorization in a small set of `checkXAccess` helpers and call them at the top of every route. If you support sharing, model it explicitly (`shared_with` arrays) and check it in code. Treat this as your application-layer row-level security.

### 12. Encrypt secrets and support BYOK (Chapter 16)

If users bring keys, encrypt them with AES-256-GCM (per-record IV, auth tag, key derived from an env secret). Resolve keys as user-beats-env. Expose *status*, never secrets.

### 13. Add domain integrations as tools (Chapter 14)

External APIs (case law, dockets, registries) are just more tool branches. Distill their payloads before they hit the prompt (cap long fields, strip HTML), cache slow/rate-limited ones, and support per-user tokens with an operator fallback.

### 14. Add reusable workflows (Chapter 12)

Let users (and you) save expert prompt templates as data. Load them into a per-user store, expose `list_workflows`/`read_workflow`, and trigger application via a marker the system prompt watches for. This keeps task-specific instructions out of the standing prompt.

### 15. Add bulk extraction if you need it (Chapter 13)

For "the same questions across many documents," build a grid model (`reviews`/`cells`), fan out across documents concurrently, do one model call per document for all columns, disable thinking, use a mid-tier model, and stream cell updates. Reuse the same agent loop with specialised tools for follow-up chat.

### 16. Storage and durable downloads (Chapter 17)

Keep bytes in object storage with predictable keys. For links stored in chat history, use HMAC-signed non-expiring tokens served through your backend, not expiring pre-signed URLs. Get `Content-Disposition` right (RFC 5987 for Unicode names).

## The principles that recur

If you internalise nothing else, internalise these — they show up in chapter after chapter:

1. **Abstract the model providers behind one seam.** Everything else gets simpler.
2. **Reference documents, never embed them.** Short labels + a read tool + a "you don't retain content" reminder = reliable grounding.
3. **Define protocols the model emits, then parse them deterministically.** Citations, cell formats, the `[Workflow:]` marker.
4. **Push deterministic formatting into code; tell the model what not to do.** Don't hope the model formats a contract correctly.
5. **Record an explicit event for every action.** It makes the UI lossless and the history trustworthy.
6. **Version everything immutable; track edits as first-class rows.** History is the product in regulated domains.
7. **Encode domain consequences as instructions.** "Renumber siblings and update cross-references" is what makes a generic edit tool trustworthy to a lawyer.
8. **Check access at every route; never trust the client.** Authorization in a small, audited set of helpers.
9. **Tune each surface for its job.** Interactive chat: thinking on, top model, low latency per turn. Bulk extraction: thinking off, mid model, max throughput.
10. **Degrade gracefully and fail closed.** Missing storage returns null; bad tool args become `{}`; failed decryption returns null; every tool call gets a result.

## Where to go next

The companion folder, [`../architecture-and-system-design`](../architecture-and-system-design/index.md), takes these same lessons up a level of abstraction and discusses them as general AI-agent system-design principles — independent of KD's specific legal domain and technology choices. Read it to understand *why* these patterns are the right ones and how to apply them to any agent you build.

You now have the complete picture of how KD's backend works, why each part is built the way it is, and how to build something like it yourself.
