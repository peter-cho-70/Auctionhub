"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";

export function AppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.resolve(useAppStore.persist.rehydrate()).then(() => {
      useAppStore.setState({ _hasHydrated: true });
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">
        데이터 불러오는 중…
      </div>
    );
  }

  return children;
}
