# Chapter 9 — Editing Documents as Tracked Changes

This is one of KD's most distinctive features. When Mike edits a document, it doesn't silently rewrite it — it produces **Microsoft Word tracked changes** (the red-underline insertions and strike-through deletions lawyers use for redlining), which the user can accept or reject one at a time. This chapter explains the `edit_document` tool, the `runEditDocument` orchestration in `src/lib/chatTools.ts`, and the OOXML engine in `src/lib/docxTrackedChanges.ts`.

## What the model produces

Per Chapter 4, `edit_document` takes a `doc_id` and an array of `edits`, where each edit is a *minimal substitution*:

```json
{
  "find": "ninety (90) days",
  "replace": "sixty (60) days",
  "context_before": "the Receiving Party shall, within ",
  "context_after": " of such request, return or destroy",
  "reason": "Shorten the return period per client instruction"
}
```

The `find`/`replace` are the actual change; the `context_before`/`context_after` (~40 chars each) exist to **anchor** the change unambiguously, because the same phrase ("ninety (90) days") might appear in several places. The model is told to keep `find` as short as possible — just the words being changed.

## The OOXML reality

A `.docx` is a zip archive of XML. Visible text lives in `word/document.xml` inside `<w:p>` (paragraph) → `<w:r>` (run) → `<w:t>` (text) elements. A tracked change is not a text replacement — it's special markup:

- An **insertion** is wrapped in `<w:ins author="…" date="…" w:id="…">`.
- A **deletion** is wrapped in `<w:del …>` with the deleted text inside `<w:delText>` instead of `<w:t>`.

So to "edit as a tracked change," KD must surgically rewrite the XML to wrap the old text in `<w:del>` and insert the new text in `<w:ins>`, preserving everything else. That's what `applyTrackedEdits` does.

## `applyTrackedEdits` — the engine

`docxTrackedChanges.ts` opens the `.docx` with `JSZip`, parses `word/document.xml` with `fast-xml-parser`, and for each requested edit:

1. **Locates the target text** across runs. Text in Word is fragmented into many `<w:r>` runs (a single sentence can span dozens), so the engine reconstructs the paragraph's plain text, finds the `find` string using the `context_before`/`context_after` anchors, and maps that back to the specific runs and character offsets.
2. **Computes a minimal diff** with `fast-diff` between the found text and the replacement, so only the truly-changed characters are marked (not the whole matched span).
3. **Emits tracked-change markup** — wrapping deleted characters in `<w:del>`/`<w:delText>` and inserted characters in `<w:ins>`/`<w:t>`, each with a unique `w:id` and the author ("Mike").
4. **Handles pre-existing tracked changes.** This is the subtle part, documented in the file's header comment: when the paragraph already contains tracked changes, they're presented to the matcher in *accepted view* (existing `w:ins` treated as normal text, existing `w:del` invisible). If a new edit lands on text inside a pre-existing `w:ins`, that wrapper is dropped (accepting the prior insertion) before the new change is emitted. This keeps the redline coherent across multiple rounds of editing.
5. There's also the backslash-path resilience (`getZipEntry`/`setZipEntry`) for archives that store entries with `\` separators, matching the same fix in `convert.ts` (Chapter 6).

It returns the edited bytes, a list of `AppliedChange` objects (each with its `w:id`, deleted/inserted text, and context), and a list of any edits that couldn't be applied (with reasons).

## `runEditDocument` — the orchestration

`applyTrackedEdits` only touches bytes. `runEditDocument` wraps it with all the database and storage bookkeeping:

1. **Load the document** and its current version bytes (`loadCurrentVersionBytes`).
2. **Apply the edits** via `applyTrackedEdits`. If *zero* changes applied, return an error telling the model to refine its context anchors and retry — a useful feedback loop, since the model can then read the document again and try better anchors.
3. **Persist a new version.** Here's the important versioning logic:
   - **Normally**, it uploads the edited bytes to a new path (`documents/<userId>/<docId>/edits/<versionId>.docx`), computes the next `version_number` (the counter spans `upload`/`user_upload`/`assistant_edit` so the original upload is V1 and the first assistant edit is V2), inherits the `display_name` from the most recent prior version (so user renames carry forward), and inserts a `document_versions` row with `source: "assistant_edit"`.
   - **But if `reuseVersion` is passed**, it overwrites the existing turn-scoped version's file in place and reuses the same version row. This collapses multiple `edit_document` calls *within a single assistant turn* into one version (more in Chapter 10).
4. **Record one `document_edits` row per change** — capturing the `change_id`, the deletion/insertion word ids (`del_w_id`/`ins_w_id`), the deleted/inserted text, the context, and `status: "pending"`. These rows are what the accept/reject flow later operates on.
5. **Update `documents.current_version_id`** to point at the new version.
6. **Build annotations** — one `EditAnnotation` per change, carrying everything the UI needs to render an Accept/Reject card (edit id, version, the diff, the reason).
7. **Build a permalink** with `buildDownloadUrl` (a signed, non-expiring token; Chapter 17) so the edited document can be downloaded.

It returns `{ok: true, version_id, version_number, storage_path, download_url, annotations, errors}`.

## The result the user sees

`runToolCalls` turns this into a `doc_edited` event carrying the filename, document id, version, download URL, and the annotations array. The frontend renders:

- A **download card** for the edited document (the redlined `.docx`).
- One **Accept/Reject card per change**, showing the deleted text, the inserted text, and the model's reason.

When the user accepts or rejects a change, a separate route in `documents.ts` (`resolveTrackedChange` / `extractTrackedChangeIds`) collapses *that one change* in the XML — keeping the insertion and dropping the deletion (accept) or vice versa (reject) — producing yet another version (`source: "user_accept"`/`"user_reject"`). The `document_edits.status` is updated accordingly.

## Why this is hard and why it matters

Tracked changes are genuinely difficult because:

- Word fragments text across many runs, so "find this phrase" is not a simple string search.
- The same phrase can appear in multiple places, hence the context anchors.
- Documents may already contain redlines from prior rounds, which must be reconciled.
- The output must be valid OOXML that Word opens cleanly with the changes shown.

But it matters enormously for the legal audience: lawyers *live* in tracked changes. An AI that rewrites a contract wholesale is useless to them; an AI that proposes precise redlines they can accept or reject one by one fits directly into how they already work. This feature is a big part of what makes KD feel built *for lawyers* rather than adapted to them.

---

Next: [Chapter 10 — Document versioning and the accept/reject lifecycle](chapter-10-versioning.md)
