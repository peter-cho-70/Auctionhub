import {
  buildBuildingCostLines,
  buildProfileCostLines,
  caseRemodelingAnalysis,
  computeScenarioTotals,
  createDefaultScenarioPlan,
  createEmptyAssignment,
  profileKeyForRoomType,
  SCENARIO_TIERS,
  syncAssignmentsFromCase,
} from "@/lib/domain/remodeling-analysis";
import {
  catalogItemsForScenario,
  costLineFromCatalogItem,
  rentUpliftForRoomType,
} from "@/lib/domain/remodeling-catalog";
import { DEFAULT_REMODELING_PRICE_CATALOG } from "@/lib/domain/remodeling-catalog-daejeon";
import { normalizeIdealReference } from "@/lib/domain/remodeling-reference";
import type {
  AuctionCase,
  CaseRemodeling,
  RemodelingCheckItem,
  RemodelingCostLine,
  RemodelingOccupancy,
  RemodelingPhase,
  RemodelingPriceCatalog,
  RemodelingRoomProfile,
  RemodelingRoomUnitType,
  RemodelingScenarioPlan,
  RemodelingScenarioTier,
  UnitRemodeling,
  UnitRemodelingAssignment,
} from "@/lib/types/domain";

export const REMODELING_PHASES: {
  id: RemodelingPhase;
  label: string;
  period: string;
  budgetMinManwon: number;
  budgetMaxManwon: number;
  goal: string;
  summary: string;
}[] = [
  {
    id: "phase1",
    label: "1단계 공실 즉시 수익화",
    period: "0~3개월",
    budgetMinManwon: 50,
    budgetMaxManwon: 150,
    goal: "공실 채우기",
    summary:
      "공실을 빠르게 임차 가능한 상태로 만드는 단계입니다. 완벽한 리모델링이 아니라 첫인상·기능 복구가 목표입니다.",
  },
  {
    id: "phase2",
    label: "2단계 거주 중 관계 공사",
    period: "4~12개월",
    budgetMinManwon: 100,
    budgetMaxManwon: 300,
    goal: "이탈 방지·월세 인상",
    summary:
      "거주 임차인의 동의를 얻어 창호·바닥·도배 등을 순차 진행합니다. 협조 임차인을 파트너로 전환하는 것이 핵심입니다.",
  },
  {
    id: "phase3",
    label: "3단계 자산가치 완성",
    period: "1~3년",
    budgetMinManwon: 300,
    budgetMaxManwon: 600,
    goal: "건물 가치 극대화",
    summary:
      "건물 전체 통일감과 공용부 품질을 높입니다. 옥상 방수·외벽·공동현관·창호 전면 교체 등을 검토합니다.",
  },
];

export const REMODELING_PRINCIPLES = [
  {
    title: "임차인은 '공사'가 아니라 '배려'에 반응한다",
    body: "사전 안내, 공사 중 불편 보상, 공사 후 확인 전화가 재계약률에 큰 영향을 줍니다.",
  },
  {
    title: "눈에 보이는 것부터 바꿔라",
    body: "벽지·조명·청소는 적은 비용으로도 '새로 단장한 방'처럼 보입니다. 보이지 않는 배관·전기는 2순위입니다.",
  },
  {
    title: "한 호실씩, 공실부터 시작하라",
    body: "공실 1호실 완성 → 임차인 유치 → 월세 수입으로 다음 호실 공사의 순환 구조가 자금 부담을 줄입니다.",
  },
  {
    title: "직접 가능한 항목을 먼저 파악하라",
    body: "도배·청소·조명·손잡이는 직접 시공 시 50~70% 절감 가능합니다. 전기·배관·방수는 전문가에게 맡깁니다.",
  },
  {
    title: "임차인을 파트너로 대하라",
    body: "거주 중 공사는 허락을 구하는 태도가 핵심입니다. 불만 임차인을 협력 임차인으로 바꾸는 대화가 중요합니다.",
  },
];

const PHASE1_CHECKLIST: Omit<RemodelingCheckItem, "id" | "done" | "note">[] = [
  {
    label: "수도 잠금 확인",
    method: "수전 틀어보기",
    okCriteria: "맑은 물 즉시 나옴",
    action: "녹물 시 2~3분 흘리기, 지속 시 배관 교체",
  },
  {
    label: "전기 작동",
    method: "모든 콘센트·조명 테스트",
    okCriteria: "전체 정상 작동",
    action: "누전차단기 리셋 후 재확인, 불가 시 전기공사",
  },
  {
    label: "보일러 점검",
    method: "실온 가동 테스트",
    okCriteria: "10분 내 난방 작동",
    action: "필터 청소 후 재가동, 불가 시 보일러 교체",
  },
  {
    label: "창문·방충망",
    method: "전체 개폐 확인",
    okCriteria: "원활히 개폐됨",
    action: "방충망 파손 시 자가 교체 (약 1만원)",
  },
  {
    label: "도배 상태",
    method: "육안 확인",
    okCriteria: "변색·탈락 없음",
    action: "30% 이상 훼손 시 전체 교체",
  },
  {
    label: "욕실 수전",
    method: "냉온수 작동",
    okCriteria: "누수 없이 작동",
    action: "실리콘 재처리 또는 수전 교체",
  },
  {
    label: "냄새 확인",
    method: "직접 맡기",
    okCriteria: "무취 상태",
    action: "환기 후 탈취제, 하수구 막힘 확인",
  },
  {
    label: "도어락",
    method: "작동 테스트",
    okCriteria: "정상 작동",
    action: "배터리 교체 또는 도어락 교체",
  },
];

const PHASE2_CHECKLIST: Omit<RemodelingCheckItem, "id" | "done" | "note">[] = [
  {
    label: "임차인 협조 여부",
    method: "사전 면담",
    okCriteria: "공사 일정·기간 합의",
    action: "기간·보상·불편 최소화를 구체적으로 제시",
  },
  {
    label: "창호 상태",
    method: "누풍·결로 확인",
    okCriteria: "단열·기밀 양호",
    action: "PVC 이중창 또는 내창 추가 검토",
  },
  {
    label: "바닥재 상태",
    method: "들뜸·곰팡이 확인",
    okCriteria: "평탄·청결",
    action: "장판/SPC/강화마루 교체 검토",
  },
  {
    label: "도배·벽 상태",
    method: "변색·곰팡이 확인",
    okCriteria: "전체적으로 깨끗",
    action: "합지 또는 도배 재시공",
  },
  {
    label: "욕실 방수·실리콘",
    method: "누수 흔적 확인",
    okCriteria: "누수 없음",
    action: "실리콘 재시공 또는 부분 방수",
  },
];

const PHASE3_CHECKLIST: Omit<RemodelingCheckItem, "id" | "done" | "note">[] = [
  {
    label: "옥상 방수",
    method: "누수 흔적·크랙 확인",
    okCriteria: "누수 징후 없음",
    action: "옥상 방수 전면 재시공 검토",
  },
  {
    label: "외벽·외관",
    method: "사진·현장 비교",
    okCriteria: "외관 통일감 양호",
    action: "외벽 도장·코팅 검토",
  },
  {
    label: "공동현관·복도",
    method: "조명·도장 상태",
    okCriteria: "밝고 정돈됨",
    action: "LED·도장·스마트 도어 검토",
  },
  {
    label: "창호 전면",
    method: "호실별 창호 노후도",
    okCriteria: "단열·기밀 양호",
    action: "순차 창호 교체 계획",
  },
  {
    label: "CCTV·보안",
    method: "카메라·조명 확인",
    okCriteria: "보안 체계 적정",
    action: "CCTV·현관 보안 보강",
  },
];

type CostPreset = Omit<RemodelingCostLine, "id" | "selected">;

function preset(
  item: string,
  p: Partial<Omit<CostPreset, "item">> & Pick<CostPreset, "materialManwon" | "laborManwon">,
): CostPreset {
  return {
    catalogKey: null,
    item,
    diy: false,
    workScope: null,
    effectNote: "",
    rentUpliftManwon: null,
    ...p,
  };
}

const PHASE1_COSTS: CostPreset[] = [
  preset("전체 도배", { materialManwon: 30, laborManwon: 20, effectNote: "첫인상 결정", workScope: "full_replace" }),
  preset("LED 조명 전체 교체", { materialManwon: 20, laborManwon: 8, diy: true, effectNote: "밝고 깨끗해 보임", workScope: "full_replace", rentUpliftManwon: 2 }),
  preset("욕실 청소+실리콘", { materialManwon: 2, laborManwon: 0, diy: true, effectNote: "냄새·누수 예방", workScope: "partial" }),
  preset("도어락 교체", { materialManwon: 13, laborManwon: 5, diy: true, effectNote: "보안·편의", workScope: "partial" }),
  preset("방충망 교체", { materialManwon: 4, laborManwon: 0, diy: true, effectNote: "창문 개폐감", workScope: "partial" }),
  preset("수전 교체 (주방+욕실)", { materialManwon: 8, laborManwon: 5, effectNote: "기능 복구", workScope: "partial" }),
  preset("싱크대 상판 필름", { materialManwon: 7, laborManwon: 0, diy: true, effectNote: "주방 인상 개선", workScope: "partial" }),
  preset("전문 청소", { materialManwon: 0, laborManwon: 20, effectNote: "첫 공실 필수", workScope: "full_replace" }),
];

const PHASE2_COSTS: CostPreset[] = [
  preset("PVC 이중창 (일반)", { materialManwon: 80, laborManwon: 40, effectNote: "냉난방비 절감", workScope: "full_replace", rentUpliftManwon: 4 }),
  preset("PVC 이중창 (로이유리)", { materialManwon: 105, laborManwon: 40, effectNote: "단열 강화", workScope: "full_replace" }),
  preset("내창 추가 설치", { materialManwon: 30, laborManwon: 13, effectNote: "임시·중간 대안", workScope: "partial", rentUpliftManwon: 2 }),
  preset("PVC 장판 (원룸)", { materialManwon: 20, laborManwon: 10, diy: true, effectNote: "저비용", workScope: "full_replace" }),
  preset("SPC 바닥재 (원룸)", { materialManwon: 35, laborManwon: 10, diy: true, effectNote: "방수·내구", workScope: "full_replace", rentUpliftManwon: 3 }),
  preset("강화마루 (원룸)", { materialManwon: 25, laborManwon: 12, effectNote: "가성비", workScope: "full_replace" }),
  preset("합지 벽지 (원룸)", { materialManwon: 7, laborManwon: 15, effectNote: "분위기 전환", workScope: "partial" }),
  preset("도배 (원룸)", { materialManwon: 15, laborManwon: 25, effectNote: "고급감", workScope: "full_replace", rentUpliftManwon: 3 }),
  preset("욕실 부분 방수", { materialManwon: 15, laborManwon: 25, effectNote: "누수 예방", workScope: "partial" }),
];

const PHASE3_COSTS: CostPreset[] = [
  preset("호실 창호 전체 교체", { materialManwon: 140, laborManwon: 40, effectNote: "호실당", workScope: "full_replace", rentUpliftManwon: 5 }),
  preset("빌트인 에어컨", { materialManwon: 65, laborManwon: 0, effectNote: "호실당", workScope: "full_replace", rentUpliftManwon: 4 }),
  preset("옥상 방수 (건물)", { materialManwon: 600, laborManwon: 0, effectNote: "건물 공용", workScope: "full_replace" }),
  preset("외벽 도장·코팅 (건물)", { materialManwon: 450, laborManwon: 0, effectNote: "건물 공용", workScope: "full_replace" }),
  preset("공동현관 스마트 도어", { materialManwon: 150, laborManwon: 0, effectNote: "건물 공용", workScope: "partial" }),
  preset("복도·계단 LED+도장", { materialManwon: 220, laborManwon: 0, effectNote: "건물 공용", workScope: "partial" }),
  preset("CCTV 시스템", { materialManwon: 120, laborManwon: 0, effectNote: "건물 공용", workScope: "full_replace" }),
];

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function checklistFromPreset(
  preset: Omit<RemodelingCheckItem, "id" | "done" | "note">[],
): RemodelingCheckItem[] {
  return preset.map((item) => ({
    ...item,
    id: newId("chk"),
    done: false,
    note: "",
  }));
}

function costLinesFromPreset(preset: CostPreset[]): RemodelingCostLine[] {
  return preset.map((item) => ({
    ...item,
    id: newId("cost"),
    selected: false,
  }));
}

export function getPhaseMeta(phase: RemodelingPhase) {
  return REMODELING_PHASES.find((item) => item.id === phase) ?? REMODELING_PHASES[0]!;
}

export function defaultChecklistForPhase(phase: RemodelingPhase): RemodelingCheckItem[] {
  if (phase === "phase2") return checklistFromPreset(PHASE2_CHECKLIST);
  if (phase === "phase3") return checklistFromPreset(PHASE3_CHECKLIST);
  return checklistFromPreset(PHASE1_CHECKLIST);
}

export function defaultCostLinesForPhase(phase: RemodelingPhase): RemodelingCostLine[] {
  if (phase === "phase2") return costLinesFromPreset(PHASE2_COSTS);
  if (phase === "phase3") return costLinesFromPreset(PHASE3_COSTS);
  return costLinesFromPreset(PHASE1_COSTS);
}

function normalizeScenarioTier(raw: unknown): RemodelingScenarioTier {
  return raw === "balanced" || raw === "full" ? raw : "minimal";
}

function normalizeRoomUnitType(raw: unknown): RemodelingRoomUnitType {
  const v = raw;
  return v === "one_room" ||
    v === "one_half_room" ||
    v === "two_room" ||
    v === "owner"
    ? v
    : "unknown";
}

export function defaultCostLinesFromCatalog(
  catalog: RemodelingPriceCatalog,
  tier: RemodelingScenarioTier,
  roomType: RemodelingRoomUnitType,
  phase: RemodelingPhase,
): RemodelingCostLine[] {
  const lines = buildProfileCostLines(catalog, tier, roomType);
  if (lines.length > 0) return lines;
  return defaultCostLinesForPhase(phase);
}

export function defaultBuildingCostLinesFromCatalog(
  catalog: RemodelingPriceCatalog,
  tier: RemodelingScenarioTier,
): RemodelingCostLine[] {
  const lines = buildBuildingCostLines(catalog, tier);
  if (lines.length > 0) return lines;
  return costLinesFromPreset(
    PHASE3_COSTS.filter((item) => item.effectNote?.includes("건물")),
  );
}

export function createUnitRemodeling(
  unitLabel: string,
  phase: RemodelingPhase = "phase1",
  occupancy: RemodelingOccupancy = "unknown",
  options?: {
    scenarioTier?: RemodelingScenarioTier;
    roomUnitType?: RemodelingRoomUnitType;
    catalog?: RemodelingPriceCatalog;
  },
): UnitRemodeling {
  const scenarioTier = options?.scenarioTier ?? "minimal";
  const roomUnitType = options?.roomUnitType ?? "unknown";
  const catalog = options?.catalog ?? DEFAULT_REMODELING_PRICE_CATALOG;
  return {
    unitKey: unitLabel.trim() || newId("unit"),
    unitLabel: unitLabel.trim() || "호실 미상",
    roomUnitType,
    scenarioTier,
    phase,
    occupancy,
    checklist: defaultChecklistForPhase(phase),
    costLines: defaultCostLinesFromCatalog(catalog, scenarioTier, roomUnitType, phase),
    memo: "",
    completed: false,
  };
}

export function createEmptyCostLine(): RemodelingCostLine {
  return {
    id: newId("cost"),
    catalogKey: null,
    item: "",
    materialManwon: null,
    laborManwon: null,
    selected: false,
    diy: false,
    workScope: null,
    effectNote: "",
    rentUpliftManwon: null,
  };
}

export function emptyCaseRemodeling(
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): CaseRemodeling {
  return {
    activeScenarioTier: "balanced",
    scenarios: SCENARIO_TIERS.map((tier) => createDefaultScenarioPlan(tier, catalog)),
    unitAssignments: [],
    idealReference: normalizeIdealReference(undefined),
    memo: "",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeScenarioPlan(
  raw: unknown,
  catalog: RemodelingPriceCatalog,
): RemodelingScenarioPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tier = normalizeScenarioTier(o.tier);
  const existing = createDefaultScenarioPlan(tier, catalog);
  const roomProfiles = Array.isArray(o.roomProfiles)
    ? o.roomProfiles
        .map((item) => normalizeRoomProfile(item, tier, catalog))
        .filter((item): item is RemodelingRoomProfile => item != null)
    : existing.roomProfiles;
  const profileByKey = new Map(roomProfiles.map((p) => [p.profileKey, p]));
  const mergedProfiles = existing.roomProfiles.map(
    (base) => profileByKey.get(base.profileKey) ?? base,
  );
  return {
    tier,
    roomProfiles: mergedProfiles,
    buildingCostLines: Array.isArray(o.buildingCostLines)
      ? o.buildingCostLines
          .map((item) => normalizeCostLine(item))
          .filter((item): item is RemodelingCostLine => item != null)
      : existing.buildingCostLines,
    memo: typeof o.memo === "string" ? o.memo : "",
  };
}

function normalizeRoomProfile(
  raw: unknown,
  tier: RemodelingScenarioTier,
  catalog: RemodelingPriceCatalog,
): RemodelingRoomProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const roomUnitType = normalizeRoomUnitType(o.roomUnitType);
  const profileKey =
    typeof o.profileKey === "string" && o.profileKey.trim()
      ? o.profileKey.trim()
      : profileKeyForRoomType(roomUnitType);
  const label =
    typeof o.label === "string" && o.label.trim()
      ? o.label.trim()
      : profileKey;
  const existingLines = Array.isArray(o.costLines)
    ? o.costLines
        .map((item) => normalizeCostLine(item))
        .filter((item): item is RemodelingCostLine => item != null)
    : undefined;
  return {
    profileKey,
    roomUnitType,
    label,
    costLines: buildProfileCostLines(catalog, tier, roomUnitType, existingLines),
    memo: typeof o.memo === "string" ? o.memo : "",
  };
}

function normalizeUnitAssignment(raw: unknown): UnitRemodelingAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const unitLabel =
    typeof o.unitLabel === "string" && o.unitLabel.trim()
      ? o.unitLabel.trim()
      : "호실 미상";
  const roomUnitType = normalizeRoomUnitType(o.roomUnitType);
  return {
    unitKey:
      typeof o.unitKey === "string" && o.unitKey.trim()
        ? o.unitKey.trim()
        : unitLabel,
    unitLabel,
    roomUnitType,
    apply: o.apply === true,
    profileKey:
      typeof o.profileKey === "string" && o.profileKey.trim()
        ? o.profileKey.trim()
        : profileKeyForRoomType(roomUnitType),
    scenarioTier:
      o.scenarioTier === "minimal" ||
      o.scenarioTier === "balanced" ||
      o.scenarioTier === "full"
        ? o.scenarioTier
        : null,
    occupancy: normalizeOccupancy(o.occupancy),
    memo: typeof o.memo === "string" ? o.memo : "",
    completed: o.completed === true,
  };
}

function migrateLegacyCaseRemodeling(
  o: Record<string, unknown>,
  catalog: RemodelingPriceCatalog,
): CaseRemodeling {
  const legacyUnits = Array.isArray(o.units)
    ? o.units
        .map((item) => normalizeUnitRemodeling(item))
        .filter((item): item is UnitRemodeling => item != null)
    : [];
  const legacyBuilding = Array.isArray(o.buildingCostLines)
    ? o.buildingCostLines
        .map((item) => normalizeCostLine(item))
        .filter((item): item is RemodelingCostLine => item != null)
    : [];

  const scenarios = SCENARIO_TIERS.map((tier) => {
    const base = createDefaultScenarioPlan(tier, catalog);
    const roomProfiles = base.roomProfiles.map((profile) => {
      const legacyUnit = legacyUnits.find(
        (unit) =>
          unit.scenarioTier === tier && unit.roomUnitType === profile.roomUnitType,
      );
      if (!legacyUnit || legacyUnit.costLines.length === 0) return profile;
      return {
        ...profile,
        costLines: buildProfileCostLines(
          catalog,
          tier,
          profile.roomUnitType,
          legacyUnit.costLines,
        ),
        memo: legacyUnit.memo,
      };
    });
    const buildingCostLines =
      tier === "minimal" && legacyBuilding.length > 0
        ? buildBuildingCostLines(catalog, tier, legacyBuilding)
        : base.buildingCostLines;
    return { ...base, roomProfiles, buildingCostLines };
  });

  const activeScenarioTier =
    legacyUnits[0]?.scenarioTier ??
    (typeof o.activeScenarioTier === "string"
      ? normalizeScenarioTier(o.activeScenarioTier)
      : "balanced");

  const unitAssignments: UnitRemodelingAssignment[] = legacyUnits.map((unit) => ({
    unitKey: unit.unitKey,
    unitLabel: unit.unitLabel,
    roomUnitType: unit.roomUnitType,
    apply: true,
    profileKey: profileKeyForRoomType(unit.roomUnitType),
    scenarioTier: unit.scenarioTier,
    occupancy: unit.occupancy,
    memo: unit.memo,
    completed: unit.completed,
  }));

  return {
    activeScenarioTier,
    scenarios,
    unitAssignments,
    idealReference: normalizeIdealReference(o.idealReference),
    memo: typeof o.memo === "string" ? o.memo : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function normalizeCaseRemodeling(
  raw: unknown,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): CaseRemodeling {
  const base = emptyCaseRemodeling(catalog);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.scenarios)) {
    return migrateLegacyCaseRemodeling(o, catalog);
  }

  const scenarios = SCENARIO_TIERS.map((tier) => {
    const found = Array.isArray(o.scenarios)
      ? o.scenarios
          .map((item) => normalizeScenarioPlan(item, catalog))
          .find((plan) => plan?.tier === tier)
      : null;
    return found ?? createDefaultScenarioPlan(tier, catalog);
  });

  const unitAssignments = Array.isArray(o.unitAssignments)
    ? o.unitAssignments
        .map((item) => normalizeUnitAssignment(item))
        .filter((item): item is UnitRemodelingAssignment => item != null)
    : [];

  return {
    activeScenarioTier: normalizeScenarioTier(o.activeScenarioTier),
    scenarios,
    unitAssignments,
    idealReference: normalizeIdealReference(o.idealReference),
    memo: typeof o.memo === "string" ? o.memo : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
  };
}

function normalizeUnitRemodeling(raw: unknown): UnitRemodeling | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const phase = normalizePhase(o.phase);
  const unitLabel =
    typeof o.unitLabel === "string" && o.unitLabel.trim()
      ? o.unitLabel.trim()
      : "호실 미상";
  return {
    unitKey:
      typeof o.unitKey === "string" && o.unitKey.trim()
        ? o.unitKey.trim()
        : unitLabel,
    unitLabel,
    roomUnitType: normalizeRoomUnitType(o.roomUnitType),
    scenarioTier: normalizeScenarioTier(o.scenarioTier),
    phase,
    occupancy: normalizeOccupancy(o.occupancy),
    checklist: Array.isArray(o.checklist)
      ? o.checklist
          .map((item) => normalizeCheckItem(item))
          .filter((item): item is RemodelingCheckItem => item != null)
      : defaultChecklistForPhase(phase),
    costLines: Array.isArray(o.costLines)
      ? o.costLines
          .map((item) => normalizeCostLine(item))
          .filter((item): item is RemodelingCostLine => item != null)
      : defaultCostLinesForPhase(phase),
    memo: typeof o.memo === "string" ? o.memo : "",
    completed: o.completed === true,
  };
}

function normalizeCheckItem(raw: unknown): RemodelingCheckItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== "string" || !o.label.trim()) return null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : newId("chk"),
    label: o.label.trim(),
    method: typeof o.method === "string" ? o.method : "",
    okCriteria: typeof o.okCriteria === "string" ? o.okCriteria : "",
    action: typeof o.action === "string" ? o.action : "",
    done: o.done === true,
    note: typeof o.note === "string" ? o.note : "",
  };
}

function normalizeCostLine(raw: unknown): RemodelingCostLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.item !== "string" || !o.item.trim()) return null;
  const workScope = o.workScope;
  return {
    id: typeof o.id === "string" && o.id ? o.id : newId("cost"),
    catalogKey:
      typeof o.catalogKey === "string" && o.catalogKey.trim()
        ? o.catalogKey.trim()
        : null,
    item: o.item.trim(),
    materialManwon: normalizeManwon(o.materialManwon),
    laborManwon: normalizeManwon(o.laborManwon),
    selected: o.selected === true,
    diy: o.diy === true,
    workScope:
      workScope === "reuse" || workScope === "partial" || workScope === "full_replace"
        ? workScope
        : null,
    effectNote: typeof o.effectNote === "string" ? o.effectNote : "",
    rentUpliftManwon: normalizeManwon(o.rentUpliftManwon),
  };
}

function normalizePhase(raw: unknown): RemodelingPhase {
  return raw === "phase2" || raw === "phase3" ? raw : "phase1";
}

function normalizeOccupancy(raw: unknown): RemodelingOccupancy {
  return raw === "vacant" || raw === "occupied" ? raw : "unknown";
}

function normalizeManwon(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(Math.max(0, raw));
  }
  if (typeof raw === "string") {
    const digits = raw.replace(/[^\d.]/g, "");
    if (!digits) return null;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? Math.round(Math.max(0, parsed)) : null;
  }
  return null;
}

export function lineTotalManwon(line: RemodelingCostLine): number {
  if (!line.selected) return 0;
  const material = line.materialManwon ?? 0;
  const labor = line.diy ? 0 : (line.laborManwon ?? 0);
  return material + labor;
}

export function unitTotalManwon(unit: UnitRemodeling): number {
  return unit.costLines.reduce((sum, line) => sum + lineTotalManwon(line), 0);
}

export function buildingTotalManwon(
  remodeling: CaseRemodeling,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): number {
  const scenario =
    remodeling.scenarios.find((s) => s.tier === remodeling.activeScenarioTier) ??
    remodeling.scenarios[0];
  if (!scenario) return 0;
  return computeScenarioTotals(catalog, scenario, remodeling.unitAssignments).building
    .totalManwon;
}

export function caseRemodelingTotals(
  remodeling: CaseRemodeling,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
) {
  const analysis = caseRemodelingAnalysis(remodeling, catalog);
  const active = analysis.active.totals;
  const applied = analysis.active.totalsApplied;
  const assignments = remodeling.unitAssignments;
  const vacantCount = assignments.filter((a) => a.occupancy === "vacant").length;
  const occupiedCount = assignments.filter((a) => a.occupancy === "occupied").length;
  const completedCount = assignments.filter((a) => a.completed).length;

  return {
    grandTotalManwon: active.totalManwon,
    grandTotalAppliedManwon: applied.totalManwon,
    materialManwon: active.materialManwon,
    laborManwon: active.laborManwon,
    diyLaborSavedManwon: active.diyLaborSavedManwon,
    laborPercent:
      active.totalManwon > 0
        ? Math.round((active.laborManwon / active.totalManwon) * 100)
        : 0,
    monthlyRentUpliftManwon: active.monthlyRentUpliftManwon,
    paybackYears: active.paybackYears,
    buildingTotal: active.building.totalManwon,
    unitsTotalManwon: active.totalManwon - active.building.totalManwon,
    unitCountApplied: active.unitCountApplied,
    unitCountTotal: active.unitCountTotal,
    vacantCount,
    occupiedCount,
    completedCount,
    activeTier: remodeling.activeScenarioTier,
    scenarioComparison: analysis.scenarios.map((s) => ({
      tier: s.plan.tier,
      totalManwon: s.totals.totalManwon,
      materialManwon: s.totals.materialManwon,
      laborManwon: s.totals.laborManwon,
      monthlyRentUpliftManwon: s.totals.monthlyRentUpliftManwon,
      paybackYears: s.totals.paybackYears,
    })),
    activeBreakdown: active,
  };
}

export function mergeAssignmentsFromCase(
  remodeling: CaseRemodeling,
  caseData: AuctionCase,
): CaseRemodeling {
  return {
    ...remodeling,
    unitAssignments: syncAssignmentsFromCase(remodeling.unitAssignments, caseData),
    updatedAt: new Date().toISOString(),
  };
}

export function budgetStatus(
  totalManwon: number,
  phase: RemodelingPhase,
): "under" | "in_range" | "over" | "unknown" {
  const meta = getPhaseMeta(phase);
  if (totalManwon <= 0) return "unknown";
  if (totalManwon < meta.budgetMinManwon) return "under";
  if (totalManwon > meta.budgetMaxManwon) return "over";
  return "in_range";
}

export function applyPhaseToUnit(
  unit: UnitRemodeling,
  phase: RemodelingPhase,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): UnitRemodeling {
  return {
    ...unit,
    phase,
    checklist: defaultChecklistForPhase(phase),
    costLines: defaultCostLinesFromCatalog(
      catalog,
      unit.scenarioTier,
      unit.roomUnitType,
      phase,
    ),
  };
}

export function applyScenarioToUnit(
  unit: UnitRemodeling,
  tier: RemodelingScenarioTier,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): UnitRemodeling {
  return {
    ...unit,
    scenarioTier: tier,
    costLines: defaultCostLinesFromCatalog(
      catalog,
      tier,
      unit.roomUnitType,
      unit.phase,
    ),
  };
}

/** @deprecated mergeAssignmentsFromCase 사용 */
export function mergeUnitsFromLabels(
  existing: CaseRemodeling,
  unitLabels: string[],
  _defaultPhase: RemodelingPhase = "phase1",
  _catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
): CaseRemodeling {
  const byKey = new Map(existing.unitAssignments.map((a) => [a.unitKey, a]));
  const next: UnitRemodelingAssignment[] = [];
  for (const label of unitLabels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    const found = byKey.get(trimmed);
    if (found) {
      next.push(found);
      continue;
    }
    next.push(createEmptyAssignment(trimmed));
  }
  if (next.length === 0 && existing.unitAssignments.length > 0) {
    return existing;
  }
  return {
    ...existing,
    unitAssignments: next.length > 0 ? next : existing.unitAssignments,
    updatedAt: new Date().toISOString(),
  };
}

export function sortUnits(units: UnitRemodeling[]): UnitRemodeling[] {
  return [...units].sort((a, b) => compareUnitLabel(a.unitLabel, b.unitLabel));
}

function compareUnitLabel(a: string, b: string): number {
  const left = unitSortParts(a);
  const right = unitSortParts(b);
  if (left.floor !== right.floor) return left.floor - right.floor;
  if (left.room !== right.room) return left.room - right.room;
  return left.label.localeCompare(right.label, "ko");
}

function unitSortParts(label: string): { floor: number; room: number; label: string } {
  const normalized = label.replace(/\s/g, "").toUpperCase();
  const basement = normalized.match(/(?:지하|B)(\d+)/);
  if (basement) {
    const floor = Number(basement[1]);
    return { floor: Number.isFinite(floor) ? -floor : -1, room: 0, label };
  }
  if (/옥탑|ROOF|루프/.test(normalized)) {
    return { floor: 998, room: 999_999, label };
  }
  const floorMatch = normalized.match(/(\d+)층/);
  const roomNumber = extractNumber(normalized);
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

function extractNumber(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

export function collectUnitLabelsFromCase(caseData: AuctionCase): string[] {
  const labels = new Set<string>();
  for (const row of caseData.rentSetting.unitRows) {
    const parts = [row.floor, row.unitNo].map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) labels.add(parts.join(" "));
  }
  for (const doc of caseData.sourceDocuments) {
    const root = asRecord(doc.structuredJson);
    const auctionCase =
      asRecord(root?.auctionCase) ?? asRecord(root?.auction_case);
    const document = asRecord(root?.document);
    const tenants =
      asRecord(auctionCase?.tenants) ?? asRecord(document?.tenants);
    const list = Array.isArray(tenants?.list) ? tenants.list : [];
    for (const item of list) {
      const tenant = asRecord(item);
      const unit =
        textValue(tenant?.unit) ||
        textValue(tenant?.room) ||
        textValue(tenant?.unit_no);
      if (unit) labels.add(unit);
    }
  }
  return [...labels].sort((a, b) => compareUnitLabel(a, b));
}
