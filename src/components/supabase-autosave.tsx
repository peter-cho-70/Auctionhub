"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { saveAppStateAction } from "@/app/actions/app-state";
import { appDataCaseCount } from "@/lib/data/client-backup";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/store/app-store";

const DEBOUNCE_MS = 2000;

export function SupabaseAutosave() {
  const data = useAppStore((s) => s.data);
  const lastSyncedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    lastSyncedRef.current = useAppStore.getState().exportDataJson();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const json = JSON.stringify(data);
    if (json === lastSyncedRef.current) return;
    if (appDataCaseCount(json) === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) return;

          const { error } = await saveAppStateAction(json);
          if (!error) {
            lastSyncedRef.current = json;
          }
        } catch {
          /* ignore */
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data]);

  return null;
}
