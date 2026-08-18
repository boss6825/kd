"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";
import { Marker, MarkerContent } from "@/components/ui/marker";

export function toolCallLabel(name: string): string {
    if (name === "generate_docx") return "Creating document...";
    if (name === "edit_document") return "Editing document...";
    if (name === "read_document") return "Reading document...";
    if (name === "fetch_documents") return "Reading documents...";
    if (name === "find_in_document") return "Searching document...";
    if (name === "replicate_document") return "Copying document...";
    if (name === "read_workflow") return "Loading workflow...";
    if (name === "list_workflows") return "Loading workflows...";
    if (name === "list_documents") return "Loading documents...";
    return name ? `Running ${name}...` : "Working...";
}

/* ------------------------------------------------------------------ *
 * Shared docket-timeline atoms: the status dot, the vertical
 * connector between consecutive activity rows, and the row shell.
 * ------------------------------------------------------------------ */

export function ActivityDot({
    state,
}: {
    state: "spinning" | "done" | "error" | "idle";
}) {
    if (state === "spinning") {
        return (
            <div className="mt-2 w-1.5 h-1.5 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin shrink-0" />
        );
    }
    if (state === "error") {
        return <div className="mt-2 w-1.5 h-1.5 rounded-full bg-kd-danger shrink-0" />;
    }
    if (state === "idle") {
        return <div className="mt-2 w-1.5 h-1.5 rounded-full bg-border shrink-0" />;
    }
    return <div className="mt-2 w-1.5 h-1.5 rounded-full bg-kd-ok shrink-0" />;
}

function Connector() {
    return (
        <div className="absolute bottom-0 w-[1px] bg-border top-[13px] left-[2.5px] h-[calc(100%+11px)]" />
    );
}

/**
 * One row in the docket timeline. Built on Marker for consistent
 * spacing/typography; the dot + connector are bespoke — they're the
 * product's visual signature and Marker has no connector concept.
 */
function ActivityRow({
    dot,
    showConnector,
    children,
    centered = false,
}: {
    dot: React.ReactNode;
    showConnector?: boolean;
    children: React.ReactNode;
    centered?: boolean;
}) {
    return (
        <Marker
            className={`${centered ? "items-center" : "items-start"} gap-0 font-serif relative`}
        >
            {showConnector && <Connector />}
            {dot}
            <MarkerContent className="ml-2 min-w-0 flex-1 whitespace-normal break-words">
                {children}
            </MarkerContent>
        </Marker>
    );
}

/* ------------------------------------------------------------------ *
 * Event blocks
 * ------------------------------------------------------------------ */

const THINKING_PHRASES = [
    "Thinking...",
    "Pondering...",
    "Analyzing...",
    "Reviewing...",
    "Reasoning...",
];

export function ReasoningBlock({
    text,
    isStreaming,
    showConnector,
}: {
    text: string;
    isStreaming: boolean;
    showConnector?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [thinkingIndex, setThinkingIndex] = useState(0);

    useEffect(() => {
        if (!isStreaming) return;
        const interval = setInterval(() => {
            setThinkingIndex((i) => (i + 1) % THINKING_PHRASES.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [isStreaming]);

    const showContent = isOpen || isStreaming;

    return (
        <div className="relative">
            {showConnector && (
                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-border top-[13px] left-[2.5px] h-[calc(100%+11px)]" />
            )}
            <button
                onClick={() => !isStreaming && setIsOpen((v) => !v)}
                className="flex items-center text-sm font-serif text-muted-foreground hover:text-foreground/80 transition-colors"
            >
                {isStreaming ? (
                    <div className="w-1.5 h-1.5 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin shrink-0" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                )}
                <span
                    className={`font-medium ml-2 ${isStreaming ? "shimmer" : ""}`}
                >
                    {isStreaming
                        ? THINKING_PHRASES[thinkingIndex]
                        : "Thought process"}
                </span>
                {!isStreaming && (
                    <ChevronDown
                        size={10}
                        className={`ml-1 self-center transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                    />
                )}
            </button>
            {showContent && (
                <div className="mt-2 ml-[14px] text-sm font-serif text-muted-foreground/70 prose prose-sm max-w-none [&>*]:text-muted-foreground/70 [&>*]:text-sm">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code: ({ node, ...props }) => (
                                <code
                                    className="font-serif text-muted-foreground"
                                    {...props}
                                />
                            ),
                        }}
                    >
                        {text}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
}

export function ToolCallRow({
    name,
    showConnector,
}: {
    name: string;
    showConnector?: boolean;
}) {
    return (
        <ActivityRow
            centered
            showConnector={showConnector}
            dot={
                <div className="w-1.5 h-1.5 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin shrink-0" />
            }
        >
            <span className="font-medium shimmer">{toolCallLabel(name)}</span>
        </ActivityRow>
    );
}

export function ThinkingRow({ showConnector }: { showConnector?: boolean }) {
    return (
        <ActivityRow
            centered
            showConnector={showConnector}
            dot={
                <div className="w-1.5 h-1.5 rounded-full border border-muted-foreground/70 border-t-transparent animate-spin shrink-0" />
            }
        >
            <span className="shimmer">Thinking...</span>
        </ActivityRow>
    );
}

export function DocReadBlock({
    filename,
    onClick,
    showConnector,
    isStreaming,
}: {
    filename: string;
    onClick?: () => void;
    showConnector?: boolean;
    isStreaming?: boolean;
}) {
    return (
        <ActivityRow
            showConnector={showConnector}
            dot={<ActivityDot state={isStreaming ? "spinning" : "done"} />}
        >
            <span className={`font-medium ${isStreaming ? "shimmer" : ""}`}>
                {isStreaming ? "Reading" : "Read"}
            </span>{" "}
            {isStreaming ? (
                <span className="shimmer">{filename}...</span>
            ) : onClick ? (
                <button
                    onClick={onClick}
                    className="text-left hover:text-foreground/80 transition-colors cursor-pointer"
                >
                    {filename}
                </button>
            ) : (
                <span>{filename}</span>
            )}
        </ActivityRow>
    );
}

export function DocFindBlock({
    filename,
    query,
    totalMatches,
    isStreaming,
    showConnector,
}: {
    filename: string;
    query: string;
    totalMatches: number;
    isStreaming?: boolean;
    showConnector?: boolean;
}) {
    const label = isStreaming ? "Finding" : "Found";
    const matchSuffix = isStreaming
        ? ""
        : ` (${totalMatches} ${totalMatches === 1 ? "match" : "matches"})`;
    return (
        <ActivityRow
            showConnector={showConnector}
            dot={
                isStreaming ? (
                    <ActivityDot state="spinning" />
                ) : (
                    <ActivityDot state={totalMatches > 0 ? "done" : "idle"} />
                )
            }
        >
            <span className={`font-medium ${isStreaming ? "shimmer" : ""}`}>
                {label}
            </span>{" "}
            <span className={isStreaming ? "shimmer" : ""}>
                &ldquo;{query}&rdquo;{matchSuffix}
                <span className="ml-1 text-muted-foreground/70">
                    in {filename}
                </span>
                {isStreaming && "..."}
            </span>
        </ActivityRow>
    );
}

export function DocCreatedBlock({
    filename,
    showConnector,
    isStreaming,
}: {
    filename: string;
    showConnector?: boolean;
    isStreaming?: boolean;
}) {
    return (
        <ActivityRow
            showConnector={showConnector}
            dot={<ActivityDot state={isStreaming ? "spinning" : "done"} />}
        >
            <span className={`font-medium ${isStreaming ? "shimmer" : ""}`}>
                {isStreaming ? "Creating" : "Created"}
            </span>{" "}
            <span className={isStreaming ? "shimmer" : ""}>
                {isStreaming ? `${filename}...` : filename}
            </span>
        </ActivityRow>
    );
}

export function DocReplicatedBlock({
    filename,
    count,
    showConnector,
    isStreaming,
    hasError,
}: {
    filename: string;
    /**
     * How many consecutive replicates of this same source got collapsed
     * into this block. ≥ 1; only rendered when > 1.
     */
    count: number;
    showConnector?: boolean;
    isStreaming?: boolean;
    hasError?: boolean;
}) {
    const label = isStreaming ? "Replicating" : "Replicated";
    const suffix =
        !isStreaming && count > 1 ? ` ${count} times` : isStreaming ? "..." : "";
    return (
        <ActivityRow
            showConnector={showConnector}
            dot={
                isStreaming ? (
                    <ActivityDot state="spinning" />
                ) : (
                    <ActivityDot state={hasError ? "error" : "done"} />
                )
            }
        >
            <span className={`font-medium ${isStreaming ? "shimmer" : ""}`}>
                {label}
            </span>{" "}
            <span className={isStreaming ? "shimmer" : ""}>
                {filename}
                {suffix}
            </span>
        </ActivityRow>
    );
}

export function DocEditedBlock({
    filename,
    showConnector,
    isStreaming,
    hasError,
}: {
    filename: string;
    showConnector?: boolean;
    isStreaming?: boolean;
    hasError?: boolean;
}) {
    return (
        <ActivityRow
            showConnector={showConnector}
            dot={
                isStreaming ? (
                    <ActivityDot state="spinning" />
                ) : (
                    <ActivityDot state={hasError ? "error" : "done"} />
                )
            }
        >
            <span className={`font-medium ${isStreaming ? "shimmer" : ""}`}>
                {isStreaming ? "Editing" : hasError ? "Edit failed" : "Edited"}
            </span>{" "}
            <span className={isStreaming ? "shimmer" : ""}>
                {isStreaming ? `${filename}...` : filename}
            </span>
        </ActivityRow>
    );
}

export function WorkflowAppliedBlock({
    title,
    showConnector,
    onClick,
}: {
    title: string;
    showConnector?: boolean;
    onClick?: () => void;
}) {
    return (
        <ActivityRow showConnector={showConnector} dot={<ActivityDot state="done" />}>
            <span className="font-medium">Applied Workflow</span>{" "}
            {onClick ? (
                <button
                    onClick={onClick}
                    className="text-left hover:text-foreground/80 transition-colors cursor-pointer"
                >
                    {title}
                </button>
            ) : (
                <span>{title}</span>
            )}
        </ActivityRow>
    );
}
