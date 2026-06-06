/**
 * Better Auth instance — replaces Supabase Auth.
 *
 * Lives in the Express backend (which already owns the Neon DB and all data
 * access). The frontend talks to it via the `better-auth/react` client at
 * `${BETTER_AUTH_URL}/api/auth`. Sessions are carried as bearer tokens (the
 * `bearer` plugin) to match the app's existing `Authorization: Bearer` flow.
 *
 * Required env:
 *   BETTER_AUTH_SECRET  — random 32+ byte secret (openssl rand -hex 32)
 *   BETTER_AUTH_URL     — public URL of THIS backend (e.g. http://localhost:3001)
 *   FRONTEND_URL        — the frontend origin (trusted origin / CORS)
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — optional, enables Google sign-in
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { db, schema } from "../db";
import { userProfiles } from "../db/schema";
import { sendEmail } from "./email";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    secret: process.env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    trustedOrigins: [FRONTEND_URL],

    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),

    emailAndPassword: {
        enabled: true,
        // Matches the prior Supabase UX: signup logs the user straight in and
        // redirects to the app. Verification is not required to use the app.
        autoSignIn: true,
        requireEmailVerification: false,
        minPasswordLength: 6,
        sendResetPassword: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: "Reset your KD password",
                text: `Someone requested a password reset for your KD account.\n\nReset it here: ${url}\n\nIf this wasn't you, you can safely ignore this email.`,
            });
        },
    },

    emailVerification: {
        sendOnSignUp: false,
        sendVerificationEmail: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                subject: "Verify your KD email",
                text: `Confirm your email address for KD: ${url}`,
            });
        },
    },

    socialProviders: googleConfigured
        ? {
              google: {
                  clientId: process.env.GOOGLE_CLIENT_ID as string,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
              },
          }
        : undefined,

    // Let a user who signed up with email later sign in with Google on the
    // same address (and vice versa) instead of creating a duplicate account.
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google"],
        },
    },

    plugins: [bearer()],

    // Replaces the old Postgres `handle_new_user()` trigger that seeded
    // public.user_profiles from auth.users. (loadProfile() also lazily repairs
    // a missing row, so this is belt-and-suspenders.)
    databaseHooks: {
        user: {
            create: {
                after: async (createdUser) => {
                    try {
                        await db
                            .insert(userProfiles)
                            .values({ user_id: createdUser.id })
                            .onConflictDoNothing({
                                target: userProfiles.user_id,
                            });
                    } catch (err) {
                        console.error(
                            "[auth] failed to seed user_profiles row",
                            err instanceof Error ? err.message : String(err),
                        );
                    }
                },
            },
        },
    },
});

export type Auth = typeof auth;
