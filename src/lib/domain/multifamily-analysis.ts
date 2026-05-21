import type {
  AuctionCase,
  MultiFamilyAnalysis,
  MultiFamilyProfitAnalysis,
  PreFieldDecisionGrade,
  TargetYieldMode,
} from "@/lib/types/domain";
import { computeRentSettingDerived, PYEONG_TO_SQM } from "@/lib/domain/rent-setting";

export interface ScoreFactor {
  label: string;
  score: number;
  category: "수익성" | "안전성" | "현장성" | "매도성";
  confidence: number;
}

export interface MultiFamilyScoreResult {
  totalScore: number;
  grade: PreFieldDecisionGrade;
  hardFailReasons: string[];
  factors: ScoreFactor[];
  categoryScores: Record<ScoreFactor["category"], number>;
  confidencePct: number;
  strengths: string[];
  risks: string[];
  questions: string[];
  action: string;
  tags: string[];
  fieldChecklist: string[];
}

export type PreFieldInfoCategory =
  | "기초자료"
  | "수익성"
  | "권리·임차"
  | "현장성"
  | "매도성";

export type PreFieldInfoKind = "required" | "score" | "risk";

export interface PreFieldInfoItem {
  id: string;
  label: string;
  description: string;
  category: PreFieldInfoCategory;
  kind: PreFieldInfoKind;
  completed: boolean;
  impact: string;
}

export interface PreFieldInfoReadiness {
  completenessPct: number;
  completedCount: number;
  totalCount: number;
  requiredMissingCount: number;
  scoreReadyCount: number;
  riskMissingCount: number;
  label: string;
  summary: string;
  items: PreFieldInfoItem[];
  missingRequired: PreFieldInfoItem[];
  scoreInputs: PreFieldInfoItem[];
  riskInputs: PreFieldInfoItem[];
}

export interface ProfitAnalysisResult {
  totalDeposit: number;
  totalMonthlyRent: number;
  monthlyInterest: number;
  monthlyNet: number;
  equity: number;
  equityWithoutDeposit: number;
  generalYieldPct: number | null;
  pureYieldPct: number | null;
  depositRatioPct: number | null;
  loanRatioPct: number | null;
  yieldGapPct: number | null;
  depositRiskWarnings: string[];
  costBasedLandPrice: number | null;
  costBasedBuildingPrice: number | null;
  costBasedMarketPrice: number | null;
  comparableLandUnitPrice: number | null;
  comparableBasedMarketPrice: number | null;
  targetSalePrice: number | null;
  quickSalePrice: number | null;
  bidCostReserve: number;
  actualAdvertisedRatePct: number | null;
}

const EMPTY_PROFIT: MultiFamilyProfitAnalysis = {
  landUnitPricePerPyeong: null,
  constructionUnitPricePerPyeong: null,
  comparableSalePrice: null,
  comparableLandAreaPyeong: null,
  askingLoanRatio: 0.5,
  askingDepositRatio: 0.2,
  targetYieldRatio: 0.095,
  targetYieldMode: "pure",
  quickSaleYieldPremiumRatio: 0.05,
  advertisedLoanAmount: null,
  advertisedMonthlyInterest: null,
  memo: "",
};

export function emptyMultiFamilyAnalysis(): MultiFamilyAnalysis {
  return {
    firstInterestSaved: false,
    buildingRegistryChecked: false,
    householdCountCompared: false,
    appraisalComparablesChecked: false,
    floorPlanChecked: false,
    tenantReportChecked: false,
    saleAskingChecked: false,
    rentAskingChecked: false,
    yieldTableDone: false,
    askingYieldCompared: false,
    lowNearbyAuctionRateChecked: false,
    naverYieldReferenceOnly: true,
    gommuljuYieldFieldChecked: false,
    privateRoadRisk: false,
    rightsIllusionRisk: false,
    unclearFloorPlan: false,
    onlinePhotoFound: false,
    nearbyRentalDemandScore: null,
    subjectiveTenantScore: null,
    gasVacancyMonths: null,
    mailOverflow: false,
    waterLeakSigns: false,
    exteriorCrack: false,
    dryvitFront: false,
    roofWaterproofRisk: false,
    elevatorWorking: null,
    actualParkingCount: null,
    nearbyAuctionSaleRatePct: null,
    saleCaseBidPrice: null,
    saleCaseBidRatePct: null,
    saleCaseDeposit: null,
    saleCaseMonthlyRent: null,
    saleCaseMemo: "",
    threeMonthInterestCost: null,
    brokerageFee: null,
    repairCost: null,
    evictionPeopleCount: null,
    evictionCost: null,
    postFieldScore: null,
    postFieldGapReason: "",
    memo: "",
    profit: { ...EMPTY_PROFIT },
  };
}

function normalizeMoney(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.round(Math.max(0, Math.min(1e15, raw)));
}

function normalizeNumber(raw: unknown, max: number): number | null {
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(Math.min(max, raw) * 100) / 100;
}

function normalizeRatio(raw: unknown, fallback: number | null): number | null {
  if (raw == null) return fallback;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.min(1, raw);
}

function normalizeScore(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

function normalizeTargetYieldMode(raw: unknown): TargetYieldMode {
  return raw === "general" ? "general" : "pure";
}

export function normalizeMultiFamilyAnalysis(raw: unknown): MultiFamilyAnalysis {
  const base = emptyMultiFamilyAnalysis();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const profitRaw =
    o.profit && typeof o.profit === "object"
      ? (o.profit as Record<string, unknown>)
      : {};
  return {
    privateRoadRisk: o.privateRoadRisk === true,
    firstInterestSaved: o.firstInterestSaved === true,
    buildingRegistryChecked: o.buildingRegistryChecked === true,
    householdCountCompared: o.householdCountCompared === true,
    appraisalComparablesChecked: o.appraisalComparablesChecked === true,
    floorPlanChecked: o.floorPlanChecked === true,
    tenantReportChecked: o.tenantReportChecked === true,
    saleAskingChecked: o.saleAskingChecked === true,
    rentAskingChecked: o.rentAskingChecked === true,
    yieldTableDone: o.yieldTableDone === true,
    askingYieldCompared: o.askingYieldCompared === true,
    lowNearbyAuctionRateChecked: o.lowNearbyAuctionRateChecked === true,
    naverYieldReferenceOnly:
      typeof o.naverYieldReferenceOnly === "boolean"
        ? o.naverYieldReferenceOnly
        : true,
    gommuljuYieldFieldChecked: o.gommuljuYieldFieldChecked === true,
    rightsIllusionRisk: o.rightsIllusionRisk === true,
    unclearFloorPlan: o.unclearFloorPlan === true,
    onlinePhotoFound: o.onlinePhotoFound === true,
    nearbyRentalDemandScore: normalizeScore(o.nearbyRentalDemandScore),
    subjectiveTenantScore: normalizeScore(o.subjectiveTenantScore),
    gasVacancyMonths: normalizeNumber(o.gasVacancyMonths, 999),
    mailOverflow: o.mailOverflow === true,
    waterLeakSigns: o.waterLeakSigns === true,
    exteriorCrack: o.exteriorCrack === true,
    dryvitFront: o.dryvitFront === true,
    roofWaterproofRisk: o.roofWaterproofRisk === true,
    elevatorWorking:
      typeof o.elevatorWorking === "boolean" ? o.elevatorWorking : null,
    actualParkingCount: normalizeNumber(o.actualParkingCount, 99999),
    nearbyAuctionSaleRatePct: normalizeNumber(o.nearbyAuctionSaleRatePct, 100),
    saleCaseBidPrice: normalizeMoney(o.saleCaseBidPrice),
    saleCaseBidRatePct: normalizeNumber(o.saleCaseBidRatePct, 100),
    saleCaseDeposit: normalizeMoney(o.saleCaseDeposit),
    saleCaseMonthlyRent: normalizeMoney(o.saleCaseMonthlyRent),
    saleCaseMemo: typeof o.saleCaseMemo === "string" ? o.saleCaseMemo : "",
    threeMonthInterestCost: normalizeMoney(o.threeMonthInterestCost),
    brokerageFee: normalizeMoney(o.brokerageFee),
    repairCost: normalizeMoney(o.repairCost),
    evictionPeopleCount: normalizeNumber(o.evictionPeopleCount, 999),
    evictionCost: normalizeMoney(o.evictionCost),
    postFieldScore: normalizeNumber(o.postFieldScore, 150),
    postFieldGapReason:
      typeof o.postFieldGapReason === "string" ? o.postFieldGapReason : "",
    memo: typeof o.memo === "string" ? o.memo : "",
    profit: {
      landUnitPricePerPyeong: normalizeMoney(profitRaw.landUnitPricePerPyeong),
      constructionUnitPricePerPyeong: normalizeMoney(
        profitRaw.constructionUnitPricePerPyeong,
      ),
      comparableSalePrice: normalizeMoney(profitRaw.comparableSalePrice),
      comparableLandAreaPyeong: normalizeNumber(
        profitRaw.comparableLandAreaPyeong,
        999999,
      ),
      askingLoanRatio: normalizeRatio(
        profitRaw.askingLoanRatio,
        base.profit.askingLoanRatio,
      ),
      askingDepositRatio: normalizeRatio(
        profitRaw.askingDepositRatio,
        base.profit.askingDepositRatio,
      ),
      targetYieldRatio: normalizeRatio(
        profitRaw.targetYieldRatio,
        base.profit.targetYieldRatio,
      ),
      targetYieldMode: normalizeTargetYieldMode(profitRaw.targetYieldMode),
      quickSaleYieldPremiumRatio: normalizeRatio(
        profitRaw.quickSaleYieldPremiumRatio,
        base.profit.quickSaleYieldPremiumRatio,
      ),
      advertisedLoanAmount: normalizeMoney(profitRaw.advertisedLoanAmount),
      advertisedMonthlyInterest: normalizeMoney(
        profitRaw.advertisedMonthlyInterest,
      ),
      memo: typeof profitRaw.memo === "string" ? profitRaw.memo : "",
    },
  };
}

export function sqmToPyeong(sqm: number | null | undefined): number | null {
  if (sqm == null || !Number.isFinite(sqm) || sqm <= 0) return null;
  return Math.round((sqm / PYEONG_TO_SQM) * 100) / 100;
}

export function pyeongToSqm(pyeong: number | null | undefined): number | null {
  if (pyeong == null || !Number.isFinite(pyeong) || pyeong <= 0) return null;
  return Math.round(pyeong * PYEONG_TO_SQM * 100) / 100;
}

export function unitPricePerSqmFromPyeong(
  perPyeong: number | null | undefined,
): number | null {
  if (perPyeong == null || !Number.isFinite(perPyeong) || perPyeong <= 0) {
    return null;
  }
  return Math.round(perPyeong / PYEONG_TO_SQM);
}

export function unitPricePerPyeongFromSqm(
  perSqm: number | null | undefined,
): number | null {
  if (perSqm == null || !Number.isFinite(perSqm) || perSqm <= 0) return null;
  return Math.round(perSqm * PYEONG_TO_SQM);
}

function pct(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeProfitAnalysis(
  c: AuctionCase,
  analysis: MultiFamilyAnalysis = c.multiFamilyAnalysis,
): ProfitAnalysisResult {
  const rs = c.rentSetting;
  const rent = computeRentSettingDerived(rs);
  const sale = rs.salePrice ?? rs.investmentYield.marketPrice ?? 0;
  const loan = rs.loanAmount ?? 0;
  const annualRate = rs.annualRate ?? rs.investmentYield.loanAnnualRate ?? 0;
  const monthlyInterest = (loan * annualRate) / 12;
  const monthlyNet = rent.totalMonthlyRent - monthlyInterest;
  const equity = sale - loan - rent.totalDeposit;
  const equityWithoutDeposit = sale - loan;
  const generalYieldPct =
    equity > 0 ? pct((monthlyNet * 12 * 100) / equity) : null;
  const pureYieldPct =
    equityWithoutDeposit > 0
      ? pct((monthlyNet * 12 * 100) / equityWithoutDeposit)
      : null;
  const depositRatioPct = sale > 0 ? pct((rent.totalDeposit / sale) * 100) : null;
  const loanRatioPct = sale > 0 ? pct((loan / sale) * 100) : null;
  const yieldGapPct =
    generalYieldPct != null && pureYieldPct != null
      ? pct(generalYieldPct - pureYieldPct)
      : null;
  const depositRiskWarnings: string[] = [];
  if (depositRatioPct != null && depositRatioPct >= 35) {
    depositRiskWarnings.push("보증금 비율이 높아 일반 수익률이 과대 표시될 수 있습니다.");
  }
  if (yieldGapPct != null && yieldGapPct >= 8) {
    depositRiskWarnings.push("일반 수익률과 순수익률의 차이가 큽니다.");
  }
  if (equity > 0 && sale > 0 && equity / sale <= 0.12) {
    depositRiskWarnings.push("실투자금이 매매가 대비 지나치게 낮습니다.");
  }

  const landPyeong = sqmToPyeong(c.landAreaSqm);
  const buildingPyeong = sqmToPyeong(
    rs.grossFloorAreaSqm ?? c.buildingAreaSqm,
  );
  const p = analysis.profit;
  const costBasedLandPrice =
    p.landUnitPricePerPyeong != null && landPyeong != null
      ? Math.round(p.landUnitPricePerPyeong * landPyeong)
      : null;
  const costBasedBuildingPrice =
    p.constructionUnitPricePerPyeong != null && buildingPyeong != null
      ? Math.round(p.constructionUnitPricePerPyeong * buildingPyeong)
      : null;
  const costBasedMarketPrice =
    costBasedLandPrice != null && costBasedBuildingPrice != null
      ? costBasedLandPrice + costBasedBuildingPrice
      : null;
  const comparableLandUnitPrice =
    p.comparableSalePrice != null &&
    p.comparableLandAreaPyeong != null &&
    p.comparableLandAreaPyeong > 0
      ? Math.round(p.comparableSalePrice / p.comparableLandAreaPyeong)
      : null;
  const comparableBasedMarketPrice =
    comparableLandUnitPrice != null && landPyeong != null
      ? Math.round(comparableLandUnitPrice * landPyeong)
      : null;
  const targetSalePrice = reverseSalePrice({
    totalMonthlyRent: rent.totalMonthlyRent,
    loanRatio: p.askingLoanRatio,
    depositRatio: p.askingDepositRatio,
    annualRate,
    targetYieldRatio: p.targetYieldRatio,
    mode: p.targetYieldMode,
  });
  const quickTarget =
    p.targetYieldRatio != null && p.quickSaleYieldPremiumRatio != null
      ? p.targetYieldRatio + p.quickSaleYieldPremiumRatio
      : null;
  const quickSalePrice = reverseSalePrice({
    totalMonthlyRent: rent.totalMonthlyRent,
    loanRatio: p.askingLoanRatio,
    depositRatio: p.askingDepositRatio,
    annualRate,
    targetYieldRatio: quickTarget,
    mode: p.targetYieldMode,
  });
  const actualAdvertisedRatePct =
    p.advertisedLoanAmount != null &&
    p.advertisedLoanAmount > 0 &&
    p.advertisedMonthlyInterest != null
      ? pct((p.advertisedMonthlyInterest * 12 * 100) / p.advertisedLoanAmount)
      : null;
  const bidCostReserve =
    (analysis.threeMonthInterestCost ?? 0) +
    (analysis.brokerageFee ?? 0) +
    (analysis.repairCost ?? 0) +
    (analysis.evictionCost ?? 0);

  return {
    totalDeposit: rent.totalDeposit,
    totalMonthlyRent: rent.totalMonthlyRent,
    monthlyInterest,
    monthlyNet,
    equity,
    equityWithoutDeposit,
    generalYieldPct,
    pureYieldPct,
    depositRatioPct,
    loanRatioPct,
    yieldGapPct,
    depositRiskWarnings,
    costBasedLandPrice,
    costBasedBuildingPrice,
    costBasedMarketPrice,
    comparableLandUnitPrice,
    comparableBasedMarketPrice,
    targetSalePrice,
    quickSalePrice,
    bidCostReserve,
    actualAdvertisedRatePct,
  };
}

function reverseSalePrice({
  totalMonthlyRent,
  loanRatio,
  depositRatio,
  annualRate,
  targetYieldRatio,
  mode,
}: {
  totalMonthlyRent: number;
  loanRatio: number | null;
  depositRatio: number | null;
  annualRate: number;
  targetYieldRatio: number | null;
  mode: TargetYieldMode;
}): number | null {
  if (
    totalMonthlyRent <= 0 ||
    loanRatio == null ||
    targetYieldRatio == null ||
    targetYieldRatio <= 0
  ) {
    return null;
  }
  const deposit = depositRatio ?? 0;
  const denominator =
    mode === "pure"
      ? targetYieldRatio * (1 - loanRatio) + loanRatio * annualRate
      : targetYieldRatio * (1 - loanRatio - deposit) + loanRatio * annualRate;
  if (denominator <= 0) return null;
  return Math.round((totalMonthlyRent * 12) / denominator);
}

export function computeMultiFamilyScore(
  c: AuctionCase,
  analysis: MultiFamilyAnalysis = c.multiFamilyAnalysis,
): MultiFamilyScoreResult {
  const profit = computeProfitAnalysis(c, analysis);
  const factors: ScoreFactor[] = [];
  const add = (
    category: ScoreFactor["category"],
    label: string,
    score: number,
    confidence: number,
  ) => factors.push({ category, label, score, confidence });

  const mix = c.roomShapeMix;
  const midLargeRooms = (mix["1.5룸"] ?? 0) + (mix["2룸"] ?? 0) + (mix["3룸"] ?? 0);
  const oneRooms = mix["1룸"] ?? 0;
  if (midLargeRooms > oneRooms && midLargeRooms > 0) {
    add("수익성", "1.5룸·투룸·쓰리룸 비중이 높음", 12, 85);
    add("매도성", "원룸 위주보다 임차인 수요 폭이 넓음", 8, 75);
  }
  if (c.householdCount != null && c.householdCount < 10) {
    add("수익성", "가구 수 10가구 미만", -8, 80);
  }
  if (c.rentSetting.unitCounts.ownerUnit > 0 || (mix["3룸"] ?? 0) > 0) {
    add("매도성", "주인세대 또는 쓰리룸 구성 가능성", 10, 70);
  }
  if (profit.pureYieldPct != null) {
    if (profit.pureYieldPct >= 7) add("수익성", "순수익률 우수", 16, 90);
    else if (profit.pureYieldPct >= 5) add("수익성", "순수익률 보통 이상", 8, 90);
    else add("수익성", "순수익률 낮음", -12, 90);
  }
  if (profit.depositRiskWarnings.length > 0) {
    add("안전성", "보증금 과다로 수익률 착시 가능", -18, 90);
  }
  const searchChecklistDone = [
    analysis.firstInterestSaved,
    analysis.buildingRegistryChecked,
    analysis.householdCountCompared,
    analysis.appraisalComparablesChecked,
    analysis.floorPlanChecked,
    analysis.tenantReportChecked,
    analysis.saleAskingChecked,
    analysis.rentAskingChecked,
    analysis.yieldTableDone,
    analysis.askingYieldCompared,
    analysis.lowNearbyAuctionRateChecked,
  ].filter(Boolean).length;
  if (searchChecklistDone >= 8) {
    add("안전성", "다가구 검색 체크리스트 대부분 확인", 8, 85);
  } else if (searchChecklistDone <= 3) {
    add("안전성", "검색·손품 확인 항목이 부족함", -8, 55);
  }
  if (analysis.householdCountCompared && c.householdCount != null && c.householdCount < 10) {
    add("수익성", "건축물대장 기준 10가구 미만", -12, 85);
  }
  if (analysis.gommuljuYieldFieldChecked) {
    add("수익성", "곰물주 방식 수익률표로 임장 검증", 8, 80);
  }
  if (analysis.lowNearbyAuctionRateChecked) {
    add("수익성", "주변 낮은 낙찰가율 기준 입찰가 검토", 6, 70);
  }
  if (c.hasBuildingViolation) {
    add("안전성", "위반건축물 표기", -25, 95);
  }
  if (analysis.privateRoadRisk) add("안전성", "사유지 도로 리스크", -35, 90);
  if (analysis.rightsIllusionRisk) add("안전성", "대항력 착시 가능성", -25, 75);
  if (analysis.unclearFloorPlan) add("현장성", "도면·현황 불명확", -12, 65);
  if (analysis.onlinePhotoFound) add("현장성", "내부 사진 확인됨", 6, 70);
  if (analysis.nearbyRentalDemandScore != null) {
    add(
      "수익성",
      "주변 임대 수요 수동 평가",
      (analysis.nearbyRentalDemandScore - 3) * 5,
      55,
    );
  }
  if (analysis.subjectiveTenantScore != null) {
    add(
      "현장성",
      "임차인 관점 주관 점수",
      (analysis.subjectiveTenantScore - 3) * 6,
      65,
    );
  }
  if (analysis.gasVacancyMonths != null && analysis.gasVacancyMonths >= 3) {
    add("현장성", "가스 계량기 장기 잠김: 진짜 공실 가능성", 8, 70);
  }
  if (analysis.mailOverflow) add("현장성", "우편물 장기 적체", -8, 70);
  if (analysis.waterLeakSigns) add("현장성", "누수 흔적", -15, 80);
  if (analysis.exteriorCrack) add("현장성", "외벽 크랙", -10, 75);
  if (analysis.dryvitFront) add("매도성", "전면 드라이비트 저가 자재 리스크", -8, 70);
  if (analysis.roofWaterproofRisk) add("현장성", "옥상 방수 리스크", -10, 75);
  if (analysis.elevatorWorking === false) add("매도성", "엘리베이터 미작동", -6, 65);
  const parking =
    analysis.actualParkingCount ?? c.parkingUnitCount ?? parseInt(c.rentSetting.parkingCount, 10);
  if (Number.isFinite(parking) && c.householdCount != null && c.householdCount > 0) {
    if (parking / c.householdCount >= 0.45) add("현장성", "가구 수 대비 주차 양호", 8, 65);
    else add("현장성", "가구 수 대비 주차 부족", -10, 65);
  }

  const totalScore = Math.max(
    0,
    Math.min(150, Math.round(100 + factors.reduce((sum, f) => sum + f.score, 0))),
  );
  const hardFailReasons = [
    ...(analysis.privateRoadRisk ? ["사유지 도로·건축허가 리스크"] : []),
    ...(c.hasBuildingViolation && analysis.unclearFloorPlan
      ? ["위반건축과 도면 불명확이 동시에 존재"]
      : []),
    ...(analysis.rightsIllusionRisk ? ["대항력 착시 가능성"] : []),
  ];
  const grade = hardFailReasons.length
    ? "F"
    : totalScore >= 120
      ? "A"
      : totalScore >= 95
        ? "B"
        : totalScore >= 75
          ? "C"
          : "D";
  const categoryScores = {
    수익성: sumCategory(factors, "수익성"),
    안전성: sumCategory(factors, "안전성"),
    현장성: sumCategory(factors, "현장성"),
    매도성: sumCategory(factors, "매도성"),
  };
  const confidencePct =
    factors.length === 0
      ? 30
      : Math.round(
          factors.reduce((sum, f) => sum + f.confidence, 0) / factors.length,
        );
  const strengths = factors
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((f) => f.label);
  const risks = [
    ...hardFailReasons,
    ...factors
      .filter((f) => f.score < 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map((f) => f.label),
    ...profit.depositRiskWarnings,
  ];
  const tags = [
    ...(analysis.rightsIllusionRisk ? ["블루오션 후보: 권리 착시 검토"] : []),
    ...(midLargeRooms > oneRooms && midLargeRooms > 0
      ? ["블루오션 후보: 룸 구성 우수"]
      : []),
    ...(profit.pureYieldPct != null && profit.pureYieldPct >= 7
      ? ["수익성 우수"]
      : []),
    ...(profit.depositRiskWarnings.length ? ["보증금 착시 주의"] : []),
  ];
  const fieldChecklist = buildFieldChecklist(c, analysis, profit);
  const questions = buildQuestions(c, analysis, profit);
  return {
    totalScore,
    grade,
    hardFailReasons,
    factors,
    categoryScores,
    confidencePct,
    strengths: strengths.length ? strengths : ["추가 입력 후 강점이 자동 정리됩니다."],
    risks: risks.length ? risks : ["현재 입력 기준 치명 리스크는 보이지 않습니다."],
    questions,
    action: actionForGrade(grade),
    tags,
    fieldChecklist,
  };
}

export function computePreFieldInfoReadiness(
  c: AuctionCase,
  analysis: MultiFamilyAnalysis = c.multiFamilyAnalysis,
): PreFieldInfoReadiness {
  const rent = computeRentSettingDerived(c.rentSetting);
  const roomShapeCount = Object.values(c.roomShapeMix).reduce((sum, v) => sum + v, 0);
  const hasRentRows = c.rentSetting.unitRows.some(
    (row) => row.deposit != null || row.monthlyRent != null,
  );
  const hasSourceDocument = (c.sourceDocuments ?? []).length > 0;
  const hasBasicPrices =
    c.appraisalPrice != null && c.minPrice != null && c.bidDate != null;
  const hasProfitInputs =
    (c.rentSetting.salePrice != null || c.expectedBidPrice != null) &&
    c.rentSetting.loanAmount != null &&
    c.rentSetting.annualRate != null &&
    (hasRentRows || rent.totalDeposit > 0 || rent.totalMonthlyRent > 0);
  const hasMarketSale =
    analysis.saleAskingChecked ||
    analysis.saleCaseBidPrice != null ||
    analysis.saleCaseBidRatePct != null;
  const hasRentMarket =
    analysis.rentAskingChecked || analysis.nearbyRentalDemandScore != null;
  const hasNearbyAuction =
    analysis.lowNearbyAuctionRateChecked || analysis.nearbyAuctionSaleRatePct != null;
  const parking =
    analysis.actualParkingCount ?? c.parkingUnitCount ?? parseInt(c.rentSetting.parkingCount, 10);
  const hasParking = Number.isFinite(parking) && parking > 0;

  const items: PreFieldInfoItem[] = [
    {
      id: "source-document",
      label: "원문 PDF·구조화 자료",
      description: "물건 PDF, 매각물건명세서, JSON 등 원문을 연결합니다.",
      category: "기초자료",
      kind: "required",
      completed: hasSourceDocument,
      impact: "자동 추출과 이후 검증의 기준 자료",
    },
    {
      id: "basic-prices",
      label: "감정가·최저가·입찰일",
      description: "기본 가격과 입찰일을 채워 낙찰가 기준을 잡습니다.",
      category: "기초자료",
      kind: "required",
      completed: hasBasicPrices,
      impact: "입찰 기준가와 일정 판단",
    },
    {
      id: "area-building",
      label: "면적·준공·건폐율·용적률",
      description: "토지/건물면적, 준공일, 건폐율, 용적률을 확인합니다.",
      category: "기초자료",
      kind: "required",
      completed:
        c.landAreaSqm != null &&
        c.buildingAreaSqm != null &&
        Boolean(c.builtYear || c.rentSetting.builtYear) &&
        Boolean(c.buildingCoverageRatio.trim() || c.floorAreaRatio.trim()),
      impact: "건물 규모와 매도성 판단",
    },
    {
      id: "room-structure",
      label: "룸 구성·가구 수",
      description: "1룸/1.5룸/2룸/3룸 구성과 공부상 가구 수를 비교합니다.",
      category: "수익성",
      kind: "score",
      completed: roomShapeCount > 0 && c.householdCount != null,
      impact: "룸 구성이 좋으면 수익성·매도성 점수 상승",
    },
    {
      id: "parking",
      label: "주차 대수",
      description: "공부상 주차 또는 실제 주차 가능 대수를 입력합니다.",
      category: "현장성",
      kind: "score",
      completed: hasParking && c.householdCount != null,
      impact: "가구 수 대비 주차가 양호하면 점수 상승",
    },
    {
      id: "rent-profit",
      label: "임대세팅·대출·금리",
      description: "매입가, 대출금, 금리, 보증금, 월세를 채웁니다.",
      category: "수익성",
      kind: "score",
      completed: hasProfitInputs,
      impact: "순수익률 산정 후 점수에 직접 반영",
    },
    {
      id: "tenant-rights",
      label: "임차신고·말소기준일",
      description: "임차신고내역과 말소기준일을 확인해 인수 리스크를 봅니다.",
      category: "권리·임차",
      kind: "risk",
      completed: analysis.tenantReportChecked && Boolean(c.lienBaseline.trim()),
      impact: "대항력 착시와 보증금 인수 가능성 차단",
    },
    {
      id: "registry-floorplan",
      label: "건축물대장·도면 비교",
      description: "가구 수, 호실 수, 도면과 실제 구조 차이를 확인합니다.",
      category: "권리·임차",
      kind: "risk",
      completed:
        analysis.buildingRegistryChecked &&
        analysis.householdCountCompared &&
        analysis.floorPlanChecked,
      impact: "위반·쪼개기·도면 불명확 리스크 차단",
    },
    {
      id: "asking-market",
      label: "매매 호가·월세 호가",
      description: "네이버/다방/직방/공실박스 등에서 매매와 월세 호가를 확인합니다.",
      category: "매도성",
      kind: "score",
      completed: hasMarketSale && hasRentMarket,
      impact: "임대 수요와 빠른 매도 가능성 판단",
    },
    {
      id: "nearby-auction",
      label: "주변 낮은 낙찰가율",
      description: "주변 낮은 낙찰가율 또는 인근 매각사례를 입력합니다.",
      category: "수익성",
      kind: "score",
      completed: hasNearbyAuction,
      impact: "보수 입찰가 검토 시 점수 상승",
    },
    {
      id: "yield-table",
      label: "수익률표 작성",
      description: "곰물주 방식 또는 자체 수익률표로 임장 전 숫자를 검증합니다.",
      category: "수익성",
      kind: "score",
      completed: analysis.yieldTableDone || analysis.gommuljuYieldFieldChecked,
      impact: "임장 전 수익성 검증 점수 상승",
    },
    {
      id: "online-photo",
      label: "내부 사진·온라인 흔적",
      description: "블로그, 광고, 과거 매물 사진 등 내부 상태 힌트를 확보합니다.",
      category: "현장성",
      kind: "score",
      completed: analysis.onlinePhotoFound,
      impact: "현장성 점수 상승과 수리비 가늠",
    },
    {
      id: "demand-scores",
      label: "임대 수요·내가 살 수 있는지",
      description: "주변 임대 수요와 임차인 관점 주관 점수를 1~5로 입력합니다.",
      category: "현장성",
      kind: "score",
      completed:
        analysis.nearbyRentalDemandScore != null &&
        analysis.subjectiveTenantScore != null,
      impact: "4~5점이면 임장 우선도 상승",
    },
    {
      id: "hard-risks",
      label: "사유지 도로·대항력 착시·위반 리스크",
      description: "치명 리스크가 있는지 먼저 체크하고, 있으면 별도 경고로 봅니다.",
      category: "권리·임차",
      kind: "risk",
      completed:
        analysis.buildingRegistryChecked &&
        analysis.tenantReportChecked &&
        (Boolean(c.lienBaseline.trim()) || analysis.rightsIllusionRisk),
      impact: "점수보다 우선하는 패스/보류 판단",
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const completenessPct = Math.round((completedCount / totalCount) * 100);
  const missingRequired = items.filter(
    (item) => item.kind === "required" && !item.completed,
  );
  const scoreInputs = items.filter((item) => item.kind === "score");
  const riskInputs = items.filter((item) => item.kind === "risk");
  const riskMissingCount = riskInputs.filter((item) => !item.completed).length;
  const label =
    completenessPct >= 85
      ? "판단 가능"
      : completenessPct >= 65
        ? "보강 권장"
        : "입력 필요";
  const summary =
    missingRequired.length > 0
      ? "기초자료가 부족해 점수보다 자료 보강을 먼저 보는 단계입니다."
      : riskMissingCount > 0
        ? "기초자료는 갖췄고, 권리·임차 리스크 확인이 남아 있습니다."
        : "임장 전 판단에 필요한 핵심 정보가 대부분 채워졌습니다.";

  return {
    completenessPct,
    completedCount,
    totalCount,
    requiredMissingCount: missingRequired.length,
    scoreReadyCount: scoreInputs.filter((item) => item.completed).length,
    riskMissingCount,
    label,
    summary,
    items,
    missingRequired,
    scoreInputs,
    riskInputs,
  };
}

function sumCategory(factors: ScoreFactor[], category: ScoreFactor["category"]): number {
  return factors
    .filter((f) => f.category === category)
    .reduce((sum, f) => sum + f.score, 0);
}

function actionForGrade(grade: PreFieldDecisionGrade): string {
  switch (grade) {
    case "A":
      return "바로 임장 우선순위에 올리세요.";
    case "B":
      return "전화 손품을 보강한 뒤 임장을 추천합니다.";
    case "C":
      return "부동산 전화조사와 온라인 자료 확인을 먼저 진행하세요.";
    case "D":
      return "보류하고 추가 정보가 생길 때 다시 판단하세요.";
    case "F":
      return "점수와 무관하게 Hard Fail 리스크를 먼저 해소해야 합니다.";
  }
}

function buildQuestions(
  c: AuctionCase,
  analysis: MultiFamilyAnalysis,
  profit: ProfitAnalysisResult,
): string[] {
  const questions = [
    "실제 호실 수와 건축물대장상 가구 수가 일치하나요?",
    "이 동네 나대지 평단가와 최근 다가구 건축비는 어느 정도인가요?",
    "이 수익률과 보증금 세팅이면 실제 거래가 가능한가요?",
  ];
  if (c.hasBuildingViolation || analysis.unclearFloorPlan) {
    questions.push("위반 부분이 수익성과 매도성에 실제로 얼마나 영향을 주나요?");
  }
  if (profit.depositRiskWarnings.length) {
    questions.push("주변 호가 매물의 보증금 세팅이 실제 계약 가능한 수준인가요?");
  }
  questions.push("손품으로 조사한 룸별 전월세 시세가 실제 임대 가능한 수준인가요?");
  questions.push("현재 시장에서 빠르게 매도 가능한 금액은 얼마인가요?");
  questions.push("이 동네 나대지 평단가와 실제 거래 가능한 평단가는 얼마인가요?");
  questions.push("부동산에서 임차인·공실·수리 관리를 맡아줄 수 있나요?");
  if (analysis.privateRoadRisk) {
    questions.push("접도와 건축허가 재취득에 문제가 없는 필지인가요?");
  }
  return questions;
}

function buildFieldChecklist(
  c: AuctionCase,
  analysis: MultiFamilyAnalysis,
  profit: ProfitAnalysisResult,
): string[] {
  const items = [
    "도면과 실제 호실 구조, 문 위치, 주차 대수 일치 여부 확인",
    "가스·전기 계량기 상태와 우편함 사진 기록",
    "복도·천장 누수 흔적, 외벽 크랙, 옥상 방수 상태 확인",
  ];
  if (c.hasBuildingViolation || analysis.unclearFloorPlan) {
    items.push("건축물대장, 현황도면, 옥탑·쪼개기 사용 여부 확인");
  }
  if (analysis.privateRoadRisk) {
    items.push("도로 지목, 소유자, 접도 조건과 건축허가 리스크 확인");
  }
  if (profit.depositRiskWarnings.length) {
    items.push("보증금 과다 세팅 여부와 실제 월세 전환 가능성 확인");
  }
  items.push("룸별 전월세 손품 시세와 현장 부동산 의견 비교");
  items.push("3개월 대출이자, 중개수수료, 수리비, 명도비용 입찰가 반영 여부 확인");
  items.push("주변 유사 다가구 호가·실거래·나대지 평단가 교차 확인");
  return items;
}
