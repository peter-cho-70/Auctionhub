import { compactAppDataJsonForStorage } from "@/lib/data/compact-storage";
import { safeParseAppDataJson } from "@/lib/data/migrate";

import { SNAPSHOT_STORAGE_KEY } from "@/lib/data/storage";

const SNAPSHOT_KEY = SNAPSHOT_STORAGE_KEY;

/** 로컬 스토리지 용량을 위해 최근 스냅샷만 유지 */
export const MAX_LOCAL_DATA_SNAPSHOTS = 2;

type AppDataSnapshot = {
  id: string;
  reason: string;
  createdAt: string;
  caseCount: number;
  json: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function appDataCaseCount(json: string): number {
  const parsed = safeParseAppDataJson(json);
  return parsed instanceof Error ? 0 : parsed.cases.length;
}

export function listLocalDataSnapshots(): AppDataSnapshot[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return [];
  try {
    const previous = JSON.parse(raw) as unknown;
    return Array.isArray(previous)
      ? previous
          .filter(
            (item): item is AppDataSnapshot =>
              item != null &&
              typeof item === "object" &&
              typeof (item as AppDataSnapshot).id === "string" &&
              typeof (item as AppDataSnapshot).json === "string",
          )
          .slice(0, MAX_LOCAL_DATA_SNAPSHOTS)
      : [];
  } catch {
    return [];
  }
}

function createSnapshotEntry(json: string, reason: string, caseCount: number): AppDataSnapshot {
  return {
    id: `${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    caseCount,
    json,
  };
}

function tryPersistSnapshots(snapshots: AppDataSnapshot[]): boolean {
  try {
    window.localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify(snapshots.slice(0, MAX_LOCAL_DATA_SNAPSHOTS)),
    );
    return true;
  } catch {
    return false;
  }
}

export function saveLocalDataSnapshot(json: string, reason: string): void {
  if (!canUseStorage()) return;
  const parsed = safeParseAppDataJson(json);
  if (parsed instanceof Error) return;

  const compactJson = compactAppDataJsonForStorage(json);
  const entry = createSnapshotEntry(compactJson, reason, parsed.cases.length);
  const previous = listLocalDataSnapshots();
  const candidates: AppDataSnapshot[] = [entry, ...previous].slice(
    0,
    MAX_LOCAL_DATA_SNAPSHOTS,
  );

  if (tryPersistSnapshots(candidates)) return;

  // 용량 초과: 오래된 항목부터 줄이며 재시도 (기존 스냅샷 전체 삭제하지 않음)
  let trimmed = [...candidates];
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, -1);
    if (tryPersistSnapshots(trimmed)) {
      console.warn(
        "[Local snapshot] 용량 제한으로 일부 스냅샷만 보관했습니다.",
        reason,
      );
      return;
    }
  }

  if (trimmed.length === 1 && tryPersistSnapshots(trimmed)) {
    console.warn("[Local snapshot] 최신 1개만 보관했습니다.", reason);
    return;
  }

  if (previous.length > 0 && tryPersistSnapshots(previous)) {
    console.warn(
      "[Local snapshot] 새 스냅샷 저장에 실패했습니다. 기존 스냅샷은 그대로 두었습니다.",
      reason,
    );
    return;
  }

  console.warn(
    "[Local snapshot] 저장 용량 초과로 스냅샷을 보관하지 못했습니다. JSON보내기로 백업하세요.",
    reason,
  );
}
