import { normalizeStoredManwon } from "@/lib/format/manwon";
import type {
  BuildingManagementContact,
  FieldContactDistance,
  FieldInspectionRecord,
  ManagementOfficeLocation,
  ManagementServiceScopeKey,
  NearbyBrokerContact,
} from "@/lib/types/domain";

export const MAX_NEARBY_BROKERS = 8;

export const FIELD_CONTACT_DISTANCE_LABEL: Record<FieldContactDistance, string> = {
  within_100m: "100m 이내",
  within_250m: "250m 이내",
  within_500m: "500m 이내",
  same_block: "같은 블록",
  unknown: "미확인",
};

export const MANAGEMENT_SERVICE_SCOPES: {
  key: ManagementServiceScopeKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "cleaning",
    label: "청소·공용부",
    hint: "복도·계단 청소 상태는 공실 체감과 임차인 만족도에 직결됩니다.",
  },
  {
    key: "vacant_access",
    label: "공실 출입",
    hint: "낙찰 직후 내부 점검·수리 계획에 비밀번호·열쇠 확보가 필요합니다.",
  },
  {
    key: "repair_coordination",
    label: "수리·하자 조율",
    hint: "과거 누수·방수·창호 수리 이력은 수리비 추정의 근거가 됩니다.",
  },
  {
    key: "arrears_ledger",
    label: "관리비·미납대장",
    hint: "공실이 많아 보여도 미납 패턴이면 실제 거주·관리 상태를 검증할 수 있습니다.",
  },
  {
    key: "tenant_contact",
    label: "임차인·민원",
    hint: "명도·재계약 협의 시 관리인 연락망이 있으면 리스크가 줄어듭니다.",
  },
  {
    key: "remote_management",
    label: "원격 관리",
    hint: "사진·CCTV·비대면 점검 가능 여부는 원거리 운영 시 중요합니다.",
  },
  {
    key: "rent_leasing",
    label: "임대·재계약",
    hint: "낙찰 후 임대 대행 가능 여부는 실투자금 회수 속도에 영향을 줍니다.",
  },
  {
    key: "other",
    label: "기타",
    hint: "위 항목에 없는 업무는 메모에 구체적으로 적어 두세요.",
  },
];

export const FIELD_INSPECTION_HINTS = {
  visitMeta:
    "임장 일시·동행을 남기면 나중에 「그때 누가 봤는지」, 손품 시점과 시세 변동을 대조할 수 있습니다.",
  buildingManagement:
    "강의 6단계 임장: 관리업체는 청소·공실 비밀번호·수리 이력·미납대장·원격 관리 가능성을 확인하는 핵심 창구입니다.",
  nearbyBrokers:
    "주변 부동산 5곳 이상 손품이 권장됩니다. 거리(100m·250m)를 나누면 가까운 곳의 호가 왜곡과 먼 곳의 시세를 구분할 수 있습니다.",
  cleaningCompany:
    "청소·관리가 분리된 건물이 많습니다. 청소 업체 연락처는 공실 준비·입주 전 청소 견적에 씁니다.",
  managementOfficeLocation:
    "관리실이 건물 안/밖인지에 따라 열쇠·민원·점검 동선이 달라집니다.",
  vacantAccess:
    "공실 호실 번호와 출입 방법을 적어 두면 낙찰 후 즉시 내부 확인·리모델링 견적이 빨라집니다.",
  fieldMemo:
    "구조화 필드에 넣지 않은 현장 소견·사진 위치·특이사항을 자유롭게 기록합니다.",
} as const;

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `broker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBuildingManagement(): BuildingManagementContact {
  return {
    companyName: "",
    contactName: "",
    phone: "",
    serviceScopes: [],
    serviceScopeOther: "",
    monthlyFeePerUnitManwon: null,
    vacantAccessAvailable: null,
    arrearsLedgerAvailable: null,
    remoteManagement: null,
    postAuctionCooperation: null,
    visitedAt: null,
    reliabilityScore: null,
    memo: "",
  };
}

export function emptyNearbyBroker(): NearbyBrokerContact {
  return {
    id: newId(),
    agencyName: "",
    ownerName: "",
    phone: "",
    distance: "unknown",
    isMultifamilySpecialist: null,
    rentOpinion: "",
    saleOpinion: "",
    willManageAfterAcquisition: null,
    contactedAt: null,
    memo: "",
  };
}

export function emptyFieldInspection(): FieldInspectionRecord {
  return {
    visitDate: null,
    visitDurationMin: null,
    companions: "",
    buildingManagement: emptyBuildingManagement(),
    nearbyBrokers: [],
    cleaningCompanyName: "",
    cleaningCompanyPhone: "",
    managementOfficeLocation: null,
    vacantUnitAccessNote: "",
    memo: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDistance(raw: unknown): FieldContactDistance {
  const v = raw;
  return v === "within_100m" ||
    v === "within_250m" ||
    v === "within_500m" ||
    v === "same_block"
    ? v
    : "unknown";
}

function normalizeOfficeLocation(raw: unknown): ManagementOfficeLocation | null {
  return raw === "in_building" || raw === "off_site" || raw === "unknown"
    ? raw
    : null;
}

function normalizeServiceScopes(raw: unknown): ManagementServiceScopeKey[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(MANAGEMENT_SERVICE_SCOPES.map((s) => s.key));
  return raw.filter(
    (k): k is ManagementServiceScopeKey =>
      typeof k === "string" && allowed.has(k as ManagementServiceScopeKey),
  );
}

function normalizeManagement(raw: unknown): BuildingManagementContact {
  const base = emptyBuildingManagement();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    companyName: typeof o.companyName === "string" ? o.companyName : "",
    contactName: typeof o.contactName === "string" ? o.contactName : "",
    phone: typeof o.phone === "string" ? o.phone : "",
    serviceScopes: normalizeServiceScopes(o.serviceScopes),
    serviceScopeOther:
      typeof o.serviceScopeOther === "string" ? o.serviceScopeOther : "",
    monthlyFeePerUnitManwon: normalizeStoredManwon(o.monthlyFeePerUnitManwon, 9999),
    vacantAccessAvailable: normalizeTriState(o.vacantAccessAvailable),
    arrearsLedgerAvailable: normalizeTriState(o.arrearsLedgerAvailable),
    remoteManagement: normalizeTriState(o.remoteManagement),
    postAuctionCooperation: normalizeTriState(o.postAuctionCooperation),
    visitedAt:
      typeof o.visitedAt === "string" && o.visitedAt.trim()
        ? o.visitedAt.trim()
        : null,
    reliabilityScore: normalizeScore1to5(o.reliabilityScore),
    memo: typeof o.memo === "string" ? o.memo : "",
  };
}

function normalizeBroker(raw: unknown): NearbyBrokerContact | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base = emptyNearbyBroker();
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : base.id,
    agencyName: typeof o.agencyName === "string" ? o.agencyName : "",
    ownerName: typeof o.ownerName === "string" ? o.ownerName : "",
    phone: typeof o.phone === "string" ? o.phone : "",
    distance: normalizeDistance(o.distance),
    isMultifamilySpecialist: normalizeTriState(o.isMultifamilySpecialist),
    rentOpinion: typeof o.rentOpinion === "string" ? o.rentOpinion : "",
    saleOpinion: typeof o.saleOpinion === "string" ? o.saleOpinion : "",
    willManageAfterAcquisition: normalizeTriState(o.willManageAfterAcquisition),
    contactedAt:
      typeof o.contactedAt === "string" && o.contactedAt.trim()
        ? o.contactedAt.trim()
        : null,
    memo: typeof o.memo === "string" ? o.memo : "",
  };
}

function normalizeOptionalInt(raw: unknown, max: number): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(max, Math.round(n));
}

function normalizeScore1to5(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function normalizeTriState(raw: unknown): boolean | null {
  return raw === true ? true : raw === false ? false : null;
}

export function normalizeFieldInspection(raw: unknown): FieldInspectionRecord {
  const base = emptyFieldInspection();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const brokers = Array.isArray(o.nearbyBrokers)
    ? o.nearbyBrokers
        .map((item) => normalizeBroker(item))
        .filter((item): item is NearbyBrokerContact => item != null)
        .slice(0, MAX_NEARBY_BROKERS)
    : [];
  return {
    visitDate:
      typeof o.visitDate === "string" && o.visitDate.trim()
        ? o.visitDate.trim()
        : null,
    visitDurationMin: normalizeOptionalInt(o.visitDurationMin, 999),
    companions: typeof o.companions === "string" ? o.companions : "",
    buildingManagement: normalizeManagement(o.buildingManagement),
    nearbyBrokers: brokers,
    cleaningCompanyName:
      typeof o.cleaningCompanyName === "string" ? o.cleaningCompanyName : "",
    cleaningCompanyPhone:
      typeof o.cleaningCompanyPhone === "string" ? o.cleaningCompanyPhone : "",
    managementOfficeLocation: normalizeOfficeLocation(o.managementOfficeLocation),
    vacantUnitAccessNote:
      typeof o.vacantUnitAccessNote === "string" ? o.vacantUnitAccessNote : "",
    memo: typeof o.memo === "string" ? o.memo : "",
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.trim()
        ? o.updatedAt.trim()
        : base.updatedAt,
  };
}

export function summarizeFieldInspectionForSurvey(
  record: FieldInspectionRecord,
): string {
  const lines: string[] = [];
  const m = record.buildingManagement;
  if (m.companyName.trim() || m.phone.trim()) {
    lines.push(
      `[관리] ${m.companyName.trim() || "업체명 미상"} / ${m.contactName.trim() || "담당 미상"} / ${m.phone.trim() || "전화 없음"}`,
    );
    if (m.serviceScopes.length > 0) {
      const labels = m.serviceScopes
        .map((k) => MANAGEMENT_SERVICE_SCOPES.find((s) => s.key === k)?.label ?? k)
        .join(", ");
      lines.push(`  업무: ${labels}`);
    }
    if (m.memo.trim()) lines.push(`  메모: ${m.memo.trim()}`);
  }
  for (const b of record.nearbyBrokers) {
    if (!b.agencyName.trim() && !b.phone.trim()) continue;
    lines.push(
      `[부동산·${FIELD_CONTACT_DISTANCE_LABEL[b.distance]}] ${b.agencyName.trim() || "-"} / ${b.ownerName.trim() || "-"} / ${b.phone.trim() || "-"}`,
    );
    if (b.rentOpinion.trim()) lines.push(`  임대: ${b.rentOpinion.trim()}`);
    if (b.saleOpinion.trim()) lines.push(`  매매: ${b.saleOpinion.trim()}`);
  }
  if (record.cleaningCompanyName.trim() || record.cleaningCompanyPhone.trim()) {
    lines.push(
      `[청소] ${record.cleaningCompanyName.trim()} ${record.cleaningCompanyPhone.trim()}`.trim(),
    );
  }
  if (record.memo.trim()) lines.push(record.memo.trim());
  return lines.join("\n");
}
