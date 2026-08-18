"use client";

import { File, FileText, Library } from "lucide-react";
import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";

interface Props {
    content: string;
    files?: { filename: string; document_id?: string }[];
    workflow?: { id: string; title: string };
}

export function UserMessage({ content, files, workflow }: Props) {
    const hasFiles = files && files.length > 0;

    return (
        <Message align="end">
            <MessageContent>
                <Bubble variant="muted" align="end" className="max-w-[60%]">
                    <BubbleContent className="rounded-[14px] px-4 py-3">
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                            {content}
                        </p>
                        {(workflow || hasFiles) && (
                            <div className="flex flex-wrap justify-end gap-1.5 mt-3">
                                {workflow && (
                                    <div className="inline-flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-full text-xs bg-card text-foreground border border-border">
                                        <Library className="h-2.5 w-2.5 shrink-0" />
                                        <span className="max-w-[140px] truncate">
                                            {workflow.title}
                                        </span>
                                    </div>
                                )}
                                {hasFiles &&
                                    files.map((f, i) => {
                                        const ext = f.filename
                                            .split(".")
                                            .pop()
                                            ?.toLowerCase();
                                        const isPdf = ext === "pdf";
                                        return (
                                            <div
                                                key={i}
                                                className="inline-flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-full text-xs bg-card text-foreground border border-border"
                                            >
                                                {isPdf ? (
                                                    <FileText className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <File className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                                )}
                                                <span className="max-w-[140px] truncate">
                                                    {f.filename}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </BubbleContent>
                </Bubble>
            </MessageContent>
        </Message>
    );
}
