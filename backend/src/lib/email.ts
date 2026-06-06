/**
 * Transactional email via Resend.
 *
 * Supabase used to send auth emails (verification / password reset) through its
 * own SMTP. Better Auth sends nothing on its own, so password reset and email
 * verification are wired to this helper.
 *
 * If RESEND_API_KEY is unset (e.g. local dev), emails are logged and skipped
 * rather than throwing — so signup/login still work, but reset links won't be
 * delivered until the key is configured.
 *
 * Required env:
 *   RESEND_API_KEY — Resend API key (re_...)
 *   RESEND_FROM    — verified sender, e.g. "KD <noreply@yourdomain.com>"
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? "KD <onboarding@resend.dev>";

const client = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}): Promise<void> {
    if (!client) {
        console.warn(
            `[email] RESEND_API_KEY not set — skipping "${opts.subject}" to ${opts.to}`,
        );
        return;
    }
    try {
        const { error } = await client.emails.send({
            from: FROM,
            to: opts.to,
            subject: opts.subject,
            text: opts.text,
            ...(opts.html ? { html: opts.html } : {}),
        });
        if (error) {
            console.error("[email] Resend returned an error", {
                to: opts.to,
                subject: opts.subject,
                error,
            });
        }
    } catch (err) {
        console.error("[email] failed to send", {
            to: opts.to,
            subject: opts.subject,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
