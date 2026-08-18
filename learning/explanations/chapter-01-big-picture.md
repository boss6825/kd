# Chapter 1 — The Big Picture: Request Lifecycle and Tech Stack

Before diving into any single file, it helps to hold the whole system in your head at once. This chapter traces a single chat message from the moment a lawyer hits "send" to the moment the answer finishes streaming back, naming every component it passes through. By the end you'll have a map you can hang the rest of the chapters on.

## The technology stack

KD's backend is built from a small, deliberate set of technologies:

- **Node.js + Express** (`src/index.ts`) — the HTTP server. Plain Express 4, no framework on top.
- **TypeScript** throughout, compiled with `tsc` (`npm run build`) and run in dev with `tsx watch`.
- **Drizzle ORM** (`src/db/`) — a typed SQL query builder over **Postgres** (hosted on Neon).
- **Better Auth** (`src/lib/auth.ts`) — email/password and Google sign-in, issuing bearer tokens.
- **Cloudflare R2** (`src/lib/storage.ts`) — S3-compatible object storage for the actual document bytes.
- **LibreOffice** (`src/lib/convert.ts`) — invoked as a subprocess to render `.docx`/`.doc` into PDF.
- **Three model-provider SDKs** — Anthropic, Google GenAI, and a hand-rolled OpenAI Responses client, all hidden behind one adapter (`src/lib/llm/`).
- **Resend** (`src/lib/email.ts`) — transactional email for password resets and verification.

The `package.json` dependency list reads like a table of contents for the whole system: `@anthropic-ai/sdk`, `@google/genai`, `@aws-sdk/client-s3`, `better-auth`, `docx`, `drizzle-orm`, `libreoffice-convert`, `mammoth`, `pdfjs-dist`, `express-rate-limit`, `helmet`.

## The server bootstrap

Everything starts in `src/index.ts`. When the process boots it:

1. Loads environment variables (`dotenv/config`).
2. Creates the Express app and disables the `x-powered-by` header.
3. Installs **security middleware**: `helmet` for HTTP headers and `cors` configured to allow exactly the frontend origin with credentials, and crucially to *expose* the `set-auth-token` response header so the browser can read the session token Better Auth returns.
4. Installs **rate limiters**. There are several, each tuned to a class of route: a general limiter, a stricter chat limiter (30 requests / 15 min by default), a chat-create limiter, an upload limiter, and an auth limiter. They are configurable via environment variables (`RATE_LIMIT_CHAT_MAX`, etc.) and all skip `OPTIONS` preflight requests.
5. Mounts **Better Auth** at `/api/auth/*` *before* `express.json()` — this ordering matters because Better Auth parses its own request bodies, and letting Express's JSON parser run first would consume the stream.
6. Installs `express.json({ limit: "50mb" })` for everything else (large because document-related payloads can be sizeable).
7. Mounts the routers: `/chat`, `/projects`, `/projects/:projectId/chat`, `/single-documents`, `/tabular-review`, `/workflows`, `/user`, `/users`, `/download`.
8. Adds a `/health` endpoint and starts listening.

This file is intentionally boring — it is pure wiring. All the intelligence lives downstream.

## The routers at a glance

Each router owns one resource family:

| Router | File | Responsibility |
|---|---|---|
| `chatRouter` | `routes/chat.ts` | General (non-project) chats and the main streaming chat endpoint |
| `projectsRouter` | `routes/projects.ts` | Projects, subfolders, project documents, sharing |
| `projectChatRouter` | `routes/projectChat.ts` | Streaming chat *scoped to a project* with project-aware tools |
| `documentsRouter` | `routes/documents.ts` | Standalone document upload, versions, PDF rendering |
| `tabularRouter` | `routes/tabular.ts` | Tabular reviews — bulk extraction across documents |
| `workflowsRouter` | `routes/workflows.ts` | Workflow CRUD and sharing |
| `userRouter` | `routes/user.ts` | Profile, model settings, API keys |
| `downloadsRouter` | `routes/downloads.ts` | Serving files by signed token |

## Following one chat message

Now the main event. Suppose a lawyer has uploaded an NDA and types: *"Summarise the confidentiality obligations and cite the clauses."* Here is the full journey, which is implemented in `chatRouter.post("/")` in `routes/chat.ts`.

**1. Authentication.** The request carries an `Authorization: Bearer <token>` header. The `requireAuth` middleware (`middleware/auth.ts`) hands the headers to Better Auth's `getSession`, and if valid, populates `res.locals.userId` and `res.locals.userEmail`. No valid session → `401`.

**2. Validation.** The route parses and validates the body: `messages` must be a non-empty array of `{role, content}`; `chat_id`, `project_id`, and `model` are all optional and individually validated. KD never trusts the shape of the incoming JSON — every field has a dedicated parser that returns either a typed value or an error detail.

**3. Resolve or create the chat.** If a `chat_id` is supplied, the route confirms the user can access that chat (own chat, or a chat under a project they can reach). If no `chat_id`, it creates a fresh `chats` row. This is where conversation persistence begins.

**4. Persist the user's message.** The latest user message is inserted into `chat_messages` immediately, before the model is even called, so the conversation is durable even if streaming fails.

**5. Build document context.** `buildDocContext` (in `chatTools.ts`) looks at the file attachments on the messages *and* sweeps prior assistant events in this chat to find any documents the assistant previously generated or edited. It loads those documents' current versions and builds two structures: a `docIndex` (mapping chat-local labels like `doc-0` to real document IDs and filenames) and a `docStore` (mapping the same labels to storage paths). Documents are given short, stable, chat-local handles so the model never sees raw UUIDs.

**6. Enrich with prior-turn memory.** `enrichWithPriorEvents` appends a short "[Tool activity in your previous turn]" note to the last assistant message so the model remembers what it did last time (e.g. "generate_docx → doc-1"). More on this in Chapter 11.

**7. Assemble the prompt.** `buildMessages` prepends the system prompt, injects an "AVAILABLE DOCUMENTS" section listing the doc labels, and reminds the model that it does **not** retain document content across turns and must re-read.

**8. Load workflows and keys.** `buildWorkflowStore` loads the built-in and user workflows; `getUserApiKeys` decrypts the user's provider keys (or falls back to environment keys).

**9. Open the stream.** The route sets Server-Sent-Events headers (`text/event-stream`, `no-cache`, `X-Accel-Buffering: no`) and flushes. From here the response is a live stream, not a single JSON body.

**10. Run the agent loop.** `runLLMStream` is invoked. This is the orchestration engine (Chapter 3). It calls the model, streams reasoning and content deltas to the browser as SSE events, executes any tools the model requests (reading documents, generating files, etc.), feeds the results back, and loops until the model produces a final answer. Along the way it emits a structured event timeline.

**11. Persist the assistant message.** When the stream ends, the assistant's content events and any citation/edit annotations are extracted and saved to `chat_messages`. If the chat had no title yet, a title is set from the user's first message (and a nicer one can be generated asynchronously via `/chat/:chatId/generate-title`).

**12. Close the stream.** A final `data: [DONE]` sentinel is written and the response ends.

## Why this shape

A few design decisions are worth flagging now because they recur everywhere:

- **Streaming is first-class.** The user sees tokens, reasoning, and tool activity as they happen. This isn't a bolt-on; the entire orchestration is built around a `write()` function that pushes SSE frames.
- **Documents are referenced, never embedded.** The model gets short labels and must explicitly call a tool to read content. This keeps prompts small and forces the model to ground its answers.
- **Persistence happens at the edges.** The user message is saved before the model runs; the assistant message is saved after. The DB is the source of truth for conversation history, and the streaming layer is ephemeral.
- **Everything is access-checked.** Every route begins by establishing *who* the user is and *what* they can reach, because the browser never touches the database directly.

With this map in hand, the next chapter goes one level down into the component that makes KD model-agnostic: the LLM layer.

---

Next: [Chapter 2 — The provider-agnostic LLM layer](chapter-02-llm-layer.md)
