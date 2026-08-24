export function errorFromApiResponse(status: number, body: string): Error {
    let detail = body.trim();
    try {
        const json = JSON.parse(body) as {
            detail?: unknown;
            message?: unknown;
        };
        if (typeof json.detail === "string" && json.detail.trim()) {
            detail = json.detail.trim();
        } else if (typeof json.message === "string" && json.message.trim()) {
            detail = json.message.trim();
        }
    } catch {
        // Keep the raw body when it is not JSON.
    }

    if (status === 401) {
        return new Error("Your session expired. Please sign in again and retry.");
    }

    if (/USER_API_KEYS_ENCRYPTION_SECRET/i.test(detail)) {
        return new Error(
            "The backend is missing USER_API_KEYS_ENCRYPTION_SECRET, so keys cannot be encrypted at rest. Set it in backend/.env (openssl rand -hex 32) and restart the backend.",
        );
    }

    return new Error(detail || `API error: ${status}`);
}

export function errorFromFailedFetch(apiBase: string, err: unknown): Error {
    if (err instanceof TypeError) {
        return new Error(
            `Cannot reach the backend at ${apiBase}. Make sure it is running and reachable.`,
        );
    }
    return err instanceof Error ? err : new Error(String(err));
}
