const ITEMS = [
    "Supreme Court of India",
    "25 High Courts",
    "NI Act §138",
    "DPDP Act 2023",
    "Companies Act 2013",
    "Arbitration & Conciliation Act",
    "CPC · CrPC · BNS",
    "SEBI & RBI Circulars",
    "GST & Direct Tax",
];

/**
 * Grounding ticker — the Indian-law corpus KD is built on, as a slow
 * mono marquee. Pure CSS animation (kd-ticker-track), pauses on hover.
 */
export function Ticker() {
    const row = (ariaHidden: boolean) => (
        <div
            aria-hidden={ariaHidden}
            className="flex shrink-0 items-center"
        >
            {ITEMS.map((item) => (
                <span key={item} className="flex items-center">
                    <span className="kd-mono whitespace-nowrap px-8 text-[11px] uppercase tracking-[0.2em] text-[var(--kd-text-2)]">
                        {item}
                    </span>
                    <span className="h-[5px] w-[5px] shrink-0 bg-[var(--kd-brass)] opacity-60" />
                </span>
            ))}
        </div>
    );

    return (
        <div className="kd-ticker overflow-hidden border-y border-[#1C212B] bg-[#0E1116] py-4">
            <div className="kd-ticker-track flex w-max">
                {row(false)}
                {row(true)}
            </div>
        </div>
    );
}
