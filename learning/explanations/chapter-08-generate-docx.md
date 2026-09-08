# Chapter 8 — Generating Word Documents

When a lawyer asks KD to "draft an NDA" or "generate a conditions-precedent checklist," the model calls `generate_docx`, and KD turns the model's structured JSON into a real, properly-formatted Microsoft Word file. This chapter explains the `generateDocx` function in `src/lib/chatTools.ts` — especially the legal numbering engine, which is the part that makes the output look like a lawyer wrote it.

## Why structured input, not raw text

Recall the `generate_docx` schema (Chapter 4): the model doesn't hand over a blob of text. It hands over a `title`, a `landscape` flag, and an array of `sections`, where each section has an optional `heading` + `level`, `content` prose, a `pageBreak` flag, and/or a `table`. This structure is the whole point. It lets KD apply formatting **deterministically** in code rather than trusting the model to produce correct Word styling. The model decides *what* the document says; KD decides *how* it looks.

## The `docx` library

`generateDocx` uses the [`docx`](https://www.npmjs.com/package/docx) npm library, imported lazily inside the function (`await import("docx")`) so the dependency only loads when actually needed. From it KD pulls `Document`, `Paragraph`, `HeadingLevel`, `Packer`, `Table`, `TableRow`, `TableCell`, `TextRun`, `AlignmentType`, `LevelFormat`, `LevelSuffix`, `PageOrientation`, `PageBreak`, and more.

It sets a consistent house style up front: **Times New Roman, 11pt** (`SIZE = 22` in half-points) — a conventional legal typeface.

## The title

Every generated document opens with a centred, bold, uppercased title paragraph (`HeadingLevel.TITLE`). This is why the system prompt tells the model *not* to repeat the title as the first heading — the generator already renders it.

## The legal numbering engine

This is the centrepiece. Legal documents have a rigid, multi-level numbering convention, and `generateDocx` encodes it as a custom `docx` numbering definition referenced by `LEGAL_NUMBERING_REF = "legal-clause-numbering"`. The levels are:

| Level | Format | Renders as |
|---|---|---|
| 0 | `DECIMAL`, `%1.` | `1.`, `2.`, `3.` (top-level operative headings, bold) |
| 1 | `DECIMAL`, `%1.%2` | `1.1`, `1.2` (first numbered body clauses) |
| 2 | lower-letter | `(a)`, `(b)`, `(c)` |
| 3 | lower-roman | `(i)`, `(ii)`, `(iii)` |
| 4 | upper-letter | `(A)`, `(B)`, `(C)` |

Each level carries its own indentation and run styling (bold, font, size). The `legalNumbering(level)` helper clamps the requested level into the 0–4 range and returns the `{reference, level}` object that attaches a paragraph to this numbering scheme.

This is exactly the scheme the system prompt describes to the model, which is why the two must stay in sync: the prompt tells the model "first body clause renders as 1.1, nested as (a)…", and this code is what actually makes that happen. The model supplies the hierarchy (via heading `level` and content structure); the generator supplies the numbers. The model is explicitly told **not** to type numbers into its text, because the generator adds them — typing "1. Introduction" would render as "1. 1. Introduction".

## Headings vs body clauses

The generator distinguishes:

- **Headings** — rendered with `HeadingLevel.HEADING_1..4`, used for section titles.
- **Body clauses** — numbered paragraphs under a heading, attached to the legal numbering scheme.

The heading hierarchy is constrained (H1 before H2 before H3, never skipping), matching the prompt's rules, so the document outline stays well-formed.

## Tables

A section can carry a `table` with `headers` and `rows`. The generator builds a `docx` `Table` with bordered cells (a light grey `CCCCCC` single border), a header row, and one `TableRow` per data row. This is how the conditions-precedent checklist workflow (Chapter 12) produces its four-column tables (Index, Clause Number, Clause, Status) — the workflow prompt tells the model to use the `table` field, and the generator renders it.

## Page breaks and signatures

A section with `pageBreak: true` starts on a fresh page (a `PageBreak` is inserted). This is used for the contract **signature block**, which the prompt requires to be on its own page and entirely unnumbered — plain "By:", "Name:", "Title:", "Date:" lines for each party. The generator honours the flag; the prompt ensures the model sets it.

## Orientation

The `landscape` option flips the page to landscape via `PageOrientation`. The CP-checklist workflow passes `landscape: true` because wide tables read better sideways.

## Packing and storing

Once all the `children` (paragraphs and tables) are assembled into a `Document`, `Packer` serialises it to a `.docx` byte buffer. From there, `generateDocx` (and its caller in `runToolCalls`) stores it like any other document:

- Uploads the bytes to R2 under a generated-doc key.
- Creates a `documents` row and a `document_versions` V1 row with `source: "generated"`.
- If a `projectId` was passed (project chats), the document is attached to the project so it appears in the sidebar; otherwise it's a standalone document. (This is the `projectId` plumbed all the way down from `runLLMStream`.)
- Returns a `doc_created` result carrying the filename, a signed download URL, the document id, and the version id.

`runToolCalls` records this as a `doc_created` event, which becomes a download card in the UI. Because the document is now a real, stored document with a `doc_id`, the model can immediately `read_document` it (which the prompt requires before describing it) and `edit_document` it on follow-up.

## The full round trip

So the complete flow for "draft an NDA" is:

1. Model calls `generate_docx` with structured sections.
2. `generateDocx` builds and packs a styled `.docx`.
3. The file is stored, a document + V1 version row are created, a `doc_created` event fires, and a download card appears.
4. The model calls `read_document` on the new doc to ground its description.
5. The model writes a short prose summary (referring to the file by name, no links) and cites the generated document.

The result is a downloadable Word file with correct legal numbering, a proper title, tables where needed, and a signature page — produced deterministically, with the model responsible only for content.

---

Next: [Chapter 9 — Editing documents as tracked changes](chapter-09-edit-tracked-changes.md)
