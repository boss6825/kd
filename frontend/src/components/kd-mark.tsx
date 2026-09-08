/**
 * KD app mark (design.md §6): brass rounded square (radius 22%), serif
 * "KD" in ink, optical size ~58%. Used in the sidebar, empty states and
 * auth pages. The animated aperture icon (KdIcon) remains the
 * response-status spinner only.
 */
export function KDMark({ size = 32 }: { size?: number }) {
    return (
        <span
            className="inline-flex shrink-0 select-none items-center justify-center bg-kd-brass font-serif"
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.22),
                fontSize: Math.round(size * 0.5),
                color: "#14120C",
                letterSpacing: "-0.01em",
            }}
            aria-hidden="true"
        >
            KD
        </span>
    );
}
