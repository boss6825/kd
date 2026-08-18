"use client";

import { type Dispatch, type SetStateAction } from "react";
import { RowActions } from "@/app/components/shared/RowActions";
import type { MikeChat } from "@/app/components/shared/types";
import { CHECK_W, formatDate, NAME_COL_W } from "./ProjectPageParts";

export function ProjectAssistantTab({
    chats,
    filteredChats,
    selectedChatIds,
    allChatsSelected,
    someChatsSelected,
    renamingChatId,
    renameChatValue,
    currentUserId,
    onCreateChat,
    onOpenChat,
    onDeleteChat,
    onOwnerOnlyAction,
    submitChatRename,
    setSelectedChatIds,
    setRenamingChatId,
    setRenameChatValue,
}: {
    chats: MikeChat[];
    filteredChats: MikeChat[];
    selectedChatIds: string[];
    allChatsSelected: boolean;
    someChatsSelected: boolean;
    renamingChatId: string | null;
    renameChatValue: string;
    currentUserId?: string | null;
    onCreateChat: () => void;
    onOpenChat: (chatId: string) => void;
    onDeleteChat: (chat: MikeChat) => Promise<void> | void;
    onOwnerOnlyAction: (action: string) => void;
    submitChatRename: (chatId: string) => Promise<void> | void;
    setSelectedChatIds: Dispatch<SetStateAction<string[]>>;
    setRenamingChatId: Dispatch<SetStateAction<string | null>>;
    setRenameChatValue: Dispatch<SetStateAction<string>>;
}) {
    return (
        <>
            <div className="flex items-center h-11 pr-8 border-b border-border bg-muted kd-label text-muted-foreground select-none">
                <div
                    className={`sticky left-0 z-[60] ${CHECK_W} bg-muted flex items-center justify-center self-stretch`}
                >
                    <input
                        type="checkbox"
                        checked={allChatsSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someChatsSelected;
                        }}
                        onChange={() => {
                            if (allChatsSelected) setSelectedChatIds([]);
                            else setSelectedChatIds(filteredChats.map((c) => c.id));
                        }}
                        className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-kd-brass"
                    />
                </div>
                <div
                    className={`sticky left-8 z-[60] ${NAME_COL_W} bg-muted pl-2 text-left`}
                >
                    Chats
                </div>
                <div className="ml-auto w-32 shrink-0 text-right">Created</div>
                <div className="w-8 shrink-0" />
            </div>
            {chats.length === 0 ? (
                <div className="flex w-full flex-col items-center justify-center py-24 text-center">
                    <p className="font-serif text-xl text-foreground">
                        Every great matter starts with a question.
                    </p>
                    <button
                        onClick={onCreateChat}
                        className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        Ask KD
                    </button>
                </div>
            ) : (
                <div>
                    {filteredChats.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => {
                                if (renamingChatId === chat.id) return;
                                onOpenChat(chat.id);
                            }}
                            className="group flex items-center h-[52px] pr-8 border-b border-border hover:bg-muted cursor-pointer transition-colors"
                        >
                            <div
                                className={`sticky left-0 z-[60] ${CHECK_W} p-2 flex items-center justify-center ${
                                    selectedChatIds.includes(chat.id)
                                        ? "bg-muted"
                                        : "bg-card"
                                } group-hover:bg-muted`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedChatIds.includes(chat.id)}
                                    onChange={() =>
                                        setSelectedChatIds((prev) =>
                                            prev.includes(chat.id)
                                                ? prev.filter((x) => x !== chat.id)
                                                : [...prev, chat.id],
                                        )
                                    }
                                    className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-kd-brass"
                                />
                            </div>
                            <div
                                className={`sticky left-8 z-[60] ${NAME_COL_W} bg-card p-2 group-hover:bg-muted`}
                            >
                                {renamingChatId === chat.id ? (
                                    <input
                                        autoFocus
                                        value={renameChatValue}
                                        onChange={(e) =>
                                            setRenameChatValue(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                void submitChatRename(chat.id);
                                            if (e.key === "Escape")
                                                setRenamingChatId(null);
                                        }}
                                        onBlur={() => void submitChatRename(chat.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm text-foreground bg-transparent outline-none"
                                    />
                                ) : (
                                    <span className="text-sm font-medium text-foreground truncate block">
                                        {chat.title ?? "Untitled Chat"}
                                    </span>
                                )}
                            </div>
                            <div className="ml-auto w-32 shrink-0 text-right text-[13px] text-muted-foreground truncate">
                                {formatDate(chat.created_at)}
                            </div>
                            <div
                                className="w-8 shrink-0 flex justify-end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <RowActions
                                    onRename={() => {
                                        if (
                                            currentUserId &&
                                            chat.user_id !== currentUserId
                                        ) {
                                            onOwnerOnlyAction("rename this chat");
                                            return;
                                        }
                                        setRenameChatValue(
                                            chat.title ?? "Untitled Chat",
                                        );
                                        setRenamingChatId(chat.id);
                                    }}
                                    onDelete={() => onDeleteChat(chat)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
