"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import {
    Attachment,
    AttachmentAction,
    AttachmentActions,
    AttachmentContent,
    AttachmentDescription,
    AttachmentMedia,
    AttachmentTitle,
    AttachmentTrigger,
} from "@/components/ui/attachment";
import { getStoredToken } from "@/lib/authClient";

/**
 * Download / open card for a generated or edited document. The download
 * fetch carries the user's bearer token, so only backend-relative URLs are
 * accepted — an absolute URL from tool output is refused to keep the token
 * from leaking off-origin.
 */
export function DocDownloadCard({
    filename,
    download_url,
    onOpen,
    isReloading = false,
    versionNumber,
}: {
    filename: string;
    download_url: string;
    onOpen?: () => void;
    isReloading?: boolean;
    versionNumber?: number | null;
}) {
    const hasVersion =
        typeof versionNumber === "number" &&
        Number.isFinite(versionNumber) &&
        versionNumber > 0;
    const extMatch = filename.match(/\.(\w+)$/);
    const ext = extMatch ? extMatch[1].toUpperCase() : "FILE";
    const rawBasename = extMatch
        ? filename.slice(0, -extMatch[0].length)
        : filename;
    // Strip any legacy "[Edited V3]" suffix that may still be baked into
    // older saved download filenames — the version is surfaced as a
    // separate tag now.
    const basename = rawBasename.replace(/\s*\[Edited V\d+\]\s*$/, "").trim();
    const API_BASE =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
    const isSafeHref = download_url.startsWith("/");
    const href = isSafeHref ? `${API_BASE}${download_url}` : null;
    const [busy, setBusy] = useState(false);

    const handleDownload = async (e?: {
        stopPropagation?: () => void;
        preventDefault?: () => void;
    }) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (busy || isReloading || !href) return;
        setBusy(true);
        try {
            const token = getStoredToken();
            const resp = await fetch(href, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } finally {
            setBusy(false);
        }
    };

    const spinning = busy || isReloading;

    return (
        <Attachment
            state={spinning ? "processing" : "done"}
            className="w-full max-w-full rounded-lg"
        >
            <AttachmentMedia>
                <FileText />
            </AttachmentMedia>
            <AttachmentContent>
                <span className="flex items-center gap-2 min-w-0">
                    <AttachmentTitle className="font-serif text-base font-normal">
                        {basename}
                    </AttachmentTitle>
                    {hasVersion && (
                        <span className="shrink-0 inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            V{versionNumber}
                        </span>
                    )}
                </span>
                <AttachmentDescription className="text-blue-600">
                    {ext}
                </AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
                <AttachmentAction
                    onClick={handleDownload}
                    disabled={spinning || !href}
                    aria-label={`Download ${filename}`}
                >
                    {spinning ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <Download />
                    )}
                </AttachmentAction>
            </AttachmentActions>
            {onOpen || (!spinning && href) ? (
                <AttachmentTrigger
                    onClick={onOpen ?? (() => handleDownload())}
                    aria-label={onOpen ? `Open ${filename}` : `Download ${filename}`}
                />
            ) : null}
        </Attachment>
    );
}
