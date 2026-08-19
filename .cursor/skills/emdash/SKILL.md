---
name: emdash
description: >-
  Remove em dashes (—) from markdown prose and replace them with suitable
  punctuation. Use when the user asks to remove em dashes, de-emdash a file,
  or clean up chapter markdown in learning/architecture-and-system-design.
---

# Remove Em Dashes

Replace every Unicode em dash (`—`, U+2014) with context-appropriate punctuation. Change nothing else: no rewording, no formatting changes, no en-dash or hyphen edits.

## Strict rules

1. **Only replace `—`**. Do not touch en dashes (`–`, U+2013) used in ranges (`5–15`), compound labels (`Planner–executor`), or chapter spans (`Chapters 8–18`).
2. **Do not change anything else**: wording, italics, bold, links, headings structure, or whitespace beyond what the replacement requires.
3. **Verify**: after editing, grep for `—` and confirm zero matches in the target file(s).

## Replacement patterns

Apply the first matching pattern:

| Context | Replace with | Example |
|---------|--------------|---------|
| Chapter title or nav link: `Chapter N — Title` | Colon | `Chapter 3: Tool design` |
| Bold label followed by explanation | Colon after label | `**Natural termination**: the model produces...` |
| Term followed by defining phrase | Comma | `The LLM itself, the reasoning engine.` |
| Contrast / negation (`X — not Y`) | Comma | `you orchestrate, not as the system itself` |
| Mid-sentence aside or clarification | Parentheses | `*Context engineering* (deciding what the model sees) is where...` |
| Enumeration after a noun | Colon | `the surrounding system: storage, external APIs` |
| List of parallel actions or consequences | Commas | `loop forever, calling a tool, getting a result...` |
| Chapter cross-reference at end of clause | Comma | `as it happens, Chapter 8` |
| Two independent clauses where em dash acted as break | Semicolon | `from the final text afterward; capture it as it occurs` |
| Label + short follow-on in a list item | Colon | `coordinate: a "researcher" hands off...` |

When multiple patterns fit, prefer the option that reads most naturally in context while changing the fewest surrounding characters.

## Workflow

1. Read the target file(s).
2. Find every `—` (grep or search).
3. For each occurrence, pick the replacement from the table above.
4. Apply edits with search-and-replace or a single write; do not paraphrase.
5. Grep again to confirm no `—` remain.
6. Skim the file to ensure meaning and tone are unchanged.

## Examples from this project

**Before → After**

- `# Chapter 1 — Anatomy of an AI Agent` → `# Chapter 1: Anatomy of an AI Agent`
- `holds a conversation — it has history — but` → `holds a conversation: it has history, but`
- `*Tool design* — what actions exist and how they're described — is where` → `*Tool design* (what actions exist and how they're described) is where`
- `**You own the loop explicitly** — your code` → `**You own the loop explicitly**: your code`
- `the *control* — the cap, the termination logic, the event recording — should be yours` → `the *control* (the cap, the termination logic, the event recording) should be yours`

## Default scope

When the user points at `learning/architecture-and-system-design/`, process only the file(s) they name. For "rest of the chapters," apply the same rules file by file across that folder.
