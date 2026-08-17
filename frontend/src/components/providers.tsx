"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
                    <TooltipProvider delayDuration={300}>
                        {children}
                    </TooltipProvider>
                    <Toaster />
                </UserProfileProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
