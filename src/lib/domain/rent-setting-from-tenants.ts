import {
  numberValue,
  tenantRowsFromCase,
  textValue,
} from "@/lib/domain/case-document-payload";
import { refreshTenantRecordsFromCase } from "@/lib/domain/case-tenant-records";
import {
  compareTenantUnit,
  normalizeTenantUnit,
} from "@/lib/domain/tenant-spec-merge";
import {
  emptyRentSetting,
  newRentUnitRow,
  PYEONG_TO_SQM,
} from "@/lib/domain/rent-setting";
import type { AuctionCase, RentSettingUnitRow } from "@/lib/types/domain";

export type TenantContractIntent = "renew" | "vacate" | "relet" | "unknown";

export type TenantRentPrefillSource = {
  unit: string;
  floor: string;
  unitNo: string;
  roomType: string;
  deposit: number | null;
  monthlyRent: number | null;
  areaSqm: number | null;
  tenantName: string;
  note: string;
  remodelingPlanned: boolean | null;
  occupantName: string;
  contractIntent: TenantContractIntent;
};

export function parseRentUnitParts(rawUnit: string): {
  floor: string;
  unitNo: string;
} {
  const unit = textValue(rawUnit);
  if (!unit) return { floor: "", unitNo: "" };

  const basement = unit.match(
    /(?:지하|B)\s*(\d+)\s*층?\s*(\d{1,4})?\s*호?/i,
  );
  if (basement) {
    return {
      floor: `지하${basement[1]}층`,
      unitNo: basement[2] ? `${basement[2]}호` : unit,
    };
  }

  const floorUnit = unit.match(/(\d+)\s*층\s*(\d{1,4})\s*호?/);
  if (floorUnit) {
    return {
      floor: `${floorUnit[1]}층`,
      unitNo: `${floorUnit[2]}호`,
    };
  }

  const ho = unit.match(/(\d{1,4})\s*호/);
  if (ho) {
    const n = Number(ho[1]);
    if (Number.isFinite(n) && n >= 100) {
      return {
        floor: `${Math.floor(n / 100)}층`,
        unitNo: `${n}호`,
      };
    }
    return { floor: "", unitNo: `${ho[1]}호` };
  }

  return { floor: "", unitNo: unit };
}

export function resolveTenantContractIntent(
  row: Record<string, unknown>,
): TenantContractIntent {
  const explicit = textValue(row.field_contract_intent);
  if (
    explicit === "renew" ||
    explicit === "vacate" ||
    explicit === "relet" ||
    explicit === "unknown"
  ) {
    return explicit;
  }

  const occupancy = textValue(row.field_occupancy_status);
  if (occupancy === "vacant") return "vacate";
  if (occupancy === "occupied") return "renew";

  const hasName = !!textValue(row.name);
  const hasDeposit =
    numberValue(row.deposit) != null || numberValue(row.converted_deposit) != null;
  const hasRent = numberValue(row.monthly_rent) != null;
  if (hasName && (hasDeposit || hasRent)) return "renew";

  return "unknown";
}

function tenantRentNote(intent: TenantContractIntent): string {
  switch (intent) {
    case "renew":
      return "";
    case "vacate":
      return "퇴거·공실 예정";
    case "relet":
      return "신규임대(시세 재산정)";
    default:
      return "";
  }
}

function rentRowLabel(row: { floor: string; unitNo: string }): string {
  return [row.floor, row.unitNo].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function remodelingPlannedFromCase(
  c: AuctionCase,
  floor: string,
  unitNo: string,
): boolean | null {
  const label = rentRowLabel({ floor, unitNo });
  const key = normalizeTenantUnit(unitNo) || unitNo.trim();
  if (!label && !key) return null;
  const hit = c.remodeling.unitAssignments.find(
    (a) =>
      a.unitLabel === label ||
      a.unitKey === key ||
      (key && a.unitLabel.includes(key)),
  );
  return hit?.apply ?? null;
}

function tenantSourceFromRow(row: Record<string, unknown>): TenantRentPrefillSource | null {
  const unit = normalizeTenantUnit(row.unit) || textValue(row.unit);
  if (!unit) return null;

  const intent = resolveTenantContractIntent(row);
  const depositRaw = numberValue(row.deposit) ?? numberValue(row.converted_deposit);
  const monthlyRaw = numberValue(row.monthly_rent);
  const occupantName = textValue(row.name);
  const { floor, unitNo } = parseRentUnitParts(unit);

  let deposit = depositRaw;
  let monthlyRent = monthlyRaw;
  if (intent === "vacate" || intent === "relet") {
    deposit = null;
    monthlyRent = null;
  }

  const areaSqm = numberValue(row.area_sqm);
  /** 명도(세입자) 탭에서 계약=「계약연장」으로 지정된 경우에만 기존 임차인명 반영 */
  const tenantName =
    textValue(row.field_contract_intent) === "renew" ? occupantName : "";

  return {
    unit,
    floor,
    unitNo,
    roomType: textValue(row.room_type) || textValue(row.use) || "",
    deposit,
    monthlyRent,
    areaSqm: areaSqm != null && areaSqm > 0 ? areaSqm : null,
    tenantName,
    note: tenantRentNote(intent),
    remodelingPlanned: null,
    occupantName,
    contractIntent: intent,
  };
}

function tenantRecordToRow(
  record: AuctionCase["tenantRecords"][number],
): Record<string, unknown> {
  return {
    unit: record.unit,
    name: record.occupantName,
    deposit: record.deposit,
    monthly_rent: record.monthlyRent,
    field_occupancy_status: null,
    field_contract_intent: null,
    room_type: "",
    area_sqm: null,
  };
}

export function collectTenantRentPrefillSources(
  c: AuctionCase,
): TenantRentPrefillSource[] {
  const byUnit = new Map<string, TenantRentPrefillSource>();

  for (const row of tenantRowsFromCase(c)) {
    const source = tenantSourceFromRow(row);
    if (!source) continue;
    byUnit.set(source.unit, source);
  }

  const records =
    c.tenantRecords.length > 0
      ? c.tenantRecords
      : refreshTenantRecordsFromCase(c);
  for (const record of records) {
    const unit = normalizeTenantUnit(record.unit) || record.unit;
    if (!unit) continue;
    const row = tenantRecordToRow(record);
    const pdfRow = tenantRowsFromCase(c).find(
      (item) => (normalizeTenantUnit(item.unit) || textValue(item.unit)) === unit,
    );
    if (pdfRow) {
      for (const key of [
        "field_occupancy_status",
        "field_contract_intent",
        "room_type",
        "area_sqm",
        "name",
      ] as const) {
        if (!isBlank(pdfRow[key])) row[key] = pdfRow[key];
      }
      if (numberValue(pdfRow.deposit) != null) row.deposit = pdfRow.deposit;
      if (numberValue(pdfRow.monthly_rent) != null) {
        row.monthly_rent = pdfRow.monthly_rent;
      }
    }
    const source = tenantSourceFromRow(row);
    if (!source) continue;
    const prev = byUnit.get(unit);
    byUnit.set(unit, {
      ...source,
      deposit: source.deposit ?? prev?.deposit ?? null,
      monthlyRent: source.monthlyRent ?? prev?.monthlyRent ?? null,
      roomType: source.roomType || prev?.roomType || "",
      areaSqm: source.areaSqm ?? prev?.areaSqm ?? null,
      tenantName: source.tenantName || prev?.tenantName || "",
      note: source.note || prev?.note || "",
      remodelingPlanned:
        source.remodelingPlanned ?? prev?.remodelingPlanned ?? null,
    });
  }

  return [...byUnit.values()].sort((a, b) =>
    compareTenantUnit({ unit: a.unit }, { unit: b.unit }),
  );
}

function isBlank(value: unknown): boolean {
  return value == null || textValue(value) === "";
}

function unitRowMatchKey(row: RentSettingUnitRow): string {
  const unitNo = normalizeTenantUnit(row.unitNo) || textValue(row.unitNo);
  if (unitNo) return unitNo;
  const floor = textValue(row.floor);
  return floor ? `${floor}` : "";
}

function findRentRowIndex(
  rows: RentSettingUnitRow[],
  source: TenantRentPrefillSource,
): number {
  const sourceKey = normalizeTenantUnit(source.unit) || source.unitNo;
  const byUnit = rows.findIndex((row) => {
    const key = unitRowMatchKey(row);
    return key === sourceKey || textValue(row.unitNo) === source.unitNo;
  });
  if (byUnit >= 0) return byUnit;

  return rows.findIndex(
    (row) =>
      !textValue(row.unitNo).trim() &&
      row.deposit == null &&
      row.monthlyRent == null &&
      !textValue(row.floor).trim(),
  );
}

function sourceToUnitRowPatch(
  c: AuctionCase,
  source: TenantRentPrefillSource,
): Partial<RentSettingUnitRow> {
  const areaSqm = source.areaSqm;
  const areaPyeong =
    areaSqm != null && areaSqm > 0
      ? Math.round((areaSqm / PYEONG_TO_SQM) * 10) / 10
      : null;
  return {
    floor: source.floor,
    unitNo: source.unitNo,
    roomType: source.roomType,
    deposit: source.deposit,
    monthlyRent: source.monthlyRent,
    areaSqm,
    areaPyeong,
    tenantName: source.tenantName,
    remodelingPlanned:
      source.remodelingPlanned ??
      remodelingPlannedFromCase(c, source.floor, source.unitNo),
    note: source.note,
  };
}

export function hasMeaningfulRentUnitRows(
  rows: RentSettingUnitRow[] | undefined,
): boolean {
  if (!rows?.length) return false;
  return rows.some(
    (row) =>
      row.deposit != null ||
      row.monthlyRent != null ||
      textValue(row.unitNo).trim() !== "",
  );
}

export function countTenantRentPrefillSources(c: AuctionCase): number {
  return collectTenantRentPrefillSources(c).length;
}

export type RentPrefillMode = "fillEmpty" | "replaceMatched";

export function buildRentUnitRowsFromTenants(
  c: AuctionCase,
  existing?: RentSettingUnitRow[],
  mode: RentPrefillMode = "fillEmpty",
): RentSettingUnitRow[] {
  const sources = collectTenantRentPrefillSources(c);
  if (sources.length === 0) {
    return existing ?? emptyRentSetting().unitRows;
  }

  let rows = [...(existing ?? emptyRentSetting().unitRows)];
  while (rows.length < sources.length) {
    rows.push(newRentUnitRow());
  }

  for (const source of sources) {
    let idx = findRentRowIndex(rows, source);
    if (idx < 0) {
      rows.push(newRentUnitRow());
      idx = rows.length - 1;
    }

    const prev = rows[idx]!;
    const patch = sourceToUnitRowPatch(c, source);

    if (mode === "replaceMatched") {
      rows[idx] = { ...prev, ...patch };
      continue;
    }

    rows[idx] = {
      ...prev,
      floor: textValue(prev.floor).trim() ? prev.floor : (patch.floor ?? ""),
      unitNo: textValue(prev.unitNo).trim() ? prev.unitNo : (patch.unitNo ?? ""),
      roomType: textValue(prev.roomType).trim()
        ? prev.roomType
        : (patch.roomType ?? ""),
      deposit: prev.deposit ?? patch.deposit ?? null,
      monthlyRent: prev.monthlyRent ?? patch.monthlyRent ?? null,
      areaSqm: prev.areaSqm ?? patch.areaSqm ?? null,
      areaPyeong: prev.areaPyeong ?? patch.areaPyeong ?? null,
      tenantName: textValue(prev.tenantName).trim()
        ? prev.tenantName
        : (patch.tenantName ?? ""),
      remodelingPlanned:
        prev.remodelingPlanned ?? patch.remodelingPlanned ?? null,
      note: textValue(prev.note).trim() ? prev.note : (patch.note ?? ""),
    };
  }

  return rows;
}

export function applyRentSettingFromTenants(
  c: AuctionCase,
  mode: RentPrefillMode = "fillEmpty",
): AuctionCase["rentSetting"] {
  const base = c.rentSetting ?? emptyRentSetting();
  return {
    ...base,
    unitRows: buildRentUnitRowsFromTenants(c, base.unitRows, mode),
  };
}
