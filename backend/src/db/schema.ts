/**
 * Drizzle schema for KD (post-Supabase, on Neon Postgres).
 *
 * Two groups of tables:
 *   1. Better Auth core tables (`user`, `session`, `account`, `verification`).
 *      The exported *keys* (`emailVerified`, `userId`, …) must match Better
 *      Auth's model field names — the Drizzle adapter maps models to these
 *      columns by JS key, not SQL name. SQL columns stay snake_case.
 *   2. Application tables, ported 1:1 from the old Supabase schema.sql. These
 *      keep snake_case JS keys so selected rows have the same shape the rest of
 *      the codebase already expects (e.g. `row.message_credits_used`).
 *
 * User identity: Better Auth issues a text `user.id`. Every app table's
 * `user_id` is therefore `text`. The three tables that used to carry a
 * `uuid` FK to Supabase's `auth.users` (`user_profiles`, `user_api_keys`,
 * `user_indiankanoon_tokens`) now reference `user(id)` as text.
 */

import { sql } from "drizzle-orm";
import {
    pgTable,
    text,
    uuid,
    integer,
    boolean,
    timestamp,
    jsonb,
    unique,
    index,
    check,
    type AnyPgColumn,
} from "drizzle-orm/pg-core";

const ts = (name: string) =>
    timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Better Auth core tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// User profile / per-user secrets
// ---------------------------------------------------------------------------

export const userProfiles = pgTable(
    "user_profiles",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        user_id: text("user_id")
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: "cascade" }),
        display_name: text("display_name"),
        organisation: text("organisation"),
        tier: text("tier").notNull().default("Free"),
        message_credits_used: integer("message_credits_used")
            .notNull()
            .default(0),
        credits_reset_date: ts("credits_reset_date")
            .notNull()
            .default(sql`now() + interval '30 days'`),
        tabular_model: text("tabular_model")
            .notNull()
            .default("gemini-3-flash-preview"),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [index("idx_user_profiles_user").on(t.user_id)],
);

export const userApiKeys = pgTable(
    "user_api_keys",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        user_id: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        provider: text("provider").notNull(),
        encrypted_key: text("encrypted_key").notNull(),
        iv: text("iv").notNull(),
        auth_tag: text("auth_tag").notNull(),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
        unique("user_api_keys_user_provider_key").on(t.user_id, t.provider),
        index("idx_user_api_keys_user").on(t.user_id),
        check(
            "user_api_keys_provider_check",
            sql`${t.provider} in ('claude', 'gemini', 'openai')`,
        ),
    ],
);

export const userIndiankanoonTokens = pgTable("user_indiankanoon_tokens", {
    user_id: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    encrypted_token: text("encrypted_token").notNull(),
    iv: text("iv").notNull(),
    auth_tag: text("auth_tag").notNull(),
    created_at: ts("created_at").notNull().defaultNow(),
    updated_at: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Projects and documents
// ---------------------------------------------------------------------------

export const projects = pgTable(
    "projects",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        user_id: text("user_id").notNull(),
        name: text("name").notNull(),
        cm_number: text("cm_number"),
        visibility: text("visibility").notNull().default("private"),
        shared_with: jsonb("shared_with")
            .$type<string[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
        index("idx_projects_user").on(t.user_id),
        index("projects_shared_with_idx").using("gin", t.shared_with),
    ],
);

export const projectSubfolders = pgTable(
    "project_subfolders",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        project_id: uuid("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        user_id: text("user_id").notNull(),
        name: text("name").notNull(),
        parent_folder_id: uuid("parent_folder_id").references(
            (): AnyPgColumn => projectSubfolders.id,
            { onDelete: "cascade" },
        ),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [index("idx_project_subfolders_project").on(t.project_id)],
);

export const documents = pgTable(
    "documents",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        project_id: uuid("project_id").references(() => projects.id, {
            onDelete: "cascade",
        }),
        user_id: text("user_id").notNull(),
        filename: text("filename").notNull(),
        file_type: text("file_type"),
        size_bytes: integer("size_bytes").notNull().default(0),
        page_count: integer("page_count"),
        structure_tree: jsonb("structure_tree"),
        status: text("status").notNull().default("pending"),
        folder_id: uuid("folder_id").references(() => projectSubfolders.id, {
            onDelete: "set null",
        }),
        current_version_id: uuid("current_version_id").references(
            (): AnyPgColumn => documentVersions.id,
            { onDelete: "set null" },
        ),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
        index("idx_documents_user_project").on(t.user_id, t.project_id),
        index("idx_documents_project_folder").on(t.project_id, t.folder_id),
    ],
);

export const documentVersions = pgTable(
    "document_versions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        document_id: uuid("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        storage_path: text("storage_path").notNull(),
        pdf_storage_path: text("pdf_storage_path"),
        source: text("source").notNull().default("upload"),
        version_number: integer("version_number"),
        display_name: text("display_name"),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        index("document_versions_document_id_idx").on(
            t.document_id,
            t.created_at.desc(),
        ),
        index("document_versions_doc_vnum_idx").on(
            t.document_id,
            t.version_number,
        ),
        check(
            "document_versions_source_check",
            sql`${t.source} = any (array['upload', 'user_upload', 'assistant_edit', 'user_accept', 'user_reject', 'generated'])`,
        ),
    ],
);

export const documentEdits = pgTable(
    "document_edits",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        document_id: uuid("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        chat_message_id: uuid("chat_message_id").references(
            (): AnyPgColumn => chatMessages.id,
            { onDelete: "set null" },
        ),
        version_id: uuid("version_id")
            .notNull()
            .references(() => documentVersions.id, { onDelete: "cascade" }),
        change_id: text("change_id").notNull(),
        del_w_id: text("del_w_id"),
        ins_w_id: text("ins_w_id"),
        deleted_text: text("deleted_text").notNull().default(""),
        inserted_text: text("inserted_text").notNull().default(""),
        context_before: text("context_before"),
        context_after: text("context_after"),
        status: text("status").notNull().default("pending"),
        created_at: ts("created_at").notNull().defaultNow(),
        resolved_at: ts("resolved_at"),
    },
    (t) => [
        index("document_edits_document_id_idx").on(
            t.document_id,
            t.created_at.desc(),
        ),
        index("document_edits_message_id_idx").on(t.chat_message_id),
        index("document_edits_version_id_idx").on(t.version_id),
        check(
            "document_edits_status_check",
            sql`${t.status} = any (array['pending', 'accepted', 'rejected'])`,
        ),
    ],
);

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export const workflows = pgTable(
    "workflows",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        user_id: text("user_id"),
        title: text("title").notNull(),
        type: text("type").notNull(),
        prompt_md: text("prompt_md"),
        columns_config: jsonb("columns_config"),
        practice: text("practice"),
        is_system: boolean("is_system").notNull().default(false),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [index("idx_workflows_user").on(t.user_id)],
);

export const hiddenWorkflows = pgTable(
    "hidden_workflows",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        user_id: text("user_id").notNull(),
        workflow_id: text("workflow_id").notNull(),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        unique("hidden_workflows_user_workflow_key").on(
            t.user_id,
            t.workflow_id,
        ),
        index("idx_hidden_workflows_user").on(t.user_id),
    ],
);

export const workflowShares = pgTable(
    "workflow_shares",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        workflow_id: uuid("workflow_id")
            .notNull()
            .references(() => workflows.id, { onDelete: "cascade" }),
        shared_by_user_id: text("shared_by_user_id").notNull(),
        shared_with_email: text("shared_with_email").notNull(),
        allow_edit: boolean("allow_edit").notNull().default(false),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        unique("workflow_shares_workflow_email_unique").on(
            t.workflow_id,
            t.shared_with_email,
        ),
        index("workflow_shares_workflow_id_idx").on(t.workflow_id),
        index("workflow_shares_email_idx").on(t.shared_with_email),
    ],
);

// ---------------------------------------------------------------------------
// Assistant chats
// ---------------------------------------------------------------------------

export const chats = pgTable(
    "chats",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        project_id: uuid("project_id").references(() => projects.id, {
            onDelete: "cascade",
        }),
        user_id: text("user_id").notNull(),
        title: text("title"),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        index("idx_chats_user").on(t.user_id),
        index("idx_chats_project").on(t.project_id),
    ],
);

export const chatMessages = pgTable(
    "chat_messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        chat_id: uuid("chat_id")
            .notNull()
            .references(() => chats.id, { onDelete: "cascade" }),
        role: text("role").notNull(),
        content: jsonb("content"),
        files: jsonb("files"),
        // The committed Supabase schema.sql omitted this, but the live DB and
        // the API (mikeApi ServerMessage, chat routes) both use it.
        workflow: jsonb("workflow"),
        annotations: jsonb("annotations"),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [index("idx_chat_messages_chat").on(t.chat_id)],
);

// ---------------------------------------------------------------------------
// Tabular reviews
// ---------------------------------------------------------------------------

export const tabularReviews = pgTable(
    "tabular_reviews",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        project_id: uuid("project_id").references(() => projects.id, {
            onDelete: "cascade",
        }),
        user_id: text("user_id").notNull(),
        title: text("title"),
        columns_config: jsonb("columns_config"),
        document_ids: jsonb("document_ids"),
        workflow_id: uuid("workflow_id").references(() => workflows.id, {
            onDelete: "set null",
        }),
        practice: text("practice"),
        shared_with: jsonb("shared_with")
            .$type<string[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
        index("idx_tabular_reviews_user").on(t.user_id),
        index("idx_tabular_reviews_project").on(t.project_id),
        index("tabular_reviews_shared_with_idx").using("gin", t.shared_with),
    ],
);

export const tabularCells = pgTable(
    "tabular_cells",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        review_id: uuid("review_id")
            .notNull()
            .references(() => tabularReviews.id, { onDelete: "cascade" }),
        document_id: uuid("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        column_index: integer("column_index").notNull(),
        content: text("content"),
        citations: jsonb("citations"),
        status: text("status").notNull().default("pending"),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        index("idx_tabular_cells_review").on(
            t.review_id,
            t.document_id,
            t.column_index,
        ),
    ],
);

export const tabularReviewChats = pgTable(
    "tabular_review_chats",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        review_id: uuid("review_id")
            .notNull()
            .references(() => tabularReviews.id, { onDelete: "cascade" }),
        user_id: text("user_id").notNull(),
        title: text("title"),
        created_at: ts("created_at").notNull().defaultNow(),
        updated_at: ts("updated_at").notNull().defaultNow(),
    },
    (t) => [
        index("tabular_review_chats_review_idx").on(
            t.review_id,
            t.updated_at.desc(),
        ),
        index("tabular_review_chats_user_idx").on(t.user_id),
    ],
);

export const tabularReviewChatMessages = pgTable(
    "tabular_review_chat_messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        chat_id: uuid("chat_id")
            .notNull()
            .references(() => tabularReviewChats.id, { onDelete: "cascade" }),
        role: text("role").notNull(),
        content: jsonb("content"),
        annotations: jsonb("annotations"),
        created_at: ts("created_at").notNull().defaultNow(),
    },
    (t) => [
        index("tabular_review_chat_messages_chat_idx").on(
            t.chat_id,
            t.created_at,
        ),
    ],
);

// ---------------------------------------------------------------------------
// eCourts India response cache
// ---------------------------------------------------------------------------

export const ecourtsCache = pgTable(
    "ecourts_cache",
    {
        cache_key: text("cache_key").primaryKey(),
        resource: text("resource").notNull(),
        payload: jsonb("payload").notNull(),
        request_id: text("request_id"),
        created_at: ts("created_at").notNull().defaultNow(),
        expires_at: ts("expires_at").notNull(),
    },
    (t) => [index("idx_ecourts_cache_expires_at").on(t.expires_at)],
);
