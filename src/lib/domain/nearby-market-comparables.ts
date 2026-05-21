import type { AuctionCase, NearbyMarketListing } from "@/lib/types/domain";
import { formatManwon, inferDong } from "@/lib/domain/nearby-market";

/** 대전 등 — 주변 시세 정렬용 인접 동 */
export const ADJACENT_DONGS: Record<string, string[]> = {
  선화동: ["목동", "은행동", "대흥동", "중촌동", "용두동"],
  대흥동: ["선화동", "은행동", "문창동", "대사동", "부사동"],
  은행동: ["선화동", "대흥동", "중앙로"],
  목동: ["선화동", "중촌동", "용두동"],
  중촌동: ["목동", "선화동", "용두동"],
  용두동: ["목동", "선화동", "오류동"],
};

export type MarketScope = "same_dong" | "adjacent" | "all_gu";
export type MarketSortMode = "composite" | "jibun" | "area" | "recent";
export type MarketTradeTab = "sale" | "monthly" | "jeonse";

export type JibunParts = {
  raw: string;
  main: number;
  sub: number;
  isMountain: boolean;
};

export function builtYearFromCase(caseData: AuctionCase): number | null {
  const match = caseData.builtYear.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function dealDateSortValue(item: NearbyMarketListing): number {
  const digits = item.dealDate.replace(/[^\d]/g, "");
  return digits.length >= 6 ? Number(digits.slice(0, 8).padEnd(8, "0")) : 0;
}

function dealYearMonth(item: NearbyMarketListing): number {
  const digits = item.dealDate.replace(/[^\d]/g, "");
  return digits.length >= 6 ? Number(digits.slice(0, 6)) : 0;
}

/** 최근 N개월 거래만 (월세·전세 표시용) */
export function filterListingsByRecencyMonths(
  listings: NearbyMarketListing[],
  months: number,
): NearbyMarketListing[] {
  if (months <= 0) return listings;
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const cutoffYm = cutoff.getFullYear() * 100 + (cutoff.getMonth() + 1);
  return listings.filter((item) => {
    const ym = dealYearMonth(item);
    return ym === 0 || ym >= cutoffYm;
  });
}

export function dongRank(item: NearbyMarketListing, targetDong: string): number {
  if (!targetDong || !item.dong) return 2;
  if (item.dong.includes(targetDong) || targetDong.includes(item.dong)) return 0;
  const adjacent = ADJACENT_DONGS[targetDong] ?? [];
  return adjacent.some((dong) => item.dong.includes(dong) || dong.includes(item.dong))
    ? 1
    : 2;
}

export function listingBuildingSqm(item: NearbyMarketListing): number | null {
  if (item.buildingAreaSqm != null && item.buildingAreaSqm > 0) {
    return item.buildingAreaSqm;
  }
  if (item.areaSqm != null && item.areaSqm > 0) return item.areaSqm;
  return null;
}

export function listingLandSqm(item: NearbyMarketListing): number | null {
  if (item.landAreaSqm != null && item.landAreaSqm > 0) return item.landAreaSqm;
  return null;
}

function areaDiffRatioValues(
  listingSqm: number | null,
  targetAreaSqm: number | null,
): number {
  if (targetAreaSqm == null || targetAreaSqm <= 0 || listingSqm == null) return 9;
  return Math.abs(listingSqm - targetAreaSqm) / targetAreaSqm;
}

/** 면적차 정렬·유사도용 (건물면적 기준) */
export function areaDiffRatio(
  item: NearbyMarketListing,
  targetAreaSqm: number | null,
): number {
  return areaDiffRatioValues(listingBuildingSqm(item), targetAreaSqm);
}

export function landAreaDiffRatio(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): number {
  return areaDiffRatioValues(listingLandSqm(item), caseLandSqm(caseData));
}

export function buildingAreaDiffRatio(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): number {
  return areaDiffRatioValues(
    listingBuildingSqm(item),
    caseBuildingSqm(caseData),
  );
}

export type AreaDiffTone = "larger" | "smaller" | "neutral" | "missing";

export type AreaDiffDisplay = {
  text: string;
  tone: AreaDiffTone;
};

export function formatAreaDiffSqm(
  listingSqm: number | null,
  caseSqm: number | null,
): AreaDiffDisplay {
  if (listingSqm == null || caseSqm == null || caseSqm <= 0) {
    return { text: "-", tone: "missing" };
  }
  const delta = Math.round((listingSqm - caseSqm) * 10) / 10;
  if (Math.abs(delta) < 0.05) {
    return { text: "0㎡", tone: "neutral" };
  }
  return {
    text: delta > 0 ? `+${delta}㎡` : `${delta}㎡`,
    tone: delta > 0 ? "larger" : "smaller",
  };
}

export function formatBuildingAreaDiffSqm(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): AreaDiffDisplay {
  return formatAreaDiffSqm(
    listingBuildingSqm(item),
    caseBuildingSqm(caseData),
  );
}

export function formatLandAreaDiffSqm(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): AreaDiffDisplay {
  return formatAreaDiffSqm(listingLandSqm(item), caseLandSqm(caseData));
}

export function caseBuildingSqm(caseData: AuctionCase): number | null {
  const sqm =
    caseData.rentSetting.grossFloorAreaSqm ?? caseData.buildingAreaSqm;
  return sqm != null && sqm > 0 ? sqm : null;
}

export function caseLandSqm(caseData: AuctionCase): number | null {
  return caseData.landAreaSqm != null && caseData.landAreaSqm > 0
    ? caseData.landAreaSqm
    : null;
}

/** 노후일수록 토지 면적 비중을 높임 (매매 비교용) */
export function landWeightForSaleCompare(caseData: AuctionCase): number {
  const built = builtYearFromCase(caseData);
  if (built == null) return 0.35;
  const age = new Date().getFullYear() - built;
  if (age >= 30) return 0.6;
  if (age >= 20) return 0.5;
  if (age >= 10) return 0.35;
  return 0.25;
}

export function weightedAreaDiffRatio(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): number {
  const landW = landWeightForSaleCompare(caseData);
  const buildingW = 1 - landW;
  const land = landAreaDiffRatio(item, caseData);
  const building = buildingAreaDiffRatio(item, caseData);
  if (land >= 9 && building >= 9) return 9;
  if (land >= 9) return building;
  if (building >= 9) return land;
  return landW * land + buildingW * building;
}

/** @deprecated 내부·레거시 — UI는 formatAreaDiffSqm 사용 */
export function formatAreaDiffPctForTarget(
  item: NearbyMarketListing,
  targetAreaSqm: number | null,
  pick: "building" | "land" = "building",
): string {
  const listingSqm =
    pick === "land" ? listingLandSqm(item) : listingBuildingSqm(item);
  const ratio = areaDiffRatioValues(listingSqm, targetAreaSqm);
  if (ratio >= 9) return "-";
  return `${Math.round(ratio * 100)}%`;
}

export function builtYearDiff(
  item: NearbyMarketListing,
  targetBuiltYear: number | null,
): number {
  if (targetBuiltYear == null || item.buildYear == null) return 99;
  return Math.abs(item.buildYear - targetBuiltYear);
}

export function parseJibunFromText(raw: string): JibunParts | null {
  const text = raw.replace(/\s/g, "");
  if (!text) return null;
  const isMountain = text.startsWith("산");
  const normalized = isMountain ? text.slice(1) : text;
  const match =
    normalized.match(/(\d+)[-~](\d+)/) ?? normalized.match(/^(\d+)$/);
  if (!match) return null;
  const main = Number(match[1]);
  const sub = match[2] != null ? Number(match[2]) : 0;
  if (!Number.isFinite(main)) return null;
  return {
    raw: isMountain ? `산${normalized}` : normalized,
    main,
    sub: Number.isFinite(sub) ? sub : 0,
    isMountain,
  };
}

export function buildJibunLabel(parts: JibunParts | null): string {
  if (!parts) return "";
  const prefix = parts.isMountain ? "산" : "";
  return parts.sub > 0 ? `${prefix}${parts.main}-${parts.sub}` : `${prefix}${parts.main}`;
}

export function resolveListingJibun(item: NearbyMarketListing): JibunParts | null {
  return parseJibunFromText(item.address);
}

export function resolveCaseJibun(caseData: AuctionCase): JibunParts | null {
  return parseJibunFromText(caseData.address);
}

export function jibunDistance(
  a: JibunParts | null,
  b: JibunParts | null,
): number {
  if (!a || !b) return 999_999;
  if (a.isMountain !== b.isMountain) return 999_999;
  return Math.abs(a.main * 10_000 + a.sub - (b.main * 10_000 + b.sub));
}

export function formatJibunDiff(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): string {
  const dist = jibunDistance(resolveListingJibun(item), resolveCaseJibun(caseData));
  if (dist >= 999_999) return "-";
  if (dist === 0) return "동일";
  return `±${dist}`;
}

function matchesTradeTab(item: NearbyMarketListing, tab: MarketTradeTab): boolean {
  if (tab === "sale") {
    return item.tradeType === "매매" && item.dealAmountManwon != null;
  }
  if (tab === "monthly") {
    return (
      (item.tradeType === "월세" || item.tradeType === "전월세") &&
      item.monthlyRentManwon != null &&
      item.monthlyRentManwon > 0
    );
  }
  return (
    item.tradeType === "전세" ||
    (item.depositManwon != null &&
      item.depositManwon > 0 &&
      (item.monthlyRentManwon == null || item.monthlyRentManwon === 0))
  );
}

export function filterByScope(
  listings: NearbyMarketListing[],
  targetDong: string,
  scope: MarketScope,
): NearbyMarketListing[] {
  if (!targetDong.trim()) return listings;
  if (scope === "all_gu") return listings;
  if (scope === "same_dong") {
    return listings.filter((item) => dongRank(item, targetDong) === 0);
  }
  return listings.filter((item) => dongRank(item, targetDong) <= 1);
}

function compareArea(
  a: NearbyMarketListing,
  b: NearbyMarketListing,
  caseData: AuctionCase,
  sortMode: MarketSortMode,
): number {
  if (sortMode === "area") {
    return (
      weightedAreaDiffRatio(a, caseData) - weightedAreaDiffRatio(b, caseData)
    );
  }
  const buildingDelta = buildingAreaDiffRatio(a, caseData) - buildingAreaDiffRatio(b, caseData);
  if (Math.abs(buildingDelta) > 0.01) return buildingDelta;
  return landAreaDiffRatio(a, caseData) - landAreaDiffRatio(b, caseData);
}

export function sortComparableListings(
  listings: NearbyMarketListing[],
  caseData: AuctionCase,
  sortMode: MarketSortMode,
  targetDong: string,
): NearbyMarketListing[] {
  const targetBuiltYear = builtYearFromCase(caseData);
  const targetJibun = resolveCaseJibun(caseData);

  return [...listings].sort((a, b) => {
    if (sortMode === "recent") {
      return dealDateSortValue(b) - dealDateSortValue(a);
    }
    if (sortMode === "area") {
      const areaDelta = compareArea(a, b, caseData, sortMode);
      if (Math.abs(areaDelta) > 0.01) return areaDelta;
      return dealDateSortValue(b) - dealDateSortValue(a);
    }
    if (sortMode === "jibun") {
      const dongDelta = dongRank(a, targetDong) - dongRank(b, targetDong);
      if (dongDelta !== 0) return dongDelta;
      const jibunDelta =
        jibunDistance(resolveListingJibun(a), targetJibun) -
        jibunDistance(resolveListingJibun(b), targetJibun);
      if (jibunDelta !== 0) return jibunDelta;
      const areaDelta = compareArea(a, b, caseData, "composite");
      if (Math.abs(areaDelta) > 0.01) return areaDelta;
      return dealDateSortValue(b) - dealDateSortValue(a);
    }
    const dongDelta = dongRank(a, targetDong) - dongRank(b, targetDong);
    if (dongDelta !== 0) return dongDelta;
    const areaDelta = compareArea(a, b, caseData, "composite");
    if (Math.abs(areaDelta) > 0.01) return areaDelta;
    const yearDelta =
      builtYearDiff(a, targetBuiltYear) - builtYearDiff(b, targetBuiltYear);
    if (yearDelta !== 0) return yearDelta;
    return dealDateSortValue(b) - dealDateSortValue(a);
  });
}

export type RecommendedSaleComparable = {
  item: NearbyMarketListing;
  score: number;
  reasons: string[];
  landDiff: AreaDiffDisplay;
  buildingDiff: AreaDiffDisplay;
};

export function recommendSaleComparables(
  caseData: AuctionCase,
  listings: NearbyMarketListing[],
  options: {
    targetDong: string;
    scope?: MarketScope;
    limit?: number;
  },
): RecommendedSaleComparable[] {
  const { targetDong, scope = "same_dong", limit = 3 } = options;
  const candidates = filterByScope(
    listings.filter(
      (item) => item.tradeType === "매매" && item.dealAmountManwon != null,
    ),
    targetDong,
    scope,
  );
  const targetJibun = resolveCaseJibun(caseData);

  const scored = candidates.map((item) => {
    const reasons: string[] = [];
    const rank = dongRank(item, targetDong);
    if (rank === 0) reasons.push("같은 동");
    else if (rank === 1) reasons.push("인접 동");

    const landR = landAreaDiffRatio(item, caseData);
    const buildingR = buildingAreaDiffRatio(item, caseData);
    if (landR <= 0.2) reasons.push("토지 유사");
    else if (landR <= 0.35) reasons.push("토지 근접");
    if (buildingR <= 0.2) reasons.push("건물 유사");
    else if (buildingR <= 0.35) reasons.push("건물 근접");

    const jibun = resolveListingJibun(item);
    if (jibun && jibunDistance(jibun, targetJibun) === 0) reasons.push("지번 근접");

    const year = builtYearDiff(item, builtYearFromCase(caseData));
    if (year <= 8) reasons.push("연식 근접");

    const score =
      rank * 4 +
      weightedAreaDiffRatio(item, caseData) * 10 +
      Math.min(year, 20) * 0.08 -
      dealDateSortValue(item) * 1e-9;

    return {
      item,
      score,
      reasons,
      landDiff: formatLandAreaDiffSqm(item, caseData),
      buildingDiff: formatBuildingAreaDiffSqm(item, caseData),
    };
  });

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .filter((row) => row.reasons.length > 0 || row.score < 50);
}

export function getComparableListings(
  caseData: AuctionCase,
  listings: NearbyMarketListing[],
  options: {
    targetDong: string;
    scope: MarketScope;
    sortMode: MarketSortMode;
    tradeTab: MarketTradeTab;
    limit?: number;
  },
): NearbyMarketListing[] {
  const { targetDong, scope, sortMode, tradeTab, limit = 20 } = options;
  const filtered = filterByScope(
    listings.filter((item) => matchesTradeTab(item, tradeTab)),
    targetDong,
    scope,
  );
  return sortComparableListings(filtered, caseData, sortMode, targetDong).slice(
    0,
    limit,
  );
}

export function sortMarketListingsForCase(
  listings: NearbyMarketListing[],
  caseData: AuctionCase,
): NearbyMarketListing[] {
  return sortComparableListings(
    listings,
    caseData,
    "composite",
    inferDong(caseData.address),
  );
}

export function similarSaleListingsForCase(
  caseData: AuctionCase,
  listings: NearbyMarketListing[],
  limit = 15,
): NearbyMarketListing[] {
  return getComparableListings(caseData, listings, {
    targetDong: inferDong(caseData.address),
    scope: "same_dong",
    sortMode: "composite",
    tradeTab: "sale",
    limit,
  });
}

export function averageManwon(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

export function medianManwon(values: Array<number | null>): number | null {
  const valid = values
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[mid]!;
  return Math.round((valid[mid - 1]! + valid[mid]!) / 2);
}

export function similarSaleAverageManwon(
  caseData: AuctionCase,
  listings: NearbyMarketListing[],
): number | null {
  const recommended = recommendSaleComparables(caseData, listings, {
    targetDong: inferDong(caseData.address),
    scope: "same_dong",
    limit: 3,
  });
  if (recommended.length > 0) {
    return averageManwon(
      recommended.map((row) => row.item.dealAmountManwon),
    );
  }
  const similar = similarSaleListingsForCase(caseData, listings, 5);
  return averageManwon(similar.map((item) => item.dealAmountManwon));
}

export function manwonToWon(manwon: number | null): number | null {
  return manwon != null && manwon > 0 ? Math.round(manwon * 10000) : null;
}

export function tradeTabStats(
  items: NearbyMarketListing[],
  tab: MarketTradeTab,
): {
  count: number;
  avgPrimary: number | null;
  avgSecondary: number | null;
  medianPrimary: number | null;
} {
  if (tab === "sale") {
    const prices = items.map((i) => i.dealAmountManwon);
    return {
      count: items.length,
      avgPrimary: averageManwon(prices),
      avgSecondary: null,
      medianPrimary: medianManwon(prices),
    };
  }
  if (tab === "monthly") {
    const rents = items.map((i) => i.monthlyRentManwon);
    const deposits = items.map((i) => i.depositManwon);
    return {
      count: items.length,
      avgPrimary: averageManwon(rents),
      avgSecondary: averageManwon(deposits),
      medianPrimary: medianManwon(rents),
    };
  }
  const deposits = items.map((i) => i.depositManwon);
  return {
    count: items.length,
    avgPrimary: averageManwon(deposits),
    avgSecondary: null,
    medianPrimary: medianManwon(deposits),
  };
}

export function collectDongOptions(
  listings: NearbyMarketListing[],
  preferredDong: string,
): string[] {
  const set = new Set<string>();
  if (preferredDong) set.add(preferredDong);
  for (const item of listings) {
    if (item.dong.trim()) set.add(item.dong.trim());
  }
  return [...set].sort((a, b) => {
    if (a === preferredDong) return -1;
    if (b === preferredDong) return 1;
    return a.localeCompare(b, "ko");
  });
}

export type SaleComparableBadge = {
  label: string;
  tone: "good" | "neutral" | "muted";
};

export function saleComparableBadges(
  item: NearbyMarketListing,
  caseData: AuctionCase,
  targetDong: string,
): SaleComparableBadge[] {
  const badges: SaleComparableBadge[] = [];
  const rank = dongRank(item, targetDong);
  if (rank === 0) badges.push({ label: "같은 동", tone: "good" });
  else if (rank === 1) badges.push({ label: "인접 동", tone: "neutral" });

  const land = landAreaDiffRatio(item, caseData);
  if (land <= 0.15) badges.push({ label: "토지 유사", tone: "good" });
  else if (land <= 0.3) badges.push({ label: "토지 근접", tone: "neutral" });

  const building = buildingAreaDiffRatio(item, caseData);
  if (building <= 0.15) badges.push({ label: "건물 유사", tone: "good" });
  else if (building <= 0.3) badges.push({ label: "건물 근접", tone: "neutral" });

  const year = builtYearDiff(item, builtYearFromCase(caseData));
  if (year <= 5) badges.push({ label: "연식 유사", tone: "good" });
  else if (year <= 10) badges.push({ label: "연식 근접", tone: "neutral" });

  const jibun = resolveListingJibun(item);
  if (jibun) {
    const dist = jibunDistance(jibun, resolveCaseJibun(caseData));
    if (dist === 0) badges.push({ label: "지번 근접", tone: "good" });
  }

  if (dealDateSortValue(item) > 0) {
    const digits = item.dealDate.replace(/[^\d]/g, "").slice(0, 6);
    if (digits) badges.push({ label: digits, tone: "muted" });
  }

  return badges;
}

/** @deprecated */
export function formatAreaDiffPct(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): string {
  return formatBuildingAreaDiffSqm(item, caseData).text;
}

/** @deprecated */
export function formatLandAreaDiffPct(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): string {
  return formatLandAreaDiffSqm(item, caseData).text;
}

export function formatYearDiff(
  item: NearbyMarketListing,
  caseData: AuctionCase,
): string {
  const diff = builtYearDiff(item, builtYearFromCase(caseData));
  return diff >= 99 ? "-" : `${diff}년`;
}

export { formatManwon, inferDong };
