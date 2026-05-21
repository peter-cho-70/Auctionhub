import { NextResponse } from "next/server";
import { resolveMolitLawdCode } from "@/lib/address/lawd-code";
import { normalizeCaseAddressMeta } from "@/lib/address/normalize";
import { geocodeAddress } from "@/lib/map/geocode-server";
import {
  buildGuMarketCacheEntry,
  mergeListings,
  missingMonths,
  MOLIT_RENT_MONTHS,
  MOLIT_SALE_MONTHS,
} from "@/lib/data/gu-market-cache";
import { inferDong } from "@/lib/domain/nearby-market";
import { filterByScope } from "@/lib/domain/nearby-market-comparables";
import type {
  GuMarketCacheEntry,
  NearbyMarketAnalysis,
  NearbyMarketListing,
  NearbyMarketRoomSummary,
} from "@/lib/types/domain";

export const runtime = "nodejs";

const MOLIT_BASE = "https://apis.data.go.kr/1613000";

import { DAEJEON_GU_LAWD_CODES as GU_LAWD_CODES } from "@/lib/address/lawd-code";

const ADJACENT_DONGS: Record<string, string[]> = {
  선화동: ["목동", "은행동", "대흥동", "중촌동", "용두동"],
  대흥동: ["선화동", "은행동", "문창동", "대사동", "부사동"],
  은행동: ["선화동", "대흥동", "중앙로"],
  목동: ["선화동", "중촌동", "용두동"],
  중촌동: ["목동", "선화동", "용두동"],
  용두동: ["목동", "선화동", "오류동"],
};

type MolitEndpoint = {
  path: string;
  tradeKind: "rent" | "sale";
  propertyType: string;
};

const ENDPOINTS: MolitEndpoint[] = [
  {
    path: "RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
    tradeKind: "rent",
    propertyType: "단독다가구",
  },
  {
    path: "RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
    tradeKind: "rent",
    propertyType: "연립다세대",
  },
  {
    path: "RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
    tradeKind: "sale",
    propertyType: "단독다가구",
  },
  {
    path: "RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    tradeKind: "sale",
    propertyType: "연립다세대",
  },
];

function endpointLabel(endpoint: MolitEndpoint): string {
  return `${endpoint.propertyType} ${endpoint.tradeKind === "rent" ? "전월세" : "매매"}`;
}

const BUILDING_AREA_FIELD_NAMES = [
  "건물면적",
  "연면적",
  "전용면적",
  "전용면적(㎡)",
  "계약면적",
  "계약면적(㎡)",
  "buildingAr",
  "totArea",
  "totalFloorAr",
  "excluUseAr",
  "dealArea",
  "area",
];

const LAND_AREA_FIELD_NAMES = [
  "대지면적",
  "토지면적",
  "대지권면적",
  "landAr",
  "platArea",
  "landArea",
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberFromText(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(text(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = numberFromText(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && value > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function inferGu(address: string): string {
  return Object.keys(GU_LAWD_CODES).find((gu) => address.includes(gu)) ?? "";
}

function dealMonths(months: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function roomTypeFromArea(area: number | null): string {
  if (area == null) return "기타";
  if (area >= 10 && area < 33) return "원룸";
  if (area >= 33 && area < 50) return "1.5룸";
  if (area >= 50 && area < 80) return "2룸";
  if (area >= 80) return "3룸 이상";
  return "기타";
}

function parseBuiltYear(value: unknown): number | null {
  const parsed = numberFromText(value);
  if (parsed == null) return null;
  if (parsed > 1900 && parsed < 2100) return Math.floor(parsed);
  const match = text(value).match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function getField(item: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (item[name] != null) return item[name];
  }
  return undefined;
}

function buildMolitUrl(endpoint: MolitEndpoint, lawdCode: string, ym: string): string {
  const serviceKey = process.env.MOLIT_API_KEY;
  if (!serviceKey) throw new Error("MOLIT_API_KEY가 설정되지 않았습니다.");
  const serviceKeyParam = serviceKey.includes("%")
    ? serviceKey
    : encodeURIComponent(serviceKey);
  const params = new URLSearchParams({
    LAWD_CD: lawdCode,
    DEAL_YMD: ym,
    pageNo: "1",
    numOfRows: "500",
    _type: "json",
  });
  return `${MOLIT_BASE}/${endpoint.path}?serviceKey=${serviceKeyParam}&${params.toString()}`;
}

function normalizeMolitItems(raw: unknown): Record<string, unknown>[] {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const response = root.response && typeof root.response === "object"
    ? (root.response as Record<string, unknown>)
    : {};
  const body = response.body && typeof response.body === "object"
    ? (response.body as Record<string, unknown>)
    : {};
  const items = body.items && typeof body.items === "object"
    ? (body.items as Record<string, unknown>)
    : {};
  const item = items.item;
  if (Array.isArray(item)) {
    return item.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
  }
  return item && typeof item === "object" ? [item as Record<string, unknown>] : [];
}

function molitResultError(raw: unknown): string | null {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const response = root.response && typeof root.response === "object"
    ? (root.response as Record<string, unknown>)
    : {};
  const header = response.header && typeof response.header === "object"
    ? (response.header as Record<string, unknown>)
    : {};
  const code = text(header.resultCode);
  const msg = text(header.resultMsg);
  if (!code || code === "00" || code === "000") return null;
  return msg || `국토부 API 오류(${code})`;
}

function molitXmlError(body: string): string | null {
  const authMsg = body.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>/)?.[1]?.trim();
  const resultMsg = body.match(/<resultMsg>([^<]+)<\/resultMsg>/)?.[1]?.trim();
  const errorMsg = authMsg || resultMsg;
  return errorMsg ? `국토부 API 오류: ${errorMsg}` : null;
}

async function fetchMolit(endpoint: MolitEndpoint, lawdCode: string, ym: string) {
  const url = buildMolitUrl(endpoint, lawdCode, ym);
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`국토부 API 호출 실패(${response.status})`);
  }
  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    throw new Error(molitXmlError(body) ?? "국토부 API 응답을 JSON으로 읽지 못했습니다.");
  }
  const apiError = molitResultError(json);
  if (apiError) throw new Error(apiError);
  return normalizeMolitItems(json);
}

function buildMolitJibunAddress(
  item: Record<string, unknown>,
  dong: string,
): string {
  const jibun = text(getField(item, ["지번", "jibun"]));
  if (jibun) return jibun;
  const bon = numberFromText(getField(item, ["bonbun", "본번", "lnbrMnnm"]));
  const bu = numberFromText(getField(item, ["bubun", "부번", "lnbrSlno"]));
  if (bon != null) {
    return bu != null && bu > 0 ? `${bon}-${bu}` : String(bon);
  }
  return dong;
}

function listingFromMolit(
  item: Record<string, unknown>,
  endpoint: MolitEndpoint,
  index: number,
): NearbyMarketListing | null {
  const dong = text(getField(item, ["법정동", "umdNm", "동"]));
  const buildingAreaSqm = positive(getField(item, BUILDING_AREA_FIELD_NAMES));
  const landAreaSqm = positive(getField(item, LAND_AREA_FIELD_NAMES));
  const areaSqm = buildingAreaSqm ?? landAreaSqm;
  if (areaSqm == null || areaSqm < 5) return null;
  const year = numberFromText(getField(item, ["년", "dealYear"]));
  const month = numberFromText(getField(item, ["월", "dealMonth"]));
  const day = numberFromText(getField(item, ["일", "dealDay"]));
  const deposit = positive(getField(item, ["보증금액", "보증금", "deposit"]));
  const monthlyRent = positive(getField(item, ["월세금액", "월세", "monthlyRent"]));
  const dealAmount = positive(getField(item, ["거래금액", "dealAmount"]));
  const tradeType =
    endpoint.tradeKind === "sale" ? "매매" : monthlyRent != null ? "월세" : "전세";
  return {
    id: `molit-${endpoint.tradeKind}-${index}`,
    source: "molit",
    tradeType,
    roomType: endpoint.tradeKind === "sale" ? "매매" : roomTypeFromArea(areaSqm),
    propertyType: endpoint.propertyType,
    dong,
    address: buildMolitJibunAddress(item, dong),
    title: "",
    areaSqm,
    buildingAreaSqm,
    landAreaSqm,
    floor: text(getField(item, ["층", "floor"])),
    buildYear: positive(getField(item, ["건축년도", "건축년", "buildYear"])),
    dealAmountManwon: dealAmount,
    depositManwon: deposit,
    monthlyRentManwon: monthlyRent,
    dealDate:
      year != null && month != null
        ? `${year}-${String(month).padStart(2, "0")}${day != null ? `-${String(day).padStart(2, "0")}` : ""}`
        : "",
    lat: null,
    lng: null,
  };
}

function dealDateSortValue(item: NearbyMarketListing): number {
  const digits = item.dealDate.replace(/[^\d]/g, "");
  return digits.length >= 6 ? Number(digits.slice(0, 8).padEnd(8, "0")) : 0;
}

function dongRank(item: NearbyMarketListing, targetDong: string): number {
  if (!targetDong || !item.dong) return 2;
  if (item.dong.includes(targetDong) || targetDong.includes(item.dong)) return 0;
  const adjacent = ADJACENT_DONGS[targetDong] ?? [];
  return adjacent.some((dong) => item.dong.includes(dong) || dong.includes(item.dong))
    ? 1
    : 2;
}

function listingBuildingSqm(item: NearbyMarketListing): number | null {
  if (item.buildingAreaSqm != null && item.buildingAreaSqm > 0) {
    return item.buildingAreaSqm;
  }
  return item.areaSqm != null && item.areaSqm > 0 ? item.areaSqm : null;
}

function areaDiffRatio(item: NearbyMarketListing, targetAreaSqm: number | null): number {
  const listingSqm = listingBuildingSqm(item);
  if (targetAreaSqm == null || targetAreaSqm <= 0 || listingSqm == null) return 9;
  return Math.abs(listingSqm - targetAreaSqm) / targetAreaSqm;
}

function builtYearDiff(item: NearbyMarketListing, targetBuiltYear: number | null): number {
  if (targetBuiltYear == null || item.buildYear == null) return 99;
  return Math.abs(item.buildYear - targetBuiltYear);
}

function compareListings(
  a: NearbyMarketListing,
  b: NearbyMarketListing,
  targetDong: string,
  targetAreaSqm: number | null,
  targetBuiltYear: number | null,
): number {
  const dongDelta = dongRank(a, targetDong) - dongRank(b, targetDong);
  if (dongDelta !== 0) return dongDelta;

  const areaDelta = areaDiffRatio(a, targetAreaSqm) - areaDiffRatio(b, targetAreaSqm);
  if (Math.abs(areaDelta) > 0.01) return areaDelta;

  const yearDelta = builtYearDiff(a, targetBuiltYear) - builtYearDiff(b, targetBuiltYear);
  if (yearDelta !== 0) return yearDelta;

  return dealDateSortValue(b) - dealDateSortValue(a);
}

function similarSaleListings(
  listings: NearbyMarketListing[],
  targetDong: string,
  targetAreaSqm: number | null,
  targetBuiltYear: number | null,
): NearbyMarketListing[] {
  const saleListings = listings
    .filter((item) => item.tradeType === "매매" && item.dealAmountManwon != null)
    .sort((a, b) => compareListings(a, b, targetDong, targetAreaSqm, targetBuiltYear));
  if (saleListings.length === 0) return [];

  const sameDong = saleListings.filter((item) => dongRank(item, targetDong) === 0);
  const localBase = sameDong.length >= 3
    ? sameDong
    : saleListings.filter((item) => dongRank(item, targetDong) <= 1);
  const base = localBase.length >= 3 ? localBase : saleListings;

  const areaMatched = targetAreaSqm != null
    ? base.filter((item) => areaDiffRatio(item, targetAreaSqm) <= 0.3)
    : base;
  const areaBase = areaMatched.length >= 3 ? areaMatched : base;

  const yearMatched = targetBuiltYear != null
    ? areaBase.filter((item) => builtYearDiff(item, targetBuiltYear) <= 10)
    : areaBase;
  const yearBase = yearMatched.length >= 3 ? yearMatched : areaBase;

  return yearBase.slice(0, 15);
}

function roomSummary(roomType: string, listings: NearbyMarketListing[]): NearbyMarketRoomSummary {
  const molit = listings.filter((item) => item.source === "molit" && item.roomType === roomType);
  return {
    roomType,
    naverCount: 0,
    molitCount: molit.length,
    naverDepositAvgManwon: null,
    naverMonthlyRentAvgManwon: null,
    molitDepositAvgManwon: avg(molit.map((item) => item.depositManwon)),
    molitMonthlyRentAvgManwon: avg(molit.map((item) => item.monthlyRentManwon)),
  };
}

function parseGuMarketCache(
  raw: unknown,
  lawdCode: string,
): GuMarketCacheEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as GuMarketCacheEntry;
  if (o.lawdCode !== lawdCode || !Array.isArray(o.listings)) return null;
  return o;
}

async function fetchMolitMonthBatch(
  lawdCode: string,
  saleYms: string[],
  rentYms: string[],
  warnings: string[],
  startIndex: number,
): Promise<{ listings: NearbyMarketListing[]; nextIndex: number }> {
  const saleEndpoints = ENDPOINTS.filter((e) => e.tradeKind === "sale");
  const rentEndpoints = ENDPOINTS.filter((e) => e.tradeKind === "rent");
  const tasks: Array<{ ym: string; endpoint: MolitEndpoint }> = [];
  for (const ym of saleYms) {
    for (const endpoint of saleEndpoints) tasks.push({ ym, endpoint });
  }
  for (const ym of rentYms) {
    for (const endpoint of rentEndpoints) tasks.push({ ym, endpoint });
  }

  const out: NearbyMarketListing[] = [];
  let index = startIndex;
  const concurrency = 8;

  for (let i = 0; i < tasks.length; i += concurrency) {
    const chunk = tasks.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ ym, endpoint }) => {
        try {
          const rows = await fetchMolit(endpoint, lawdCode, ym);
          for (const row of rows) {
            const listing = listingFromMolit(row, endpoint, index);
            index += 1;
            if (listing) out.push(listing);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`${ym} ${endpointLabel(endpoint)} 조회 실패: ${msg}`);
        }
      }),
    );
  }

  return { listings: out, nextIndex: index };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const address = text(body.address);
    const gu = text(body.gu) || inferGu(address);
    const dong = text(body.dong) || inferDong(address);
    const forceRefresh = body.forceRefresh === true;
    const targetAreaSqm = positive(body.buildingAreaSqm ?? body.targetAreaSqm);
    const targetBuiltYear = parseBuiltYear(body.builtYear ?? body.targetBuiltYear);
    const addressMeta =
      body.addressMeta && typeof body.addressMeta === "object"
        ? (body.addressMeta as { molitLawdCode?: string | null })
        : null;
    const lawdCode =
      text(body.lawdCode) ||
      resolveMolitLawdCode(address, addressMeta) ||
      GU_LAWD_CODES[gu];
    if (!lawdCode) {
      return NextResponse.json(
        { ok: false, error: "주소에서 대전 구 정보를 찾지 못했습니다." },
        { status: 400 },
      );
    }

    const saleYmsRequired = dealMonths(MOLIT_SALE_MONTHS);
    const rentYmsRequired = dealMonths(MOLIT_RENT_MONTHS);
    const cached = !forceRefresh
      ? parseGuMarketCache(body.guMarketCache, lawdCode)
      : null;

    let listings = cached ? [...cached.listings] : [];
    let saleCovered = cached ? [...cached.saleMonthsCovered] : [];
    let rentCovered = cached ? [...cached.rentMonthsCovered] : [];

    const saleToFetch = forceRefresh
      ? saleYmsRequired
      : missingMonths(saleCovered, saleYmsRequired);
    const rentToFetch = forceRefresh
      ? rentYmsRequired
      : missingMonths(rentCovered, rentYmsRequired);

    const warnings: string[] = [];
    if (saleToFetch.length > 0 || rentToFetch.length > 0) {
      const fetched = await fetchMolitMonthBatch(
        lawdCode,
        saleToFetch,
        rentToFetch,
        warnings,
        listings.length,
      );
      listings = mergeListings(listings, fetched.listings);
      saleCovered = [...new Set([...saleCovered, ...saleToFetch])];
      rentCovered = [...new Set([...rentCovered, ...rentToFetch])];
    } else if (cached) {
      warnings.push("구 단위 캐시를 사용했습니다. API 호출을 생략했습니다.");
    }

    const sorted = listings.sort((a, b) =>
      compareListings(a, b, dong, targetAreaSqm, targetBuiltYear),
    );
    const center = await geocodeAddress(
      address,
      body.addressMeta && typeof body.addressMeta === "object"
        ? normalizeCaseAddressMeta(body.addressMeta)
        : null,
    );
    const saleListings = filterByScope(
      sorted.filter(
        (item) => item.tradeType === "매매" && item.dealAmountManwon != null,
      ),
      dong,
      "same_dong",
    ).slice(0, 15);
    const analysis: NearbyMarketAnalysis = {
      importedAt: new Date().toISOString(),
      city: "대전광역시",
      gu,
      dong,
      lat: center?.lat ?? null,
      lng: center?.lng ?? null,
      months: MOLIT_RENT_MONTHS,
      saleMonths: MOLIT_SALE_MONTHS,
      rentMonths: MOLIT_RENT_MONTHS,
      naverCount: 0,
      molitCount: sorted.length,
      saleAvgMolitManwon: avg(saleListings.map((item) => item.dealAmountManwon)),
      saleAvgNaverManwon: null,
      roomSummaries: ["원룸", "1.5룸", "2룸", "3룸 이상"].map((roomType) =>
        roomSummary(roomType, sorted),
      ),
      listings: sorted,
      geminiInsight: null,
    };

    const guMarketCache = buildGuMarketCacheEntry(
      lawdCode,
      "대전광역시",
      gu,
      sorted,
      saleCovered,
      rentCovered,
    );

    return NextResponse.json({
      ok: true,
      analysis,
      guMarketCache,
      warnings,
      cacheUsed: saleToFetch.length === 0 && rentToFetch.length === 0 && !!cached,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg || "주변 시세 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
