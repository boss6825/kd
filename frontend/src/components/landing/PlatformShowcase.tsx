"use client";

import { useRef } from "react";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
} from "motion/react";
import { VideoSlot } from "./VideoSlot";
import { Reveal, KD_EASE } from "./Reveal";

const STEPS = [
    {
        index: "01 — Ask",
        title: "Research without hallucination.",
        body: "Grounded in Indian statutes, judgments, and your own documents — every answer cited to source.",
    },
    {
        index: "02 — Draft",
        title: "Drafts you would have drafted.",
        body: "Notices, agreements, petitions — in your chamber's house style, versioned and export-ready.",
    },
    {
        index: "03 — Run",
        title: "Workflows that finish the job.",
        body: "Due diligence, tabular review, e-discovery — multi-step work executed end-to-end, checkpoints yours.",
    },
];

export function PlatformShowcase() {
    const frameRef = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();

    // The product frame straightens out of a 3D tilt as it scrolls into view.
    const { scrollYProgress } = useScroll({
        target: frameRef,
        offset: ["start end", "center 0.45"],
    });
    const rotateX = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : 16, 0]);
    const scale = useTransform(scrollYProgress, [0, 1], [reduced ? 1 : 0.94, 1]);
    const opacity = useTransform(scrollYProgress, [0, 0.4], [0.4, 1]);

    return (
        <section
            id="platform"
            className="mx-auto max-w-[1320px] px-6 py-24 md:px-12 md:py-32"
        >
            <div className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end md:gap-12">
                <Reveal>
                    <div className="kd-eyebrow mb-5">The platform</div>
                    <h2 className="kd-serif max-w-[20ch] text-[clamp(32px,4vw,52px)] leading-[1.1] text-[#F2EFE8]">
                        Watch KD take a matter from question to filing.
                    </h2>
                </Reveal>
                <Reveal delay={0.15}>
                    <p className="max-w-[36ch] text-[16px] leading-[1.65] text-[var(--kd-text-2)]">
                        One workspace for the entire matter — ask, draft, review
                        in tables, and hand the routine steps to workflows that
                        run end-to-end.
                    </p>
                </Reveal>
            </div>

            <div style={{ perspective: 1200 }}>
                <motion.div
                    ref={frameRef}
                    style={{ rotateX, scale, opacity, transformOrigin: "center 20%" }}
                    className="overflow-hidden rounded-2xl border border-[var(--kd-border)] bg-[#101319] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
                >
                    <div className="flex h-11 items-center gap-2 border-b border-[#1C212B] bg-[var(--kd-surface)] px-4.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--kd-border)]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--kd-border)]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--kd-border)]" />
                        <span className="kd-mono ml-4 truncate text-[11px] tracking-[0.14em] text-[var(--kd-text-3)]">
                            app.kd.legal — Matter: Prakash Industries / Section 138
                        </span>
                    </div>
                    <div className="relative aspect-video">
                        <VideoSlot
                            fill
                            label="Product screen recording, slow & deliberate"
                            // src="/videos/platform-demo.mp4"
                        />
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={{
                    hidden: {},
                    visible: {
                        transition: { staggerChildren: 0.12, delayChildren: 0.1 },
                    },
                }}
                className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-[#1C212B] bg-[#1C212B] md:grid-cols-3"
            >
                {STEPS.map((step) => (
                    <motion.div
                        key={step.index}
                        variants={{
                            hidden: { opacity: 0, y: reduced ? 0 : 32 },
                            visible: {
                                opacity: 1,
                                y: 0,
                                transition: { duration: 0.6, ease: KD_EASE },
                            },
                        }}
                        className="group bg-[#0E1116] p-8 transition-colors duration-200 hover:bg-[#11151c]"
                    >
                        <div className="kd-mono mb-3.5 text-[11px] uppercase tracking-[0.18em] text-[var(--kd-accent)]">
                            {step.index}
                        </div>
                        <div className="kd-serif mb-2.5 text-[22px] text-[var(--kd-text)]">
                            {step.title}
                        </div>
                        <p className="text-[14px] leading-[1.6] text-[var(--kd-text-2)]">
                            {step.body}
                        </p>
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
}
