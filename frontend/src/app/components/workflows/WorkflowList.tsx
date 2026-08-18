"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Table2,
    MessageSquare,
    User,
    ChevronDown,
    Check,
} from "lucide-react";
import { HeaderSearchBtn } from "../shared/HeaderSearchBtn";
import {
    listWorkflows,
    deleteWorkflow,
    listHiddenWorkflows,
    hideWorkflow,
    unhideWorkflow,
} from "@/app/lib/mikeApi";
import type { MikeWorkflow } from "../shared/types";
import { BUILT_IN_WORKFLOWS, BUILT_IN_IDS } from "./builtinWorkflows";
import { DisplayWorkflowModal } from "./DisplayWorkflowModal";
import { NewWorkflowModal } from "./NewWorkflowModal";
import { RowActions } from "../shared/RowActions";
import { KDMark } from "@/components/kd-mark";
import { ThemeToggleButton } from "@/app/components/shared/ThemeToggleButton";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "all" | "builtin" | "custom" | "hidden";

const CHECK_W = "w-8 shrink-0";
const NAME_COL_W = "w-[300px] shrink-0";

const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "builtin", label: "Built-in" },
    { id: "custom", label: "Custom" },
    { id: "hidden", label: "Hidden" },
];

export function WorkflowList() {
    const router = useRouter();
    const { user } = useAuth();
    const [custom, setCustom] = useState<MikeWorkflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<MikeWorkflow | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("all");
    const [newModalOpen, setNewModalOpen] = useState(false);
    const [hiddenBuiltinIds, setHiddenBuiltinIds] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [practiceFilter, setPracticeFilter] = useState<string | null>(null);
    const [practiceFilterOpen, setPracticeFilterOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<MikeWorkflow["type"] | null>(
        null,
    );
    const [typeFilterOpen, setTypeFilterOpen] = useState(false);
    const [search, setSearch] = useState("");
    const actionsRef = useRef<HTMLDivElement>(null);
    const practiceFilterRef = useRef<HTMLDivElement>(null);
    const typeFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        Promise.all([
            listWorkflows("assistant"),
            listWorkflows("tabular"),
            listHiddenWorkflows(),
        ])
            .then(([assistant, tabular, hidden]) => {
                setCustom([...assistant, ...tabular]);
                setHiddenBuiltinIds(hidden);
            })
            .catch(() => setCustom([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setSelectedIds([]);
        setActionsOpen(false);
    }, [activeTab, practiceFilter, typeFilter]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                actionsRef.current &&
                !actionsRef.current.contains(e.target as Node)
            ) {
                setActionsOpen(false);
            }
        }
        if (actionsOpen) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [actionsOpen]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                practiceFilterRef.current &&
                !practiceFilterRef.current.contains(e.target as Node)
            ) {
                setPracticeFilterOpen(false);
            }
            if (
                typeFilterRef.current &&
                !typeFilterRef.current.contains(e.target as Node)
            ) {
                setTypeFilterOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const hiddenBuiltins = BUILT_IN_WORKFLOWS.filter((wf) =>
        hiddenBuiltinIds.includes(wf.id),
    );
    const visibleBuiltins = BUILT_IN_WORKFLOWS.filter(
        (wf) => !hiddenBuiltinIds.includes(wf.id),
    );
    const all = [...visibleBuiltins, ...custom];
    const byTab =
        activeTab === "builtin"
            ? visibleBuiltins
            : activeTab === "custom"
              ? custom
              : activeTab === "hidden"
                ? hiddenBuiltins
                : all;
    const practices = Array.from(
        new Set(byTab.map((wf) => wf.practice).filter((p): p is string => !!p)),
    ).sort();
    const q = search.toLowerCase();
    const filtered = byTab
        .filter((wf) => !practiceFilter || wf.practice === practiceFilter)
        .filter((wf) => !typeFilter || wf.type === typeFilter)
        .filter((wf) => !q || wf.title.toLowerCase().includes(q));

    const allSelected =
        filtered.length > 0 &&
        filtered.every((wf) => selectedIds.includes(wf.id));
    const someSelected =
        !allSelected && filtered.some((wf) => selectedIds.includes(wf.id));

    function toggleAll() {
        if (allSelected) setSelectedIds([]);
        else setSelectedIds(filtered.map((wf) => wf.id));
    }

    function toggleOne(id: string) {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    async function handleHideWorkflow(id: string) {
        setHiddenBuiltinIds((prev) => [...prev, id]);
        await hideWorkflow(id).catch(() => {
            setHiddenBuiltinIds((prev) => prev.filter((x) => x !== id));
        });
    }

    async function handleUnhideWorkflow(id: string) {
        setHiddenBuiltinIds((prev) => prev.filter((x) => x !== id));
        await unhideWorkflow(id).catch(() => {
            setHiddenBuiltinIds((prev) => [...prev, id]);
        });
    }

    async function handleBulkRemove() {
        const ids = [...selectedIds];
        setActionsOpen(false);
        setSelectedIds([]);
        const builtinIds = ids.filter((id) => BUILT_IN_IDS.has(id));
        const customIds = ids.filter((id) => !BUILT_IN_IDS.has(id));
        if (builtinIds.length > 0) {
            setHiddenBuiltinIds((prev) => [
                ...prev,
                ...builtinIds.filter((id) => !prev.includes(id)),
            ]);
            await Promise.all(
                builtinIds.map((id) => hideWorkflow(id).catch(() => {})),
            );
        }
        if (customIds.length > 0) {
            await Promise.all(
                customIds.map((id) => deleteWorkflow(id).catch(() => {})),
            );
            setCustom((prev) => prev.filter((w) => !customIds.includes(w.id)));
        }
    }

    async function handleBulkUnhide() {
        const ids = [...selectedIds];
        setActionsOpen(false);
        setSelectedIds([]);
        setHiddenBuiltinIds((prev) => prev.filter((id) => !ids.includes(id)));
        await Promise.all(ids.map((id) => unhideWorkflow(id).catch(() => {})));
    }

    const getTypeMeta = (type: MikeWorkflow["type"]) =>
        type === "tabular"
            ? {
                  label: "Tabular",
                  Icon: Table2,
                  pill: "bg-kd-accent/10 text-kd-accent",
              }
            : {
                  label: "Assistant",
                  Icon: MessageSquare,
                  pill: "bg-muted-foreground/10 text-muted-foreground",
              };

    const filterBtnClass = (isActive: boolean) =>
        `flex h-9 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13px] transition-colors hover:border-kd-text-3 hover:text-foreground ${
            isActive ? "text-foreground" : "text-muted-foreground"
        }`;

    const typeFilterButton = (
        <div className="relative" ref={typeFilterRef}>
            <button
                onClick={() => setTypeFilterOpen((o) => !o)}
                className={filterBtnClass(!!typeFilter)}
            >
                {typeFilter
                    ? typeFilter === "tabular"
                        ? "Tabular"
                        : "Assistant"
                    : "Type"}
                <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {typeFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--kd-shadow-2)]">
                    <button
                        onClick={() => {
                            setTypeFilter(null);
                            setTypeFilterOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    >
                        All Types
                        {!typeFilter && (
                            <Check
                                className="h-3.5 w-3.5 text-kd-accent"
                                strokeWidth={1.5}
                            />
                        )}
                    </button>
                    <div className="border-t border-border" />
                    {(["assistant", "tabular"] as const).map((t) => {
                        const { label, Icon } = getTypeMeta(t);
                        return (
                            <button
                                key={t}
                                onClick={() => {
                                    setTypeFilter(t);
                                    setTypeFilterOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-muted"
                            >
                                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                                    <Icon
                                        className="h-3.5 w-3.5 text-muted-foreground"
                                        strokeWidth={1.5}
                                    />
                                    {label}
                                </span>
                                {typeFilter === t && (
                                    <Check
                                        className="h-3.5 w-3.5 shrink-0 text-kd-accent"
                                        strokeWidth={1.5}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const practiceFilterButton = (
        <div className="relative" ref={practiceFilterRef}>
            <button
                onClick={() => setPracticeFilterOpen((o) => !o)}
                className={filterBtnClass(!!practiceFilter)}
            >
                {practiceFilter ?? "Practice"}
                <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </button>
            {practiceFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--kd-shadow-2)]">
                    <button
                        onClick={() => {
                            setPracticeFilter(null);
                            setPracticeFilterOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    >
                        All Practices
                        {!practiceFilter && (
                            <Check
                                className="h-3.5 w-3.5 text-kd-accent"
                                strokeWidth={1.5}
                            />
                        )}
                    </button>
                    {practices.length > 0 && (
                        <div className="border-t border-border" />
                    )}
                    {practices.map((p) => (
                        <button
                            key={p}
                            onClick={() => {
                                setPracticeFilter(p);
                                setPracticeFilterOpen(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        >
                            <span className="truncate pr-2">{p}</span>
                            {practiceFilter === p && (
                                <Check
                                    className="h-3.5 w-3.5 shrink-0 text-kd-accent"
                                    strokeWidth={1.5}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-background">
            {/* Top bar */}
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-7">
                <div className="kd-label text-kd-text-3">
                    Workflows — Library
                </div>
                <div className="flex items-center gap-2.5">
                    <HeaderSearchBtn
                        value={search}
                        onChange={setSearch}
                        placeholder="Search workflows…"
                    />
                    <ThemeToggleButton />
                    <button
                        onClick={() => setNewModalOpen(true)}
                        className="flex h-10 items-center gap-2 rounded-[10px] bg-kd-brass px-4 text-sm font-semibold text-[#14120C] transition-colors hover:bg-kd-accent-strong"
                    >
                        <Plus className="h-[15px] w-[15px]" strokeWidth={1.8} />
                        New workflow
                    </button>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1200px] px-4 pt-9 pb-12 md:px-7">
                    <h1 className="font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground">
                        Workflows
                    </h1>
                    <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
                        Multi-step legal work, executed end-to-end. Checkpoints
                        stay with you.
                    </p>

                    {/* Tabs + filters */}
                    <div className="flex items-center gap-1 border-b border-border">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2.5 text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? "-mb-px border-b-2 border-kd-brass font-medium text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                        <span className="flex-1" />
                        <div className="flex items-center gap-2.5 pb-2">
                            {selectedIds.length > 0 && (
                                <div ref={actionsRef} className="relative">
                                    <button
                                        onClick={() =>
                                            setActionsOpen((v) => !v)
                                        }
                                        className={filterBtnClass(true)}
                                    >
                                        Actions
                                        <ChevronDown
                                            className="h-3.5 w-3.5"
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                    {actionsOpen && (
                                        <div className="absolute top-full right-0 z-50 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--kd-shadow-2)]">
                                            {activeTab === "hidden" ? (
                                                <button
                                                    onClick={handleBulkUnhide}
                                                    className="w-full px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                                >
                                                    Unhide
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleBulkRemove}
                                                    className="w-full px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {typeFilterButton}
                            {practiceFilterButton}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mt-6 overflow-x-auto rounded-[14px] border border-border bg-card">
                        <div className="min-w-max">
                            {/* Column headers */}
                            <div className="kd-label flex h-11 select-none items-center bg-muted pr-5 text-muted-foreground">
                                <div
                                    className={`sticky left-0 z-[60] ${CHECK_W} flex items-center justify-center self-stretch bg-muted`}
                                >
                                    {!loading && (
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el)
                                                    el.indeterminate =
                                                        someSelected;
                                            }}
                                            onChange={toggleAll}
                                            className="h-2.5 w-2.5 cursor-pointer rounded border-border accent-kd-accent"
                                        />
                                    )}
                                </div>
                                <div
                                    className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center self-stretch bg-muted pl-2 text-left`}
                                >
                                    Name
                                </div>
                                <div className="ml-auto w-28 shrink-0">
                                    Type
                                </div>
                                <div className="w-40 shrink-0">Practice</div>
                                <div className="w-28 shrink-0">Source</div>
                                <div className="w-8 shrink-0" />
                            </div>

                            {loading && activeTab !== "builtin" ? (
                                <div>
                                    {[1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className="flex h-[52px] items-center border-t border-border pr-5"
                                        >
                                            <div className="w-8 shrink-0" />
                                            <div className="min-w-0 flex-1 pl-2 pr-4">
                                                <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                                            </div>
                                            <div className="w-28 shrink-0">
                                                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                                            </div>
                                            <div className="w-40 shrink-0">
                                                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                                            </div>
                                            <div className="w-28 shrink-0">
                                                <div className="h-3 w-14 animate-pulse rounded bg-muted" />
                                            </div>
                                            <div className="w-8 shrink-0" />
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex w-full flex-col items-start border-t border-border px-8 py-20">
                                    {activeTab === "custom" ? (
                                        <>
                                            <p className="font-serif text-[28px] font-normal leading-[1.2] text-foreground">
                                                Build a workflow tailored to
                                                your practice.
                                            </p>
                                            <button
                                                onClick={() =>
                                                    setNewModalOpen(true)
                                                }
                                                className="mt-5 inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                            >
                                                New workflow
                                            </button>
                                        </>
                                    ) : activeTab === "hidden" ? (
                                        <>
                                            <p className="font-serif text-[28px] font-normal leading-[1.2] text-foreground">
                                                Nothing hidden.
                                            </p>
                                            <p className="mt-2 text-sm text-muted-foreground">
                                                Built-in workflows you hide
                                                will appear here.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-serif text-[28px] font-normal leading-[1.2] text-foreground">
                                                No workflows match.
                                            </p>
                                            <button
                                                onClick={() =>
                                                    setNewModalOpen(true)
                                                }
                                                className="mt-5 inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                            >
                                                New workflow
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                filtered.map((wf) => {
                                    const rowBg = selectedIds.includes(wf.id)
                                        ? "bg-muted"
                                        : "bg-card";
                                    return (
                                        <div
                                            key={wf.id}
                                            onClick={() => setSelected(wf)}
                                            className="group flex h-[52px] cursor-pointer items-center border-t border-border pr-5 transition-colors hover:bg-muted"
                                        >
                                            <div
                                                className={`sticky left-0 z-[60] ${CHECK_W} flex items-center justify-center self-stretch ${rowBg} group-hover:bg-muted`}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(
                                                        wf.id,
                                                    )}
                                                    onChange={() =>
                                                        toggleOne(wf.id)
                                                    }
                                                    className="h-2.5 w-2.5 cursor-pointer rounded border-border accent-kd-accent"
                                                />
                                            </div>
                                            <div
                                                className={`sticky left-8 z-[60] ${NAME_COL_W} flex items-center self-stretch pl-2 ${rowBg} group-hover:bg-muted`}
                                            >
                                                <span className="block truncate text-sm font-medium text-foreground">
                                                    {wf.title}
                                                </span>
                                            </div>
                                            <div className="ml-auto w-28 shrink-0">
                                                {(() => {
                                                    const { label, pill } =
                                                        getTypeMeta(wf.type);
                                                    return (
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${pill}`}
                                                        >
                                                            {label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="w-40 shrink-0">
                                                {wf.practice ? (
                                                    <span className="text-[13.5px] text-muted-foreground">
                                                        {wf.practice}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-kd-text-3">
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-28 shrink-0">
                                                {wf.is_system ? (
                                                    <span className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground">
                                                        <KDMark size={18} />
                                                        KD
                                                    </span>
                                                ) : wf.user_id === user?.id ? (
                                                    <span className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground">
                                                        <User
                                                            className="h-3.5 w-3.5 text-muted-foreground"
                                                            strokeWidth={1.5}
                                                        />
                                                        Myself
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex max-w-full items-center gap-2 truncate text-[13.5px] text-muted-foreground">
                                                        <User
                                                            className="h-3.5 w-3.5 shrink-0 text-kd-text-3"
                                                            strokeWidth={1.5}
                                                        />
                                                        <span className="truncate">
                                                            {wf.shared_by_name ??
                                                                "Shared"}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="flex w-8 shrink-0 justify-end"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                {wf.is_system ? (
                                                    activeTab === "hidden" ? (
                                                        <RowActions
                                                            onUnhide={() =>
                                                                handleUnhideWorkflow(
                                                                    wf.id,
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <RowActions
                                                            onHide={() =>
                                                                handleHideWorkflow(
                                                                    wf.id,
                                                                )
                                                            }
                                                        />
                                                    )
                                                ) : wf.is_owner ===
                                                  false ? null : (
                                                    <RowActions
                                                        onDelete={async () => {
                                                            await deleteWorkflow(
                                                                wf.id,
                                                            );
                                                            setCustom((prev) =>
                                                                prev.filter(
                                                                    (w) =>
                                                                        w.id !==
                                                                        wf.id,
                                                                ),
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <p className="mt-5 text-xs text-kd-text-3">
                        KD can make mistakes. Answers are not legal advice.
                    </p>
                </div>
            </div>

            <DisplayWorkflowModal
                workflows={all}
                workflow={selected}
                onClose={() => setSelected(null)}
            />

            <NewWorkflowModal
                open={newModalOpen}
                onClose={() => setNewModalOpen(false)}
                onCreated={(wf) => {
                    setCustom((prev) => [wf, ...prev]);
                    setNewModalOpen(false);
                    router.push(`/workflows/${wf.id}`);
                }}
            />
        </div>
    );
}
