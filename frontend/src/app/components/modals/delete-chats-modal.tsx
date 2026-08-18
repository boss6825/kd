"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

interface DeleteChatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    chatCount: number;
    isDeleting: boolean;
    isSuccess?: boolean;
}

export function DeleteChatsModal({
    isOpen,
    onClose,
    onConfirm,
    chatCount,
    isDeleting,
    isSuccess = false,
}: DeleteChatsModalProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !isDeleting) onClose();
            }}
        >
            <DialogContent className="max-w-md rounded-2xl bg-card border-border shadow-[var(--kd-shadow-2)] p-8">
                {isSuccess ? (
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-kd-ok/10 rounded-full flex items-center justify-center mb-4">
                            <Check className="h-8 w-8 text-kd-ok" strokeWidth={1.5} />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-normal font-serif tracking-[-0.01em] text-foreground text-center">
                                All Chats Deleted
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                Your chat history has been successfully deleted.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-4xl font-normal font-serif tracking-[-0.01em] text-destructive">
                                Delete All Chats
                            </DialogTitle>
                            <DialogDescription className="leading-relaxed pt-2">
                                Are you sure you want to delete all {chatCount}{" "}
                                chat
                                {chatCount !== 1 ? "s" : ""}? This action is
                                permanent and cannot be undone.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 pt-4">
                            <Button
                                onClick={onConfirm}
                                disabled={isDeleting}
                                variant="destructive"
                                className="w-full"
                            >
                                {isDeleting ? "Deleting..." : "Delete All Chats"}
                            </Button>
                            <Button
                                onClick={onClose}
                                variant="outline"
                                disabled={isDeleting}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
