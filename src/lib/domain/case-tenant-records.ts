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

export function mergeTenantRecordsFromPdf(
  existing: CaseTenantRecord[],
  c: AuctionCase,
): CaseTenantRecord[] {
  const rows = tenantRowsFromCase(c);
  if (!rows.length) return existing;
  const byUnit = new Map(existing.map((r) => [r.unit, r]));
  const out: CaseTenantRecord[] = [...existing];
  for (const row of rows) {
    const unit = textValue(row.unit) || textValue(row.name) || "호실";
    const prev = byUnit.get(unit);
    const opposing =
      row.has_opposing_power === true ||
      /대항|대항력/.test(textValue(row.notes));
    const patch: CaseTenantRecord = {
      ...(prev ?? createTenantRecord(unit)),
      unit,
      occupantName: textValue(row.name) || prev?.occupantName || "",
      deposit: numberValue(row.deposit) ?? prev?.deposit ?? null,
      monthlyRent:
        numberValue(row.monthly_rent) ?? prev?.monthlyRent ?? null,
      moveInDate:
        textValue(row.move_in_date) || prev?.moveInDate || "",
      confirmedDate:
        textValue(row.confirmed_date) || prev?.confirmedDate || "",
      dividendRequestDate:
        textValue(row.dividend_request_date) ||
        prev?.dividendRequestDate ||
        "",
      hasOpposingPower: opposing ? true : prev?.hasOpposingPower ?? null,
      updatedAt: new Date().toISOString(),
    };
    if (prev) {
      const idx = out.findIndex((r) => r.id === prev.id);
      if (idx >= 0) out[idx] = patch;
    } else {
      out.push(patch);
      byUnit.set(unit, patch);
    }
  }
  return out;
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
