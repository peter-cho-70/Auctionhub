"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuctionCase, MultiFamilyAnalysis } from "@/lib/types/domain";
import { sqmToPyeong } from "@/lib/domain/multifamily-analysis";
import {
  buildJibunLabel,
  caseBuildingSqm,
  caseLandSqm,
  collectDongOptions,
  formatAreaDiffSqm,
  formatBuildingAreaDiffSqm,
  formatLandAreaDiffSqm,
  formatJibunDiff,
  formatManwon,
  listingBuildingSqm,
  listingLandSqm,
  type AreaDiffDisplay,
  filterListingsByRecencyMonths,
  getComparableListings,
  inferDong,
  landWeightForSaleCompare,
  manwonToWon,
  recommendSaleComparables,
  resolveCaseJibun,
  resolveListingJibun,
  saleComparableBadges,
  similarSaleAverageManwon,
  tradeTabStats,
  type MarketScope,
  type MarketSortMode,
  type MarketTradeTab,
} from "@/lib/domain/nearby-market-comparables";
import { formatWonWithUnit } from "@/lib/format/won";

type Props = {
  caseData: AuctionCase;
  analysis: MultiFamilyAnalysis;
};

const SCOPE_LABEL: Record<MarketScope, string> = {
  same_dong: "이 동만",
  adjacent: "인접 동 포함",
  all_gu: "구 전체",
};

const SORT_LABEL: Record<MarketSortMode, string> = {
  jibun: "가까운 지번",
  area: "비슷한 면적",
  recent: "최근 거래",
  composite: "종합(동·토지·건물·연식)",
};

const LIST_DISPLAY_LIMIT = 50;

const TRADE_LABEL: Record<MarketTradeTab, string> = {
  sale: "매매",
  monthly: "월세",
  jeonse: "전세",
};

const SELECT =
  "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900";

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white/90 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950/80">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export function CaseNearbyMarketComparables({ caseData, analysis }: Props) {
  const market = caseData.nearbyMarketAnalysis;
  const defaultDong = inferDong(caseData.address) || market?.dong || "";

  const [tradeTab, setTradeTab] = useState<MarketTradeTab>("sale");
  const [scope, setScope] = useState<MarketScope>("adjacent");
  const [sortMode, setSortMode] = useState<MarketSortMode>("jibun");
  const [targetDong, setTargetDong] = useState(defaultDong);
  const [rentDisplayMonths, setRentDisplayMonths] = useState(12);

  useEffect(() => {
    setTargetDong(defaultDong);
  }, [defaultDong]);

  const dongOptions = useMemo(
    () => collectDongOptions(market?.listings ?? [], defaultDong),
    [market?.listings, defaultDong],
  );

  const listingsForTab = useMemo(() => {
    if (!market?.listings.length) return [];
    if (tradeTab === "sale") return market.listings;
    return filterListingsByRecencyMonths(market.listings, rentDisplayMonths);
  }, [market?.listings, tradeTab, rentDisplayMonths]);

  const rows = useMemo(() => {
    if (!listingsForTab.length) return [];
    return getComparableListings(caseData, listingsForTab, {
      targetDong,
      scope,
      sortMode,
      tradeTab,
      limit: LIST_DISPLAY_LIMIT,
    });
  }, [caseData, listingsForTab, targetDong, scope, sortMode, tradeTab]);

  const recommendedSales = useMemo(() => {
    if (!market?.listings.length || tradeTab !== "sale") return [];
    return recommendSaleComparables(caseData, market.listings, {
      targetDong,
      scope,
      limit: 3,
    });
  }, [caseData, market?.listings, targetDong, scope, tradeTab]);

  const recommendedIds = useMemo(
    () => new Set(recommendedSales.map((row) => row.item.id)),
    [recommendedSales],
  );

  const stats = useMemo(() => tradeTabStats(rows, tradeTab), [rows, tradeTab]);

  const landSqm = caseLandSqm(caseData);
  const buildingSqm = caseBuildingSqm(caseData);
  const landPyeong = sqmToPyeong(landSqm);
  const buildingPyeong = sqmToPyeong(buildingSqm);
  const landWeightPct = Math.round(landWeightForSaleCompare(caseData) * 100);

  const saleAvgManwon = useMemo(() => {
    if (!market?.listings.length) return null;
    return similarSaleAverageManwon(caseData, market.listings);
  }, [caseData, market?.listings]);

  const saleAvgWon = manwonToWon(saleAvgManwon);
  const expectedBid =
    caseData.expectedBidPrice ??
    (caseData.appraisalPrice != null
      ? Math.round(caseData.appraisalPrice * 0.7)
      : null);
  const saleCaseRate =
    analysis.saleCaseBidRatePct ??
    (analysis.saleCaseBidPrice != null &&
    caseData.appraisalPrice != null &&
    caseData.appraisalPrice > 0
      ? Math.round(
          (analysis.saleCaseBidPrice / caseData.appraisalPrice) * 1000,
        ) / 10
      : null);
  const saleCaseBasedBid =
    saleCaseRate != null && caseData.appraisalPrice != null
      ? Math.round(caseData.appraisalPrice * (saleCaseRate / 100))
      : analysis.saleCaseBidPrice;

  const caseJibun = buildJibunLabel(resolveCaseJibun(caseData));

  const adjacentHint =
    scope === "same_dong" &&
    market?.listings.length &&
    rows.length === 0 &&
    tradeTab;

  if (!market) {
    return (
      <section className="rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
        <h3 className="font-medium">인근 시세 (매매·월세·전세)</h3>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          국토부 실거래를 조회하면 같은 동·지번 중심으로 매매·월세·전세를 볼 수
          있습니다.
        </p>
        <Link
          href={`/cases/${caseData.id}?tab=market_analysis`}
          className="mt-3 inline-block rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          주변 시세 조회
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-violet-950 dark:text-violet-100">
            인근 시세 (매매·월세·전세)
          </h3>
          <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/80">
            기본: <strong>해당 동 · 인접 동 포함 · 가까운 지번</strong>
            {market.saleMonths || market.rentMonths ? (
              <>
                {" "}
                · 매매 {market.saleMonths ?? 120}개월 / 전월세{" "}
                {market.rentMonths ?? 12}개월 수집
              </>
            ) : null}
            {tradeTab === "sale" ? (
              <> · 매매 비교 시 토지 가중 {landWeightPct}% (노후 건물일수록 토지 반영↑)</>
            ) : null}
          </p>
        </div>
        <Link
          href={`/cases/${caseData.id}?tab=market_analysis`}
          className="text-xs font-medium text-violet-800 underline underline-offset-2 dark:text-violet-200"
        >
          주변 시세 전체
        </Link>
      </div>

      <div className="rounded-lg border border-violet-300/80 bg-white/90 px-4 py-3 dark:border-violet-800 dark:bg-neutral-950/80">
        <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">
          본 매각물건 자료
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] text-neutral-500">토지</p>
            <p className="text-sm font-semibold tabular-nums">
              {landSqm != null ? `${landSqm.toLocaleString("ko-KR")}㎡` : "미입력"}
            </p>
            <p className="text-[11px] text-neutral-500">
              {landPyeong != null ? `참고 약 ${landPyeong}평` : "기본정보에서 입력"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-500">건물·연면적</p>
            <p className="text-sm font-semibold tabular-nums">
              {buildingSqm != null
                ? `${buildingSqm.toLocaleString("ko-KR")}㎡`
                : "미입력"}
            </p>
            <p className="text-[11px] text-neutral-500">
              {buildingPyeong != null
                ? `참고 약 ${buildingPyeong}평`
                : "기본정보·임대세팅에서 입력"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-500">지번</p>
            <p className="text-sm font-medium tabular-nums">
              {caseJibun || "미입력"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-500">사용승인·연식</p>
            <p className="text-sm font-medium">{caseData.builtYear || "미입력"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["sale", "monthly", "jeonse"] as MarketTradeTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTradeTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tradeTab === tab
                ? "bg-violet-900 text-white dark:bg-violet-100 dark:text-violet-950"
                : "border border-violet-200 bg-white text-violet-900 dark:border-violet-800 dark:bg-neutral-950 dark:text-violet-100"
            }`}
          >
            {TRADE_LABEL[tab]}
          </button>
        ))}
      </div>

      {(tradeTab === "monthly" || tradeTab === "jeonse") && (
        <label className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span>표시 기간</span>
          <select
            className={SELECT}
            value={rentDisplayMonths}
            onChange={(e) => setRentDisplayMonths(Number(e.target.value))}
          >
            <option value={3}>최근 3개월</option>
            <option value={6}>최근 6개월</option>
            <option value={12}>최근 12개월</option>
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="text-neutral-500">기준 동</span>
          <select
            className={`${SELECT} mt-1 block min-w-[120px]`}
            value={targetDong}
            onChange={(e) => setTargetDong(e.target.value)}
          >
            {dongOptions.map((dong) => (
              <option key={dong} value={dong}>
                {dong}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-neutral-500">범위</span>
          <select
            className={`${SELECT} mt-1 block`}
            value={scope}
            onChange={(e) => setScope(e.target.value as MarketScope)}
          >
            {(Object.keys(SCOPE_LABEL) as MarketScope[]).map((key) => (
              <option key={key} value={key}>
                {SCOPE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-neutral-500">정렬</span>
          <select
            className={`${SELECT} mt-1 block`}
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as MarketSortMode)}
          >
            {(Object.keys(SORT_LABEL) as MarketSortMode[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {tradeTab === "sale" ? (
          <>
            <Metric
              label={`${TRADE_LABEL[tradeTab]} 평균`}
              value={formatManwon(stats.avgPrimary)}
              sub={`${scope === "same_dong" ? "이 동" : SCOPE_LABEL[scope]} ${stats.count}건`}
            />
            <Metric
              label="매매 중간값"
              value={formatManwon(stats.medianPrimary)}
            />
            <Metric
              label="추천 매매 3건 평균"
              value={formatManwon(saleAvgManwon)}
              sub="토지·건물·지번 유사"
            />
          </>
        ) : tradeTab === "monthly" ? (
          <>
            <Metric
              label="월세 평균"
              value={formatManwon(stats.avgPrimary)}
              sub={`${stats.count}건`}
            />
            <Metric
              label="월세 중간값"
              value={formatManwon(stats.medianPrimary)}
            />
            <Metric
              label="보증금 평균"
              value={formatManwon(stats.avgSecondary)}
            />
          </>
        ) : (
          <>
            <Metric
              label="전세 보증금 평균"
              value={formatManwon(stats.avgPrimary)}
              sub={`${stats.count}건`}
            />
            <Metric
              label="전세 중간값"
              value={formatManwon(stats.medianPrimary)}
            />
          </>
        )}
        <Metric
          label="지역 낙찰가율"
          value={
            analysis.nearbyAuctionSaleRatePct != null
              ? `${analysis.nearbyAuctionSaleRatePct}%`
              : "미입력"
          }
        />
        <Metric
          label="인근 사례 낙찰가율"
          value={saleCaseRate != null ? `${saleCaseRate}%` : "미입력"}
        />
        <Metric
          label="낙찰가−매매평균"
          value={formatWonWithUnit(
            analysis.saleCaseBidPrice != null && saleAvgWon != null
              ? analysis.saleCaseBidPrice - saleAvgWon
              : null,
          )}
          sub="경매 vs 일반매매"
        />
      </div>

      {tradeTab === "sale" && recommendedSales.length > 0 && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
            추천 비교 매매 {recommendedSales.length}건
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-900/80 dark:text-emerald-200/80">
            같은·인접 동, 토지·건물 면적, 지번·연식을 함께 본 상위 사례입니다.
          </p>
          <ul className="mt-2 space-y-2">
            {recommendedSales.map((row, idx) => {
              const jibun = buildJibunLabel(resolveListingJibun(row.item));
              return (
                <li
                  key={row.item.id}
                  className="rounded-md bg-white/80 px-2.5 py-2 text-xs dark:bg-black/25"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-emerald-950 dark:text-emerald-50">
                      {idx + 1}. {row.item.dong || "-"} {jibun || row.item.address}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatManwon(row.item.dealAmountManwon)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">
                    건물{" "}
                    {listingBuildingSqm(row.item) != null
                      ? `${listingBuildingSqm(row.item)}㎡`
                      : "-"}{" "}
                    · 토지{" "}
                    {listingLandSqm(row.item) != null
                      ? `${listingLandSqm(row.item)}㎡`
                      : "-"}{" "}
                    ·{" "}
                    <span className={areaDiffToneClass(row.landDiff.tone)}>
                      토지차 {row.landDiff.text}
                    </span>{" "}
                    ·{" "}
                    <span className={areaDiffToneClass(row.buildingDiff.tone)}>
                      건물차 {row.buildingDiff.text}
                    </span>{" "}
                    · {row.item.dealDate || "-"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                    {row.reasons.join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {adjacentHint ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>{targetDong}</strong>에 {TRADE_LABEL[tradeTab]} 실거래가 없습니다.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => setScope("adjacent")}
          >
            인접 동 포함
          </button>
          또는{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => setScope("all_gu")}
          >
            구 전체
          </button>
          로 범위를 넓혀 보세요.
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          선택한 조건에 맞는 {TRADE_LABEL[tradeTab]} 거래가 없습니다.
        </p>
      ) : (
        <div className="max-h-[min(420px,55vh)] overflow-auto rounded-lg border border-violet-100 bg-white dark:border-violet-900 dark:bg-neutral-950">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-2 py-2">동</th>
                <th className="px-2 py-2">지번</th>
                <th className="px-2 py-2 text-right">거래면적(건물)</th>
                {tradeTab === "sale" ? (
                  <>
                    <th className="px-2 py-2 text-right">토지면적</th>
                    <th className="px-2 py-2 text-right">토지차</th>
                    <th className="px-2 py-2 text-right">건물차</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-right">면적차</th>
                )}
                <th className="px-2 py-2 text-right">연식</th>
                {tradeTab === "sale" ? (
                  <th className="px-2 py-2 text-right">매매가</th>
                ) : (
                  <>
                    <th className="px-2 py-2 text-right">보증금</th>
                    <th className="px-2 py-2 text-right">월세</th>
                  </>
                )}
                <th className="px-2 py-2">거래일</th>
                <th className="px-2 py-2 text-right">지번차</th>
                <th className="px-2 py-2">유사도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const badges = saleComparableBadges(item, caseData, targetDong);
                const jibun = buildJibunLabel(resolveListingJibun(item));
                const isRecommended = recommendedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${
                      isRecommended
                        ? "bg-emerald-50/90 dark:bg-emerald-950/30"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">{item.dong || "-"}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">
                      {jibun || item.address || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {listingBuildingSqm(item) != null
                        ? `${listingBuildingSqm(item)}㎡`
                        : "-"}
                    </td>
                    {tradeTab === "sale" ? (
                      <>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {listingLandSqm(item) != null
                            ? `${listingLandSqm(item)}㎡`
                            : "-"}
                        </td>
                        <AreaDiffCell
                          display={formatLandAreaDiffSqm(item, caseData)}
                        />
                        <AreaDiffCell
                          display={formatBuildingAreaDiffSqm(item, caseData)}
                        />
                      </>
                    ) : (
                      <AreaDiffCell
                        display={formatAreaDiffSqm(
                          listingBuildingSqm(item),
                          caseBuildingSqm(caseData),
                        )}
                      />
                    )}
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {item.buildYear ?? "-"}
                    </td>
                    {tradeTab === "sale" ? (
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        {formatManwon(item.dealAmountManwon)}
                      </td>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatManwon(item.depositManwon)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatManwon(item.monthlyRentManwon)}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1.5">{item.dealDate || "-"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatJibunDiff(item, caseData)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {badges.map((badge) => (
                          <span
                            key={`${item.id}-${badge.label}`}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              badge.tone === "good"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                : badge.tone === "neutral"
                                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            }`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-neutral-500">
        목록은 최대 {LIST_DISPLAY_LIMIT}건이며, 화면에는 약 10행만 보이고 스크롤로
        나머지를 볼 수 있습니다. 거래면적은 건물(연)면적, 토지면적은 별도 표시하며
        차이는 ㎡ 기준입니다(사례가 본건보다 크면 파란색, 작으면 빨간색). 전체
        조회는 「주변 시세 전체」 탭을 이용하세요. 일반 실거래와
        경매 낙찰가는 다릅니다. 경매 낙찰가·낙찰가율은 아래
        매각사례에 입력하세요. 사례 기준 낙찰가{" "}
        {formatWonWithUnit(saleCaseBasedBid)} · 감정가 70%{" "}
        {formatWonWithUnit(expectedBid)}
      </p>
    </section>
  );
}

function areaDiffToneClass(tone: AreaDiffDisplay["tone"]): string {
  if (tone === "larger") {
    return "font-semibold text-sky-700 dark:text-sky-300";
  }
  if (tone === "smaller") {
    return "font-semibold text-rose-700 dark:text-rose-300";
  }
  return "text-neutral-600 dark:text-neutral-400";
}

function AreaDiffCell({ display }: { display: AreaDiffDisplay }) {
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums ${areaDiffToneClass(display.tone)}`}>
      {display.text}
    </td>
  );
}

/** @deprecated */
export const CaseNearbySaleComparables = CaseNearbyMarketComparables;
