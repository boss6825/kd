"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ChatInput } from "./ChatInput";
import {
    AssistantSidePanel,
    type AssistantSidePanelTab,
} from "./AssistantSidePanel";
import { AssistantWorkflowModal } from "./AssistantWorkflowModal";
import type {
    KdCitationAnnotation,
    KdEditAnnotation,
    KdMessage,
} from "../shared/types";
import { useSidebar } from "@/app/contexts/SidebarContext";
import { invalidateDocxBytes } from "@/app/hooks/useFetchDocxBytes";

interface Props {
    messages: KdMessage[];
    isResponseLoading: boolean;
    handleChat: (message: KdMessage) => Promise<string | null>;
    cancel: () => void;
}

export function ChatView({
    messages,
    isResponseLoading,
    handleChat,
    cancel,
}: Props) {
    const [tabs, setTabs] = useState<AssistantSidePanelTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [panelMounted, setPanelMounted] = useState(false);
    const [panelVisible, setPanelVisible] = useState(false);
    const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
    const [workflowModalInitialId, setWorkflowModalInitialId] = useState<
        string | undefined
    >();
    const [reloadingDocIds, setReloadingDocIds] = useState<Set<string>>(
        () => new Set(),
    );
    // Per-edit in-flight set — disables Accept/Reject on only the one
    // edit currently being resolved, so sibling edits in the same message
    // (and their twins in DocPanel) stay clickable.
    const [reloadingEditIds, setReloadingEditIds] = useState<Set<string>>(
        () => new Set(),
    );
    const { setSidebarOpen } = useSidebar();


    const showPanel = useCallback(() => {
        setPanelMounted(true);
        setSidebarOpen(false);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => setPanelVisible(true)),
        );
    }, [setSidebarOpen]);

    const closeAllTabs = useCallback(() => {
        setPanelVisible(false);
        setTimeout(() => {
            setTabs([]);
            setActiveTabId(null);
            setPanelMounted(false);
            setSidebarOpen(true);
        }, 300);
    }, [setSidebarOpen]);

    const closeTab = useCallback(
        (id: string) => {
            setTabs((prev) => {
                const next = prev.filter((t) => t.id !== id);
                if (next.length === 0) {
                    setPanelVisible(false);
                    setTimeout(() => {
                        setActiveTabId(null);
                        setPanelMounted(false);
                        setSidebarOpen(true);
                    }, 300);
                    return next;
                }
                if (activeTabId === id) {
                    const idx = prev.findIndex((t) => t.id === id);
                    const neighbour = next[idx] ?? next[idx - 1] ?? next[0];
                    setActiveTabId(neighbour?.id ?? null);
                }
                return next;
            });
        },
        [activeTabId, setSidebarOpen],
    );

    /**
     * One tab per document. If a tab for `tab.documentId` already exists,
     * the panel stays mounted and only the header-relevant fields swap
     * (kind, citation/edit, version, filename). Per-tab UI state — the
     * dismissable warning and the saved scroll position — is preserved
     * so switching headers doesn't blow away viewer state. If no tab
     * exists for the document, a new one is appended.
     */
    const upsertTab = useCallback(
        (tab: AssistantSidePanelTab) => {
            setTabs((prev) => {
                const idx = prev.findIndex(
                    (t) => t.documentId === tab.documentId,
                );
                if (idx >= 0) {
                    const existing = prev[idx];
                    const copy = prev.slice();
                    copy[idx] = {
                        ...tab,
                        id: existing.id,
                        warning: existing.warning,
                        initialScrollTop: existing.initialScrollTop,
                    };
                    return copy;
                }
                return [...prev, tab];
            });
            setActiveTabId(tab.id);
            showPanel();
        },
        [showPanel],
    );

    /**
     * Open a tab showing a single citation quote. Called from
     * AssistantMessage when the user clicks a numbered citation pill.
     */
    const openCitation = useCallback(
        (citation: KdCitationAnnotation) => {
            upsertTab({
                kind: "citation",
                id: citation.document_id,
                documentId: citation.document_id,
                filename: citation.filename,
                versionId: citation.version_id ?? null,
                versionNumber: citation.version_number ?? null,
                citation,
            });
        },
        [upsertTab],
    );

    /**
     * Open a tab showing a single tracked change. Called from
     * AssistantMessage when the user clicks an EditCard's View button.
     */
    const openEditor = useCallback(
        (ann: KdEditAnnotation, filename: string) => {
            upsertTab({
                kind: "edit",
                id: ann.document_id,
                documentId: ann.document_id,
                filename,
                versionId: ann.version_id ?? null,
                versionNumber: ann.version_number ?? null,
                edit: ann,
            });
        },
        [upsertTab],
    );

    /**
     * Open a tab showing a document without targeting a specific
     * citation/edit — used by the download-card click.
     */
    const openDocument = useCallback(
        (args: {
            documentId: string;
            filename: string;
            versionId: string | null;
            versionNumber: number | null;
        }) => {
            upsertTab({
                kind: "document",
                id: args.documentId,
                documentId: args.documentId,
                filename: args.filename,
                versionId: args.versionId,
                versionNumber: args.versionNumber,
            });
        },
        [upsertTab],
    );

    const [resolvedEditStatuses, setResolvedEditStatuses] = useState<
        Record<string, "accepted" | "rejected">
    >({});

    const handleEditResolveStart = useCallback(
        (args: {
            editId: string;
            documentId: string;
            verb: "accept" | "reject";
        }) => {
            setReloadingDocIds((prev) => {
                if (prev.has(args.documentId)) return prev;
                const next = new Set(prev);
                next.add(args.documentId);
                return next;
            });
            setReloadingEditIds((prev) => {
                if (prev.has(args.editId)) return prev;
                const next = new Set(prev);
                next.add(args.editId);
                return next;
            });
        },
        [],
    );

    const handleEditResolved = useCallback(
        (args: {
            editId: string;
            documentId: string;
            status: "accepted" | "rejected";
            versionId: string | null;
            downloadUrl: string | null;
        }) => {
            setResolvedEditStatuses((prev) => ({
                ...prev,
                [args.editId]: args.status,
            }));
            setReloadingDocIds((prev) => {
                if (!prev.has(args.documentId)) return prev;
                const next = new Set(prev);
                next.delete(args.documentId);
                return next;
            });
            setReloadingEditIds((prev) => {
                if (!prev.has(args.editId)) return prev;
                const next = new Set(prev);
                next.delete(args.editId);
                return next;
            });
            // Propagate the new status onto any open edit-tab for this
            // edit so DocPanel's Accept/Reject buttons flip and disable
            // (their sync effect keys off edit.status). Without this, a
            // resolve triggered from the inline EditCard or BulkEditActions
            // leaves the panel buttons looking live.
            setTabs((prev) =>
                prev.map((t) =>
                    t.kind === "edit" && t.edit.edit_id === args.editId
                        ? {
                              ...t,
                              edit: { ...t.edit, status: args.status },
                          }
                        : t,
                ),
            );
            // Accept/reject mutates bytes for this document's current
            // version; drop the cache so the next DocxView render (or an
            // explicit re-open) fetches the fresh file.
            invalidateDocxBytes(args.documentId);
        },
        [],
    );


    const patchTab = useCallback(
        (
            tabId: string,
            patch: Partial<Pick<AssistantSidePanelTab, "warning" | "initialScrollTop">>,
        ) => {
            setTabs((prev) => {
                const idx = prev.findIndex((t) => t.id === tabId);
                if (idx < 0) return prev;
                const copy = prev.slice();
                copy[idx] = { ...copy[idx], ...patch };
                return copy;
            });
        },
        [],
    );

    const handleEditError = useCallback(
        (args: {
            editId?: string;
            documentId: string;
            versionId?: string | null;
            message: string;
        }) => {
            // Surface the warning on every tab tied to this document.
            setTabs((prev) =>
                prev.map((t) =>
                    t.documentId === args.documentId
                        ? { ...t, warning: args.message }
                        : t,
                ),
            );
            setReloadingDocIds((prev) => {
                if (!prev.has(args.documentId)) return prev;
                const next = new Set(prev);
                next.delete(args.documentId);
                return next;
            });
            if (args.editId) {
                setReloadingEditIds((prev) => {
                    if (!prev.has(args.editId!)) return prev;
                    const next = new Set(prev);
                    next.delete(args.editId!);
                    return next;
                });
            }
        },
        [],
    );

    const handleWarningDismiss = useCallback(
        (tabId: string) => {
            patchTab(tabId, { warning: null });
        },
        [patchTab],
    );

    const handleScrollChange = useCallback(
        (tabId: string, scrollTop: number) => {
            patchTab(tabId, { initialScrollTop: scrollTop });
        },
        [patchTab],
    );

    const chatInputRef = useRef<HTMLDivElement>(null);
    const [inputHeight, setInputHeight] = useState(0);
    // MessageScroller owns scroll behaviour: user messages are scroll
    // anchors (scrolled to the top of the viewport as new turns start),
    // saved chats restore at the last anchor, and streamed replies only
    // follow when the user is already at the bottom.
    const messagesVisible = messages.length > 0;

    useEffect(() => {
        const el = chatInputRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() =>
            setInputHeight(el.offsetHeight),
        );
        observer.observe(el);
        setInputHeight(el.offsetHeight);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (panelMounted && window.innerWidth < 768) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [panelMounted]);

    return (
        <div className="h-full w-full flex relative">
            {/* Chat column */}
            <div className="flex flex-col h-full flex-1 relative">
                {/* Scrollable messages */}
                {!messagesVisible ? (
                    <div className="flex-1 w-full overflow-hidden">
                        <div className="w-full max-w-4xl mx-auto px-6 md:px-8 pt-4 md:pt-6 space-y-6">
                            <div className="flex justify-end">
                                <Skeleton className="rounded-2xl h-12 w-2/5" />
                            </div>
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton
                                        key={i}
                                        className={`h-4 rounded ${i === 3 ? "w-5/6" : i === 4 ? "w-4/6" : "w-full"}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <MessageScrollerProvider
                        autoScroll
                        defaultScrollPosition="last-anchor"
                        scrollMargin={24}
                    >
                        <MessageScroller className="flex-1 min-h-0">
                            <MessageScrollerViewport
                                style={{
                                    scrollbarGutter: "stable both-edges",
                                }}
                            >
                                <MessageScrollerContent className="w-full max-w-4xl mx-auto pb-32 px-6 md:px-8 pt-4 md:pt-6 gap-6">
                                    {messages.map((msg, i) => (
                                        <MessageScrollerItem
                                            key={i}
                                            messageId={`m-${i}`}
                                            scrollAnchor={msg.role === "user"}
                                        >
                                            {msg.role === "user" ? (
                                                <UserMessage
                                                    content={msg.content ?? ""}
                                                    files={msg.files}
                                                    workflow={msg.workflow}
                                                />
                                            ) : (
                                                <AssistantMessage
                                                    content={msg.content ?? ""}
                                                    events={msg.events}
                                                    isStreaming={
                                                        i ===
                                                            messages.length -
                                                                1 &&
                                                        isResponseLoading
                                                    }
                                                    isError={!!msg.error}
                                                    errorMessage={msg.error}
                                                    annotations={
                                                        msg.annotations
                                                    }
                                                    onCitationClick={
                                                        openCitation
                                                    }
                                                    onWorkflowClick={(id) => {
                                                        setWorkflowModalInitialId(
                                                            id,
                                                        );
                                                        setWorkflowModalOpen(
                                                            true,
                                                        );
                                                    }}
                                                    onEditViewClick={
                                                        openEditor
                                                    }
                                                    onOpenDocument={
                                                        openDocument
                                                    }
                                                    onEditResolveStart={
                                                        handleEditResolveStart
                                                    }
                                                    onEditResolved={
                                                        handleEditResolved
                                                    }
                                                    onEditError={
                                                        handleEditError
                                                    }
                                                    isDocReloading={(docId) =>
                                                        reloadingDocIds.has(
                                                            docId,
                                                        )
                                                    }
                                                    isEditReloading={(
                                                        editId,
                                                    ) =>
                                                        reloadingEditIds.has(
                                                            editId,
                                                        )
                                                    }
                                                    resolvedEditStatuses={
                                                        resolvedEditStatuses
                                                    }
                                                />
                                            )}
                                        </MessageScrollerItem>
                                    ))}
                                </MessageScrollerContent>
                            </MessageScrollerViewport>
                            <MessageScrollerButton
                                direction="end"
                                className="z-19"
                                style={{ bottom: inputHeight + 12 }}
                            />
                        </MessageScroller>
                    </MessageScrollerProvider>
                )}

                {/* Chat input */}
                <div
                    ref={chatInputRef}
                    className="absolute bottom-0 left-0 right-0 w-full z-30"
                >
                    <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
                        <div className="w-full">
                            <ChatInput
                                onSubmit={handleChat}
                                onCancel={cancel}
                                isLoading={isResponseLoading}
                            />
                            <div className="py-3 text-center">
                                <p className="text-xs text-kd-text-3">
                                    KD can make mistakes. Answers are not legal
                                    advice.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AssistantWorkflowModal
                open={workflowModalOpen}
                onClose={() => setWorkflowModalOpen(false)}
                onSelect={() => setWorkflowModalOpen(false)}
                initialWorkflowId={workflowModalInitialId}
            />

            {panelMounted && (
                <div
                    className={`fixed md:relative inset-0 md:inset-auto md:h-full md:flex-shrink-0 z-40 md:z-auto transition-transform duration-300 ease-in-out ${panelVisible ? "translate-x-0" : "translate-x-full"}`}
                >
                    <AssistantSidePanel
                        tabs={tabs}
                        activeTabId={activeTabId}
                        onActivateTab={setActiveTabId}
                        onCloseTab={closeTab}
                        onCloseAll={closeAllTabs}
                        isEditorReloading={(documentId) =>
                            reloadingDocIds.has(documentId)
                        }
                        isEditReloading={(editId) =>
                            reloadingEditIds.has(editId)
                        }
                        onEditResolveStart={handleEditResolveStart}
                        onEditResolved={handleEditResolved}
                        onEditError={handleEditError}
                        onWarningDismiss={handleWarningDismiss}
                        onScrollChange={handleScrollChange}
                    />
                </div>
            )}
        </div>
    );
}
