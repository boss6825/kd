"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
    motion,
    useScroll,
    useSpring,
    useMotionValueEvent,
} from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { KD_EASE } from "./Reveal";

export function Wordmark({ size = 30 }: { size?: number }) {
    return (
        <span className="flex items-baseline gap-1">
            <span
                className="kd-serif text-[var(--kd-text)]"
                style={{ fontSize: size }}
            >
                KD
            </span>
            <span
                className="inline-block bg-[var(--kd-brass)]"
                style={{ width: size * 0.23, height: size * 0.23 }}
            />
        </span>
    );
}

const NAV_LINKS = [
    { href: "#platform", label: "Platform" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#outcomes", label: "Outcomes" },
    { href: "#security", label: "Security" },
];

export function LandingNav() {
    const { isAuthenticated } = useAuth();
    const { scrollY, scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, {
        stiffness: 120,
        damping: 30,
        restDelta: 0.001,
    });

    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const prevY = useRef(0);

    useMotionValueEvent(scrollY, "change", (y) => {
        setHidden(y > prevY.current && y > 240);
        setScrolled(y > 24);
        prevY.current = y;
    });

    return (
        <>
            {/* Announcement bar — scrolls away with the page */}
            <div className="kd-mono flex h-10 items-center justify-center gap-4 border-b border-[#1C212B] bg-[#101319] px-4 text-[11px] uppercase tracking-[0.18em] text-[var(--kd-text-2)]">
                <span className="truncate">
                    KD Workflows now execute matters end-to-end
                </span>
                <a
                    href="#platform"
                    className="shrink-0 text-[var(--kd-accent)] hover:text-[var(--kd-accent-strong)]"
                >
                    Learn more
                </a>
            </div>

            <motion.header
                animate={{ y: hidden ? "-100%" : "0%" }}
                transition={{ duration: 0.35, ease: KD_EASE }}
                className="kd-glass sticky top-0 z-50"
                style={{
                    borderLeft: "none",
                    borderRight: "none",
                    borderTop: "none",
                    borderBottom: scrolled
                        ? "1px solid rgba(255,255,255,0.07)"
                        : "1px solid transparent",
                }}
            >
                <nav className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-6 md:px-12">
                    <Link href="/" aria-label="KD home">
                        <Wordmark />
                    </Link>

                    <div className="hidden items-center gap-9 text-[15px] md:flex">
                        {NAV_LINKS.map((l) => (
                            <a
                                key={l.href}
                                href={l.href}
                                className="text-[#C9C5BB] transition-colors duration-150 hover:text-[var(--kd-text)]"
                            >
                                {l.label}
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center gap-3.5">
                        <Link
                            href={isAuthenticated ? "/assistant" : "/login"}
                            className="rounded-[10px] border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[15px] text-[var(--kd-text)] transition-colors duration-150 hover:border-white/30 hover:text-white"
                        >
                            {isAuthenticated ? "Open KD" : "Log in"}
                        </Link>
                        <a
                            href="#cta"
                            className="hidden rounded-[10px] bg-[var(--kd-text)] px-5 py-2.5 text-[15px] font-medium text-[#0B0D11] transition-colors duration-150 hover:bg-white sm:block"
                        >
                            Request a Demo
                        </a>
                    </div>
                </nav>

                {/* Brass scroll-progress hairline */}
                <motion.div
                    aria-hidden
                    style={{ scaleX: progress }}
                    className="absolute bottom-0 left-0 h-px w-full origin-left bg-[var(--kd-brass)]"
                />
            </motion.header>
        </>
    );
}
