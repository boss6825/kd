"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { KDMark } from "@/components/kd-mark";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
import type { KdMessage } from "../shared/types";

interface InitialViewProps {
    onSubmit: (message: KdMessage) => void;
}

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

function timeOfDayGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

export function InitialView({ onSubmit }: InitialViewProps) {
    const { user } = useAuth();
    const { profile } = useUserProfile();
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const chatInputRef = useRef<ChatInputHandle>(null);

    const username =
        profile?.displayName?.trim() || user?.email?.split("@")[0] || "there";

    return (
        <div className="flex flex-col h-full w-full px-6 bg-background">
            <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
                <div className="flex flex-col items-center w-full max-w-3xl px-0 xl:px-8">
                    <KDMark size={44} />
                    <h1 className="mt-7 mb-2.5 text-center font-serif font-normal text-[42px] leading-[1.1] tracking-[-0.01em] text-foreground">
                        {timeOfDayGreeting()}, {username}.
                    </h1>
                    <p className="mb-9 text-center text-base text-muted-foreground">
                        What does the matter need?
                    </p>

                    <ChatInput
                        ref={chatInputRef}
                        onSubmit={onSubmit}
                        onCancel={() => {}}
                        isLoading={false}
                        onProjectsClick={() => setProjectModalOpen(true)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-5">
                        {SUGGESTED_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() =>
                                    chatInputRef.current?.setValue(prompt)
                                }
                                className="text-left px-4 py-3.5 rounded-[12px] border border-border bg-card text-sm leading-normal text-muted-foreground transition-colors hover:border-kd-text-3 hover:text-foreground cursor-pointer"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-kd-text-3 mt-6 mb-3 text-center">
                        KD can make mistakes. Answers are not legal advice.
                    </p>
                </div>
            </div>

            <SelectAssistantProjectModal
                open={projectModalOpen}
                onClose={() => setProjectModalOpen(false)}
            />
        </div>
    );
}
