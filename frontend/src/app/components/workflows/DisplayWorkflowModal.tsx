"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ChevronDown,
    Folder,
    MessageSquare,
    Search,
    Table2,
    X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { KdDocument, KdWorkflow } from "../shared/types";
import { createTabularReview } from "@/app/lib/kdApi";
import { useRouter } from "next/navigation";
import { formatIcon, formatLabel } from "../tabular/columnFormat";
import { useDirectoryData } from "../shared/useDirectoryData";
import { FileDirectory } from "../shared/FileDirectory";
import type { KdProject } from "../shared/types";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";

interface Props {
    workflows: KdWorkflow[];
    workflow: KdWorkflow | null;
    onClose: () => void;
}

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-card shadow-[var(--kd-shadow-1)] transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`}
            />
        </button>
    );
}

// ---------------------------------------------------------------------------
// Simple project picker (input + dropdown)
// ---------------------------------------------------------------------------
function SimpleProjectPicker({
    projects,
    selectedId,
    onSelect,
}: {
    projects: KdProject[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const selected = projects.find((p) => p.id === selectedId);
    const filtered = search
        ? projects.filter((p) =>
              p.name.toLowerCase().includes(search.toLowerCase()),
          )
        : projects;

    return (
        <div className="relative">
            <input
                type="text"
                value={selectedId ? (selected?.name ?? "") : search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setOpen(true);
                    onSelect(null);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="Select a matter…"
                className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none placeholder:text-kd-text-3 focus:border-kd-accent"
            />
            {selectedId && (
                <button
                    onMouseDown={() => {
                        onSelect(null);
                        setSearch("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
            )}
            {open && !selectedId && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-[10px] border border-border bg-card shadow-[var(--kd-shadow-2)]">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-3 text-center text-xs text-kd-text-3">
                            No matters found
                        </p>
                    ) : (
                        filtered.map((p) => (
                            <button
                                key={p.id}
                                onMouseDown={() => {
                                    onSelect(p.id);
                                    setSearch("");
                                    setOpen(false);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                            >
                                <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                                {p.name}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shared markdown renderer
// ---------------------------------------------------------------------------
function MarkdownBody({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => (
                    <h1 className="text-base font-semibold text-foreground mt-4 mb-1 first:mt-0">
                        {children}
                    </h1>
                ),
                h2: ({ children }) => (
                    <h2 className="text-sm font-semibold text-foreground mt-3 mb-1 first:mt-0">
                        {children}
                    </h2>
                ),
                h3: ({ children }) => (
                    <h3 className="text-xs font-semibold text-foreground mt-2 mb-0.5 first:mt-0">
                        {children}
                    </h3>
                ),
                p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-2 space-y-0.5">
                        {children}
                    </ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                        {children}
                    </ol>
                ),
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                        {children}
                    </strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

// ---------------------------------------------------------------------------
// Right panel for assistant workflows (select screen)
// ---------------------------------------------------------------------------
function AssistantPanel({ workflow }: { workflow: KdWorkflow }) {
    return (
        <div className="flex-1 border-l border-t border-border flex flex-col overflow-hidden px-3 pb-3">
            <div className="py-3 shrink-0">
                <p className="text-xs font-medium text-foreground">
                    Workflow Prompt
                </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm border border-border rounded-[10px] text-muted-foreground leading-relaxed font-serif bg-muted">
                <MarkdownBody
                    content={workflow.prompt_md ?? "_No prompt defined._"}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Right panel for tabular workflows — accordion column list (select screen)
// ---------------------------------------------------------------------------
function TabularPanel({ workflow }: { workflow: KdWorkflow }) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const columns = (workflow.columns_config ?? []).sort(
        (a, b) => a.index - b.index,
    );

    return (
        <div className="flex-1 border-l border-t border-border flex flex-col overflow-hidden px-3 pb-3">
            <div className="py-3 shrink-0">
                <p className="text-xs font-medium text-foreground">Columns</p>
            </div>
            <div className="flex-1 overflow-y-auto border border-border rounded-[10px] bg-muted">
                {columns.length === 0 ? (
                    <p className="px-4 py-6 text-xs text-center text-kd-text-3">
                        No columns defined
                    </p>
                ) : (
                    columns.map((col) => {
                        const isExpanded = expandedIndex === col.index;
                        const FormatIcon = formatIcon(col.format ?? "text");
                        return (
                            <div
                                key={col.index}
                                className="border-b border-border"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedIndex(
                                            isExpanded ? null : col.index,
                                        )
                                    }
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-card transition-colors"
                                >
                                    <FormatIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                                    <span className="flex-1 truncate text-foreground">
                                        {col.name}
                                    </span>
                                    <span className="shrink-0 text-muted-foreground">
                                        {formatLabel(col.format ?? "text")}
                                    </span>
                                    <ChevronDown
                                        className={`h-3 w-3 shrink-0 text-kd-text-3 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                                        strokeWidth={1.5}
                                    />
                                </button>
                                {isExpanded && (
                                    <div className="px-4 py-3 bg-card border-t border-border text-sm text-muted-foreground leading-relaxed font-serif space-y-3">
                                        {col.tags && col.tags.length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-kd-text-3 mb-1.5 font-sans">
                                                    Tags
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {col.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-block rounded-full bg-muted-foreground/10 px-2 py-0.5 text-xs text-muted-foreground font-sans"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-medium text-kd-text-3 mb-1 font-sans">
                                                Prompt
                                            </p>
                                            <MarkdownBody
                                                content={
                                                    col.prompt ||
                                                    "_No prompt defined._"
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// DisplayWorkflowModal
// ---------------------------------------------------------------------------
export function DisplayWorkflowModal({ workflows, workflow, onClose }: Props) {
    const [screen, setScreen] = useState<"select" | "configure">("select");
    const [selected, setSelected] = useState<KdWorkflow | null>(workflow);
    const [listSearch, setListSearch] = useState("");
    const selectedRowRef = useRef<HTMLButtonElement>(null);

    // Configure screen state
    const [inProject, setInProject] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        null,
    );
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
        new Set(),
    );
    const [docSearch, setDocSearch] = useState("");
    const [assistantPrompt, setAssistantPrompt] = useState("");
    const [saving, setSaving] = useState(false);

    const router = useRouter();
    const { saveChat, setNewChatMessages } = useChatHistoryContext();
    const {
        loading: dirLoading,
        projects,
        standaloneDocuments,
    } = useDirectoryData(screen === "configure");

    useEffect(() => {
        if (workflow) {
            setSelected(workflow);
            setScreen("select");
            setListSearch("");
        } else {
            setSelected(null);
        }
    }, [workflow?.id]);

    useEffect(() => {
        if (selected && selectedRowRef.current) {
            selectedRowRef.current.scrollIntoView({ block: "nearest" });
        }
    }, [selected?.id]);

    // Reset configure state on back
    useEffect(() => {
        if (screen === "select") {
            setInProject(false);
            setSelectedProjectId(null);
            setSelectedDocIds(new Set());
            setDocSearch("");
            setAssistantPrompt("");
        }
    }, [screen]);

    function handleClose() {
        setSelected(null);
        setScreen("select");
        onClose();
    }

    if (!workflow) return null;
    const wf = selected ?? workflow;

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    async function handleStartChat() {
        setSaving(true);
        try {
            const projectId = inProject ? selectedProjectId! : undefined;
            const chatId = await saveChat(projectId);
            if (!chatId) return;
            const allDocs: KdDocument[] = [
                ...standaloneDocuments,
                ...projects.flatMap((p) => p.documents || []),
            ];
            const files = allDocs
                .filter((d) => selectedDocIds.has(d.id))
                .map((d) => ({ filename: d.filename, document_id: d.id }));
            const content = assistantPrompt.trim()
                ? `implement workflow\n\n${assistantPrompt.trim()}`
                : "implement workflow";
            setNewChatMessages([
                {
                    role: "user",
                    content,
                    files: files.length > 0 ? files : undefined,
                },
            ]);
            handleClose();
            router.push(
                projectId
                    ? `/projects/${projectId}/assistant/chat/${chatId}`
                    : `/assistant/chat/${chatId}`,
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleCreateReview() {
        const allDocs: KdDocument[] = [
            ...standaloneDocuments,
            ...projects.flatMap((p) => p.documents || []),
        ];
        const docIds = allDocs
            .filter((d) => selectedDocIds.has(d.id))
            .map((d) => d.id);
        const projectId = inProject ? selectedProjectId! : undefined;

        setSaving(true);
        try {
            const review = await createTabularReview({
                title: wf.title,
                document_ids: docIds,
                columns_config: wf.columns_config || [],
                workflow_id: wf.is_system ? undefined : wf.id,
                project_id: projectId,
            });
            handleClose();
            router.push(
                projectId
                    ? `/projects/${projectId}/tabular-reviews/${review.id}`
                    : `/tabular-reviews/${review.id}`,
            );
        } finally {
            setSaving(false);
        }
    }

    // ---------------------------------------------------------------------------
    // Tabular doc browser helpers
    // ---------------------------------------------------------------------------
    const q = docSearch.toLowerCase().trim();
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    const projectDocs = selectedProject?.documents ?? [];

    const filteredProjectDocs = q
        ? projectDocs.filter((d) => d.filename.toLowerCase().includes(q))
        : projectDocs;

    const filteredStandalone = q
        ? standaloneDocuments.filter((d) =>
              d.filename.toLowerCase().includes(q),
          )
        : standaloneDocuments;

    const filteredAllProjects = projects
        .map((p) => ({
            ...p,
            documents: (p.documents || []).filter(
                (d) => !q || d.filename.toLowerCase().includes(q),
            ),
        }))
        .filter(
            (p) =>
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.documents.length > 0,
        );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return createPortal(
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50">
            <div
                className={`w-full rounded-2xl border border-border bg-card shadow-[var(--kd-shadow-2)] flex flex-col h-[600px] transition-all duration-200 ${screen === "select" ? "max-w-4xl" : "max-w-2xl"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 shrink-0">
                    <div className="kd-label flex items-center gap-2 text-kd-text-3">
                        {screen === "select" ? (
                            <>
                                <span>Workflows</span>
                                <span>/</span>
                                <span className="text-muted-foreground">Select workflow</span>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setScreen("select")}
                                    className="kd-label transition-colors hover:text-foreground"
                                >
                                    Workflows
                                </button>
                                <span>/</span>
                                <span className="truncate max-w-[160px]">
                                    {wf.title}
                                </span>
                                <span>/</span>
                                <span className="text-muted-foreground">
                                    {wf.type === "assistant"
                                        ? "New Chat"
                                        : "New Review"}
                                </span>
                            </>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                </div>

                {/* ── SELECT SCREEN ── */}
                {screen === "select" && (
                    <>
                        <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
                            {/* Left: workflow list */}
                            <div className="w-80 shrink-0 flex flex-col border-t border-border">
                                {/* Search */}
                                <div className="px-3 py-2 shrink-0 border-b border-border">
                                    <div className="flex items-center gap-1.5 rounded-[10px] border border-border bg-muted px-2.5 py-1 focus-within:border-kd-accent">
                                        <Search className="h-3 w-3 text-kd-text-3 shrink-0" strokeWidth={1.5} />
                                        <input
                                            type="text"
                                            placeholder="Search…"
                                            value={listSearch}
                                            onChange={(e) => setListSearch(e.target.value)}
                                            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-kd-text-3 outline-none"
                                        />
                                        {listSearch && (
                                            <button onClick={() => setListSearch("")} className="text-muted-foreground hover:text-foreground">
                                                <X className="h-3 w-3" strokeWidth={1.5} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* List */}
                                <div className="overflow-y-auto flex-1">
                                    {workflows
                                        .filter((wfItem) => !listSearch || wfItem.title.toLowerCase().includes(listSearch.toLowerCase()))
                                        .map((wfItem) => {
                                            const isSelected = selected?.id === wfItem.id;
                                            const Icon = wfItem.type === "tabular" ? Table2 : MessageSquare;
                                            return (
                                                <button
                                                    key={wfItem.id}
                                                    ref={isSelected ? selectedRowRef : null}
                                                    type="button"
                                                    onClick={() => setSelected(wfItem)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs text-left border-b border-border transition-colors ${isSelected ? "bg-muted" : "hover:bg-muted"}`}
                                                >
                                                    <span className={`flex-1 truncate ${isSelected ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                                        {wfItem.title}
                                                    </span>
                                                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-kd-accent" : "text-kd-text-3"}`} strokeWidth={1.5} />
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Right: workflow detail */}
                            {wf.type === "assistant" ? (
                                <AssistantPanel key={wf.id} workflow={wf} />
                            ) : (
                                <TabularPanel key={wf.id} workflow={wf} />
                            )}
                        </div>

                        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
                            {wf.is_system ? (
                                <button
                                    onClick={() => {
                                        router.push(`/workflows/${wf.id}`);
                                        handleClose();
                                    }}
                                    className="rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground"
                                >
                                    View Page
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        router.push(`/workflows/${wf.id}`);
                                        handleClose();
                                    }}
                                    className="rounded-[10px] border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground"
                                >
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={() => setScreen("configure")}
                                className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                            >
                                Use
                            </button>
                        </div>
                    </>
                )}

                {/* ── ASSISTANT CONFIGURE SCREEN ── */}
                {screen === "configure" && wf.type === "assistant" && (
                    <>
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* Add-on prompt */}
                            <div className="px-5 pb-3 shrink-0">
                                <p className="text-xs font-medium text-foreground mb-2">
                                    Message (optional)
                                </p>
                                <textarea
                                    rows={3}
                                    value={assistantPrompt}
                                    onChange={(e) =>
                                        setAssistantPrompt(e.target.value)
                                    }
                                    placeholder="Add any additional instructions to the workflow prompt…"
                                    className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-kd-text-3 resize-none outline-none leading-relaxed focus:border-kd-accent"
                                />
                            </div>

                            {/* Toggle row */}
                            <div className="px-5 py-3 flex flex-col gap-2 shrink-0">
                                <span className="text-xs font-medium text-foreground">
                                    Create in a matter
                                </span>
                                <Toggle
                                    on={inProject}
                                    onToggle={() => {
                                        setInProject(!inProject);
                                        setSelectedProjectId(null);
                                        setSelectedDocIds(new Set());
                                        setDocSearch("");
                                    }}
                                />
                            </div>

                            {inProject ? (
                                <>
                                    <div className="px-5 pt-1 pb-1 shrink-0">
                                        <p className="text-xs font-medium text-foreground">
                                            Select matter
                                        </p>
                                    </div>
                                    <div className="px-5 pb-2 shrink-0">
                                        <SimpleProjectPicker
                                            projects={projects}
                                            selectedId={selectedProjectId}
                                            onSelect={setSelectedProjectId}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="px-5 pt-1 pb-1 shrink-0">
                                        <p className="text-xs font-medium text-foreground">
                                            Select documents
                                        </p>
                                    </div>

                                    {/* Search */}
                                    <div className="px-4 pt-1.5 pb-1 shrink-0">
                                        <div className="flex items-center gap-1.5 rounded-[10px] border border-border bg-muted px-2.5 py-1 focus-within:border-kd-accent">
                                            <Search className="h-3 w-3 text-kd-text-3 shrink-0" strokeWidth={1.5} />
                                            <input
                                                type="text"
                                                placeholder="Search…"
                                                value={docSearch}
                                                onChange={(e) =>
                                                    setDocSearch(e.target.value)
                                                }
                                                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-kd-text-3 outline-none"
                                            />
                                            {docSearch && (
                                                <button
                                                    onClick={() =>
                                                        setDocSearch("")
                                                    }
                                                    className="text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="h-3 w-3" strokeWidth={1.5} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* File browser */}
                                    <div className="flex-1 overflow-y-auto px-4 pb-2">
                                        <FileDirectory
                                            standaloneDocs={filteredStandalone}
                                            directoryProjects={
                                                filteredAllProjects
                                            }
                                            loading={dirLoading}
                                            selectedIds={selectedDocIds}
                                            onChange={setSelectedDocIds}
                                            allowMultiple
                                            forceExpanded={!!q}
                                            emptyMessage={
                                                q
                                                    ? "No matches found"
                                                    : "No documents yet"
                                            }
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
                            <span className="text-xs text-kd-text-3">
                                {!inProject && selectedDocIds.size > 0
                                    ? `${selectedDocIds.size} selected`
                                    : ""}
                            </span>
                            <button
                                onClick={handleStartChat}
                                disabled={
                                    saving || (inProject && !selectedProjectId)
                                }
                                className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {saving ? "Starting…" : "Start Chat"}
                            </button>
                        </div>
                    </>
                )}

                {/* ── TABULAR CONFIGURE SCREEN ── */}
                {screen === "configure" && wf.type === "tabular" && (
                    <>
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* Toggle stacked */}
                            <div className="px-5 pb-3 flex flex-col gap-2 shrink-0">
                                <span className="text-xs font-medium text-foreground">
                                    Create in a matter
                                </span>
                                <Toggle
                                    on={inProject}
                                    onToggle={() => {
                                        setInProject(!inProject);
                                        setSelectedProjectId(null);
                                        setDocSearch("");
                                        setSelectedDocIds(new Set());
                                    }}
                                />
                            </div>

                            {/* Project section */}
                            {inProject && (
                                <>
                                    <div className="px-5 pt-1 pb-1 shrink-0">
                                        <p className="text-xs font-medium text-foreground">
                                            Select matter
                                        </p>
                                    </div>
                                    <div className="px-5 pb-2 shrink-0">
                                        <SimpleProjectPicker
                                            projects={projects}
                                            selectedId={selectedProjectId}
                                            onSelect={(id) => {
                                                setSelectedProjectId(id);
                                                if (!id)
                                                    setSelectedDocIds(
                                                        new Set(),
                                                    );
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Documents section */}
                            <div className="px-5 pt-3 pb-1 shrink-0">
                                <p className="text-xs font-medium text-foreground">
                                    Select documents
                                </p>
                            </div>

                            {/* Search */}
                            <div className="px-4 pt-1.5 pb-1 shrink-0">
                                <div className="flex items-center gap-1.5 rounded-[10px] border border-border bg-muted px-2.5 py-1 focus-within:border-kd-accent">
                                    <Search className="h-3 w-3 text-kd-text-3 shrink-0" strokeWidth={1.5} />
                                    <input
                                        type="text"
                                        placeholder="Search…"
                                        value={docSearch}
                                        onChange={(e) =>
                                            setDocSearch(e.target.value)
                                        }
                                        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-kd-text-3 outline-none"
                                    />
                                    {docSearch && (
                                        <button
                                            onClick={() => setDocSearch("")}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" strokeWidth={1.5} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* File browser */}
                            <div className="flex-1 overflow-y-auto px-4 pb-2">
                                <FileDirectory
                                    standaloneDocs={
                                        inProject
                                            ? filteredProjectDocs
                                            : filteredStandalone
                                    }
                                    directoryProjects={
                                        inProject ? [] : filteredAllProjects
                                    }
                                    loading={dirLoading}
                                    selectedIds={selectedDocIds}
                                    onChange={setSelectedDocIds}
                                    allowMultiple
                                    forceExpanded={!!q || inProject}
                                    emptyMessage={
                                        q
                                            ? "No matches found"
                                            : inProject
                                              ? "No documents in this matter"
                                              : "No documents yet"
                                    }
                                />
                            </div>
                        </div>

                        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
                            <span className="text-xs text-kd-text-3">
                                {selectedDocIds.size > 0
                                    ? `${selectedDocIds.size} selected`
                                    : ""}
                            </span>
                            <button
                                onClick={handleCreateReview}
                                disabled={
                                    saving ||
                                    selectedDocIds.size === 0 ||
                                    (inProject && !selectedProjectId)
                                }
                                className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {saving ? "Creating…" : "Create Review"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body,
    );
}
