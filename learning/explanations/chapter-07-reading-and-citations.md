# Chapter 7 — Reading Documents and the Citation System

This chapter covers the two halves of how Mike grounds its answers in real document text: how the `read_document` and `find_in_document` tools actually pull and shape text, and how the `<CITATIONS>` protocol turns the model's `[N]` markers into clickable, page-anchored references. The code is in `src/lib/chatTools.ts` (`readDocumentContent`, `findInDocumentContent`, `extractPdfText`, `parseCitations`) plus the citation rules from the system prompt (Chapter 5).

## Reading a document

When the model calls `read_document`, `runToolCalls` resolves the label and calls `readDocumentContent(docLabel, docStore, write, docIndex, db)`. That function:

1. Looks up the label in the `docStore` to get the storage path, file type, and filename. A miss returns `"Document not found."` (and logs the known labels, which is invaluable when debugging a mismatch).
2. Downloads the current version's bytes from R2.
3. Extracts text according to the file type:
   - **PDF** → `extractPdfText` using `pdfjs-dist`.
   - **DOCX** → `mammoth` to pull the raw text.
4. Returns the text, paginated with `[Page N]` markers.

### Pagination and the page-marker contract

The extracted text is annotated with sequential `[Page N]` markers. This is the backbone of the whole citation system: when the prompt says *"page refers to the sequential `[Page N]` marker in the text you were given (1-indexed from the first page)"*, it means these markers — not whatever page numbers happen to be printed in the document's own footers. Because the display PDF (Chapter 6) is rendered from the same source, page N in the extracted text lines up with page N in the viewer, so a citation can scroll the PDF to the right place.

### The citation reminder

Look at the `read_document` branch in `runToolCalls`: the returned content is prefixed with `citationReminder(docId, filename)`. This injects a short reminder, *inside the tool result*, of how to cite this specific document (its label and filename). The model sees this every time it reads, reinforcing the citation discipline right at the moment it has the text in front of it. Reinforcing instructions at the point of use — not just in the system prompt — measurably improves compliance.

## Finding text in a document

`find_in_document` is the Ctrl-F tool. `findInDocumentContent` implements case-insensitive, whitespace-tolerant matching:

- `normalizeWithMap(text)` produces a normalised version of the document text (lowercased, runs of whitespace collapsed) *along with an index map* back to the original offsets. This is the clever part: you search in normalised space but report results in original space, so "Section   4.2" in the document matches a query of "section 4.2" yet the returned context is the real text.
- `normalizeQuery(q)` normalises the query the same way.
- Matches are collected up to `max_results` (default 20), each with `context_chars` of surrounding text on each side (default 80).
- The result is JSON with the matches and a `total_matches` count, which `runToolCalls` also records as a `doc_find` event for the UI.

This tool lets the model verify exact wording (essential for verbatim citation quotes) cheaply, without reading the entire file into the prompt.

## The citation protocol end to end

Here's the full lifecycle of a citation, tying together the prompt, the stream, and the parser:

**1. The model writes markers and a block.** Following the system prompt, the model writes prose with inline `[1]`, `[2]` markers and appends a `<CITATIONS>` JSON array at the very end.

**2. The stream hides the block.** As covered in Chapter 3, `runLLMStream`'s `streamVisibleContent` detects the `<CITATIONS>` open tag and stops streaming visible text at that boundary, so the user sees the prose but never the JSON. The full text (block included) is still accumulated in `fullText`.

**3. The parser extracts entries.** After streaming, `parseCitations(fullText)` runs `CITATIONS_BLOCK_RE` (`/<CITATIONS>\s*([\s\S]*?)\s*<\/CITATIONS>/`) to grab the block, parses the JSON, and normalises each entry via `normalizeCitation` into `{ref, doc_id, page, quote}`.

**4. Labels resolve to real identities.** Each citation's `doc_id` (a chat-local label like `doc-0`) is resolved through `resolveDoc(c.doc_id, docIndex)` to recover the real `document_id`, `version_id`, `version_number`, and `filename`. So the citation the frontend receives carries both the model-facing label *and* the database identity.

**5. Citations are emitted and persisted.** A final `citations` SSE frame is written to the stream for the live UI, and `extractAnnotations` stores the same citations as `citation_data` annotations on the assistant's `chat_messages` row, so they survive a page reload.

## Why resolve labels instead of letting the model use UUIDs

KD never shows the model raw document UUIDs. The model works in terms of `doc-0`, `doc-1`, and KD maintains the `docIndex` mapping those labels to real identities. There are three reasons:

1. **Token efficiency** — short labels are far cheaper than UUIDs repeated throughout a long answer.
2. **Stability within a turn** — labels are assigned deterministically (`doc-0`, `doc-1`, … in a fixed order) so the model can reference them reliably.
3. **Safety** — the model can only cite documents that are actually in its context; a hallucinated UUID would resolve to nothing, whereas a hallucinated `doc-9` simply fails to resolve and is dropped.

## Stale-content prevention

A recurring theme: the model does **not** retain document content across turns. `buildMessages` injects the reminder, and the tool descriptions repeat it. This is deliberate. If the model were allowed to "remember" a document it read three turns ago, it would cite stale text after the document had been edited (its current version changed). By forcing a fresh `read_document` every turn, KD guarantees citations always reflect the *current* version. The cost is a re-read each turn; the benefit is correctness, which for a legal product is non-negotiable.

## The result

Put together, the reading and citation system gives the lawyer something rare in AI tools: every factual claim Mike makes about a document is backed by a marker that jumps to the exact page and highlights the exact quote, and that quote is guaranteed verbatim because the model was told to only cite text it can see and was given a Ctrl-F tool to confirm it. The protocol is simple, the parsing is deterministic, and the grounding is real.

---

Next: [Chapter 8 — Generating Word documents](chapter-08-generate-docx.md)
