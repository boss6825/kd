"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
    deleteWorkflowShare,
    listWorkflowShares,
    shareWorkflow,
} from "@/app/lib/kdApi";
import { useAuth } from "@/contexts/AuthContext";
import { EmailPillInput } from "../shared/EmailPillInput";

interface Share {
    id: string;
    shared_with_email: string;
    allow_edit: boolean;
    created_at: string;
}

interface Props {
    workflowId: string;
    workflowName: string;
    onClose: () => void;
}

export function ShareWorkflowModal({
    workflowId,
    workflowName,
    onClose,
}: Props) {
    const [pendingEmails, setPendingEmails] = useState<string[]>([]);
    const [allowEdit, setAllowEdit] = useState(false);
    const [existingShares, setExistingShares] = useState<Share[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { user } = useAuth();
    const ownEmail = user?.email?.trim().toLowerCase() ?? null;

    useEffect(() => {
        listWorkflowShares(workflowId)
            .then(setExistingShares)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [workflowId]);

    async function handleRemoveShare(shareId: string) {
        await deleteWorkflowShare(workflowId, shareId).catch(() => {});
        setExistingShares((prev) => prev.filter((s) => s.id !== shareId));
    }

    async function handleConfirm() {
        const emails = ownEmail
            ? pendingEmails.filter((email) => email !== ownEmail)
            : pendingEmails;
        if (emails.length === 0) return;
        setSaving(true);
        try {
            await shareWorkflow(workflowId, { emails, allow_edit: allowEdit });
            const updated = await listWorkflowShares(workflowId);
            setExistingShares(updated);
            setPendingEmails([]);
        } catch {
            // ignore
        } finally {
            setSaving(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-[var(--kd-shadow-2)] flex flex-col h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="kd-label flex items-center gap-2 text-kd-text-3">
                        <span>Workflows</span>
                        <span>/</span>
                        <span className="truncate max-w-[220px]">
                            {workflowName}
                        </span>
                        <span>/</span>
                        <span className="text-muted-foreground">People</span>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-4 flex-1 overflow-y-auto">
                    <EmailPillInput
                        emails={pendingEmails}
                        onChange={setPendingEmails}
                        validate={async (email) =>
                            ownEmail && email === ownEmail
                                ? "You cannot share a workflow with yourself."
                                : null
                        }
                        placeholder="Add people by email…"
                        autoFocus
                    />

                    {/* Permission toggle */}
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-foreground">Allow editing by share recipients</span>
                        <button
                            type="button"
                            onClick={() => setAllowEdit((v) => !v)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${allowEdit ? "bg-primary" : "bg-muted-foreground/30"}`}
                        >
                            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-card shadow-[var(--kd-shadow-1)] transition-transform duration-200 ${allowEdit ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {/* Existing access */}
                    <div>
                        <p className="text-xs font-medium text-foreground mb-2">People with access</p>
                        {loading ? (
                            <div className="space-y-2">
                                {[1, 2].map((i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
                                        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : existingShares.length === 0 ? (
                            <p className="text-sm text-kd-text-3">None</p>
                        ) : (
                            <div className="space-y-1">
                                {existingShares.map((share) => (
                                    <div key={share.id} className="flex items-center justify-between py-1">
                                        <span className="text-sm text-foreground truncate">{share.shared_with_email}</span>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-kd-text-3">{share.allow_edit ? "Can edit" : "Read-only"}</span>
                                            <button
                                                onClick={() => handleRemoveShare(share.id)}
                                                className="text-kd-text-3 transition-colors hover:text-destructive"
                                            >
                                                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-border px-5 py-3 flex justify-end gap-2 mt-auto shrink-0">
                    <button
                        onClick={onClose}
                        className="rounded-[10px] px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={saving || pendingEmails.length === 0}
                        className="rounded-[10px] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {saving ? "Sharing…" : "Share"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
