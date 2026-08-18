# Chapter 17 — Storage, Downloads, and Signed Tokens

Documents are big binary blobs; you don't keep them in Postgres. KD keeps the database for *metadata* and keeps the actual bytes in **Cloudflare R2** object storage, then serves them back through a clever signed-token download scheme. This chapter covers `src/lib/storage.ts`, `src/lib/downloadTokens.ts`, and `routes/downloads.ts`.

## Object storage with R2

`storage.ts` wraps Cloudflare R2, which is S3-compatible, so it uses the AWS S3 SDK pointed at R2's endpoint (`region: "auto"`, `forcePathStyle: true`, credentials from `R2_*` env vars). The whole subsystem is feature-flagged by `storageEnabled` (true only when all three R2 vars are present), and read operations return `null` rather than throwing when storage is off, so the app degrades gracefully.

The core operations:

- **`uploadFile(key, arrayBuffer, contentType)`** — `PutObject`.
- **`downloadFile(key)`** — `GetObject`, returns the bytes or `null` on any error.
- **`deleteFile(key)`** — `DeleteObject`.
- **`getSignedUrl(key, expiresIn, downloadFilename?)`** — a pre-signed, temporary, direct-to-R2 URL.

### Key conventions

A set of builder functions centralise the storage-path layout so keys are consistent everywhere:

```
documents/<userId>/<docId>/source.<ext>            ← storageKey (original upload)
documents/<userId>/<docId>/<stem>.pdf              ← pdfStorageKey
documents/<userId>/<docId>/versions/<slug>.<ext>   ← versionStorageKey
documents/<userId>/<docId>/edits/<versionId>.docx  ← assistant edits (in runEditDocument)
generated/<userId>/<docId>/generated.<ext>         ← generatedDocKey
converted-pdfs/<userId>/<docId>.pdf                ← convertedPdfKey (display PDF)
```

Putting the `userId` and `docId` in the path makes objects easy to reason about and clean up, and `storageExtension` safely derives the file extension (falling back to a default if the filename has none or a weird one).

## Two ways to download

KD has two download mechanisms, used in different situations:

### 1. Pre-signed R2 URLs (temporary)

`getSignedUrl` produces a URL that points *directly at R2* and is valid for `expiresIn` seconds (default 3600). Used where a short-lived direct link is fine. A nice touch: it sets `ResponseContentDisposition` so the browser downloads with the *real filename* instead of the R2 key's last path segment (which contains a UUID). The `download` attribute on an `<a>` tag is ignored for cross-origin URLs, so this has to be set server-side via `buildContentDisposition`, which produces a proper `attachment; filename="..."; filename*=UTF-8''...` header handling non-ASCII names (RFC 5987 encoding via `encodeRFC5987`).

### 2. Signed, non-expiring permalinks (`downloadTokens.ts`)

For links that get **stored in chat history** (every generated or edited document's download card), a one-hour expiry is useless — the user might open the chat next week. So KD uses its own **HMAC-signed download tokens**:

- **`signDownload(path, filename)`** — JSON-encodes `{p: path, f: filename}`, base64url-encodes it, computes an HMAC-SHA256 signature over that with `DOWNLOAD_SIGNING_SECRET`, and returns `<payload>.<signature>`.
- **`verifyDownload(token)`** — splits the token, recomputes the HMAC, compares it in **constant time** (`timingSafeEqStr`, guarding against timing attacks), and if valid returns the decoded `{path, filename}`. Any tampering fails the signature check and returns `null`.
- **`buildDownloadUrl(path, filename)`** — returns a relative URL `/download/<token>`. The frontend prefixes it with the API base URL.

The download route (`routes/downloads.ts`, `GET /download/:token`) verifies the token, streams the bytes fresh from R2 on each request, and sets the content-disposition to the embedded filename. Because the backend re-fetches on every request, the link stays valid as long as the file exists — no expiry, no R2 CORS headaches, and the link is safe to persist because it's HMAC-signed (a user can't forge a token to read someone else's path).

## Why HMAC tokens instead of signed S3 URLs for permalinks

This is a thoughtful design choice. Signed S3/R2 URLs:

- expire (bad for chat history),
- expose the storage structure,
- and require the browser to talk to R2 directly (CORS).

The HMAC-token approach instead:

- never expires (the token is just a signed reference),
- keeps all traffic flowing through the backend (which can apply its own logic),
- and is tamper-proof (the signature covers the path, so you can't swap in another user's path).

The trade-off is that downloads go *through* the backend rather than straight from R2, costing some bandwidth. For a document assistant where downloads are occasional and the links must live forever in conversation history, that's the right trade.

## Content-disposition done right

A small but real detail: filenames in `Content-Disposition` are fiddly because they can contain spaces, quotes, and non-ASCII characters. `storage.ts` handles all of it:

- `normalizeDownloadFilename` strips control characters and path separators.
- `sanitizeDispositionFilename` further removes quotes/backslashes and non-printable characters for the ASCII `filename=` parameter.
- `encodeRFC5987` percent-encodes for the `filename*=UTF-8''` parameter, which modern browsers prefer for Unicode names.

`buildContentDisposition` emits both parameters so every browser picks the right one. This is the kind of detail that, if skipped, produces downloads named `source` or `%E2%80%A6.docx` — and is exactly the polish that makes a product feel finished.

## The full picture

Put together with Chapters 6, 8, 9, and 10:

- Bytes live in R2 under predictable, user-scoped keys.
- Metadata and version pointers live in Postgres.
- Generated/edited documents get permanent HMAC-signed download links that persist safely in chat history.
- Temporary direct links use pre-signed R2 URLs with correct filenames.
- Everything degrades gracefully when storage is unconfigured.

---

Next: [Chapter 18 — The data model](chapter-18-data-model.md)
