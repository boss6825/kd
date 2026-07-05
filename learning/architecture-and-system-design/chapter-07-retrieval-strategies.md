# Chapter 7 — Retrieval: RAG vs Tools vs Long Context

An agent is only as good as the information it can bring to bear. Getting the right facts in front of the model is the *retrieval* problem, and there are three broad strategies: stuff everything into a long context, retrieve relevant chunks (RAG), or let the model fetch what it needs through tools. This chapter compares them and explains when each wins — and why a tool-based approach is often the right default for document agents.

## The three strategies

### 1. Long context ("just include it")

Put the relevant documents directly into the prompt and let the large context window hold them. Simple, no infrastructure.

- **Wins when:** the total content is small relative to the window, the task needs the *whole* document (not a snippet), and you can afford the tokens.
- **Loses when:** content is large (cost and latency balloon), there's a lot of it (the model gets "lost in the middle" and quality drops), or it changes often (you re-send it every call).

### 2. Retrieval-augmented generation (RAG)

Pre-process documents into chunks, embed them into a vector store, and at query time retrieve the most semantically similar chunks to inject into context.

- **Wins when:** you have a large corpus, queries are answerable from *fragments*, and you need to search across many documents by meaning rather than exact text.
- **Loses when:** the task needs whole-document understanding (chunking fragments the structure), exactness matters (embeddings retrieve "similar," not "the exact clause"), or you need verbatim quotes with precise locations (chunk boundaries and approximate retrieval undermine citation precision). RAG also adds real infrastructure: an embedding pipeline, a vector DB, chunking strategy, and retrieval tuning.

### 3. Tool-based retrieval ("let the model fetch")

Give the model tools to read and search content on demand — "read this document," "find this phrase," "list what's available" — and let *it* decide what to pull, driven by the task.

- **Wins when:** the model can reason about *what* it needs (it knows it wants "the termination clause"), exactness matters, you need whole-document or targeted reads, and content changes (tools always fetch the current version).
- **Loses when:** the corpus is so large the model can't even know what exists without help (then you add a search/list tool, blending toward RAG), or when latency from multiple fetch round-trips is unacceptable.

## Why tools are often the right default for document agents

For an agent working with a bounded, identified set of documents (a user's files, a project folder, a matter), tool-based retrieval tends to win for several reasons:

- **Exactness and citations.** When the model reads the actual document text (paginated, complete) rather than approximate chunks, it can quote verbatim and cite precise locations. For domains where citation accuracy is the whole point (law, medicine, finance), this is decisive.
- **Freshness.** Tools fetch the current version every time, so edits and updates are reflected automatically. A vector index, by contrast, must be re-embedded when content changes.
- **Grounding.** Forcing the model to explicitly fetch content makes it engage with the real text instead of leaning on training-data priors.
- **Simplicity.** No embedding pipeline, no vector store, no chunking strategy to tune. The model's own reasoning *is* the retrieval policy.
- **Whole-document tasks.** Summarising or editing a contract needs the whole thing in coherent order, which chunked retrieval handles poorly.

The cost is multiple round-trips (the model reads, then acts), which the agent loop already handles, and which you mitigate with batching tools ("fetch these N documents at once") and cheap targeted tools ("find this phrase" instead of reading everything).

## When to add search (the hybrid)

Tool-based retrieval assumes the model knows *what* to fetch. When the corpus is large enough that the model can't enumerate it, give it discovery tools:

- A **list** tool ("what documents are in this project?") so it can see what exists.
- A **search** tool — which, under the hood, might be keyword search, full-text search, or *vector* search. This is where RAG techniques re-enter: a `search` tool backed by embeddings, exposed to the model as just another tool it can call.

This hybrid — tools for reading and acting, plus a search tool (possibly RAG-powered) for discovery — scales from a handful of documents to large corpora while keeping the model in control of retrieval. The crucial framing: **RAG becomes a tool the model can choose to call, not the mandatory front door for every query.**

## A decision guide

Ask, in order:

1. **Is the content small and always needed whole?** → Long context. Don't over-engineer.
2. **Is it a bounded, identified set the model can reason about by name/structure?** → Tool-based reads (plus a list tool). Best for exactness, freshness, citations.
3. **Is it a large corpus where the model can't know what exists?** → Add a search tool (keyword or vector). Keep reads as tools so the model pulls full, exact text for whatever search surfaces.
4. **Do you need both whole-document work and corpus-wide search?** → Hybrid: read/find/list tools + a search tool backing into RAG.

## Retrieval and the citation contract

Whatever strategy you pick, design it so the model can *cite precisely*. That means:

- Preserve and expose **location information** (page numbers, section ids) with the retrieved text, so the model can point at exactly where a fact came from.
- Prefer returning **verbatim text** the model can quote, over paraphrased or pre-summarised content.
- If you chunk, keep chunks aligned to meaningful boundaries and carry their source location, so a citation resolves back to a real place in a real document.

For grounded, auditable agents, retrieval and citation are two halves of one design: the way you fetch content determines how precisely the model can attribute its claims. (Chapter 17 returns to this for regulated domains.)

## The bottom line

Don't reach for a vector database reflexively because "RAG" is the default story. For many agents — especially those working with a user's own identified documents and needing exact, citable, current answers — giving the model good read/find/list tools is simpler, more accurate, and more maintainable. Add semantic search as a *tool* when, and only when, corpus scale demands it.

---

Next: [Chapter 8 — Streaming and real-time UX](chapter-08-streaming-ux.md)
