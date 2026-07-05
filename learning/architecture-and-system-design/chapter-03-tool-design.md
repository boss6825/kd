# Chapter 3 — Tool Design

Tools are how an agent acts. The set of tools defines what an agent *can* do; the *design* of those tools determines whether the model uses them correctly. This chapter is about designing tools and their schemas well — arguably the highest-leverage skill in building agents, because a well-designed tool turns an unreliable model into a reliable system, and a badly-designed one does the opposite.

## What a tool is

A tool is a function the model can call, exposed to it as a schema with three parts:

- **A name** — the identifier the model emits to call it.
- **A description** — natural-language instructions telling the model what the tool does and when/how to use it.
- **A parameter schema** — typically JSON Schema, defining the arguments and their types.

When the model wants to act, it emits a tool call: the name plus arguments matching the schema. Your code runs the corresponding function and returns a result, which the model reads. The description and schema are the *entire interface* the model has to your capability — so they must teach, not just declare.

## The description is a prompt

The single most important idea in tool design: **a tool description is a mini system prompt for that capability.** The model decides whether and how to call a tool almost entirely from its description. So descriptions should:

- **State when to use the tool**, not just what it does. "Always call this before answering questions about a document" is far more effective than "reads a document."
- **State how to use it well.** "Make minimal substitutions of specific words, not whole-line replacements" shapes the model's behaviour decisively.
- **Encode the intended workflow.** If tool B should follow tool A, say so in both descriptions ("after searching, call read_X with the id from the results"). The model learns the sequence.
- **Warn about pitfalls.** "Wrong codes silently return zero results, so prefer free-text search over guessing."

Time spent sharpening descriptions usually beats time spent tweaking the system prompt, because descriptions are read exactly when the decision is being made.

## Granularity: how big should a tool be?

A central design question is tool *granularity* — too fine and the model drowns in calls; too coarse and it can't express what it needs.

- **Too granular** — `open_file`, `read_line`, `close_file` forces the model to orchestrate plumbing. Prefer `read_document`.
- **Too coarse** — a single `do_everything` tool with a giant polymorphic schema confuses the model about what it can actually do.
- **Right-sized** — each tool maps to one meaningful user-level action. "Read a document," "search case law," "generate a document," "edit a document."

A good test: each tool should correspond to a verb a *user* would recognise. If you can't describe the tool in one clear sentence, it's probably mis-sized.

## The cheap/expensive pairing

A recurring, valuable pattern: offer a **cheap, narrow** variant alongside an **expensive, broad** one, so the model can pick the right cost for the task.

- "Find this phrase in the document" (cheap, targeted) vs. "read the whole document" (expensive, complete).
- "Get just the metadata" (cheap) vs. "fetch the full text" (expensive).
- "List what's available" (cheap discovery) vs. "fetch these N items" (expensive retrieval).

Without the cheap option, the model pays full price for every lookup — more tokens, more latency, more cost. The cheap variant lets it confirm a fact or locate a needle without ingesting a haystack. Give the model economical options and it will often use them.

## Batching

When the model commonly needs N of something, give it a tool that does N at once rather than forcing N separate calls. "Fetch these documents" (a list) beats N× "fetch this document." Batching cuts round-trips, which cuts latency and loop iterations. Cap the batch size in the schema to prevent abuse.

## Schema discipline

The parameter schema is your guardrail against malformed calls. Tighten it:

- **Use enums** for fields with a fixed set of values. The model can't send an invalid option.
- **Use bounds** (`minimum`/`maximum`) for numbers. "Create up to 20 copies," not unbounded.
- **Mark required fields** explicitly, and keep optional fields genuinely optional.
- **Describe each field**, not just the tool. A field description like "~40 characters immediately preceding the target text, used to disambiguate" teaches the model how to fill it.
- **Keep schemas flat where possible.** Deeply nested schemas are harder for models to fill correctly.

A tight schema reduces the rate of malformed calls, which reduces error-recovery loops, which improves latency and reliability.

## Structured input for deterministic output

When a tool produces formatted output (a document, a spreadsheet), prefer **structured input** over free text. Instead of "generate a contract" taking a blob of prose, have it take an array of sections with headings, levels, and tables. Then *your code* applies the formatting deterministically. This:

- moves formatting from the unreliable model to reliable code,
- lets you enforce house style/numbering/branding,
- and makes the model responsible only for content.

Tell the model what *not* to do (don't type the numbers, don't repeat the title) because your generator handles those. This division — model decides content, code decides format — is one of the most reliable patterns for producing polished artifacts.

## Tool results are also an interface

The *result* you return is read by the model, so design it too:

- **Return useful errors, not exceptions.** If a tool can't do the thing, return a message the model can act on: "No edits applied; refine your context anchors and retry." The model will adapt. A thrown exception just crashes the turn.
- **Reinforce instructions at the point of use.** Returning a document? Prepend a short reminder of how to cite it. Instructions delivered alongside the data are obeyed more reliably than ones only in the system prompt.
- **Distill, don't dump.** If a tool calls an external API with a huge response, return the decision-relevant fields and cap long ones, rather than flooding the context. Leave a separate tool for "get more detail" when needed. (See Chapters 5 and 7.)
- **Keep results stable and parseable** if your code will read them too.

## Scoping tools to the surface

Not every tool belongs in every context. A tool to "list documents in this folder" makes no sense in a chat with no folder. Offer each tool only where it's meaningful. This keeps the model focused on the relevant capabilities and avoids it attempting actions that can't succeed. Compose the active tool set per surface (general chat, project chat, bulk-extraction chat) from a shared base plus surface-specific extras.

## Tools and the provider abstraction

If you support multiple model providers (Chapter 4), define your tools once in a single canonical schema format and convert to each provider's dialect at the boundary. Then adding a tool is purely additive — one schema, one executor branch — and it works across every model. Don't let provider-specific tool formats leak into your tool definitions.

## A checklist for a well-designed tool

- Does its name map to a recognisable user-level action?
- Does its description say *when* and *how* to use it, not just *what* it does?
- Does it chain to related tools where relevant?
- Is there a cheaper variant for the common case?
- Can the model batch when it needs many?
- Is the schema tight (enums, bounds, required, field descriptions)?
- For formatted output, does it take structured input?
- Does its result return useful errors and distilled (not dumped) data?
- Is it offered only on surfaces where it makes sense?

---

Next: [Chapter 4 — Model-provider abstraction and multi-model strategy](chapter-04-provider-abstraction.md)
