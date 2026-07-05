# Chapter 12 — Secrets and Bring-Your-Own-Key

Agents depend on credentials: model-provider API keys, integration tokens, signing secrets. Some belong to the operator; some belong to individual users who "bring their own key" (BYOK). Mishandling any of them is a serious breach. This chapter covers how to store secrets safely, how to resolve which one to use, and the BYOK pattern.

## Two kinds of secrets

Distinguish:

- **Operator secrets** — credentials the operator configures for the whole deployment, held in environment variables / a secrets manager: the system's provider keys, database credentials, signing secrets. These never touch the database and never reach the client.
- **User secrets** — credentials individual users supply: their own provider API key, their own integration token. These must be *stored* (so they persist) but stored such that even someone with database access can't read them.

The architecture must handle both, and must define a clear precedence when both exist.

## Why bring-your-own-key

BYOK matters for two reasons:

1. **Cost attribution.** If a user brings their own provider key, their model usage bills to them, not the operator. Essential for self-hostable or cost-sensitive products.
2. **Flexibility and trust.** Users (or their organizations) may require using their own accounts, their own rate limits, their own data-processing agreements with a provider.

So a mature agent supports both an operator-wide key (everyone uses it) *and* per-user keys (each user uses their own), with per-user taking precedence.

## Storing user secrets: encryption at rest

Never store a user secret in plaintext. Use **authenticated symmetric encryption** (AES-256-GCM is the standard choice):

- **Derive the encryption key from an operator secret** held in the environment (e.g. hash a long random `ENCRYPTION_SECRET` into a 32-byte key). The encryption key lives in the environment, *not* in the database — so a database dump alone is useless to an attacker.
- **Encrypt with a fresh random IV per record.** Store the ciphertext, the IV, and the authentication tag — the three outputs of GCM. Reusing an IV with GCM is catastrophic, so generate a new one every time you encrypt.
- **Authenticated encryption gives integrity, not just secrecy.** A tampered ciphertext fails the auth-tag check on decryption rather than silently producing attacker-influenced plaintext.
- **Fail closed on decryption.** If the auth tag doesn't verify (corruption, wrong key, tampering), return nothing and log — never return garbage that might be used as a credential.

Store each secret type in an appropriately-constrained table (e.g. a provider key per `(user, provider)`; a separate table for a different token type so a check constraint reserved for providers isn't stretched).

## Saving and clearing

Saving a secret encrypts and upserts (replacing any prior value for that user/provider, with a new IV). Clearing a secret *deletes* the row. Keep the save path the only way secrets enter storage, so encryption is never bypassed.

## Resolution precedence: user beats operator

At call time, resolve which credential to use with a clear, single rule: **user key if present, else operator key, else error.** Concretely:

1. Start with the operator (environment) credentials as the baseline.
2. Load and decrypt the user's stored credentials; for each one present, *override* the baseline.
3. The result is, per credential, the user's value if they have one, else the operator's, else null.

This single rule makes both deployment models work from one code path: a shared-operator-key deployment and a per-user-BYOK deployment are the same code, differing only in which values happen to be set. The resolved credentials flow down to wherever the external call is made, where a final fallback-or-throw guard produces a clear error if neither exists.

The same precedence applies to integration tokens (e.g. a third-party research API): per-user token first, operator token as fallback.

## Expose status, never secrets

The UI needs to show users whether a credential is configured and where it came from — but must never receive the secret itself. Provide a **status** endpoint that returns, per credential, *whether* it exists and its *source* (`user`, `operator/env`, or none) — and nothing more. This lets the settings UI display "configured (from environment, read-only)" or "configured (your key, editable)" without ever transmitting a key to the browser. The client learns *that* and *from where*, never *what*.

## Tie model routing to available credentials

A neat refinement: route work to providers the user can actually pay for. For background tasks (title generation, lightweight extraction), pick the cheapest model of whichever provider the user has a key for, falling back to the operator default. The credential resolution and the model-tiering strategy (Chapter 4) thus work together: "use the cheapest available model of an *available* provider."

## Signing secrets and other operator credentials

Not all secrets are user-supplied. Operator secrets like a **download-signing secret** (Chapter 17) or a session secret must be:

- strong and random (generate with a proper RNG),
- held only in the environment / secrets manager,
- required at startup (fail fast if missing, rather than silently degrading security),
- and rotated with a plan (rotation invalidates anything signed with the old secret, so think through the impact).

## Operational hygiene

- **Never log secrets.** Scrub them from logs and error messages. Log "failed to decrypt key for provider X," not the key.
- **Least exposure.** Decrypt a secret only at the moment of use, hold it briefly, don't pass it further than necessary.
- **Rotate the encryption secret carefully.** Changing the key-derivation secret invalidates all stored user secrets; plan a re-encryption migration if you must rotate it.
- **Use a real secrets manager in production** (rather than plain env files) where your platform offers one.

## The summary

- Operator secrets live in the environment; user secrets live encrypted in the database.
- Encrypt user secrets with AES-256-GCM: per-record IV, auth tag, key derived from an environment secret, fail closed on decryption.
- Resolve credentials as **user-beats-operator, with operator as fallback** — one rule that serves both shared-key and BYOK deployments.
- Expose *status and source*, never the secret.
- Never log secrets; decrypt only at point of use.

Get this right and you can offer BYOK confidently, attribute costs correctly, and survive a database compromise without surrendering your users' credentials.

---

Next: [Chapter 13 — Reliability: retries, idempotency, and failure handling](chapter-13-reliability.md)
