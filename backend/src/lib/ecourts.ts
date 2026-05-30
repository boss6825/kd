/**
 * eCourts India partner API client (webapi.ecourtsindia.com, v4.0).
 *
 * This is the ONE module that owns the eCourts integration. Every other part
 * of the codebase calls these functions, never raw HTTP. Responsibilities:
 *
 *   - Owns the base URL + Bearer auth header (ECOURTS_API_KEY).
 *   - Unwraps the `{ data, meta }` success envelope and returns `data`.
 *   - Maps `error.code` (INVALID_CNR, INSUFFICIENT_CREDITS, ...) to a typed
 *     EcourtsError so callers branch on a stable code, not a status number.
 *   - Logs `meta.request_id` for every call so support tickets are traceable.
 *   - Transparently caches successful responses in public.ecourts_cache with a
 *     per-resource TTL, since every authenticated call costs credits.
 *
 * Endpoints wrapped (the ones the product actually needs):
 *   - GET  /api/partner/enums                          enum reference (cheap)
 *   - GET  /api/partner/case/{cnr}                     full case detail
 *   - GET  /api/partner/search                         full-text case search
 *   - GET  /api/partner/case/{cnr}/order-ai/{file}     extracted text + AI
 *   - POST /api/partner/case/{cnr}/refresh             re-scrape from source
 *
 * Quirks confirmed against the live API (deviate from the published docs):
 *   - /enums DOES require the Bearer token (docs say no auth), and the payload
 *     is nested under `data.enums.*`, not `data.*`.
 *   - The envelope uses `meta.request_id` (snake_case), not `requestId`.
 */

import { createServerSupabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const ECOURTS_BASE_URL = "https://webapi.ecourtsindia.com";

/** Unique 16-char Case Number Record: 4 letters + 12 digits. */
export const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;

export function isValidCnr(cnr: string): boolean {
    return CNR_PATTERN.test(cnr.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Stable error codes from the API's error envelope. Callers should branch on
 * `EcourtsError.code` rather than the HTTP status. UNKNOWN covers transport
 * failures and any code the API adds later.
 */
export type EcourtsErrorCode =
    | "INVALID_TOKEN"
    | "TOKEN_INACTIVE"
    | "TOKEN_EXPIRED"
    | "ACCOUNT_INACTIVE"
    | "INSUFFICIENT_CREDITS"
    | "SUBSCRIPTION_REQUIRED"
    | "RATE_LIMIT_EXCEEDED"
    | "TOO_MANY_CONVERSIONS"
    | "INVALID_CNR"
    | "INVALID_PARAMETER"
    | "MISSING_PARAMETER"
    | "PAGE_SIZE_EXCEEDED"
    | "INVALID_FILENAME"
    | "CASE_NOT_FOUND"
    | "ORDER_NOT_FOUND"
    | "INTERNAL_ERROR"
    | "NOT_CONFIGURED"
    | "UNKNOWN";

export class EcourtsError extends Error {
    constructor(
        message: string,
        public code: EcourtsErrorCode,
        public status?: number,
        public requestId?: string,
        /** Seconds to wait before retrying (from Retry-After on 429). */
        public retryAfter?: number,
    ) {
        super(message);
        this.name = "EcourtsError";
    }

    /** Transient errors worth retrying with backoff. */
    get isRetryable(): boolean {
        return (
            this.code === "RATE_LIMIT_EXCEEDED" ||
            this.code === "TOO_MANY_CONVERSIONS" ||
            this.code === "INTERNAL_ERROR" ||
            this.status === 503
        );
    }
}

// ---------------------------------------------------------------------------
// Auth / config
// ---------------------------------------------------------------------------

function apiKey(): string | null {
    return process.env.ECOURTS_API_KEY?.trim() || null;
}

export function isEcourtsConfigured(): boolean {
    return !!apiKey();
}

// ---------------------------------------------------------------------------
// Cache layer (public.ecourts_cache)
// ---------------------------------------------------------------------------

/** Resource kinds, each with its own freshness window. */
export type EcourtsResource =
    | "enums"
    | "case"
    | "search"
    | "order-ai";

/**
 * Per-resource TTLs (ms). Tuned to how fast each resource changes vs. its
 * credit cost. Order AI analysis is effectively immutable once generated, so
 * it gets a long TTL; case detail and search go stale as hearings progress.
 * Override at the call site via `CacheOptions.ttlMs` when needed.
 */
const CACHE_TTL_MS: Record<EcourtsResource, number> = {
    enums: 60 * 60 * 1000, // 1 hour (matches the API's own enum cache)
    case: 12 * 60 * 60 * 1000, // 12 hours; use refreshCase() to force-fresh
    search: 60 * 60 * 1000, // 1 hour
    "order-ai": 30 * 24 * 60 * 60 * 1000, // 30 days (immutable once analysed)
};

export type CacheOptions = {
    /** Skip the cache read and force a network fetch (still writes back). */
    forceRefresh?: boolean;
    /** Override the default TTL for this resource (ms). */
    ttlMs?: number;
};

let cachedSupabase: SupabaseClient | null | undefined;

/** Lazily resolve a service-role client; null if Supabase isn't configured. */
function cacheClient(): SupabaseClient | null {
    if (cachedSupabase === undefined) {
        try {
            cachedSupabase = createServerSupabase();
        } catch {
            cachedSupabase = null; // degrade to no-cache rather than throwing
        }
    }
    return cachedSupabase;
}

async function cacheGet<T>(key: string): Promise<T | null> {
    const db = cacheClient();
    if (!db) return null;
    try {
        const { data, error } = await db
            .from("ecourts_cache")
            .select("payload, expires_at")
            .eq("cache_key", key)
            .maybeSingle();
        if (error || !data) return null;
        if (new Date(data.expires_at as string).getTime() <= Date.now()) {
            return null; // expired; treat as miss (lazy eviction)
        }
        return data.payload as T;
    } catch {
        return null;
    }
}

async function cacheSet(
    key: string,
    resource: EcourtsResource,
    payload: unknown,
    ttlMs: number,
    requestId?: string,
): Promise<void> {
    const db = cacheClient();
    if (!db) return;
    try {
        await db.from("ecourts_cache").upsert(
            {
                cache_key: key,
                resource,
                payload,
                request_id: requestId ?? null,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttlMs).toISOString(),
            },
            { onConflict: "cache_key" },
        );
    } catch {
        // A cache write failure must never break the request.
    }
}

/** Delete cached rows by exact key or key prefix (e.g. invalidate a CNR). */
export async function cacheInvalidate(opts: {
    key?: string;
    prefix?: string;
}): Promise<void> {
    const db = cacheClient();
    if (!db) return;
    try {
        if (opts.key) {
            await db.from("ecourts_cache").delete().eq("cache_key", opts.key);
        }
        if (opts.prefix) {
            await db
                .from("ecourts_cache")
                .delete()
                .like("cache_key", `${opts.prefix}%`);
        }
    } catch {
        /* best effort */
    }
}

// ---------------------------------------------------------------------------
// Core HTTP
// ---------------------------------------------------------------------------

type Envelope<T> = {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
    meta?: { request_id?: string; requestId?: string };
};

function buildUrl(
    path: string,
    query?: Record<string, string | number | string[] | undefined>,
): string {
    const url = new URL(ECOURTS_BASE_URL + path);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null || v === "") continue;
            if (Array.isArray(v)) {
                // The search API takes repeated keys for array filters
                // (e.g. ?courtCodes=DLHC01&courtCodes=HCBM01).
                for (const item of v) {
                    if (item === undefined || item === null || item === "")
                        continue;
                    url.searchParams.append(k, String(item));
                }
            } else {
                url.searchParams.set(k, String(v));
            }
        }
    }
    return url.toString();
}

/**
 * Single point of network egress. Sends the Bearer header, parses the
 * envelope, logs the request id, and throws a typed EcourtsError on failure.
 */
async function ecourtsFetch<T>(
    path: string,
    opts: {
        method?: "GET" | "POST";
        query?: Record<string, string | number | string[] | undefined>;
        body?: unknown;
    } = {},
): Promise<{ data: T; requestId?: string }> {
    const key = apiKey();
    if (!key) {
        throw new EcourtsError(
            "eCourts API is not configured. Set ECOURTS_API_KEY on the backend.",
            "NOT_CONFIGURED",
        );
    }

    const url = buildUrl(path, opts.query);
    let res: Response;
    try {
        res = await fetch(url, {
            method: opts.method ?? "GET",
            headers: {
                Authorization: `Bearer ${key}`,
                Accept: "application/json",
                ...(opts.body ? { "Content-Type": "application/json" } : {}),
            },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
    } catch (err) {
        throw new EcourtsError(
            `eCourts network error for ${path}: ${
                err instanceof Error ? err.message : String(err)
            }`,
            "UNKNOWN",
        );
    }

    const text = await res.text();
    let parsed: Envelope<T> | null = null;
    try {
        parsed = text ? (JSON.parse(text) as Envelope<T>) : null;
    } catch {
        parsed = null;
    }

    const requestId = parsed?.meta?.request_id ?? parsed?.meta?.requestId;

    if (!res.ok || parsed?.error) {
        const code = (parsed?.error?.code ?? "UNKNOWN") as EcourtsErrorCode;
        const message =
            parsed?.error?.message ??
            `eCourts ${path} failed (${res.status})`;
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfter = retryAfterHeader
            ? Number.parseInt(retryAfterHeader, 10)
            : undefined;
        // Logged at error level so the request id is captured for support.
        console.error(
            `[ecourts] ${opts.method ?? "GET"} ${path} -> ${res.status} ${code}` +
                (requestId ? ` (request_id=${requestId})` : ""),
        );
        throw new EcourtsError(
            message,
            code,
            res.status,
            requestId,
            Number.isFinite(retryAfter) ? retryAfter : undefined,
        );
    }

    console.log(
        `[ecourts] ${opts.method ?? "GET"} ${path} -> 200` +
            (requestId ? ` (request_id=${requestId})` : ""),
    );

    return { data: parsed?.data as T, requestId };
}

/** Fetch through the cache: check, miss → network, write back. */
async function fetchCached<T>(
    cacheKey: string,
    resource: EcourtsResource,
    cache: CacheOptions | undefined,
    fetcher: () => Promise<{ data: T; requestId?: string }>,
): Promise<T> {
    if (!cache?.forceRefresh) {
        const hit = await cacheGet<T>(cacheKey);
        if (hit !== null) {
            console.log(`[ecourts] cache HIT ${cacheKey}`);
            return hit;
        }
    }
    const { data, requestId } = await fetcher();
    await cacheSet(
        cacheKey,
        resource,
        data,
        cache?.ttlMs ?? CACHE_TTL_MS[resource],
        requestId,
    );
    return data;
}

// ---------------------------------------------------------------------------
// Types (only the fields the product reads — the API returns much more)
// ---------------------------------------------------------------------------

export type EcourtsEnumValue = { code: string; description: string };
export type EcourtsEnums = Record<string, EcourtsEnumValue[]>;

export type OrderRef = {
    orderDate?: string;
    orderType?: string;
    description?: string;
    /** Bare filename for the /order-ai and /order-md endpoints. */
    orderUrl?: string;
};

export type CaseDetail = {
    courtCaseData?: {
        cnr?: string;
        caseType?: string;
        caseStatus?: string;
        courtName?: string;
        filingDate?: string;
        registrationNumber?: string;
        decisionDate?: string;
        nextHearingDate?: string;
        petitioners?: string[];
        respondents?: string[];
        petitionerAdvocates?: string[];
        respondentAdvocates?: string[];
        judges?: string[];
        hasOrders?: boolean;
        orderCount?: number;
        interimOrders?: OrderRef[];
        judgmentOrders?: OrderRef[];
        [k: string]: unknown;
    };
    entityInfo?: Record<string, unknown>;
    files?: {
        files?: Array<{
            pdfFile?: string;
            markdownContent?: string;
            [k: string]: unknown;
        }>;
    };
    descriptions?: Record<string, unknown>;
    caseAiAnalysis?: unknown;
    [k: string]: unknown;
};

export type SearchResultItem = {
    cnr: string;
    caseType?: string;
    caseStatus?: string;
    filingDate?: string;
    nextHearingDate?: string;
    decisionDate?: string;
    judges?: string[];
    petitioners?: string[];
    respondents?: string[];
    petitionerAdvocates?: string[];
    respondentAdvocates?: string[];
    courtCode?: string;
    caseCategory?: string;
    [k: string]: unknown;
};

export type SearchResponse = {
    results: SearchResultItem[];
    totalHits: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    facets?: Record<string, unknown>;
    enumDescriptions?: Record<string, unknown>;
    [k: string]: unknown;
};

export type OrderAi = {
    cnr: string;
    filename: string;
    extractedText?: string;
    aiAnalysis: Record<string, unknown> | null;
};

export type SearchParams = {
    // Text search (any of these)
    query?: string;
    advocates?: string;
    judges?: string;
    petitioners?: string;
    respondents?: string;
    litigants?: string;
    // Array filters — use search-ready court codes (e.g. DLHC01, not DLHC).
    courtCodes?: string[];
    caseTypes?: string[];
    caseStatuses?: string[];
    // Date ranges (YYYY-MM-DD)
    filingDateFrom?: string;
    filingDateTo?: string;
    // Pagination
    page?: number;
    pageSize?: number;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enum reference. NOTE: despite the docs, this endpoint requires the Bearer
 * token and nests values under `data.enums.*`, which we flatten here.
 */
export async function getEnums(
    types?: string[],
    cache?: CacheOptions,
): Promise<EcourtsEnums> {
    const typesParam = types?.length ? types.join(",") : undefined;
    const cacheKey = `enums:${typesParam ?? "all"}`;
    return fetchCached(cacheKey, "enums", cache, async () => {
        const { data, requestId } = await ecourtsFetch<
            { enums?: EcourtsEnums } & EcourtsEnums
        >("/api/partner/enums", {
            query: { types: typesParam },
        });
        // Live shape is { data: { enums: {...} } }; tolerate a flat shape too.
        const enums = (data?.enums ?? data ?? {}) as EcourtsEnums;
        return { data: enums, requestId };
    });
}

/** Full case detail by CNR. Throws INVALID_CNR locally for malformed input. */
export async function getCaseDetail(
    cnr: string,
    cache?: CacheOptions,
): Promise<CaseDetail> {
    const normalized = cnr.trim().toUpperCase();
    if (!isValidCnr(normalized)) {
        throw new EcourtsError(
            `Invalid CNR "${cnr}". Expected 4 letters followed by 12 digits.`,
            "INVALID_CNR",
        );
    }
    return fetchCached(
        `case:${normalized}`,
        "case",
        cache,
        () => ecourtsFetch<CaseDetail>(`/api/partner/case/${normalized}`),
    );
}

/** Full-text / filtered case search across the national index. */
export async function searchCases(
    params: SearchParams,
    cache?: CacheOptions,
): Promise<SearchResponse> {
    const query: Record<string, string | number | string[] | undefined> = {
        query: params.query,
        advocates: params.advocates,
        judges: params.judges,
        petitioners: params.petitioners,
        respondents: params.respondents,
        litigants: params.litigants,
        courtCodes: params.courtCodes,
        caseTypes: params.caseTypes,
        caseStatuses: params.caseStatuses,
        filingDateFrom: params.filingDateFrom,
        filingDateTo: params.filingDateTo,
        page: params.page,
        pageSize: params.pageSize,
    };
    // Stable cache key independent of property order.
    const cacheKey = `search:${stableKey(query)}`;
    return fetchCached(cacheKey, "search", cache, () =>
        ecourtsFetch<SearchResponse>("/api/partner/search", { query }),
    );
}

/**
 * Extracted order text + AI analysis. Generated on-demand on first access
 * (10-60s); `aiAnalysis` can be null while processing. When `waitForAi` is
 * set we poll up to `maxAttempts` with `waitMs` gaps (defaults follow the
 * doc's guidance: 3 tries, ~20s apart). Cached for 30 days once analysed.
 */
export async function getOrderAi(
    cnr: string,
    filename: string,
    opts: {
        waitForAi?: boolean;
        maxAttempts?: number;
        waitMs?: number;
        cache?: CacheOptions;
    } = {},
): Promise<OrderAi> {
    const normalized = cnr.trim().toUpperCase();
    if (!isValidCnr(normalized)) {
        throw new EcourtsError(
            `Invalid CNR "${cnr}".`,
            "INVALID_CNR",
        );
    }
    const path = `/api/partner/case/${normalized}/order-ai/${encodeURIComponent(
        filename,
    )}`;
    const cacheKey = `order-ai:${normalized}:${filename}`;

    const maxAttempts = opts.waitForAi ? (opts.maxAttempts ?? 3) : 1;
    const waitMs = opts.waitMs ?? 20_000;

    // Only consult the cache for a fully-analysed result; a cached null would
    // pin us to an unprocessed order forever.
    if (!opts.cache?.forceRefresh) {
        const hit = await cacheGet<OrderAi>(cacheKey);
        if (hit?.aiAnalysis) {
            console.log(`[ecourts] cache HIT ${cacheKey}`);
            return hit;
        }
    }

    let last: OrderAi | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data, requestId } = await ecourtsFetch<OrderAi>(path);
        last = data;
        if (data?.aiAnalysis) {
            await cacheSet(
                cacheKey,
                "order-ai",
                data,
                opts.cache?.ttlMs ?? CACHE_TTL_MS["order-ai"],
                requestId,
            );
            return data;
        }
        if (attempt < maxAttempts) {
            await sleep(waitMs);
        }
    }
    // Return the last (un-analysed) payload so the caller can fall back to
    // extractedText or case-detail markdown rather than erroring out.
    return (
        last ?? { cnr: normalized, filename, aiAnalysis: null }
    );
}

/**
 * Queue a fresh scrape from the eCourts source servers (async, ~5-10s).
 * Also invalidates the cached case detail so the next read re-fetches.
 */
export async function refreshCase(
    cnr: string,
): Promise<{ status?: string; message?: string }> {
    const normalized = cnr.trim().toUpperCase();
    if (!isValidCnr(normalized)) {
        throw new EcourtsError(`Invalid CNR "${cnr}".`, "INVALID_CNR");
    }
    const { data } = await ecourtsFetch<{ status?: string; message?: string }>(
        `/api/partner/case/${normalized}/refresh`,
        { method: "POST" },
    );
    await cacheInvalidate({ prefix: `case:${normalized}` });
    return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull the full order text straight from a case-detail response. The
 * case-detail `files.files[].markdownContent` already holds the COMPLETE
 * order text for free, so prefer this over an extra /order-ai or /order-md
 * call when you only need the words on the page.
 */
export function extractOrderMarkdown(detail: CaseDetail): string[] {
    const files = detail.files?.files ?? [];
    return files
        .map((f) => f.markdownContent)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

/**
 * Build a human-readable case title from party arrays. Search and case-detail
 * responses have no "title" field — construct one as "A vs B".
 */
export function buildCaseTitle(parties: {
    petitioners?: string[];
    respondents?: string[];
}): string {
    const p = parties.petitioners?.[0] ?? "Unknown";
    const r = parties.respondents?.[0] ?? "Unknown";
    return `${p} vs ${r}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deterministic key from an object — sorted entries, drops empty values. */
function stableKey(
    obj: Record<string, string | number | string[] | undefined>,
): string {
    return Object.keys(obj)
        .sort()
        .map((k) => {
            const v = obj[k];
            if (v === undefined || v === null || v === "") return null;
            return `${k}=${Array.isArray(v) ? [...v].sort().join(",") : v}`;
        })
        .filter(Boolean)
        .join("&");
}
