"use client";

import { useEffect, useState } from "react";
import {
  loadAppStateAction,
  saveAppStateAction,
} from "@/app/actions/app-state";
import { LocalDataAutosnapshot } from "@/components/local-data-autosnapshot";
import { SupabaseAutosave } from "@/components/supabase-autosave";
import { saveLocalDataSnapshot } from "@/lib/data/client-backup";
import { loadBundledSeedIfEmpty } from "@/lib/data/seed-bootstrap";
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
              const store = useAppStore.getState();
              saveLocalDataSnapshot(store.exportDataJson(), "before-cloud-startup-merge");
              store.importData(remote.json, "merge");
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

      await loadBundledSeedIfEmpty();

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
      <LocalDataAutosnapshot />
      <SupabaseAutosave />
    </>
  );
}
