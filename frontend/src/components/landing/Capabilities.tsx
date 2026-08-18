"use client";

import { useRef } from "react";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
} from "motion/react";

const CAPABILITIES = [
    "Legal Research",
    "Drafting & Notices",
    "Due Diligence",
    "Tabular Review",
    "Case Strategy",
    "Workflow Automation",
    "Document Vault",
];

/** One line that comes into focus as its center crosses the viewport center. */
function CapabilityLine({ label, index }: { label: string; index: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start 0.92", "end 0.08"],
    });

    const opacity = useTransform(
        scrollYProgress,
        [0, 0.5, 1],
        reduced ? [1, 1, 1] : [0.14, 1, 0.14],
    );
    const color = useTransform(
        scrollYProgress,
        [0.32, 0.5, 0.68],
        ["#EAE7DF", "#E3C68A", "#EAE7DF"],
    );
    const x = useTransform(
        scrollYProgress,
        [0, 0.5, 1],
        reduced ? [0, 0, 0] : [0, 14, 0],
    );

    return (
        <motion.div
            ref={ref}
            style={{ opacity, x }}
            className="flex items-baseline gap-5"
        >
            <span className="kd-mono w-8 shrink-0 text-[12px] tracking-[0.18em] text-[var(--kd-text-3)]">
                {String(index + 1).padStart(2, "0")}
            </span>
            <motion.span
                style={{ color }}
                className="kd-serif text-[clamp(34px,4.8vw,64px)] leading-[1.15]"
            >
                {label}
            </motion.span>
        </motion.div>
    );
}

export function Capabilities() {
    return (
        <section
            id="capabilities"
            className="border-t border-[#1C212B] px-6 py-24 md:px-12 md:py-32"
        >
            <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-12 lg:grid-cols-[260px_1fr_200px]">
                <div className="text-[17px] leading-[1.5] text-[var(--kd-text-2)] lg:sticky lg:top-[45vh]">
                    Indian chambers run on KD for
                </div>
                <div className="flex flex-col gap-3 lg:py-[18vh]">
                    {CAPABILITIES.map((label, i) => (
                        <CapabilityLine key={label} label={label} index={i} />
                    ))}
                </div>
                <div className="lg:sticky lg:top-[45vh] lg:justify-self-end">
                    <a
                        href="#platform"
                        className="inline-block rounded-[10px] border border-white/15 px-5 py-[11px] text-[15px] text-[var(--kd-text)] transition-colors duration-150 hover:border-white/30"
                    >
                        Explore Platform
                    </a>
                </div>
            </div>
        </section>
    );
}
