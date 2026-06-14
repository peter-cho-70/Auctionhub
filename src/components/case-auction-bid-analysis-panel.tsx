"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { AuctionComparablePdfImport } from "@/components/auction-comparable-pdf-import";
import {
  AuctionBidMap,
  type AuctionBidMapMarker,
} from "@/components/auction-bid-map";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { coordsFromJusoEnt } from "@/lib/map/coords-from-meta";
import {
  computeAuctionBidRecommendation,
  createAuctionSaleComparable,
  emptyAuctionBidAnalysis,
  formatRoomShapeSummary,
  MAX_AUCTION_SALE_COMPARABLES,
  approvalYear,
  parseAuctionComparablePaste,
  parseUseApprovalDate,
  resolveCaseAnchor,
  scoreAuctionComparable,
  sortAuctionSaleComparablesForDisplay,
  subjectUseApprovalDate,
  type ComparableSortDir,
  type ComparableSortKey,
} from "@/lib/domain/auction-bid-analysis";
import type {
  AuctionBidAnalysis,
  AuctionCase,
  AuctionSaleComparable,
  AuctionSaleSellerType,
} from "@/lib/types/domain";
import { formatWonWithUnit } from "@/lib/format/won";
import { TABLE_COMPACT, TC_TD, TC_TH } from "@/lib/ui/compact-table";
import { useAppStore } from "@/store/app-store";

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const TABLE_INPUT =
  "w-full min-w-0 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
const SELECT = INPUT + " mt-0";

const STEPS = [
  { n: 1 as const, label: "사례 입력" },
  { n: 2 as const, label: "위치·반경" },
  { n: 3 as const, label: "연식·유형" },
  { n: 4 as const, label: "3축 비교" },
  { n: 5 as const, label: "입찰가 제안" },
];

const EMPTY_COMPARABLES: AuctionSaleComparable[] = [];

const SELLER_LABEL: Record<AuctionSaleSellerType, string> = {
  private: "일반",
  lh: "LH",
  sh: "SH",
  trust: "신탁",
  unknown: "-",
};

type Props = {
  caseId: string;
  caseData: AuctionCase;
  onUpdateCase: (
    patch: Partial<
      Pick<AuctionCase, "auctionSaleComparables" | "auctionBidAnalysis">
    >,
  ) => void;
};

export function CaseAuctionBidAnalysisPanel({
  caseId,
  caseData,
  onUpdateCase,
}: Props) {
  const shared = useAppStore((s) => s.data.sharedAuctionSaleComparables ?? []);
  const setShared = useAppStore((s) => s.setSharedAuctionSaleComparables);
  const storeCaseSlice = useAppStore(
    useShallow((s) => {
      const found = s.data.cases.find((x) => x.id === caseId);
      return {
        comparables: found?.auctionSaleComparables ?? [],
        analysis: found?.auctionBidAnalysis,
        found: Boolean(found),
      };
    }),
  );

  const comparables =
    storeCaseSlice.comparables.length > 0
      ? storeCaseSlice.comparables
      : EMPTY_COMPARABLES;

  const analysis =
    storeCaseSlice.analysis ??
    caseData.auctionBidAnalysis ??
    emptyAuctionBidAnalysis();

  const step = analysis.wizardStep;

  const [pasteText, setPasteText] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);

  const anchor = useMemo(() => resolveCaseAnchor(caseData), [caseData]);

  const subjectCoords = useMemo(() => {
    const fromMeta = coordsFromJusoEnt(
      caseData.addressMeta?.entX,
      caseData.addressMeta?.entY,
    );
    if (fromMeta) return fromMeta;
    const m = caseData.nearbyMarketAnalysis;
    if (m?.lat != null && m?.lng != null) {
      return { lat: m.lat, lng: m.lng };
    }
    return null;
  }, [caseData.addressMeta, caseData.nearbyMarketAnalysis]);

  const scored = useMemo(() => {
    return [...comparables, ...shared].map((item) =>
      scoreAuctionComparable(caseData, item, anchor),
    );
  }, [caseData, comparables, shared, anchor]);

  const mapMarkers = useMemo((): AuctionBidMapMarker[] => {
    const out: AuctionBidMapMarker[] = [];
    if (anchor.lat != null && anchor.lng != null) {
      out.push({
        id: "__anchor__",
        lat: anchor.lat,
        lng: anchor.lng,
        title: "비교 기준점",
        kind: "anchor",
      });
    }
    if (subjectCoords) {
      const farFromAnchor =
        anchor.lat == null ||
        anchor.lng == null ||
        Math.abs(subjectCoords.lat - anchor.lat) > 1e-5 ||
        Math.abs(subjectCoords.lng - anchor.lng) > 1e-5;
      if (farFromAnchor) {
        out.push({
          id: "__subject__",
          lat: subjectCoords.lat,
          lng: subjectCoords.lng,
          title: caseData.address || "이 물건",
          kind: "subject",
        });
      }
    }
    for (const s of scored) {
      const { lat, lng } = s.item;
      if (lat == null || lng == null) continue;
      out.push({
        id: s.item.id,
        lat,
        lng,
        title:
          s.item.address ||
          s.item.caseNumber ||
          `사례 ${s.item.bidRatePct ?? ""}%`,
        kind: "comparable",
        tier: s.tier,
      });
    }
    return out;
  }, [anchor, subjectCoords, scored, caseData.address]);

  const result = useMemo(
    () => computeAuctionBidRecommendation(caseData, comparables, shared),
    [caseData, comparables, shared],
  );

  const patchAnalysis = useCallback(
    (patch: Partial<AuctionBidAnalysis>) => {
      onUpdateCase({
        auctionBidAnalysis: {
          ...emptyAuctionBidAnalysis(),
          ...caseData.auctionBidAnalysis,
          ...patch,
        },
      });
      setSavedAt(Date.now());
    },
    [caseData.auctionBidAnalysis, onUpdateCase],
  );

  const handlePickAnchor = useCallback(
    (lat: number, lng: number) => {
      patchAnalysis({
        anchor: {
          ...analysis.anchor,
          lat,
          lng,
          source: "map_pick",
        },
      });
    },
    [analysis.anchor, patchAnalysis],
  );

  const saveComparables = useCallback(
    (items: AuctionSaleComparable[]) => {
      const next = items.slice(0, MAX_AUCTION_SALE_COMPARABLES);
      onUpdateCase({ auctionSaleComparables: next });
      setSavedAt(Date.now());
    },
    [onUpdateCase],
  );

  const updateComparable = useCallback(
    (id: string, patch: Partial<AuctionSaleComparable>) => {
      saveComparables(
        comparables.map((e) =>
          e.id === id
            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
            : e,
        ),
      );
    },
    [comparables, saveComparables],
  );

  const geocodeAll = async () => {
    setGeocodeBusy(true);
    try {
      const next = [...comparables];
      for (let i = 0; i < next.length; i += 1) {
        const item = next[i]!;
        if (item.lat != null && item.lng != null) continue;
        if (!item.address.trim()) continue;
        const res = await fetch(
          `/api/address/geocode?address=${encodeURIComponent(item.address)}`,
        );
        const data = (await res.json()) as {
          ok?: boolean;
          lat?: number;
          lng?: number;
        };
        if (data.ok && data.lat != null && data.lng != null) {
          next[i] = { ...item, lat: data.lat, lng: data.lng };
        }
      }
      saveComparables(next);
    } finally {
      setGeocodeBusy(false);
    }
  };

  const applyPaste = () => {
    const parsed = parseAuctionComparablePaste(pasteText);
    if (parsed.length === 0) return;
    saveComparables([...comparables, ...parsed].slice(0, MAX_AUCTION_SALE_COMPARABLES));
    setPasteText("");
  };

  const runAnalysis = () => {
    const r = computeAuctionBidRecommendation(caseData, comparables, shared);
    patchAnalysis({ lastResult: r, wizardStep: 5 });
  };

  const applyToMultiFamily = () => {
    const r = result;
    if (r.suggestedBidRatePct == null) return;
    useAppStore.getState().updateCase(caseData.id, {
      auctionBidAnalysis: { ...analysis, lastResult: r, wizardStep: 5 },
      multiFamilyAnalysis: {
        ...caseData.multiFamilyAnalysis,
        saleCaseBidRatePct: r.suggestedBidRatePct,
        saleCaseBidPrice: r.suggestedBidWon,
        nearbyAuctionSaleRatePct: r.auctionMedianBidRatePct,
      },
    });
    setSavedAt(Date.now());
  };

  const subjectApproval =
    analysis.useApprovalDate ??
    subjectUseApprovalDate(caseData) ??
    parseUseApprovalDate(caseData.builtYear);

  return (
    <div className="space-y-6">
      {savedAt != null && Date.now() - savedAt < 4000 && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">저장됨</p>
      )}

      {!storeCaseSlice.found && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          이 물건(ID: {caseId})을 데이터에서 찾을 수 없습니다. 목록으로 돌아가 다시
          열어 주세요.
        </p>
      )}

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
          입찰가 통합 분석
        </h3>
        <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
          인근 <strong>경매 매각</strong> 사례(이 물건 최대 {MAX_AUCTION_SALE_COMPARABLES}
          건)를 지도 거리·
          <strong>사용승인일</strong>·주차·유형으로 맞춘 뒤,{" "}
          <strong>실거래·공시지가</strong>와 교차해 입찰가 구간을 제안합니다.
        </p>
        {!caseData.nearbyMarketAnalysis && (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            실거래 비교를 위해{" "}
            <Link
              href={`/cases/${caseData.id}?tab=market_analysis`}
              className="underline"
            >
              주변 시세 조회
            </Link>
            를 먼저 해 두면 좋습니다.
          </p>
        )}
      </section>

      <AuctionComparablePdfImport
        caseId={caseId}
        defaultDong={caseData.addressMeta?.emdNm ?? ""}
        onImported={() => patchAnalysis({ wizardStep: 1 })}
      />

      {comparables.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
            등록된 매각 사례 {comparables.length}건
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
            {comparables.slice(0, 5).map((row) => (
              <li key={row.id}>
                {row.address || row.caseNumber || "주소 없음"}
                {row.bidRatePct != null ? ` · ${row.bidRatePct}%` : ""}
              </li>
            ))}
            {comparables.length > 5 && (
              <li>외 {comparables.length - 5}건 — 1단계 표에서 전체 확인</li>
            )}
          </ul>
        </div>
      )}

      <nav className="flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
              step === s.n
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
            }`}
            onClick={() => patchAnalysis({ wizardStep: s.n })}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </nav>

      {step === 1 && (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h4 className="text-sm font-medium">
            1. 경매 매각 사례 (이 물건, 최대 {MAX_AUCTION_SALE_COMPARABLES}건)
          </h4>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN}
              disabled={comparables.length >= MAX_AUCTION_SALE_COMPARABLES}
              onClick={() =>
                saveComparables([
                  ...comparables,
                  createAuctionSaleComparable({
                    dong: caseData.addressMeta?.emdNm ?? "",
                    isMultifamily: true,
                    roomShapeSummary: formatRoomShapeSummary(
                      caseData.roomShapeMix,
                    ),
                    parkingCount: caseData.parkingUnitCount,
                    landAreaSqm: caseData.landAreaSqm,
                    buildingAreaSqm: caseData.buildingAreaSqm,
                  }),
                ])
              }
            >
              + 행 추가
            </button>
            <button
              type="button"
              className={BTN}
              disabled={geocodeBusy || comparables.length === 0}
              onClick={() => void geocodeAll()}
            >
              {geocodeBusy ? "좌표 조회 중…" : "주소→좌표 일괄"}
            </button>
          </div>
          <label className="block text-xs text-neutral-500">
            붙여넣기 (주소·가율·날짜 혼합)
            <AutoGrowTextarea
              className={INPUT}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="한 줄에 한 사례"
            />
          </label>
          <button type="button" className={BTN} onClick={applyPaste}>
            붙여넣기 반영
          </button>

          <ComparableTable
            caseId={caseId}
            items={comparables}
            scored={scored.filter((s) =>
              comparables.some((c) => c.id === s.item.id),
            )}
            onUpdate={updateComparable}
            onDelete={(id) =>
              saveComparables(comparables.filter((e) => e.id !== id))
            }
            onToggleShared={(entry) => {
              if (
                !confirm("공통 사례로 옮기면 모든 물건 분석에 포함됩니다.")
              ) {
                return;
              }
              saveComparables(comparables.filter((e) => e.id !== entry.id));
              setShared([...shared, entry]);
            }}
            showSharedAction
          />

          <h4 className="pt-4 text-sm font-medium text-neutral-600">
            공통 사례 ({shared.length}건)
          </h4>
          <ComparableTable
            caseId={caseId}
            items={shared}
            scored={scored.filter((s) => shared.some((c) => c.id === s.item.id))}
            onUpdate={(id, patch) => {
              setShared(
                shared.map((e) =>
                  e.id === id
                    ? { ...e, ...patch, updatedAt: new Date().toISOString() }
                    : e,
                ),
              );
              setSavedAt(Date.now());
            }}
            onDelete={(id) => {
              if (!confirm("모든 물건에서 삭제됩니다.")) return;
              setShared(shared.filter((e) => e.id !== id));
              setSavedAt(Date.now());
            }}
          />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h4 className="text-sm font-medium">2. 비교 기준점·반경</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-neutral-500">
              위도
              <input
                className={INPUT}
                value={analysis.anchor.lat ?? ""}
                onChange={(e) =>
                  patchAnalysis({
                    anchor: {
                      ...analysis.anchor,
                      lat: parseFloat(e.target.value) || null,
                      source: "map_pick",
                    },
                  })
                }
              />
            </label>
            <label className="text-xs text-neutral-500">
              경도
              <input
                className={INPUT}
                value={analysis.anchor.lng ?? ""}
                onChange={(e) =>
                  patchAnalysis({
                    anchor: {
                      ...analysis.anchor,
                      lng: parseFloat(e.target.value) || null,
                      source: "map_pick",
                    },
                  })
                }
              />
            </label>
            <label className="text-xs text-neutral-500">
              반경 (m)
              <select
                className={SELECT}
                value={analysis.anchor.radiusM}
                onChange={(e) =>
                  patchAnalysis({
                    anchor: {
                      ...analysis.anchor,
                      radiusM: parseInt(e.target.value, 10),
                    },
                  })
                }
              >
                {[500, 1000, 1500, 2000].map((m) => (
                  <option key={m} value={m}>
                    {m}m
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  const a = resolveCaseAnchor(caseData);
                  patchAnalysis({ anchor: a });
                }}
              >
                주소/시세 좌표로
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            기준점:{" "}
            {anchor.lat != null && anchor.lng != null
              ? `${anchor.lat.toFixed(5)}, ${anchor.lng.toFixed(5)} (${analysis.anchor.source})`
              : "좌표 없음 — 주소 검색 또는 사례 지오코딩 필요"}
          </p>

          <AuctionBidMap
            address={caseData.address}
            centerLat={anchor.lat}
            centerLng={anchor.lng}
            radiusM={anchor.radiusM}
            markers={mapMarkers}
            pickAnchorEnabled
            onPickAnchor={handlePickAnchor}
          />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h4 className="text-sm font-medium">3. 내 물건·사례 연식</h4>
          <label className="block text-xs text-neutral-500">
            사용승인일 (이 물건)
            <input
              type="date"
              className={INPUT}
              value={subjectApproval?.slice(0, 10) ?? ""}
              onChange={(e) =>
                patchAnalysis({
                  useApprovalDate: parseUseApprovalDate(e.target.value),
                })
              }
            />
          </label>
          <label className="block text-xs text-neutral-500">
            연식 보정 (%p / 년, 다가구)
            <input
              type="number"
              step="0.1"
              min={0}
              max={3}
              className={INPUT}
              value={analysis.ageAdjustPctPerYear}
              onChange={(e) =>
                patchAnalysis({
                  ageAdjustPctPerYear: parseFloat(e.target.value) || 0.5,
                })
              }
            />
          </label>
          <ul className="space-y-2 text-sm">
            {scored
              .filter((s) => comparables.some((c) => c.id === s.item.id))
              .map((s) => (
                <li
                  key={s.item.id}
                  className={`rounded-lg border px-3 py-2 ${
                    s.tier === "core"
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900"
                      : s.tier === "excluded"
                        ? "border-neutral-200 opacity-60 dark:border-neutral-800"
                        : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <span className="font-medium">{s.item.address || "주소 없음"}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    점수 {s.similarityScore} · {s.tier} · {s.reasons.join(", ")}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h4 className="text-sm font-medium">4. 경매·실거래·공시지가</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="경매 (연식보정)"
              value={
                result.auctionAdjustedBidRatePct != null
                  ? `${result.auctionAdjustedBidRatePct}%`
                  : "-"
              }
              sub={`중앙 ${result.auctionMedianBidRatePct ?? "-"}% · ${result.peerCount}건`}
            />
            <Metric
              label="실거래 (반경 내)"
              value={formatWonWithUnit(result.marketSaleWon)}
              sub={
                result.marketImpliedBidRatePct != null
                  ? `감정가 대비 ${result.marketImpliedBidRatePct}%`
                  : "주변 시세 조회 필요"
              }
            />
            <Metric
              label="공시지가"
              value={formatWonWithUnit(result.landFloorWon)}
              sub={
                result.landFloorBidRatePct != null
                  ? `감정가 대비 ${result.landFloorBidRatePct}% · 임대세팅`
                  : "임대세팅에 입력"
              }
            />
          </div>
          <AuctionBidMap
            address={caseData.address}
            centerLat={anchor.lat}
            centerLng={anchor.lng}
            radiusM={anchor.radiusM}
            markers={mapMarkers}
          />
          <button type="button" className={BTN} onClick={runAnalysis}>
            분석 실행 → 5단계
          </button>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h4 className="text-sm font-medium">5. 입찰가 제안</h4>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {result.narrative}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="제안 입찰가"
              value={formatWonWithUnit(result.suggestedBidWon)}
              sub={
                result.suggestedBidRatePct != null
                  ? `감정가의 ${result.suggestedBidRatePct}%`
                  : undefined
              }
            />
            <Metric
              label="보수 ~ 공격"
              value={`${formatWonWithUnit(result.rangeLowWon)} ~ ${formatWonWithUnit(result.rangeHighWon)}`}
            />
            <Metric
              label="감정가 70%"
              value={formatWonWithUnit(caseData.expectedBidPrice)}
            />
            <Metric
              label="감정가"
              value={formatWonWithUnit(caseData.appraisalPrice)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN} onClick={applyToMultiFamily}>
              다가구 「매각사례」에 반영
            </button>
            <Link
              href={`/cases/${caseData.id}?tab=multi_family`}
              className={`${BTN} inline-block`}
            >
              다가구 분석 탭
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

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

const SORT_LABELS: Record<ComparableSortKey, string> = {
  distance: "거리",
  bidRate: "낙찰가율",
  year: "연식",
  price: "가격",
  area: "면적",
};

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: ComparableSortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 font-medium hover:text-neutral-900 dark:hover:text-neutral-100 ${
        active ? "text-sky-800 dark:text-sky-200" : "text-neutral-600 dark:text-neutral-400"
      }`}
    >
      {label}
      {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function ComparableSourceModal({
  caseId,
  row,
  onClose,
}: {
  caseId: string;
  row: AuctionSaleComparable;
  onClose: () => void;
}) {
  const url = row.sourceUrl.trim();
  const isHttp = /^https?:\/\//i.test(url);
  const fileLabel = url.startsWith("pdf-import:")
    ? url.slice("pdf-import:".length)
    : url || row.caseNumber || "사례";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparable-source-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            <h3
              id="comparable-source-title"
              className="text-sm font-semibold"
            >
              원본 · {fileLabel}
            </h3>
            {row.caseNumber ? (
              <p className="mt-0.5 text-xs text-neutral-500">{row.caseNumber}</p>
            ) : null}
          </div>
          <button type="button" className={BTN} onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="overflow-auto px-4 py-3 text-sm">
          {isHttp ? (
            <p className="mb-3">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-700 underline dark:text-sky-300"
              >
                원본 링크 열기
              </a>
            </p>
          ) : null}
          {row.sourceExtractedText?.trim() ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed dark:bg-neutral-900">
              {row.sourceExtractedText}
            </pre>
          ) : row.memo.trim() ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
              {row.memo}
            </pre>
          ) : (
            <p className="text-neutral-500">
              저장된 PDF 원문이 없습니다. PDF로 다시 등록하면 원문이 함께 저장됩니다.
              {row.address ? (
                <>
                  {" "}
                  또는{" "}
                  <Link
                    href={`/cases/${caseId}?tab=source_docs`}
                    className="underline"
                    onClick={onClose}
                  >
                    원문/PDF 탭
                  </Link>
                  에서 이 물건 출처 문서를 확인하세요.
                </>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparableTable({
  caseId,
  items,
  scored,
  onUpdate,
  onDelete,
  onToggleShared,
  showSharedAction,
}: {
  caseId: string;
  items: AuctionSaleComparable[];
  scored: ReturnType<typeof scoreAuctionComparable>[];
  onUpdate: (id: string, patch: Partial<AuctionSaleComparable>) => void;
  onDelete: (id: string) => void;
  onToggleShared?: (entry: AuctionSaleComparable) => void;
  showSharedAction?: boolean;
}) {
  const [sortKey, setSortKey] = useState<ComparableSortKey>("distance");
  const [sortDir, setSortDir] = useState<ComparableSortDir>("asc");
  const [previewRow, setPreviewRow] = useState<AuctionSaleComparable | null>(
    null,
  );

  if (items.length === 0) {
    return <p className="text-xs text-neutral-500">사례 없음</p>;
  }

  const scoreMap = new Map(scored.map((s) => [s.item.id, s]));

  const toggleSort = (key: ComparableSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const displayItems = sortAuctionSaleComparablesForDisplay(
    items,
    scored,
    sortKey,
    sortDir,
  );

  const sortableTh = (
    key: ComparableSortKey,
    label: string,
    width = "",
  ) => (
    <th className={`${TC_TH} ${width}`.trim()}>
      <SortHeader
        label={label}
        active={sortKey === key}
        dir={sortDir}
        onClick={() => toggleSort(key)}
      />
    </th>
  );

  return (
    <>
      {previewRow ? (
        <ComparableSourceModal
          caseId={caseId}
          row={previewRow}
          onClose={() => setPreviewRow(null)}
        />
      ) : null}
      <p className="mb-2 text-[11px] text-neutral-500">
        열 제목을 눌러 정렬합니다 (현재: {SORT_LABELS[sortKey]}{" "}
        {sortDir === "asc" ? "오름차순" : "내림차순"})
      </p>
      <div className="overflow-x-auto">
        <table className={TABLE_COMPACT}>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className={TC_TH}>주소</th>
              {sortableTh("price", "낙찰가", "w-[5.5rem]")}
              {sortableTh("bidRate", "가율%", "w-14")}
              {sortableTh("year", "연식", "w-24")}
              {sortableTh("area", "면적㎡", "w-16")}
              <th className={`${TC_TH} w-10`}>주차</th>
              <th className={`${TC_TH} w-10`}>회차</th>
              <th className={`${TC_TH} w-14`}>유형</th>
              {sortableTh("distance", "거리", "w-14")}
              <th className={`${TC_TH} w-24`}>작업</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map((row) => {
              const sc = scoreMap.get(row.id);
              const year = approvalYear(row.useApprovalDate);
              return (
                <tr
                  key={row.id}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className={TC_TD}>
                    <input
                      className={TABLE_INPUT}
                      value={row.address}
                      onChange={(e) =>
                        onUpdate(row.id, { address: e.target.value })
                      }
                    />
                  </td>
                  <td className={`${TC_TD} w-[5.5rem]`}>
                    <input
                      className={TABLE_INPUT}
                      inputMode="numeric"
                      value={row.winningBidPrice ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        onUpdate(row.id, {
                          winningBidPrice:
                            v === "" ? null : parseInt(v, 10) || null,
                        });
                      }}
                      title="낙찰가(원)"
                    />
                  </td>
                  <td className={`${TC_TD} w-14`}>
                    <input
                      className={TABLE_INPUT}
                      value={row.bidRatePct ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        onUpdate(row.id, {
                          bidRatePct: v === "" ? null : parseFloat(v),
                        });
                      }}
                    />
                  </td>
                  <td className={`${TC_TD} w-24`}>
                    <input
                      type="date"
                      className={TABLE_INPUT}
                      value={row.useApprovalDate?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          useApprovalDate: parseUseApprovalDate(e.target.value),
                        })
                      }
                    />
                    {year != null ? (
                      <span className="mt-0.5 block text-[10px] text-neutral-400">
                        {year}년
                      </span>
                    ) : null}
                  </td>
                  <td className={`${TC_TD} w-16`}>
                    <input
                      className={TABLE_INPUT}
                      value={row.buildingAreaSqm ?? ""}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          buildingAreaSqm:
                            e.target.value === ""
                              ? null
                              : parseFloat(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className={`${TC_TD} w-10`}>
                    <input
                      className={TABLE_INPUT}
                      value={row.parkingCount ?? ""}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          parkingCount:
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </td>
                  <td className={`${TC_TD} w-10`}>
                    <input
                      className={TABLE_INPUT}
                      value={row.soldRound ?? ""}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          soldRound:
                            e.target.value === ""
                              ? null
                              : parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </td>
                  <td className={`${TC_TD} w-14`}>
                    <label className="flex items-center gap-1 text-[10px]">
                      <input
                        type="checkbox"
                        checked={row.isOngoing}
                        onChange={(e) =>
                          onUpdate(row.id, { isOngoing: e.target.checked })
                        }
                      />
                      진행중
                    </label>
                    {row.isOngoing ? (
                      <div className="mt-1 flex gap-1">
                        <input
                          className={`${TABLE_INPUT} w-10`}
                          placeholder="입찰"
                          title="입찰자 수"
                          value={row.bidderCount ?? ""}
                          onChange={(e) =>
                            onUpdate(row.id, {
                              bidderCount:
                                e.target.value === ""
                                  ? null
                                  : parseInt(e.target.value, 10),
                            })
                          }
                        />
                        <input
                          className={`${TABLE_INPUT} w-10`}
                          placeholder="유찰"
                          title="유찰 회차"
                          value={row.failedRoundCount ?? ""}
                          onChange={(e) =>
                            onUpdate(row.id, {
                              failedRoundCount:
                                e.target.value === ""
                                  ? null
                                  : parseInt(e.target.value, 10),
                            })
                          }
                        />
                      </div>
                    ) : null}
                    <label className="mt-1 flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={row.isMultifamily}
                        onChange={(e) =>
                          onUpdate(row.id, { isMultifamily: e.target.checked })
                        }
                      />
                      다가구
                    </label>
                    <select
                      className={`${SELECT} mt-1`}
                      value={row.sellerType}
                      onChange={(e) =>
                        onUpdate(row.id, {
                          sellerType: e.target.value as AuctionSaleSellerType,
                        })
                      }
                    >
                      {(
                        Object.keys(SELLER_LABEL) as AuctionSaleSellerType[]
                      ).map((k) => (
                        <option key={k} value={k}>
                          {SELLER_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${TC_TD} w-14 text-neutral-500 tabular-nums whitespace-nowrap`}>
                    {sc?.distanceM != null ? `${sc.distanceM}m` : "-"}
                    <span className="ml-1 text-[10px]">{sc?.tier}</span>
                  </td>
                  <td className={`${TC_TD} w-24`}>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={BTN}
                        title="PDF 추출 원문·링크·메모"
                        onClick={() => setPreviewRow(row)}
                      >
                        원본
                      </button>
                      {showSharedAction && onToggleShared ? (
                        <button
                          type="button"
                          className={BTN}
                          onClick={() => onToggleShared(row)}
                        >
                          공통
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-2 py-1 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                        onClick={() => onDelete(row.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
