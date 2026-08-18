"use client";

import { useEffect, useRef } from "react";
import {
    animate,
    motion,
    useInView,
    useMotionValue,
    useTransform,
    useReducedMotion,
} from "motion/react";
import { Reveal, KD_EASE } from "./Reveal";

function CountUp({ value, suffix }: { value: number; suffix: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    const reduced = useReducedMotion();
    const mv = useMotionValue(0);
    const text = useTransform(mv, (v) => String(Math.round(v)));

    useEffect(() => {
        if (!inView) return;
        if (reduced) {
            mv.set(value);
            return;
        }
        const controls = animate(mv, value, {
            duration: 1.8,
            ease: KD_EASE,
        });
        return () => controls.stop();
    }, [inView, reduced, value, mv]);

    return (
        <span ref={ref} className="kd-serif text-[clamp(56px,6.5vw,88px)] leading-none text-[var(--kd-accent-strong)]">
            <motion.span>{text}</motion.span>
            {suffix}
        </span>
    );
}

const STATS: { value: number; suffix: string; body: string }[] = [
    {
        value: 68,
        suffix: "%",
        body: "faster first drafts of notices, agreements, and petitions.",
    },
    {
        value: 40,
        suffix: " hrs",
        body: "returned to every lawyer, every month, from review work alone.",
    },
    {
        value: 3,
        suffix: "×",
        body: "matters handled per associate, with partner-level oversight intact.",
    },
];

export function Outcomes() {
    return (
        <section
            id="outcomes"
            className="mx-auto max-w-[1320px] px-6 py-24 md:px-12 md:py-32"
        >
            <Reveal>
                <div className="kd-eyebrow mb-5">The outcome</div>
                <h2 className="kd-serif mb-16 max-w-[22ch] text-[clamp(32px,4vw,52px)] leading-[1.1] text-[#F2EFE8]">
                    Less time on the routine. More time on the argument.
                </h2>
            </Reveal>

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
                {STATS.map((stat, i) => (
                    <Reveal key={stat.suffix} delay={i * 0.12}>
                        <div className="border-t border-[var(--kd-border)] pt-8">
                            <CountUp value={stat.value} suffix={stat.suffix} />
                            <div className="mt-4 text-[16px] leading-[1.6] text-[#C9C5BB]">
                                {stat.body}
                            </div>
                        </div>
                    </Reveal>
                ))}
            </div>

            <div className="kd-mono mt-12 text-[11px] uppercase tracking-[0.18em] text-[var(--kd-text-3)]">
                Representative pilot figures — replace with your chamber&apos;s
                data
            </div>
        </section>
    );
}
