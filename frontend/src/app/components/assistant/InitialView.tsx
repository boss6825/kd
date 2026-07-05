"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { MikeIcon } from "@/components/chat/mike-icon";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
import type { MikeMessage } from "../shared/types";

interface InitialViewProps {
    onSubmit: (message: MikeMessage) => void;
}

const ICON_SIZE = 35;
const GAP = 16; // gap-4 = 1rem = 16px

/**
 * Starter prompts for the empty state. Phrased to work cold — none of
 * them assume a document is already attached; the assistant asks for one
 * when it needs it.
 */
const SUGGESTED_PROMPTS = [
    "Draft a legal notice under Section 138 of the Negotiable Instruments Act",
    "Review this contract for indemnity and limitation-of-liability risks",
    "Summarise the key obligations and termination rights in this agreement",
    "Explain the stamp duty implications of transferring shares in a private company",
];

export function InitialView({ onSubmit }: InitialViewProps) {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const [loaded, setLoaded] = useState(false);
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [iconOffset, setIconOffset] = useState(0);
    const [textOffset, setTextOffset] = useState(0);
    const textRef = useRef<HTMLHeadingElement>(null);
    const chatInputRef = useRef<ChatInputHandle>(null);

    const username =
        profile?.displayName?.trim() || user?.email?.split("@")[0] || "there";

    useLayoutEffect(() => {
        if (!profile || !textRef.current) return;
        const h1Width = textRef.current.offsetWidth;
        setIconOffset((h1Width + GAP) / 2);
        setTextOffset((ICON_SIZE + GAP) / 2);
    }, [profile]);

    useEffect(() => {
        if (!iconOffset) return;
        const t = setTimeout(() => setLoaded(true), 100);
        return () => clearTimeout(t);
    }, [iconOffset]);

    return (
        <div className="flex flex-col h-full w-full px-6">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="flex-col items-center w-full max-w-4xl relative px-0 xl:px-8">
                    <div className="mb-10 relative flex items-center justify-center">
                        <div
                            className="absolute h-[35px]"
                            style={{
                                left: "50%",
                                transform: loaded
                                    ? `translateX(calc(-50% - ${iconOffset}px))`
                                    : "translateX(-50%)",
                                transition:
                                    "transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                            }}
                        >
                            <MikeIcon size={ICON_SIZE} />
                        </div>
                        <h1
                            ref={textRef}
                            className="absolute text-4xl font-serif font-light text-foreground whitespace-nowrap"
                            style={{
                                left: "50%",
                                transform: loaded
                                    ? `translateX(calc(-50% + ${textOffset}px))`
                                    : "translateX(-50%)",
                                opacity: loaded ? 1 : 0,
                                transition:
                                    "transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 800ms ease-in-out 300ms",
                            }}
                        >
                            Hi, {username}
                        </h1>
                    </div>

                    <ChatInput
                        ref={chatInputRef}
                        onSubmit={onSubmit}
                        onCancel={() => {}}
                        isLoading={false}
                        onProjectsClick={() => setProjectModalOpen(true)}
                    />

                    <div
                        className="flex flex-wrap justify-center gap-2 pt-4 transition-opacity duration-700"
                        style={{ opacity: loaded ? 1 : 0 }}
                    >
                        {SUGGESTED_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() =>
                                    chatInputRef.current?.setValue(prompt)
                                }
                                className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-serif text-muted-foreground transition-colors hover:border-blue-200 hover:text-blue-600 cursor-pointer"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <div className="text-center">
                        <p className="text-xs py-3 mb-3 text-muted-foreground">
                            AI can make mistakes. Answers are not legal advice.
                        </p>
                    </div>
                </div>
            </div>

            <SelectAssistantProjectModal
                open={projectModalOpen}
                onClose={() => setProjectModalOpen(false)}
            />
        </div>
    );
}
