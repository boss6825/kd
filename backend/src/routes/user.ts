import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, type Db } from "../db";
import { user, userProfiles } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { DEFAULT_TABULAR_MODEL, resolveModel } from "../lib/llm";
import {
  type ApiKeyStatus,
  getUserApiKeyStatus,
  normalizeApiKeyProvider,
  saveUserApiKey,
  getUserIndianKanoonToken,
  saveUserIndianKanoonToken,
} from "../lib/userApiKeys";
import { hasEnvIndianKanoonToken } from "../lib/indianKanoon";

export const userRouter = Router();

const MONTHLY_CREDIT_LIMIT = 999999;

type UserProfileRow = {
  display_name: string | null;
  organisation: string | null;
  message_credits_used: number;
  credits_reset_date: Date;
  tier: string;
  tabular_model: string;
};

// Column set selected/returned for a profile row.
const profileCols = {
  display_name: userProfiles.display_name,
  organisation: userProfiles.organisation,
  message_credits_used: userProfiles.message_credits_used,
  credits_reset_date: userProfiles.credits_reset_date,
  tier: userProfiles.tier,
  tabular_model: userProfiles.tabular_model,
};

function serializeProfile(row: UserProfileRow, apiKeyStatus?: ApiKeyStatus) {
  const creditsUsed = row.message_credits_used ?? 0;
  return {
    displayName: row.display_name,
    organisation: row.organisation,
    messageCreditsUsed: creditsUsed,
    creditsResetDate: row.credits_reset_date,
    creditsRemaining: Math.max(MONTHLY_CREDIT_LIMIT - creditsUsed, 0),
    tier: row.tier || "Free",
    tabularModel: resolveModel(row.tabular_model, DEFAULT_TABULAR_MODEL),
    ...(apiKeyStatus ? { apiKeyStatus } : {}),
  };
}

function validateProfilePayload(body: unknown):
  | {
      ok: true;
      update: {
        display_name?: string | null;
        organisation?: string | null;
        tabular_model?: string;
        updated_at: Date;
      };
    }
  | { ok: false; detail: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, detail: "Expected a JSON object" };
  }

  const raw = body as Record<string, unknown>;
  const allowedFields = new Set([
    "displayName",
    "organisation",
    "tabularModel",
  ]);
  const invalidField = Object.keys(raw).find((key) => !allowedFields.has(key));
  if (invalidField) {
    return { ok: false, detail: `Unsupported profile field: ${invalidField}` };
  }

  const update: {
    display_name?: string | null;
    organisation?: string | null;
    tabular_model?: string;
    updated_at: Date;
  } = { updated_at: new Date() };

  if ("displayName" in raw) {
    if (raw.displayName !== null && typeof raw.displayName !== "string") {
      return { ok: false, detail: "displayName must be a string or null" };
    }
    update.display_name = raw.displayName?.trim() || null;
  }

  if ("organisation" in raw) {
    if (raw.organisation !== null && typeof raw.organisation !== "string") {
      return { ok: false, detail: "organisation must be a string or null" };
    }
    update.organisation = raw.organisation?.trim() || null;
  }

  if ("tabularModel" in raw) {
    if (typeof raw.tabularModel !== "string") {
      return { ok: false, detail: "tabularModel must be a string" };
    }
    const resolved = resolveModel(raw.tabularModel, "");
    if (!resolved) {
      return { ok: false, detail: "Unsupported tabularModel" };
    }
    update.tabular_model = resolved;
  }

  return { ok: true, update };
}

async function ensureProfileRow(
  db: Db,
  userId: string,
): Promise<Error | null> {
  try {
    await db
      .insert(userProfiles)
      .values({ user_id: userId })
      .onConflictDoNothing({ target: userProfiles.user_id });
    return null;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

async function loadProfile(
  db: Db,
  userId: string,
  options: { repairMissing?: boolean } = {},
) {
  let [data] = await db
    .select(profileCols)
    .from(userProfiles)
    .where(eq(userProfiles.user_id, userId))
    .limit(1);

  if (!data) {
    if (!options.repairMissing) {
      return { data: null, error: new Error("Profile not found") };
    }

    const ensureError = await ensureProfileRow(db, userId);
    if (ensureError) return { data: null, error: ensureError };

    const created = await db
      .select(profileCols)
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);
    if (!created[0]) {
      return { data: null, error: new Error("Profile not found") };
    }
    data = created[0];
  }

  let row = data as UserProfileRow;
  if (row.credits_reset_date && new Date() > new Date(row.credits_reset_date)) {
    const creditsResetDate = new Date();
    creditsResetDate.setDate(creditsResetDate.getDate() + 30);
    try {
      const [resetData] = await db
        .update(userProfiles)
        .set({
          message_credits_used: 0,
          credits_reset_date: creditsResetDate,
          updated_at: new Date(),
        })
        .where(eq(userProfiles.user_id, userId))
        .returning(profileCols);
      if (!resetData) {
        return { data: null, error: new Error("Failed to reset credits") };
      }
      row = resetData as UserProfileRow;
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }

  return { data: serializeProfile(row), error: null };
}

// POST /user/profile
userRouter.post("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const error = await ensureProfileRow(db, userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ ok: true });
});

// GET /user/profile
userRouter.get("/profile", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const { data, error } = await loadProfile(db, userId, {
    repairMissing: true,
  });
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// PATCH /user/profile
userRouter.patch("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const parsed = validateProfilePayload(req.body);
  if (!parsed.ok) return void res.status(400).json({ detail: parsed.detail });

  const ensureError = await ensureProfileRow(db, userId);
  if (ensureError)
    return void res.status(500).json({ detail: ensureError.message });

  try {
    await db
      .update(userProfiles)
      .set(parsed.update)
      .where(eq(userProfiles.user_id, userId));
  } catch (err) {
    return void res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to update profile",
    });
  }

  const { data, error } = await loadProfile(db, userId);
  if (error) return void res.status(500).json({ detail: error.message });
  const apiKeyStatus = await getUserApiKeyStatus(userId, db);
  res.json({ ...data, apiKeyStatus });
});

// GET /user/api-keys
userRouter.get("/api-keys", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const status = await getUserApiKeyStatus(userId, db);
  res.json(status);
});

// PUT /user/api-keys/:provider
userRouter.put("/api-keys/:provider", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = normalizeApiKeyProvider(req.params.provider);
  console.log(
    `[user/api-keys] PUT /${provider ?? req.params.provider} — userId=${userId}, hasBody=${!!req.body}, bodyKeys=${Object.keys(req.body ?? {}).join(",")}`,
  );

  if (!provider)
    return void res.status(400).json({ detail: "Unsupported provider" });

  const apiKey =
    typeof req.body?.api_key === "string" ? req.body.api_key : null;
  console.log(
    `[user/api-keys] saving key for ${provider}, hasKey=${!!apiKey}, keyLength=${apiKey?.length ?? 0}`,
  );

  try {
    await saveUserApiKey(userId, provider, apiKey, db);
    console.log(`[user/api-keys] saved successfully for ${provider}`);
    const status = await getUserApiKeyStatus(userId, db);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[user/api-keys] save FAILED for ${provider}:`, message, err);
    res.status(500).json({ detail: `Failed to save API key: ${message}` });
  }
});

// GET /user/indiankanoon-token
userRouter.get("/indiankanoon-token", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const userToken = await getUserIndianKanoonToken(userId, db);
  res.json({
    configured: !!userToken || hasEnvIndianKanoonToken(),
    source: userToken ? "user" : hasEnvIndianKanoonToken() ? "env" : null,
  });
});

// PUT /user/indiankanoon-token  body: { api_key: string | null }
userRouter.put("/indiankanoon-token", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const apiKey =
    typeof req.body?.api_key === "string" ? req.body.api_key : null;
  try {
    await saveUserIndianKanoonToken(userId, apiKey, db);
    const userToken = await getUserIndianKanoonToken(userId, db);
    res.json({
      configured: !!userToken || hasEnvIndianKanoonToken(),
      source: userToken ? "user" : hasEnvIndianKanoonToken() ? "env" : null,
    });
  } catch (err) {
    console.error("[user/indiankanoon-token] save failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ detail: "Failed to save Indian Kanoon token" });
  }
});

// DELETE /user/account
// Deleting the Better Auth user row cascades to session/account and the
// user-scoped tables that FK to user(id) (user_profiles, user_api_keys,
// user_indiankanoon_tokens). Replaces Supabase's auth.admin.deleteUser.
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  try {
    await db.delete(user).where(eq(user.id, userId));
  } catch (err) {
    return void res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to delete account",
    });
  }
  res.status(204).send();
});
