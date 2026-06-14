import {
  arrayRecords,
  textValue,
} from "@/lib/domain/case-document-payload";

/** 매각물건명세서가 우선하는 필드 */
export const TENANT_SPEC_PRIORITY_FIELDS = [
  "name",
  "use",
  "move_in_date",
  "confirmed_date",
  "business_registration_date",
  "dividend_request_date",
  "deposit",
  "monthly_rent",
  "has_opposing_power",
  "dividend_rank",
  "lien_registered",
] as const;

/** 수동 입력·임장 조사가 우선하는 필드 */
export const TENANT_MANUAL_PRIORITY_FIELDS = [
  "field_occupancy_status",
  "field_contract_intent",
  "room_type",
  "area_sqm",
] as const;

const TENANT_METADATA_FROM_SPEC = [
  "key_date_base",
  "key_right_type",
  "bid_deadline",
  "status_summary",
] as const;

export function normalizeTenantUnit(raw: unknown): string {
  const value = textValue(raw).replace(/\s+/g, "");
  const m = value.match(/(\d{1,4})호/);
  return m ? `${m[1]}호` : value;
}

export function isBlankTenantValue(value: unknown): boolean {
  return value == null || value === "" || textValue(value) === "";
}

function extractFirstNumber(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function tenantUnitSortParts(tenant: Record<string, unknown>): {
  floor: number;
  room: number;
  label: string;
} {
  const label = textValue(tenant.unit) || textValue(tenant.floor) || textValue(tenant.room);
  if (!label) return { floor: 999, room: 999_999, label: "" };
  const normalized = label.replace(/\s/g, "").toUpperCase();
  const basement = normalized.match(/(?:지하|B)(\d+)/);
  if (basement) {
    const floor = Number(basement[1]);
    return {
      floor: Number.isFinite(floor) ? -floor : -1,
      room: extractFirstNumber(normalized) ?? 0,
      label,
    };
  }
  if (/옥탑|ROOF|루프/.test(normalized)) {
    return { floor: 998, room: extractFirstNumber(normalized) ?? 998_000, label };
  }
  const floorMatch = normalized.match(/(\d+)층/);
  const roomNumber = extractFirstNumber(normalized);
  const floor = floorMatch
    ? Number(floorMatch[1])
    : roomNumber != null && roomNumber >= 100
      ? Math.floor(roomNumber / 100)
      : 999;
  return {
    floor: Number.isFinite(floor) ? floor : 999,
    room: roomNumber ?? 999_999,
    label,
  };
}

export function compareTenantUnit(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const left = tenantUnitSortParts(a);
  const right = tenantUnitSortParts(b);
  if (left.floor !== right.floor) return left.floor - right.floor;
  if (left.room !== right.room) return left.room - right.room;
  return left.label.localeCompare(right.label, "ko");
}

export function sortTenantRowsByUnit(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return [...rows].sort(compareTenantUnit);
}

function stripAutoTenantNotes(notes: string): string {
  return notes
    .split(/\n{2,}/)
    .filter(
      (block) =>
        !block.startsWith("[매각물건명세서]") &&
        !block.startsWith("[명세서 값 충돌]") &&
        !block.startsWith("[수동 메모]"),
    )
    .join("\n\n")
    .trim();
}

function buildTenantNotes(
  specNotes: string,
  manualNotes: string,
): string {
  const parts = [
    specNotes ? `[매각물건명세서]\n${specNotes}` : "",
    manualNotes ? `[수동 메모]\n${manualNotes}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

function applyManualFieldsToSpecRow(
  target: Record<string, unknown>,
  existing: Record<string, unknown>,
) {
  for (const field of TENANT_MANUAL_PRIORITY_FIELDS) {
    if (!isBlankTenantValue(existing[field])) {
      target[field] = existing[field];
    }
  }
  const manualNotes = stripAutoTenantNotes(textValue(existing.notes));
  const specNotes = textValue(target.notes);
  target.notes = buildTenantNotes(specNotes, manualNotes);
}

/**
 * 매각물건명세서 기준으로 임차인 목록을 리셋합니다.
 * 명세서에 없는 호실은 제거되고, 동일 호실의 임장·방크기 등 수동 항목만 유지합니다.
 */
export function resetTenantRowsFromSpecification(
  existingRows: Record<string, unknown>[],
  incomingRows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const manualByUnit = new Map<string, Record<string, unknown>>();
  for (const row of existingRows) {
    const key = normalizeTenantUnit(row.unit);
    if (key) manualByUnit.set(key, row);
  }

  const resetRows = incomingRows.map((incoming) => {
    const row = { ...incoming };
    const unitKey = normalizeTenantUnit(incoming.unit);
    const existing = unitKey ? manualByUnit.get(unitKey) : undefined;
    if (existing) applyManualFieldsToSpecRow(row, existing);
    else {
      const specNotes = textValue(row.notes);
      row.notes = buildTenantNotes(specNotes, "");
    }
    return row;
  });

  return sortTenantRowsByUnit(resetRows);
}

export function applyTenantMetadataFromSpecification(
  targetRoot: Record<string, unknown>,
  specRoot: Record<string, unknown> | null | undefined,
) {
  if (!specRoot) return;
  for (const key of TENANT_METADATA_FROM_SPEC) {
    const value = specRoot[key];
    if (value != null && value !== "") {
      targetRoot[key] = value;
    }
  }
}

export function tenantRowsFromTenantRoot(
  tenantRoot: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  if (!tenantRoot) return [];
  return arrayRecords(tenantRoot.list);
}
