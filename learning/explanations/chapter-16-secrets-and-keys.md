# Chapter 16 — Secrets, API Keys, and Bring-Your-Own-Key

KD lets each user supply their own model-provider API keys (Anthropic, Gemini, OpenAI) and their own Indian Kanoon token. Those secrets must be stored so that even someone with database access can't read them. This chapter explains the encryption-at-rest scheme and the key-resolution precedence. The code is in `src/lib/userApiKeys.ts`, with the storage schema in `schema.ts` and the resolution glue in `src/lib/userSettings.ts`.

## Why bring-your-own-key (BYOK)

Two reasons drive BYOK:

1. **Cost attribution.** If a user brings their own provider key, their model usage is billed to them, not the operator. This is essential for a self-hostable product where the operator may not want to foot every user's token bill.
2. **Flexibility.** The README explains the model: a provider key can be set in `backend/.env` for the whole instance, *or* per-user in "Account > Models & API Keys." If an env key is present, that provider is available to everyone by default and the per-user field becomes read-only.

So the system must support both instance-wide env keys and per-user encrypted keys, with a clear precedence.

## The storage schema

Two tables hold encrypted secrets:

- **`user_api_keys`** — `(user_id, provider, encrypted_key, iv, auth_tag)`, unique per `(user_id, provider)`. A check constraint limits `provider` to `claude`, `gemini`, `openai`.
- **`user_indiankanoon_tokens`** — `(user_id, encrypted_token, iv, auth_tag)`, one per user. It's a separate table specifically so the Indian Kanoon token doesn't have to fit the `user_api_keys.provider` check constraint, which is reserved for model providers.

Notice that nothing stores a plaintext key. Each row stores three pieces: the ciphertext, the initialization vector, and the authentication tag — the three outputs of authenticated encryption.

## The encryption scheme — AES-256-GCM

`userApiKeys.ts` uses Node's `crypto` with **AES-256-GCM**, an authenticated encryption mode:

- **The key** is derived from the `USER_API_KEYS_ENCRYPTION_SECRET` environment variable via `sha256(secret)` → a 32-byte key (`encryptionKey()`). The app refuses to operate on keys if this secret isn't configured.
- **`encrypt(value)`** generates a fresh random 12-byte IV, creates an AES-256-GCM cipher, encrypts, and returns `{encrypted_key, iv, auth_tag}` all base64-encoded. A fresh IV per encryption is essential — reusing an IV with GCM is catastrophic, so it's randomised every time.
- **`decrypt(row)`** reverses it: rebuilds the decipher with the stored IV, sets the auth tag, and decrypts. If the auth tag doesn't verify (tampering, wrong key, corruption), `final()` throws and `decrypt` returns `null` after logging — it fails closed, never returning garbage.

GCM is the right choice because it provides *both* confidentiality and integrity: a tampered ciphertext won't silently decrypt to attacker-controlled plaintext; it fails verification.

## Saving keys

- **`saveUserApiKey(userId, provider, value)`** — if `value` is empty/null, it *deletes* the row (clearing a key). Otherwise it encrypts and upserts (`onConflictDoUpdate` on `(user_id, provider)`), so re-saving a provider replaces the old key. Each save uses a new IV.
- **`saveUserIndianKanoonToken`** — the same pattern for the IK token table.

## Resolving keys at call time

The precedence — **user key beats env key** — is implemented in `getUserApiKeys(userId, db)`:

1. Start with the env keys as the baseline: `{claude: envApiKey("claude"), gemini: ..., openai: ...}`. `envApiKey` reads `ANTHROPIC_API_KEY`/`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
2. Load the user's encrypted rows, decrypt each, and *overwrite* the corresponding provider if the decrypted value is non-empty.

The result is a `UserApiKeys` object where each provider is the user's key if they have one, else the env key, else null. This object flows all the way down to the LLM adapters (Chapter 2), where each adapter's `apiKey(override)` helper uses the override (the resolved per-call key) or falls back to the env var, and throws a clear error if neither exists.

For Indian Kanoon, the same precedence is implemented by `resolveIndianKanoonToken` (Chapter 14): user token first, env token fallback.

## Reporting status without leaking secrets

`getUserApiKeyStatus(userId)` returns, for each provider, *whether* a key exists and its **source** (`"user"`, `"env"`, or `null`) — but never the key itself. This is what powers the Account settings UI: it can show "Anthropic: configured (from environment)" and make the field read-only, or "configured (your key)" and editable, without ever sending a secret to the browser. The frontend needs to know *that* a key exists and *where it came from*, not what it is.

`hasEnvApiKey(provider)` and `hasEnvIndianKanoonToken()` are the small helpers that distinguish env-provided from user-provided.

## How model selection interacts with keys

`userSettings.ts` ties keys to model routing. `resolveTitleModel(apiKeys)` picks the cheapest available model based on which provider keys the user has: Gemini Flash-Lite if they have a Gemini key, else OpenAI nano, else Claude Haiku, else the Gemini default. So title generation (a cheap background task) automatically routes to whatever provider the user can actually pay for. `getUserModelSettings` bundles the title model, the tabular model (from the profile), and the resolved API keys into one object the routes consume.

## The lessons

- **Never store secrets in plaintext.** AES-256-GCM with a per-record IV and an auth tag is a solid, standard choice.
- **Derive the key from an env secret, and fail if it's missing.** The encryption key never lives in the database; it lives in the environment, so a database dump alone is useless.
- **Fail closed on decryption.** A failed auth-tag check returns `null`, never plaintext.
- **Precedence: user beats env, with env as fallback.** This single rule makes both self-hosted-with-shared-keys and per-user-BYOK work from the same code.
- **Expose status, never secrets.** The UI learns *whether* and *from where*, not *what*.

---

Next: [Chapter 17 — Storage, downloads, and signed tokens](chapter-17-storage-and-downloads.md)
