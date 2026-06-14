"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  getStorageQuotaMessage,
  subscribeStorageQuota,
} from "@/lib/data/compact-storage";

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
      <p className="mt-2 text-xs">
        <Link href="/data" className="font-medium underline">
          데이터 탭
        </Link>
        에서 JSON 백업·저장 공간 정리를 진행하세요.
      </p>
    </div>
  );
}
