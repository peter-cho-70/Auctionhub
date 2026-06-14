import {
  appDataCaseCount,
  listLocalDataSnapshots,
  saveLocalDataSnapshot,
} from "@/lib/data/client-backup";
import { STORAGE_KEY } from "@/lib/data/storage";

export const HAD_USER_DATA_KEY = "auctionflow:had-user-data";
export const LAST_CASE_COUNT_KEY = "auctionflow:last-case-count";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 사용자가 한 번이라도 물건을 저장했는지 기록 */
export function markUserDataPresence(caseCount: number): void {
  if (!canUseStorage() || caseCount <= 0) return;
  try {
    localStorage.setItem(HAD_USER_DATA_KEY, "1");
    localStorage.setItem(LAST_CASE_COUNT_KEY, String(caseCount));
  } catch {
    /* ignore */
  }
}

export function hadUserDataBefore(): boolean {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(HAD_USER_DATA_KEY) === "1";
  } catch {
    return false;
  }
}

export function getLastKnownCaseCount(): number {
  if (!canUseStorage()) return 0;
  try {
    const raw = localStorage.getItem(LAST_CASE_COUNT_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function hasRecoverableLocalSnapshots(): boolean {
  return listLocalDataSnapshots().some((s) => s.caseCount > 0);
}

/** 빈 목록일 때 시드 데이터를 자동으로 넣을지 여부 */
export function shouldAutoLoadBundledSeed(currentCaseCount: number): boolean {
  if (currentCaseCount > 0) return false;
  if (hadUserDataBefore()) return false;
  if (hasRecoverableLocalSnapshots()) return false;
  return true;
}

/** 파괴적 변경 전 현재 데이터를 로컬 스냅샷에 보관 */
export function snapshotBeforeDestructiveChange(
  exportJson: string,
  reason: string,
): void {
  if (appDataCaseCount(exportJson) === 0) return;
  saveLocalDataSnapshot(exportJson, reason, { preserveFull: true });
}

/** 앱 기동·용량 정리 전 localStorage 원본이 있으면 스냅샷 */
export function snapshotPersistedStorageBeforeMaintenance(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: { data?: { cases?: unknown[] } } };
    const cases = parsed.state?.data?.cases;
    if (!Array.isArray(cases) || cases.length === 0) return;
    const data = parsed.state?.data;
    if (!data) return;
    saveLocalDataSnapshot(JSON.stringify(data), "before-startup-maintenance", {
      preserveFull: true,
    });
    markUserDataPresence(cases.length);
  } catch {
    /* ignore */
  }
}
