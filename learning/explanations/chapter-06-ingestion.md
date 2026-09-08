# Chapter 6 — Document Ingestion: Upload, Storage, and Conversion

Before KD can read or cite a document, that document has to be ingested: stored durably, rendered to a viewable PDF, analysed for structure, and marked ready. This chapter follows a file from the upload request into the system. The relevant code is `handleDocumentUpload` in `src/routes/documents.ts`, supported by `src/lib/storage.ts` and `src/lib/convert.ts`.

## The upload entry points

Documents can be uploaded in two contexts:

- **Standalone:** `POST /single-documents` (the `documentsRouter`), which calls `handleDocumentUpload(req, res, userId, null, db)` — `null` project means it's a personal document.
- **Within a project:** `POST /projects/:projectId/documents`, which calls the same handler with a real `projectId`.

Both go through `singleFileUpload("file")` — a `multer` middleware (`src/lib/upload.ts`) that parses the multipart body into `req.file` with the bytes in memory (`file.buffer`).

## Step 1 — validate the file type

The handler reads `file.originalname`, extracts the extension, and checks it against `ALLOWED_TYPES = {pdf, docx, doc}`. Anything else is rejected with a `400`. KD is deliberately narrow: only the formats a legal practice actually deals in.

## Step 2 — create the document row as `processing`

A row is inserted into the `documents` table immediately with `status: "processing"`, the project id, user id, filename, file type, and byte size. The new row's `id` (a UUID) becomes the document's permanent identity. Creating the row first means the system has a durable handle even if later steps fail.

## Step 3 — store the original bytes in R2

The handler computes a storage key with `storageKey(userId, docId, filename)`, which produces a path like:

```
documents/<userId>/<docId>/source.docx
```

and uploads the bytes via `uploadFile(key, arrayBuffer, contentType)`. The content type is `application/pdf` for PDFs and the long OOXML mime type for Word files.

`storage.ts` wraps the AWS S3 SDK pointed at R2 (`region: "auto"`, `forcePathStyle: true`, the R2 endpoint and credentials from env). It exposes `uploadFile`, `downloadFile`, `deleteFile`, and `getSignedUrl`, plus a set of **key-builder functions** (`storageKey`, `pdfStorageKey`, `generatedDocKey`, `versionStorageKey`) that centralise the path conventions so keys are consistent everywhere. The whole storage subsystem is feature-flagged by `storageEnabled` (true only when all three R2 env vars are present), so the app degrades gracefully if storage isn't configured.

## Step 4 — extract a structure tree

`extractStructureTree(rawBuf, suffix, filename)` analyses the document to produce a `structure_tree` — a hierarchical outline of headings/sections — which is stored as JSONB on the document row. This powers navigation features in the UI (jumping to sections) without re-parsing the file each time.

## Step 5 — count pages (PDFs)

For PDFs, `countPdfPages(rawBuf)` records a `page_count`. (For Word files this is null at upload, since the page count only becomes meaningful after rendering.)

## Step 6 — render a display PDF

This is the most operationally interesting step. The frontend always *displays* a PDF (so citations can highlight exact regions), regardless of the source format:

- If the upload is a **PDF**, it is its own rendition — `pdfStoragePath = key`.
- If it's a **DOCX/DOC**, KD converts it to PDF with `docxToPdf(content)` and stores the result at `convertedPdfKey(userId, docId)`.

`docxToPdf` (in `convert.ts`) shells out to **LibreOffice** via the `libreoffice-convert` package. This is why the README lists LibreOffice as a prerequisite and `nixpacks.toml` installs it in production. The conversion is wrapped in a `try/catch`: if LibreOffice isn't available or the file is malformed, the conversion fails *softly* — the document is still usable for text extraction, it just won't have a rendered PDF.

There's a nice piece of defensive engineering here: `normalizeDocxZipPaths`. Some older Windows/Word `.docx` archives store internal entries with backslash separators (`word\document.xml`) instead of the spec-required forward slashes, which makes LibreOffice and `mammoth` miss those entries and produce empty output. KD rewrites such entries to forward-slash form before conversion. This is the sort of real-world edge case that only surfaces with actual user files.

## Step 7 — create the V1 version row

Storage paths don't live on the `documents` row — they live on `document_versions`. So ingestion inserts the first version:

```ts
documentVersions.insert({
  document_id: docId,
  storage_path: key,             // the source bytes
  pdf_storage_path: pdfStoragePath, // the display PDF
  source: "upload",
  version_number: 1,
  display_name: filename,
})
```

and points `documents.current_version_id` at it. This versioning model (Chapter 10) is what lets a document accumulate edits over time while always knowing which version is "current".

## Step 8 — mark `ready` and respond

Finally the document row is updated to `status: "ready"` with the page count, structure tree, and current version id, and the full row is returned to the caller (with `storage_path`/`pdf_storage_path` surfaced for backward compatibility). If anything in steps 3–8 throws, the row is set to `status: "error"` and a `500` is returned.

## The status lifecycle

A document moves through a small state machine:

```
processing → ready
          ↘ error
```

Only `ready` documents are ever loaded into chat context — `buildDocContext` filters on `status = "ready"` (Chapter 11). This guarantees the model never sees a half-ingested file.

## Why ingestion is synchronous here

Notice that all of this happens *within the upload request* — there's no background job queue. For the document sizes KD handles (contracts, agreements, judgments — typically tens of pages), synchronous processing is simple and the latency is acceptable. The trade-off is that a very large file will hold the request open during LibreOffice conversion. A higher-scale system would move steps 4–7 to a worker (see the architecture folder's chapter on document pipelines), but KD's choice keeps the code linear and easy to reason about, and the `processing`/`ready`/`error` status field is already exactly what you'd need to make it asynchronous later.

## What you now have on disk

After a successful DOCX upload, R2 contains:

```
documents/<userId>/<docId>/source.docx     ← original bytes
converted-pdfs/<userId>/<docId>.pdf         ← rendered display PDF
```

and Postgres has a `documents` row (`status: ready`) plus a `document_versions` row (V1, `source: upload`). KD can now be asked to read it.

---

Next: [Chapter 7 — Reading documents and the citation system](chapter-07-reading-and-citations.md)
