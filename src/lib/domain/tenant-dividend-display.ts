import { textValue } from "@/lib/domain/case-document-payload";
import type { ParsedExpectedDividendRow } from "@/lib/pdf/expected-dividend-parser";
import type { CaseSourceDocument, CaseTenantRecord } from "@/lib/types/domain";
import type { TenantDividendStatus } from "@/lib/types/domain";

export type TenantDistributionView = {
  status: TenantDividendStatus | "no_request";
  estimatedAmount: number | null;
  ratioPct: number | null;
  note: string;
  source: "computed" | "expected-dividend-pdf";
};

export type ExpectedDividendPayload = {
  bid_price: number | null;
  case_number: string | null;
  address: string | null;
  rows: ParsedExpectedDividendRow[];
};

function normalizePersonName(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

export function getExpectedDividendFromDocuments(
  documents: CaseSourceDocument[],
): ExpectedDividendPayload | null {
  for (const doc of documents) {
    if (doc.kind !== "expected-dividend") continue;
    const root = doc.structuredJson;
    if (!root || typeof root !== "object") continue;
    const document = (root as Record<string, unknown>).document;
    if (!document || typeof document !== "object") continue;
    const expected = (document as Record<string, unknown>).expected_dividend;
    if (!expected || typeof expected !== "object") continue;
    const payload = expected as Record<string, unknown>;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return {
      bid_price:
        typeof payload.bid_price === "number" && Number.isFinite(payload.bid_price)
          ? Math.round(payload.bid_price)
          : null,
      case_number:
        typeof payload.case_number === "string" ? payload.case_number : null,
      address: typeof payload.address === "string" ? payload.address : null,
      rows: rows
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const name = textValue(r.name);
          if (!name) return null;
          return {
            name,
            right_type: textValue(r.right_type) || "주거임차인",
            claim_amount:
              typeof r.claim_amount === "number" ? Math.round(r.claim_amount) : 0,
            dividend_amount:
              typeof r.dividend_amount === "number"
                ? Math.round(r.dividend_amount)
                : 0,
            undivided_amount:
              typeof r.undivided_amount === "number"
                ? Math.round(r.undivided_amount)
                : 0,
            status:
              r.status === "full" ||
              r.status === "partial" ||
              r.status === "none" ||
              r.status === "unknown"
                ? r.status
                : "unknown",
            note: textValue(r.note),
          } satisfies ParsedExpectedDividendRow;
        })
        .filter((row): row is ParsedExpectedDividendRow => row != null),
    };
  }
  return null;
}

function findPdfDividendRow(
  tenant: Record<string, unknown>,
  rows: ParsedExpectedDividendRow[],
): ParsedExpectedDividendRow | null {
  const tenantName = normalizePersonName(textValue(tenant.name));
  if (!tenantName) return null;
  return (
    rows.find((row) => normalizePersonName(row.name) === tenantName) ??
    rows.find((row) => tenantName.includes(normalizePersonName(row.name))) ??
    null
  );
}

export function resolveTenantDistributionView(args: {
  tenant: Record<string, unknown>;
  computed: TenantDistributionView;
  pdfRows: ParsedExpectedDividendRow[];
  bidPrice: number | null;
}): TenantDistributionView {
  const pdfRow = findPdfDividendRow(args.tenant, args.pdfRows);
  if (!pdfRow) return args.computed;

  const deposit = pdfRow.claim_amount || (Number(args.tenant.deposit) || 0);
  const ratioPct =
    deposit > 0 ? (pdfRow.dividend_amount / deposit) * 100 : null;
  const noteParts = [
    args.bidPrice != null ? `예상배당표 · 입찰가 ${args.bidPrice.toLocaleString("ko-KR")}원` : "예상배당표",
    pdfRow.note,
  ].filter(Boolean);

  let status: TenantDistributionView["status"] = pdfRow.status;
  if (!textValue(args.tenant.dividend_request_date) && deposit > 0) {
    status = pdfRow.dividend_amount > 0 ? pdfRow.status : "no_request";
  }

  return {
    status,
    estimatedAmount: pdfRow.dividend_amount,
    ratioPct,
    note: noteParts.join(" · "),
    source: "expected-dividend-pdf",
  };
}

export type TenantNameTone = "success" | "warning" | "risk" | undefined;

export function tenantNameToneFromDistribution(args: {
  tenantName: string;
  distribution: TenantDistributionView | undefined;
  isHousingCorp?: boolean;
}): TenantNameTone {
  if (args.isHousingCorp) return "success";
  if (!args.distribution) return undefined;
  switch (args.distribution.status) {
    case "full":
      return "success";
    case "partial":
      return "warning";
    case "none":
    case "no_request":
      return "risk";
    default:
      return undefined;
  }
}

export function isHousingCorporationTenantName(name: string): boolean {
  return /(주택공사|한국토지주택공사|\bLH\b|엘에이치)/i.test(name);
}

export function tenantRecordNameTone(record: CaseTenantRecord): TenantNameTone {
  if (isHousingCorporationTenantName(record.occupantName)) return "success";
  switch (record.dividendStatus) {
    case "full":
      return "success";
    case "partial":
      return "warning";
    case "none":
      return "risk";
    default:
      return !record.dividendRequestDate.trim() && (record.deposit ?? 0) > 0
        ? "risk"
        : undefined;
  }
}

export function distributionStatusLabel(
  status: TenantDistributionView["status"],
): string {
  switch (status) {
    case "full":
      return "전액 배당";
    case "partial":
      return "일부 배당";
    case "none":
      return "미배당";
    case "no_request":
      return "배당요구 없음";
    default:
      return "미확인";
  }
}
