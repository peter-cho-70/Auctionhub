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
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

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

export interface TenantAnalysisSettings {
  noDividendRequestGuide: string;
}

export interface PropertyAnalysisSettings {
  smallUnitAreaSqm: number;
  largeBuildingAreaSqm: number;
  highLandPricePerSqmManwon: number;
}

export type BuildingUnitUseType = "residential" | "commercial" | "other";

export interface BuildingUnitComposition {
  id: string;
  floor: string;
  useType: BuildingUnitUseType;
  useLabel: string;
  areaSqm: number | null;
  unitCount: number;
  source: string;
}

export type NearbyMarketSource = "naver" | "molit" | "manual";
export type NearbyMarketTradeType = "매매" | "전세" | "월세" | "전월세" | "기타";

export interface NearbyMarketListing {
  id: string;
  source: NearbyMarketSource;
  tradeType: NearbyMarketTradeType;
  roomType: string;
  propertyType: string;
  dong: string;
  address: string;
  title: string;
  areaSqm: number | null;
  floor: string;
  buildYear: number | null;
  dealAmountManwon: number | null;
  depositManwon: number | null;
  monthlyRentManwon: number | null;
  dealDate: string;
  lat: number | null;
  lng: number | null;
}

export interface NearbyMarketRoomSummary {
  roomType: string;
  naverCount: number;
  molitCount: number;
  naverDepositAvgManwon: number | null;
  naverMonthlyRentAvgManwon: number | null;
  molitDepositAvgManwon: number | null;
  molitMonthlyRentAvgManwon: number | null;
}

export interface NearbyMarketGeminiInsight {
  oneLine: string;
  rentStrength: "good" | "normal" | "weak" | "unknown";
  vacancyRisk: "low" | "medium" | "high" | "unknown";
  recommendedRoomMix: string[];
  keyPoints: string[];
  warnings: string[];
}

export interface NearbyMarketAnalysis {
  importedAt: string;
  city: string;
  gu: string;
  dong: string;
  lat: number | null;
  lng: number | null;
  months: number | null;
  naverCount: number;
  molitCount: number;
  saleAvgMolitManwon: number | null;
  saleAvgNaverManwon: number | null;
  roomSummaries: NearbyMarketRoomSummary[];
  listings: NearbyMarketListing[];
  geminiInsight: NearbyMarketGeminiInsight | null;
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

export type PreFieldDecisionGrade = "A" | "B" | "C" | "D" | "F";

export type TargetYieldMode = "pure" | "general";

export interface MultiFamilyProfitAnalysis {
  /** 나대지 평단가 (원/평) */
  landUnitPricePerPyeong: number | null;
  /** 건축비 평단가 (원/평) */
  constructionUnitPricePerPyeong: number | null;
  /** 비교 실거래가 (원) */
  comparableSalePrice: number | null;
  /** 비교 물건 토지면적 (평) */
  comparableLandAreaPyeong: number | null;
  /** 호가 매물 기준 대출 비율 */
  askingLoanRatio: number | null;
  /** 호가 매물 기준 보증금 비율 */
  askingDepositRatio: number | null;
  /** 역산 목표 수익률 */
  targetYieldRatio: number | null;
  /** 목표 수익률 기준: 순수익률 또는 일반 수익률 */
  targetYieldMode: TargetYieldMode;
  /** 빠른 매도용 추가 수익률 프리미엄 */
  quickSaleYieldPremiumRatio: number | null;
  /** 광고 금리 검증용 대출금 */
  advertisedLoanAmount: number | null;
  /** 광고 금리 검증용 월 이자 */
  advertisedMonthlyInterest: number | null;
  memo: string;
}

export interface MultiFamilyAnalysis {
  firstInterestSaved: boolean;
  buildingRegistryChecked: boolean;
  householdCountCompared: boolean;
  appraisalComparablesChecked: boolean;
  floorPlanChecked: boolean;
  tenantReportChecked: boolean;
  saleAskingChecked: boolean;
  rentAskingChecked: boolean;
  yieldTableDone: boolean;
  askingYieldCompared: boolean;
  lowNearbyAuctionRateChecked: boolean;
  naverYieldReferenceOnly: boolean;
  gommuljuYieldFieldChecked: boolean;
  privateRoadRisk: boolean;
  rightsIllusionRisk: boolean;
  unclearFloorPlan: boolean;
  onlinePhotoFound: boolean;
  nearbyRentalDemandScore: number | null;
  subjectiveTenantScore: number | null;
  gasVacancyMonths: number | null;
  mailOverflow: boolean;
  waterLeakSigns: boolean;
  exteriorCrack: boolean;
  dryvitFront: boolean;
  roofWaterproofRisk: boolean;
  elevatorWorking: boolean | null;
  actualParkingCount: number | null;
  nearbyAuctionSaleRatePct: number | null;
  saleCaseBidPrice: number | null;
  saleCaseBidRatePct: number | null;
  saleCaseDeposit: number | null;
  saleCaseMonthlyRent: number | null;
  saleCaseMemo: string;
  threeMonthInterestCost: number | null;
  brokerageFee: number | null;
  repairCost: number | null;
  evictionPeopleCount: number | null;
  evictionCost: number | null;
  postFieldScore: number | null;
  postFieldGapReason: string;
  memo: string;
  profit: MultiFamilyProfitAnalysis;
}

export type CaseSourceDocumentKind =
  | "auctionone-pdf"
  | "registry-building"
  | "registry-land"
  | "building-ledger"
  | "appraisal-report"
  | "tenant-report"
  | "pdf"
  | "json";

export interface CaseSourceDocument {
  id: string;
  kind: CaseSourceDocumentKind;
  fileName: string;
  fileSize: number | null;
  pageCount: number | null;
  /** PDF에서 추출한 원문 텍스트 전체 */
  extractedText: string;
  /** 옥션원 스키마 등 파서가 만든 구조화 원본 */
  structuredJson: unknown | null;
  parserVersion: string;
  importedAt: string;
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
  /** 공부상/문서상 주택 호수 */
  residentialUnitCount: number | null;
  /** 공부상/문서상 상가·근린생활시설 호수 */
  commercialUnitCount: number | null;
  /** 건축물대장 기준 층별 용도·면적·호수 구성 */
  buildingUnitComposition: BuildingUnitComposition[];
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
  /** 배당·입찰 분석 기준 예상 낙찰가. 기본 권장값은 감정가의 70%. */
  expectedBidPrice: number | null;
  bidDate: string | null;
  currentRound: number;
  bidRounds: BidRound[];
  /** 다음 회차 예상 최저가 (자동 계산 캐시, null이면 재계산 유도) */
  nextExpectedMinPrice: number | null;
  wonDayActionsCompleted: boolean;
  status: CaseStatus;
  /** 1 신규, 2 정보보강, 3 시스템 권장, 4 사용자 선호, 5 최우선 */
  priorityLevel: PriorityLevel;
  /** @deprecated 5단계 priorityLevel 이전 호환용 */
  priority: Priority;
  /** 임장 조사 메모 (현장 확인·부동산 문의 등) */
  fieldSurvey: string;
  memo: string;
  /** PDF/JSON 등 등록 당시 원문 자료 */
  sourceDocuments: CaseSourceDocument[];
  /** 다가구 임대 수익·실투자금·수익률 입력 */
  rentSetting: RentSetting;
  /** 다가구 사전 임장 점수·수익률 분석 */
  multiFamilyAnalysis: MultiFamilyAnalysis;
  /** 주변 월세·전세·매매 시세 분석 결과 */
  nearbyMarketAnalysis: NearbyMarketAnalysis | null;
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
  /** 세입자 분석 전역 안내문·기본값 */
  tenantAnalysisSettings: TenantAnalysisSettings;
  /** 물건 특성 표시 기준 */
  propertyAnalysisSettings: PropertyAnalysisSettings;
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
