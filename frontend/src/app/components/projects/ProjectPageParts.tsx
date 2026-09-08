"use client";

import { type CSSProperties, useState } from "react";
import {
    Download,
    File,
    FileText,
    Loader2,
    MessageSquare,
    Pencil,
    Plus,
    Users,
} from "lucide-react";
import { HeaderSearchBtn } from "@/app/components/shared/HeaderSearchBtn";
import { RenameableTitle } from "@/app/components/shared/RenameableTitle";
import { ThemeToggleButton } from "@/app/components/shared/ThemeToggleButton";
import type { KdProject } from "@/app/components/shared/types";
import type { KdDocumentVersion } from "@/app/lib/kdApi";

export type ProjectTab = "documents" | "assistant" | "reviews";

export type ProjectContextMenu = {
    x: number;
    y: number;
    docId?: string | null;
    folderId: string | null;
    showFolderActions: boolean;
};

export const CHECK_W = "w-8 shrink-0";
export const NAME_COL_W = "w-[300px] shrink-0";
export const DOC_NAME_COL_W =
    "w-[260px] sm:w-[300px] md:w-[360px] lg:w-[420px] xl:w-[500px] 2xl:w-[560px] shrink-0";

const TREE_CONTROL_WIDTH_PX = 32;
const TREE_NAME_PADDING_PX = 8;

function treeControlWidth(depth: number) {
    return TREE_CONTROL_WIDTH_PX * (Math.max(0, depth) + 1);
}

export function treeControlCellStyle(depth: number): CSSProperties | undefined {
    if (depth <= 0) return undefined;
    const width = treeControlWidth(depth);
    return {
        justifyContent: "flex-start",
        minWidth: width,
        paddingLeft: TREE_NAME_PADDING_PX + depth * TREE_CONTROL_WIDTH_PX,
        width,
    };
}

export function treeNameCellStyle(depth: number): CSSProperties | undefined {
    if (depth <= 0) return undefined;
    return { left: treeControlWidth(depth) };
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function DocIcon({ fileType }: { fileType: string | null }) {
    if (fileType === "pdf")
        return (
            <FileText
                className="h-4 w-4 shrink-0 text-kd-text-3"
                strokeWidth={1.5}
            />
        );
    return (
        <File className="h-4 w-4 shrink-0 text-kd-text-3" strokeWidth={1.5} />
    );
}

export function DocVersionHistory({
    docId,
    filename,
    loading,
    versions,
    depth = 0,
    onDownloadVersion,
    onOpenVersion,
    onRenameVersion,
}: {
    docId: string;
    filename: string;
    loading: boolean;
    versions: KdDocumentVersion[];
    depth?: number;
    onDownloadVersion: (
        docId: string,
        versionId: string,
        filename: string,
    ) => void;
    onOpenVersion?: (versionId: string, versionLabel: string) => void;
    onRenameVersion?: (
        versionId: string,
        displayName: string | null,
    ) => Promise<void> | void;
}) {
    const [editingVersionId, setEditingVersionId] = useState<string | null>(
        null,
    );
    const [editingValue, setEditingValue] = useState("");

    const commit = async (versionId: string) => {
        const trimmed = editingValue.trim();
        setEditingVersionId(null);
        const next = trimmed.length > 0 ? trimmed : null;
        await onRenameVersion?.(versionId, next);
    };

    if (loading && versions.length === 0) {
        return (
            <div className="flex items-center h-9 border-b border-border text-xs text-muted-foreground bg-muted/60">
                <div
                    className={`sticky left-0 z-[60] ${CHECK_W} bg-muted/60 self-stretch`}
                    style={treeControlCellStyle(depth)}
                />
                <div
                    className={`sticky left-8 z-[60] ${DOC_NAME_COL_W} bg-muted/60 p-2`}
                    style={treeNameCellStyle(depth)}
                >
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-kd-text-3" />
                        <span>Loading versions…</span>
                    </div>
                </div>
            </div>
        );
    }

    if (versions.length === 0) {
        return (
            <div className="flex items-center h-9 border-b border-border text-xs text-kd-text-3 bg-muted/60">
                <div
                    className={`sticky left-0 z-[60] ${CHECK_W} bg-muted/60 self-stretch`}
                    style={treeControlCellStyle(depth)}
                />
                <div
                    className={`sticky left-8 z-[60] ${DOC_NAME_COL_W} bg-muted/60 p-2`}
                    style={treeNameCellStyle(depth)}
                >
                    <div>No version history.</div>
                </div>
            </div>
        );
    }

    const ordered = [...versions].reverse();
    return (
        <>
            {ordered.map((v) => {
                const numberLabel =
                    typeof v.version_number === "number" &&
                    v.version_number >= 1
                        ? `${v.version_number}`
                        : v.source === "upload"
                          ? "Original"
                          : "—";
                const displayLabel = v.display_name?.trim() || numberLabel;
                const dt = new Date(v.created_at);
                const dateLabel = Number.isNaN(dt.valueOf())
                    ? ""
                    : dt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                      });
                const isEditing = editingVersionId === v.id;

                return (
                    <div
                        key={`ver-${docId}-${v.id}`}
                        onClick={() => {
                            if (isEditing) return;
                            onOpenVersion?.(v.id, displayLabel);
                        }}
                        className="group flex items-center h-9 pr-3 md:pr-10 border-b border-border bg-muted/60 text-xs text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
                    >
                        <div
                            className={`sticky left-0 z-[60] ${CHECK_W} bg-muted/60 group-hover:bg-muted self-stretch`}
                            style={treeControlCellStyle(depth)}
                        />
                        <div
                            className={`sticky left-8 z-[60] ${DOC_NAME_COL_W} bg-muted/60 group-hover:bg-muted p-2`}
                            style={treeNameCellStyle(depth)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="shrink-0 text-kd-text-3">
                                    ↳
                                </span>
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        value={editingValue}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) =>
                                            setEditingValue(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                void commit(v.id);
                                            } else if (e.key === "Escape") {
                                                setEditingVersionId(null);
                                            }
                                        }}
                                        onBlur={() => void commit(v.id)}
                                        className="min-w-0 flex-1 max-w-[240px] border-b border-border bg-transparent text-xs text-foreground outline-none focus:border-kd-accent"
                                    />
                                ) : (
                                    <span className="font-medium text-foreground truncate">
                                        {displayLabel}
                                    </span>
                                )}
                                {!isEditing && onRenameVersion && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingVersionId(v.id);
                                            setEditingValue(
                                                v.display_name ?? "",
                                            );
                                        }}
                                        title="Rename version"
                                        className="shrink-0 rounded p-0.5 text-kd-text-3 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                )}
                                <span className="text-kd-text-3 truncate">
                                    {dateLabel}
                                </span>
                                <span className="text-kd-text-3 shrink-0">
                                    ·
                                </span>
                                <span className="text-kd-text-3 truncate">
                                    {v.source}
                                </span>
                            </div>
                        </div>
                        <div className="ml-auto w-20 shrink-0" />
                        <div className="w-24 shrink-0" />
                        <div className="ml-auto w-20 shrink-0" />
                        <div className="w-8 shrink-0 flex justify-end">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDownloadVersion(docId, v.id, filename);
                                }}
                                title="Download this version"
                                className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

export function ProjectPageSkeleton() {
    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <div className="flex h-[60px] items-center justify-between border-b border-border px-4 md:px-7">
                <div className="flex items-baseline gap-2">
                    <span className="kd-label text-kd-text-3">Matters</span>
                    <span className="text-xs text-kd-text-3">/</span>
                    <div className="h-3 w-40 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-[10px] bg-muted animate-pulse" />
                    <div className="h-10 w-10 rounded-[10px] bg-muted animate-pulse" />
                    <div className="h-10 w-28 rounded-[10px] bg-muted animate-pulse" />
                </div>
            </div>
            <div className="px-4 pt-8 md:px-10">
                <div className="h-10 w-72 rounded bg-muted animate-pulse" />
                <div className="mt-3 h-3.5 w-64 rounded bg-muted animate-pulse" />
            </div>
            <div className="mt-7 flex items-center gap-6 border-b border-border px-4 pb-3 md:px-10">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="px-4 pt-6 pb-8 md:px-10">
                <div className="overflow-hidden rounded-[14px] border border-border bg-card">
                    <div className="flex h-11 items-center bg-muted px-5">
                        <div className="h-2.5 w-10 rounded bg-border animate-pulse" />
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="flex h-[52px] items-center border-t border-border px-5"
                        >
                            <div className="h-3.5 w-56 rounded bg-muted animate-pulse" />
                            <div className="ml-auto h-3 w-16 rounded bg-muted animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ProjectPageHeader({
    project,
    tab,
    search,
    creatingChat,
    creatingReview,
    docsCount,
    onBackToProjects,
    onOpenDocuments,
    onTitleCommit,
    onSearchChange,
    onOpenPeople,
    onNewChat,
    onNewReview,
}: {
    project: KdProject;
    tab: ProjectTab;
    search: string;
    creatingChat: boolean;
    creatingReview: boolean;
    docsCount: number;
    onBackToProjects: () => void;
    onOpenDocuments: () => void;
    onTitleCommit: (newName: string) => void | Promise<void>;
    onSearchChange: (search: string) => void;
    onOpenPeople: () => void;
    onNewChat: () => void;
    onNewReview: () => void;
}) {
    const cmSuffix = project.cm_number ? ` (${project.cm_number})` : "";
    return (
        <>
            {/* Top bar */}
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-4 md:px-7">
                <div className="flex min-w-0 items-baseline gap-2">
                    <button
                        onClick={onBackToProjects}
                        className="kd-label text-kd-text-3 transition-colors hover:text-muted-foreground"
                    >
                        Matters
                    </button>
                    <span className="text-xs text-kd-text-3">/</span>
                    {tab !== "documents" ? (
                        <button
                            onClick={onOpenDocuments}
                            className="kd-label min-w-0 truncate text-kd-text-3 transition-colors hover:text-muted-foreground"
                        >
                            {project.name}
                            {cmSuffix}
                        </button>
                    ) : (
                        <span className="kd-label min-w-0 truncate text-muted-foreground">
                            {project.name}
                            {cmSuffix}
                        </span>
                    )}
                    {tab !== "documents" && (
                        <>
                            <span className="text-xs text-kd-text-3">/</span>
                            <span className="kd-label shrink-0 text-muted-foreground">
                                {tab === "assistant"
                                    ? "Assistant"
                                    : "Tabular Reviews"}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                    <HeaderSearchBtn
                        value={search}
                        onChange={onSearchChange}
                        placeholder="Search…"
                    />
                    <button
                        onClick={onOpenPeople}
                        className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground"
                        title="People with access"
                        aria-label="People with access"
                    >
                        <Users
                            className="h-[17px] w-[17px]"
                            strokeWidth={1.5}
                        />
                    </button>
                    <div className="relative group">
                        <button
                            onClick={() =>
                                docsCount > 0 &&
                                !creatingReview &&
                                onNewReview()
                            }
                            className={`flex h-10 items-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-medium transition-colors ${
                                docsCount > 0
                                    ? "cursor-pointer text-foreground hover:border-kd-text-3"
                                    : "cursor-default text-kd-text-3"
                            }`}
                        >
                            {creatingReview ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" strokeWidth={1.5} />
                            )}
                            New review
                        </button>
                        {docsCount === 0 && (
                            <div className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden items-center whitespace-nowrap rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground shadow-[var(--kd-shadow-2)] group-hover:flex">
                                Upload a document first
                            </div>
                        )}
                    </div>
                    <ThemeToggleButton />
                    <button
                        onClick={() => !creatingChat && onNewChat()}
                        className={`flex h-10 items-center gap-2 rounded-[10px] bg-kd-brass px-4 text-sm font-semibold text-[#14120C] transition-colors hover:bg-kd-accent-strong ${
                            creatingChat ? "cursor-default opacity-70" : ""
                        }`}
                    >
                        {creatingChat ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MessageSquare
                                className="h-[15px] w-[15px]"
                                strokeWidth={1.8}
                            />
                        )}
                        Ask KD
                    </button>
                </div>
            </div>

            {/* Title + meta */}
            <div className="px-4 pt-8 md:px-10">
                <h1 className="font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground">
                    {tab === "documents" ? (
                        <RenameableTitle
                            value={project.name}
                            onCommit={onTitleCommit}
                            suffix={
                                project.cm_number ? (
                                    <span className="ml-2 text-kd-text-3">
                                        (#{project.cm_number})
                                    </span>
                                ) : null
                            }
                        />
                    ) : (
                        <button
                            onClick={onOpenDocuments}
                            className="text-left text-foreground transition-colors hover:text-muted-foreground"
                        >
                            {project.name}
                            {project.cm_number ? (
                                <span className="ml-2 text-kd-text-3">
                                    (#{project.cm_number})
                                </span>
                            ) : null}
                        </button>
                    )}
                </h1>
                <div className="mt-1.5 text-sm text-muted-foreground">
                    {project.cm_number ? `CM ${project.cm_number} · ` : ""}
                    Opened {formatDate(project.created_at)} · {docsCount}{" "}
                    {docsCount === 1 ? "document" : "documents"}
                </div>
            </div>
        </>
    );
}
