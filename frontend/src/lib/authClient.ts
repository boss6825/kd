"use client";

/**
 * Better Auth client — replaces the Supabase browser client.
 *
 * Sessions are carried as bearer tokens to match the backend's existing
 * `Authorization: Bearer` API. On a successful auth response the server sends
 * the token in the `set-auth-token` header (the `bearer` plugin); we stash it
 * in localStorage and replay it on every request. `credentials: "include"` is
 * also set so the cookie-based session works for the OAuth redirect flow
 * (Google), letting the post-redirect getSession() recover + cache the token.
 */

import { createAuthClient } from "better-auth/react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const TOKEN_KEY = "kd_bearer_token";

export function getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string): void {
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/** Authorization header for manual fetch() calls to the backend API. */
export function getAuthHeaders(): Record<string, string> {
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch the Express backend with the Better Auth session.
 *
 * Google OAuth (and some get-session refreshes) authenticate via the session
 * cookie but never persist `set-auth-token` in localStorage. API calls that
 * omit `credentials: "include"` then 401 even though the user is signed in.
 * Send both the cookie and, when present, the bearer token. If a stale bearer
 * token is rejected, drop it and retry with the cookie alone.
 */
export async function backendFetch(
    url: string,
    init: RequestInit = {},
): Promise<Response> {
    const send = (includeBearer: boolean) => {
        const headers = new Headers(init.headers);
        if (includeBearer) {
            const token = getStoredToken();
            if (token) headers.set("Authorization", `Bearer ${token}`);
        } else {
            headers.delete("Authorization");
        }
        return fetch(url, {
            ...init,
            cache: init.cache ?? "no-store",
            credentials: "include",
            headers,
        });
    };

    const hadToken = !!getStoredToken();
    let response = await send(true);
    if (response.status === 401 && hadToken) {
        clearStoredToken();
        response = await send(false);
    }
    return response;
}

export const authClient = createAuthClient({
    baseURL: API_BASE, // client appends /api/auth
    fetchOptions: {
        credentials: "include",
        auth: {
            type: "Bearer",
            token: () => getStoredToken() || "",
        },
        onSuccess: (ctx) => {
            const token = ctx.response.headers.get("set-auth-token");
            if (token) setStoredToken(token);
        },
    },
});

export const { signIn, signUp, signOut, useSession } = authClient;
