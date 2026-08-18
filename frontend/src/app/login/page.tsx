"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, signIn } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";
export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetMsg, setResetMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await signIn.email({ email, password });
            if (error)
                throw new Error(error.message || "Invalid email or password");
            router.push("/assistant");
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "An error occurred during login",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError(null);
        try {
            await signIn.social({
                provider: "google",
                // Absolute frontend URL — a relative path would resolve against
                // the backend's baseURL (localhost:3001) and 404.
                callbackURL: `${window.location.origin}/assistant`,
            });
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Google sign-in failed",
            );
        }
    };

    const handleForgot = async () => {
        setError(null);
        setResetMsg(null);
        if (!email.trim()) {
            setError("Enter your email above, then click 'Forgot password?'.");
            return;
        }
        try {
            await authClient.requestPasswordReset({
                email: email.trim(),
                redirectTo: `${window.location.origin}/reset-password`,
            });
        } catch {
            /* fall through to the same generic message (avoid leaking which
               emails exist) */
        }
        setResetMsg(
            "If an account exists for that email, a password reset link is on its way.",
        );
    };

    return (
        <div className="min-h-dvh bg-background flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                {/* Login Form */}
                <div className="bg-card border border-border rounded-[14px] p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-left text-2xl font-serif tracking-[-0.01em] text-foreground">
                            Welcome back.
                        </h2>
                        <div className="bg-muted p-1 rounded-md flex text-xs font-medium">
                            <span className="text-foreground px-3 py-1 bg-card rounded-sm shadow-[var(--kd-shadow-1)]">
                                Log in
                            </span>
                            <Link
                                href="/signup"
                                className="px-3 py-1 text-muted-foreground hover:text-foreground"
                            >
                                Sign up
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-foreground mb-2"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-foreground mb-2"
                            >
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full"
                            />
                        </div>

                        <div className="flex justify-end -mt-1">
                            <button
                                type="button"
                                onClick={handleForgot}
                                className="text-xs text-kd-accent hover:text-kd-accent-strong hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>

                        {resetMsg && (
                            <div className="text-kd-ok text-sm bg-kd-ok/10 p-3 rounded-[10px]">
                                {resetMsg}
                            </div>
                        )}

                        {error && (
                            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-[10px]">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-5 rounded-[10px]"
                        >
                            {loading ? "Logging in..." : "Log in"}
                        </Button>
                    </form>
                    <div className="flex items-center gap-3 my-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-kd-text-3">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    <Button
                        type="button"
                        onClick={handleGoogle}
                        className="w-full rounded-[10px] bg-card border border-border text-foreground hover:bg-muted"
                    >
                        Continue with Google
                    </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground leading-relaxed px-2">
                    KD hosted on MikeOSS.com is currently a demo service.
                    Please do not upload, submit, or store sensitive,
                    confidential, privileged, client, or personally
                    identifiable documents.
                </p>
            </div>
        </div>
    );
}
