"use client";

import { motion, useReducedMotion } from "motion/react";

/** "Counsel ease" from design.md §8. */
export const KD_EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
    children,
    delay = 0,
    y = 24,
    className,
}: {
    children: React.ReactNode;
    delay?: number;
    y?: number;
    className?: string;
}) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay, ease: KD_EASE }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
