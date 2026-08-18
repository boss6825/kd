"use client";

import { useRef } from "react";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
} from "motion/react";
import { VideoSlot } from "./VideoSlot";

export function QuoteBand() {
    const ref = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });

    const videoY = useTransform(
        scrollYProgress,
        [0, 1],
        reduced ? ["0%", "0%"] : ["-8%", "8%"],
    );
    const figureY = useTransform(
        scrollYProgress,
        [0, 1],
        reduced ? [0, 0] : [48, -48],
    );

    return (
        <section
            ref={ref}
            className="relative flex min-h-[64vh] items-center justify-center overflow-hidden border-t border-[#1C212B]"
        >
            <motion.div aria-hidden style={{ y: videoY, scale: 1.16 }} className="absolute inset-0">
                <VideoSlot
                    fill
                    label="Chamber b-roll, evening, shallow focus"
                    // src="/videos/chamber.mp4"
                />
            </motion.div>
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(11,13,17,0.5), rgba(11,13,17,0.7))",
                }}
            />

            <motion.figure
                style={{ y: figureY }}
                className="kd-glass relative mx-6 my-24 max-w-[760px] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.35)] md:mx-12 md:px-14 md:py-12"
            >
                <blockquote className="kd-serif mb-6 text-[clamp(22px,2.6vw,30px)] leading-[1.4] text-[#F2EFE8]">
                    &ldquo;KD reads the brief the way a senior does — and
                    returns it the way a junior never could. By morning.&rdquo;
                </blockquote>
                <figcaption className="kd-mono text-[11px] uppercase tracking-[0.18em] text-[var(--kd-text-2)]">
                    Managing Partner — Placeholder, pilot chamber
                </figcaption>
            </motion.figure>
        </section>
    );
}
