import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

function describeToken(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) return `non-JWT shape (parts=${parts.length}, len=${token.length})`;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const exp = payload.exp ? new Date(payload.exp * 1000).toISOString() : "?";
    const iss = payload.iss ?? "?";
    const sub = payload.sub ?? "?";
    return `JWT iss=${iss}, sub=${sub}, exp=${exp}, expired=${payload.exp ? payload.exp * 1000 < Date.now() : "?"}`;
  } catch {
    return `JWT (unparseable payload, len=${token.length})`;
  }
}

function describeKey(key: string): string {
  if (key.startsWith("sb_secret_")) return `new sb_secret_* (len=${key.length})`;
  if (key.startsWith("sb_publishable_")) return `new sb_publishable_* (len=${key.length})`;
  if (key.startsWith("eyJ")) return `legacy JWT (len=${key.length})`;
  return `unknown format (len=${key.length}, prefix=${key.slice(0, 8)})`;
}

let loggedConfig = false;
function logConfigOnce() {
  if (loggedConfig) return;
  loggedConfig = true;
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";
  console.log(`[auth-config] SUPABASE_URL=${supabaseUrl}`);
  console.log(`[auth-config] SUPABASE_SECRET_KEY=${describeKey(serviceKey)}`);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  logConfigOnce();

  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    console.warn(`[auth] ${req.method} ${req.path} — missing/invalid Authorization header`);
    res.status(401).json({ detail: "Missing or invalid Authorization header" });
    return;
  }
  const token = auth.slice(7).trim();

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    console.error(`[auth] ${req.method} ${req.path} — SUPABASE_URL or SUPABASE_SECRET_KEY not set`);
    res.status(500).json({ detail: "Server auth is not configured" });
    return;
  }

  console.log(`[auth] ${req.method} ${req.path} — token: ${describeToken(token)}`);

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.auth.getUser(token);
    if (error) {
      console.error(`[auth] ${req.method} ${req.path} — supabase.auth.getUser error:`, {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      res.status(401).json({ detail: `Auth verification failed: ${error.message}` });
      return;
    }
    if (!data.user) {
      console.warn(`[auth] ${req.method} ${req.path} — no user returned for token (no error either)`);
      res.status(401).json({ detail: "Invalid or expired token" });
      return;
    }

    console.log(`[auth] ${req.method} ${req.path} — verified userId=${data.user.id}`);
    res.locals.userId = data.user.id;
    res.locals.userEmail = data.user.email?.toLowerCase() ?? "";
    res.locals.token = token;
    next();
  } catch (err) {
    console.error(`[auth] ${req.method} ${req.path} — unexpected error:`, err instanceof Error ? err.stack : String(err));
    res.status(500).json({ detail: "Auth verification failed unexpectedly" });
  }
}
