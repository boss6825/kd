"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CreditsExhaustedModalProps {
    isOpen: boolean;
    onClose: () => void;
    resetDate: string;
}

export function CreditsExhaustedModal({
    isOpen,
    onClose,
    resetDate,
}: CreditsExhaustedModalProps) {
    // Format the reset date
    const formatResetDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md rounded-2xl bg-card border-border shadow-[var(--kd-shadow-2)] p-6">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-normal font-serif tracking-[-0.01em] text-foreground">
                        Message Limit Reached
                    </DialogTitle>
                    <DialogDescription>
                        You&apos;ve reached your monthly message limit of 100
                        messages.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="bg-kd-accent/10 border border-kd-accent/30 rounded-[10px] p-4">
                        <p className="text-sm text-kd-accent font-medium mb-1">
                            Your credits will reset on:
                        </p>
                        <p className="text-lg font-semibold text-kd-accent">
                            {formatResetDate(resetDate)}
                        </p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Your message credits automatically reset on the first
                        day of each month.
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        onClick={onClose}
                        variant="secondary"
                        className="w-full"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
