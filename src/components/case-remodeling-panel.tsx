"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import type {
  AuctionCase,
  CaseRemodeling,
  RemodelingCatalogItem,
  RemodelingCostLine,
  RemodelingOccupancy,
  RemodelingPriceCatalog,
  RemodelingRoomProfile,
  RemodelingRoomUnitType,
  RemodelingScenarioTier,
  RemodelingWorkScope,
  UnitRemodelingAssignment,
} from "@/lib/types/domain";
import {
  SCENARIO_TIER_LABEL,
  WORK_SCOPE_LABEL,
  ROOM_UNIT_TYPE_LABEL,
  catalogItemsForScenario,
  costLineFromCatalogItem,
  createEmptyCatalogItem,
} from "@/lib/domain/remodeling-catalog";
import {
  breakdownFromLines,
  caseRemodelingAnalysis,
  syncCatalogToRemodeling,
} from "@/lib/domain/remodeling-analysis";
import {
  TABLE_COMPACT,
  TC_CHK,
  TC_INPUT,
  TC_MONEY,
  TC_TD,
  TC_TH,
  TC_UNIT,
} from "@/lib/ui/compact-table";
import {
  collectUnitLabelsFromCase,
  createEmptyCostLine,
  lineTotalManwon,
  mergeAssignmentsFromCase,
  normalizeCaseRemodeling,
} from "@/lib/domain/remodeling";
import { RemodelingReferencePanel } from "@/components/remodeling-reference-panel";
import {
  formatManwonWithSuffix,
  parseManwonInput,
} from "@/lib/format/manwon";
import { formatWonWithUnit } from "@/lib/format/won";

type Props = {
  caseData: AuctionCase;
  priceCatalog: RemodelingPriceCatalog;
  onSaveCatalog: (catalog: RemodelingPriceCatalog) => void;
  onSave: (remodeling: CaseRemodeling) => void;
  onApplyRepairCost?: (totalManwon: number) => void;
};

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";
const BTN_PRIMARY =
  "rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900";

const OCCUPANCY_LABEL: Record<RemodelingOccupancy, string> = {
  vacant: "공실",
  occupied: "거주",
  unknown: "미확인",
};

const SCENARIO_TONE: Record<RemodelingScenarioTier, string> = {
  minimal: "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30",
  balanced:
    "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
  full: "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30",
};

const formatManwon = formatManwonWithSuffix;

export function CaseRemodelingPanel({
  caseData,
  priceCatalog,
  onSaveCatalog,
  onSave,
  onApplyRepairCost,
}: Props) {
  const remodeling = normalizeCaseRemodeling(caseData.remodeling, priceCatalog);
  const analysis = useMemo(
    () => caseRemodelingAnalysis(remodeling, priceCatalog),
    [remodeling, priceCatalog],
  );
  const totalsAll = analysis.active.totals;
  const totalsApplied = analysis.active.totalsApplied;
  const totals =
    totalsApplied.unitCountApplied > 0 ? totalsApplied : totalsAll;
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [expandedProfileKey, setExpandedProfileKey] = useState<string | null>(
    "one_room",
  );

  const activeScenario =
    remodeling.scenarios.find((s) => s.tier === remodeling.activeScenarioTier) ??
    remodeling.scenarios[0]!;

  const persist = (next: CaseRemodeling) => {
    onSave({
      ...normalizeCaseRemodeling(next, priceCatalog),
      updatedAt: new Date().toISOString(),
    });
  };

  const updateScenario = (
    tier: RemodelingScenarioTier,
    patch: Partial<typeof activeScenario>,
  ) => {
    persist({
      ...remodeling,
      scenarios: remodeling.scenarios.map((s) =>
        s.tier === tier ? { ...s, ...patch } : s,
      ),
    });
  };

  const updateProfile = (
    tier: RemodelingScenarioTier,
    profileKey: string,
    patch: Partial<RemodelingRoomProfile>,
  ) => {
    persist({
      ...remodeling,
      scenarios: remodeling.scenarios.map((s) =>
        s.tier !== tier
          ? s
          : {
              ...s,
              roomProfiles: s.roomProfiles.map((p) =>
                p.profileKey === profileKey ? { ...p, ...patch } : p,
              ),
            },
      ),
    });
  };

  const updateAssignment = (
    unitKey: string,
    patch: Partial<UnitRemodelingAssignment>,
  ) => {
    persist({
      ...remodeling,
      unitAssignments: remodeling.unitAssignments.map((a) =>
        a.unitKey === unitKey ? { ...a, ...patch } : a,
      ),
    });
  };

  const syncFromCase = () => {
    const labels = collectUnitLabelsFromCase(caseData);
    if (labels.length === 0) {
      alert(
        "가져올 호실이 없습니다. 세입자 분석·임대세팅에 호실을 먼저 입력해 주세요.",
      );
      return;
    }
    const merged = mergeAssignmentsFromCase(remodeling, caseData);
    persist(merged);
  };

  const handleCatalogChange = (catalog: RemodelingPriceCatalog) => {
    const stamped = {
      ...catalog,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onSaveCatalog(stamped);
    persist(syncCatalogToRemodeling(remodeling, stamped));
  };

  const laborShare =
    totals.totalManwon > 0
      ? Math.round((totals.laborManwon / totals.totalManwon) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <RemodelingReferencePanel
        caseId={caseData.id}
        idealReference={remodeling.idealReference}
        priceCatalog={priceCatalog}
        onChange={(idealReference) =>
          persist({ ...remodeling, idealReference })
        }
      />

      <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">리모델링 시나리오 분석</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              룸 구성(원룸·1.5룸 등) × 시나리오(최소·균형·전면)로 건물 전체
              비용·인건비·월세 상승을 비교합니다. 단가는 아래 카탈로그가
              기준입니다.{" "}
              <Link href="/remodeling" className="underline underline-offset-2">
                전략 가이드
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN} onClick={syncFromCase}>
              호실 목록 가져오기
            </button>
            {onApplyRepairCost && totals.totalManwon > 0 && (
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => onApplyRepairCost(totals.totalManwon)}
              >
                수리비에 반영 ({formatManwon(totals.totalManwon)})
              </button>
            )}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="총 예상 비용" value={formatManwon(totals.totalManwon)} />
          <Stat
            label="자재 / 인건비"
            value={`${formatManwon(totals.materialManwon)} / ${formatManwon(totals.laborManwon)} (${laborShare}%)`}
          />
          <Stat
            label="월세 상승(합)"
            value={`+${formatManwon(totals.monthlyRentUpliftManwon)}/월`}
          />
          <Stat
            label="회수 기간"
            value={
              totals.paybackYears != null
                ? `약 ${totals.paybackYears}년`
                : "—"
            }
          />
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          호실 {totalsAll.unitCountApplied}개 적용 / 전체 {totalsAll.unitCountTotal}개
          {totalsApplied.unitCountApplied > 0 && " · 합계는 적용 호실만"}
          · DIY 시 절감 가능 인건비 {formatManwon(totals.diyLaborSavedManwon)}
          {onApplyRepairCost && (
            <>
              {" "}
              · 수리비 필드:{" "}
              {caseData.multiFamilyAnalysis.repairCost != null
                ? formatWonWithUnit(caseData.multiFamilyAnalysis.repairCost)
                : "미입력"}
            </>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">시나리오 비교</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {analysis.scenarios.map(({ plan, totals: st }) => {
            const active = plan.tier === remodeling.activeScenarioTier;
            return (
              <button
                key={plan.tier}
                type="button"
                className={`rounded-xl border p-4 text-left transition ${SCENARIO_TONE[plan.tier]} ${
                  active ? "ring-2 ring-neutral-900 dark:ring-neutral-100" : ""
                }`}
                onClick={() =>
                  persist({ ...remodeling, activeScenarioTier: plan.tier })
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {SCENARIO_TIER_LABEL[plan.tier]}
                  </span>
                  {active && (
                    <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900">
                      선택
                    </span>
                  )}
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {formatManwon(st.totalManwon)}
                </p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  자재 {formatManwon(st.materialManwon)} · 인건비{" "}
                  {formatManwon(st.laborManwon)} · 월세↑{" "}
                  {formatManwon(st.monthlyRentUpliftManwon)}
                </p>
                {st.paybackYears != null && (
                  <p className="mt-1 text-xs text-neutral-500">
                    회수 약 {st.paybackYears}년
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <RemodelingCatalogSection
        catalog={priceCatalog}
        open={catalogOpen}
        onToggle={() => setCatalogOpen((v) => !v)}
        onChange={handleCatalogChange}
      />

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {SCENARIO_TIER_LABEL[activeScenario.tier]} — 룸 구성별 패키지
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              카탈로그에 포함된 시나리오 항목은 기본 체크됩니다. 호실 수 ×
              1세대 비용으로 합산됩니다.
            </p>
          </div>
          <button
            type="button"
            className={BTN}
            onClick={() => {
              if (
                !confirm(
                  "선택 항목을 유지한 채 카탈로그 단가만 최신으로 맞출까요?",
                )
              ) {
                return;
              }
              persist(syncCatalogToRemodeling(remodeling, priceCatalog));
            }}
          >
            카탈로그 단가 동기화
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {activeScenario.roomProfiles.map((profile) => {
            const unitCount =
              analysis.active.totals.profileTotals.find(
                (p) => p.profileKey === profile.profileKey,
              )?.unitCount ?? 0;
            const perUnit = breakdownFromLines(profile.costLines);
            const expanded = expandedProfileKey === profile.profileKey;
            return (
              <article
                key={profile.profileKey}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <header className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    className="flex-1 text-left font-medium"
                    onClick={() =>
                      setExpandedProfileKey(
                        expanded ? null : profile.profileKey,
                      )
                    }
                  >
                    {profile.label}
                    <span className="ml-2 text-xs font-normal text-neutral-500">
                      {unitCount}호 × {formatManwon(perUnit.totalManwon)} ={" "}
                      {formatManwon(perUnit.totalManwon * unitCount)} · 인건비{" "}
                      {formatManwon(perUnit.laborManwon)}
                    </span>
                  </button>
                </header>
                {expanded && (
                  <div className="border-t border-neutral-100 px-4 py-4 dark:border-neutral-800">
                    <CostLinesEditor
                      title={`${profile.label} 1세대 기준`}
                      lines={profile.costLines}
                      catalog={priceCatalog}
                      scenarioTier={activeScenario.tier}
                      onChange={(costLines) =>
                        updateProfile(activeScenario.tier, profile.profileKey, {
                          costLines,
                        })
                      }
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">건물 공용</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          옥상·외벽·현관·CCTV 등 — 합계{" "}
          <strong>
            {formatManwon(
              breakdownFromLines(activeScenario.buildingCostLines).totalManwon,
            )}
          </strong>
        </p>
        <CostLinesEditor
          className="mt-4"
          title=""
          lines={activeScenario.buildingCostLines}
          catalog={priceCatalog}
          scenarioTier={activeScenario.tier}
          onChange={(buildingCostLines) =>
            updateScenario(activeScenario.tier, { buildingCostLines })
          }
        />
      </section>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">호실 적용 (나중 결정)</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          「적용」을 켠 호실만 합계에 반영합니다. 룸 유형은 임대세팅·수동으로
          맞춥니다.
        </p>
        {remodeling.unitAssignments.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            호실이 없습니다. 「호실 목록 가져오기」를 눌러 주세요.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className={TABLE_COMPACT}>
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] text-neutral-500 dark:border-neutral-700">
                  <th className={`${TC_TH} ${TC_CHK}`}>적용</th>
                  <th className={`${TC_TH} ${TC_UNIT}`}>호실</th>
                  <th className={`${TC_TH} w-20`}>룸 유형</th>
                  <th className={`${TC_TH} w-16`}>입주</th>
                  <th className={`${TC_TH} ${TC_CHK}`}>완료</th>
                  <th className={TC_TH}>메모</th>
                </tr>
              </thead>
              <tbody>
                {[...remodeling.unitAssignments]
                  .sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "ko"))
                  .map((row) => (
                    <tr
                      key={row.unitKey}
                      className="border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <td className={`${TC_TD} ${TC_CHK} align-top`}>
                        <input
                          type="checkbox"
                          checked={row.apply}
                          onChange={(e) =>
                            updateAssignment(row.unitKey, {
                              apply: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className={`${TC_TD} ${TC_UNIT} align-top font-medium`}>
                        {row.unitLabel}
                      </td>
                      <td className={`${TC_TD} w-20 align-top`}>
                        <select
                          className={`${TC_INPUT} dark:border-neutral-700`}
                          value={row.roomUnitType}
                          onChange={(e) =>
                            updateAssignment(row.unitKey, {
                              roomUnitType: e.target.value as RemodelingRoomUnitType,
                            })
                          }
                        >
                          {(
                            Object.keys(ROOM_UNIT_TYPE_LABEL) as RemodelingRoomUnitType[]
                          ).map((key) => (
                            <option key={key} value={key}>
                              {ROOM_UNIT_TYPE_LABEL[key]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`${TC_TD} w-16 align-top`}>
                        <select
                          className={`${TC_INPUT} dark:border-neutral-700`}
                          value={row.occupancy}
                          onChange={(e) =>
                            updateAssignment(row.unitKey, {
                              occupancy: e.target.value as RemodelingOccupancy,
                            })
                          }
                        >
                          {(
                            Object.keys(OCCUPANCY_LABEL) as RemodelingOccupancy[]
                          ).map((key) => (
                            <option key={key} value={key}>
                              {OCCUPANCY_LABEL[key]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`${TC_TD} ${TC_CHK} align-top`}>
                        <input
                          type="checkbox"
                          checked={row.completed}
                          onChange={(e) =>
                            updateAssignment(row.unitKey, {
                              completed: e.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className={`${TC_TD} align-top`}>
                        <input
                          className={`${TC_INPUT} dark:border-neutral-700`}
                          value={row.memo}
                          onChange={(e) =>
                            updateAssignment(row.unitKey, { memo: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <label className="block text-sm">
        <span className="text-neutral-500">물건 리모델링 메모</span>
        <AutoGrowTextarea
          className={INPUT}
          value={remodeling.memo}
          onChange={(e) => persist({ ...remodeling, memo: e.target.value })}
          rows={3}
          placeholder="공사 순서, 업체, 임차인 협의 사항 등"
        />
      </label>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 dark:bg-neutral-950">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CostLinesEditor({
  title,
  lines,
  catalog,
  scenarioTier,
  onChange,
  className = "",
}: {
  title: string;
  lines: RemodelingCostLine[];
  catalog: RemodelingPriceCatalog;
  scenarioTier?: RemodelingScenarioTier;
  onChange: (lines: RemodelingCostLine[]) => void;
  className?: string;
}) {
  const updateLine = (id: string, patch: Partial<RemodelingCostLine>) => {
    onChange(
      lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  };

  const catalogPicklist = scenarioTier
    ? catalogItemsForScenario(catalog, scenarioTier)
    : catalog.items;

  const addFromCatalog = (key: string) => {
    const item = catalog.items.find((i) => i.key === key);
    if (!item) return;
    if (lines.some((l) => l.catalogKey === key)) {
      updateLine(
        lines.find((l) => l.catalogKey === key)!.id,
        { selected: true },
      );
      return;
    }
    onChange([...lines, costLineFromCatalogItem(item, true)]);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? <h3 className="text-sm font-medium">{title}</h3> : <span />}
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            defaultValue=""
            onChange={(e) => {
              const key = e.target.value;
              if (key) addFromCatalog(key);
              e.target.value = "";
            }}
          >
            <option value="">+ 카탈로그에서 추가</option>
            {catalogPicklist.map((item) => (
              <option key={item.key} value={item.key}>
                [{item.category}] {item.item}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={BTN}
            onClick={() => onChange([...lines, createEmptyCostLine()])}
          >
            + 빈 항목
          </button>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className={TABLE_COMPACT}>
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-700">
              <th className={`${TC_TH} ${TC_CHK}`}>선택</th>
              <th className={`${TC_TH} w-28`}>항목</th>
              <th className={`${TC_TH} w-16`}>범위</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>자재(만)</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>인건비(만)</th>
              <th className={`${TC_TH} ${TC_CHK}`}>DIY</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>월세↑(만)</th>
              <th className={`${TC_TH} w-24`}>효과·메모</th>
              <th className={`${TC_TH} ${TC_MONEY} text-right`}>소계</th>
              <th className={`${TC_TH} w-8`} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-neutral-100 dark:border-neutral-800"
              >
                <td className={`${TC_TD} ${TC_CHK} align-top`}>
                  <input
                    type="checkbox"
                    checked={line.selected}
                    onChange={(e) =>
                      updateLine(line.id, { selected: e.target.checked })
                    }
                  />
                </td>
                <td className={`${TC_TD} w-28 align-top`}>
                  <input
                    className={`${TC_INPUT} font-medium dark:border-neutral-700`}
                    value={line.item}
                    onChange={(e) =>
                      updateLine(line.id, { item: e.target.value })
                    }
                  />
                  {line.catalogKey && (
                    <span className="mt-0.5 block text-[10px] text-neutral-400">
                      카탈로그 연동
                    </span>
                  )}
                </td>
                <td className={`${TC_TD} w-16 align-top`}>
                  <select
                    className={`${TC_INPUT} dark:border-neutral-700`}
                    value={line.workScope ?? ""}
                    onChange={(e) =>
                      updateLine(line.id, {
                        workScope: (e.target.value || null) as RemodelingWorkScope | null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {(Object.keys(WORK_SCOPE_LABEL) as RemodelingWorkScope[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {WORK_SCOPE_LABEL[k]}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    inputMode="decimal"
                    className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                    value={line.materialManwon ?? ""}
                    onChange={(e) =>
                      updateLine(line.id, {
                        materialManwon: parseManwonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    inputMode="decimal"
                    className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                    value={line.laborManwon ?? ""}
                    disabled={line.diy}
                    onChange={(e) =>
                      updateLine(line.id, {
                        laborManwon: parseManwonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_CHK} align-top`}>
                  <input
                    type="checkbox"
                    checked={line.diy}
                    onChange={(e) =>
                      updateLine(line.id, { diy: e.target.checked })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    inputMode="decimal"
                    className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                    value={line.rentUpliftManwon ?? ""}
                    onChange={(e) =>
                      updateLine(line.id, {
                        rentUpliftManwon: parseManwonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} w-24 align-top`}>
                  <input
                    className={`${TC_INPUT} dark:border-neutral-700`}
                    value={line.effectNote}
                    onChange={(e) =>
                      updateLine(line.id, { effectNote: e.target.value })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_MONEY} text-right tabular-nums align-top`}>
                  {line.selected ? formatManwon(lineTotalManwon(line)) : "—"}
                </td>
                <td className={`${TC_TD} w-8 align-top`}>
                  <button
                    type="button"
                    className="text-rose-600 hover:underline"
                    onClick={() =>
                      onChange(lines.filter((row) => row.id !== line.id))
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          항목이 없습니다. 카탈로그에서 추가하거나 빈 항목을 만드세요.
        </p>
      )}
    </div>
  );
}

function RemodelingCatalogSection({
  catalog,
  open,
  onToggle,
  onChange,
}: {
  catalog: RemodelingPriceCatalog;
  open: boolean;
  onToggle: () => void;
  onChange: (catalog: RemodelingPriceCatalog) => void;
}) {
  const categories = useMemo(() => {
    const set = new Set(catalog.items.map((i) => i.category));
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [catalog.items]);

  const updateItem = (key: string, patch: Partial<RemodelingCatalogItem>) => {
    onChange({
      ...catalog,
      items: catalog.items.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    });
  };

  const toggleScenarioTier = (
    item: RemodelingCatalogItem,
    tier: RemodelingScenarioTier,
  ) => {
    const tiers = item.scenarioTiers.includes(tier)
      ? item.scenarioTiers.filter((t) => t !== tier)
      : [...item.scenarioTiers, tier];
    updateItem(item.key, {
      scenarioTiers: tiers.length > 0 ? tiers : ["minimal"],
    });
  };

  const removeItem = (key: string) => {
    if (!confirm("이 항목을 단가 목록에서 삭제할까요?")) return;
    onChange({
      ...catalog,
      items: catalog.items.filter((item) => item.key !== key),
    });
  };

  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <div>
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            글로벌 단가·항목 카탈로그 ({catalog.regionLabel})
          </h2>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            {catalog.items.length}개 공종 · 자재·인건비·시나리오 포함 여부 ·
            수정 시 호실 패키지에 동기화 가능
          </p>
        </div>
        <span className="text-xs text-amber-800 dark:text-amber-200">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>
      {open && (
        <div className="border-t border-amber-200/60 px-4 pb-4 dark:border-amber-900/40">
          <label className="mt-3 block text-xs">
            <span className="text-neutral-600 dark:text-neutral-400">조사 메모</span>
            <AutoGrowTextarea
              className={INPUT}
              value={catalog.sourceNote}
              onChange={(e) =>
                onChange({ ...catalog, sourceNote: e.target.value })
              }
              rows={2}
            />
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() =>
                onChange({
                  ...catalog,
                  items: [...catalog.items, createEmptyCatalogItem()],
                })
              }
            >
              + 항목 추가
            </button>
          </div>
          <div className="mt-3 max-h-[min(480px,50vh)] overflow-auto">
            <table className={TABLE_COMPACT}>
              <thead className="sticky top-0 bg-amber-50 dark:bg-amber-950">
                <tr className="border-b border-amber-200/60 text-neutral-600 dark:border-amber-900">
                  <th className={`${TC_TH} w-20`}>분류</th>
                  <th className={`${TC_TH} w-28`}>항목명</th>
                  <th className={`${TC_TH} w-20`}>시나리오</th>
                  <th className={`${TC_TH} w-16`}>범위</th>
                  <th className={`${TC_TH} ${TC_MONEY}`}>자재</th>
                  <th className={`${TC_TH} ${TC_MONEY}`}>인건비</th>
                  <th className={`${TC_TH} ${TC_CHK}`}>DIY</th>
                  <th className={`${TC_TH} ${TC_MONEY}`}>월세↑</th>
                  <th className={`${TC_TH} w-8`} />
                </tr>
              </thead>
              <tbody>
                {catalog.items.map((item) => (
                  <tr
                    key={item.key}
                    className="border-b border-amber-100/80 dark:border-amber-900/30"
                  >
                    <td className={`${TC_TD} w-20 align-top`}>
                      <input
                        list="remodel-categories"
                        className={`${TC_INPUT} dark:border-neutral-700`}
                        value={item.category}
                        onChange={(e) =>
                          updateItem(item.key, { category: e.target.value })
                        }
                      />
                    </td>
                    <td className={`${TC_TD} w-28 align-top`}>
                      <input
                        className={`${TC_INPUT} dark:border-neutral-700`}
                        value={item.item}
                        onChange={(e) =>
                          updateItem(item.key, { item: e.target.value })
                        }
                      />
                    </td>
                    <td className={`${TC_TD} w-20 align-top`}>
                      <div className="flex flex-col gap-0.5">
                        {(
                          ["minimal", "balanced", "full"] as RemodelingScenarioTier[]
                        ).map((tier) => (
                          <label
                            key={tier}
                            className="flex items-center gap-1 whitespace-nowrap"
                          >
                            <input
                              type="checkbox"
                              checked={item.scenarioTiers.includes(tier)}
                              onChange={() => toggleScenarioTier(item, tier)}
                            />
                            <span className="text-[10px]">
                              {SCENARIO_TIER_LABEL[tier].split(" ")[0]}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className={`${TC_TD} w-16 align-top`}>
                      <select
                        className={`${TC_INPUT} dark:border-neutral-700`}
                        value={item.workScope}
                        onChange={(e) =>
                          updateItem(item.key, {
                            workScope: e.target.value as RemodelingWorkScope,
                          })
                        }
                      >
                        {(Object.keys(WORK_SCOPE_LABEL) as RemodelingWorkScope[]).map(
                          (k) => (
                            <option key={k} value={k}>
                              {WORK_SCOPE_LABEL[k]}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                        value={item.materialManwon}
                        onChange={(e) =>
                          updateItem(item.key, {
                            materialManwon: parseManwonInput(e.target.value) ?? 0,
                          })
                        }
                      />
                    </td>
                    <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                        value={item.laborManwon}
                        onChange={(e) =>
                          updateItem(item.key, {
                            laborManwon: parseManwonInput(e.target.value) ?? 0,
                          })
                        }
                      />
                    </td>
                    <td className={`${TC_TD} ${TC_CHK} align-top text-center`}>
                      <input
                        type="checkbox"
                        checked={item.diy}
                        onChange={(e) =>
                          updateItem(item.key, { diy: e.target.checked })
                        }
                      />
                    </td>
                    <td className={`${TC_TD} ${TC_MONEY} align-top`}>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        className={`${TC_INPUT} tabular-nums dark:border-neutral-700`}
                        value={item.rentUpliftManwon.oneRoom}
                        title="원룸 월세 상승(만원)"
                        onChange={(e) =>
                          updateItem(item.key, {
                            rentUpliftManwon: {
                              ...item.rentUpliftManwon,
                              oneRoom: parseManwonInput(e.target.value) ?? 0,
                            },
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5 align-top">
                      <button
                        type="button"
                        className="text-rose-600"
                        onClick={() => removeItem(item.key)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="remodel-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
      )}
    </section>
  );
}

