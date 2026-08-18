# Chapter 5 — The System Prompt and Prompt Engineering

The system prompt is the constitution of the agent. It defines who Mike is, how it must cite, how it must draft and number legal documents, how it must name documents in prose, and how it must conduct research. KD's prompt is the `SYSTEM_PROMPT` constant in `src/lib/chatTools.ts` — about 70 lines of dense, carefully-worded instruction. This chapter reads it closely, because the prompt is as much a part of the product as the code.

## The identity line

```
You are Mike, an AI legal assistant that helps lawyers and legal professionals
analyze documents, answer legal questions, and draft legal documents.
```

One sentence. It sets the persona (Mike), the audience (lawyers), and the scope (analyse, answer, draft). Everything that follows is rules for doing those three things well.

## The citation protocol

The largest section of the prompt defines a **machine-readable citation format**. When the model references document content, it places a numbered marker like `[1]` inline, and at the very end of the response it appends a `<CITATIONS>` block — a JSON array where each entry has `ref`, `doc_id`, `page`, and `quote`:

```json
<CITATIONS>
[
  {"ref": 1, "doc_id": "doc-0", "page": 3, "quote": "exact verbatim text"},
  {"ref": 2, "doc_id": "doc-1", "page": "41-42", "quote": "spans a [[PAGE_BREAK]] boundary"}
]
</CITATIONS>
```

The prompt is emphatic about one easy-to-get-wrong point, in all caps: **the number in `[N]` is the `ref` value, not a page number, footnote, or section number.** Refs are simple sequential integers (1, 2, 3…) assigned in order of appearance. This precision exists because the frontend turns each `[N]` into a clickable citation that scrolls the PDF to the cited page and highlights the quote — so the `ref → entry` mapping must be exact.

Other citation rules worth noting:

- Only cite text that appears **verbatim** in the documents.
- `doc_id` must be the exact chat-local label (`doc-0`), never a filename or UUID.
- Quotes should be short (≤ 25 words) and narrowly scoped; don't reuse one quote for multiple claims.
- `page` refers to the sequential `[Page N]` marker in the text the model was given (Chapter 7), **ignoring** any page numbers printed inside the document itself.
- For a quote spanning two pages, set `page` to `"N-M"` and insert `[[PAGE_BREAK]]` at the boundary.
- Put the block at the very end; omit it entirely if there are no citations.

This is a beautiful example of designing a protocol *for the model to emit*. Rather than parsing free-form "(see page 3)" text, KD defines a strict format and instructs the model to produce it, then parses it deterministically with a regex (`CITATIONS_BLOCK_RE`).

## The DOCX generation rules

A long section governs `generate_docx`:

- **Use the tool, don't inline.** If asked to draft a document, call `generate_docx` rather than printing the document in chat.
- **Prefer editing over regenerating.** If the user follows up on a just-generated document ("make section 3 longer"), default to `edit_document` on that doc, not a fresh `generate_docx`.
- **No download links in prose.** After generating, the UI shows a download card automatically, so the model must not write links or describe layout.
- **Read before describing.** After `generate_docx`, the model **must** call `read_document` on the returned doc before writing its prose summary — so the description is grounded in the actual generated text, not the model's intention. This is a subtle but powerful anti-hallucination rule.
- **Describe the document briefly** (3–8 sentences), referring to it by filename, and cite the generated document with `[N]` markers if making factual claims about it.

Then come the **numbering and formatting rules**, which are remarkably specific because legal documents have rigid conventions:

- Heading hierarchy must never skip levels (H1 before H2 before H3).
- All numbering starts at 1, never 0.
- The generator applies legal clause numbering automatically: top-level headings render as `1.`, `2.`; first body clauses as `1.1`; nested as `(a)`, `(b)`; deeper as `(i)`, `(ii)`, then `(A)`, `(B)`. The model must **not** type numbers into heading text (which would double them up).
- Don't repeat the title as the first heading (the generator renders the title centred already).
- Contracts must end with an **unnumbered** signature block on its own page (`pageBreak: true`), and the preamble/recitals/WHEREAS clauses must also be unnumbered.

The lesson: when output formatting is deterministic and rule-bound, push the rules into the generator and tell the model what *not* to do, rather than hoping it formats correctly.

## The document-editing rules

The editing section teaches the model the *consequences* of edits:

- Any edit that adds/removes/reorders a numbered clause **shifts every downstream number**, and the model must renumber siblings *and* update every cross-reference ("see Section 5", "pursuant to Clause 4.2(b)") in the same `edit_document` call.
- Before editing, scan the whole document to enumerate affected cross-references — don't assume they're only near the change.
- When deleting square brackets, delete both `[` and `]` — never leave an unmatched bracket.

These rules reflect hard-won knowledge about how legal documents break. They're the kind of domain expertise that turns a generic "edit text" capability into something a lawyer can trust.

## The workflow trigger

```
When a user message begins with a [Workflow: <title> (id: <id>)] marker… you MUST
apply it. Immediately call the read_workflow tool with that exact id…
```

This wires the workflow feature (Chapter 12) into the model's behaviour: the marker is the instruction, no confirmation needed.

## The document-naming rule

A whole paragraph insists that the `doc-0`/`doc-1` labels are **internal handles for tool calls and citation JSON only** — they must *never* appear in prose the user reads. In prose, always use the filename ("the NDA draft", "nda_v1.docx"). This exists because the labels are jarring to users and meaningless to them. It's a small UX rule enforced via prompt.

## The research behaviour

Two sections script the research tools:

- **Case-law research (Indian Kanoon):** identify the legal issues from the documents → `search_case_law` with a focused query → pick on-point judgments and `read_judgment` → summarise how prior courts decided and how it applies, citing by case name and source URL. Never invent judgments.
- **Live case records (eCourts):** use `find_indian_case` with a CNR or search filters → refer to cases as "petitioner vs respondent" → the full order text comes free in the case detail, so only call `get_indian_case_order_analysis` when you specifically need the AI analysis. It explicitly distinguishes the two systems: eCourts = live docket; Indian Kanoon = published precedent.

## The general guardrails

The closing list is short and firm: be precise and professional; cite specific documents and quotes; when no documents are provided, answer from legal knowledge; **do not fabricate document content**; no emojis.

## How the prompt is assembled at runtime

The static `SYSTEM_PROMPT` is only the base. In `buildMessages` (Chapter 11), KD appends:

- An optional `systemPromptExtra` (project chats add a "PROJECT CONTEXT" section; tabular chats add their own).
- An "AVAILABLE DOCUMENTS" block listing each `doc_id` and filename (with folder path in projects).
- A blunt reminder: *"You do NOT retain document content between conversation turns. You MUST call read_document… even if you have read it in a previous turn. Failure to do so will result in hallucinated or stale content."*

So the final system prompt the model sees is the constitution plus a per-request appendix describing the current document context.

## Takeaways for prompt engineering

- **Define protocols the model emits, then parse them.** The `<CITATIONS>` block is the model's structured output channel.
- **Push deterministic formatting into code; tell the model what not to do.** The numbering rules are enforced by the generator; the prompt just prevents the model from fighting it.
- **Encode domain consequences, not just actions.** The renumbering/cross-reference rules are legal expertise expressed as instructions.
- **Use ALL CAPS sparingly for the one thing that's always misunderstood** (the `ref` ≠ page-number rule).
- **Reinforce the same rule from two directions** (the tool description *and* the system prompt both say "read before you answer").

---

Next: [Chapter 6 — Document ingestion: upload, storage, and conversion](chapter-06-ingestion.md)
