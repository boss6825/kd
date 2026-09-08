"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/app/lib/kdApi";

export default function SignupPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!authLoading && isAuthenticated && !success) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router, success]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        try {
            const trimmedName = name.trim();
            const trimmedOrg = organisation.trim();
            // Better Auth requires a name; fall back to the email local-part.
            const { error } = await signUp.email({
                email,
                password,
                name: trimmedName || email,
            });
            if (error) throw new Error(error.message || "Signup failed");

            // autoSignIn is enabled, so the user is now authenticated and the
            // bearer token is stored — persist the optional profile fields.
            if (trimmedName || trimmedOrg) {
                try {
                    await updateUserProfile({
                        ...(trimmedName && { displayName: trimmedName }),
                        ...(trimmedOrg && { organisation: trimmedOrg }),
                    });
                } catch (profileError) {
                    console.error(
                        "[signup] failed to persist profile fields",
                        profileError,
                    );
                }
            }
            setSuccess(true);
            setTimeout(() => {
                router.push("/assistant");
            }, 2000);
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "An error occurred during signup",
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

    // Success View
    if (success) {
        return (
            <div className="min-h-dvh bg-background flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" className="md:text-4xl" asLink />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-card border border-border rounded-[14px] p-10 text-center">
                        <div className="mx-auto w-12 h-12 bg-kd-ok/10 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="h-6 w-6 text-kd-ok" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-serif tracking-[-0.01em] text-foreground mb-3">
                            Account created.
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Redirecting you to the home page…
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Default Signup Form View
    return (
        <div className="min-h-dvh bg-background flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-[14px] p-8 mb-4">
                    <div className="flex justify-between items-start gap-4 mb-6">
                        <h2 className="text-left text-2xl font-serif tracking-[-0.01em] text-foreground leading-[1.2]">
                            Every great matter starts with a question.
                        </h2>
                        <div className="bg-muted p-1 rounded-md flex text-xs font-medium shrink-0">
                            <Link
                                href="/login"
                                className="px-3 py-1 text-muted-foreground hover:text-foreground"
                            >
                                Log in
                            </Link>
                            <span className="px-3 py-1 bg-card rounded-sm shadow-[var(--kd-shadow-1)] text-foreground">
                                Sign up
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label
                                htmlFor="name"
                                className="block text-sm font-medium text-foreground mb-2"
                            >
                                Name{" "}
                                <span className="text-kd-text-3 font-normal">
                                    (optional)
                                </span>
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="organisation"
                                className="block text-sm font-medium text-foreground mb-2"
                            >
                                Organisation{" "}
                                <span className="text-kd-text-3 font-normal">
                                    (optional)
                                </span>
                            </label>
                            <Input
                                id="organisation"
                                type="text"
                                value={organisation}
                                onChange={(e) =>
                                    setOrganisation(e.target.value)
                                }
                                placeholder="Your organisation"
                                className="w-full"
                            />
                        </div>

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
                                placeholder="Create a password (min. 6 characters)"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-foreground mb-2"
                            >
                                Confirm Password
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
                            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-[10px]">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-[10px]"
                        >
                            {loading ? "Creating account..." : "Sign up"}
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

                    {/* Terms and Privacy */}
                    <div className="mt-4 text-center text-xs text-muted-foreground">
                        By signing up, you agree to our{" "}
                        <Link
                            href="https://mikeoss.com/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-kd-accent hover:text-kd-accent-strong hover:underline"
                        >
                            Terms of Use
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="https://mikeoss.com/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-kd-accent hover:text-kd-accent-strong hover:underline"
                        >
                            Privacy Policy
                        </Link>
                    </div>
                </div>
                <p className="text-center text-xs text-muted-foreground leading-relaxed px-2">
                    KD hosted on MikeOSS.com is currently a demo service.
                    Please do not upload, submit, or store sensitive,
                    confidential, privileged, client, or personally identifiable
                    documents.
                </p>
            </div>
        </div>
    );
}
