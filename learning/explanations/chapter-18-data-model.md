# Chapter 18 — The Data Model

This chapter is the reference map of KD's database. Everything the backend persists is defined in `src/db/schema.ts` using Drizzle ORM over Postgres. Understanding the tables and how they relate makes every other chapter click into place. The schema falls into six groups.

## A note on the Drizzle conventions

The file's header comment explains two important conventions:

- **Better Auth core tables** (`user`, `session`, `account`, `verification`) must use exact JS key names that Better Auth expects (`emailVerified`, `userId`), because the adapter maps models to columns by JS key. The SQL column names stay snake_case.
- **Application tables** use snake_case JS keys (e.g. `message_credits_used`) so selected rows have the same shape the rest of the codebase already expects.
- **User identity is text.** Better Auth issues a text `user.id`, so every app table's `user_id` is `text`, not a UUID.

The `ts` helper defines every timestamp as `timestamp(..., {withTimezone: true})` — all times are stored with timezone, which is the correct default.

## Group 1 — Authentication (Better Auth)

| Table | Purpose |
|---|---|
| `user` | Identity: id (text PK), name, unique email, emailVerified, image, timestamps |
| `session` | Active sessions: token (unique), expiresAt, ip, userAgent, → user (cascade) |
| `account` | Linked credential/OAuth accounts: provider id, tokens, password hash, → user |
| `verification` | Email-verification / reset tokens: identifier, value, expiresAt |

These are owned by Better Auth (Chapter 15). Sessions and accounts cascade-delete with the user.

## Group 2 — User profile and secrets

| Table | Purpose |
|---|---|
| `user_profiles` | One per user: display_name, organisation, `tier` (default "Free"), `message_credits_used`, `credits_reset_date` (default now + 30 days), `tabular_model` (default gemini-3-flash-preview), timestamps |
| `user_api_keys` | Encrypted provider keys: `(user_id, provider)` unique, `encrypted_key`/`iv`/`auth_tag`, provider ∈ {claude, gemini, openai} |
| `user_indiankanoon_tokens` | Encrypted IK token, one per user (user_id is the PK) |

`user_profiles` carries usage metering (`message_credits_used`, `credits_reset_date`, `tier`) — the scaffolding for plan limits. The two key tables implement BYOK encryption (Chapter 16).

## Group 3 — Projects and documents

| Table | Purpose |
|---|---|
| `projects` | A matter folder: name, `cm_number`, `visibility` (default private), `shared_with` (jsonb string[]; GIN-indexed), owner `user_id` |
| `project_subfolders` | A folder tree inside a project: name, self-referencing `parent_folder_id` (cascade) |
| `documents` | A document's identity: filename, file_type, size, page_count, `structure_tree` (jsonb), `status`, `folder_id`, `current_version_id` → documentVersions |
| `document_versions` | One row per version: storage_path, pdf_storage_path, `source` (checked enum), version_number, display_name |
| `document_edits` | One row per tracked change: change_id, del_w_id/ins_w_id, deleted/inserted text, context, `status` (pending/accepted/rejected), → version |

This is the heart of the document model (Chapters 6, 9, 10). Note the circular reference: `documents.current_version_id` → `document_versions.id`, while `document_versions.document_id` → `documents.id`. Drizzle handles this with the `AnyPgColumn` type and `onDelete: "set null"` on the document's pointer. The `source` check constraint on versions enumerates exactly how a version can arise (`upload`, `user_upload`, `assistant_edit`, `user_accept`, `user_reject`, `generated`), and the `status` check on edits enumerates the resolution states. Indexes support the common access paths (by user+project, by project+folder, by document+created_at).

## Group 4 — Workflows

| Table | Purpose |
|---|---|
| `workflows` | A saved prompt template: title, `type`, `prompt_md`, `columns_config` (jsonb, for tabular), `practice`, `is_system` |
| `hidden_workflows` | Per-user hidden list: `(user_id, workflow_id)` unique |
| `workflow_shares` | Sharing by email: `(workflow_id, shared_with_email)` unique, `allow_edit` flag |

These power the workflow feature (Chapter 12). `columns_config` lets a workflow define a tabular review's columns, unifying chat workflows and tabular templates under one table.

## Group 5 — Chats

| Table | Purpose |
|---|---|
| `chats` | A conversation: optional `project_id` (cascade), owner `user_id`, title |
| `chat_messages` | A message: `role`, `content` (jsonb — assistant content is the *event timeline*), `files`, `workflow`, `annotations` (jsonb), created_at |

The decision to store `chat_messages.content` as **JSONB** (not text) is what enables the rich event replay described in Chapter 3 — for assistant messages it's an array of typed events (`content`, `reasoning`, `doc_read`, `doc_created`, `doc_edited`, …). `annotations` holds the citations and edit data extracted per turn (Chapter 7). The `files` and `workflow` columns capture what the user attached/selected.

## Group 6 — Tabular reviews

| Table | Purpose |
|---|---|
| `tabular_reviews` | A grid: `columns_config`, `document_ids`, optional `workflow_id`, `practice`, `shared_with` (jsonb, GIN-indexed) |
| `tabular_cells` | One cell: `(review_id, document_id, column_index)`, `content`, `citations`, `status` (pending/generating/done/error) |
| `tabular_review_chats` | A chat scoped to a review |
| `tabular_review_chat_messages` | Messages within a review chat |

These power bulk extraction (Chapter 13). The `tabular_cells` status field (`generating`/`done`/`error`) is what drives the live streaming cell updates.

## Group 7 — Caching

| Table | Purpose |
|---|---|
| `ecourts_cache` | Cached eCourts responses: `cache_key` (PK), `resource`, `payload` (jsonb), `request_id`, `expires_at` (indexed) |

A single-table cache for the slow, rate-limited eCourts API (Chapter 14).

## How it all connects

A mental diagram of the main relationships:

```
user ──< projects ──< project_subfolders (tree)
  │         │
  │         ├──< documents ──< document_versions ──< document_edits
  │         │         └─ current_version_id ─┘
  │         ├──< chats ──< chat_messages
  │         └──< tabular_reviews ──< tabular_cells
  │                       └──< tabular_review_chats ──< tabular_review_chat_messages
  ├──< user_profiles (1:1)
  ├──< user_api_keys
  ├──< user_indiankanoon_tokens (1:1)
  └──< workflows ──< workflow_shares
```

Chats and documents can also be standalone (project_id null), which is why those FKs are nullable. Tabular reviews can be standalone too and carry their own `shared_with` for that reason.

## Migrations

The README explains the migration discipline: `backend/schema.sql` is the full schema for a fresh database, and `backend/migrations/` holds incremental updates for existing deployments (e.g. `0001_indiankanoon_tokens.sql` adds the IK token table). Drizzle Kit (`drizzle.config.ts`) generates and applies migrations, preferring an unpooled `DIRECT_URL` for DDL. The rule "never run the full schema over production data; apply the incremental files instead" is the standard safe-migration practice.

## What the schema tells you about the product

Reading a schema is a fast way to understand a system. KD's tells you:

- **Documents are versioned, edited, and audited** (the `document_versions`/`document_edits` split with their check constraints).
- **Everything is shareable** (`shared_with` arrays on projects and reviews, `workflow_shares`).
- **Conversations are rich event logs**, not plain text (`chat_messages.content` JSONB).
- **The product meters usage** (credits on `user_profiles`) and **supports BYOK** (encrypted key tables).
- **It integrates external legal APIs** and caches them (`ecourts_cache`, IK tokens).

The data model *is* the product, expressed in tables.

---

Next: [Chapter 19 — Putting it together: build your own lawyer agent](chapter-19-build-your-own.md)
