# Chapter 6: Prompt Architecture

The prompt is the agent's constitution, written in prose. It defines who the agent is, what rules bind it, and, crucially, the structured protocols it must emit so your code can parse its output. This chapter is about architecting prompts so they're effective, maintainable, and don't rot as the system grows.

## The system prompt is a contract

Think of the system prompt as a contract between you and the model: "behave like this, follow these rules, emit output in these formats." It's the one piece of context present on every call, so it carries the agent's *invariant* behaviour: the things true regardless of the specific task. Keep task-specific instructions out of it (load those on demand; Chapter 5) so it stays focused on the universal.

A good system prompt typically covers:

- **Identity and scope**: who the agent is, who it serves, what it does. One or two sentences set the persona.
- **Output protocols**: any machine-readable formats the model must produce (see below).
- **Behavioural rules**: how to do the core tasks well, including domain consequences.
- **Guardrails**: what never to do (fabricate, leak internal identifiers, etc.).

## Emitted protocols: the model's structured output channel

The most powerful prompt-architecture idea is to **define a structured format that the model emits and your code parses deterministically.** Rather than trying to extract meaning from free-form prose ("did it cite anything?"), instruct the model to append a strict, machine-readable block, then parse it.

Examples of emitted protocols:

- A trailing JSON block of citations, each mapping an inline marker to a source, page, and verbatim quote.
- Inline tagged values like `[[Yes]]`, `[[USD]]`, or `[[page:3||quote:...]]` that your code reliably extracts.
- A marker convention that triggers behaviour (a message prefix that means "apply this template").

The pattern is always: **the model produces structure, your code consumes it.** This turns the model from a prose generator into a structured-data source you can build features on (clickable citations, typed spreadsheet cells, triggered workflows). Define the protocol precisely, give an example, and parse it with a simple, deterministic parser (a regex or JSON parse), not another model call.

When you stream output to a user, remember to **hide the protocol** from the visible stream: buffer just enough to detect the block boundary so the user sees clean prose while your code still gets the structured trailer. (Chapter 8.)

## Write rules as consequences, not just actions

For domain agents, the difference between a toy and a trustworthy tool is often in the rules that encode *consequences*. "Edit the text" is an action. "Any edit that adds or removes a numbered item shifts every following number, so renumber the siblings and update every cross-reference to them in the same edit" is a consequence. The second is hard-won domain expertise expressed as instruction, and it's what makes the agent safe to use on real work. Capture your experts' knowledge as these consequence-rules.

## Push determinism into code; tell the model what not to do

When output formatting is rule-bound and deterministic, don't ask the model to format; do it in code, and use the prompt to keep the model from *fighting* your formatter. If your generator applies numbering automatically, tell the model "do not type the numbers yourself." If it renders the title, tell it "do not repeat the title as a heading." The prompt's job here is negative: prevent the model from duplicating work the code does deterministically. This division yields consistent, polished output.

## Reinforce critical rules at the point of use

A rule stated once in a long system prompt competes with everything else for the model's attention. For the rules that matter most, **repeat them where the relevant action happens**: in the tool description, and inside the tool's result. "Read before you answer" belongs in the system prompt *and* the read tool's description *and* as a reminder prepended to document content. Redundant reinforcement at the decision point measurably improves compliance.

## Use emphasis surgically

Models respond to emphasis (capitalisation, "MUST," "NEVER"), but if everything is emphasised, nothing is. Reserve strong emphasis for the one or two things that are *always* misunderstood without it: the single most error-prone rule. Over-emphasised prompts read as shouting and lose their signal.

## Layered assembly and maintainability

Architect the final prompt as a base plus appendices assembled at runtime:

- A static base system prompt (the invariant constitution).
- Surface-specific appendices (a project context section, a bulk-extraction section) concatenated when relevant.
- A dynamic situational section (the list of what's available to act on).

This keeps the base prompt stable and version-controllable, while letting each surface add only what it needs. It also makes the prompt *testable*: you can assert that the project appendix appears in project chats and not elsewhere.

For maintainability:

- **Keep prompts in version control**, reviewed like code, because they *are* behaviour.
- **Comment the why** where a rule is non-obvious (a workaround for a known model quirk).
- **Avoid duplicating the same rule in five places** unless it's deliberate point-of-use reinforcement; otherwise updates drift out of sync.
- **Keep the prompt and the code in sync.** If the prompt says "the generator numbers clauses as 1.1, (a), (i)," the generator must actually do that. A prompt that describes behaviour the code doesn't implement is a bug waiting to happen.

## Don't over-prompt

A failure mode is the ever-growing prompt: every bug spawns another paragraph until the prompt is thousands of lines and the model can't prioritise. Resist. Prefer:

- moving task-specific instructions into loadable templates,
- moving deterministic formatting into code,
- and fixing systemic issues (better tools, better context) rather than papering over them with more prose.

A focused prompt that the model actually follows beats an exhaustive one it can't prioritise.

## Testing prompts

Prompts deserve evaluation like any other component (Chapter 15). Maintain a set of representative inputs and check that the model's behaviour matches the rules: does it cite correctly, does it apply the template when triggered, does it avoid the forbidden outputs? When you change a rule, re-run the set to catch regressions. Prompt changes are deploys; treat them with the same care.

---

Next: [Chapter 7: Retrieval: RAG vs tools vs long context](chapter-07-retrieval-strategies.md)
