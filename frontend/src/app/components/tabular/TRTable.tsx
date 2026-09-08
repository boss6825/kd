"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { FileText, Loader2, Plus, Table2, Upload } from "lucide-react";
import type { ColumnConfig, KdDocument, TabularCell } from "../shared/types";
import { TabularCell as TabularCellComponent } from "./TabularCell";
import { TREditColumnMenu } from "./TREditColumnMenu";

const SKELETON_COLS = 4;
const SKELETON_ROWS = 5;

const COL_W = "w-[300px] shrink-0";
const CHECK_W = "w-8 shrink-0";

// Pixel widths matching the CSS constants above
const CHECK_W_PX = 32; // w-8 = 2rem = 32px
const DOC_COL_W_PX = 300;
const DATA_COL_W_PX = 300;
const STICKY_LEFT_PX = CHECK_W_PX + DOC_COL_W_PX; // 332px

export interface TRTableHandle {
    scrollToCell: (colIdx: number, rowIdx: number) => void;
}

interface Props {
    loading: boolean;
    columns: ColumnConfig[];
    documents: KdDocument[];
    cells: TabularCell[];
    savingColumn: boolean;
    savingColumnsConfig: boolean;
    selectedDocIds: string[];
    uploadingFilenames?: string[];
    dragOverFiles?: boolean;
    highlightedCell?: { colIdx: number; rowIdx: number } | null;
    onSelectionChange: (ids: string[]) => void;
    onExpand: (cell: TabularCell) => void;
    onCitationClick: (cell: TabularCell, page: number, quote: string) => void;
    onUpdateColumn: (col: ColumnConfig) => void;
    onDeleteColumn: (colIndex: number) => void;
    onAddColumn: () => void;
    onAddDocuments: () => void;
}

export const TRTable = forwardRef<TRTableHandle, Props>(function TRTable(
    {
        loading,
        columns,
        documents,
        cells,
        savingColumn,
        savingColumnsConfig,
        selectedDocIds,
        uploadingFilenames = [],
        dragOverFiles = false,
        highlightedCell,
        onSelectionChange,
        onExpand,
        onCitationClick,
        onUpdateColumn,
        onDeleteColumn,
        onAddColumn,
        onAddDocuments,
    },
    ref,
) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sortedColumns = [...columns].sort((a, b) => a.index - b.index);
    const totalContentWidth =
        CHECK_W_PX + DOC_COL_W_PX + sortedColumns.length * DATA_COL_W_PX + 32;

    useImperativeHandle(ref, () => ({
        scrollToCell(colIdx: number, rowIdx: number) {
            const container = scrollContainerRef.current;
            if (!container) return;

            // Vertical: find actual row via DOM (handles variable row heights)
            const allRows = container.querySelectorAll<HTMLElement>(
                ":scope > div.flex.min-w-full",
            );
            const targetRow = allRows[rowIdx];
            if (targetRow) {
                container.scrollTo({
                    top: Math.max(0, targetRow.offsetTop - 40),
                    behavior: "smooth",
                });
            }

            // Horizontal: fixed column widths — center the target column in view
            const targetScrollLeft =
                STICKY_LEFT_PX +
                colIdx * DATA_COL_W_PX -
                container.clientWidth / 2 +
                DATA_COL_W_PX / 2;
            container.scrollLeft = Math.max(0, targetScrollLeft);
        },
    }));

    function getCell(docId: string, colIdx: number) {
        return cells.find(
            (c) => c.document_id === docId && c.column_index === colIdx,
        );
    }

    const allSelected =
        documents.length > 0 &&
        documents.every((d) => selectedDocIds.includes(d.id));
    const someSelected =
        !allSelected && documents.some((d) => selectedDocIds.includes(d.id));

    function toggleAll() {
        if (allSelected) {
            onSelectionChange([]);
        } else {
            onSelectionChange(documents.map((d) => d.id));
        }
    }

    function toggleDoc(id: string) {
        if (selectedDocIds.includes(id)) {
            onSelectionChange(selectedDocIds.filter((x) => x !== id));
        } else {
            onSelectionChange([...selectedDocIds, id]);
        }
    }

    if (loading) {
        return (
            <div className="flex-1 overflow-hidden m-4 md:mx-7 rounded-[14px] border border-border bg-card">
                {/* Header */}
                <div className="flex bg-muted border-b border-border">
                    <div
                        className={`${CHECK_W} border-r border-border p-2`}
                    />
                    <div
                        className={`${COL_W} border-r border-border p-2 kd-label text-muted-foreground`}
                    >
                        Document
                    </div>
                    {Array.from({ length: SKELETON_COLS }).map((_, i) => (
                        <div
                            key={i}
                            className={`${COL_W} border-r border-border p-2`}
                        >
                            <div className="h-4 w-28 rounded bg-muted-foreground/10 animate-pulse" />
                        </div>
                    ))}
                    <div className="flex-1" />
                </div>
                {/* Rows */}
                {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
                    <div
                        key={row}
                        className="flex border-b border-border bg-card"
                    >
                        <div className={`${CHECK_W} p-2`} />
                        <div className={`${COL_W} p-2`}>
                            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                        </div>
                        {Array.from({ length: SKELETON_COLS }).map((_, col) => (
                            <div key={col} className={`${COL_W} p-2`}>
                                <div className="h-4 rounded bg-muted animate-pulse" />
                            </div>
                        ))}
                        <div className="flex-1" />
                    </div>
                ))}
            </div>
        );
    }

    if (
        columns.length === 0 &&
        documents.length === 0 &&
        uploadingFilenames.length === 0
    ) {
        return (
            <div className="flex flex-1 flex-col overflow-hidden m-4 md:mx-7 rounded-[14px] border border-border bg-card">
                <div className="flex items-center bg-muted border-b border-border">
                    <div className={`${CHECK_W} border-r border-border self-stretch`} />
                    <div
                        className={`${COL_W} border-r border-border p-2 kd-label text-muted-foreground select-none`}
                    >
                        Document
                    </div>
                    <div className="flex-1" />
                </div>
                <div className="relative flex min-h-0 flex-1">
                    {dragOverFiles && (
                        <div className="absolute inset-0 z-[90] border-2 border-kd-accent bg-kd-accent/10 pointer-events-none" />
                    )}
                    <div className="flex flex-1 flex-col items-start justify-center w-full max-w-xs mx-auto">
                        <Table2 className="h-8 w-8 text-kd-text-3 mb-4" strokeWidth={1.5} />
                        <p className="font-serif text-[28px] leading-[1.2] tracking-[-0.01em] font-normal text-foreground">
                            Every clause, in its column.
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground text-left">
                            Add columns and documents to get started.
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={onAddColumn}
                                className="inline-flex items-center gap-1 rounded-[10px] bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                            >
                                + Add columns
                            </button>
                            <button
                                onClick={onAddDocuments}
                                className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:border-kd-text-3 transition-colors"
                            >
                                <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Add documents
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex flex-1 flex-col overflow-auto m-4 md:mx-7 rounded-[14px] border border-border bg-card"
            ref={scrollContainerRef}
        >
            {/* Header */}
            <div
                className="sticky top-0 z-20 flex bg-muted h-11"
                style={{ minWidth: totalContentWidth }}
            >
                <div
                    className={`sticky left-0 z-30 ${CHECK_W} bg-muted border-b border-r border-border flex justify-center items-center select-none`}
                >
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAll}
                        className="h-2.5 w-2.5 rounded border-border cursor-pointer accent-kd-accent"
                    />
                </div>
                <div
                    className={`sticky left-8 z-30 ${COL_W} bg-muted border-b border-r border-border p-2 text-left kd-label text-muted-foreground select-none flex items-center`}
                >
                    Document
                </div>
                {columns.map((col) => (
                    <div
                        key={col.index}
                        className={`${COL_W} bg-muted border-b border-r border-border p-2 text-left kd-label text-muted-foreground select-none flex items-center`}
                    >
                        <div className="flex w-full items-center justify-between gap-3">
                            <span className="truncate">{col.name}</span>
                            <TREditColumnMenu
                                column={col}
                                disabled={savingColumn || savingColumnsConfig}
                                onSave={onUpdateColumn}
                                onDelete={onDeleteColumn}
                            />
                        </div>
                    </div>
                ))}
                <div className="flex-1 bg-muted border-b border-border flex items-center justify-start p-2 min-w-8">
                    <button
                        onClick={onAddColumn}
                        disabled={savingColumn || savingColumnsConfig}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-[10px] border border-dashed border-border text-xs font-sans font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground hover:border-kd-text-3 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Add column
                    </button>
                </div>
            </div>

            {/* Rows */}
            <div className="relative min-h-0 flex-1">
                {dragOverFiles && (
                    <div className="absolute inset-0 z-[90] border-2 border-kd-accent bg-kd-accent/10 pointer-events-none" />
                )}
                {uploadingFilenames.map((filename) => (
                    <div
                        key={`uploading-${filename}`}
                        className="flex bg-card"
                        style={{ minWidth: totalContentWidth }}
                    >
                        <div
                            className={`sticky left-0 z-[60] ${CHECK_W} border-b border-r border-border p-2 flex items-center justify-center bg-card`}
                        >
                            <input
                                type="checkbox"
                                disabled
                                className="h-2.5 w-2.5 shrink-0 rounded border-border cursor-default accent-kd-accent disabled:opacity-100"
                            />
                        </div>
                        <div
                            className={`sticky left-8 z-[60] ${COL_W} border-b border-r border-border p-2 text-[13.5px] text-kd-text-3 flex items-center gap-2 bg-card`}
                        >
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" strokeWidth={1.5} />
                            <span className="line-clamp-1" title={filename}>
                                {filename}
                            </span>
                        </div>
                        {sortedColumns.map((col) => (
                            <div
                                key={col.index}
                                className={`${COL_W} border-b border-r border-border p-2`}
                            >
                                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                            </div>
                        ))}
                        <div className="flex-1 border-b border-border min-h-8 min-w-8" />
                    </div>
                ))}
                {documents.map((doc, docIdx) => {
                    const baseRowBg = "bg-card";
                    const rowBg = selectedDocIds.includes(doc.id)
                        ? "bg-muted"
                        : baseRowBg;
                    return (
                        <div
                            key={doc.id}
                            className={`flex ${rowBg} transition-colors`}
                            style={{ minWidth: totalContentWidth }}
                        >
                            <div
                                className={`sticky left-0 z-[60] ${CHECK_W} border-b border-r border-border p-2 flex items-center justify-center ${rowBg}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedDocIds.includes(doc.id)}
                                    onChange={() => toggleDoc(doc.id)}
                                    className="h-2.5 w-2.5 shrink-0 rounded border-border cursor-pointer accent-kd-accent"
                                />
                            </div>
                            <div
                                className={`sticky left-8 z-[60] ${COL_W} border-b border-r border-border p-2 text-[13.5px] text-foreground flex items-center gap-2.5 ${rowBg}`}
                            >
                                <FileText
                                    className="h-[15px] w-[15px] shrink-0 text-kd-text-3"
                                    strokeWidth={1.5}
                                />
                                <span
                                    className="line-clamp-1 font-medium"
                                    title={doc.filename}
                                >
                                    {doc.filename}
                                </span>
                            </div>
                            {columns.map((col) => {
                                const cell = getCell(doc.id, col.index);
                                const colPos = sortedColumns.findIndex(
                                    (c) => c.index === col.index,
                                );
                                const isHighlighted =
                                    highlightedCell?.colIdx === colPos &&
                                    highlightedCell?.rowIdx === docIdx;
                                return (
                                    <div
                                        key={col.index}
                                        className={`${COL_W} border-b border-r border-border transition-colors ${isHighlighted ? "bg-kd-accent/20" : ""}`}
                                    >
                                        {cell && (
                                            <TabularCellComponent
                                                cell={cell}
                                                column={col}
                                                onExpand={() => onExpand(cell)}
                                                onCitationClick={(
                                                    page,
                                                    quote,
                                                ) =>
                                                    onCitationClick(
                                                        cell,
                                                        page,
                                                        quote,
                                                    )
                                                }
                                            />
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex-1 border-b border-border min-h-8 min-w-8" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
