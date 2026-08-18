import type { ColumnConfig } from "../shared/types";

export type PillSegment =
    | { type: "text"; content: string }
    | { type: "pill"; content: string };

/** KD semantic pill tints — success / warning / danger / neutral. */
const PILL_OK = "bg-kd-ok/10 text-kd-ok";
const PILL_WARN = "bg-kd-accent/10 text-kd-accent";
const PILL_DANGER = "bg-kd-danger/10 text-kd-danger";
const PILL_NEUTRAL = "bg-muted-foreground/10 text-muted-foreground";

/** Sequential colors assigned to tags by their position in the tags array. */
export const TAG_COLORS = [PILL_WARN, PILL_OK, PILL_NEUTRAL, PILL_DANGER];

export function getPillClass(content: string, column?: ColumnConfig): string {
    if (column?.format === "yes_no") {
        const lower = content.toLowerCase();
        if (lower === "yes") return PILL_OK;
        if (lower === "no") return PILL_DANGER;
        return PILL_NEUTRAL;
    }
    if (column?.format === "currency") {
        return PILL_NEUTRAL;
    }
    if (column?.format === "tag" && column.tags?.length) {
        const idx = column.tags.findIndex(
            (t) => t.toLowerCase() === content.toLowerCase(),
        );
        if (idx >= 0) return TAG_COLORS[idx % TAG_COLORS.length]!;
    }
    return PILL_NEUTRAL;
}

/** Split text on [[...]] pill markers, preserving surrounding text. */
export function parsePills(text: string): PillSegment[] {
    const segments: PillSegment[] = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
        }
        segments.push({ type: "pill", content: match[1] });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        segments.push({ type: "text", content: text.slice(lastIndex) });
    }
    return segments;
}
