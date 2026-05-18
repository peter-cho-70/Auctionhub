import type {
  AuctionCase,
  BuildingUnitComposition,
  BuildingUnitUseType,
  CaseSourceDocument,
} from "@/lib/types/domain";

export type CaseDocumentFactTone = "good" | "warn" | "risk" | "neutral";

export interface CaseDocumentFactSummary {
  label: string;
  value: string;
  tone: CaseDocumentFactTone;
}

export interface CaseDocumentFacts {
  caseNumber: string | null;
  address: string | null;
  propertyType: string | null;
  builtYear: string | null;
  floor: string | null;
  householdCount: number | null;
  residentialUnitCount: number | null;
  commercialUnitCount: number | null;
  buildingUnitComposition: BuildingUnitComposition[];
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  parkingUnitCount: number | null;
  hasBuildingViolation: boolean | null;
  buildingCoverageRatio: string | null;
  floorAreaRatio: string | null;
  appraisalPrice: number | null;
  minPrice: number | null;
  bidDate: string | null;
  lienBaseline: string | null;
  tenantCount: number | null;
  totalDeposit: number;
  totalMonthlyRent: number;
  mortgageAmount: number;
  buildingLedgerUnits: number | null;
  buildingLedgerFloors: string | null;
  summaries: CaseDocumentFactSummary[];
}

export function extractCaseDocumentFacts(
  documents: CaseSourceDocument[],
): CaseDocumentFacts {
  const facts: CaseDocumentFacts = {
    caseNumber: null,
    address: null,
    propertyType: null,
    builtYear: null,
    floor: null,
    householdCount: null,
    residentialUnitCount: null,
    commercialUnitCount: null,
    buildingUnitComposition: [],
    landAreaSqm: null,
    buildingAreaSqm: null,
    parkingUnitCount: null,
    hasBuildingViolation: null,
    buildingCoverageRatio: null,
    floorAreaRatio: null,
    appraisalPrice: null,
    minPrice: null,
    bidDate: null,
    lienBaseline: null,
    tenantCount: null,
    totalDeposit: 0,
    totalMonthlyRent: 0,
    mortgageAmount: 0,
    buildingLedgerUnits: null,
    buildingLedgerFloors: null,
    summaries: [],
  };

  for (const doc of documents) {
    const root = asRecord(doc.structuredJson);
    const auctionCase = asRecord(root?.auction_case);
    const document = asRecord(root?.document);

    if (auctionCase) {
      mergeAuctionCaseFacts(facts, auctionCase);
    }

    const buildingLedger = asRecord(document?.building_info_official);
    if (buildingLedger) {
      mergeBuildingLedgerFacts(facts, buildingLedger);
    }

    const appraisalReport = asRecord(document?.appraisal_report);
    if (appraisalReport) {
      assignNumber(facts, "appraisalPrice", appraisalReport.total_appraisal_value);
      assignNumber(facts, "landAreaSqm", appraisalReport.land_area_sqm);
      assignNumber(facts, "buildingAreaSqm", appraisalReport.building_total_area_sqm);
    }

    const tenants = asRecord(document?.tenants);
    if (tenants) {
      mergeTenantFacts(facts, tenants);
    }

    const registry = asRecord(document?.registry);
    if (registry) {
      mergeRegistryFacts(facts, registry);
    }
  }

  facts.summaries = buildFactSummaries(facts);
  return facts;
}

export function buildCasePatchFromDocumentFacts(
  c: AuctionCase,
  facts: CaseDocumentFacts,
): Partial<AuctionCase> {
  const patch: Partial<AuctionCase> = {};
  if (!c.caseNumber && facts.caseNumber) patch.caseNumber = facts.caseNumber;
  if (!c.address && facts.address) patch.address = facts.address;
  if (!c.propertyType && facts.propertyType) patch.propertyType = facts.propertyType;
  if (!c.builtYear && facts.builtYear) patch.builtYear = facts.builtYear;
  if (!c.floor && facts.floor) patch.floor = facts.floor;
  if (c.householdCount == null && facts.householdCount != null) {
    patch.householdCount = facts.householdCount;
  }
  if (facts.residentialUnitCount != null) {
    patch.residentialUnitCount = facts.residentialUnitCount;
    patch.householdCount = facts.residentialUnitCount;
  }
  if (facts.commercialUnitCount != null) {
    patch.commercialUnitCount = facts.commercialUnitCount;
  }
  if (facts.buildingUnitComposition.length > 0) {
    patch.buildingUnitComposition = facts.buildingUnitComposition;
  }
  if (c.landAreaSqm == null && facts.landAreaSqm != null) {
    patch.landAreaSqm = facts.landAreaSqm;
  }
  if (c.buildingAreaSqm == null && facts.buildingAreaSqm != null) {
    patch.buildingAreaSqm = facts.buildingAreaSqm;
  }
  if (c.parkingUnitCount == null && facts.parkingUnitCount != null) {
    patch.parkingUnitCount = facts.parkingUnitCount;
  }
  if (!c.buildingCoverageRatio && facts.buildingCoverageRatio) {
    patch.buildingCoverageRatio = facts.buildingCoverageRatio;
  }
  if (!c.floorAreaRatio && facts.floorAreaRatio) {
    patch.floorAreaRatio = facts.floorAreaRatio;
  }
  if (c.hasBuildingViolation === false && facts.hasBuildingViolation === true) {
    patch.hasBuildingViolation = true;
  }
  if (c.appraisalPrice == null && facts.appraisalPrice != null) {
    patch.appraisalPrice = facts.appraisalPrice;
  }
  if (c.minPrice == null && facts.minPrice != null) {
    patch.minPrice = facts.minPrice;
  }
  if (c.expectedBidPrice == null) {
    const basis = facts.appraisalPrice ?? c.appraisalPrice;
    if (basis != null) patch.expectedBidPrice = Math.round(basis * 0.7);
  }
  if (c.bidDate == null && facts.bidDate) patch.bidDate = facts.bidDate;
  if (!c.lienBaseline && facts.lienBaseline) patch.lienBaseline = facts.lienBaseline;
  return patch;
}

function mergeAuctionCaseFacts(
  facts: CaseDocumentFacts,
  payload: Record<string, unknown>,
) {
  const caseInfo = asRecord(payload.case_info);
  const property = asRecord(payload.property);
  const address = asRecord(property?.address);
  const appraisal = asRecord(payload.appraisal);
  const land = asRecord(appraisal?.land);
  const saleSchedule = asRecord(payload.sale_schedule);
  const buildingSummary = asRecord(payload.building_summary);
  const tenants = asRecord(payload.tenants);
  const buildingRegistry = asRecord(payload.building_registry);
  const landRegistry = asRecord(payload.land_registry);
  const schedules = Array.isArray(saleSchedule?.schedules)
    ? saleSchedule.schedules.map(asRecord).filter(Boolean)
    : [];
  const currentSchedule =
    schedules.find((x) => x?.is_current === true) ?? schedules[0] ?? null;

  assignString(facts, "caseNumber", caseInfo?.case_number);
  assignString(facts, "address", address?.full);
  assignString(facts, "propertyType", property?.property_type);
  assignString(facts, "builtYear", buildingSummary?.approval_or_built_date);
  assignNumber(facts, "parkingUnitCount", buildingSummary?.parking_unit_count);
  assignNumber(facts, "appraisalPrice", appraisal?.total_appraisal_value);
  assignNumber(facts, "landAreaSqm", land?.area_sqm);
  assignNumber(facts, "buildingAreaSqm", appraisal?.building_total_area_sqm);
  assignNumber(facts, "minPrice", currentSchedule?.minimum_price);
  assignString(facts, "bidDate", currentSchedule?.date);
  if (tenants) mergeTenantFacts(facts, tenants);
  if (buildingRegistry) mergeRegistryFacts(facts, buildingRegistry);
  if (landRegistry) mergeRegistryFacts(facts, landRegistry);
}

function mergeBuildingLedgerFacts(
  facts: CaseDocumentFacts,
  ledger: Record<string, unknown>,
) {
  assignString(facts, "address", ledger.address);
  assignString(facts, "propertyType", ledger.building_type);
  assignNumber(facts, "householdCount", ledger.units);
  assignNumber(facts, "residentialUnitCount", ledger.residential_units);
  assignNumber(facts, "commercialUnitCount", ledger.commercial_units);
  mergeBuildingUnitComposition(facts, ledger.unit_composition);
  assignNumber(facts, "landAreaSqm", ledger.land_area_sqm);
  assignNumber(facts, "buildingAreaSqm", ledger.total_area_sqm);
  assignNumber(facts, "parkingUnitCount", ledger.total_parking);
  assignString(facts, "builtYear", ledger.approval_date);
  assignRatio(facts, "buildingCoverageRatio", ledger.building_coverage_ratio_pct);
  assignRatio(facts, "floorAreaRatio", ledger.floor_area_ratio_pct);

  const above = numberValue(ledger.floors_above_ground);
  const below = numberValue(ledger.floors_below_ground);
  const floor = [
    below != null && below > 0 ? `지하 ${below}층` : "",
    above != null && above > 0 ? `지상 ${above}층` : "",
  ].filter(Boolean).join(" / ");
  if (!facts.floor && floor) facts.floor = floor;
  if (floor) facts.buildingLedgerFloors = floor;
  facts.buildingLedgerUnits ??= numberValue(ledger.units);

  const violation = textValue(ledger.violation_note);
  if (violation) facts.hasBuildingViolation = true;
}

function mergeTenantFacts(
  facts: CaseDocumentFacts,
  tenants: Record<string, unknown>,
) {
  const list = Array.isArray(tenants.list)
    ? tenants.list.map(asRecord).filter(Boolean)
    : [];
  const count = numberValue(tenants.total_count) ?? (list.length || null);
  if (count != null && (facts.tenantCount == null || count > facts.tenantCount)) {
    facts.tenantCount = count;
  }
  const residentialCount = list.filter((tenant) =>
    /주거|주택|거주/.test(textValue(tenant?.use)),
  ).length;
  const commercialCount = list.filter((tenant) =>
    /점포|상가|사업자|근린/.test(textValue(tenant?.use)),
  ).length;
  if (residentialCount > 0) {
    facts.residentialUnitCount = Math.max(
      facts.residentialUnitCount ?? 0,
      residentialCount,
    );
  }
  if (commercialCount > 0) {
    facts.commercialUnitCount = Math.max(
      facts.commercialUnitCount ?? 0,
      commercialCount,
    );
  }
  const totalDeposit =
    numberValue(tenants.total_deposit) ??
    list.reduce((sum, tenant) => sum + (numberValue(tenant?.deposit) ?? 0), 0);
  const totalMonthlyRent =
    numberValue(tenants.total_monthly_rent) ??
    list.reduce((sum, tenant) => sum + (numberValue(tenant?.monthly_rent) ?? 0), 0);
  facts.totalDeposit = Math.max(facts.totalDeposit, totalDeposit);
  facts.totalMonthlyRent = Math.max(facts.totalMonthlyRent, totalMonthlyRent);
  const keyDate = textValue(tenants.key_date_base);
  const keyRight = textValue(tenants.key_right_type);
  if (!facts.lienBaseline && keyDate) {
    facts.lienBaseline = [keyDate, keyRight].filter(Boolean).join(" ");
  }
}

function mergeBuildingUnitComposition(
  facts: CaseDocumentFacts,
  raw: unknown,
) {
  if (!Array.isArray(raw)) return;
  const rows = raw.flatMap((item, index): BuildingUnitComposition[] => {
    const row = asRecord(item);
    if (!row) return [];
    const useType = normalizeUseType(row.useType);
    const unitCount = numberValue(row.unitCount) ?? 0;
    const areaSqm = numberValue(row.areaSqm);
    return [
      {
        id: textValue(row.id) || `ledger-unit-${index + 1}`,
        floor: textValue(row.floor),
        useType,
        useLabel: textValue(row.useLabel),
        areaSqm,
        unitCount: Math.max(0, Math.floor(unitCount)),
        source: textValue(row.source) || "building-ledger",
      },
    ];
  });
  if (rows.length === 0) return;
  facts.buildingUnitComposition = rows;
  const residential = rows
    .filter((row) => row.useType === "residential")
    .reduce((sum, row) => sum + row.unitCount, 0);
  const commercial = rows
    .filter((row) => row.useType === "commercial")
    .reduce((sum, row) => sum + row.unitCount, 0);
  if (residential > 0) facts.residentialUnitCount = residential;
  if (commercial > 0) facts.commercialUnitCount = commercial;
}

function normalizeUseType(raw: unknown): BuildingUnitUseType {
  return raw === "residential" || raw === "commercial" || raw === "other"
    ? raw
    : "other";
}

function mergeRegistryFacts(
  facts: CaseDocumentFacts,
  registry: Record<string, unknown>,
) {
  const rights = Array.isArray(registry.rights)
    ? registry.rights.map(asRecord).filter(Boolean)
    : [];
  const mortgageAmount = rights.reduce((sum, right) => {
    const type = textValue(right?.type);
    if (!/근저당|저당/.test(type)) return sum;
    return sum + (numberValue(right?.amount) ?? 0);
  }, 0);
  facts.mortgageAmount += mortgageAmount;
}

function buildFactSummaries(facts: CaseDocumentFacts): CaseDocumentFactSummary[] {
  const summaries: CaseDocumentFactSummary[] = [];
  if (facts.buildingLedgerFloors || facts.floor) {
    summaries.push({
      label: "층수",
      value: facts.buildingLedgerFloors ?? facts.floor!,
      tone: "neutral",
    });
  }
  if (facts.householdCount != null || facts.tenantCount != null) {
    const parts = [
      facts.residentialUnitCount != null ? `주택 ${facts.residentialUnitCount}호` : "",
      facts.commercialUnitCount != null ? `상가 ${facts.commercialUnitCount}개` : "",
      facts.householdCount != null ? `공부 ${facts.householdCount}가구` : "",
      facts.tenantCount != null ? `임차 ${facts.tenantCount}명` : "",
    ].filter(Boolean);
    summaries.push({
      label: "가구/임차",
      value: parts.join(" / "),
      tone:
        facts.householdCount != null &&
        facts.tenantCount != null &&
        facts.tenantCount > facts.householdCount
          ? "warn"
          : "neutral",
    });
  }
  if (facts.parkingUnitCount != null) {
    const shortage =
      facts.householdCount != null && facts.parkingUnitCount < facts.householdCount;
    summaries.push({
      label: "주차",
      value:
        facts.householdCount != null
          ? `${facts.parkingUnitCount}대 / ${facts.householdCount}가구`
          : `${facts.parkingUnitCount}대`,
      tone: shortage ? "warn" : facts.parkingUnitCount >= 10 ? "good" : "neutral",
    });
  }
  if (facts.builtYear) {
    summaries.push({
      label: "사용승인",
      value: facts.builtYear,
      tone: approvalTone(facts.builtYear),
    });
  }
  if (facts.appraisalPrice != null) {
    const totalClaims = facts.totalDeposit + facts.mortgageAmount;
    if (totalClaims > 0) {
      summaries.push({
        label: "보증금+근저당",
        value: `${formatWon(totalClaims)} / 감정가 ${formatWon(facts.appraisalPrice)}`,
        tone: totalClaims > facts.appraisalPrice ? "risk" : "neutral",
      });
    }
  }
  if (facts.buildingAreaSqm != null) {
    summaries.push({
      label: "연면적",
      value: `${facts.buildingAreaSqm.toLocaleString("ko-KR")}㎡`,
      tone: facts.buildingAreaSqm >= 500 ? "good" : "neutral",
    });
  }
  return summaries.slice(0, 8);
}

function assignString<K extends keyof CaseDocumentFacts>(
  facts: CaseDocumentFacts,
  key: K,
  raw: unknown,
) {
  if (facts[key] != null && facts[key] !== "") return;
  const value = textValue(raw);
  if (value) {
    (facts[key] as CaseDocumentFacts[K]) = value as CaseDocumentFacts[K];
  }
}

function assignNumber<K extends keyof CaseDocumentFacts>(
  facts: CaseDocumentFacts,
  key: K,
  raw: unknown,
) {
  if (facts[key] != null) return;
  const value = numberValue(raw);
  if (value != null) {
    (facts[key] as CaseDocumentFacts[K]) = value as CaseDocumentFacts[K];
  }
}

function assignRatio<K extends keyof CaseDocumentFacts>(
  facts: CaseDocumentFacts,
  key: K,
  raw: unknown,
) {
  if (facts[key] != null && facts[key] !== "") return;
  const value = numberValue(raw);
  if (value != null) {
    (facts[key] as CaseDocumentFacts[K]) = `${value}%` as CaseDocumentFacts[K];
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function textValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function numberValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function approvalTone(raw: string): CaseDocumentFactTone {
  const year = Number(raw.match(/(19|20)\d{2}/)?.[0]);
  if (!Number.isFinite(year)) return "neutral";
  const age = new Date().getFullYear() - year;
  if (age < 5) return "good";
  if (age >= 15) return "risk";
  return "neutral";
}

function formatWon(v: number): string {
  if (v >= 100_000_000) {
    return `${Math.round((v / 100_000_000) * 10) / 10}억`;
  }
  if (v >= 10_000) {
    return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  }
  return v.toLocaleString("ko-KR");
}
