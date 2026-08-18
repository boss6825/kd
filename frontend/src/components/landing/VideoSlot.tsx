/**
 * Marketing video slot. Until a real asset exists, renders the labeled
 * placeholder frame from the KD design system. Drop the file in
 * /public/videos and pass `src` to swap it in — nothing else changes.
 */
export function VideoSlot({
    src,
    label,
    fill = false,
    className = "",
}: {
    src?: string;
    label: string;
    /** Full-bleed background variant (absolute, no radius, object-cover). */
    fill?: boolean;
    className?: string;
}) {
    if (src) {
        return (
            <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                src={src}
                className={
                    fill
                        ? `absolute inset-0 h-full w-full object-cover ${className}`
                        : `h-full w-full object-cover ${className}`
                }
            />
        );
    }

    return (
        <div
            className={
                (fill
                    ? "absolute inset-0 flex items-center justify-center "
                    : "flex h-full w-full items-center justify-center ") +
                className
            }
            style={{
                background: fill
                    ? "radial-gradient(ellipse 120% 90% at 70% 20%, #1A1E26 0%, #0E1116 55%, #0B0D11 100%)"
                    : "radial-gradient(ellipse 90% 80% at 50% 0%, #161A22 0%, #0E1116 70%)",
            }}
        >
            <div className="kd-mono rounded-md border border-dashed border-[var(--kd-border)] px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#3C4250]">
                Video — 1920×1080 — {label}
            </div>
        </div>
    );
}
