"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { displayCitationQuote, formatCitationPage } from "../../shared/types";
import type { KdCitationAnnotation } from "../../shared/types";

/**
 * Replace [N] or [N, M, ...] inline markers with internal §idx§ tokens
 * backed by annotations. Pushes each resolved annotation onto
 * `citationsList` and returns the rewritten text.
 */
export function preprocessCitations(
    text: string,
    annotations: KdCitationAnnotation[],
    citationsList: KdCitationAnnotation[],
): string {
    return text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (full, refsStr) => {
        const refs = (refsStr as string)
            .split(",")
            .map((s: string) => parseInt(s.trim(), 10));
        const tokens = refs.flatMap((ref: number) => {
            const ann = annotations.find((a) => a.ref === ref);
            if (!ann) return [];
            const idx = citationsList.length;
            citationsList.push(ann);
            return [`\`§${idx}§\`​`];
        });
        return tokens.length > 0 ? tokens.join("") : full;
    });
}

function CitationPill({
    idx,
    annotation,
    onCitationClick,
}: {
    idx: number;
    annotation: KdCitationAnnotation;
    onCitationClick?: (c: KdCitationAnnotation) => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={() => onCitationClick?.(annotation)}
                    className="mx-0.5 inline-flex items-center justify-center rounded-full w-4 h-4 font-mono text-[10px] font-medium transition-colors align-super bg-kd-accent/10 text-kd-accent hover:bg-kd-accent/20"
                >
                    {idx + 1}
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                <p className="font-medium">{formatCitationPage(annotation)}</p>
                <p className="mt-0.5 font-serif italic">
                    &ldquo;{displayCitationQuote(annotation)}&rdquo;
                </p>
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * Serif prose renderer for assistant content blocks. Citation §idx§ tokens
 * (produced by preprocessCitations) arrive through the markdown `code`
 * renderer and are swapped for clickable numbered pills.
 */
export function MarkdownContent({
    text,
    citationsList,
    onCitationClick,
    divRef,
}: {
    text: string;
    citationsList: KdCitationAnnotation[];
    onCitationClick?: (c: KdCitationAnnotation) => void;
    divRef?: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div
            ref={divRef}
            className="text-foreground mb-4 text-base prose prose-sm max-w-[68ch] font-serif"
        >
            <ReactMarkdown
                remarkPlugins={[
                    [remarkMath, { singleDollarTextMath: false }],
                    remarkGfm,
                ]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                            <table
                                className="min-w-full divide-y divide-border border border-border rounded-lg overflow-hidden"
                                {...props}
                            />
                        </div>
                    ),
                    thead: ({ node, ...props }) => (
                        <thead className="bg-muted" {...props} />
                    ),
                    tbody: ({ node, ...props }) => (
                        <tbody
                            className="divide-y divide-border bg-background"
                            {...props}
                        />
                    ),
                    tr: ({ node, ...props }) => <tr {...props} />,
                    th: ({ node, ...props }) => (
                        <th
                            className="px-3 py-3.5 text-left text-sm font-semibold text-foreground"
                            {...props}
                        />
                    ),
                    td: ({ node, ...props }) => (
                        <td
                            className="whitespace-normal px-3 py-4 text-sm text-foreground"
                            {...props}
                        />
                    ),
                    h1: ({ node, ...props }) => (
                        <h1
                            className="mt-6 mb-4 text-3xl font-serif font-semibold"
                            {...props}
                        />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2
                            className="mt-5 mb-3 text-2xl font-serif font-semibold"
                            {...props}
                        />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3
                            className="text-xl font-semibold mt-4 mb-2"
                            {...props}
                        />
                    ),
                    h4: ({ node, ...props }) => (
                        <h4
                            className="text-lg font-semibold mt-4 mb-2"
                            {...props}
                        />
                    ),
                    p: ({ node, ...props }) => {
                        const parent = (
                            node as { parent?: { type?: string } } | undefined
                        )?.parent;
                        if (parent?.type === "listItem") {
                            return (
                                <p className="inline leading-7 m-0" {...props} />
                            );
                        }
                        return <p className="mb-4 leading-7" {...props} />;
                    },
                    ul: ({ node, ...props }) => (
                        <ul
                            className="list-disc list-outside mb-4 pl-6"
                            {...props}
                        />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol
                            className="list-decimal list-outside mb-4 pl-6"
                            {...props}
                        />
                    ),
                    li: ({ node, ...props }) => (
                        <li className="mb-2 leading-7" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                        <strong className="font-semibold" {...props} />
                    ),
                    em: ({ node, ...props }) => (
                        <em className="italic" {...props} />
                    ),
                    code: ({ node, children, ...props }) => {
                        const text = String(children);
                        const citMatch = text.match(/^§(\d+)§$/);
                        if (citMatch) {
                            const idx = parseInt(citMatch[1]);
                            const annotation = citationsList[idx];
                            if (annotation) {
                                return (
                                    <CitationPill
                                        idx={idx}
                                        annotation={annotation}
                                        onCitationClick={onCitationClick}
                                    />
                                );
                            }
                        }
                        return (
                            <code
                                className="bg-muted px-1.5 py-0.5 rounded text-sm font-serif"
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    blockquote: ({ node, ...props }) => (
                        <blockquote
                            className="border-l-4 border-border pl-4 italic my-4"
                            {...props}
                        />
                    ),
                    a: ({ node, href, children, ...props }) => (
                        <a
                            href={href}
                            className="text-kd-accent hover:text-kd-accent-strong underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        >
                            {children}
                        </a>
                    ),
                    hr: ({ node, ...props }) => (
                        <hr className="my-6 border-border" {...props} />
                    ),
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
