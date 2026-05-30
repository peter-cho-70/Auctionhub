"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  applyStorageReclaim,
  getStorageQuotaMessage,
  subscribeStorageQuota,
} from "@/lib/data/compact-storage";
import { useAppStore } from "@/store/app-store";

export function StorageQuotaBanner() {
  const message = useSyncExternalStore(
    subscribeStorageQuota,
    getStorageQuotaMessage,
    () => null,
  );

  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <p>{message}</p>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => {
            const result = applyStorageReclaim(useAppStore.getState().data);
            useAppStore.setState({ data: result.data });
          }}
          className="rounded-md border border-amber-500 bg-white px-3 py-1 font-medium hover:bg-amber-100 dark:border-amber-700 dark:bg-neutral-950 dark:hover:bg-amber-950"
        >
          지금 정리
        </button>
        <Link href="/data" className="font-medium underline">
          데이터 탭 (JSON 백업)
        </Link>
      </p>
    </div>
  );
}
