/**
 * Indian Kanoon API client.
 *
 * Wraps the four endpoints used by the precedent-research tools:
 *   - /search/         full-text + filtered search over case law
 *   - /doc/<id>/       full judgment text + metadata
 *   - /docmeta/<id>/   metadata only (cheaper)
 *   - /docfragment/    snippet view of a doc for a given query
 *
 * Auth uses the shared API token approach:
 *   Authorization: Token <token>
 *
 * Per the docs all requests are POSTs (the server ignores the body but
 * rejects GETs for the search/doc endpoints).
 *
 * Token resolution: per-user token (from user_api_keys) takes precedence,
 * with backend INDIAN_KANOON_API_TOKEN as a fallback.
 */

const IK_BASE_URL = "https://api.indiankanoon.org";

export type IkSearchDoc = {
    tid: number;
    title: string;
    headline?: string;
    docsource?: string;
    publishdate?: string;
    numcites?: number;
    numcitedby?: number;
};

export type IkSearchResponse = {
    docs: IkSearchDoc[];
    found?: string;
    categories?: unknown[];
    encodedformInput?: string;
};

export type IkDocResponse = {
    tid: number;
    title: string;
    doc: string;
    docsource?: string;
    publishdate?: string;
    numcites?: number;
    numcitedby?: number;
    citeList?: { tid: number; title: string }[];
    citedbyList?: { tid: number; title: string }[];
};

export type IkDocMeta = {
    tid: number;
    title: string;
    docsource?: string;
    publishdate?: string;
    numcites?: number;
    numcitedby?: number;
};

export class IndianKanoonError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message);
        this.name = "IndianKanoonError";
    }
}

function envToken(): string | null {
    return process.env.INDIAN_KANOON_API_TOKEN?.trim() || null;
}

export function hasEnvIndianKanoonToken(): boolean {
    return !!envToken();
}

/**
 * Resolve which token to use for a request. Pass the per-user token (if
 * any) and we fall back to env. Returns null if neither is set — callers
 * should surface that as a configuration error rather than 401-looping.
 */
export function resolveIndianKanoonToken(
    userToken: string | null | undefined,
): string | null {
    const u = userToken?.trim();
    if (u) return u;
    return envToken();
}

async function ikFetch<T>(
    path: string,
    token: string,
    query?: Record<string, string | number | undefined>,
): Promise<T> {
    const url = new URL(IK_BASE_URL + path);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null || v === "") continue;
            url.searchParams.set(k, String(v));
        }
    }
    const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
            Authorization: `Token ${token}`,
            Accept: "application/json",
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new IndianKanoonError(
            `Indian Kanoon ${path} failed (${res.status}): ${body.slice(0, 200)}`,
            res.status,
        );
    }
    return (await res.json()) as T;
}

export async function ikSearch(params: {
    token: string;
    query: string;
    pagenum?: number;
    doctypes?: string;
    fromdate?: string;
    todate?: string;
    title?: string;
    cite?: string;
    author?: string;
    bench?: string;
    maxcites?: number;
    maxpages?: number;
}): Promise<IkSearchResponse> {
    const { token, query, ...rest } = params;
    return ikFetch<IkSearchResponse>("/search/", token, {
        formInput: query,
        ...rest,
    });
}

export async function ikGetDoc(params: {
    token: string;
    docId: number | string;
    maxcites?: number;
    maxcitedby?: number;
}): Promise<IkDocResponse> {
    const { token, docId, ...rest } = params;
    return ikFetch<IkDocResponse>(`/doc/${docId}/`, token, rest);
}

export async function ikGetDocMeta(
    token: string,
    docId: number | string,
): Promise<IkDocMeta> {
    return ikFetch<IkDocMeta>(`/docmeta/${docId}/`, token);
}

/**
 * Strip HTML to plain text. The /doc/ endpoint returns the judgment as
 * an HTML string; the LLM only needs the readable text, and trimming
 * tags keeps the tool result well under context limits.
 */
export function stripHtml(html: string): string {
    if (!html) return "";
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
