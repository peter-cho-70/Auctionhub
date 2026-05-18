import { safeParseAppDataJson } from "@/lib/data/migrate";

const SNAPSHOT_KEY = "auctionflow:v1:snapshots";

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
      ? previous.filter(
          (item): item is AppDataSnapshot =>
            item != null &&
            typeof item === "object" &&
            typeof (item as AppDataSnapshot).id === "string" &&
            typeof (item as AppDataSnapshot).json === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function saveLocalDataSnapshot(json: string, reason: string): void {
  if (!canUseStorage()) return;
  const parsed = safeParseAppDataJson(json);
  if (parsed instanceof Error) return;

  const next: AppDataSnapshot[] = [
    {
      id: `${Date.now()}`,
      reason,
      createdAt: new Date().toISOString(),
      caseCount: parsed.cases.length,
      json,
    },
  ];

  try {
    window.localStorage.removeItem(SNAPSHOT_KEY);
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  } catch (error) {
    window.localStorage.removeItem(SNAPSHOT_KEY);
    console.warn("[Local snapshot] 저장 용량 초과로 스냅샷을 보관하지 못했습니다.", error);
  }
}
