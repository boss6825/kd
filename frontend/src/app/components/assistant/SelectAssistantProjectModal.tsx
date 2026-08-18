"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
import { useDirectoryData } from "../shared/useDirectoryData";
import { ProjectPicker } from "../shared/ProjectPicker";

interface Props {
    open: boolean;
    onClose: () => void;
}

export function SelectAssistantProjectModal({ open, onClose }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const router = useRouter();
    const { saveChat } = useChatHistoryContext();
    const { loading, projects } = useDirectoryData(open);

    useEffect(() => {
        if (!open) return;
        setSelectedId(null);
    }, [open]);

    if (!open) return null;

    async function handleContinue() {
        if (!selectedId) return;
        setCreating(true);
        try {
            const chatId = await saveChat(selectedId);
            if (!chatId) return;
            onClose();
            router.push(`/projects/${selectedId}/assistant/chat/${chatId}`);
        } finally {
            setCreating(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/10 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-[var(--kd-shadow-2)] flex flex-col h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-1.5 kd-label text-kd-text-3">
                        <span>Assistant</span>
                        <span>/</span>
                        <span className="text-muted-foreground">
                            Start chat in a matter
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <ProjectPicker
                    projects={projects}
                    loading={loading}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                />

                {/* Footer */}
                <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-[10px] px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleContinue}
                        disabled={!selectedId || creating}
                        className="rounded-[10px] bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
                    >
                        {creating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            "Continue"
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
