import type { NewCaseInput } from "@/lib/domain/case-factory";

export type LlmCaseJsonParseResult =
  | { ok: true; input: NewCaseInput; warnings: string[] }
  | { ok: false; error: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function pickString(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function parseKrwToNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseSqmToNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/㎡/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseCountToNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.min(99999, Math.floor(v));
  }
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? Math.min(99999, Math.floor(n)) : null;
}

function normalizeIsoDateOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) {
    return `${m[1]!}-${String(m[2]!).padStart(2, "0")}-${String(m[3]!).padStart(2, "0")}`;
  }
  return null;
}

export function parseLlmCaseJsonToNewCaseInput(text: string): LlmCaseJsonParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const o = asRecord(raw);
  if (!o) return { ok: false, error: "JSON이 객체가 아닙니다." };

  const warnings: string[] = [];
  const sourceUrl =
    pickString(o, ["sourceUrl", "url", "source_url", "link"]) ??
    "llm-import:unknown";

  const caseNumber = pickString(o, ["caseNumber", "case_no", "case", "사건번호"]);
  const address = pickString(o, ["address", "addr", "소재지", "주소"]);
  const propertyType = pickString(o, ["propertyType", "type", "물건종별", "종별"]);
  const builtYear = pickString(o, ["builtYear", "built_year", "사용승인", "준공", "준공년도"]);

  const appraisalPrice = parseKrwToNumber(
    o.appraisalPrice ?? o.appraisal_amount ?? o["감정가"],
  );
  const minPrice = parseKrwToNumber(o.minPrice ?? o.minimumPrice ?? o["최저가"]);
  const bidDate = normalizeIsoDateOrNull(o.bidDate ?? o.auctionDate ?? o["매각기일"]);

  const landAreaSqm = parseSqmToNumber(o.landAreaSqm ?? o.land_area_sqm ?? o["토지면적"]);
  const buildingAreaSqm = parseSqmToNumber(
    o.buildingAreaSqm ?? o.building_area_sqm ?? o["건물면적"],
  );
  const parkingUnitCount = parseCountToNumber(
    o.parkingUnitCount ?? o.parking_count ?? o["주차대수"] ?? o["총주차대수"],
  );

  const memo = pickString(o, ["memo", "notes", "note", "비고", "참고사항"]);

  if (!caseNumber) warnings.push("사건번호를 찾지 못했습니다.");
  if (!address) warnings.push("주소를 찾지 못했습니다.");
  if (!minPrice) warnings.push("최저가를 찾지 못했습니다.");

  const input: NewCaseInput = {
    sourceUrl,
    caseNumber,
    address,
    propertyType,
    builtYear,
    appraisalPrice,
    minPrice,
    bidDate,
    landAreaSqm,
    buildingAreaSqm,
    parkingUnitCount,
    memo,
  };

  if (!input.sourceUrl.trim()) warnings.push("sourceUrl이 비어있습니다.");

  return { ok: true, input, warnings };
}

