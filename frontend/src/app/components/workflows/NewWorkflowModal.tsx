"use client";

import { useEffect, useRef, useState } from "react";
import { X, MessageSquare, Table2 } from "lucide-react";
import { createWorkflow, updateWorkflow } from "@/app/lib/mikeApi";
import type { MikeWorkflow } from "../shared/types";
import { PRACTICE_OPTIONS } from "./practices";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: (workflow: MikeWorkflow) => void;
    editWorkflow?: MikeWorkflow;
    onUpdated?: (workflow: MikeWorkflow) => void;
}

export function NewWorkflowModal({ open, onClose, onCreated, editWorkflow, onUpdated }: Props) {
    const [title, setTitle] = useState("");
    const [type, setType] = useState<"assistant" | "tabular">("assistant");
    const [practice, setPractice] = useState<string>("");
    const [customPractice, setCustomPractice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const customInputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!editWorkflow;
    const isOthers = practice === "Others";
    const effectivePractice = isOthers ? (customPractice.trim() || null) : (practice || null);

    useEffect(() => {
        if (open && editWorkflow) {
            setTitle(editWorkflow.title);
            setType(editWorkflow.type);
            const saved = editWorkflow.practice ?? "";
            const isKnown = (PRACTICE_OPTIONS as readonly string[]).includes(saved);
            if (!isKnown && saved) {
                setPractice("Others");
                setCustomPractice(saved);
            } else {
                setPractice(saved);
                setCustomPractice("");
            }
            setError("");
        }
    }, [open, editWorkflow?.id]);

    useEffect(() => {
        if (isOthers) {
            customInputRef.current?.focus();
        }
    }, [isOthers]);

    if (!open) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        setError("");
        try {
            if (isEditing && editWorkflow) {
                const updated = await updateWorkflow(editWorkflow.id, {
                    title: title.trim(),
                    practice: effectivePractice,
                });
                onUpdated?.(updated);
            } else {
                const workflow = await createWorkflow({
                    title: title.trim(),
                    type,
                    practice: effectivePractice,
                });
                onCreated(workflow);
            }
            resetForm();
            onClose();
        } catch (err: unknown) {
            setError((err as Error).message || `Failed to ${isEditing ? "update" : "create"} workflow`);
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setTitle("");
        setType("assistant");
        setPractice("");
        setCustomPractice("");
        setError("");
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    const pillClass = (isActive: boolean) =>
        `flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
            isActive
                ? "border-kd-accent bg-kd-accent/10 text-kd-accent"
                : "border-border text-muted-foreground hover:bg-muted"
        }`;

    return (
        <div className="fixed inset-0 z-101 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-[var(--kd-shadow-2)] overflow-hidden flex flex-col" style={{ height: 600 }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
                    <div className="kd-label flex items-center gap-2 text-kd-text-3">
                        <span>Workflows</span>
                        <span>/</span>
                        <span className="text-muted-foreground">{isEditing ? "Edit workflow" : "New workflow"}</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Body */}
                    <div className="px-6 pt-3 pb-5 flex-1 overflow-y-auto">
                        {/* Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Workflow name"
                            className="w-full bg-transparent font-serif text-2xl text-foreground placeholder:text-kd-text-3 focus:outline-none"
                            autoFocus
                        />

                        {/* Type pills — only shown when creating */}
                        {!isEditing && (
                            <div className="mt-5">
                                <p className="mb-2 text-sm font-medium text-muted-foreground">Type</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setType("assistant")}
                                        className={pillClass(type === "assistant")}
                                    >
                                        <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
                                        Assistant
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType("tabular")}
                                        className={pillClass(type === "tabular")}
                                    >
                                        <Table2 className="h-3 w-3" strokeWidth={1.5} />
                                        Tabular
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Practice */}
                        <div className="mt-5">
                            <p className="mb-2 text-sm font-medium text-muted-foreground">Practice Area</p>
                            <div className="flex flex-wrap gap-2">
                                {PRACTICE_OPTIONS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPractice(practice === p ? "" : p)}
                                        className={pillClass(practice === p)}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            {isOthers && (
                                <input
                                    ref={customInputRef}
                                    type="text"
                                    value={customPractice}
                                    onChange={(e) => setCustomPractice(e.target.value)}
                                    placeholder="Enter practice area…"
                                    className="mt-3 w-full rounded-[10px] border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-kd-text-3 focus:border-kd-accent focus:outline-none"
                                />
                            )}
                        </div>

                        {error && (
                            <p className="mt-4 text-sm text-destructive">{error}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-[10px] px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || loading}
                            className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                            {loading ? (isEditing ? "Saving…" : "Creating…") : (isEditing ? "Save changes" : "Create workflow")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
