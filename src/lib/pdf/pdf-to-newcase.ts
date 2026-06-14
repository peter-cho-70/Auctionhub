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

/** 목록·상세 제목: 지번 · 채무자 */
export function pdfExtractListTitle(extracted: AuctionPdfExtract): string | undefined {
  const jibun = extracted.addressJibun?.trim() || extracted.address?.trim();
  const debtor = extracted.debtor?.trim();
  if (jibun && debtor) return `${jibun} · ${debtor}`;
  if (jibun) return jibun;
  return debtor || undefined;
}

function buildMemo(extracted: AuctionPdfExtract): string | undefined {
  const parts: string[] = [];
  if (extracted.court) parts.push(`법원: ${extracted.court}`);
  if (extracted.auctionType) parts.push(`구분: ${extracted.auctionType}`);
  if (extracted.creditor) parts.push(`채권자: ${extracted.creditor}`);
  if (extracted.claimAmount) {
    parts.push(`청구금액: ${extracted.claimAmount.toLocaleString("ko-KR")}원`);
  }
  if (extracted.zoning) parts.push(`용도지역: ${extracted.zoning}`);
  if (extracted.tenantDepositTotal) {
    parts.push(
      `임차보증금합계: ${extracted.tenantDepositTotal.toLocaleString("ko-KR")}원`,
    );
  }
  if (extracted.notes?.trim()) parts.push(extracted.notes.trim());
  const memo = parts.join("\n").trim();
  return memo || undefined;
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
  if (
    (extracted.format === "speedauction" ||
      extracted.format === "daejangauction") &&
    extracted.auctionStatus === "ongoing"
  ) {
    warnings.push(
      "진행 중인 경매 PDF입니다. 낙찰가·가율은 없으며 입찰가 분석 비교 사례로는 부적합할 수 있습니다.",
    );
  }

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
    householdCount: normalizeNonNegativeNumberOrNull(
      extracted.householdCountHint,
      { floor: true, max: 9999 },
    ),
    buildingCoverageRatio:
      extracted.buildingCoverageRatioPct != null
        ? `${extracted.buildingCoverageRatioPct}%`
        : undefined,
    floorAreaRatio:
      extracted.floorAreaRatioPct != null
        ? `${extracted.floorAreaRatioPct}%`
        : undefined,
    memo: buildMemo(extracted),
    listTitle: pdfExtractListTitle(extracted),
  };

  if (!input.sourceUrl) {
    warnings.push("sourceUrl이 비어있습니다. 저장 전에 URL을 입력하세요.");
  }

  return { input, warnings };
}
