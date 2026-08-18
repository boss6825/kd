"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronDown, Plus, Users, X } from "lucide-react";
import { getWorkflow, updateWorkflow } from "@/app/lib/mikeApi";
import { ShareWorkflowModal } from "@/app/components/workflows/ShareWorkflowModal";
import { WFEditColumnModal } from "@/app/components/workflows/WFEditColumnModal";
import { WFColumnViewModal } from "@/app/components/workflows/WFColumnViewModal";
import { AddColumnModal } from "@/app/components/tabular/AddColumnModal";
import type { ColumnConfig, MikeWorkflow } from "@/app/components/shared/types";
import {
    BUILT_IN_IDS,
    BUILT_IN_WORKFLOWS,
} from "@/app/components/workflows/builtinWorkflows";
import { formatIcon, formatLabel } from "@/app/components/tabular/columnFormat";
import { RenameableTitle } from "@/app/components/shared/RenameableTitle";
import { ThemeToggleButton } from "@/app/components/shared/ThemeToggleButton";
// dynamic import keeps Tiptap (browser-only) out of the SSR bundle
const WorkflowPromptEditor = dynamic(
    () =>
        import("@/app/components/workflows/WorkflowPromptEditor").then(
            (m) => ({ default: m.WorkflowPromptEditor }),
        ),
    { ssr: false },
);

interface Props {
    params: Promise<{ id: string }>;
}

type SaveStatus = "idle" | "saving" | "saved";

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[300px] shrink-0";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function WorkflowDetailPage({ params }: Props) {
    const { id } = use(params);
    const router = useRouter();

    const [workflow, setWorkflow] = useState<MikeWorkflow | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const isBuiltin = BUILT_IN_IDS.has(id);
    const readOnly =
        isBuiltin ||
        (workflow?.is_system ?? false) ||
        workflow?.allow_edit === false;
    const canShare = !readOnly && (workflow?.is_owner ?? true);

    // Editor state
    const [promptMd, setPromptMd] = useState("");
    const [columns, setColumns] = useState<ColumnConfig[]>([]);

    // Save status
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Column selection
    const [selectedColIndices, setSelectedColIndices] = useState<number[]>([]);

    // Column modal
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<ColumnConfig | null>(null);
    const [viewingColumn, setViewingColumn] = useState<ColumnConfig | null>(null);

    // Share popover
    const [shareOpen, setShareOpen] = useState(false);

    // Column actions dropdown
    const [colActionsOpen, setColActionsOpen] = useState(false);
    const colActionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (colActionsRef.current && !colActionsRef.current.contains(e.target as Node)) {
                setColActionsOpen(false);
            }
        }
        if (colActionsOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [colActionsOpen]);

    // ---------------------------------------------------------------------------
    // Load workflow
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (isBuiltin) {
            const wf = BUILT_IN_WORKFLOWS.find((w) => w.id === id) ?? null;
            if (!wf) {
                setNotFound(true);
            } else {
                setWorkflow(wf);
                setPromptMd(wf.prompt_md ?? "");
                setColumns(wf.columns_config ?? []);
            }
            setLoading(false);
            return;
        }

        getWorkflow(id)
            .then((wf) => {
                setWorkflow(wf);
                setPromptMd(wf.prompt_md ?? "");
                setColumns(
                    (wf.columns_config ?? [])
                        .slice()
                        .sort((a, b) => a.index - b.index),
                );
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [id, isBuiltin]);

    // ---------------------------------------------------------------------------
    // Debounced auto-save for prompt
    // ---------------------------------------------------------------------------
    const save = useCallback(
        (newPromptMd: string) => {
            if (readOnly) return;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setSaveStatus("saving");
            debounceRef.current = setTimeout(async () => {
                try {
                    await updateWorkflow(id, { prompt_md: newPromptMd });
                    setSaveStatus("saved");
                    setTimeout(() => setSaveStatus("idle"), 2000);
                } catch {
                    setSaveStatus("idle");
                }
            }, 800);
        },
        [id, readOnly],
    );

    async function handleTitleCommit(newTitle: string) {
        if (!newTitle || newTitle === workflow?.title) return;
        const updated = await updateWorkflow(id, { title: newTitle });
        setWorkflow(updated);
    }

    function handlePromptChange(val: string | undefined) {
        const next = val ?? "";
        setPromptMd(next);
        save(next);
    }

    // ---------------------------------------------------------------------------
    // Column save
    // ---------------------------------------------------------------------------
    async function saveColumns(next: ColumnConfig[]) {
        if (readOnly) return;
        setSaveStatus("saving");
        try {
            const updated = await updateWorkflow(id, { columns_config: next });
            setWorkflow(updated);
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
            setSaveStatus("idle");
        }
    }

    function handleColumnsAdded(added: ColumnConfig[]) {
        const next = [
            ...columns,
            ...added.map((c, i) => ({ ...c, index: columns.length + i })),
        ];
        setColumns(next);
        saveColumns(next);
        setAddColumnOpen(false);
    }

    function handleColumnSaved(updated: ColumnConfig) {
        const next = columns.map((c) =>
            c.index === updated.index ? updated : c,
        );
        setColumns(next);
        saveColumns(next);
        setEditingColumn(null);
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                {/* Top bar skeleton */}
                <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                        <span className="text-kd-text-3">/</span>
                        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                    </div>
                </div>

                {/* Title skeleton */}
                <div className="shrink-0 px-7 pt-7 pb-4">
                    <div className="h-10 w-72 animate-pulse rounded bg-muted" />
                </div>

                {/* Table header skeleton */}
                <div className="flex h-9 shrink-0 items-center border-b border-border pr-7">
                    <div className="w-8 shrink-0 self-stretch" />
                    <div className="flex-1 pl-2">
                        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="w-36 shrink-0">
                        <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="flex-1">
                        <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="w-8 shrink-0" />
                </div>

                {/* Row skeletons */}
                <div className="flex-1 overflow-hidden">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex h-[52px] items-center border-b border-border pr-7">
                            <div className="w-8 shrink-0 self-stretch" />
                            <div className="flex-1 pl-2 pr-4">
                                <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (i * 13) % 35}%` }} />
                            </div>
                            <div className="w-36 shrink-0">
                                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                            </div>
                            <div className="flex-1 pr-4">
                                <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${50 + (i * 17) % 35}%` }} />
                            </div>
                            <div className="w-8 shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (notFound || !workflow) {
        return (
            <div className="flex flex-1 items-center justify-center bg-background">
                <p className="font-serif text-[28px] text-muted-foreground">
                    Workflow not found.
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            {/* Top bar */}
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
                <div className="kd-label flex min-w-0 items-center gap-2 text-kd-text-3">
                    <button
                        onClick={() => router.push("/workflows")}
                        className="kd-label transition-colors hover:text-foreground"
                    >
                        Workflows
                    </button>
                    <span>/</span>
                    <span className="max-w-xs truncate text-muted-foreground">
                        {workflow.title}
                    </span>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Save status */}
                    <span className="text-xs text-kd-text-3">
                        {saveStatus === "saving"
                            ? "Saving…"
                            : saveStatus === "saved"
                              ? "Saved"
                              : ""}
                    </span>

                    {/* Share button (custom workflows only) */}
                    {canShare && (
                        <button
                            onClick={() => setShareOpen(true)}
                            aria-label="Open workflow people"
                            title="People"
                            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground"
                        >
                            <Users className="h-[17px] w-[17px]" strokeWidth={1.5} />
                        </button>
                    )}
                    <ThemeToggleButton />
                    {shareOpen && (
                        <ShareWorkflowModal
                            workflowId={id}
                            workflowName={workflow.title}
                            onClose={() => setShareOpen(false)}
                        />
                    )}
                </div>
            </div>

            {/* Title */}
            <div className="flex shrink-0 items-baseline gap-3 px-7 pt-7 pb-5">
                <h1 className="min-w-0 truncate font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground">
                    {readOnly ? (
                        <span className="text-foreground">{workflow.title}</span>
                    ) : (
                        <RenameableTitle value={workflow.title} onCommit={handleTitleCommit} />
                    )}
                </h1>
                {readOnly && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-muted-foreground/10 px-3 py-1 text-xs text-muted-foreground">
                        Read-only
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col">
                {workflow.type === "assistant" ? (
                    /* ── Assistant: WYSIWYG editor ── */
                    <div className="min-h-0 flex-1 px-7 pb-7">
                        <WorkflowPromptEditor
                            value={promptMd}
                            onChange={readOnly ? undefined : handlePromptChange}
                            readOnly={readOnly}
                        />
                    </div>
                ) : (
                    /* ── Tabular: Column table ── */
                    <div className="flex min-h-0 flex-1 flex-col">
                        {/* Toolbar */}
                        {!readOnly && (
                            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-7">
                                <button
                                    onClick={() => setAddColumnOpen(true)}
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    Add Column
                                </button>
                                {selectedColIndices.length > 0 && (
                                    <div ref={colActionsRef} className="relative">
                                        <button
                                            onClick={() => setColActionsOpen((v) => !v)}
                                            className="flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-muted-foreground"
                                        >
                                            Actions
                                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </button>
                                        {colActionsOpen && (
                                            <div className="absolute top-full right-0 z-50 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--kd-shadow-2)]">
                                                <button
                                                    onClick={() => {
                                                        const next = columns
                                                            .filter((c) => !selectedColIndices.includes(c.index))
                                                            .map((c, i) => ({ ...c, index: i }));
                                                        setColumns(next);
                                                        saveColumns(next);
                                                        setSelectedColIndices([]);
                                                        setColActionsOpen(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-auto">
                        <div className="flex min-h-full min-w-max flex-col">
                        {/* Table header */}
                        <div className="kd-label flex h-9 shrink-0 select-none items-center border-b border-border bg-muted pr-7 text-muted-foreground">
                            <div className={`sticky left-0 z-[60] ${CHECK_W} flex items-center justify-center self-stretch bg-muted`}>
                                {columns.length > 0 && (
                                    <input
                                        type="checkbox"
                                        checked={columns.length > 0 && selectedColIndices.length === columns.length}
                                        ref={(el) => { if (el) el.indeterminate = selectedColIndices.length > 0 && selectedColIndices.length < columns.length; }}
                                        onChange={() => setSelectedColIndices(selectedColIndices.length === columns.length ? [] : columns.map((c) => c.index))}
                                        className="h-2.5 w-2.5 cursor-pointer rounded border-border accent-kd-accent"
                                    />
                                )}
                            </div>
                            <div className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center self-stretch bg-muted pl-2 text-left`}>
                                Column Title
                            </div>
                            <div className="ml-auto w-36 shrink-0">Format</div>
                            <div className="min-w-0 flex-1">Prompt</div>
                            {!readOnly && <div className="w-8 shrink-0" />}
                        </div>

                        {/* Rows */}
                        <div className="flex-1">
                            {columns.length === 0 ? (
                                <div className="flex w-full flex-col items-start px-8 py-20">
                                    <p className="font-serif text-[28px] font-normal leading-[1.2] text-foreground">
                                        Define what each column extracts.
                                    </p>
                                    {!readOnly && (
                                        <button
                                            onClick={() => setAddColumnOpen(true)}
                                            className="mt-5 inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                        >
                                            Add Column
                                        </button>
                                    )}
                                </div>
                            ) : (
                                columns.map((col) => {
                                    const FormatIcon = formatIcon(col.format ?? "text");
                                    const isChecked = selectedColIndices.includes(col.index);
                                    return (
                                        <div
                                            key={col.index}
                                            onClick={() => readOnly ? setViewingColumn(col) : setEditingColumn(col)}
                                            className="group flex h-[52px] cursor-pointer items-center border-b border-border pr-7 transition-colors hover:bg-muted"
                                        >
                                            <div
                                                className={`sticky left-0 z-[60] ${CHECK_W} flex items-center justify-center self-stretch ${isChecked ? "bg-muted" : "bg-background"} group-hover:bg-muted`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => setSelectedColIndices((prev) => prev.includes(col.index) ? prev.filter((i) => i !== col.index) : [...prev, col.index])}
                                                    className="h-2.5 w-2.5 cursor-pointer rounded border-border accent-kd-accent"
                                                />
                                            </div>
                                            <div className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center self-stretch pl-2 ${isChecked ? "bg-muted" : "bg-background"} group-hover:bg-muted`}>
                                                <span className="block truncate text-sm font-medium text-foreground">
                                                    {col.name}
                                                </span>
                                            </div>
                                            <div className="ml-auto w-36 shrink-0">
                                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <FormatIcon className="h-3.5 w-3.5 text-kd-text-3" strokeWidth={1.5} />
                                                    {formatLabel(col.format ?? "text")}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1 pr-4">
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {col.prompt}
                                                </span>
                                            </div>
                                            {!readOnly && (
                                                <div className="flex w-8 shrink-0 justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const next = columns
                                                                .filter((c) => c.index !== col.index)
                                                                .map((c, i) => ({ ...c, index: i }));
                                                            setColumns(next);
                                                            saveColumns(next);
                                                        }}
                                                        className="p-1 text-kd-text-3 transition-colors hover:text-destructive"
                                                    >
                                                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Read-only column view modal */}
            {viewingColumn && (
                <WFColumnViewModal col={viewingColumn} onClose={() => setViewingColumn(null)} />
            )}

            {/* Add column modal */}
            <AddColumnModal
                open={addColumnOpen}
                existingCount={columns.length}
                onClose={() => setAddColumnOpen(false)}
                onAdd={handleColumnsAdded}
            />

            {/* Edit column modal */}
            {editingColumn && (
                <WFEditColumnModal
                    column={editingColumn}
                    onClose={() => setEditingColumn(null)}
                    onSave={handleColumnSaved}
                    onDelete={() => {
                        const next = columns
                            .filter((c) => c.index !== editingColumn.index)
                            .map((c, i) => ({ ...c, index: i }));
                        setColumns(next);
                        saveColumns(next);
                        setEditingColumn(null);
                    }}
                />
            )}
        </div>
    );
}
