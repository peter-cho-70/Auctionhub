import type {
  AuctionBidAnalysis,
  AuctionBidAnalysisResult,
  AuctionCase,
  AuctionCompareAnchor,
  AuctionSaleComparable,
  AuctionSaleSellerType,
  NearbyMarketListing,
  RoomShape,
} from "@/lib/types/domain";
import { ROOM_SHAPE_OPTIONS } from "@/lib/types/domain";
import { coordsFromJusoEnt } from "@/lib/map/coords-from-meta";
import {
  builtYearFromCase,
  inferDong,
  listingBuildingSqm,
  manwonToWon,
  similarSaleAverageManwon,
} from "@/lib/domain/nearby-market-comparables";

/** 이 물건에 붙는 매각 사례 상한 */
export const MAX_AUCTION_SALE_COMPARABLES = 50;
/** PDF 한 번에 추가 가능한 파일 수 */
export const MAX_PDF_COMPARABLES_PER_BATCH = 5;

const SELLER_TYPES: AuctionSaleSellerType[] = [
  "private",
  "lh",
  "sh",
  "trust",
  "unknown",
];

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `asc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseUseApprovalDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = raw.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;
  const kr = t.match(/(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (kr) {
    const y = kr[1];
    const m = kr[2]!.padStart(2, "0");
    const d = kr[3]!.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const yOnly = t.match(/(19|20)\d{2}/);
  if (yOnly) return `${yOnly[0]}-01-01`;
  return null;
}

export function approvalYear(iso: string | null): number | null {
  if (!iso) return null;
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function subjectUseApprovalDate(c: AuctionCase): string | null {
  return (
    c.auctionBidAnalysis?.useApprovalDate ??
    parseUseApprovalDate(c.builtYear) ??
    null
  );
}

export function emptyAuctionCompareAnchor(): AuctionCompareAnchor {
  return { lat: null, lng: null, radiusM: 1000, source: "address" };
}

export function emptyAuctionBidAnalysis(): AuctionBidAnalysis {
  return {
    anchor: emptyAuctionCompareAnchor(),
    useApprovalDate: null,
    ageAdjustPctPerYear: 0.5,
    wizardStep: 1,
    lastResult: null,
  };
}

function normalizeSellerType(raw: unknown): AuctionSaleSellerType {
  return typeof raw === "string" &&
    (SELLER_TYPES as string[]).includes(raw)
    ? (raw as AuctionSaleSellerType)
    : "unknown";
}

function normalizeMoney(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw);
}

function normalizeArea(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

function normalizeRate(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.round(raw * 100) / 100;
}

export function normalizeAuctionSaleComparable(
  raw: unknown,
): AuctionSaleComparable | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const address = typeof o.address === "string" ? o.address : "";
  const caseNumber =
    typeof o.caseNumber === "string" ? o.caseNumber.trim() : "";
  if (!address.trim() && !caseNumber) return null;
  const t = nowIso();
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId();
  const appraisal = normalizeMoney(o.appraisalPrice);
  let winning = normalizeMoney(o.winningBidPrice);
  let rate = normalizeRate(o.bidRatePct);
  if (rate == null && winning != null && appraisal != null && appraisal > 0) {
    rate = Math.round((winning / appraisal) * 10000) / 100;
  }
  if (winning == null && rate != null && appraisal != null && appraisal > 0) {
    winning = Math.round(appraisal * (rate / 100));
  }
  return {
    id,
    caseNumber,
    address,
    dong: typeof o.dong === "string" ? o.dong : "",
    lat: typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null,
    lng: typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null,
    useApprovalDate: parseUseApprovalDate(o.useApprovalDate),
    landAreaSqm: normalizeArea(o.landAreaSqm),
    buildingAreaSqm: normalizeArea(o.buildingAreaSqm),
    roomShapeSummary:
      typeof o.roomShapeSummary === "string" ? o.roomShapeSummary : "",
    parkingCount:
      typeof o.parkingCount === "number" && o.parkingCount >= 0
        ? Math.floor(o.parkingCount)
        : null,
    isMultifamily: o.isMultifamily === true,
    hasNeighborhoodCommercial: o.hasNeighborhoodCommercial === true,
    appraisalPrice: appraisal,
    winningBidPrice: winning,
    bidRatePct: rate,
    soldRound:
      typeof o.soldRound === "number" && o.soldRound >= 1
        ? Math.floor(o.soldRound)
        : null,
    sellerType: normalizeSellerType(o.sellerType),
    bidDate: typeof o.bidDate === "string" ? o.bidDate : "",
    memo: typeof o.memo === "string" ? o.memo : "",
    sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : "",
    isOngoing: o.isOngoing === true,
    bidderCount:
      typeof o.bidderCount === "number" && o.bidderCount >= 0
        ? Math.floor(o.bidderCount)
        : null,
    failedRoundCount:
      typeof o.failedRoundCount === "number" && o.failedRoundCount >= 0
        ? Math.floor(o.failedRoundCount)
        : null,
    sourceExtractedText:
      typeof o.sourceExtractedText === "string"
        ? o.sourceExtractedText.slice(0, 16_000)
        : undefined,
    createdAt:
      typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt : t,
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt : t,
  };
}

export function normalizeAuctionSaleComparableList(
  raw: unknown,
): AuctionSaleComparable[] {
  if (!Array.isArray(raw)) return [];
  const out: AuctionSaleComparable[] = [];
  for (const item of raw) {
    const n = normalizeAuctionSaleComparable(item);
    if (n) out.push(n);
  }
  return out.slice(0, MAX_AUCTION_SALE_COMPARABLES);
}

export function normalizeAuctionBidAnalysis(raw: unknown): AuctionBidAnalysis {
  const base = emptyAuctionBidAnalysis();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const anchorRaw = o.anchor as Record<string, unknown> | undefined;
  const anchor: AuctionCompareAnchor = {
    lat:
      anchorRaw && typeof anchorRaw.lat === "number"
        ? anchorRaw.lat
        : base.anchor.lat,
    lng:
      anchorRaw && typeof anchorRaw.lng === "number"
        ? anchorRaw.lng
        : base.anchor.lng,
    radiusM:
      anchorRaw &&
      typeof anchorRaw.radiusM === "number" &&
      anchorRaw.radiusM >= 100
        ? Math.min(5000, Math.round(anchorRaw.radiusM))
        : base.anchor.radiusM,
    source:
      anchorRaw?.source === "map_pick" ||
      anchorRaw?.source === "market" ||
      anchorRaw?.source === "address"
        ? anchorRaw.source
        : base.anchor.source,
  };
  const step = o.wizardStep;
  const wizardStep =
    step === 1 || step === 2 || step === 3 || step === 4 || step === 5
      ? step
      : base.wizardStep;
  const lastRaw = o.lastResult;
  let lastResult: AuctionBidAnalysis["lastResult"] = null;
  if (lastRaw && typeof lastRaw === "object") {
    const lr = lastRaw as Record<string, unknown>;
    lastResult = {
      peerCount: typeof lr.peerCount === "number" ? lr.peerCount : 0,
      auctionMedianBidRatePct: normalizeRate(lr.auctionMedianBidRatePct),
      auctionAdjustedBidRatePct: normalizeRate(lr.auctionAdjustedBidRatePct),
      marketSaleWon: normalizeMoney(lr.marketSaleWon),
      marketImpliedBidRatePct: normalizeRate(lr.marketImpliedBidRatePct),
      landFloorWon: normalizeMoney(lr.landFloorWon),
      landFloorBidRatePct: normalizeRate(lr.landFloorBidRatePct),
      suggestedBidWon: normalizeMoney(lr.suggestedBidWon),
      suggestedBidRatePct: normalizeRate(lr.suggestedBidRatePct),
      rangeLowWon: normalizeMoney(lr.rangeLowWon),
      rangeHighWon: normalizeMoney(lr.rangeHighWon),
      narrative: typeof lr.narrative === "string" ? lr.narrative : "",
      computedAt:
        typeof lr.computedAt === "string" ? lr.computedAt : nowIso(),
    };
  }

  return {
    anchor,
    useApprovalDate: parseUseApprovalDate(o.useApprovalDate),
    ageAdjustPctPerYear:
      typeof o.ageAdjustPctPerYear === "number" &&
      Number.isFinite(o.ageAdjustPctPerYear)
        ? Math.min(3, Math.max(0, o.ageAdjustPctPerYear))
        : base.ageAdjustPctPerYear,
    wizardStep,
    lastResult,
  };
}

export function createAuctionSaleComparable(
  partial?: Partial<AuctionSaleComparable>,
): AuctionSaleComparable {
  const t = nowIso();
  return {
    id: newId(),
    caseNumber: "",
    address: "",
    dong: "",
    lat: null,
    lng: null,
    useApprovalDate: null,
    landAreaSqm: null,
    buildingAreaSqm: null,
    roomShapeSummary: "",
    parkingCount: null,
    isMultifamily: true,
    hasNeighborhoodCommercial: false,
    appraisalPrice: null,
    winningBidPrice: null,
    bidRatePct: null,
    soldRound: null,
    sellerType: "unknown",
    bidDate: "",
    memo: "",
    sourceUrl: "",
    isOngoing: false,
    bidderCount: null,
    failedRoundCount: null,
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

export function formatRoomShapeSummary(
  mix: Record<RoomShape, number> | undefined,
): string {
  if (!mix) return "";
  return ROOM_SHAPE_OPTIONS.filter((k) => (mix[k] ?? 0) > 0)
    .map((k) => `${k}×${mix[k]}`)
    .join(", ");
}

export function resolveCaseAnchor(caseData: AuctionCase): AuctionCompareAnchor {
  const stored = caseData.auctionBidAnalysis?.anchor;
  if (stored?.lat != null && stored?.lng != null) return stored;
  const meta = caseData.addressMeta;
  const fromMeta = coordsFromJusoEnt(meta?.entX, meta?.entY);
  if (fromMeta) {
    return {
      lat: fromMeta.lat,
      lng: fromMeta.lng,
      radiusM: stored?.radiusM ?? 1000,
      source: "address",
    };
  }
  const m = caseData.nearbyMarketAnalysis;
  if (m?.lat != null && m?.lng != null) {
    return {
      lat: m.lat,
      lng: m.lng,
      radiusM: stored?.radiusM ?? 1000,
      source: "market",
    };
  }
  return stored ?? emptyAuctionCompareAnchor();
}

/** Haversine 거리 (m) */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type ComparableTier = "core" | "reference" | "excluded";

export type ScoredAuctionComparable = {
  item: AuctionSaleComparable;
  distanceM: number | null;
  approvalDiffYears: number | null;
  similarityScore: number;
  tier: ComparableTier;
  reasons: string[];
};

function areaDiffRatio(
  listing: number | null,
  target: number | null,
): number {
  if (listing == null || target == null || target <= 0) return 9;
  return Math.abs(listing - target) / target;
}

function subjectFlags(caseData: AuctionCase): {
  isMultifamily: boolean;
  hasCommercial: boolean;
} {
  const commercial =
    (caseData.commercialUnitCount ?? 0) > 0 ||
    (caseData.buildingUnitComposition ?? []).some(
      (u) => u.useType === "commercial",
    );
  const multi =
    caseData.propertyType.includes("다가구") ||
    caseData.propertyType.includes("근린") ||
    (caseData.householdCount ?? 0) > 1;
  return {
    isMultifamily: multi || !commercial,
    hasCommercial: commercial,
  };
}

export function scoreAuctionComparable(
  caseData: AuctionCase,
  item: AuctionSaleComparable,
  anchor: AuctionCompareAnchor,
): ScoredAuctionComparable {
  const reasons: string[] = [];
  let score = 100;
  const subjectApproval = subjectUseApprovalDate(caseData);
  const itemApproval = item.useApprovalDate;
  const approvalDiff =
    subjectApproval && itemApproval
      ? Math.abs(
          (approvalYear(subjectApproval) ?? 0) -
            (approvalYear(itemApproval) ?? 0),
        )
      : null;

  let distanceM: number | null = null;
  if (
    anchor.lat != null &&
    anchor.lng != null &&
    item.lat != null &&
    item.lng != null
  ) {
    distanceM = Math.round(
      distanceMeters(anchor.lat, anchor.lng, item.lat, item.lng),
    );
    if (distanceM > anchor.radiusM) {
      score -= 40;
      reasons.push(`반경 밖 ${distanceM}m`);
    } else if (distanceM <= 200) {
      score += 5;
      reasons.push(`${distanceM}m`);
    } else if (distanceM <= 500) {
      reasons.push(`${distanceM}m`);
    } else {
      score -= Math.min(15, Math.floor((distanceM - 500) / 100));
      reasons.push(`${distanceM}m`);
    }
  } else {
    score -= 20;
    reasons.push("좌표 없음");
  }

  if (approvalDiff != null) {
    if (approvalDiff <= 3) {
      score += 10;
      reasons.push(`승인±${approvalDiff}년`);
    } else if (approvalDiff <= 8) {
      score -= approvalDiff * 2;
      reasons.push(`승인±${approvalDiff}년`);
    } else {
      score -= 35;
      reasons.push(`승인 ${approvalDiff}년 차`);
    }
  } else {
    score -= 8;
  }

  const subj = subjectFlags(caseData);
  if (item.isMultifamily !== subj.isMultifamily) {
    score -= 25;
    reasons.push("유형 상이");
  }
  if (item.hasNeighborhoodCommercial !== subj.hasCommercial) {
    score -= 15;
    reasons.push("근린 상이");
  }
  if (item.sellerType === "lh" || item.sellerType === "sh") {
    score -= 10;
    reasons.push("공사 매각");
  }

  const bDiff = areaDiffRatio(
    item.buildingAreaSqm,
    caseData.buildingAreaSqm,
  );
  if (bDiff <= 0.15) reasons.push("면적 유사");
  else if (bDiff > 0.35) score -= 12;

  const parkSub = caseData.parkingUnitCount;
  if (
    parkSub != null &&
    item.parkingCount != null &&
    Math.abs(parkSub - item.parkingCount) >= 2
  ) {
    score -= 6;
  }

  if (item.bidRatePct == null) score -= 15;

  const tier: ComparableTier =
    score >= 70 && distanceM != null && distanceM <= anchor.radiusM
      ? "core"
      : score >= 50
        ? "reference"
        : "excluded";

  return {
    item,
    distanceM,
    approvalDiffYears: approvalDiff,
    similarityScore: Math.max(0, Math.min(100, Math.round(score))),
    tier,
    reasons,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1
    ? s[mid]!
    : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function filterMolitWithinRadius(
  caseData: AuctionCase,
  anchor: AuctionCompareAnchor,
): NearbyMarketListing[] {
  const listings = caseData.nearbyMarketAnalysis?.listings ?? [];
  const lat = anchor.lat;
  const lng = anchor.lng;
  if (lat == null || lng == null) return [];
  return listings.filter((item) => {
    if (item.tradeType !== "매매" || item.dealAmountManwon == null) return false;
    if (item.lat == null || item.lng == null) return false;
    const d = distanceMeters(lat, lng, item.lat, item.lng);
    return d <= anchor.radiusM;
  });
}

export function computeAuctionBidRecommendation(
  caseData: AuctionCase,
  comparables: AuctionSaleComparable[],
  shared: AuctionSaleComparable[],
): AuctionBidAnalysisResult {
  const anchor = resolveCaseAnchor(caseData);
  const all = [...comparables, ...shared];
  const scored = all.map((item) =>
    scoreAuctionComparable(caseData, item, anchor),
  );
  const core = scored.filter((s) => s.tier === "core" && s.item.bidRatePct != null);
  const ref = scored.filter(
    (s) =>
      (s.tier === "core" || s.tier === "reference") &&
      s.item.bidRatePct != null,
  );
  const pool = core.length >= 2 ? core : ref;
  const rates = pool
    .map((s) => s.item.bidRatePct!)
    .filter((r) => Number.isFinite(r));
  const auctionMedian = median(rates);

  const subjectApproval = subjectUseApprovalDate(caseData);
  const poolYears = pool
    .map((s) => approvalYear(s.item.useApprovalDate))
    .filter((y): y is number => y != null);
  const medianPeerYear = median(poolYears);
  const subjectYear = approvalYear(subjectApproval) ?? builtYearFromCase(caseData);
  const ageBeta = caseData.auctionBidAnalysis?.ageAdjustPctPerYear ?? 0.5;
  let auctionAdjusted = auctionMedian;
  if (
    auctionMedian != null &&
    medianPeerYear != null &&
    subjectYear != null
  ) {
    auctionAdjusted =
      Math.round(
        (auctionMedian + ageBeta * (medianPeerYear - subjectYear)) * 100,
      ) / 100;
  }

  const molitInRadius = filterMolitWithinRadius(caseData, anchor);
  let marketSaleWon: number | null = null;
  if (molitInRadius.length > 0) {
    const avgManwon =
      median(
        molitInRadius
          .map((i) => i.dealAmountManwon)
          .filter((v): v is number => v != null && v > 0),
      ) ?? null;
    marketSaleWon = manwonToWon(avgManwon);
  } else if (caseData.nearbyMarketAnalysis) {
    marketSaleWon = manwonToWon(
      similarSaleAverageManwon(caseData, caseData.nearbyMarketAnalysis.listings),
    );
  }

  const appraisal = caseData.appraisalPrice;
  const marketImpliedRate =
    marketSaleWon != null && appraisal != null && appraisal > 0
      ? Math.round((marketSaleWon / appraisal) * 10000) / 100
      : null;

  const publicLand = caseData.rentSetting?.publicLandPrice ?? null;
  const landFloorWon = publicLand != null && publicLand > 0 ? publicLand : null;
  const landFloorRate =
    landFloorWon != null && appraisal != null && appraisal > 0
      ? Math.round((landFloorWon / appraisal) * 10000) / 100
      : null;

  const rateCandidates: number[] = [];
  if (auctionAdjusted != null) rateCandidates.push(auctionAdjusted);
  if (marketImpliedRate != null) rateCandidates.push(marketImpliedRate);
  if (landFloorRate != null) rateCandidates.push(landFloorRate);

  let suggestedRate: number | null = null;
  if (rateCandidates.length > 0) {
    const weights: number[] = [];
    const values: number[] = [];
    if (auctionAdjusted != null) {
      values.push(auctionAdjusted);
      weights.push(0.5);
    }
    if (marketImpliedRate != null) {
      values.push(marketImpliedRate);
      weights.push(0.35);
    }
    if (landFloorRate != null) {
      values.push(landFloorRate);
      weights.push(0.15);
    }
    const wSum = weights.reduce((a, b) => a + b, 0);
    suggestedRate =
      Math.round(
        (values.reduce((s, v, i) => s + v * weights[i]!, 0) / wSum) * 100,
      ) / 100;
  }

  const lowRates = [...rates];
  if (landFloorRate != null) lowRates.push(landFloorRate);
  if (marketImpliedRate != null) lowRates.push(marketImpliedRate * 0.95);
  const highRates = [...rates];
  if (marketImpliedRate != null) highRates.push(marketImpliedRate * 1.03);

  const rangeLowRate = median(lowRates);
  const rangeHighRate = median(highRates);

  const suggestedBidWon =
    suggestedRate != null && appraisal != null
      ? Math.round(appraisal * (suggestedRate / 100))
      : null;
  const rangeLowWon =
    rangeLowRate != null && appraisal != null
      ? Math.round(appraisal * (rangeLowRate / 100))
      : null;
  const rangeHighWon =
    rangeHighRate != null && appraisal != null
      ? Math.round(appraisal * (rangeHighRate / 100))
      : null;

  const parts: string[] = [];
  parts.push(
    `핵심·참고 사례 ${pool.length}건(반경 ${anchor.radiusM}m).`,
  );
  if (auctionMedian != null) {
    parts.push(`경매 낙찰가율 중앙 ${auctionMedian}%`);
    if (auctionAdjusted != null && auctionAdjusted !== auctionMedian) {
      parts.push(`연식 보정 후 ${auctionAdjusted}%`);
    }
  }
  if (marketImpliedRate != null) {
    parts.push(`실거래 환산 ${marketImpliedRate}%`);
  }
  if (landFloorRate != null) {
    parts.push(`공시지가 환산 ${landFloorRate}%`);
  }
  if (suggestedRate != null) {
    parts.push(`제안 ${suggestedRate}%`);
  }

  return {
    peerCount: pool.length,
    auctionMedianBidRatePct: auctionMedian,
    auctionAdjustedBidRatePct: auctionAdjusted,
    marketSaleWon,
    marketImpliedBidRatePct: marketImpliedRate,
    landFloorWon,
    landFloorBidRatePct: landFloorRate,
    suggestedBidWon,
    suggestedBidRatePct: suggestedRate,
    rangeLowWon,
    rangeHighWon,
    narrative: parts.join(" · "),
    computedAt: nowIso(),
  };
}

export type ComparableSortKey =
  | "distance"
  | "bidRate"
  | "year"
  | "price"
  | "area";

export type ComparableSortDir = "asc" | "desc";

function sortNullableNum(
  a: number | null,
  b: number | null,
  dir: ComparableSortDir,
): number {
  const mult = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * mult;
}

/** 표시용 정렬 (저장 순서는 바꾸지 않음) */
export function sortAuctionSaleComparablesForDisplay(
  items: AuctionSaleComparable[],
  scored: ScoredAuctionComparable[],
  sortKey: ComparableSortKey,
  dir: ComparableSortDir,
): AuctionSaleComparable[] {
  const distanceById = new Map(
    scored.map((s) => [s.item.id, s.distanceM] as const),
  );

  const valueOf = (row: AuctionSaleComparable): number | null => {
    switch (sortKey) {
      case "distance":
        return distanceById.get(row.id) ?? null;
      case "bidRate":
        return row.bidRatePct;
      case "year":
        return approvalYear(row.useApprovalDate);
      case "price":
        return row.winningBidPrice ?? row.appraisalPrice;
      case "area":
        return row.buildingAreaSqm ?? row.landAreaSqm;
      default:
        return null;
    }
  };

  return [...items].sort((a, b) => sortNullableNum(valueOf(a), valueOf(b), dir));
}

export function moveAuctionSaleComparable(
  items: AuctionSaleComparable[],
  index: number,
  direction: -1 | 1,
): AuctionSaleComparable[] {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [removed] = copy.splice(index, 1);
  copy.splice(next, 0, removed);
  return copy;
}

/** 탭·줄 구분 붙여넣기 파서 (최대 10건) */
export function parseAuctionComparablePaste(text: string): AuctionSaleComparable[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: AuctionSaleComparable[] = [];
  for (const line of lines) {
    if (out.length >= MAX_AUCTION_SALE_COMPARABLES) break;
    const cols = line.includes("\t")
      ? line.split("\t")
      : line.split("|").map((c) => c.trim());
    if (cols.length < 2) continue;
    const address = cols[0]?.trim() ?? "";
    const rateMatch = line.match(/(\d{2,3}(?:\.\d{1,2})?)\s*%/);
    const priceMatch = line.match(/([\d,]+)\s*(?:원|만)?/);
    let rate = rateMatch ? parseFloat(rateMatch[1]!) : null;
    let winning: number | null = null;
    if (priceMatch) {
      const n = parseInt(priceMatch[1]!.replace(/,/g, ""), 10);
      if (Number.isFinite(n)) {
        winning = n < 10000 ? n * 10000 : n;
      }
    }
    const approval = parseUseApprovalDate(line);
    out.push(
      createAuctionSaleComparable({
        address: address || line.slice(0, 80),
        bidRatePct: rate,
        winningBidPrice: winning,
        useApprovalDate: approval,
        dong: inferDong(address),
      }),
    );
  }
  return out;
}
