import { useAppStore } from "@/store/app-store";

const SEED_URL = "/seed/app-data.json";

/** 브라우저에 저장된 물건이 없을 때 저장소에 포함된 시드 데이터를 불러옵니다. */
export async function loadBundledSeedIfEmpty(): Promise<boolean> {
  const store = useAppStore.getState();
  if (store.data.cases.length > 0) return false;

  try {
    const res = await fetch(SEED_URL, { cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.text();
    if (!json.trim()) return false;
    store.importData(json, "replace");
    return useAppStore.getState().data.cases.length > 0;
  } catch (error) {
    console.warn("[seed] bundled app data load failed:", error);
    return false;
  }
}
