"use client";

import { useRef } from "react";
import Link from "next/link";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
} from "motion/react";
import { VideoSlot } from "./VideoSlot";
import { KD_EASE } from "./Reveal";

const HEADLINE: { text: string; em?: boolean }[] = [
    { text: "The" },
    { text: "operating" },
    { text: "system" },
    { text: "for" },
    { text: "Indian", em: true },
    { text: "law.", em: true },
];

export function Hero() {
    const ref = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();

    // Content sinks and fades as the hero scrolls out; the video drifts slower.
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    });
    const contentY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 120]);
    const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
    const videoY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "18%"]);
    const videoScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.08]);

    return (
        <section
            ref={ref}
            className="relative flex min-h-[92svh] items-end overflow-hidden"
        >
            {/* Full-bleed video slot, parallaxed */}
            <motion.div
                aria-hidden
                style={{ y: videoY, scale: videoScale }}
                className="absolute inset-0"
            >
                <VideoSlot
                    fill
                    label="Lawyer at work, dim light, slow & cinematic (loop, muted)"
                    // src="/videos/hero.mp4"
                />
            </motion.div>

            {/* Ink scrim */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(11,13,17,0.35) 0%, rgba(11,13,17,0.55) 55%, rgba(11,13,17,0.92) 100%)",
                }}
            />

            <motion.div
                style={{ y: contentY, opacity: contentOpacity }}
                className="relative mx-auto w-full max-w-[1320px] px-6 pb-20 md:px-12 md:pb-24"
            >
                <motion.div
                    initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.05, ease: KD_EASE }}
                    className="kd-eyebrow mb-7"
                >
                    KD — For the modern Indian chamber
                </motion.div>

                <h1 className="kd-serif mb-7 max-w-[15ch] text-[clamp(48px,7.2vw,92px)] leading-[1.02] tracking-[-0.015em] text-[#F2EFE8]">
                    {HEADLINE.map((word, i) => (
                        <span key={i}>
                        <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                            <motion.span
                                initial={{ y: reduced ? 0 : "110%", opacity: reduced ? 0 : 1 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{
                                    duration: 0.9,
                                    delay: 0.15 + i * 0.07,
                                    ease: KD_EASE,
                                }}
                                className={
                                    "inline-block " +
                                    (word.em
                                        ? "italic text-[var(--kd-accent-strong)]"
                                        : "")
                                }
                            >
                                {word.text}
                            </motion.span>
                            </span>{" "}
                        </span>
                    ))}
                </h1>

                <motion.p
                    initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5, ease: KD_EASE }}
                    className="mb-10 max-w-[52ch] text-[17px] leading-[1.6] text-[#C9C5BB] md:text-[19px]"
                >
                    Research, drafting, review, and workflows — one counsel-grade
                    AI trusted with the whole matter, not just the brief. The
                    routine work is KD&apos;s. The judgment stays yours.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.62, ease: KD_EASE }}
                    className="flex flex-wrap items-center gap-4"
                >
                    <a
                        href="#cta"
                        className="inline-block rounded-[10px] bg-[var(--kd-brass)] px-7 py-[15px] text-[16px] font-semibold text-[#14120C] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--kd-accent)]"
                    >
                        Request a Demo
                    </a>
                    <Link
                        href="/signup"
                        className="kd-glass inline-block rounded-[10px] px-7 py-[14px] text-[16px] font-medium text-[var(--kd-text)] transition-colors duration-150 hover:border-white/30 hover:text-white"
                    >
                        Start Free Trial
                    </Link>
                </motion.div>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4, duration: 0.8 }}
                style={{ opacity: contentOpacity }}
                className="absolute bottom-8 right-6 hidden items-center gap-3 md:flex md:right-12"
            >
                <span className="kd-mono text-[10px] uppercase tracking-[0.22em] text-[var(--kd-text-3)]">
                    Scroll
                </span>
                <span className="relative h-10 w-px overflow-hidden bg-[var(--kd-border)]">
                    <motion.span
                        animate={reduced ? {} : { y: ["-100%", "100%"] }}
                        transition={{
                            duration: 1.8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="absolute left-0 top-0 h-full w-full bg-[var(--kd-accent)]"
                    />
                </span>
            </motion.div>
        </section>
    );
}
