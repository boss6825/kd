"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Top-bar theme toggle (design: 40px square, 10px radius, surface bg).
 * Rendered as a no-op placeholder until mounted to avoid a
 * next-themes hydration mismatch.
 */
export function ThemeToggleButton({ className = "" }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = mounted && resolvedTheme === "dark";

    return (
        <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground ${className}`}
        >
            {isDark ? (
                <Sun className="h-[17px] w-[17px]" strokeWidth={1.5} />
            ) : (
                <Moon className="h-[17px] w-[17px]" strokeWidth={1.5} />
            )}
        </button>
    );
}
