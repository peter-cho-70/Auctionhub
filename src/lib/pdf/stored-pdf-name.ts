import type { CaseSourceDocumentKind } from "@/lib/types/domain";

/** `2023 타경 3315` → `2023타경3315` */
export function normalizeCaseNumber(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

const KIND_FILE_LABEL: Record<CaseSourceDocumentKind, string> = {
  "daejangauction-pdf": "경매물건_대장옥션",
  "speedauction-pdf": "경매물건_스피드옥션",
  "auctionone-pdf": "경매물건",
  "registry-building": "건물등기",
  "registry-land": "토지등기",
  "building-ledger": "건축물대장",
  "appraisal-report": "감정평가서",
  "tenant-report": "매각물건명세서",
  "expected-dividend": "예상배당표",
  pdf: "원문PDF",
  json: "JSON",
};

export function sourceDocumentKindFileLabel(kind: CaseSourceDocumentKind): string {
  return KIND_FILE_LABEL[kind] ?? "원문";
}

/** `{사건번호}_{문서종류}.pdf` */
export function buildStoredPdfFileName(
  caseNumber: string,
  kind: CaseSourceDocumentKind,
): string {
  const cn = normalizeCaseNumber(caseNumber);
  const label = sourceDocumentKindFileLabel(kind);
  return `${cn}_${label}.pdf`;
}

/** `{사건번호}/{사건번호}_{문서종류}.pdf` */
export function buildStoredPdfRefPath(
  caseNumber: string,
  kind: CaseSourceDocumentKind,
): string {
  const cn = normalizeCaseNumber(caseNumber);
  const fileName = buildStoredPdfFileName(cn, kind);
  return `${cn}/${fileName}`;
}

export function resolveCaseNumberForStorage(
  caseNumber: string | null | undefined,
  extractedCaseNumber: string | null | undefined,
): string | null {
  const fromCase = caseNumber?.trim() ? normalizeCaseNumber(caseNumber) : "";
  if (fromCase) return fromCase;
  const fromPdf = extractedCaseNumber?.trim()
    ? normalizeCaseNumber(extractedCaseNumber)
    : "";
  return fromPdf || null;
}
