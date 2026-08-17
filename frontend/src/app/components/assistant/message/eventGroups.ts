import type { AssistantEvent } from "../../shared/types";

/**
 * Chronological render plan for an assistant message: content events render
 * as prose blocks, and consecutive non-content events (reasoning / tool
 * activity) collapse into "pre" groups rendered inside a PreResponseWrapper.
 */
export type EventGroup =
    | { kind: "pre"; events: AssistantEvent[]; indices: number[] }
    | {
          kind: "content";
          event: Extract<AssistantEvent, { type: "content" }>;
          index: number;
      };

export function groupEvents(events: AssistantEvent[] | undefined): EventGroup[] {
    const groups: EventGroup[] = [];
    if (!events) return groups;
    let current: Extract<EventGroup, { kind: "pre" }> | null = null;
    events.forEach((e, i) => {
        if (e.type === "content") {
            if (current) {
                groups.push(current);
                current = null;
            }
            groups.push({ kind: "content", event: e, index: i });
        } else {
            if (!current) current = { kind: "pre", events: [], indices: [] };
            current.events.push(e);
            current.indices.push(i);
        }
    });
    if (current) groups.push(current);
    return groups;
}

/** True when any content group after `groupIdx` has non-empty text. */
export function hasContentAfter(groups: EventGroup[], groupIdx: number): boolean {
    for (let i = groupIdx + 1; i < groups.length; i++) {
        const g = groups[i];
        if (g.kind === "content" && g.event.text.length > 0) return true;
    }
    return false;
}
