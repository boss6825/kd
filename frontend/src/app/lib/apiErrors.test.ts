import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorFromApiResponse } from "./apiErrors.ts";

describe("errorFromApiResponse", () => {
    it("unwraps JSON detail from the key-save endpoint", () => {
        const err = errorFromApiResponse(
            500,
            JSON.stringify({
                detail: "Failed to save API key: boom",
            }),
        );
        assert.equal(err.message, "Failed to save API key: boom");
    });

    it("explains a missing encryption secret instead of dumping JSON", () => {
        const err = errorFromApiResponse(
            500,
            JSON.stringify({
                detail: "Failed to save API key: USER_API_KEYS_ENCRYPTION_SECRET is not configured",
            }),
        );
        assert.match(err.message, /USER_API_KEYS_ENCRYPTION_SECRET/);
        assert.match(err.message, /backend\/\.env/);
        assert.equal(err.message.startsWith("{"), false);
    });

    it("maps 401 to a sign-in prompt", () => {
        const err = errorFromApiResponse(
            401,
            JSON.stringify({ detail: "Invalid or expired session" }),
        );
        assert.match(err.message, /sign in again/i);
    });
});
