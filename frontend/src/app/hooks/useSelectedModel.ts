"use client";

import { useCallback, useEffect, useState } from "react";
import { ALLOWED_MODEL_IDS, DEFAULT_MODEL_ID } from "../components/assistant/ModelToggle";

const STORAGE_KEY = "kd.selectedModel";

function readStored(): string {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        raw = window.localStorage.getItem("mike.selectedModel");
        if (raw) {
            window.localStorage.setItem(STORAGE_KEY, raw);
            window.localStorage.removeItem("mike.selectedModel");
        }
    }
    if (raw && ALLOWED_MODEL_IDS.has(raw)) return raw;
    return DEFAULT_MODEL_ID;
}

export function useSelectedModel(): [string, (id: string) => void] {
    const [model, setModelState] = useState<string>(DEFAULT_MODEL_ID);

    useEffect(() => {
        setModelState(readStored());
    }, []);

    const setModel = useCallback((id: string) => {
        const next = ALLOWED_MODEL_IDS.has(id) ? id : DEFAULT_MODEL_ID;
        setModelState(next);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    return [model, setModel];
}
