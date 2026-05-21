"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  appDataCaseCount,
  saveLocalDataSnapshot,
} from "@/lib/data/client-backup";
import { useAppStore } from "@/store/app-store";

/** 편집 후 일정 시간 지나면 로컬 스냅샷(최대 2개)에 자동 반영 */
const DEBOUNCE_MS = 90_000;

export function LocalDataAutosnapshot() {
  const data = useAppStore((s) => s.data);
  const hasHydrated = useAppStore((s) => s._hasHydrated);
  const lastSavedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (hasHydrated) {
      lastSavedRef.current = useAppStore.getState().exportDataJson();
    }
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;

    const json = JSON.stringify(data);
    if (json === lastSavedRef.current) return;
    if (appDataCaseCount(json) === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      saveLocalDataSnapshot(json, "periodic-autosave");
      lastSavedRef.current = json;
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, hasHydrated]);

  return null;
}
