import React from "react";

interface Tab<T extends string> {
    id: T;
    label: string;
}

interface Props<T extends string> {
    tabs: Tab<T>[];
    active: T;
    onChange: (id: T) => void;
    /** Optional content rendered on the right side of the toolbar */
    actions?: React.ReactNode;
}

export function ToolbarTabs<T extends string>({
    tabs,
    active,
    onChange,
    actions,
}: Props<T>) {
    return (
        <div className="flex items-center h-10 px-4 border-b border-border md:px-10">
            <div className="flex-1 flex h-full items-center gap-5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`h-full text-xs transition-colors border-b-2 -mb-px ${
                            active === tab.id
                                ? "font-medium text-foreground border-kd-brass"
                                : "font-normal text-muted-foreground hover:text-foreground border-transparent"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {actions && (
                <div className="flex items-center gap-2">{actions}</div>
            )}
        </div>
    );
}
