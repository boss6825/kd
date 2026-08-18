import Link from "next/link";
import { KDMark } from "@/components/kd-mark";

interface SiteLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    animate?: boolean;
    asLink?: boolean;
}

export function SiteLogo({
    size = "md",
    className = "",
    animate = false,
    asLink = false,
}: SiteLogoProps) {
    const landingHref =
        process.env.NODE_ENV === "production"
            ? "https://mikeoss.com"
            : "http://localhost:3006";
    const sizeClasses = {
        sm: "text-xl",
        md: "text-2xl",
        lg: "text-4xl",
        xl: "text-6xl",
    };

    const iconSizes = {
        sm: 24,
        md: 30,
        lg: 40,
        xl: 56,
    };

    const logo = (
        <h1
            className={`flex items-center gap-2.5 ${sizeClasses[size]} font-serif tracking-[-0.01em] ${
                animate ? "sidebar-fade-in" : ""
            } ${className}`}
        >
            <KDMark size={iconSizes[size]} />
            <span>KD</span>
        </h1>
    );

    if (asLink) {
        return (
            <Link
                href={landingHref}
                className="cursor-pointer hover:opacity-80 transition-opacity"
            >
                {logo}
            </Link>
        );
    }

    return logo;
}
