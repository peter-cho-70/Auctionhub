import type { NewCaseInput } from "@/lib/domain/case-factory";
import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";

export type PdfToNewCaseResult = {
  input: NewCaseInput;
  warnings: string[];
};

function nonEmptyOrUndefined(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function normalizeIsoDateOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) {
    return `${m[1]!}-${String(m[2]!).padStart(2, "0")}-${String(m[3]!).padStart(2, "0")}`;
  }
  return null;
}

function normalizeNonNegativeNumberOrNull(
  raw: unknown,
  { floor, max }: { floor?: boolean; max: number },
): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  const v = floor ? Math.floor(raw) : raw;
  return Math.min(max, v);
}

export function auctionPdfExtractToNewCaseInput(args: {
  extracted: AuctionPdfExtract;
  sourceUrl: string;
}): PdfToNewCaseResult {
  const { extracted, sourceUrl } = args;
  const warnings: string[] = [];

  if (!extracted.caseNumber) warnings.push("사건번호를 찾지 못했습니다.");
  if (!extracted.address) warnings.push("주소를 찾지 못했습니다.");
  if (!extracted.minPrice) warnings.push("최저가를 찾지 못했습니다.");
  if (!extracted.bidDate) warnings.push("매각기일(입찰일)을 찾지 못했습니다.");

  const input: NewCaseInput = {
    sourceUrl: sourceUrl.trim(),
    caseNumber: nonEmptyOrUndefined(extracted.caseNumber ?? undefined),
    address: nonEmptyOrUndefined(extracted.address ?? undefined),
    propertyType: nonEmptyOrUndefined(extracted.propertyType ?? undefined),
    builtYear: nonEmptyOrUndefined(extracted.builtYear ?? undefined),
    appraisalPrice: normalizeNonNegativeNumberOrNull(extracted.appraisalPrice, {
      max: 1e16,
    }),
    minPrice: normalizeNonNegativeNumberOrNull(extracted.minPrice, { max: 1e16 }),
    bidDate: normalizeIsoDateOrNull(extracted.bidDate),
    landAreaSqm: normalizeNonNegativeNumberOrNull(extracted.landAreaSqm, {
      max: 1e9,
    }),
    buildingAreaSqm: normalizeNonNegativeNumberOrNull(extracted.buildingAreaSqm, {
      max: 1e9,
    }),
    parkingUnitCount: normalizeNonNegativeNumberOrNull(extracted.parkingUnitCount, {
      floor: true,
      max: 99999,
    }),
    memo: extracted.notes?.trim() ? extracted.notes.trim() : undefined,
  };

  if (!input.sourceUrl) {
    warnings.push("sourceUrl이 비어있습니다. 저장 전에 URL을 입력하세요.");
  }

  return { input, warnings };
}

