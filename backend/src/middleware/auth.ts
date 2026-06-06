import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

/**
 * Verify the caller's Better Auth session and populate res.locals.
 *
 * The session is resolved from the request headers — with the `bearer` plugin
 * enabled, that means the `Authorization: Bearer <token>` header the frontend
 * already sends. Replaces the old Supabase `admin.auth.getUser(token)` check.
 */
export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session?.user) {
            console.warn(
                `[auth] ${req.method} ${req.path} — no valid session`,
            );
            res.status(401).json({ detail: "Invalid or expired session" });
            return;
        }

        res.locals.userId = session.user.id;
        res.locals.userEmail = (session.user.email ?? "").toLowerCase();
        next();
    } catch (err) {
        console.error(
            `[auth] ${req.method} ${req.path} — session verification failed:`,
            err instanceof Error ? err.stack : String(err),
        );
        res.status(401).json({ detail: "Auth verification failed" });
    }
}
