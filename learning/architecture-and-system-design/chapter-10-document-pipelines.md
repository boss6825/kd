# Chapter 10: Document and File Processing Pipelines

Many agents are fundamentally *document* agents: their value comes from reading, transforming, and producing files. The pipeline that turns an uploaded file into something the agent can use, and turns the agent's output into a downloadable artifact, is a system in its own right. This chapter covers ingestion, conversion, extraction, generation, and the synchronous-vs-asynchronous decision.

## The ingestion pipeline

When a file is uploaded, a sequence of steps prepares it for use. A typical pipeline:

1. **Validate**: accept only the formats you actually support; reject the rest immediately with a clear error. Narrowness is a feature: fewer formats means fewer edge cases.
2. **Create a record**: write a metadata row with a `processing` status *before* doing the heavy work, so you have a durable handle even if a later step fails.
3. **Store the original bytes**: put the raw file in object storage under a predictable, owner-scoped key. Keep the original untouched; everything else is derived.
4. **Produce a renderable form**: convert to a viewable format (often PDF) if the source isn't already viewable, so your UI can display it consistently regardless of input type.
5. **Extract structure and text**: pull a structural outline (headings/sections) and any metadata (page count) you'll need for navigation and citation.
6. **Record a first version**: create the initial version row pointing at the stored bytes (Chapter 9).
7. **Mark ready**: flip the status to `ready`; only `ready` items are ever loaded into the agent's context.

If anything fails, mark the record `error` rather than leaving it half-built. The status field makes the pipeline's state explicit and recoverable.

## Format conversion is messy: isolate it

Converting between document formats (Office → PDF, etc.) is one of the messiest parts of any document system. Real-world files are malformed in creative ways: non-standard internal paths, corrupt structures, unusual encodings. Lessons:

- **Use a battle-tested converter** (a mature library or a tool like LibreOffice invoked as a subprocess) rather than writing your own. It encodes decades of edge-case handling.
- **Normalise before converting.** Pre-process known quirks (e.g. archives with non-standard internal path separators) so the converter doesn't choke. These fixes are unglamorous but essential once real user files arrive.
- **Fail softly.** If conversion fails, degrade: keep the document usable for text extraction even without a rendered preview, rather than rejecting the upload outright. Wrap conversion in a try/catch and continue with what succeeded.
- **Treat the converter as an external dependency.** It may need installing in your runtime image, it adds latency, and it can crash. Isolate it so its failures don't take down the request.

## Text extraction and pagination

For the agent to read and cite a document, you extract its text, and *how* you extract it matters for citation precision (Chapter 7). Annotate the extracted text with **stable location markers** (page numbers, section ids) that line up with what the user sees in the rendered view. Then a citation that says "page 3" can scroll the viewer to page 3 and highlight the quote. Don't trust page numbers printed *inside* the document (footers, roman numerals); use your own sequential markers tied to the rendering. Extraction and rendering must agree on locations, or citations point to the wrong place.

## Generation: structured input → deterministic output

For producing documents, the pattern from Chapter 3 applies: have the agent emit **structured content** (sections, headings, tables) and let *your code* render it into the target format deterministically, applying house style, numbering, fonts, and layout. This keeps formatting reliable and consistent, and confines the model to deciding content. Use a mature document-generation library and encode your domain's formatting conventions once, in code.

## Versioning generated and edited artifacts

Generated and edited documents flow back into the same versioning model as uploads (Chapter 9): a generated document is a new artifact with a first version (`source: generated`); an edit creates a new version (`source: agent_edit`) of an existing artifact. The pipeline for "agent edits a document" is its own mini-pipeline: load current bytes → apply the change → store new bytes → record a new version → record the individual changes → update the current pointer. Keep these steps transactional enough that you never end up with a version row pointing at bytes that weren't written, or a current pointer to a version that doesn't exist.

## The synchronous vs asynchronous decision

A central architectural choice: do you process the file *during the upload request* (synchronous) or hand it to a background worker (asynchronous)?

**Synchronous** (do it all in the request):

- *Pros:* simple, linear code; the response can return the finished, ready document; no queue infrastructure.
- *Cons:* the request is held open for the duration (conversion can be slow); large files risk timeouts; a burst of uploads ties up request handlers.
- *Good when:* files are modest in size, processing takes a few seconds, and volume is moderate.

**Asynchronous** (enqueue, process in a worker):

- *Pros:* uploads return instantly with a `processing` status; heavy work runs off the request path; you can scale workers independently and retry failures.
- *Cons:* more infrastructure (a queue, workers), and the client must poll or subscribe for completion; eventual-consistency UX.
- *Good when:* files are large, processing is slow (OCR, heavy conversion), or volume is high.

A pragmatic path: **start synchronous, but design as if it will become asynchronous.** The single thing that makes the later migration easy is already having the explicit status field (`processing → ready → error`). With that in place, moving steps 3–6 into a worker is a localised change; the rest of the system already understands "not ready yet." Don't build the queue before you need it; do build the status field from day one.

## Operational concerns

- **Size limits.** Enforce maximum file sizes at the edge to protect memory and processing time.
- **Storage hygiene.** Owner-scoped keys make cleanup and access reasoning easy; delete derived artifacts when the source is deleted.
- **Idempotency.** If a processing step is retried, it shouldn't create duplicate versions or orphaned files. Make steps safe to re-run (Chapter 13).
- **Observability.** Log each pipeline stage with the document id so a failed conversion is diagnosable. Document pipelines fail in field-specific ways; you'll want the breadcrumbs.

## The takeaway

A document pipeline is a small ETL system bolted to your agent. Treat it with the same rigor: validate inputs, store originals immutably, isolate the messy conversion step and make it fail soft, extract with citation-grade location markers, version everything, and use an explicit status state machine so the whole thing is recoverable and ready to go asynchronous when scale demands. The agent gets the credit, but the pipeline is what makes its document work trustworthy.

---

Next: [Chapter 11: Security, auth, and multi-tenancy](chapter-11-security-multitenancy.md)
