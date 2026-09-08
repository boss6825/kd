# Chapter 10 — Document Versioning and the Accept/Reject Lifecycle

KD treats a document as a *thing that evolves*: it is uploaded, edited by KD, and then those edits are accepted or rejected by the lawyer, each step producing a new immutable version. This chapter explains the data model that makes that work and the consistency rules that keep it correct. The relevant code spans `src/db/schema.ts`, `src/lib/documentVersions.ts`, `runEditDocument` in `chatTools.ts`, and the accept/reject routes in `routes/documents.ts`.

## The three tables

Versioning is modelled with three tables:

- **`documents`** — the stable identity of a document: id, filename, project, user, status, page count, structure tree, and a pointer `current_version_id` to whichever version is "live".
- **`document_versions`** — one row per version. Each carries a `storage_path` (the bytes), an optional `pdf_storage_path` (rendered display PDF), a `source`, a `version_number`, and a `display_name`.
- **`document_edits`** — one row per individual tracked change within an `assistant_edit` version: the `change_id`, the word ids (`del_w_id`/`ins_w_id`), the deleted/inserted text, surrounding context, and a `status` of `pending`/`accepted`/`rejected`.

The key architectural decision: **storage paths live on versions, not on the document.** The `documents` row doesn't know where its bytes are — it only knows its current version, and the version knows the bytes. This is what makes a clean version history possible.

## The `source` enum

`document_versions.source` is constrained by a check to one of:

```
upload | user_upload | assistant_edit | user_accept | user_reject | generated
```

Each value records *how* the version came to exist:

- **`upload`** — the original V1 from ingestion (Chapter 6).
- **`generated`** — a document KD created via `generate_docx` (Chapter 8).
- **`assistant_edit`** — a version produced by KD's `edit_document` (Chapter 9), containing pending tracked changes.
- **`user_accept` / `user_reject`** — a version produced when the user resolves a tracked change.
- **`user_upload`** — a new version the user uploaded to replace the current one.

The `source` is both an audit trail and a way to compute version numbers correctly.

## Version numbers

`version_number` is a per-document sequential integer. The counter deliberately spans `upload`, `user_upload`, and `assistant_edit` (see the query in `runEditDocument`), so:

- The original upload is **V1**.
- The first assistant edit is **V2**.
- And so on.

This is why a lawyer sees "V3" chips in the UI — they map directly to `version_number`. Note that `user_accept`/`user_reject` versions are produced by resolving changes and are handled slightly differently; the main numbered lineage the user reasons about is upload → edits.

## Resolving the "active version" — `documentVersions.ts`

Because bytes live on versions, every read-from-storage path goes through helpers in `documentVersions.ts`:

- **`loadActiveVersion(documentId, db, versionId?)`** — resolves which version to use: the explicitly-requested `versionId` if it belongs to this document, otherwise `documents.current_version_id`. Returns the storage paths, version number, display name, and source. Returns `null` if there's no usable version.
- **`attachActiveVersionPaths(db, docs[])`** — for a *list* of documents, looks up each one's active version and merges `storage_path`/`pdf_storage_path`/`active_version_number` onto the rows in a single query, regardless of list size. This is used by `buildDocContext` and the document list routes to avoid N+1 queries.
- **`attachLatestVersionNumbers(db, docs[])`** — attaches the max `assistant_edit` version number per document, for displaying "latest edited version" badges.

These helpers centralise the "find the bytes for this document" logic so no route has to re-implement the version join.

## The single-version-per-turn rule

Here is a subtle correctness rule worth dwelling on. A single assistant *turn* can call `edit_document` multiple times (the model might emit several batches of edits). If each call created a new version, one turn could produce V2, V3, V4… for what the user experiences as a single edit.

KD prevents this with the `turnEditState` map in `runLLMStream` and the `reuseVersion` parameter in `runEditDocument`:

- `runLLMStream` creates a `turnEditState: TurnEditState` map that **persists across tool-call batches within the turn**.
- The first `edit_document` for a given document creates a new `assistant_edit` version and records it in `turnEditState`.
- Subsequent `edit_document` calls for the *same* document in the *same* turn pass `reuseVersion` (the existing version id, number, and path), so `runEditDocument` overwrites that version's file in place and appends edit rows to it, rather than creating a new version.

The comment in the code says it plainly: "One assistant turn produces at most one document_versions row per edited doc." This is the kind of invariant that keeps version history sane and the UI's "V2" chip meaningful.

## The accept/reject flow

After an `assistant_edit` version exists with pending tracked changes, the user resolves them. The routes in `documents.ts` use `extractTrackedChangeIds` and `resolveTrackedChange` (from `docxTrackedChanges.ts`) to:

1. Take the current version's bytes.
2. **Collapse one specific change** by its `w:id`: on accept, keep the `<w:ins>` content and drop the `<w:del>`; on reject, do the opposite.
3. Produce a new version (`source: user_accept` or `user_reject`) and update `documents.current_version_id`.
4. Update that `document_edits` row's `status` to `accepted`/`rejected` and stamp `resolved_at`.

So each accept/reject is itself a version — full history is preserved, and you could in principle reconstruct exactly what happened to a document over its life.

## Keeping chat history in sync — `hydrateEditStatuses`

There's a consistency wrinkle. When KD first proposes edits, the annotations stored on the chat message record each edit's status as `pending` (its value at the time). If the user later accepts an edit, `document_edits.status` changes — but the *stored chat annotation* doesn't. So on chat load, `hydrateEditStatuses` (in `routes/chat.ts`) re-reads the current `document_edits.status` for every edit referenced in the messages and patches the annotations before sending them to the frontend. It does the same for version numbers (old stored events predate the `version_number` column, so it looks them up from `document_versions`).

This is a common pattern: the message log captures a *point-in-time snapshot*, but some fields are mutable, so on read you reconcile the snapshot against the current source of truth. KD does it lazily at load time rather than trying to update every historical message on every change.

## Why model it this way

- **Immutable versions = trustworthy history.** Nothing is ever overwritten (except the within-turn collapse, which is itself controlled). A lawyer can always see how a document got to where it is.
- **A single `current_version_id` pointer = simple "what's live".** Every consumer just follows the pointer.
- **Edits as first-class rows = a real accept/reject workflow.** Because each change is a `document_edits` row, the UI can present granular cards and the system can track resolution.
- **Centralised version resolution = no N+1 and no drift.** All "find the bytes" logic lives in `documentVersions.ts`.

---

Next: [Chapter 11 — Projects, chats, and context building](chapter-11-projects-and-context.md)
