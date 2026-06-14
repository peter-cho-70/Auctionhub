import type { AuctionCase } from "@/lib/types/domain";
import { formatWonWithUnit } from "@/lib/format/won";

export type SpeedAuctionCaseDisplayMeta = {
  debtor: string | null;
  creditor: string | null;
  propertyType: string | null;
  landAppraisal: number | null;
  buildingAppraisal: number | null;
  ancillaryAppraisal: number | null;
  appraisalTotal: number | null;
  minPrice: number | null;
  minPriceRatePct: number | null;
  claimAmount: number | null;
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  currentRound: number | null;
  auctionType: string | null;
  auctionStatus: string | null;
  tenantCount: number | null;
  tenantDepositTotal: number | null;
  tenantMonthlyRentTotal: number | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function metaFromStructuredJson(raw: unknown): SpeedAuctionCaseDisplayMeta | null {
  const root = asRecord(raw);
  const ac = asRecord(root?.auction_case);
  if (!ac) return null;

  const parties = asRecord(ac.parties);
  const caseInfo = asRecord(ac.case_info);
  const property = asRecord(ac.property);
  const appraisal = asRecord(ac.appraisal);
  const land = asRecord(appraisal?.land);
  const building = asRecord(appraisal?.building);
  const saleSchedule = asRecord(ac.sale_schedule);
  const tenantTotals = asRecord(ac.tenant_totals);
  const tenants = ac.tenants;

  return {
    debtor: text(parties?.debtor),
    creditor: text(parties?.creditor),
    propertyType: text(property?.property_type),
    landAppraisal: num(land?.appraisal_value),
    buildingAppraisal: num(building?.appraisal_value),
    ancillaryAppraisal: num(appraisal?.ancillary_included_value),
    appraisalTotal: num(appraisal?.total_appraisal_value),
    minPrice: num(caseInfo?.min_price) ?? num(saleSchedule?.current_minimum_price),
    minPriceRatePct: num(saleSchedule?.min_price_rate_pct),
    claimAmount: num(caseInfo?.claim_amount),
    landAreaSqm: num(land?.area_sqm),
    buildingAreaSqm: num(building?.total_area_sqm),
    currentRound: num(saleSchedule?.current_round),
    auctionType: text(caseInfo?.auction_type),
    auctionStatus: text(caseInfo?.auction_status),
    tenantCount: Array.isArray(tenants) ? tenants.length : null,
    tenantDepositTotal: num(tenantTotals?.deposit_total),
    tenantMonthlyRentTotal: num(tenantTotals?.monthly_rent_total),
  };
}

/** 물건의 스피드옥션 PDF 원문에서 헤더·요약 표시용 메타 */
export function speedAuctionDisplayMetaForCase(
  c: Pick<AuctionCase, "sourceDocuments" | "appraisalPrice" | "minPrice">,
): SpeedAuctionCaseDisplayMeta | null {
  const docs = [...(c.sourceDocuments ?? [])].sort(
    (a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt),
  );
  for (const doc of docs) {
    if (
      doc.kind !== "speedauction-pdf" &&
      doc.kind !== "daejangauction-pdf" &&
      doc.kind !== "auctionone-pdf"
    )
      continue;
    const meta = metaFromStructuredJson(doc.structuredJson);
    if (meta) return meta;
  }
  return null;
}

export function formatAppraisalBreakdown(meta: SpeedAuctionCaseDisplayMeta): string {
  const total = meta.appraisalTotal;
  const parts: string[] = [];
  if (total != null) parts.push(`감정 ${formatWonWithUnit(total)}`);
  if (meta.landAppraisal != null) {
    parts.push(`토지 ${formatWonWithUnit(meta.landAppraisal)}`);
  }
  if (meta.buildingAppraisal != null) {
    parts.push(`건물 ${formatWonWithUnit(meta.buildingAppraisal)}`);
  }
  if (meta.ancillaryAppraisal != null) {
    parts.push(`제시외 ${formatWonWithUnit(meta.ancillaryAppraisal)}`);
  }
  return parts.join(" · ");
}

export function formatMinPriceLine(
  meta: SpeedAuctionCaseDisplayMeta,
  fallbackMin: number | null,
): string | null {
  const min = meta.minPrice ?? fallbackMin;
  if (min == null) return null;
  const rate =
    meta.minPriceRatePct != null ? ` (${meta.minPriceRatePct}%)` : "";
  return `최저 ${formatWonWithUnit(min)}${rate}`;
}
