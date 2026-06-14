"use client";

import { useEffect } from "react";
import { markUserDataPresence } from "@/lib/data/data-protection";
import { saveLocalDataSnapshot } from "@/lib/data/client-backup";
import { useAppStore } from "@/store/app-store";

/** 물건 수 추적 + 탭 종료 직전 스냅샷 */
export function DataProtectionTracker() {
  const caseCount = useAppStore((s) => s.data.cases.length);
  const hasHydrated = useAppStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    markUserDataPresence(caseCount);
  }, [caseCount, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;

    const onPageHide = () => {
      if (useAppStore.getState().data.cases.length === 0) return;
      saveLocalDataSnapshot(
        useAppStore.getState().exportDataJson(),
        "pagehide-autosave",
        { preserveFull: true },
      );
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [hasHydrated]);

  return null;
}
