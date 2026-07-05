"use client";

import { Link2, Check } from "lucide-react";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SimpleLinkDialogProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string | null;
}

export function SimpleLinkDialog({
    isOpen,
    onClose,
    shareUrl,
}: SimpleLinkDialogProps) {
    const [linkCopied, setLinkCopied] = useState(false);

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {}
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md rounded-2xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-light font-eb-garamond text-foreground">
                        Share Chat
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-3 border border-border">
                        <p className="text-sm text-muted-foreground mb-2 font-medium">
                            Share Link
                        </p>
                        <p className="text-sm text-foreground break-all font-mono">
                            {shareUrl}
                        </p>
                    </div>

                    <Button
                        onClick={handleCopyLink}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {linkCopied ? (
                            <>
                                <Check className="h-5 w-5" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Link2 className="h-5 w-5" />
                                Copy Link
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
