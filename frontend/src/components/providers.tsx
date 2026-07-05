"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            <AuthProvider>
                <UserProfileProvider>
                    {children}
                    <Toaster />
                </UserProfileProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
