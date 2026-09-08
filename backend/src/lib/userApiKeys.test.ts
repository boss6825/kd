import "dotenv/config";
import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import { pool } from "../db";
import {
    assertUserApiKeysEncryptionConfigured,
    hasEnvApiKey,
    isPlaceholderProviderKey,
} from "./userApiKeys";

const ENV_KEYS = [
    "ANTHROPIC_API_KEY",
    "CLAUDE_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "USER_API_KEYS_ENCRYPTION_SECRET",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
}

afterEach(() => {
    for (const key of ENV_KEYS) {
        const value = originalEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

after(async () => {
    await pool.end();
});

describe("isPlaceholderProviderKey", () => {
    it("rejects empty and example-file placeholders", () => {
        assert.equal(isPlaceholderProviderKey(null), true);
        assert.equal(isPlaceholderProviderKey(""), true);
        assert.equal(isPlaceholderProviderKey("your-openai-key"), true);
        assert.equal(isPlaceholderProviderKey("your-anthropic-key"), true);
        assert.equal(isPlaceholderProviderKey("your-gemini-key"), true);
        assert.equal(isPlaceholderProviderKey("replace-with-a-key"), true);
    });

    it("accepts real-looking provider keys", () => {
        assert.equal(
            isPlaceholderProviderKey("sk-throwaway-fake-openai-key-abc123"),
            false,
        );
        assert.equal(
            isPlaceholderProviderKey("sk-ant-throwaway-fake-anthropic-key"),
            false,
        );
        assert.equal(isPlaceholderProviderKey("AIzaSyFakeGeminiKey"), false);
    });
});

describe("hasEnvApiKey", () => {
    it("ignores placeholder env values so BYOK fields stay editable", () => {
        process.env.OPENAI_API_KEY = "your-openai-key";
        process.env.ANTHROPIC_API_KEY = "your-anthropic-key";
        process.env.GEMINI_API_KEY = "your-gemini-key";
        assert.equal(hasEnvApiKey("openai"), false);
        assert.equal(hasEnvApiKey("claude"), false);
        assert.equal(hasEnvApiKey("gemini"), false);
    });

    it("reports a real env key as configured", () => {
        process.env.OPENAI_API_KEY = "sk-throwaway-fake-openai-key-abc123";
        assert.equal(hasEnvApiKey("openai"), true);
    });
});

describe("assertUserApiKeysEncryptionConfigured", () => {
    it("throws when the encryption secret is missing", () => {
        delete process.env.USER_API_KEYS_ENCRYPTION_SECRET;
        assert.throws(
            () => assertUserApiKeysEncryptionConfigured(),
            /USER_API_KEYS_ENCRYPTION_SECRET is not configured/,
        );
    });

    it("accepts a configured secret", () => {
        process.env.USER_API_KEYS_ENCRYPTION_SECRET = "test-secret";
        assert.doesNotThrow(() => assertUserApiKeysEncryptionConfigured());
    });
});
