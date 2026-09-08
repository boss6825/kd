# Chapter 14 — Legal Research Integrations

KD doesn't only work with the user's own documents — it can reach out to two external Indian legal systems: **Indian Kanoon** (a database of published judgments and statutes, for precedent research) and **eCourts** (the official live docket system, for the status and history of specific cases). This chapter explains both clients and how the agent uses them. The code is in `src/lib/indianKanoon.ts`, `src/lib/ecourts.ts`, and the corresponding tool branches in `chatTools.ts`.

## Two different research needs

The system prompt draws a sharp distinction that's worth restating, because it's the key to using these tools correctly:

- **Indian Kanoon = published precedent.** "How have courts decided issues like mine?" Use `search_case_law` and `read_judgment`.
- **eCourts = a specific live case.** "What's the status/history/orders of *this* case?" Use `find_indian_case` and `get_indian_case_order_analysis`.

Confusing the two is the most common way to misuse them, so the prompt spells it out and the tool descriptions repeat it.

## The Indian Kanoon client

`indianKanoon.ts` wraps four endpoints of the Indian Kanoon API:

- `/search/` — full-text and filtered search over case law.
- `/doc/<id>/` — the full judgment text + metadata.
- `/docmeta/<id>/` — metadata only (cheaper).
- `/docfragment/` — a snippet view for a query.

Key implementation details:

- **Auth** uses an `Authorization: Token <token>` header. All requests are `POST` (the API rejects `GET` for these endpoints even though they're read-only).
- **Token resolution** prefers a per-user token (stored encrypted in `user_indiankanoon_tokens`, Chapter 16) and falls back to the backend `INDIAN_KANOON_API_TOKEN`. `resolveIndianKanoonToken(userToken)` implements this precedence; if neither is set, callers surface a configuration error rather than 401-looping. This is the "bring your own key" pattern applied to a research API: the operator can provide a shared token, or each user can supply their own.
- **`ikSearch`** maps the tool's `query` to the API's `formInput` parameter and passes through filters (`doctypes`, `fromdate`, `todate`, `title`, `cite`, `author`, `bench`, paging).
- **`ikGetDoc`** fetches a judgment with bounded `maxcites`/`maxcitedby`.
- **`stripHtml`** converts the judgment's HTML body to clean plain text (dropping scripts/styles, converting `<br>`/`</p>` to newlines, decoding entities), because the model only needs the readable text and trimming tags keeps the tool result within context limits.

The tool branches in `runToolCalls` (`search_case_law`, `read_judgment`, `get_judgment_meta`) call these functions, resolve the token, and return the results as tool output. The prompt's case-law section then guides the model to identify issues → search with a focused query (legal phrase or statute section) → read the most on-point judgments → summarise how prior courts decided and cite each by case name with the source URL, never inventing citations.

## The eCourts client

`ecourts.ts` is a larger client (≈660 lines) for the live court-records system, which is considerably messier than Indian Kanoon because it spans district courts, High Courts, the Supreme Court, and tribunals, each with their own codes.

The unified tool `find_indian_case` has two modes:

- **Drill mode** — given a 16-character **CNR** (Case Number Record: 4 letters + 12 digits, e.g. `DLND020047882015`), it returns the full case detail.
- **Search mode** — given a `query` and/or filters (`petitioner`, `respondent`, `advocate`, `judge`, `court_code`, `case_status`, filing dates, `page`), it returns matching cases each with a CNR to drill into.

Important real-world quirks the prompt and code handle:

- **Search returns no title field**, so a case is referred to as "petitioner vs respondent" using the party arrays.
- **Wrong court/case-type codes silently return zero results**, so the prompt tells the model to prefer free-text `query` over guessing codes, and warns that High Court codes need a bench suffix (`DLHC01`, not `DLHC`) and NCLT codes end in `0`.
- **The full order text comes free** inside the case detail (under `files`). So the model should only call the separate analysis tool when it specifically needs AI analysis.

### Slimming the payload

A raw eCourts case-detail payload is huge and deeply nested. `slimCaseDetail(detail)` reduces it to the fields the model actually needs: CNR, a built title, case type/status, court name, filing/decision/next-hearing dates, parties and advocates, judges, order metadata, and the combined order text — **capped at `MAX_CASE_ORDER_CHARS = 40000`** with a `orderTextTruncated` flag, because full orders can run to dozens of pages. This is a crucial context-management technique: don't pour a giant API response into the prompt; distill it to the decision-relevant fields and cap the long parts, leaving a tool (`get_indian_case_order_analysis`) for when the model needs more.

### The order analysis

`get_indian_case_order_analysis` fetches a rich AI analysis of a specific order. `orderAiHighlights(analysis)` walks the deep, free-form analysis tree *defensively* (the code literally notes "the tree is deep and free-form; walk it defensively via any") and pulls out the headline fields: executive summary, plain-language outcome, order nature, directions, statutes cited, court reasoning, and ratio decidendi. Because the analysis can take 10–60s to generate on first access, the tool exposes a `wait_for_analysis` flag that polls until it's ready.

### Caching

The `ecourts_cache` table caches eCourts responses (`cache_key`, `resource`, `payload`, `request_id`, `expires_at`) so repeated lookups of the same case don't hammer the upstream API or re-pay its latency. The `expires_at` index supports cleanup of stale entries. Caching an external, rate-limited, slow API is exactly the right move.

## How the agent ties it together

A realistic research turn might look like:

1. User: "Find precedents on specific performance of a property sale, and check the status of case `DLND02...`."
2. KD reads the relevant attached documents to pin down the issue.
3. For precedent: `search_case_law("specific performance immovable property", doctypes: "supremecourt")` → `read_judgment(tid)` on the best hits → summarises the ratio and applies it.
4. For the live case: `find_indian_case(cnr: "DLND02...")` → reports parties, status, next hearing, and recent orders, optionally calling `get_indian_case_order_analysis` for a key order.
5. KD's answer cites Indian Kanoon judgments by name+URL and reports eCourts facts as "petitioner vs respondent", never fabricating case numbers or outcomes.

## The reusable lessons

- **Integrations are tools, period.** From the agent loop's perspective, hitting an external legal API is just another branch in `runToolCalls` returning text. The whole research capability slots into the same machinery as reading a document.
- **Distill external payloads before they hit the prompt.** `slimCaseDetail` and `stripHtml` are context engineering — the model gets the signal, not the raw firehose, with a cap and a "there's more" flag.
- **Cheap-vs-expensive variants and lazy detail.** Metadata-only endpoints, free inline order text vs. on-demand analysis, and polling flags all let the model (and the system) avoid paying for detail until it's needed.
- **BYO-token for third-party APIs** mirrors the BYO-key approach for model providers (Chapter 16): per-user token with an operator fallback.
- **Cache slow, rate-limited externals.** The `ecourts_cache` table turns a 10–60s upstream call into an instant repeat.

---

Next: [Chapter 15 — Auth, access control, and multi-tenancy](chapter-15-auth-and-access.md)
