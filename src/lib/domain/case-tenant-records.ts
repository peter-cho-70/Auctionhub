import type {
  AuctionCase,
  CaseTenantRecord,
  TenantDividendStatus,
} from "@/lib/types/domain";
import {
  tenantRowsFromCase,
  textValue,
  numberValue,
} from "@/lib/domain/case-document-payload";
import type { ExpectedDividendPayload } from "@/lib/domain/tenant-dividend-display";
import { getExpectedDividendFromDocuments } from "@/lib/domain/tenant-dividend-display";
import {
  compareTenantUnit,
  normalizeTenantUnit,
  TENANT_SPEC_PRIORITY_FIELDS,
} from "@/lib/domain/tenant-spec-merge";

const DIVIDEND_STATUSES: TenantDividendStatus[] = [
  "full",
  "partial",
  "none",
  "unknown",
];

export const TENANT_DIVIDEND_STATUS_LABEL: Record<TenantDividendStatus, string> = {
  full: "전액 배당",
  partial: "일부 배당",
  none: "미배당",
  unknown: "미확인",
};

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatus(raw: unknown): TenantDividendStatus {
  return typeof raw === "string" &&
    (DIVIDEND_STATUSES as string[]).includes(raw)
    ? (raw as TenantDividendStatus)
    : "unknown";
}

function normalizeMoney(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  return null;
}

export function normalizeTenantRecords(raw: unknown): CaseTenantRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeTenantRecord(item))
    .filter((item): item is CaseTenantRecord => item != null);
}

export function normalizeTenantRecord(raw: unknown): CaseTenantRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const unit = typeof o.unit === "string" ? o.unit.trim() : "";
  if (!unit) return null;
  const now = new Date().toISOString();
  return {
    id:
      typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId(),
    unit,
    occupantName:
      typeof o.occupantName === "string" ? o.occupantName : "",
    deposit: normalizeMoney(o.deposit),
    monthlyRent: normalizeMoney(o.monthlyRent),
    moveInDate: typeof o.moveInDate === "string" ? o.moveInDate : "",
    confirmedDate: typeof o.confirmedDate === "string" ? o.confirmedDate : "",
    dividendRequestDate:
      typeof o.dividendRequestDate === "string" ? o.dividendRequestDate : "",
    hasOpposingPower:
      o.hasOpposingPower === true
        ? true
        : o.hasOpposingPower === false
          ? false
          : null,
    dividendAmount: normalizeMoney(o.dividendAmount),
    undividedAmount: normalizeMoney(o.undividedAmount),
    dividendStatus: normalizeStatus(o.dividendStatus),
    inquiryNotes: typeof o.inquiryNotes === "string" ? o.inquiryNotes : "",
    memo: typeof o.memo === "string" ? o.memo : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}

export function createTenantRecord(unit = ""): CaseTenantRecord {
  const now = new Date().toISOString();
  return {
    id: newId(),
    unit,
    occupantName: "",
    deposit: null,
    monthlyRent: null,
    moveInDate: "",
    confirmedDate: "",
    dividendRequestDate: "",
    hasOpposingPower: null,
    dividendAmount: null,
    undividedAmount: null,
    dividendStatus: "unknown",
    inquiryNotes: "",
    memo: "",
    updatedAt: now,
  };
}

function specFieldToTenantRecord(
  field: (typeof TENANT_SPEC_PRIORITY_FIELDS)[number],
  row: Record<string, unknown>,
  prev: CaseTenantRecord | undefined,
): Partial<CaseTenantRecord> {
  switch (field) {
    case "name":
      return { occupantName: textValue(row.name) || prev?.occupantName || "" };
    case "deposit":
      return { deposit: numberValue(row.deposit) ?? prev?.deposit ?? null };
    case "monthly_rent":
      return {
        monthlyRent: numberValue(row.monthly_rent) ?? prev?.monthlyRent ?? null,
      };
    case "move_in_date":
      return {
        moveInDate: textValue(row.move_in_date) || prev?.moveInDate || "",
      };
    case "confirmed_date":
      return {
        confirmedDate: textValue(row.confirmed_date) || prev?.confirmedDate || "",
      };
    case "dividend_request_date":
      return {
        dividendRequestDate:
          textValue(row.dividend_request_date) || prev?.dividendRequestDate || "",
      };
    case "has_opposing_power": {
      const opposing =
        row.has_opposing_power === true ||
        /대항|대항력/.test(textValue(row.notes));
      return {
        hasOpposingPower: opposing ? true : prev?.hasOpposingPower ?? null,
      };
    }
    default:
      return {};
  }
}

export function mergeTenantRecordsFromPdf(
  existing: CaseTenantRecord[],
  c: AuctionCase,
): CaseTenantRecord[] {
  const rows = tenantRowsFromCase(c);
  if (!rows.length) return existing;
  const byUnit = new Map(
    existing.map((r) => [normalizeTenantUnit(r.unit) || r.unit, r]),
  );
  const out: CaseTenantRecord[] = [];

  for (const row of rows) {
    const unit =
      normalizeTenantUnit(row.unit) ||
      textValue(row.unit) ||
      textValue(row.name) ||
      "호실";
    const prev = byUnit.get(unit);
    let patch: CaseTenantRecord = {
      ...(prev ?? createTenantRecord(unit)),
      unit,
      updatedAt: new Date().toISOString(),
    };
    for (const field of TENANT_SPEC_PRIORITY_FIELDS) {
      patch = { ...patch, ...specFieldToTenantRecord(field, row, prev) };
    }
    const memo = textValue(row.notes);
    if (memo) {
      patch.memo = prev?.memo?.trim() ? prev.memo : memo.slice(0, 200);
    }
    out.push(patch);
    byUnit.delete(unit);
  }

  return out.sort((a, b) =>
    compareTenantUnit({ unit: a.unit }, { unit: b.unit }),
  );
}

function normalizeOccupantName(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

export function syncTenantRecordsFromExpectedDividend(
  existing: CaseTenantRecord[],
  dividend: ExpectedDividendPayload,
  tenantRows: Record<string, unknown>[],
): CaseTenantRecord[] {
  const byName = new Map(
    existing.map((r) => [normalizeOccupantName(r.occupantName), r]),
  );
  const byUnit = new Map(existing.map((r) => [normalizeTenantUnit(r.unit) || r.unit, r]));
  const out = [...existing];

  for (const pdfRow of dividend.rows) {
    const nameKey = normalizeOccupantName(pdfRow.name);
    let record =
      byName.get(nameKey) ??
      tenantRows
        .map((row) => {
          const unit = normalizeTenantUnit(row.unit) || textValue(row.unit);
          const occupant = textValue(row.name);
          if (normalizeOccupantName(occupant) !== nameKey) return null;
          const prev = byUnit.get(unit);
          return (
            prev ?? {
              ...createTenantRecord(unit),
              unit,
              occupantName: occupant,
            }
          );
        })
        .find(Boolean);

    if (!record) {
      record = createTenantRecord("");
      record.occupantName = pdfRow.name;
    }

    const patch: CaseTenantRecord = {
      ...record,
      deposit: pdfRow.claim_amount > 0 ? pdfRow.claim_amount : record.deposit,
      dividendAmount: pdfRow.dividend_amount,
      undividedAmount: pdfRow.undivided_amount,
      dividendStatus: pdfRow.status,
      memo: pdfRow.note ? pdfRow.note.slice(0, 200) : record.memo,
      updatedAt: new Date().toISOString(),
    };

    const idx = out.findIndex((r) => r.id === record!.id);
    if (idx >= 0) out[idx] = patch;
    else out.push(patch);

    byName.set(nameKey, patch);
  }

  return out.sort((a, b) =>
    compareTenantUnit({ unit: a.unit }, { unit: b.unit }),
  );
}

export function refreshTenantRecordsFromCase(c: AuctionCase): CaseTenantRecord[] {
  let records = mergeTenantRecordsFromPdf(c.tenantRecords, c);
  const expected = getExpectedDividendFromDocuments(c.sourceDocuments);
  if (expected?.rows.length) {
    records = syncTenantRecordsFromExpectedDividend(
      records,
      expected,
      tenantRowsFromCase(c),
    );
  }
  return records;
}

export function summarizeTenantRecordDividends(records: CaseTenantRecord[]) {
  return {
    full: records.filter((r) => r.dividendStatus === "full").length,
    partial: records.filter((r) => r.dividendStatus === "partial").length,
    none: records.filter((r) => r.dividendStatus === "none").length,
    unknown: records.filter((r) => r.dividendStatus === "unknown").length,
  };
}

export function tenantRecordsForReport(
  c: AuctionCase,
): CaseTenantRecord[] {
  if (c.tenantRecords.length > 0) return c.tenantRecords;
  return tenantRowsFromCase(c).map((row) => {
    const unit = textValue(row.unit) || "—";
    const opposing =
      row.has_opposing_power === true ||
      /대항|대항력/.test(textValue(row.notes));
    return {
      ...createTenantRecord(unit),
      unit,
      occupantName: textValue(row.name),
      deposit: numberValue(row.deposit),
      monthlyRent: numberValue(row.monthly_rent),
      moveInDate: textValue(row.move_in_date),
      confirmedDate: textValue(row.confirmed_date),
      dividendRequestDate: textValue(row.dividend_request_date),
      hasOpposingPower: opposing ? true : null,
      memo: textValue(row.notes).slice(0, 200),
    };
  });
}
