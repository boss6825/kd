"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { authClient, clearStoredToken } from "@/lib/authClient";

interface User {
    id: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    // Better Auth's reactive session hook. With the bearer token in
    // localStorage (and credentials:include for the OAuth cookie path), this
    // resolves the current user on mount and after sign in/out.
    const { data: session, isPending } = authClient.useSession();

    const user: User | null = session?.user
        ? { id: session.user.id, email: session.user.email ?? "" }
        : null;

    const signOut = async () => {
        try {
            await authClient.signOut();
        } finally {
            clearStoredToken();
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                authLoading: isPending,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
