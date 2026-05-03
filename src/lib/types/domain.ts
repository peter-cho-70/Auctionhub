/** PRD v3 — maps cleanly to future PostgreSQL tables. */

export const SCHEMA_VERSION = 1 as const;

export type CaseStatus =
  | "watching"
  | "researching"
  | "rights_check"
  | "field_check"
  | "loan_check"
  | "bid_review"
  | "bid_day"
  | "won"
  | "won_day_action"
  | "balance"
  | "eviction"
  | "leasing"
  | "completed"
  | "abandoned";

export type Priority = "high" | "normal" | "low";

/** 다가구 등 가구 형태별 호실 수 */
export const ROOM_SHAPE_OPTIONS = ["1룸", "1.5룸", "2룸", "3룸"] as const;
export type RoomShape = (typeof ROOM_SHAPE_OPTIONS)[number];

export function emptyRoomShapeMix(): Record<RoomShape, number> {
  return { "1룸": 0, "1.5룸": 0, "2룸": 0, "3룸": 0 };
}

export type BidRoundResult = "pending" | "failed" | "won" | "lost";

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
}

export interface ChecklistItemInstance extends ChecklistTemplateItem {
  done: boolean;
  doneAt: string | null;
  note: string;
}

export interface CaseChecklist {
  id: string;
  stepKey: CaseStatus;
  title: string;
  items: ChecklistItemInstance[];
}

export interface BidRound {
  id: string;
  round: number;
  minPrice: number | null;
  myBidPrice: number | null;
  result: BidRoundResult;
  bidDate: string | null;
  memo: string;
}

export type DecisionVerdict =
  | "recommend"
  | "caution"
  | "not_recommend"
  | "abandon";

export type RiskLevel = "low" | "medium" | "high";

export interface CaseDecision {
  verdict: DecisionVerdict | null;
  maxBidPrice: number | null;
  actualBidPrice: number | null;
  riskLevel: RiskLevel | null;
  reason: string;
}

export interface MessageTemplate {
  id: string;
  category: string;
  name: string;
  body: string;
}

export interface KnowledgeNote {
  id: string;
  category: string;
  title: string;
  body: string;
  linkedCaseId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 호실별 임대 (엑셀 하단 표와 유사) */
export interface RentSettingUnitRow {
  id: string;
  floor: string;
  unitNo: string;
  roomType: string;
  deposit: number | null;
  monthlyRent: number | null;
  areaPyeong: number | null;
  note: string;
}

/** 건물 가구수 행 — 상가·원룸·1.5·투·쓰리·주인세대 */
export interface RentSettingUnitCounts {
  commercial: number;
  oneRoom: number;
  oneHalfRoom: number;
  twoRoom: number;
  threeRoom: number;
  ownerUnit: number;
}

/**
 * 다가구 수익표(투자 대비) — 금액은 원 단위, sheet3와 동일 수식.
 * 대출액 = MIN(감정가×담보비율, 입찰가×0.9), 월이자 = 대출×연이율/365×30,
 * 순투자금 = 실투자금−총보증금, 순월세소득 = 총월세−월이자,
 * 순투자수익률(%) 표기 = 순월세소득×12÷순투자금, 시세차익 = 매매시세−총투자금.
 */
export interface RentInvestmentYield {
  bidAmount: number | null;
  evictionCost: number | null;
  acquisitionTaxRate: number | null;
  appraisalAmount: number | null;
  loanToValueRatio: number | null;
  loanAnnualRate: number | null;
  totalDeposit: number | null;
  totalMonthlyRent: number | null;
  marketPrice: number | null;
}

/**
 * 다가구 임대·수익률 입력 (매도가/융자/이율/호실별 보증·월세 합산).
 * 연이율 annualRate는 소수(예: 0.041 = 4.1%).
 */
export interface RentSetting {
  sheetUrl: string;
  landCategory: string;
  /** @deprecated 마이그레이션용 보존. UI·신규 저장은 grossFloorAreaSqm 우선 */
  grossFloorAreaPyeong: number | null;
  /** 연면적 (㎡) */
  grossFloorAreaSqm: number | null;
  salePrice: number | null;
  loanAmount: number | null;
  annualRate: number | null;
  publicLandPrice: number | null;
  buildingViolation: string;
  violationDetail: string;
  builtYear: string;
  facing: string;
  parkingCount: string;
  allocationNote: string;
  ownerOccupiedNote: string;
  lhHug: string;
  detailMemo: string;
  unitCounts: RentSettingUnitCounts;
  unitRows: RentSettingUnitRow[];
  investmentYield: RentInvestmentYield;
}

export interface AuctionCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  caseNumber: string;
  address: string;
  propertyType: string;
  /** 준공·건축연도 등 (물건 기본 정보, 자유 입력) */
  builtYear: string;
  /** 건물·대상 층 (예: 지상3층, B1) */
  floor: string;
  /** 세대·가구 수 */
  householdCount: number | null;
  /** 가구 형태(룸 타입)별 호실 수 */
  roomShapeMix: Record<RoomShape, number>;
  /** 토지면적 (㎡) */
  landAreaSqm: number | null;
  /** 건물면적 (㎡) */
  buildingAreaSqm: number | null;
  /** 주차 대수 */
  parkingUnitCount: number | null;
  /** 건축물대장 위반 등 (위반건축 체크) */
  hasBuildingViolation: boolean;
  /** 건폐율 (자유 입력, 예: 60%) */
  buildingCoverageRatio: string;
  /** 용적율 (자유 입력) */
  floorAreaRatio: string;
  /** 말소기준 등 (등기·매각물건명세 기준 요약) */
  lienBaseline: string;
  appraisalPrice: number | null;
  minPrice: number | null;
  bidDate: string | null;
  currentRound: number;
  bidRounds: BidRound[];
  /** 다음 회차 예상 최저가 (자동 계산 캐시, null이면 재계산 유도) */
  nextExpectedMinPrice: number | null;
  wonDayActionsCompleted: boolean;
  status: CaseStatus;
  priority: Priority;
  /** 임장 조사 메모 (현장 확인·부동산 문의 등) */
  fieldSurvey: string;
  memo: string;
  /** 다가구 임대 수익·실투자금·수익률 입력 */
  rentSetting: RentSetting;
  checklists: CaseChecklist[];
  decision: CaseDecision;
}

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  /** 단계 순서 (향후 사용자 정렬·DB 이전 시 동일 필드 사용) */
  processStepOrder: CaseStatus[];
  checklistTemplates: Partial<Record<CaseStatus, ChecklistTemplateItem[]>>;
  /**
   * 단계별 강의 노트 사용자 편집본.
   * 키가 없으면 `lecture-guide`에 정의된 기본 노트를 사용합니다.
   */
  lectureGuideByStep: Partial<Record<CaseStatus, string>>;
  messageTemplates: MessageTemplate[];
  knowledgeNotes: KnowledgeNote[];
  cases: AuctionCase[];
}

export const EMPTY_DECISION: CaseDecision = {
  verdict: null,
  maxBidPrice: null,
  actualBidPrice: null,
  riskLevel: null,
  reason: "",
};
