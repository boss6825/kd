"use client";

import { type Dispatch, type SetStateAction } from "react";
import { RowActions } from "@/app/components/shared/RowActions";
import type { KdDocument, TabularReview } from "@/app/components/shared/types";
import { CHECK_W, formatDate, NAME_COL_W } from "./ProjectPageParts";

export function ProjectReviewsTab({
    docs,
    reviews,
    filteredReviews,
    selectedReviewIds,
    allReviewsSelected,
    someReviewsSelected,
    renamingReviewId,
    renameReviewValue,
    creatingReview,
    currentUserId,
    onCreateReview,
    onOpenReview,
    onDeleteReview,
    onOwnerOnlyAction,
    submitReviewRename,
    setSelectedReviewIds,
    setRenamingReviewId,
    setRenameReviewValue,
}: {
    docs: KdDocument[];
    reviews: TabularReview[];
    filteredReviews: TabularReview[];
    selectedReviewIds: string[];
    allReviewsSelected: boolean;
    someReviewsSelected: boolean;
    renamingReviewId: string | null;
    renameReviewValue: string;
    creatingReview: boolean;
    currentUserId?: string | null;
    onCreateReview: () => void;
    onOpenReview: (reviewId: string) => void;
    onDeleteReview: (review: TabularReview) => Promise<void> | void;
    onOwnerOnlyAction: (action: string) => void;
    submitReviewRename: (reviewId: string) => Promise<void> | void;
    setSelectedReviewIds: Dispatch<SetStateAction<string[]>>;
    setRenamingReviewId: Dispatch<SetStateAction<string | null>>;
    setRenameReviewValue: Dispatch<SetStateAction<string>>;
}) {
    return (
        <>
            <div className="flex items-center h-11 pr-8 border-b border-border bg-muted kd-label text-muted-foreground select-none">
                <div
                    className={`sticky left-0 z-[60] ${CHECK_W} bg-muted flex items-center justify-center self-stretch`}
                >
                    <input
                        type="checkbox"
                        checked={allReviewsSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someReviewsSelected;
                        }}
                        onChange={() => {
                            if (allReviewsSelected) setSelectedReviewIds([]);
                            else
                                setSelectedReviewIds(
                                    filteredReviews.map((r) => r.id),
                                );
                        }}
                        className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-kd-brass"
                    />
                </div>
                <div
                    className={`sticky left-8 z-[60] ${NAME_COL_W} bg-muted pl-2 text-left`}
                >
                    Name
                </div>
                <div className="ml-auto w-24 shrink-0 text-right">Columns</div>
                <div className="w-24 shrink-0 text-right">Documents</div>
                <div className="w-32 shrink-0 text-right">Created</div>
                <div className="w-8 shrink-0" />
            </div>
            {reviews.length === 0 ? (
                <div className="flex w-full flex-col items-center justify-center py-24 text-center">
                    <p className="font-serif text-xl text-foreground">
                        Extract the facts of this matter into a table.
                    </p>
                    <button
                        onClick={onCreateReview}
                        disabled={creatingReview || docs.length === 0}
                        className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        New review
                    </button>
                </div>
            ) : (
                <div>
                    {filteredReviews.map((review) => (
                        <div
                            key={review.id}
                            onClick={() => {
                                if (renamingReviewId === review.id) return;
                                onOpenReview(review.id);
                            }}
                            className="group flex items-center h-[52px] pr-8 border-b border-border hover:bg-muted cursor-pointer transition-colors"
                        >
                            <div
                                className={`sticky left-0 z-[60] ${CHECK_W} p-2 flex items-center justify-center ${
                                    selectedReviewIds.includes(review.id)
                                        ? "bg-muted"
                                        : "bg-card"
                                } group-hover:bg-muted`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedReviewIds.includes(review.id)}
                                    onChange={() =>
                                        setSelectedReviewIds((prev) =>
                                            prev.includes(review.id)
                                                ? prev.filter(
                                                      (x) => x !== review.id,
                                                  )
                                                : [...prev, review.id],
                                        )
                                    }
                                    className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-kd-brass"
                                />
                            </div>
                            <div
                                className={`sticky left-8 z-[60] ${NAME_COL_W} bg-card p-2 group-hover:bg-muted`}
                            >
                                {renamingReviewId === review.id ? (
                                    <input
                                        autoFocus
                                        value={renameReviewValue}
                                        onChange={(e) =>
                                            setRenameReviewValue(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                                void submitReviewRename(review.id);
                                            if (e.key === "Escape")
                                                setRenamingReviewId(null);
                                        }}
                                        onBlur={() =>
                                            void submitReviewRename(review.id)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm text-foreground bg-transparent outline-none"
                                    />
                                ) : (
                                    <span className="text-sm font-medium text-foreground truncate block">
                                        {review.title ?? "Untitled Review"}
                                    </span>
                                )}
                            </div>
                            <div className="ml-auto w-24 shrink-0 text-right font-mono text-xs text-muted-foreground truncate">
                                {review.columns_config?.length ?? 0}
                            </div>
                            <div className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground truncate">
                                {review.document_count ?? 0}
                            </div>
                            <div className="w-32 shrink-0 text-right text-[13px] text-muted-foreground truncate">
                                {review.created_at ? (
                                    formatDate(review.created_at)
                                ) : (
                                    <span className="text-kd-text-3">—</span>
                                )}
                            </div>
                            <div
                                className="w-8 shrink-0 flex justify-end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <RowActions
                                    onRename={() => {
                                        if (
                                            currentUserId &&
                                            review.user_id !== currentUserId
                                        ) {
                                            onOwnerOnlyAction(
                                                "rename this tabular review",
                                            );
                                            return;
                                        }
                                        setRenameReviewValue(
                                            review.title ?? "Untitled Review",
                                        );
                                        setRenamingReviewId(review.id);
                                    }}
                                    onDelete={() => onDeleteReview(review)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
