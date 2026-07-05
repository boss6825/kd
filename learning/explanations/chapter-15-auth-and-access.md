# Chapter 15 — Auth, Access Control, and Multi-Tenancy

A legal product handles confidential client documents, so getting authentication and authorization right is non-negotiable. This chapter explains how KD knows *who* a user is (Better Auth) and *what they're allowed to touch* (the owner-or-shared access model). The code is in `src/lib/auth.ts`, `src/middleware/auth.ts`, and `src/lib/access.ts`.

## Authentication: Better Auth

KD uses **Better Auth** (`lib/auth.ts`), a self-hosted auth library that replaced an earlier Supabase Auth setup. It lives inside the Express backend (which already owns the database) and is configured with:

- **A Drizzle adapter** over the same Postgres database, mapping to four core tables: `user`, `session`, `account`, `verification` (defined in `schema.ts`).
- **Email + password** sign-in, with `autoSignIn` (signup logs you straight in) and `requireEmailVerification: false` (you can use the app before verifying, matching the prior UX). Password reset and verification emails are sent via Resend (`lib/email.ts`).
- **Google OAuth**, enabled only if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.
- **Account linking** — a user who signed up with email can later sign in with Google on the same address (and vice versa) without creating a duplicate.
- **The `bearer` plugin** — sessions are carried as `Authorization: Bearer <token>` headers, matching the frontend's existing flow. This is why `index.ts` exposes the `set-auth-token` response header in CORS: the browser reads the token from that header on login and stores it.

Better Auth mounts its own routes at `/api/auth/*` (wired in `index.ts` *before* `express.json()`), handling sign-up, sign-in, OAuth callbacks, password reset, and session management.

### Seeding the profile

A `databaseHooks.user.create.after` hook seeds a `user_profiles` row whenever a new user is created (replacing an old Postgres trigger). It's idempotent (`onConflictDoNothing`), and profile loading also lazily repairs a missing row — "belt and suspenders," as the comment says.

## The auth middleware

Every protected route begins with `requireAuth` (`middleware/auth.ts`):

```ts
const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
if (!session?.user) { res.status(401)...; return; }
res.locals.userId = session.user.id;
res.locals.userEmail = (session.user.email ?? "").toLowerCase();
```

It resolves the session from the request headers (the bearer token), and on success stashes `userId` and a lowercased `userEmail` in `res.locals` for the route to use. On failure it returns `401`. This is the single chokepoint through which identity enters the system.

## Authorization: the owner-or-shared model

Authentication answers "who are you?"; authorization answers "can you touch this?". KD centralises authorization in `lib/access.ts`. The header comment explains the *why* clearly: because documents can be shared (user A's project shared with user B's email), the naive "scope everything by `user_id`" pattern is wrong. And because the browser never touches the database directly — every read/write goes through the backend — these helpers are the **application-layer replacement for database row-level security**.

### `checkProjectAccess`

The core helper. Given a `projectId`, `userId`, and `userEmail`, it loads the project and returns:

- `{ok: true, isOwner: true}` if the user owns the project.
- `{ok: true, isOwner: false}` if the user's email is in the project's `shared_with` array.
- `{ok: false}` otherwise.

The returned `isOwner` flag lets callers gate owner-only operations (delete, rename, member management) separately from read/write access.

### `ensureDocAccess`

For a document the caller already loaded: owner-of-doc passes immediately; otherwise it falls through to a `checkProjectAccess` on the doc's project. Taking the already-loaded doc as input saves a round-trip.

### `ensureReviewAccess`

For tabular reviews, which can be shared two ways: through their project, *or* directly via the review's own `shared_with` email list (so standalone reviews can be shared too). The owner always passes.

### `filterAccessibleDocumentIds`

A guard for routes that accept document ids from the request body (tabular review attach a list of document UUIDs). Without it, a user with access to a review could attach *arbitrary* document UUIDs and later have their bytes extracted. This helper filters a list of ids down to only those the caller can actually read (own, or in an accessible project).

### `listAccessibleProjectIds`

Returns every project id the user can reach — own projects plus any where their email is in `shared_with` — used to scope collection queries (like the recent-chats list).

## How access checks thread through routes

Look at `chat.ts` for the pattern in action:

- `getAccessibleChat` returns a chat only if the user owns it *or* it's under a project they can access (via `checkProjectAccess`).
- `validateAccessibleProjectId` confirms project access before creating a chat tied to a project.
- The recent-chats list (`GET /chat`) shows the user's own chats plus chats under projects they *own* (so a project owner sees collaborators' chats in their projects), but deliberately *not* chats in projects merely shared *with* them (those are listed per-project).

Every route does this kind of explicit gating at the top. There is no implicit trust anywhere.

## Multi-tenancy without RLS

The big-picture point: KD is multi-tenant (many users, many firms, shared documents) but it does **not** rely on Postgres row-level security. Instead:

1. The browser never connects to the database — only the backend does, with a service-role connection.
2. Every route authenticates via `requireAuth` and authorizes via the `access.ts` helpers.
3. Sharing is modelled explicitly with `shared_with` email arrays (on projects and reviews), checked in code.

This is a legitimate and common architecture. RLS pushes the check into the database; KD pushes it into a small, audited set of helper functions that every route funnels through. The trade-off is that you must be disciplined — forget an access check on a new route and you have a hole — but the benefit is that the logic is explicit, testable, and lives in one file you can review in full.

## Security hygiene elsewhere

Auth isn't the only protection. Recall from Chapter 1 that `index.ts` adds `helmet` (security headers), `cors` locked to the frontend origin, and a battery of rate limiters (auth, chat, upload) — so even before a request reaches a route, it's been throttled and header-hardened. Defence in depth.

---

Next: [Chapter 16 — Secrets, API keys, and bring-your-own-key](chapter-16-secrets-and-keys.md)
