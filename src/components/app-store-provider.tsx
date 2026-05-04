"use client";

import { useEffect, useState } from "react";
import {
  loadAppStateAction,
  saveAppStateAction,
} from "@/app/actions/app-state";
import { SupabaseAutosave } from "@/components/supabase-autosave";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useAppStore } from "@/store/app-store";

export function AppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await useAppStore.persist.rehydrate();
      useAppStore.setState({ _hasHydrated: true });

      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            const remote = await loadAppStateAction();
            if (remote.error) {
              console.warn("[Supabase]", remote.error);
            } else if (remote.json) {
              useAppStore.getState().importData(remote.json, "replace");
            } else {
              const { error: upErr } = await saveAppStateAction(
                useAppStore.getState().exportDataJson(),
              );
              if (upErr) {
                console.warn("[Supabase] 초기 업로드:", upErr);
              }
            }
          }
        } catch (e) {
          console.warn("[Supabase] 동기화 스킵:", e);
        }
      }

      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">
        데이터 불러오는 중…
      </div>
    );
  }

  return (
    <>
      {children}
      <SupabaseAutosave />
    </>
  );
}
