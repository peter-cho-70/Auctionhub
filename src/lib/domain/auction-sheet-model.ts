import {
  asRecord,
  getPrimaryAuctionPayload,
  numberValue,
  registryRightsFromCase,
  tenantRowsFromCase,
  textValue,
} from "@/lib/domain/case-document-payload";
import { extractCaseDocumentFacts } from "@/lib/domain/case-document-facts";
import { inferUnitsFromAppraisalFloors } from "@/lib/pdf/floor-unit-inference";
import type { AuctionCase } from "@/lib/types/domain";

export type AuctionSheetModel = {
  sourceSite: string;
  court: string;
  caseNumber: string;
  auctionType: string;
  auctionDivision: string;
  contactPhone: string;
  bidDate: string;
  minPrice: number | null;
  minPriceRatePct: number | null;
  appraisalTotal: number | null;
  landAppraisal: number | null;
  buildingAppraisal: number | null;
  ancillaryAppraisal: number | null;
  claimAmount: number | null;
  owner: string;
  debtor: string;
  creditor: string;
  addressFull: string;
  addressJibun: string;
  addressRoad: string;
  propertyType: string;
  zoning: string;
  saleTarget: string;
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  builtYear: string;
  parkingUnitCount: number | null;
  buildingCoverageRatio: string;
  floorAreaRatio: string;
  householdCount: number | null;
  residentialUnitCount: number | null;
  commercialUnitCount: number | null;
  lienBaseline: string;
  schedules: Array<{
    round: string;
    date: string;
    minimumPrice: number | null;
    result: string;
    isCurrent: boolean;
  }>;
  floors: Array<{
    floor: string;
    useType: string;
    areaSqm: number | null;
    appraisalPrice: number | null;
    unitCount: number;
  }>;
  tenants: Array<{
    rank: number;
    name: string;
    unit: string;
    use: string;
    deposit: number | null;
    monthlyRent: number | null;
  }>;
  tenantDepositTotal: number | null;
  tenantMonthlyRentTotal: number | null;
  buildingRights: Array<{
    no: string;
    date: string;
    type: string;
    holder: string;
    amount: number | null;
    note: string;
  }>;
  landRights: Array<{
    no: string;
    date: string;
    type: string;
    holder: string;
    amount: number | null;
    note: string;
  }>;
  notes: string;
  hasPdf: boolean;
};

function pickString(...values: unknown[]): string {
  for (const v of values) {
    const s = textValue(v);
    if (s) return s;
  }
  return "";
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = numberValue(v);
    if (n != null) return n;
  }
  return null;
}

function mapRights(rows: Record<string, unknown>[]) {
  return rows.map((r, i) => ({
    no: pickString(r.no) || String(i + 1),
    date: pickString(r.date),
    type: pickString(r.type),
    holder: pickString(r.holder),
    amount: numberValue(r.amount),
    note: pickString(r.note, r.extinguished ? "말소" : ""),
  }));
}

function mapTenants(rows: Record<string, unknown>[]) {
  return rows.map((r, i) => ({
    rank: numberValue(r.rank) ?? i + 1,
    name: pickString(r.name),
    unit: pickString(r.unit),
    use: pickString(r.use),
    deposit: numberValue(r.deposit),
    monthlyRent: numberValue(r.monthly_rent),
  }));
}

/** 케이스 + 원문 문서 → PDF형 1페이지 시트 모델 */
export function buildAuctionSheetModel(c: AuctionCase): AuctionSheetModel {
  const payload = getPrimaryAuctionPayload(c);
  const facts = extractCaseDocumentFacts(c.sourceDocuments ?? []);
  const meta = asRecord(payload?.meta);
  const caseInfo = asRecord(payload?.case_info);
  const parties = asRecord(payload?.parties);
  const property = asRecord(payload?.property);
  const address = asRecord(property?.address);
  const appraisal = asRecord(payload?.appraisal);
  const land = asRecord(appraisal?.land);
  const building = asRecord(appraisal?.building);
  const saleSchedule = asRecord(payload?.sale_schedule);
  const buildingSummary = asRecord(payload?.building_summary);
  const tenantTotals = asRecord(payload?.tenant_totals);

  const rawSchedules = Array.isArray(saleSchedule?.schedules)
    ? saleSchedule.schedules
    : [];
  const schedules = rawSchedules.map((item) => {
    const row = asRecord(item) ?? {};
    return {
      round: pickString(row.round),
      date: pickString(row.date),
      minimumPrice: numberValue(row.minimum_price),
      result: pickString(row.result),
      isCurrent: row.is_current === true,
    };
  });
  const currentSchedule =
    schedules.find((s) => s.isCurrent) ?? schedules[schedules.length - 1];

  const rawFloors = Array.isArray(appraisal?.floors) ? appraisal.floors : [];
  const inferredFloors = inferUnitsFromAppraisalFloors(rawFloors, "auction-pdf");
  const floors =
    inferredFloors.composition.length > 0
      ? inferredFloors.composition.map((row) => ({
          floor: row.floor,
          useType: row.useLabel,
          areaSqm: row.areaSqm,
          appraisalPrice: null as number | null,
          unitCount: row.unitCount,
        }))
      : rawFloors.flatMap((item) => {
          const row = asRecord(item);
          if (!row) return [];
          return [
            {
              floor: pickString(row.floor),
              useType: pickString(row.useType, row.use_type),
              areaSqm: numberValue(row.areaSqm ?? row.area_sqm),
              appraisalPrice: numberValue(row.appraisalPrice ?? row.appraisal_price),
              unitCount: 1,
            },
          ];
        });

  const tenantRows = tenantRowsFromCase(c);
  const buildingRights = mapRights(registryRightsFromCase(c, "building"));
  const landRights = mapRights(registryRightsFromCase(c, "land"));

  const hasAuctionPdf = (c.sourceDocuments ?? []).some((d) =>
    ["daejangauction-pdf", "speedauction-pdf", "auctionone-pdf"].includes(d.kind),
  );

  return {
    sourceSite: pickString(meta?.source_site),
    court: pickString(caseInfo?.court, meta?.court),
    caseNumber: pickString(caseInfo?.case_number, c.caseNumber),
    auctionType: pickString(caseInfo?.auction_type),
    auctionDivision: pickString(caseInfo?.auction_division),
    contactPhone: pickString(caseInfo?.contact_phone),
    bidDate: pickString(currentSchedule?.date, c.bidDate),
    minPrice: pickNumber(
      currentSchedule?.minimumPrice,
      caseInfo?.min_price,
      saleSchedule?.current_minimum_price,
      c.minPrice,
    ),
    minPriceRatePct: pickNumber(saleSchedule?.min_price_rate_pct),
    appraisalTotal: pickNumber(appraisal?.total_appraisal_value, c.appraisalPrice),
    landAppraisal: pickNumber(land?.appraisal_value),
    buildingAppraisal: pickNumber(building?.appraisal_value),
    ancillaryAppraisal: pickNumber(appraisal?.ancillary_included_value),
    claimAmount: pickNumber(caseInfo?.claim_amount),
    owner: pickString(parties?.owner),
    debtor: pickString(parties?.debtor),
    creditor: pickString(parties?.creditor),
    addressFull: pickString(address?.full, c.address),
    addressJibun: pickString(address?.jibun),
    addressRoad: pickString(address?.road),
    propertyType: pickString(property?.property_type, c.propertyType),
    zoning: pickString(property?.zoning),
    saleTarget: pickString(property?.sale_target),
    landAreaSqm: pickNumber(land?.area_sqm, facts.landAreaSqm, c.landAreaSqm),
    buildingAreaSqm: pickNumber(
      building?.total_area_sqm,
      appraisal?.building_total_area_sqm,
      facts.buildingAreaSqm,
      c.buildingAreaSqm,
    ),
    builtYear: pickString(
      buildingSummary?.approval_or_built_date,
      facts.builtYear,
      c.builtYear,
    ),
    parkingUnitCount: pickNumber(
      buildingSummary?.parking_unit_count,
      facts.parkingUnitCount,
      c.parkingUnitCount,
    ),
    buildingCoverageRatio: pickString(
      facts.buildingCoverageRatio,
      c.buildingCoverageRatio,
    ),
    floorAreaRatio: pickString(facts.floorAreaRatio, c.floorAreaRatio),
    householdCount: pickNumber(
      buildingSummary?.household_count_hint,
      facts.householdCount,
      c.householdCount,
    ),
    residentialUnitCount: pickNumber(
      buildingSummary?.residential_unit_count,
      facts.residentialUnitCount,
      c.residentialUnitCount,
    ),
    commercialUnitCount: pickNumber(
      buildingSummary?.commercial_unit_count,
      facts.commercialUnitCount,
      c.commercialUnitCount,
    ),
    lienBaseline: pickString(caseInfo?.lien_baseline, facts.lienBaseline, c.lienBaseline),
    schedules,
    floors,
    tenants: mapTenants(tenantRows),
    tenantDepositTotal: pickNumber(
      tenantTotals?.deposit_total,
      facts.totalDeposit > 0 ? facts.totalDeposit : null,
    ),
    tenantMonthlyRentTotal: pickNumber(
      tenantTotals?.monthly_rent_total,
      facts.totalMonthlyRent > 0 ? facts.totalMonthlyRent : null,
    ),
    buildingRights,
    landRights,
    notes: pickString(payload?.notes, c.memo),
    hasPdf: hasAuctionPdf,
  };
}
