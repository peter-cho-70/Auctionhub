import { DEFAULT_REMODELING_PRICE_CATALOG } from "@/lib/domain/remodeling-catalog-daejeon";
import type {
  RemodelingCatalogItem,
  RemodelingCostLine,
  RemodelingPriceCatalog,
  RemodelingRoomUnitType,
  RemodelingScenarioTier,
  RemodelingWorkScope,
} from "@/lib/types/domain";

const SCENARIO_TIERS: RemodelingScenarioTier[] = ["minimal", "balanced", "full"];
const WORK_SCOPES: RemodelingWorkScope[] = ["reuse", "partial", "full_replace"];

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeWorkScope(raw: unknown): RemodelingWorkScope {
  return typeof raw === "string" && (WORK_SCOPES as string[]).includes(raw)
    ? (raw as RemodelingWorkScope)
    : "partial";
}

function normalizeScenarioTiers(raw: unknown): RemodelingScenarioTier[] {
  if (!Array.isArray(raw)) return ["minimal"];
  const out = raw.filter(
    (t): t is RemodelingScenarioTier =>
      typeof t === "string" && (SCENARIO_TIERS as string[]).includes(t),
  );
  return out.length > 0 ? out : ["minimal"];
}

function normalizeRentUplift(raw: unknown): RemodelingCatalogItem["rentUpliftManwon"] {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (k: string) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) ? Math.round(Math.max(0, v)) : 0;
  };
  return {
    oneRoom: num("oneRoom"),
    oneHalfRoom: num("oneHalfRoom"),
    twoRoom: num("twoRoom"),
  };
}

export function normalizeCatalogItem(raw: unknown): RemodelingCatalogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const item = typeof o.item === "string" ? o.item.trim() : "";
  if (!item) return null;
  const key =
    typeof o.key === "string" && o.key.trim() ? o.key.trim() : newId();
  return {
    key,
    category: typeof o.category === "string" ? o.category.trim() || "기타" : "기타",
    item,
    workScope: normalizeWorkScope(o.workScope),
    materialManwon:
      typeof o.materialManwon === "number" && Number.isFinite(o.materialManwon)
        ? Math.round(Math.max(0, o.materialManwon))
        : 0,
    laborManwon:
      typeof o.laborManwon === "number" && Number.isFinite(o.laborManwon)
        ? Math.round(Math.max(0, o.laborManwon))
        : 0,
    diy: o.diy === true,
    effectNote: typeof o.effectNote === "string" ? o.effectNote : "",
    scenarioTiers: normalizeScenarioTiers(o.scenarioTiers),
    rentUpliftManwon: normalizeRentUplift(o.rentUpliftManwon),
    efficiencyScore:
      typeof o.efficiencyScore === "number" && Number.isFinite(o.efficiencyScore)
        ? Math.max(0, Math.min(10, o.efficiencyScore))
        : 0,
  };
}

export function normalizeRemodelingPriceCatalog(raw: unknown): RemodelingPriceCatalog {
  const base = structuredClone(DEFAULT_REMODELING_PRICE_CATALOG);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? o.items
        .map((item) => normalizeCatalogItem(item))
        .filter((item): item is RemodelingCatalogItem => item != null)
    : base.items;
  return {
    regionId:
      typeof o.regionId === "string" && o.regionId.trim()
        ? o.regionId.trim()
        : base.regionId,
    regionLabel:
      typeof o.regionLabel === "string" && o.regionLabel.trim()
        ? o.regionLabel.trim()
        : base.regionLabel,
    sourceNote: typeof o.sourceNote === "string" ? o.sourceNote : base.sourceNote,
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.trim()
        ? o.updatedAt.trim()
        : base.updatedAt,
    items: items.length > 0 ? items : base.items,
  };
}

export function costLineFromCatalogItem(
  catalogItem: RemodelingCatalogItem,
  selected = false,
): RemodelingCostLine {
  const uplift =
    catalogItem.rentUpliftManwon.oneRoom ||
    catalogItem.rentUpliftManwon.oneHalfRoom ||
    catalogItem.rentUpliftManwon.twoRoom;
  return {
    id: newId(),
    catalogKey: catalogItem.key,
    item: catalogItem.item,
    materialManwon: catalogItem.materialManwon,
    laborManwon: catalogItem.laborManwon,
    selected,
    diy: catalogItem.diy,
    workScope: catalogItem.workScope,
    effectNote: catalogItem.effectNote,
    rentUpliftManwon: uplift > 0 ? uplift : null,
  };
}

export function rentUpliftForRoomType(
  catalogItem: RemodelingCatalogItem,
  roomType: RemodelingRoomUnitType,
): number {
  const u = catalogItem.rentUpliftManwon;
  if (roomType === "one_half_room") return u.oneHalfRoom;
  if (roomType === "two_room") return u.twoRoom;
  if (roomType === "one_room") return u.oneRoom;
  return Math.max(u.oneRoom, u.oneHalfRoom, u.twoRoom);
}

export function catalogItemsForScenario(
  catalog: RemodelingPriceCatalog,
  tier: RemodelingScenarioTier,
  options?: { buildingOnly?: boolean },
): RemodelingCatalogItem[] {
  return catalog.items.filter((item) => {
    if (!item.scenarioTiers.includes(tier)) return false;
    const isBuilding = item.category.includes("건물");
    if (options?.buildingOnly) return isBuilding;
    if (options?.buildingOnly === false) return !isBuilding;
    return true;
  });
}

export function createEmptyCatalogItem(): RemodelingCatalogItem {
  return {
    key: newId(),
    category: "기타",
    item: "",
    workScope: "partial",
    materialManwon: 0,
    laborManwon: 0,
    diy: false,
    effectNote: "",
    scenarioTiers: ["minimal", "balanced", "full"],
    rentUpliftManwon: { oneRoom: 0, oneHalfRoom: 0, twoRoom: 0 },
    efficiencyScore: 0,
  };
}

export const SCENARIO_TIER_LABEL: Record<RemodelingScenarioTier, string> = {
  minimal: "최소 (고효율)",
  balanced: "균형",
  full: "전면",
};

export const WORK_SCOPE_LABEL: Record<RemodelingWorkScope, string> = {
  reuse: "유지·점검",
  partial: "부분",
  full_replace: "전면 교체",
};

export const ROOM_UNIT_TYPE_LABEL: Record<RemodelingRoomUnitType, string> = {
  one_room: "원룸",
  one_half_room: "1.5룸",
  two_room: "투룸+",
  owner: "주인세대",
  unknown: "미분류",
};
