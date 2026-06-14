import { useAppStore } from "@/store/app-store";
import {
  shouldAutoLoadBundledSeed,
  snapshotBeforeDestructiveChange,
} from "@/lib/data/data-protection";

const SEED_URL = "/seed/app-data.json";

async function fetchBundledSeedJson(): Promise<string | null> {
  try {
    const res = await fetch(SEED_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.text();
    return json.trim() ? json : null;
  } catch (error) {
    console.warn("[seed] bundled app data load failed:", error);
    return null;
  }
}

/** 브라우저에 저장된 물건이 없을 때만 시드 데이터를 자동 불러옵니다. */
export async function loadBundledSeedIfEmpty(): Promise<boolean> {
  const store = useAppStore.getState();
  if (!shouldAutoLoadBundledSeed(store.data.cases.length)) return false;

  const json = await fetchBundledSeedJson();
  if (!json) return false;

  store.importData(json, "replace");
  return useAppStore.getState().data.cases.length > 0;
}

/** 백업 시드(16개 물건)를 수동 복원합니다. */
export async function restoreBundledSeedData(
  mode: "replace" | "merge" = "merge",
): Promise<{ ok: boolean; caseCount: number; error?: string }> {
  const json = await fetchBundledSeedJson();
  if (!json) {
    return { ok: false, caseCount: 0, error: "백업 파일을 불러오지 못했습니다." };
  }

  try {
    const store = useAppStore.getState();
    if (mode === "replace" && store.data.cases.length > 0) {
      snapshotBeforeDestructiveChange(
        store.exportDataJson(),
        "before-seed-restore-replace",
      );
    }
    store.importData(json, mode);
    const count = useAppStore.getState().data.cases.length;
    return { ok: count > 0, caseCount: count };
  } catch (error) {
    return {
      ok: false,
      caseCount: 0,
      error: error instanceof Error ? error.message : "복원에 실패했습니다.",
    };
  }
}
