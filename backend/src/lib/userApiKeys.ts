import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db as sharedDb, type Db } from "../db";
import { userApiKeys, userIndiankanoonTokens } from "../db/schema";
import type { UserApiKeys } from "./llm";

export type ApiKeyProvider = "claude" | "gemini" | "openai";
export type ApiKeySource = "user" | "env" | null;
export type ApiKeyStatus = Record<ApiKeyProvider, boolean> & {
    sources: Record<ApiKeyProvider, ApiKeySource>;
};

type EncryptedKeyRow = {
    provider: ApiKeyProvider;
    encrypted_key: string;
    iv: string;
    auth_tag: string;
};

const PROVIDERS: ApiKeyProvider[] = ["claude", "gemini", "openai"];

function envApiKey(provider: ApiKeyProvider): string | null {
    if (provider === "claude") {
        return (
            process.env.ANTHROPIC_API_KEY?.trim() ||
            process.env.CLAUDE_API_KEY?.trim() ||
            null
        );
    }
    if (provider === "openai") {
        return process.env.OPENAI_API_KEY?.trim() || null;
    }
    return process.env.GEMINI_API_KEY?.trim() || null;
}

export function hasEnvApiKey(provider: ApiKeyProvider): boolean {
    return !!envApiKey(provider);
}

function encryptionKey(): Buffer {
    const secret = process.env.USER_API_KEYS_ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error("USER_API_KEYS_ENCRYPTION_SECRET is not configured");
    }
    return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: string): Omit<EncryptedKeyRow, "provider"> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    return {
        encrypted_key: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        auth_tag: cipher.getAuthTag().toString("base64"),
    };
}

function decrypt(row: EncryptedKeyRow): string | null {
    try {
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            encryptionKey(),
            Buffer.from(row.iv, "base64"),
        );
        decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(row.encrypted_key, "base64")),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    } catch (err) {
        console.error("[user-api-keys] failed to decrypt stored key", {
            provider: row.provider,
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}

function isProvider(value: string): value is ApiKeyProvider {
    return (PROVIDERS as string[]).includes(value);
}

export function normalizeApiKeyProvider(value: string): ApiKeyProvider | null {
    return isProvider(value) ? value : null;
}

export async function getUserApiKeyStatus(
    userId: string,
    db: Db = sharedDb,
): Promise<ApiKeyStatus> {
    const status: ApiKeyStatus = {
        claude: false,
        gemini: false,
        openai: false,
        sources: {
            claude: null,
            gemini: null,
            openai: null,
        },
    };

    for (const provider of PROVIDERS) {
        if (hasEnvApiKey(provider)) {
            status[provider] = true;
            status.sources[provider] = "env";
        }
    }

    const rows = await db
        .select({ provider: userApiKeys.provider })
        .from(userApiKeys)
        .where(eq(userApiKeys.user_id, userId));

    for (const row of rows) {
        const provider = normalizeApiKeyProvider(String(row.provider));
        if (provider) {
            status[provider] = true;
            status.sources[provider] = "user";
        }
    }

    return status;
}

export async function getUserApiKeys(
    userId: string,
    db: Db = sharedDb,
): Promise<UserApiKeys> {
    const apiKeys: UserApiKeys = {
        claude: envApiKey("claude"),
        gemini: envApiKey("gemini"),
        openai: envApiKey("openai"),
    };

    const rows = (await db
        .select({
            provider: userApiKeys.provider,
            encrypted_key: userApiKeys.encrypted_key,
            iv: userApiKeys.iv,
            auth_tag: userApiKeys.auth_tag,
        })
        .from(userApiKeys)
        .where(eq(userApiKeys.user_id, userId))) as EncryptedKeyRow[];

    for (const row of rows) {
        const provider = normalizeApiKeyProvider(row.provider);
        if (!provider) continue;
        const decrypted = decrypt(row);
        if (decrypted?.trim()) {
            apiKeys[provider] = decrypted;
        }
    }

    return apiKeys;
}

// ---------------------------------------------------------------------------
// Indian Kanoon token (stored in its own table to avoid extending the
// user_api_keys.provider check constraint, which is reserved for LLM
// model providers).
// ---------------------------------------------------------------------------

type IkTokenRow = {
    encrypted_token: string;
    iv: string;
    auth_tag: string;
};

export async function getUserIndianKanoonToken(
    userId: string,
    db: Db = sharedDb,
): Promise<string | null> {
    const [row] = await db
        .select({
            encrypted_token: userIndiankanoonTokens.encrypted_token,
            iv: userIndiankanoonTokens.iv,
            auth_tag: userIndiankanoonTokens.auth_tag,
        })
        .from(userIndiankanoonTokens)
        .where(eq(userIndiankanoonTokens.user_id, userId))
        .limit(1);
    if (!row) return null;
    try {
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            encryptionKey(),
            Buffer.from(row.iv, "base64"),
        );
        decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(row.encrypted_token, "base64")),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    } catch (err) {
        console.error("[user-api-keys] failed to decrypt IK token", {
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}

export async function saveUserIndianKanoonToken(
    userId: string,
    value: string | null,
    db: Db = sharedDb,
): Promise<void> {
    const normalized = value?.trim() || null;
    if (!normalized) {
        await db
            .delete(userIndiankanoonTokens)
            .where(eq(userIndiankanoonTokens.user_id, userId));
        return;
    }
    const enc = encrypt(normalized);
    await db
        .insert(userIndiankanoonTokens)
        .values({
            user_id: userId,
            encrypted_token: enc.encrypted_key,
            iv: enc.iv,
            auth_tag: enc.auth_tag,
            updated_at: new Date(),
        })
        .onConflictDoUpdate({
            target: userIndiankanoonTokens.user_id,
            set: {
                encrypted_token: enc.encrypted_key,
                iv: enc.iv,
                auth_tag: enc.auth_tag,
                updated_at: new Date(),
            },
        });
}

export async function saveUserApiKey(
    userId: string,
    provider: ApiKeyProvider,
    value: string | null,
    db: Db = sharedDb,
): Promise<void> {
    const normalized = value?.trim() || null;
    if (!normalized) {
        await db
            .delete(userApiKeys)
            .where(
                and(
                    eq(userApiKeys.user_id, userId),
                    eq(userApiKeys.provider, provider),
                ),
            );
        return;
    }

    const enc = encrypt(normalized);
    await db
        .insert(userApiKeys)
        .values({
            user_id: userId,
            provider,
            encrypted_key: enc.encrypted_key,
            iv: enc.iv,
            auth_tag: enc.auth_tag,
            updated_at: new Date(),
        })
        .onConflictDoUpdate({
            target: [userApiKeys.user_id, userApiKeys.provider],
            set: {
                encrypted_key: enc.encrypted_key,
                iv: enc.iv,
                auth_tag: enc.auth_tag,
                updated_at: new Date(),
            },
        });
}
