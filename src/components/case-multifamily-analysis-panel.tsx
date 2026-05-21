"use client";

import { useEffect, useMemo, useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import type {
  AuctionCase,
  MultiFamilyAnalysis,
  MultiFamilyProfitAnalysis,
  TargetYieldMode,
} from "@/lib/types/domain";
import {
  computeMultiFamilyScore,
  computePreFieldInfoReadiness,
  computeProfitAnalysis,
  pyeongToSqm,
  sqmToPyeong,
  unitPricePerPyeongFromSqm,
  unitPricePerSqmFromPyeong,
  type PreFieldInfoItem,
  type PreFieldInfoReadiness,
  type ScoreFactor,
} from "@/lib/domain/multifamily-analysis";
import {
  extractCaseDocumentFacts,
  type CaseDocumentFactSummary,
} from "@/lib/domain/case-document-facts";
import { CaseFieldInspectionContacts } from "@/components/case-field-inspection-contacts";
import { CaseFieldIntelSection } from "@/components/case-field-intel-section";
import { CaseMarketReferenceNotes } from "@/components/case-market-reference-notes";
import { CaseNearbyMarketComparables } from "@/components/case-nearby-market-comparables";
import { HoverHint, LabelWithHint } from "@/components/hover-hint";
import { normalizeFieldInspection } from "@/lib/domain/field-inspection";
import {
  explainCategoryScore,
  explainConfidence,
  explainGrade,
  explainTotalScore,
  FIELD_CHECK_ITEM_HINTS,
} from "@/lib/domain/score-explanations";
import { PYEONG_TO_SQM } from "@/lib/domain/rent-setting";
import { PercentRateInput } from "@/components/percent-rate-input";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";

type Props = {
  caseData: AuctionCase;
  onSave: (analysis: MultiFamilyAnalysis) => void;
  onUpdateCase: (patch: Partial<AuctionCase>) => void;
};

const AUTO_SAVE_MS = 3000;

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const MONEY_INPUT = `${INPUT} tabular-nums`;

const GRADE_LABEL: Record<string, string> = {
  A: "A · 바로 임장",
  B: "B · 손품 추가 후 임장",
  C: "C · 전화 조사 우선",
  D: "D · 보류",
  F: "F · 즉시 패스",
};

const CHECK_ITEMS: {
  key: keyof Pick<
    MultiFamilyAnalysis,
    | "privateRoadRisk"
    | "rightsIllusionRisk"
    | "unclearFloorPlan"
    | "onlinePhotoFound"
    | "mailOverflow"
    | "waterLeakSigns"
    | "exteriorCrack"
    | "dryvitFront"
    | "roofWaterproofRisk"
  >;
  label: string;
}[] = [
  { key: "privateRoadRisk", label: "사유지 도로·접도 리스크" },
  { key: "rightsIllusionRisk", label: "대항력 착시 가능성" },
  { key: "unclearFloorPlan", label: "도면·현황 불명확" },
  { key: "onlinePhotoFound", label: "내부 사진 확인됨" },
  { key: "mailOverflow", label: "우편물 장기 적체" },
  { key: "waterLeakSigns", label: "누수 흔적" },
  { key: "exteriorCrack", label: "외벽 크랙" },
  { key: "dryvitFront", label: "전면 드라이비트" },
  { key: "roofWaterproofRisk", label: "옥상 방수 리스크" },
];

const SEARCH_CHECK_ITEMS: {
  key: keyof Pick<
    MultiFamilyAnalysis,
    | "firstInterestSaved"
    | "buildingRegistryChecked"
    | "householdCountCompared"
    | "appraisalComparablesChecked"
    | "floorPlanChecked"
    | "tenantReportChecked"
    | "saleAskingChecked"
    | "rentAskingChecked"
    | "yieldTableDone"
    | "askingYieldCompared"
    | "lowNearbyAuctionRateChecked"
    | "naverYieldReferenceOnly"
    | "gommuljuYieldFieldChecked"
  >;
  label: string;
}[] = [
  { key: "firstInterestSaved", label: "지역·사진 스캔 후 1차 관심물건 저장" },
  { key: "buildingRegistryChecked", label: "건축물대장 확인" },
  { key: "householdCountCompared", label: "사진상 호실 수와 공부상 가구 수 비교" },
  { key: "appraisalComparablesChecked", label: "감정평가서 비교 사례 수 확인" },
  { key: "floorPlanChecked", label: "도면 확인" },
  { key: "tenantReportChecked", label: "임차신고내역 확인" },
  { key: "saleAskingChecked", label: "네이버부동산 매매 호가 확인" },
  { key: "rentAskingChecked", label: "네이버·다방·직방·공실박스 월세 호가 확인" },
  { key: "yieldTableDone", label: "수익률표 작성" },
  { key: "askingYieldCompared", label: "호가 매물 수익률표로 매도가 산정" },
  { key: "lowNearbyAuctionRateChecked", label: "주변 낮은 낙찰가율 물건 확인" },
  { key: "naverYieldReferenceOnly", label: "네이버 수익률은 참고용으로만 사용" },
  { key: "gommuljuYieldFieldChecked", label: "곰물주 방식 수익률표로 임장 검증" },
];

export function CaseMultiFamilyAnalysisPanel({
  caseData,
  onSave,
  onUpdateCase,
}: Props) {
  const [draftAnalysis, setDraftAnalysis] = useState(caseData.multiFamilyAnalysis);
  const [applied, setApplied] = useState(false);
  const analysis = draftAnalysis;
  const score = useMemo(
    () => computeMultiFamilyScore(caseData, analysis),
    [caseData, analysis],
  );
  const preFieldReadiness = useMemo(
    () => computePreFieldInfoReadiness(caseData, analysis),
    [caseData, analysis],
  );
  const profit = useMemo(
    () => computeProfitAnalysis(caseData, analysis),
    [caseData, analysis],
  );
  const documentFacts = useMemo(
    () => extractCaseDocumentFacts(caseData.sourceDocuments ?? []),
    [caseData.sourceDocuments],
  );
  const factSummaries =
    documentFacts.summaries.length > 0
      ? documentFacts.summaries
      : fallbackFactSummaries(caseData);
  const categorySummaries = useMemo(() => buildCategorySummaries(score), [score]);
  const hasPendingChanges = useMemo(
    () => JSON.stringify(analysis) !== JSON.stringify(caseData.multiFamilyAnalysis),
    [analysis, caseData.multiFamilyAnalysis],
  );
  const buildingSqm =
    caseData.rentSetting.grossFloorAreaSqm ?? caseData.buildingAreaSqm;
  const landPyeong = sqmToPyeong(caseData.landAreaSqm);
  const buildingPyeong = sqmToPyeong(buildingSqm);
  const expectedBidPrice =
    caseData.expectedBidPrice ??
    (caseData.appraisalPrice != null ? Math.round(caseData.appraisalPrice * 0.7) : null);
  const saleCaseRate =
    analysis.saleCaseBidRatePct ??
    (analysis.saleCaseBidPrice != null && caseData.appraisalPrice != null && caseData.appraisalPrice > 0
      ? (analysis.saleCaseBidPrice / caseData.appraisalPrice) * 100
      : null);
  const saleCaseBasedBid =
    saleCaseRate != null && caseData.appraisalPrice != null
      ? Math.round(caseData.appraisalPrice * (saleCaseRate / 100))
      : null;
  const saleCaseNetMonthly =
    (analysis.saleCaseMonthlyRent ?? 0) - profit.monthlyInterest;
  const saleCaseEquity =
    saleCaseBasedBid != null
      ? saleCaseBasedBid - (caseData.rentSetting.loanAmount ?? 0) - (analysis.saleCaseDeposit ?? 0)
      : null;
  const saleCasePureYield =
    saleCaseEquity != null && saleCaseEquity > 0
      ? (saleCaseNetMonthly * 12 * 100) / saleCaseEquity
      : null;
  const saleCaseComment =
    saleCaseBasedBid == null
      ? "인근 매각사례 낙찰가 또는 낙찰가율을 입력하면 감정가 대비 입찰가와 수익성을 비교합니다."
      : expectedBidPrice != null && saleCaseBasedBid > expectedBidPrice
        ? "인근 매각사례 기준 입찰가가 감정가 70% 기준보다 높습니다. 주차·룸구성·배당부족·수리비를 함께 보고 상향 여부를 판단하세요."
        : "인근 매각사례 기준 입찰가가 감정가 70% 기준 이하입니다. 수익률이 유지된다면 보수 입찰 후보로 검토할 수 있습니다.";

  const update = (patch: Partial<MultiFamilyAnalysis>) => {
    setDraftAnalysis((prev) => ({ ...prev, ...patch }));
  };
  const updateProfit = (patch: Partial<MultiFamilyProfitAnalysis>) => {
    setDraftAnalysis((prev) => ({
      ...prev,
      profit: { ...prev.profit, ...patch },
    }));
  };
  const applyDraft = () => {
    onSave(analysis);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 1400);
  };

  useEffect(() => {
    if (!hasPendingChanges) return;
    const timer = window.setTimeout(() => {
      onSave(analysis);
      setApplied(true);
      window.setTimeout(() => setApplied(false), 1400);
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [analysis, hasPendingChanges, onSave]);

  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">다가구 마스터 분석</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            등록된 물건 정보를 바탕으로 임장 전 점수, 수익률 착시, 시세 하한선,
            매도가 역산을 함께 확인합니다. 변경 사항은 약 3초 후 자동 저장됩니다.
          </p>
        </div>
        <ApplyButton
          onClick={applyDraft}
          hasPendingChanges={hasPendingChanges}
          applied={applied}
        />
      </div>

      <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3">
        <div className="rounded-xl border border-neutral-200 p-3 text-right dark:border-neutral-800">
          <p className="text-xs text-neutral-500">
            <LabelWithHint
              label="사전 임장 점수"
              hint={explainTotalScore(score.totalScore)}
            />
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {score.totalScore}점
          </p>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {GRADE_LABEL[score.grade]}
            <HoverHint
              text={explainGrade(
                score.grade,
                score.totalScore,
                score.hardFailReasons,
              )}
            />
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            <LabelWithHint
              label={`정보 신뢰도 ${score.confidencePct}%`}
              hint={explainConfidence(score.confidencePct)}
            />
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-xs font-medium text-neutral-500">문서 기반 분석 요약</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {factSummaries.length === 0 ? (
              <span className="text-xs text-neutral-500">
                원문/PDF 문서를 추가하면 층수·가구수·주차·보증금 요약이 표시됩니다.
              </span>
            ) : (
              factSummaries.map((item) => (
                <FactSummaryPill key={`${item.label}-${item.value}`} item={item} />
              ))
            )}
          </div>
        </div>
      </div>

      <CaseNearbyMarketComparables caseData={caseData} analysis={analysis} />

      <CaseMarketReferenceNotes
        caseData={caseData}
        onUpdateCase={(patch) => onUpdateCase(patch)}
      />

      <div className="grid gap-3 lg:grid-cols-4">
        {categorySummaries.map((summary) => (
          <div
            key={summary.category}
            className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <p className="text-xs text-neutral-500">
              <LabelWithHint
                label={summary.category}
                hint={explainCategoryScore(
                  summary.category,
                  summary.score,
                  score.factors,
                )}
              />
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {summary.score > 0 ? "+" : ""}
              {summary.score}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              {summary.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryCard title="좋은 점" items={score.strengths} />
        <SummaryCard title="위험한 점" items={score.risks} tone="risk" />
        <SummaryCard title="추천 행동" items={[score.action]} />
      </div>

      {score.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {score.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <h3 className="font-medium">매각사례분석</h3>
          <p className="mt-1 text-xs text-neutral-500">
            인근 다가구 낙찰 사례를 기준으로 내 물건의 입찰가, 필요 실투자금,
            월세 수익성을 함께 봅니다. 감정가 70% 기준 예상 낙찰가와도 비교합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyField
            label="인근 매각가"
            value={analysis.saleCaseBidPrice}
            onChange={(v) => update({ saleCaseBidPrice: v })}
          />
          <PercentRateInput
            label="인근 낙찰가율"
            className={`${INPUT} tabular-nums`}
            valueMode="percent"
            value={analysis.saleCaseBidRatePct}
            onChange={(v) => update({ saleCaseBidRatePct: v })}
            placeholder="예: 72.55"
          />
          <MoneyField
            label="사례 보증금"
            value={analysis.saleCaseDeposit}
            onChange={(v) => update({ saleCaseDeposit: v })}
          />
          <MoneyField
            label="사례 월세"
            value={analysis.saleCaseMonthlyRent}
            onChange={(v) => update({ saleCaseMonthlyRent: v })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="감정가 70% 예상 낙찰가"
            value={formatWonWithUnit(expectedBidPrice)}
          />
          <Metric
            label="사례 기준 내 입찰가"
            value={formatWonWithUnit(saleCaseBasedBid)}
            tone={
              expectedBidPrice != null &&
              saleCaseBasedBid != null &&
              saleCaseBasedBid > expectedBidPrice
                ? "risk"
                : undefined
            }
          />
          <Metric
            label="사례 기준 실투자금"
            value={formatWonWithUnit(saleCaseEquity)}
            tone={saleCaseEquity != null && saleCaseEquity <= 0 ? "risk" : undefined}
          />
          <Metric
            label="사례 기준 수익률"
            value={formatPct(saleCasePureYield)}
            tone={
              saleCasePureYield != null && saleCasePureYield < 8 ? "risk" : undefined
            }
          />
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {saleCaseComment}
        </div>
        <label className="block text-xs font-medium text-neutral-500">
          매각사례 메모
          <AutoGrowTextarea
            className={INPUT}
            value={analysis.saleCaseMemo}
            onChange={(e) => update({ saleCaseMemo: e.target.value })}
            placeholder="사례 주소, 준공연도, 주차, 세대수, 룸구성, 수리상태, 특수권리 차이를 기록하세요."
          />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <h3 className="font-medium">수익률 분석</h3>
          <p className="mt-1 text-xs text-neutral-500">
            일반 수익률과 순수익률을 분리해 보증금 과다 세팅에 따른 착시를
            확인합니다. 월 이자는 대출금 × 연금리 ÷ 12로 계산합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="총 보증금" value={formatWonWithUnit(profit.totalDeposit)} />
          <Metric label="총 월세" value={formatWonWithUnit(profit.totalMonthlyRent)} />
          <Metric label="순월세" value={formatWonWithUnit(profit.monthlyNet)} />
          <Metric
            label="실투자금"
            value={formatWonWithUnit(profit.equity)}
            tone={profit.equity <= 0 ? "risk" : undefined}
          />
          <Metric
            label="일반 수익률"
            value={formatPct(profit.generalYieldPct)}
            tone={
              profit.yieldGapPct != null && profit.yieldGapPct >= 8
                ? "risk"
                : undefined
            }
          />
          <Metric label="순수익률" value={formatPct(profit.pureYieldPct)} />
          <Metric label="대출 비율" value={formatPct(profit.loanRatioPct)} />
          <Metric label="보증금 비율" value={formatPct(profit.depositRatioPct)} />
        </div>
        {profit.depositRiskWarnings.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <p className="font-medium">보증금 과다 세팅 주의</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {profit.depositRiskWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-medium">시세 추정 및 매도가 역산</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-900">
            <h4 className="text-sm font-medium">방법 1 · 나대지 + 건축비</h4>
            <p className="text-xs text-neutral-500">
              토지 {caseData.landAreaSqm != null ? `${caseData.landAreaSqm}㎡` : "-"}
              {landPyeong != null ? ` (약 ${landPyeong}평)` : ""} · 연면적{" "}
              {buildingSqm != null ? `${buildingSqm}㎡` : "-"}
              {buildingPyeong != null ? ` (약 ${buildingPyeong}평)` : ""} 기준
            </p>
            <MoneyField
              label="나대지 ㎡단가 (원/㎡)"
              value={unitPricePerSqmFromPyeong(
                analysis.profit.landUnitPricePerPyeong,
              )}
              onChange={(v) =>
                updateProfit({
                  landUnitPricePerPyeong: unitPricePerPyeongFromSqm(v),
                })
              }
            />
            <MoneyField
              label="건축비 ㎡단가 (원/㎡)"
              value={unitPricePerSqmFromPyeong(
                analysis.profit.constructionUnitPricePerPyeong,
              )}
              onChange={(v) =>
                updateProfit({
                  constructionUnitPricePerPyeong: unitPricePerPyeongFromSqm(v),
                })
              }
            />
            <Metric
              label="원가 기준 하한선"
              value={formatWonWithUnit(profit.costBasedMarketPrice)}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-900">
            <h4 className="text-sm font-medium">방법 2 · 실거래 평단가 비교</h4>
            <MoneyField
              label="비교 실거래가"
              value={analysis.profit.comparableSalePrice}
              onChange={(v) => updateProfit({ comparableSalePrice: v })}
            />
            <NumberField
              label="비교 물건 토지면적 (㎡)"
              value={pyeongToSqm(analysis.profit.comparableLandAreaPyeong)}
              max={999999}
              onChange={(v) =>
                updateProfit({
                  comparableLandAreaPyeong:
                    v != null && v > 0
                      ? Math.round((v / PYEONG_TO_SQM) * 100) / 100
                      : null,
                })
              }
            />
            <Metric
              label="역산 토지 ㎡단가"
              value={formatWonWithUnit(
                profit.comparableLandUnitPrice != null
                  ? unitPricePerSqmFromPyeong(profit.comparableLandUnitPrice)
                  : null,
              )}
            />
            <Metric
              label="내 물건 적용 시세"
              value={formatWonWithUnit(profit.comparableBasedMarketPrice)}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-neutral-100 p-3 dark:border-neutral-900">
            <h4 className="text-sm font-medium">방법 3 · 수익률 기준 매도가</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <PercentField
                label="대출 비율"
                value={analysis.profit.askingLoanRatio}
                onChange={(v) => updateProfit({ askingLoanRatio: v })}
              />
              <PercentField
                label="보증금 비율"
                value={analysis.profit.askingDepositRatio}
                onChange={(v) => updateProfit({ askingDepositRatio: v })}
              />
              <PercentField
                label="목표 수익률"
                value={analysis.profit.targetYieldRatio}
                onChange={(v) => updateProfit({ targetYieldRatio: v })}
              />
              <label className="block text-xs font-medium text-neutral-500">
                기준
                <select
                  className={INPUT}
                  value={analysis.profit.targetYieldMode}
                  onChange={(e) =>
                    updateProfit({
                      targetYieldMode: e.target.value as TargetYieldMode,
                    })
                  }
                >
                  <option value="pure">순수익률</option>
                  <option value="general">일반 수익률</option>
                </select>
              </label>
              <PercentField
                label="빠른 매도 프리미엄"
                value={analysis.profit.quickSaleYieldPremiumRatio}
                onChange={(v) => updateProfit({ quickSaleYieldPremiumRatio: v })}
              />
            </div>
            <Metric
              label="목표 기준 적정 매도가"
              value={formatWonWithUnit(profit.targetSalePrice)}
            />
            <Metric
              label="빠른 매도 권장가"
              value={formatWonWithUnit(profit.quickSalePrice)}
            />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MoneyField
            label="광고 금리 검증용 대출금"
            value={analysis.profit.advertisedLoanAmount}
            onChange={(v) => updateProfit({ advertisedLoanAmount: v })}
          />
          <MoneyField
            label="광고 금리 검증용 월 이자"
            value={analysis.profit.advertisedMonthlyInterest}
            onChange={(v) => updateProfit({ advertisedMonthlyInterest: v })}
          />
          <Metric
            label="월 이자 역산 실제 금리"
            value={formatPct(profit.actualAdvertisedRatePct)}
          />
        </div>
        <label className="block text-xs font-medium text-neutral-500">
          수익률 분석 메모
          <AutoGrowTextarea
            className={INPUT}
            value={analysis.profit.memo}
            onChange={(e) => updateProfit({ memo: e.target.value })}
            placeholder="주변 호가 매물, 실제 금리, 부동산 상담 내용"
          />
        </label>
      </section>

      <PreFieldReadinessPanel readiness={preFieldReadiness} />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <h3 className="font-medium">다가구 검색·선별 체크리스트</h3>
          <p className="mt-1 text-xs text-neutral-500">
            주택·다가구·근린주택을 감정가 높은 순으로 본 뒤, 관심 저장부터
            공부·임차·호가·수익률 검증까지 진행 상황을 기록합니다.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SEARCH_CHECK_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2 rounded-lg border border-neutral-100 px-2 py-2 text-sm dark:border-neutral-900"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={analysis[item.key]}
                onChange={(e) => update({ [item.key]: e.target.checked })}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PercentRateInput
            label="주변 낙찰가율"
            className={`${INPUT} tabular-nums`}
            valueMode="percent"
            value={analysis.nearbyAuctionSaleRatePct}
            onChange={(v) => update({ nearbyAuctionSaleRatePct: v })}
            placeholder="예: 68.25"
          />
          <MoneyField
            label="3개월 대출이자 반영액"
            value={analysis.threeMonthInterestCost}
            onChange={(v) => update({ threeMonthInterestCost: v })}
          />
          <MoneyField
            label="중개수수료 반영액"
            value={analysis.brokerageFee}
            onChange={(v) => update({ brokerageFee: v })}
          />
          <MoneyField
            label="시설수리비"
            value={analysis.repairCost}
            onChange={(v) => update({ repairCost: v })}
          />
          <NumberField
            label="명도 대상 인원"
            value={analysis.evictionPeopleCount}
            max={999}
            onChange={(v) => update({ evictionPeopleCount: v })}
          />
          <MoneyField
            label="예상 명도비용"
            value={analysis.evictionCost}
            onChange={(v) => update({ evictionCost: v })}
          />
          <Metric
            label="입찰가 반영 비용 합계"
            value={formatWonWithUnit(profit.bidCostReserve)}
          />
        </div>
      </section>

      <div className="flex justify-end border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <ApplyButton
          onClick={applyDraft}
          hasPendingChanges={hasPendingChanges}
          applied={applied}
        />
      </div>
    </section>
  );
}

function AreaSummaryCard({
  label,
  sqm,
  pyeong,
}: {
  label: string;
  sqm: number | null;
  pyeong: number | null;
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30">
      <p className="text-xs font-medium text-sky-900/80 dark:text-sky-200/80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950 dark:text-sky-50">
        {sqm != null ? `${sqm.toLocaleString("ko-KR")}㎡` : "미입력"}
      </p>
      <p className="mt-0.5 text-xs text-sky-800/70 dark:text-sky-300/70">
        {pyeong != null ? `참고 약 ${pyeong.toLocaleString("ko-KR")}평` : "기본정보 탭에서 입력"}
      </p>
    </div>
  );
}

export function CaseFieldInspectionPanel({
  caseData,
  onSave,
  onUpdateCase,
  onAppendFieldSurvey,
}: {
  caseData: AuctionCase;
  onSave: (analysis: MultiFamilyAnalysis) => void;
  onUpdateCase?: (patch: Partial<AuctionCase>) => void;
  onAppendFieldSurvey?: (text: string) => void;
}) {
  const fieldInspection = normalizeFieldInspection(caseData.fieldInspection);
  const analysis = caseData.multiFamilyAnalysis;
  const score = useMemo(
    () => computeMultiFamilyScore(caseData, analysis),
    [caseData, analysis],
  );
  const documentFacts = useMemo(
    () => extractCaseDocumentFacts(caseData.sourceDocuments ?? []),
    [caseData.sourceDocuments],
  );
  const factSummaries =
    documentFacts.summaries.length > 0
      ? documentFacts.summaries
      : fallbackFactSummaries(caseData);

  const update = (patch: Partial<MultiFamilyAnalysis>) => {
    onSave({ ...analysis, ...patch });
  };

  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="text-lg font-semibold">임장 확인</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          문서와 다가구 분석 결과를 바탕으로 실제 현장에서 확인할 내용과
          부동산에 물어볼 질문을 따로 정리합니다.
        </p>
      </div>

      <CaseFieldIntelSection
        caseData={caseData}
        onAppendFieldSurvey={onAppendFieldSurvey}
      />

      {onUpdateCase && (
        <CaseFieldInspectionContacts
          record={fieldInspection}
          onChange={(next) =>
            onUpdateCase({ fieldInspection: normalizeFieldInspection(next) })
          }
        />
      )}

      <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <h3 className="font-medium">문서 기준 확인 포인트</h3>
          <p className="mt-1 text-xs text-neutral-500">
            아래 항목은 현장 사진, 우편함, 계량기, 출입문, 부동산 답변으로
            문서값과 실제 현황이 맞는지 확인하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {factSummaries.length === 0 ? (
            <span className="text-sm text-neutral-500">
              원문/PDF 문서를 추가하면 층수·가구수·주차·임차 요약이 표시됩니다.
            </span>
          ) : (
            factSummaries.map((item) => (
              <FactSummaryPill key={`${item.label}-${item.value}`} item={item} />
            ))
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-medium">현장에서 직접 확인할 내용</h3>
          <ul className="space-y-2 text-sm">
            {score.fieldChecklist.map((item) => (
              <li key={item} className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-medium">부동산에 물어볼 질문</h3>
          <ul className="space-y-2 text-sm">
            {score.questions.map((item) => (
              <li key={item} className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-medium">임장 결과 입력</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHECK_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 rounded-lg border border-neutral-100 px-2 py-2 text-sm dark:border-neutral-900"
            >
              <input
                type="checkbox"
                checked={analysis[item.key]}
                onChange={(e) => update({ [item.key]: e.target.checked })}
              />
              <span className="flex flex-wrap items-center gap-0.5">
                {item.label}
                {FIELD_CHECK_ITEM_HINTS[item.key] && (
                  <HoverHint text={FIELD_CHECK_ITEM_HINTS[item.key]!} />
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="주변 임대 수요 (1~5)"
            hint={FIELD_CHECK_ITEM_HINTS.nearbyRentalDemandScore}
            value={analysis.nearbyRentalDemandScore}
            max={5}
            onChange={(v) => update({ nearbyRentalDemandScore: v })}
          />
          <NumberField
            label="나라면 살 수 있나 (1~5)"
            hint={FIELD_CHECK_ITEM_HINTS.subjectiveTenantScore}
            value={analysis.subjectiveTenantScore}
            max={5}
            onChange={(v) => update({ subjectiveTenantScore: v })}
          />
          <NumberField
            label="가스 계량기 잠김 개월"
            hint={FIELD_CHECK_ITEM_HINTS.gasVacancyMonths}
            value={analysis.gasVacancyMonths}
            max={999}
            onChange={(v) => update({ gasVacancyMonths: v })}
          />
          <NumberField
            label="실제 주차 가능 대수"
            hint={FIELD_CHECK_ITEM_HINTS.actualParkingCount}
            value={analysis.actualParkingCount}
            max={99999}
            onChange={(v) => update({ actualParkingCount: v })}
          />
          <label className="block text-xs font-medium text-neutral-500">
            <LabelWithHint
              label="엘리베이터 상태"
              hint={FIELD_CHECK_ITEM_HINTS.elevatorWorking ?? ""}
            />
            <select
              className={INPUT}
              value={
                analysis.elevatorWorking == null
                  ? "unknown"
                  : analysis.elevatorWorking
                    ? "yes"
                    : "no"
              }
              onChange={(e) =>
                update({
                  elevatorWorking:
                    e.target.value === "unknown"
                      ? null
                      : e.target.value === "yes",
                })
              }
            >
              <option value="unknown">미확인</option>
              <option value="yes">작동</option>
              <option value="no">미작동</option>
            </select>
          </label>
          <NumberField
            label="임장 후 실제 점수"
            hint={FIELD_CHECK_ITEM_HINTS.postFieldScore}
            value={analysis.postFieldScore}
            max={150}
            onChange={(v) => update({ postFieldScore: v })}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-medium text-neutral-500">
            임장 메모
            <AutoGrowTextarea
              className={INPUT}
              value={analysis.memo}
              onChange={(e) => update({ memo: e.target.value })}
              placeholder="현장 확인 결과, 주변 시세, 관리비·공실, 부동산 답변"
            />
          </label>
          <label className="block text-xs font-medium text-neutral-500">
            사전/사후 점수 차이 원인
            <AutoGrowTextarea
              className={INPUT}
              value={analysis.postFieldGapReason}
              onChange={(e) => update({ postFieldGapReason: e.target.value })}
              placeholder="예: 실제 주차 불가, 복도 누수, 내부 상태 양호 등"
            />
          </label>
        </div>
      </section>
    </section>
  );
}

function ApplyButton({
  onClick,
  hasPendingChanges,
  applied,
}: {
  onClick: () => void;
  hasPendingChanges: boolean;
  applied: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {applied && (
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          적용됨
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          applied
            ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
            : hasPendingChanges
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
        }`}
      >
        {applied ? "적용 완료" : "적용"}
      </button>
    </div>
  );
}

type CategoryName = ScoreFactor["category"];

function PreFieldReadinessPanel({
  readiness,
}: {
  readiness: PreFieldInfoReadiness;
}) {
  const topMissing = readiness.items.filter((item) => !item.completed).slice(0, 6);
  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">임장 전 사전 정보</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              정보충실도 {readiness.completenessPct}% · {readiness.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-950 dark:text-amber-100">
            {readiness.summary}
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center text-xs">
          <ReadinessMetric
            label="완료"
            value={`${readiness.completedCount}/${readiness.totalCount}`}
          />
          <ReadinessMetric
            label="필수 미입력"
            value={`${readiness.requiredMissingCount}개`}
            tone={readiness.requiredMissingCount > 0 ? "risk" : "good"}
          />
          <ReadinessMetric
            label="리스크 미확인"
            value={`${readiness.riskMissingCount}개`}
            tone={readiness.riskMissingCount > 0 ? "risk" : "good"}
          />
        </div>
      </div>

      {topMissing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-white/80 p-3 dark:border-amber-900 dark:bg-neutral-950/70">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            먼저 채우면 판단력이 좋아지는 항목
          </p>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {topMissing.map((item) => (
              <PreFieldInfoRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <ReadinessGroup
          title="점수에 직접 반영"
          items={readiness.scoreInputs}
          emptyText="점수 반영 항목이 모두 채워졌습니다."
        />
        <ReadinessGroup
          title="리스크 차단"
          items={readiness.riskInputs}
          emptyText="핵심 리스크 확인이 완료되었습니다."
        />
        <ReadinessGroup
          title="기초 필수"
          items={readiness.items.filter((item) => item.kind === "required")}
          emptyText="기초자료가 준비되었습니다."
        />
      </div>
    </section>
  );
}

function ReadinessMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "risk";
}) {
  return (
    <div className="rounded-lg bg-white px-2 py-2 dark:bg-neutral-950">
      <p className="text-neutral-500">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${
          tone === "good"
            ? "text-emerald-700 dark:text-emerald-300"
            : tone === "risk"
              ? "text-rose-700 dark:text-rose-300"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ReadinessGroup({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: PreFieldInfoItem[];
  emptyText: string;
}) {
  const missing = items.filter((item) => !item.completed);
  const visible = missing.length > 0 ? missing.slice(0, 4) : items.slice(0, 3);
  return (
    <div className="rounded-lg border border-amber-200 bg-white/80 p-3 dark:border-amber-900 dark:bg-neutral-950/70">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-neutral-500">
          {items.filter((item) => item.completed).length}/{items.length}
        </span>
      </div>
      <div className="mt-2 space-y-2">
        {visible.length === 0 ? (
          <p className="text-xs text-neutral-500">{emptyText}</p>
        ) : (
          visible.map((item) => <PreFieldInfoRow key={item.id} item={item} compact />)
        )}
      </div>
    </div>
  );
}

function PreFieldInfoRow({
  item,
  compact,
}: {
  item: PreFieldInfoItem;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-2 text-xs dark:border-neutral-900 dark:bg-neutral-900/70">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            {item.label}
            <HoverHint text={`${item.description}\n\n${item.impact}`} />
          </p>
          {!compact && (
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
              {item.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
            item.completed
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          }`}
        >
          {item.completed ? "완료" : "필요"}
        </span>
      </div>
      <p className="mt-1 text-neutral-500">{item.impact}</p>
    </div>
  );
}

function buildCategorySummaries(score: {
  categoryScores: Record<CategoryName, number>;
  factors: ScoreFactor[];
}): { category: CategoryName; score: number; reasons: string[] }[] {
  const categories: CategoryName[] = ["수익성", "안전성", "현장성", "매도성"];
  return categories.map((category) => {
    const factors = score.factors
      .filter((factor) => factor.category === category)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const reasons = factors.slice(0, 3).map((factor) => {
      const sign = factor.score > 0 ? "+" : "";
      return `${sign}${factor.score} · ${factor.label}`;
    });
    return {
      category,
      score: score.categoryScores[category],
      reasons: reasons.length ? reasons : ["추가 입력 후 이유가 자동 정리됩니다."],
    };
  });
}

function SummaryCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "risk";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm font-medium">{title}</p>
      <ul
        className={`mt-2 space-y-1 text-sm ${
          tone === "risk" ? "text-rose-800 dark:text-rose-200" : "text-neutral-700 dark:text-neutral-300"
        }`}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FactSummaryPill({ item }: { item: CaseDocumentFactSummary }) {
  const className =
    item.tone === "good"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : item.tone === "risk"
        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
        : item.tone === "warn"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {item.label}: {item.value}
    </span>
  );
}

function fallbackFactSummaries(c: AuctionCase): CaseDocumentFactSummary[] {
  const summaries: CaseDocumentFactSummary[] = [];
  if (c.floor) summaries.push({ label: "층수", value: c.floor, tone: "neutral" });
  if (c.householdCount != null) {
    summaries.push({
      label: "가구수",
      value: `${c.householdCount}가구`,
      tone: "neutral",
    });
  }
  if (c.parkingUnitCount != null) {
    summaries.push({
      label: "주차",
      value:
        c.householdCount != null
          ? `${c.parkingUnitCount}대 / ${c.householdCount}가구`
          : `${c.parkingUnitCount}대`,
      tone:
        c.householdCount != null && c.parkingUnitCount < c.householdCount
          ? "warn"
          : c.parkingUnitCount >= 10
            ? "good"
            : "neutral",
    });
  }
  if (c.builtYear) {
    summaries.push({ label: "준공/승인", value: c.builtYear, tone: "neutral" });
  }
  if (c.buildingAreaSqm != null) {
    summaries.push({
      label: "건물면적",
      value: `${c.buildingAreaSqm.toLocaleString("ko-KR")}㎡`,
      tone: c.buildingAreaSqm >= 500 ? "good" : "neutral",
    });
  }
  return summaries.slice(0, 6);
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "risk";
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-900 dark:bg-neutral-900/60">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          tone === "risk" ? "text-rose-700 dark:text-rose-300" : ""
        }`}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      <input
        inputMode="numeric"
        className={MONEY_INPUT}
        value={value != null ? formatWonDigits(value) : ""}
        onChange={(e) => onChange(parseWonInput(e.target.value))}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (v: number | null) => void;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {hint ? <LabelWithHint label={label} hint={hint} /> : label}
      <input
        inputMode="decimal"
        className={`${INPUT} tabular-nums`}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim().replace(",", ".");
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : null);
        }}
      />
    </label>
  );
}

function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <PercentRateInput
      label={label}
      className={`${INPUT} tabular-nums`}
      valueMode="ratio"
      value={value}
      onChange={onChange}
    />
  );
}

function formatPct(v: number | null): string {
  return v == null || !Number.isFinite(v) ? "" : `${v.toFixed(2)}%`;
}
