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
  /** 탐문·시장정보 가이드 slug (`field-intel` 페이지) */
  fieldIntelGuideId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 외부 AI(ChatGPT 등) 질문·답 카테고리 */
export type ExternalAiQaCategory =
  | "market"
  | "bid"
  | "rent_trend"
  | "tenant"
  | "other";

export interface ExternalAiQaEntry {
  id: string;
  category: ExternalAiQaCategory;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
  originCaseId?: string | null;
}

export type AuctionSaleSellerType =
  | "private"
  | "lh"
  | "sh"
  | "trust"
  | "unknown";

/** 인근 경매 매각 비교 사례 */
export interface AuctionSaleComparable {
  id: string;
  caseNumber: string;
  address: string;
  dong: string;
  lat: number | null;
  lng: number | null;
  useApprovalDate: string | null;
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  roomShapeSummary: string;
  parkingCount: number | null;
  isMultifamily: boolean;
  hasNeighborhoodCommercial: boolean;
  appraisalPrice: number | null;
  winningBidPrice: number | null;
  bidRatePct: number | null;
  soldRound: number | null;
  sellerType: AuctionSaleSellerType;
  bidDate: string | null;
  memo: string;
  sourceUrl: string;
  /** 진행 중 경매 (매각완료 아님) */
  isOngoing: boolean;
  /** 입찰 참가자 수 */
  bidderCount: number | null;
  /** 유찰 회차 (진행 중·비교용) */
  failedRoundCount: number | null;
  /** PDF 등록 시 추출 원문 (로컬 미리보기, 용량 제한) */
  sourceExtractedText?: string;
  createdAt: string;
  updatedAt: string;
}

export type CompareAnchorSource = "address" | "map_pick" | "market";

export interface AuctionCompareAnchor {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  source: CompareAnchorSource;
}

export interface AuctionBidAnalysisResult {
  peerCount: number;
  auctionMedianBidRatePct: number | null;
  auctionAdjustedBidRatePct: number | null;
  marketSaleWon: number | null;
  marketImpliedBidRatePct: number | null;
  landFloorWon: number | null;
  landFloorBidRatePct: number | null;
  suggestedBidWon: number | null;
  suggestedBidRatePct: number | null;
  rangeLowWon: number | null;
  rangeHighWon: number | null;
  narrative: string;
  computedAt: string;
}

export interface AuctionBidAnalysis {
  anchor: AuctionCompareAnchor;
  useApprovalDate: string | null;
  ageAdjustPctPerYear: number;
  wizardStep: 1 | 2 | 3 | 4 | 5;
  lastResult: AuctionBidAnalysisResult | null;
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

/** 인근 시세 아래 부동산·AI 참고 메모 (매매/월세/전세 구분) */
export type MarketReferenceTradeKind = "sale" | "monthly" | "jeonse" | "all";

export interface MarketReferenceNote {
  id: string;
  tradeKind: MarketReferenceTradeKind;
  content: string;
  createdAt: string;
  updatedAt: string;
}
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
  /** @deprecated 건물면적 우선 — buildingAreaSqm 사용 권장 */
  areaSqm: number | null;
  /** 실거래 건물·연면적(㎡) — 거래면적 컬럼에 표시 */
  buildingAreaSqm: number | null;
  /** 실거래 토지·대지면적(㎡) */
  landAreaSqm: number | null;
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

/** 구(LAWD_CD) 단위 국토부 실거래 캐시 — 사건마다 API 재호출 방지 */
export interface GuMarketCacheEntry {
  lawdCode: string;
  city: string;
  gu: string;
  saleMonthsCovered: string[];
  rentMonthsCovered: string[];
  listings: NearbyMarketListing[];
  importedAt: string;
}

export interface NearbyMarketAnalysis {
  importedAt: string;
  city: string;
  gu: string;
  dong: string;
  lat: number | null;
  lng: number | null;
  /** @deprecated rentMonths·saleMonths 사용 */
  months: number | null;
  /** 매매 조회 개월 수 (기본 120) */
  saleMonths: number | null;
  /** 전월세 조회 개월 수 (기본 12) */
  rentMonths: number | null;
  naverCount: number;
  molitCount: number;
  saleAvgMolitManwon: number | null;
  saleAvgNaverManwon: number | null;
  roomSummaries: NearbyMarketRoomSummary[];
  listings: NearbyMarketListing[];
  geminiInsight: NearbyMarketGeminiInsight | null;
}

export type RemodelingPhase = "phase1" | "phase2" | "phase3";

export type RemodelingOccupancy = "vacant" | "occupied" | "unknown";

/** 임대 호실 유형 (다가구·빌라) */
export type RemodelingRoomUnitType =
  | "one_room"
  | "one_half_room"
  | "two_room"
  | "owner"
  | "unknown";

/** 최소=고효율, balanced=추가 검토, full=전면 */
export type RemodelingScenarioTier = "minimal" | "balanced" | "full";

export type RemodelingWorkScope = "reuse" | "partial" | "full_replace";

export interface RemodelingRentUpliftByRoom {
  oneRoom: number;
  oneHalfRoom: number;
  twoRoom: number;
}

export interface RemodelingCatalogItem {
  key: string;
  category: string;
  item: string;
  workScope: RemodelingWorkScope;
  materialManwon: number;
  laborManwon: number;
  diy: boolean;
  effectNote: string;
  /** 포함 시나리오 */
  scenarioTiers: RemodelingScenarioTier[];
  rentUpliftManwon: RemodelingRentUpliftByRoom;
  /** 월세상승/비용 — 최소 패키지 선정용 */
  efficiencyScore: number;
}

/** 지역별 리모델링 단가·효과 (시장조사 반영) */
export interface RemodelingPriceCatalog {
  regionId: string;
  regionLabel: string;
  sourceNote: string;
  updatedAt: string;
  items: RemodelingCatalogItem[];
}

export interface RemodelingCheckItem {
  id: string;
  label: string;
  method: string;
  okCriteria: string;
  action: string;
  done: boolean;
  note: string;
}

export interface RemodelingCostLine {
  id: string;
  /** 카탈로그 키 (대전 기본단가 연동) */
  catalogKey: string | null;
  item: string;
  materialManwon: number | null;
  laborManwon: number | null;
  selected: boolean;
  diy: boolean;
  workScope: RemodelingWorkScope | null;
  effectNote: string;
  rentUpliftManwon: number | null;
}

/** @deprecated 호실별 편집 — 마이그레이션 후 unitAssignments 사용 */
export interface UnitRemodeling {
  unitKey: string;
  unitLabel: string;
  roomUnitType: RemodelingRoomUnitType;
  scenarioTier: RemodelingScenarioTier;
  phase: RemodelingPhase;
  occupancy: RemodelingOccupancy;
  checklist: RemodelingCheckItem[];
  costLines: RemodelingCostLine[];
  memo: string;
  completed: boolean;
}

/** 룸 구성(원룸·1.5룸 등)별 수리 패키지 — 호실 라벨 없음 */
export interface RemodelingRoomProfile {
  profileKey: string;
  roomUnitType: RemodelingRoomUnitType;
  label: string;
  costLines: RemodelingCostLine[];
  memo: string;
}

/** 시나리오(최소·균형·전면)별 건물 분석 단위 */
export interface RemodelingScenarioPlan {
  tier: RemodelingScenarioTier;
  roomProfiles: RemodelingRoomProfile[];
  buildingCostLines: RemodelingCostLine[];
  memo: string;
}

/** 호실별 적용 여부 (나중 결정) */
export interface UnitRemodelingAssignment {
  unitKey: string;
  unitLabel: string;
  roomUnitType: RemodelingRoomUnitType;
  apply: boolean;
  profileKey: string | null;
  scenarioTier: RemodelingScenarioTier | null;
  occupancy: RemodelingOccupancy;
  memo: string;
  completed: boolean;
}

export interface CaseRemodeling {
  activeScenarioTier: RemodelingScenarioTier;
  scenarios: RemodelingScenarioPlan[];
  unitAssignments: UnitRemodelingAssignment[];
  /** 이상형 다가구 인테리어 레퍼런스 (사진·공법·연결 비용) */
  idealReference: RemodelingIdealReference;
  memo: string;
  updatedAt: string;
  /** @deprecated 마이그레이션용 */
  units?: UnitRemodeling[];
  /** @deprecated 마이그레이션용 */
  buildingCostLines?: RemodelingCostLine[];
}

/** 이상형 인테리어 사진 구역 */
export type RemodelingReferenceZone =
  | "overview"
  | "entrance"
  | "living"
  | "bathroom"
  | "bedroom"
  | "other";

export interface RemodelingReferencePhoto {
  id: string;
  zone: RemodelingReferenceZone;
  caption: string;
  /** 해당 구역 공사 방법·시공 포인트 */
  constructionMethod: string;
  /** 카탈로그 공종 키 (비용 연동) */
  linkedCatalogKeys: string[];
  /** 사진별 추가 예상 비용 (만원, 수동 보정) */
  estimatedCostManwon: number | null;
  /** IndexedDB 이미지 키 (= id) */
  imageRef: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemodelingIdealReference {
  title: string;
  summary: string;
  /** 건물 공통 공법·자재 기준 */
  globalConstructionNotes: string;
  photos: RemodelingReferencePhoto[];
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

export type FieldContactDistance =
  | "within_100m"
  | "within_250m"
  | "within_500m"
  | "same_block"
  | "unknown";

export type ManagementServiceScopeKey =
  | "cleaning"
  | "vacant_access"
  | "repair_coordination"
  | "arrears_ledger"
  | "tenant_contact"
  | "remote_management"
  | "rent_leasing"
  | "other";

export type ManagementOfficeLocation = "in_building" | "off_site" | "unknown";

export interface BuildingManagementContact {
  companyName: string;
  contactName: string;
  phone: string;
  serviceScopes: ManagementServiceScopeKey[];
  serviceScopeOther: string;
  monthlyFeePerUnitManwon: number | null;
  vacantAccessAvailable: boolean | null;
  arrearsLedgerAvailable: boolean | null;
  remoteManagement: boolean | null;
  postAuctionCooperation: boolean | null;
  visitedAt: string | null;
  reliabilityScore: number | null;
  memo: string;
}

export interface NearbyBrokerContact {
  id: string;
  agencyName: string;
  ownerName: string;
  phone: string;
  distance: FieldContactDistance;
  isMultifamilySpecialist: boolean | null;
  rentOpinion: string;
  saleOpinion: string;
  willManageAfterAcquisition: boolean | null;
  contactedAt: string | null;
  memo: string;
}

export interface FieldInspectionRecord {
  visitDate: string | null;
  visitDurationMin: number | null;
  companions: string;
  buildingManagement: BuildingManagementContact;
  nearbyBrokers: NearbyBrokerContact[];
  cleaningCompanyName: string;
  cleaningCompanyPhone: string;
  managementOfficeLocation: ManagementOfficeLocation | null;
  vacantUnitAccessNote: string;
  memo: string;
  updatedAt: string;
}

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

/** 행안부 도로명주소 API 선택 결과 (표준화 주소) */
export interface CaseAddressMeta {
  roadAddress: string | null;
  jibunAddress: string | null;
  /** 법정동코드 10자리 (admCd) */
  legalDongCode: string | null;
  /** 시도·시군구명 (표시용) */
  siNm: string | null;
  sggNm: string | null;
  /** 읍면동명 */
  emdNm: string | null;
  zipNo: string | null;
  /** 본번·부번 (지번) */
  bonbun: number | null;
  bubun: number | null;
  /** 필지고유번호 19자리 (산지 여부 반영) */
  pnu: string | null;
  /** 국토부 실거래 LAWD_CD 5자리 (대전 구 매핑 등) */
  molitLawdCode: string | null;
  /** UTM-K 좌표 (행안부 entX/entY) */
  entX: string | null;
  entY: string | null;
  resolvedAt: string | null;
}

/** 입찰 전(전반) / 낙찰 후(후반) / 종료 */
export type CasePhase = "pre_auction" | "post_auction" | "closed";

export interface CaseAnalysisReportSnapshot {
  generatedAt: string;
  /** IndexedDB 키 — html이 비어 있으면 여기서 로드 */
  htmlRef: string | null;
  html: string;
  templateVersion: string;
}

export interface PreAuctionWorkflow {
  /** 보고서 표지·파일명용 별칭 (예: 나경빌라) */
  reportNickname: string;
  /** 기수·코호트 (예: 2026-1기) */
  reportCohort: string;
  /** 분석보고서 템플릿 버전 (예: Ver0530) */
  reportTemplateVersion: string;
  /** §1 선정 이유 */
  reportSelectionReason: string;
  /** §6 위치·교통·편의 */
  reportLocationNotes: string;
  /** §7 임장·건물 사진 메모 */
  reportFieldPhotoNotes: string;
  /** §10 경매 조회수·관심도 (자유 메모) */
  reportAuctionInterest: string;
  /** §10 조회수 — 전체 */
  viewCountTotal: number | null;
  /** §10 유효 조회 */
  viewCountValid: number | null;
  /** §10 온비드 등 */
  viewCountOnbid: number | null;
  /** §12 대출·LTV·신탁 요약 */
  reportLoanSummary: string;
  /** §14 입찰 당일 여유분 */
  reportBidDayBuffer: string;
  lastReport: CaseAnalysisReportSnapshot | null;
  /** 입찰 분석 보고서 확정 여부 */
  reportFinalized: boolean;
}

export interface PostAuctionLoanPackage {
  preApprovalNotes: string;
  executionNotes: string;
  memo: string;
}

export interface PostAuctionEvictionPackage {
  tenantSummary: string;
  planNotes: string;
  memo: string;
}

export interface PostAuctionLeasingPackage {
  targetRentNotes: string;
  marketingNotes: string;
  memo: string;
}

export interface PostAuctionRemodelingPackage {
  scopeNotes: string;
  budgetNotes: string;
  memo: string;
}

/** 임장·보고서용 사진 구역 */
export type FieldPhotoZone =
  | "exterior"
  | "interior"
  | "floor"
  | "roof"
  | "unit"
  | "structure"
  | "surroundings";

export interface FieldPhotoRecord {
  id: string;
  zone: FieldPhotoZone;
  caption: string;
  imageRef: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseFieldPhotoGallery {
  photos: FieldPhotoRecord[];
}

export type TenantDividendStatus = "full" | "partial" | "none" | "unknown";

/** §8 임차인 구조화 기록 (PDF·탐문 병합) */
export interface CaseTenantRecord {
  id: string;
  unit: string;
  occupantName: string;
  deposit: number | null;
  monthlyRent: number | null;
  moveInDate: string;
  confirmedDate: string;
  dividendRequestDate: string;
  hasOpposingPower: boolean | null;
  dividendAmount: number | null;
  undividedAmount: number | null;
  dividendStatus: TenantDividendStatus;
  inquiryNotes: string;
  memo: string;
  updatedAt: string;
}

export interface PostAuctionWorkflow {
  loanPackage: PostAuctionLoanPackage;
  evictionPackage: PostAuctionEvictionPackage;
  leasingPackage: PostAuctionLeasingPackage;
  remodelingEnabled: boolean;
  remodelingPackage: PostAuctionRemodelingPackage;
}

export function emptyCaseAddressMeta(): CaseAddressMeta {
  return {
    roadAddress: null,
    jibunAddress: null,
    legalDongCode: null,
    siNm: null,
    sggNm: null,
    emdNm: null,
    zipNo: null,
    bonbun: null,
    bubun: null,
    pnu: null,
    molitLawdCode: null,
    entX: null,
    entY: null,
    resolvedAt: null,
  };
}

export interface AuctionCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  caseNumber: string;
  address: string;
  /** 행안부 주소 검색으로 확정한 표준 주소·법정동·PNU 등 */
  addressMeta: CaseAddressMeta | null;
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
  /** UI·프로세스 단계 (전반/후반). status와 별도로 수동 전환 가능 */
  casePhase: CasePhase;
  /** 입찰 전: 분석 보고서·준비도 */
  preAuction: PreAuctionWorkflow;
  /** 낙찰 후: 대출·명도·임대·리모델링 패키지 */
  postAuction: PostAuctionWorkflow;
  /** 1 신규, 2 정보보강, 3 시스템 권장, 4 사용자 선호, 5 최우선 */
  priorityLevel: PriorityLevel;
  /** @deprecated 5단계 priorityLevel 이전 호환용 */
  priority: Priority;
  /** 임장 조사 메모 (현장 확인·부동산 문의 등) */
  fieldSurvey: string;
  /** 임장 현장 연락처·관리업체·주변 부동산 구조화 기록 */
  fieldInspection: FieldInspectionRecord;
  /** 임장·보고서용 건물·주변 사진 (IndexedDB) */
  fieldPhotoGallery: CaseFieldPhotoGallery;
  /** §8 임차인 구조화 표 */
  tenantRecords: CaseTenantRecord[];
  memo: string;
  /** PDF/JSON 등 등록 당시 원문 자료 */
  sourceDocuments: CaseSourceDocument[];
  /** 다가구 임대 수익·실투자금·수익률 입력 */
  rentSetting: RentSetting;
  /** 다가구 사전 임장 점수·수익률 분석 */
  multiFamilyAnalysis: MultiFamilyAnalysis;
  /** 주변 월세·전세·매매 시세 분석 결과 */
  nearbyMarketAnalysis: NearbyMarketAnalysis | null;
  /** 부동산 상담·호가 참고 (인근 시세 아래) */
  brokerMarketNotes: MarketReferenceNote[];
  /** AI·자료 분석 참고 (인근 시세 아래) */
  aiMarketNotes: MarketReferenceNote[];
  /** 외부 AI 질문·답 (이 물건 전용) */
  externalAiQa: ExternalAiQaEntry[];
  /** 인근 경매 매각 비교 (이 물건, 최대 10건) */
  auctionSaleComparables: AuctionSaleComparable[];
  /** 입찰가 통합 분석 (경매·실거래·공시지가) */
  auctionBidAnalysis: AuctionBidAnalysis;
  /** 호실·건물 리모델링 체크리스트·비용 산출 */
  remodeling: CaseRemodeling;
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
  sharedExternalAiQa: ExternalAiQaEntry[];
  sharedAuctionSaleComparables: AuctionSaleComparable[];
  cases: AuctionCase[];
  /** LAWD_CD(5자리) 키 → 구 단위 MOLIT 실거래 캐시 */
  guMarketCache: Record<string, GuMarketCacheEntry>;
  /** 리모델링 공종별 기본 단가 (대전 등) */
  remodelingPriceCatalog: RemodelingPriceCatalog;
}

export const EMPTY_DECISION: CaseDecision = {
  verdict: null,
  maxBidPrice: null,
  actualBidPrice: null,
  riskLevel: null,
  reason: "",
};
