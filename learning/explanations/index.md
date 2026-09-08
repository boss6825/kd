# KD Backend — Explained

> A complete, chapter-by-chapter walkthrough of how the KD legal-assistant backend works, and how you would build an agent like KD that helps lawyers read, draft, edit, and research legal documents.

This folder is a guided tour of the **`backend/`** part of the KD project. It is written for someone who wants to *understand the system deeply* and *be able to rebuild it from scratch*. Every chapter ties an idea back to the actual file and function in the codebase, so you can read the prose here and then open the source to see it in practice.

The companion folder, [`../architecture-and-system-design`](../architecture-and-system-design/index.md), zooms out and discusses the *general* principles of designing AI agents — independent of KD's specific choices. Read this folder to learn **how KD works**; read that folder to learn **how to design any agent like it**.

---

## What KD is

KD is a **legal document assistant**. A lawyer signs in, uploads contracts, agreements, judgments, and other legal files, and then talks to an AI assistant named **KD** about them. KD can:

- **Read** uploaded documents and answer questions about them, with precise inline citations back to the exact page and quote.
- **Draft** new legal documents (NDAs, contracts, checklists) as downloadable, properly-formatted Word files.
- **Edit** existing `.docx` files as Microsoft Word **tracked changes**, which the lawyer can accept or reject one by one.
- **Research** Indian case law (via Indian Kanoon) and look up live case records (via the eCourts system).
- **Run workflows** — reusable prompt templates for common tasks like "summarise this credit agreement" or "generate a conditions-precedent checklist".
- **Extract structured data** across many documents at once in a spreadsheet-like **tabular review**.

The whole product is three pieces: a **Next.js frontend**, an **Express backend** (the subject of this folder), and **external services** — Neon Postgres for data, Cloudflare R2 for file storage, and the model providers (Anthropic, Google, OpenAI) for the intelligence.

## The shape of the backend

The backend is a TypeScript Express API. At a high level it has four layers:

1. **HTTP routes** (`src/routes/`) — the entry points the frontend calls. Chats, projects, documents, tabular reviews, workflows, user settings, downloads.
2. **The agent core** (`src/lib/chatTools.ts`) — the system prompt, the tool catalog, the tool-execution dispatcher, and the streaming orchestration loop. This single file is the brain of KD.
3. **The provider-agnostic LLM layer** (`src/lib/llm/`) — a thin adapter that lets the same agent loop run on Claude, Gemini, or GPT without the rest of the code knowing which one is active.
4. **Supporting services** (`src/lib/`) — document storage (R2), document conversion (LibreOffice), tracked-changes engine, auth, access control, encryption of user API keys, and the legal-research API clients.

Underneath, **Drizzle ORM** (`src/db/schema.ts`) maps everything to Postgres tables, and **Better Auth** handles sign-in.

## How to read this folder

The chapters build on each other. If you read them in order you'll go from "what happens when a user sends a message" all the way down to "how a single word gets turned into a tracked change in a Word file". If you only want one topic, each chapter is self-contained enough to jump to.

### Chapters

1. **[The big picture: request lifecycle and tech stack](chapter-01-big-picture.md)** — Trace one chat message from the browser, through Express, into the model, and back as a stream. Meet every moving part.
2. **[The provider-agnostic LLM layer](chapter-02-llm-layer.md)** — How KD speaks to Claude, Gemini, and OpenAI through one interface, normalises their tool formats, and streams tokens uniformly.
3. **[The agent loop and tool calling](chapter-03-agent-loop.md)** — The heart of any agent: the iterate-call-tools-feed-results loop, and exactly how KD implements it.
4. **[The tool catalog](chapter-04-tool-catalog.md)** — Every tool KD can call, why each exists, and how tool schemas are designed.
5. **[The system prompt and prompt engineering](chapter-05-system-prompt.md)** — A close reading of KD's 70-line system prompt: citations, drafting rules, numbering, naming, and research behaviour.
6. **[Document ingestion: upload, storage, and conversion](chapter-06-ingestion.md)** — What happens when a file is uploaded: R2 storage, DOCX→PDF rendering, structure trees, page counts, and the `processing → ready` lifecycle.
7. **[Reading documents and the citation system](chapter-07-reading-and-citations.md)** — How `read_document` and `find_in_document` work, how text is paginated, and how the `<CITATIONS>` protocol turns `[1]` markers into clickable references.
8. **[Generating Word documents](chapter-08-generate-docx.md)** — The `generate_docx` tool, the legal numbering engine, and how structured JSON becomes a polished `.docx`.
9. **[Editing documents as tracked changes](chapter-09-edit-tracked-changes.md)** — The `edit_document` tool and the OOXML tracked-changes engine that produces real Word `w:ins`/`w:del` markup.
10. **[Document versioning and the accept/reject lifecycle](chapter-10-versioning.md)** — How versions, edits, and the accept/reject flow are modelled and kept consistent.
11. **[Projects, chats, and context building](chapter-11-projects-and-context.md)** — How conversations, document context, and prior-turn memory are assembled before each model call.
12. **[Workflows: reusable legal prompts](chapter-12-workflows.md)** — Built-in and user workflows, how they are loaded, shared, and applied mid-conversation.
13. **[Tabular review: bulk extraction at scale](chapter-13-tabular-review.md)** — The spreadsheet-over-documents feature: column prompts, per-cell extraction, formats, and streaming updates.
14. **[Legal research integrations](chapter-14-legal-research.md)** — The Indian Kanoon (precedent) and eCourts (live docket) clients and how the agent uses them.
15. **[Auth, access control, and multi-tenancy](chapter-15-auth-and-access.md)** — Better Auth sessions, the owner-or-shared access model, and why it replaces database row-level security.
16. **[Secrets, API keys, and bring-your-own-key](chapter-16-secrets-and-keys.md)** — How per-user provider keys are encrypted at rest and resolved at call time.
17. **[Storage, downloads, and signed tokens](chapter-17-storage-and-downloads.md)** — R2 keys, signed download permalinks, and content-disposition handling.
18. **[The data model](chapter-18-data-model.md)** — A tour of every table in `schema.ts` and how they relate.
19. **[Putting it together: build your own lawyer agent](chapter-19-build-your-own.md)** — A from-scratch blueprint that reuses every lesson to assemble a comparable agent.

---

## A note on accuracy

Everything in these chapters is drawn directly from the source as it exists in this repository. File paths and function names are real. Where the code has subtle behaviour (for example, how multiple edits in one turn collapse into a single document version), the chapters call it out explicitly, because those details are exactly what make the difference between a toy and a production agent.
