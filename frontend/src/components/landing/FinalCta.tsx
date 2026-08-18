"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";
import { Wordmark } from "./LandingNav";

const TRUST_BADGES = [
    "SOC 2 Type II",
    "ISO 27001",
    "DPDP Act Ready",
    "Data residency — India",
    "Zero training on your data",
];

export function FinalCta() {
    return (
        <section id="cta" className="border-t border-[#1C212B] bg-[#0E1116]">
            <div className="mx-auto max-w-[1320px] px-6 pb-24 pt-24 text-center md:px-12 md:pt-32">
                <Reveal>
                    <h2 className="kd-serif mx-auto mb-10 max-w-[16ch] text-[clamp(38px,5vw,64px)] leading-[1.08] text-[#F2EFE8]">
                        Bring KD into your chamber.
                    </h2>
                </Reveal>
                <Reveal delay={0.12}>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link
                            href="/support"
                            className="inline-block rounded-[10px] bg-[var(--kd-brass)] px-7 py-[15px] text-[16px] font-semibold text-[#14120C] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--kd-accent)]"
                        >
                            Request a Demo
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-block rounded-[10px] border border-white/15 px-7 py-[14px] text-[16px] font-medium text-[var(--kd-text)] transition-colors duration-150 hover:border-white/30"
                        >
                            Start Free Trial
                        </Link>
                    </div>
                </Reveal>

                <Reveal delay={0.2}>
                    <div
                        id="security"
                        className="mt-16 flex flex-wrap items-center justify-center gap-3 md:mt-20"
                    >
                        {TRUST_BADGES.map((badge) => (
                            <span
                                key={badge}
                                className="kd-mono rounded-full border border-[var(--kd-border)] px-4.5 py-2 text-[11px] uppercase tracking-[0.16em] text-[var(--kd-text-2)]"
                            >
                                {badge}
                            </span>
                        ))}
                    </div>
                </Reveal>
            </div>

            <div className="border-t border-[#1C212B]">
                <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row md:px-12">
                    <Wordmark size={22} />
                    <div className="flex gap-8 text-[14px]">
                        <Link
                            href="/login"
                            className="text-[var(--kd-text-2)] transition-colors hover:text-[var(--kd-text)]"
                        >
                            Product
                        </Link>
                        <a
                            href="#security"
                            className="text-[var(--kd-text-2)] transition-colors hover:text-[var(--kd-text)]"
                        >
                            Security
                        </a>
                        <Link
                            href="/support"
                            className="text-[var(--kd-text-2)] transition-colors hover:text-[var(--kd-text)]"
                        >
                            Contact
                        </Link>
                    </div>
                    <div className="text-center text-[13px] text-[var(--kd-text-3)]">
                        © 2026 KD Legal Technologies. KD can make mistakes.
                        Answers are not legal advice.
                    </div>
                </div>
            </div>
        </section>
    );
}
