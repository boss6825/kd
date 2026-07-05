# KD — Product & Growth Strategy

*Written July 2026. Grounded in the current codebase, verified competitor research, and the realities of the Indian litigation market. Target user: High Court / Supreme Court litigators and tech-comfortable chambers, not tier-3 general practice (yet).*

---

## 1. Where KD stands today

### What we have (and it's more than it looks)

| Capability | State |
|---|---|
| Agentic chat ("Mike") over case files, with citations | Shipped |
| DOCX drafting with automatic legal clause numbering | Shipped |
| Tracked-changes editing with per-edit accept/reject | Shipped — genuinely rare, even Harvey-class products struggle here |
| Tabular review (bulk extraction across documents → Excel) | Shipped |
| Case-law research via Indian Kanoon API | Shipped (chat tool) |
| Live case data via eCourts partner API — case status, parties, advocates, **next hearing dates**, full order text, AI order analysis | Shipped (chat tool only) |
| Multi-provider LLM (Claude / Gemini / GPT) + BYOK | Shipped |
| Workflows (reusable prompt templates, shareable) | Shipped |
| Document versioning, R2 storage, project workspaces | Shipped |

### What's missing

- **No payments.** Credits/tier plumbing exists but is stubbed (limit = 999999, no Razorpay/Stripe).
- **No proactive anything.** We fetch `nextHearingDate` from eCourts and then *never tell the lawyer*. This is the single biggest wasted asset in the codebase.
- **No case-tracking UI.** eCourts is only reachable by asking the chatbot. A lawyer's caseload deserves a dashboard, not a conversation.
- **No Hindi / regional language support** — despite district-court records (which HC appellate lawyers work from daily) being predominantly vernacular.
- **No notifications** beyond auth emails.
- **No judgment corpus of our own** — and (see below) we should NOT try to build one.

### The positioning claim

> **KD is the daily practice OS for the Indian litigator** — the tool that knows your board, preps you for tomorrow, and drafts what comes next.

Not "another legal research tool." That fight is lost before it starts (see §2).

---

## 2. Competitor landscape (verified, July 2026)

| Player | What they actually are | Threat to us |
|---|---|---|
| **Lucio** (BLR, ~$7.7M raised, $5M led by DeVC) | **India-focused** (correcting our earlier read — not US-first): 200+ orgs, 3,000+ users, 9 jurisdictions. Drafting, research, timelines, OCR, redaction, Indian-language translation. Sells to firms/orgs. | High on drafting/firm side. Weak on the litigator's daily court loop. |
| **Jhana.ai** | "National Legal Archive": **16M+ judgments** with editorial headnotes and semantic retrieval — this dataset IS a real moat. Steno (Hindi/Tamil/Telugu/Kannada dictation), AI paralegal, free tier, 10k+ users, courtroom APIs built with 150+ judges/registrars. | Highest. But their center of gravity is *research and the archive*, not case tracking / daily practice. |
| **Manupatra.ai** | 25-year incumbent database, 100k+ subscribers, layering AI research + MyKase practice management. | Medium — distribution monster, slow product. |
| **SCC Online** | Piloting an Azure OpenAI conversational research assistant. | Signal that incumbents are waking up. Research parity is a treadmill. |
| **LegitQuest** | Pivoting B2B: litigation due-diligence for banks/fintechs (LIBIL, iDRAF). | Low — different buyer. |
| Long tail | CaseMine (AMICUS), VIDUR, BharatLaw.AI, free chatbots (KanoonGPT, NyayGuru). ~800 active legaltech startups. | Noise, but crowds the "AI legal research" message. |

Analysts expect consolidation to 4–5 winners by 2027–28. The pattern the founder spotted is real: **every Indian player owns one or two niches; nobody owns the whole day of a litigator.** Harvey's insight (Assistant + Vault + Workflows + Knowledge as one surface) hasn't been translated to the *litigation* context in India — everyone translated it to the *research* or *firm drafting* context.

**The open lane:** the loop every HC/SC litigator runs daily —

> *Is my matter listed tomorrow? → prep for the hearing → what happened in court today? → what did the judge order? → draft the next filing → repeat.*

Research tools are opened at research moments (a few times a week). The daily loop is opened **every evening and every morning**. Own the loop and you own the habit; own the habit and research/drafting revenue follows for free.

**Explicitly de-prioritized (deliberate "no"s):**
- Building our own judgment corpus / vector DB — we cannot out-dataset Jhana's 16M archive or Manupatra's 25 years. Indian Kanoon's API is good enough for the research moments our users have.
- Steno-style dictation — commodity (Whisper-class models), and Jhana already ships it.
- Tier-3 market — revisit after PMF with the HC/SC segment.
- Enterprise contract-lifecycle — Lucio's lane, different buyer, long sales cycles.

---

## 3. Product: the "can't-resist" features, ranked by leverage ÷ effort

### 3.1 Hearing alerts on WhatsApp ⭐ *the wedge*

**We already fetch the data. We just never tell anyone.**

- Lawyer adds CNRs to a project (a `cm_number` field already exists on projects).
- Nightly job re-checks tracked cases via the existing eCourts client (`backend/src/lib/ecourts.ts`, cached in `ecourts_cache`): new hearing date? new order uploaded? status change?
- WhatsApp message (Gupshup / AiSensy / Twilio WhatsApp Business API) + email fallback.

Why this is the wedge: "am I listed tomorrow?" is the daily anxiety of every litigator in India. Today it's solved by clerks phoning around, checking the (miserable) eCourts portal, or the display boards. A WhatsApp ping the evening before is a feature a lawyer *shows other lawyers in the bar room*. Retention is structural — unsubscribing means losing sleep again.

### 3.2 Case-tracking dashboard

A dedicated route (not chat): the lawyer's full board.
- All tracked matters, next dates, court, stage, last order.
- Timeline view per matter (orders in sequence — eCourts already returns interim + final orders with full text).
- One-click "summarize the latest order" — the eCourts `getOrderAi` analysis (executive summary, ratio, statutes, directions) already exists in our client; it just has no UI.
- Deep-link each matter into a project chat with the case file loaded.

### 3.3 "Tomorrow's board" evening digest

6 PM WhatsApp/email: *"3 matters listed tomorrow"* — each with court/item, and an AI prep brief generated from the documents in that matter's project (last order + our own case file). This turns the alert (3.1) from a notification into a **preparation ritual**. This is the feature that makes the product irreplaceable rather than merely useful.

### 3.4 Citation verification ("cite-check")

Run every citation in an uploaded or drafted document against Indian Kanoon: does the case exist, is the citation format right, does it say what the draft claims. Fake AI citations have already embarrassed lawyers in Indian courts — every senior's stated reason to distrust AI. **Nobody ships a cite-checker as a first-class feature.** It pairs naturally with our tracked-changes engine (flag → suggest correction as a tracked change). This is a *trust* feature: it converts AI skeptics, which in a chamber means it converts the senior who signs the cheque.

### 3.5 India-specific drafting template gallery

The auto-numbering DOCX engine is already built. Ship court-formatted templates for the filings HC/SC lawyers actually produce weekly:

- SLP (civil & criminal), writ petitions (Art. 226 / 32), counter-affidavits/rejoinders
- Section 138 NI complaints, bail/anticipatory bail applications
- Legal notices, written statements, applications (condonation, exemption, stay)

Vehicle: the existing Workflows feature, promoted from "saved prompts" to a curated gallery. Formatting fidelity to each High Court's conventions is the detail competitors skip and lawyers notice instantly.

### 3.6 Vernacular document handling

District-court records are largely Hindi (and regional languages); HC appellate lawyers work from them daily. Translate-on-upload (store both, cite from the original). Lucio and Jhana both do languages — this becomes table stakes within a year; we need it before it's a checkbox we're missing in a bake-off.

### 3.7 Billing (Razorpay)

Wire up the dormant credits/tier plumbing:
- **Free**: limited chats/month + 3 tracked cases + alerts. The free tier is the growth engine (see §5), so tracked-case alerts stay free at small scale forever.
- **Pro (solo)**: ₹1,499–2,499/month — unlimited tracking, digests, cite-check, templates, tabular review.
- **Chambers**: per-seat with a shared workspace; the senior pays, juniors use.
- Monthly INR, UPI autopay. No annual-only plans — Indian solo professionals don't prepay strangers.

### 3.8 Later (not now)

MS Word add-in (Harvey-style, drafts where lawyers actually live) — high value, high effort; after the loop is owned. Mobile app — the WhatsApp bot *is* the mobile app for v1.

---

## 4. Go-to-market for a tech founder (practical, in order)

You don't need "marketing knowledge" for the first 100 customers. You need **20 lawyers who feel like co-founders** and a product that spreads inside chambers on its own. In sequence:

### 4.1 Founding Lawyers program (weeks 1–4)

Recruit 10–20 HC/SC lawyers (Delhi HC / SC bar is the densest starting pool). Offer: free forever + white-glove onboarding (you personally load their matters, set up their alerts). Ask: one 20-minute feedback call weekly + introductions inside their chamber. Find them via personal network → LinkedIn → NLU alumni → juniors who post about legal tech on X. **You, the founder, onboarding lawyers by hand is not un-scalable embarrassment; it is the entire strategy at this stage.**

### 4.2 Sell to the junior, bill the senior

The daily user is the junior associate / law clerk — tech-comfortable, does the drudge work (checking lists, first drafts, summarizing orders), and desperate for leverage. The senior approves spend only after the chamber already depends on the tool. So: free tier generous enough for a junior to adopt unilaterally; chamber plan priced for the senior once 3–4 juniors are hooked. **The chamber is the viral unit of the Indian bar** — juniors rotate, carry tools with them, and become seniors.

### 4.3 Pick one beachhead bar

Don't market to "Indian lawyers." Pick one dense, repeat-workflow community and win it completely:
- **Delhi HC commercial/arbitration bar** — document-heavy, deadline-driven, highest tech comfort, highest willingness to pay; or
- **Section 138 NI practitioners** — massive volume, brutally repetitive drafting (template gallery shines), tracked across many courts (alerts shine).

Being "the tool everyone in *our* bar uses" beats being vaguely known everywhere. Expansion is then bar-by-bar, court-by-court.

### 4.4 Distribution surfaces that actually reach Indian lawyers

- **LiveLaw and Bar & Bench** — the two publications every target user reads daily. Earned coverage ("legaltech startup ships WhatsApp hearing alerts") + sponsored, in that order.
- **Legal X/Twitter and LinkedIn** — Indian legal Twitter is small, dense, and chatty; 20 respected accounts talking about you ≈ market awareness.
- **NLU campuses** — see §5 (internship kit).
- **Bar association CLE/demo sessions** — one good live demo to a bar association reaches 200 lawyers with zero ad spend.

### 4.5 What NOT to do

- No paid ads (lawyers distrust ads; CAC will be absurd).
- No cold email/LinkedIn outreach to senior counsel (instant reputation damage in a small community).
- No feature-comparison marketing against Manupatra/SCC (fighting on their turf, and their users are loyal by habit, not features).
- No "AI will replace paralegals" messaging — juniors are our users; frame everything as *the junior who came with superpowers*.

---

## 5. Out-of-the-box growth ideas

*(Kept separate as requested — these are the non-generic plays.)*

### 5.1 The WhatsApp CNR bot as a free public utility

Send any CNR number to a WhatsApp number → get case status, next date, last order — formatted like a human clerk wrote it. **Zero install, zero signup friction, works on the ₹8,000 phone a court clerk carries.** The govt eCourts portal is famously painful; a WhatsApp bot that does it in 5 seconds spreads chamber-to-chamber and courthouse-to-courthouse on its own. It's simultaneously the free tier of the alerts product and the top of the funnel. Guard the eCourts credit cost with per-number rate limits and aggressive caching (already built).

### 5.2 Same-day AI case notes on big judgments

The eCourts order-AI already produces executive summary + ratio + statutes. When a major SC/HC judgment drops, publish a clean case note on LinkedIn/X **within the news cycle (minutes-hours, not days)**, each linking to a free "track this case" page. Legal India shares judgment analysis compulsively; being reliably *first with a competent note* compounds into distribution. This is a cron job + editorial polish, not a content team.

### 5.3 Free public case-status pages (SEO)

A public, indexable, actually-pleasant page per case (party names, status, next date). Case-status queries are among India's most-searched legal queries, and the incumbent (the govt portal) is unlinkable and unusable. Litigants search their own cases, land on us, and ask their lawyer "what's this KD thing tracking our case?" — **reverse distribution from client to lawyer.**

### 5.4 "Adopt a chamber"

Pick 5 respected chambers; free pilot for the whole chamber; in exchange (with consent) the chamber becomes a named case study. Reputation is the currency of the Indian bar — *"X's chamber runs on KD"* is worth more than any ad budget, because juniors model their workflow on the chambers they aspire to join.

### 5.5 The NLU internship kit

Free student tier for NLU (and other law school) students + a tiny playbook: "how to be the intern who shows up with superpowers." Interns rotate through chambers **every semester** — a built-in, self-refreshing distribution cycle into exactly our target chambers. Cost: near zero. Timeline: compounding.

### 5.6 The munshi channel

The court clerk/typist (munshi) decides what tools a chamber actually uses far more than anyone admits — he's the one checking cause lists and chasing orders today. Give clerks a free personal account and a small ₹ referral for chambers they bring in. **Nobody in this market markets to clerks.** The people whose drudgery we automate should be our sales force, not our victims.

### 5.7 Embeddable cause-list widget

An embeddable "what's listed in the Supreme Court today" widget offered free to legal news sites and law blogs — powered-by-KD attribution. Cheap, evergreen brand placement exactly where lawyers already look every morning.

### 5.8 The BCI loophole (played straight)

Bar Council rules bar *lawyers* from advertising — but not legaltech, and not lawyers *publishing scholarship*. Ghost-assist your founding lawyers in publishing sharp case notes and practice pieces (drafted with KD, credited to them). They get the reputation they're allowed to build; you get the distribution they're not allowed to buy. Customers become the marketing channel.

---

## 6. Sequencing — 30 / 60 / 90 days

**Days 0–30 — ship the wedge**
- WhatsApp hearing alerts (nightly eCourts re-check on tracked CNRs + WhatsApp Business API).
- Case-tracking dashboard v1 (board of matters, next dates, order timeline, order-AI summaries).
- Razorpay + free/pro tiers wired to the existing credits plumbing.
- Recruit 10 founding lawyers; onboard them by hand.

**Days 30–60 — deepen the loop, open the funnel**
- "Tomorrow's board" evening digest with AI prep briefs.
- Cite-check v1 (existence + citation-format check via Indian Kanoon).
- Template gallery: top 5 filings for the beachhead bar.
- Public WhatsApp CNR bot (rate-limited).

**Days 60–90 — widen**
- Vernacular translate-on-upload.
- Same-day judgment notes engine + first "adopt a chamber" pilots.
- Chamber plans; convert first paying customers; NLU student tier.

---

## 7. Risks & constraints

- **eCourts API credit costs** scale with tracking + the free bot. Mitigations: the per-resource cache already built (`ecourts_cache`), nightly batch (not realtime) re-checks, hard rate limits on the public bot, and free-tier caps on tracked cases.
- **Indian Kanoon licensing** — confirm commercial-use terms of the API before cite-check becomes a headline feature; per-user tokens (already supported) shift cost and license to the user if needed.
- **DPDP Act / client confidentiality** — client files are sensitive data. Our BYOK + private R2 storage story is actually a *selling point* to security-conscious chambers; write it up as a one-page trust doc.
- **Hallucinated citations** — the existential trust risk for the category. Cite-check (§3.4) is both mitigation and differentiator; always cite sources in-product.
- **Incumbents adding AI** (SCC/Manupatra) — they will reach research parity with everyone. They will not chase the daily loop soon; speed on the wedge matters more than research features.
- **Solo-founder bandwidth** — everything above is sequenced so that no phase needs more than one person shipping; the GTM (§4) is deliberately founder-does-sales.

---

## The one-line strategy

> Ship WhatsApp hearing alerts on the eCourts data we already fetch, make the evening digest a ritual, let the free CNR bot and the juniors spread it chamber to chamber — and by the time competitors notice, KD is the first thing an Indian litigator checks at night and the last thing they'd give up.
