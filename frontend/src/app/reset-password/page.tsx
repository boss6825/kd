"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteLogo } from "@/components/site-logo";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Read the token from the URL on the client (avoids the useSearchParams
    // Suspense requirement). Better Auth redirects here as ?token=… or ?error=…
    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        setToken(sp.get("token"));
        if (sp.get("error")) {
            setLinkError("This reset link is invalid or has expired.");
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!token) {
            setError("Missing reset token. Request a new reset link.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            const { error } = await authClient.resetPassword({
                newPassword: password,
                token,
            });
            if (error)
                throw new Error(error.message || "Failed to reset password");
            setDone(true);
            setTimeout(() => router.push("/login"), 1500);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to reset password",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8">
                    <h2 className="text-left text-2xl font-serif mb-6">
                        Reset password
                    </h2>

                    {done ? (
                        <p className="text-sm text-gray-700">
                            Password updated. Redirecting to log in…
                        </p>
                    ) : linkError ? (
                        <div className="space-y-4">
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                {linkError}
                            </div>
                            <Link
                                href="/login"
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Back to log in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    New password
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="New password (min. 6 characters)"
                                    required
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Confirm password
                                </label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    placeholder="Confirm your password"
                                    required
                                    className="w-full"
                                />
                            </div>
                            {error && (
                                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                    {error}
                                </div>
                            )}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 bg-black hover:bg-gray-900 text-white"
                            >
                                {loading ? "Updating…" : "Update password"}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
