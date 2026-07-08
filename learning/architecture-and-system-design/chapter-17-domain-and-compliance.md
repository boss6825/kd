# Chapter 17: Domain-Specific and Regulated-Industry Agents

General-purpose agent patterns get you most of the way, but agents for *regulated professional domains* (law, medicine, finance, accounting) carry extra obligations. The cost of a confident wrong answer is high, the users are experts who will notice errors, and the work product may end up in court, a chart, or an audit. This chapter covers what changes when you build an agent for a domain where being wrong has consequences.

## The defining constraint: trust requires verifiability

In consumer settings, a plausible answer is often good enough. In professional settings, an answer the expert *cannot verify* is worse than no answer, because acting on an unverifiable claim is a liability. So the organizing principle for domain agents is: **every consequential claim must be traceable to a source the expert can check.** This single requirement drives most of the design differences below.

## Grounding and citation as first-class features

For a domain agent, citations aren't a nice-to-have; they're the product. Design so that:

- **The model only asserts what it can ground.** Instruct it to base claims on retrieved source content, never on training-data recall, and to refuse or hedge when it lacks a source. "Do not fabricate" is a load-bearing rule, not boilerplate.
- **Citations are precise and verbatim.** A citation should point to an exact location (page, section, paragraph) and quote the source verbatim, so the expert can confirm it in seconds. Approximate or paraphrased citations defeat the purpose. (This is why tool-based reading with location markers often beats lossy retrieval for these domains, Chapter 7.)
- **Citations are machine-checkable.** Use an emitted citation protocol (Chapter 6) that your code can parse *and validate*: confirm the quoted text actually appears at the cited location before showing it. Catching a hallucinated citation automatically is a powerful safety net.
- **The UI makes verification effortless.** Click a citation, jump to the exact place in the source, see the quote highlighted. Lowering the cost of checking is what makes the agent usable for careful professionals.

## Fit the professional's actual workflow

Domain experts have established workflows and artifacts, and an agent that ignores them feels foreign. Meet them where they are:

- **Produce the artifacts they use.** Lawyers live in tracked changes; an agent that proposes redlines they can accept or reject one by one fits their process, while one that silently rewrites a contract is useless to them. Clinicians, accountants, and analysts each have their own native formats and review rituals: produce those.
- **Propose, don't impose.** For consequential changes, the agent proposes and the human commits (the accept/reject pattern). This keeps the professional in control and accountable, which is both a trust and a liability requirement.
- **Encode domain conventions.** Formatting, numbering, terminology, and structure that the domain expects should be applied deterministically (Chapter 3), and the prompt should encode the *consequences* of actions in domain terms (Chapter 6), e.g. "renumber and update every cross-reference when you change a numbered clause." This embedded expertise is what separates a credible tool from a generic one.

## Audit trails and record-keeping

Regulated work must often be reconstructable after the fact: who did what, when, based on what. The data-model patterns from Chapter 9 become compliance requirements:

- **Immutable, sourced versions.** Every state of an artifact is preserved, each labeled with how it arose (uploaded, agent-generated, agent-edited, human-accepted, human-rejected). This *is* an audit trail.
- **Complete turn records.** The conversation event log captures what the agent did, what it read, and what it produced: a defensible record of the agent's reasoning and actions.
- **Resolution tracking.** When a human accepts or rejects an agent suggestion, that decision and its timestamp are recorded, so accountability is clear.

Design these in from the start; retrofitting an audit trail is painful and often incomplete.

## Data protection and confidentiality

Professional data is confidential by law or contract (privilege, PHI, MNPI, client confidentiality):

- **Strict isolation and access control** (Chapter 11), often beyond the baseline: a leak across clients/matters/patients can be a regulatory event, not just a bug.
- **Encryption** at rest and in transit, and careful handling of where data flows, including *to the model provider*. Know your provider's data-handling terms; some domains require that content not be retained or used for training, which may dictate provider choice, enterprise agreements, or BYOK so the customer's own provider relationship governs the data.
- **Data residency and retention** rules may constrain where you store data and for how long, and may require deletion workflows.
- **Minimize exposure.** Send the model what the task needs, not everything; redact where feasible.

These constraints can shape architecture decisions as much as performance does.

## Appropriate confidence and boundaries

Domain agents must be careful about the *kind* of statements they make:

- **Distinguish information from advice.** Many domains draw a legal line between providing information and giving professional advice (legal, medical, financial). The agent should inform and assist the professional, not purport to replace their judgment, and should be explicit about that boundary where appropriate.
- **Calibrate confidence.** Hedge when the sources are ambiguous; don't manufacture certainty. Surfacing uncertainty is more valuable than false confidence to an expert who will rely on the output.
- **Stay within scope.** Define what the agent does and doesn't do, and have it decline gracefully outside that scope rather than improvising in high-stakes territory.

## Domain integrations

Professional domains have authoritative external systems: case-law databases, court dockets, medical references, market-data feeds, regulatory filings. Integrating them (as tools, Chapter 3) makes the agent far more useful, but with care:

- **Cite the authoritative source,** not the model's memory of it.
- **Distinguish kinds of sources** with different authority (e.g. binding precedent vs. live case status; primary vs. secondary references) and guide the model to use each correctly.
- **Distill and cap** large authoritative payloads before they reach the model (Chapter 7), but preserve the source link so the expert can go to the original.
- **Cache** these often slow, rate-limited, sometimes costly services (Chapter 9).

## Evaluation with domain rigor

The evaluation discipline (Chapter 15) needs domain-specific teeth:

- **Citation-accuracy checks**: verify cited quotes exist at cited locations; flag any that don't.
- **Domain-expert review** in the loop for quality, especially for high-stakes outputs, because automated graders can't fully judge professional correctness.
- **Regression sets drawn from real cases**, including the subtle errors that matter in the domain (a wrong cross-reference, a misread clause, a missed exception).
- **Track grounding/faithfulness as a primary metric**, not an afterthought.

## Compliance as an ongoing practice

Compliance isn't a one-time checkbox:

- **Know the regimes** that apply (data protection, sector rules, professional-conduct rules) and design to them.
- **Keep the documentation** (audit trails, access logs, data-flow records) that demonstrates compliance when asked.
- **Plan for review and change**: regulations and professional standards evolve; the system must be adaptable, and the prompt/rules version-controlled and reviewable.

## The throughline

A regulated-domain agent is a general agent plus a relentless commitment to **verifiability, fit, and accountability**: every claim traceable to a checkable source; outputs in the professional's own artifacts and workflow with the human in control; a complete immutable audit trail; strict confidentiality and data handling; calibrated, in-scope confidence; and evaluation rigorous enough to trust. The patterns from the earlier chapters all still apply; these are the additional, non-negotiable obligations that come with building for people whose work has consequences.

---

Next: [Chapter 18: Reference architecture and a design checklist](chapter-18-reference-architecture.md)
