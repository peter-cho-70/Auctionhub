import { formatManwonDigits, roundManwon } from "@/lib/format/manwon";
import type {
  AuctionCase,
  NearbyMarketAnalysis,
  NearbyMarketGeminiInsight,
  NearbyMarketListing,
  NearbyMarketRoomSummary,
  NearbyMarketSource,
  NearbyMarketTradeType,
} from "@/lib/types/domain";

const ROOM_TYPES = ["원룸", "1.5룸", "2룸"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is Record<string, unknown> => item != null)
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNum(value: unknown): number | null {
  const parsed = num(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && value > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function source(value: unknown): NearbyMarketSource {
  return value === "naver" || value === "molit" || value === "manual"
    ? value
    : "manual";
}

function tradeType(value: unknown): NearbyMarketTradeType {
  return value === "매매" ||
    value === "전세" ||
    value === "월세" ||
    value === "전월세" ||
    value === "기타"
    ? value
    : "기타";
}

function parseListingAreas(item: Record<string, unknown>): {
  buildingAreaSqm: number | null;
  landAreaSqm: number | null;
  areaSqm: number | null;
} {
  const building = positiveNum(
    item.buildingAreaSqm ?? item.building_area_sqm,
  );
  const land = positiveNum(item.landAreaSqm ?? item.land_area_sqm);
  const legacy = positiveNum(item.areaSqm ?? item.area_sqm);
  const buildingAreaSqm = building ?? (land == null ? legacy : null);
  const landAreaSqm = land;
  return {
    buildingAreaSqm,
    landAreaSqm,
    areaSqm: buildingAreaSqm ?? legacy,
  };
}

function normalizeListing(raw: unknown, index: number): NearbyMarketListing | null {
  const item = asRecord(raw);
  if (!item) return null;
  const areas = parseListingAreas(item);
  return {
    id: text(item.id) || text(item.article_no) || `market-${index + 1}`,
    source: source(item.source),
    tradeType: tradeType(item.tradeType ?? item.trade_type ?? item.type),
    roomType: text(item.roomType ?? item.room_type) || "기타",
    propertyType: text(item.propertyType ?? item.property_type),
    dong: text(item.dong),
    address: text(item.address),
    title: text(item.title),
    areaSqm: areas.areaSqm,
    buildingAreaSqm: areas.buildingAreaSqm,
    landAreaSqm: areas.landAreaSqm,
    floor: text(item.floor ?? item.floor_info),
    buildYear: positiveNum(item.buildYear ?? item.build_year),
    dealAmountManwon: positiveNum(item.dealAmountManwon ?? item.deal_amount),
    depositManwon: positiveNum(item.depositManwon ?? item.deposit),
    monthlyRentManwon: positiveNum(item.monthlyRentManwon ?? item.monthly_rent),
    dealDate: text(item.dealDate) || buildDealDate(item),
    lat: num(item.lat),
    lng: num(item.lng),
  };
}

function buildDealDate(item: Record<string, unknown>): string {
  const year = positiveNum(item.deal_year);
  const month = positiveNum(item.deal_month);
  if (!year || !month) return "";
  return `${year}-${String(month).padStart(2, "0")}`;
}

function roomSummary(roomType: string, listings: NearbyMarketListing[]): NearbyMarketRoomSummary {
  const naver = listings.filter(
    (item) => item.source === "naver" && item.roomType === roomType,
  );
  const molit = listings.filter(
    (item) => item.source === "molit" && item.roomType === roomType,
  );
  return {
    roomType,
    naverCount: naver.length,
    molitCount: molit.length,
    naverDepositAvgManwon: avg(naver.map((item) => item.depositManwon)),
    naverMonthlyRentAvgManwon: avg(naver.map((item) => item.monthlyRentManwon)),
    molitDepositAvgManwon: avg(molit.map((item) => item.depositManwon)),
    molitMonthlyRentAvgManwon: avg(molit.map((item) => item.monthlyRentManwon)),
  };
}

function normalizeGeminiInsight(raw: unknown): NearbyMarketGeminiInsight | null {
  const item = asRecord(raw);
  if (!item) return null;
  const recommendedRaw = item.recommendedRoomMix ?? item.recommended_room_mix;
  const keyPointsRaw = item.keyPoints ?? item.key_points;
  const recommended: unknown[] = Array.isArray(recommendedRaw)
    ? recommendedRaw
    : [];
  const keyPoints: unknown[] = Array.isArray(keyPointsRaw) ? keyPointsRaw : [];
  const warnings: unknown[] = Array.isArray(item.warnings) ? item.warnings : [];
  const rentStrength = text(item.rentStrength ?? item.rent_strength);
  const vacancyRisk = text(item.vacancyRisk ?? item.vacancy_risk);
  return {
    oneLine: text(item.oneLine ?? item.one_line),
    rentStrength:
      rentStrength === "good" || rentStrength === "normal" || rentStrength === "weak"
        ? rentStrength
        : "unknown",
    vacancyRisk:
      vacancyRisk === "low" || vacancyRisk === "medium" || vacancyRisk === "high"
        ? vacancyRisk
        : "unknown",
    recommendedRoomMix: recommended.map(text).filter(Boolean),
    keyPoints: keyPoints.map(text).filter(Boolean),
    warnings: warnings.map(text).filter(Boolean),
  };
}

function listingsFromLegacyAnalyze(raw: Record<string, unknown>): NearbyMarketListing[] {
  const listings: NearbyMarketListing[] = [];
  const naver = asRecord(asRecord(raw.naver)?.["전월세"]);
  if (naver) {
    for (const [roomType, value] of Object.entries(naver)) {
      for (const row of arrayRecords(value)) {
        const areas = parseListingAreas({ areaSqm: row.area_sqm });
        listings.push({
          id: `naver-${listings.length + 1}`,
          source: "naver",
          tradeType: tradeType(row.trade_type),
          roomType,
          propertyType: "",
          dong: "",
          address: text(row.address),
          title: text(row.title),
          areaSqm: areas.areaSqm,
          buildingAreaSqm: areas.buildingAreaSqm,
          landAreaSqm: areas.landAreaSqm,
          floor: text(row.floor_info),
          buildYear: positiveNum(row.build_year),
          dealAmountManwon: positiveNum(row.deal_amount),
          depositManwon: positiveNum(row.deposit),
          monthlyRentManwon: positiveNum(row.monthly_rent),
          dealDate: "",
          lat: num(row.lat),
          lng: num(row.lng),
        });
      }
    }
  }

  const molit = asRecord(raw.molit);
  for (const row of arrayRecords(molit?.["매매"])) {
    const areas = parseListingAreas({
      areaSqm: row.area_sqm,
      buildingAreaSqm: row.building_area_sqm,
      landAreaSqm: row.land_area_sqm,
    });
    listings.push({
      id: `molit-sale-${listings.length + 1}`,
      source: "molit",
      tradeType: "매매",
      roomType: "매매",
      propertyType: text(row.property_type),
      dong: text(row.dong),
      address: text(row.jibun),
      title: "",
      areaSqm: areas.areaSqm,
      buildingAreaSqm: areas.buildingAreaSqm,
      landAreaSqm: areas.landAreaSqm,
      floor: text(row.floor),
      buildYear: positiveNum(row.build_year),
      dealAmountManwon: positiveNum(row.deal_amount),
      depositManwon: null,
      monthlyRentManwon: null,
      dealDate: buildDealDate(row),
      lat: num(row.lat),
      lng: num(row.lng),
    });
  }
  const molitRent = asRecord(molit?.["전월세"]);
  if (molitRent) {
    for (const [roomType, value] of Object.entries(molitRent)) {
      for (const row of arrayRecords(value)) {
        const areas = parseListingAreas({ areaSqm: row.area_sqm });
        listings.push({
          id: `molit-rent-${listings.length + 1}`,
          source: "molit",
          tradeType: tradeType(row.type),
          roomType,
          propertyType: text(row.property_type),
          dong: text(row.dong),
          address: text(row.jibun),
          title: "",
          areaSqm: areas.areaSqm,
          buildingAreaSqm: areas.buildingAreaSqm,
          landAreaSqm: areas.landAreaSqm,
          floor: text(row.floor),
          buildYear: positiveNum(row.build_year),
          dealAmountManwon: positiveNum(row.deal_amount),
          depositManwon: positiveNum(row.deposit),
          monthlyRentManwon: positiveNum(row.monthly_rent),
          dealDate: buildDealDate(row),
          lat: num(row.lat),
          lng: num(row.lng),
        });
      }
    }
  }
  return listings;
}

export function normalizeNearbyMarketAnalysis(
  raw: unknown,
  fallbackCase?: AuctionCase,
): NearbyMarketAnalysis | null {
  const root = asRecord(raw);
  if (!root) return null;
  const legacyAnalyzeShape = root.summary && root.naver && root.molit;
  const source = legacyAnalyzeShape ? root : asRecord(root.marketAnalysis) ?? root;
  const summary = asRecord(source.summary);
  const config = asRecord(source.config) ?? {};
  const importedAt = text(source.importedAt ?? source.imported_at) || new Date().toISOString();
  const city = text(source.city ?? config.city) || "대전광역시";
  const gu = text(source.gu ?? config.gu) || "";
  const dong = text(source.dong ?? config.dong) || inferDong(fallbackCase?.address ?? "");
  const listings = legacyAnalyzeShape
    ? listingsFromLegacyAnalyze(source)
    : arrayRecords(source.listings)
        .map((item, index) => normalizeListing(item, index))
        .filter((item): item is NearbyMarketListing => item != null);
  const roomSummaries =
    arrayRecords(source.roomSummaries ?? source.room_summaries).length > 0
      ? arrayRecords(source.roomSummaries ?? source.room_summaries).map((row) => ({
          roomType: text(row.roomType ?? row.room_type) || "기타",
          naverCount: positiveNum(row.naverCount ?? row.naver_count) ?? 0,
          molitCount: positiveNum(row.molitCount ?? row.molit_count) ?? 0,
          naverDepositAvgManwon: positiveNum(
            row.naverDepositAvgManwon ?? row.naver_deposit_avg_manwon,
          ),
          naverMonthlyRentAvgManwon: positiveNum(
            row.naverMonthlyRentAvgManwon ?? row.naver_monthly_rent_avg_manwon,
          ),
          molitDepositAvgManwon: positiveNum(
            row.molitDepositAvgManwon ?? row.molit_deposit_avg_manwon,
          ),
          molitMonthlyRentAvgManwon: positiveNum(
            row.molitMonthlyRentAvgManwon ?? row.molit_monthly_rent_avg_manwon,
          ),
        }))
      : ROOM_TYPES.map((roomType) => roomSummary(roomType, listings));

  return {
    importedAt,
    city,
    gu,
    dong,
    lat: num(source.lat ?? config.lat),
    lng: num(source.lng ?? config.lng),
    months: positiveNum(source.months ?? config.months ?? source.rentMonths),
    saleMonths: positiveNum(source.saleMonths ?? source.sale_months) ?? 120,
    rentMonths: positiveNum(source.rentMonths ?? source.rent_months) ?? 12,
    naverCount:
      positiveNum(source.naverCount ?? source.naver_count ?? summary?.naver_count) ??
      listings.filter((item) => item.source === "naver").length,
    molitCount:
      positiveNum(source.molitCount ?? source.molit_count ?? summary?.molit_count) ??
      listings.filter((item) => item.source === "molit").length,
    saleAvgMolitManwon: positiveNum(
      source.saleAvgMolitManwon ?? source.sale_avg_molit_manwon ?? summary?.sale_avg_molit,
    ),
    saleAvgNaverManwon: positiveNum(
      source.saleAvgNaverManwon ?? source.sale_avg_naver_manwon ?? summary?.sale_avg_naver,
    ),
    roomSummaries,
    listings,
    geminiInsight: normalizeGeminiInsight(
      source.geminiInsight ?? source.gemini_insight ?? source.insight,
    ),
  };
}

export function inferDong(address: string): string {
  return address.match(/([가-힣0-9]+동)\b/)?.[1] ?? "";
}

export function formatManwon(value: number | null): string {
  if (value == null || value <= 0) return "-";
  const v = roundManwon(value);
  if (v >= 10000) {
    const eok = Math.floor(v / 10000);
    const rest = roundManwon(v % 10000);
    return rest > 0
      ? `${eok}억 ${formatManwonDigits(rest)}만`
      : `${eok}억`;
  }
  return `${formatManwonDigits(v)}만`;
}

export function buildSuggestedRentRows(c: AuctionCase, analysis: NearbyMarketAnalysis) {
  const byRoom = new Map(
    analysis.roomSummaries.map((summary) => [summary.roomType, summary]),
  );
  const oneRoom = byRoom.get("원룸");
  const oneHalf = byRoom.get("1.5룸");
  const twoRoom = byRoom.get("2룸");
  return [
    {
      label: "원룸 기준",
      unitCount: c.roomShapeMix["1룸"] || c.residentialUnitCount || c.householdCount || 0,
      deposit: oneRoom?.naverDepositAvgManwon ?? oneRoom?.molitDepositAvgManwon ?? null,
      monthlyRent:
        oneRoom?.naverMonthlyRentAvgManwon ?? oneRoom?.molitMonthlyRentAvgManwon ?? null,
    },
    {
      label: "1.5룸 기준",
      unitCount: c.roomShapeMix["1.5룸"] || 0,
      deposit: oneHalf?.naverDepositAvgManwon ?? oneHalf?.molitDepositAvgManwon ?? null,
      monthlyRent:
        oneHalf?.naverMonthlyRentAvgManwon ?? oneHalf?.molitMonthlyRentAvgManwon ?? null,
    },
    {
      label: "2룸 기준",
      unitCount: c.roomShapeMix["2룸"] || c.roomShapeMix["3룸"] || 0,
      deposit: twoRoom?.naverDepositAvgManwon ?? twoRoom?.molitDepositAvgManwon ?? null,
      monthlyRent:
        twoRoom?.naverMonthlyRentAvgManwon ?? twoRoom?.molitMonthlyRentAvgManwon ?? null,
    },
  ].filter((row) => row.unitCount > 0 && (row.deposit != null || row.monthlyRent != null));
}
