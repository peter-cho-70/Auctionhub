"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AuctionCase, RentInvestmentYield, RentSetting, RentSettingUnitRow } from "@/lib/types/domain";
import {
  buildRentUnitRowsFromTenants,
  countTenantRentPrefillSources,
  hasMeaningfulRentUnitRows,
  remodelingPlannedFromCase,
} from "@/lib/domain/rent-setting-from-tenants";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";
import {
  computeInvestmentYieldDerived,
  computeRentSettingDerived,
  emptyRentSetting,
  newRentUnitRow,
  PYEONG_TO_SQM,
} from "@/lib/domain/rent-setting";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";
import {
  filterPercentInputRaw,
  formatRatioAsPercentInput,
  parsePercentInputToRatio,
} from "@/lib/format/percent-input";
import {
  FMT_HINT,
  FMT_INPUT,
  FMT_INPUT_CORE,
  FMT_LABEL,
  FMT_READONLY,
  FMT_SECTION,
} from "@/lib/ui/case-form-density";
import { TC_INPUT_CELL } from "@/lib/ui/compact-table";

const RENT_UNIT_TABLE =
  "w-full table-fixed border-collapse text-left text-sm";
const RENT_TH =
  "px-2 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400";
const RENT_TD = "px-1 py-1 align-top";
/** 고정 7글자(호실) · 8글자(방크기·룸구성) · 가운데 정렬 */
const RENT_W_7CH = "w-full max-w-[7ch] text-center";
const RENT_W_8CH = "w-full max-w-[8ch] text-center";
const RENT_CELL_CHAR_CENTER = "w-0 whitespace-nowrap p-0 text-center";
/** 보증금 1억(100,000,000) · 월세 100만(1,000,000) 표시 너비 */
const RENT_W_DEPOSIT = "w-full max-w-[11ch] text-center tabular-nums";
const RENT_W_MONTHLY = "w-full max-w-[9ch] text-center tabular-nums";
const RENT_CELL_MONEY_CENTER = "w-0 whitespace-nowrap p-0 text-center";
/** 남는 가로 공간 */
const RENT_CELL_MEMO_GROW = "w-auto";
const RENT_CELL_COMPACT = "w-0 whitespace-nowrap";

type Props = {
  caseData: AuctionCase;
  /** 후반부 임대 패키지 — 호실 표만 편집 */
  leasingFocus?: boolean;
  /** 문자·도구 탭과 동일 보조값 — 낙찰가 입력 시 낙찰가 대비 감정가 % 표시 */
  templateExtras?: Record<string, string>;
  onSave: (rentSetting: RentSetting) => void;
};

const ROOM_TYPE_OPTIONS = [
  "",
  "원룸",
  "분리형 원룸",
  "1.5룸",
  "투룸",
  "정투룸",
  "미니쓰리룸",
  "쓰리룸",
  "주인세대",
  "상가",
  "점포",
] as const;

function rentRowHasContent(row: RentSettingUnitRow): boolean {
  return !!(
    row.unitNo.trim() ||
    row.tenantName.trim() ||
    row.roomType.trim() ||
    row.deposit != null ||
    row.monthlyRent != null ||
    row.areaSqm != null ||
    row.note.trim() ||
    row.remodelingPlanned != null
  );
}

function visibleRentRows(
  rows: RentSettingUnitRow[],
  leasingFocus: boolean,
): RentSettingUnitRow[] {
  if (!leasingFocus) return rows;
  const filled = rows.filter(rentRowHasContent);
  if (filled.length === 0) return rows.slice(0, 4);
  const trailing = rows.filter((row) => !rentRowHasContent(row));
  return [...filled, ...trailing.slice(0, 2)];
}

const COUNT_LABELS: { key: keyof RentSetting["unitCounts"]; label: string }[] = [
  { key: "commercial", label: "상가" },
  { key: "oneRoom", label: "원룸" },
  { key: "oneHalfRoom", label: "1.5룸" },
  { key: "twoRoom", label: "투룸" },
  { key: "threeRoom", label: "쓰리룸" },
  { key: "ownerUnit", label: "주인세대" },
];


function moneyStr(n: number | null | undefined): string {
  if (n == null) return "";
  return formatWonDigits(Math.round(n));
}

function setUnitRow(
  rows: RentSettingUnitRow[],
  id: string,
  patch: Partial<RentSettingUnitRow>,
): RentSettingUnitRow[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

type PctKey = "leaseAnnual" | "invAcq" | "invLtv" | "invLoan";

function pctFieldValue(
  draft: Partial<Record<PctKey, string>>,
  key: PctKey,
  ratio: number | null,
): string {
  const raw = draft[key];
  if (raw !== undefined) return raw;
  return formatRatioAsPercentInput(ratio);
}

export function CaseRentSettingPanel({
  caseData,
  leasingFocus = false,
  templateExtras,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<RentSetting | null>(null);
  const [pctDraft, setPctDraft] = useState<Partial<Record<PctKey, string>>>(
    {},
  );
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [areaDraft, setAreaDraft] = useState<Record<string, string>>({});
  const [moneyDraft, setMoneyDraft] = useState<Record<string, string>>({});
  const autoPrefilledRef = useRef(false);

  const rs = draft ?? caseData.rentSetting ?? emptyRentSetting();
  const tenantSourceCount = useMemo(
    () => countTenantRentPrefillSources(caseData),
    [caseData],
  );
  const derived = useMemo(() => computeRentSettingDerived(rs), [rs]);
  const iv = rs.investmentYield;
  const appraisalEffective =
    iv.appraisalAmount ?? caseData.appraisalPrice ?? null;
  const ivForDerived = useMemo(
    () => ({
      ...iv,
      appraisalAmount: appraisalEffective,
      totalDeposit: derived.totalDeposit,
      totalMonthlyRent: derived.totalMonthlyRent,
    }),
    [
      iv,
      appraisalEffective,
      derived.totalDeposit,
      derived.totalMonthlyRent,
    ],
  );
  const ivDerived = useMemo(
    () => computeInvestmentYieldDerived(ivForDerived),
    [ivForDerived],
  );
  const bidVsAppraisalPct = useMemo(() => {
    const bid = iv.bidAmount;
    if (bid == null || bid <= 0) return null;
    const appr = appraisalEffective;
    if (appr == null || appr <= 0) return null;
    return (bid / appr) * 100;
  }, [iv.bidAmount, appraisalEffective]);

  const winningBidAmount = useMemo(() => {
    const raw = templateExtras?.["낙찰가"]?.trim();
    if (raw) {
      const n = parseWonInput(raw);
      if (n != null && n > 0) return n;
    }
    const d = caseData.decision.actualBidPrice;
    return d != null && d > 0 ? d : null;
  }, [templateExtras, caseData.decision.actualBidPrice]);

  const winVsAppraisalPct = useMemo(() => {
    if (winningBidAmount == null) return null;
    const appr = appraisalEffective;
    if (appr == null || appr <= 0) return null;
    return (winningBidAmount / appr) * 100;
  }, [winningBidAmount, appraisalEffective]);

  useEffect(() => {
    if (autoPrefilledRef.current || tenantSourceCount === 0) return;
    if (hasMeaningfulRentUnitRows(caseData.rentSetting?.unitRows)) return;
    autoPrefilledRef.current = true;
    const unitRows = buildRentUnitRowsFromTenants(
      caseData,
      rs.unitRows,
      "fillEmpty",
    );
    setDraft({ ...rs, unitRows });
    setPrefillMessage(
      `임차인 ${tenantSourceCount}호실 기준으로 보증금·월세를 사전 입력했습니다. 계약연장·퇴거는 세입자 탭의 계약 전망을 확인하세요.`,
    );
  }, [caseData, rs, tenantSourceCount]);

  const applyFromTenants = (replaceMatched: boolean) => {
    if (tenantSourceCount === 0) {
      setPrefillMessage("반영할 임차인 정보가 없습니다. 세입자·명세서를 먼저 등록하세요.");
      return;
    }
    if (
      replaceMatched &&
      hasMeaningfulRentUnitRows(rs.unitRows) &&
      !confirm(
        "호실이 일치하는 행의 보증금·월세를 임차인 정보로 덮어씁니다. 계속할까요?",
      )
    ) {
      return;
    }
    const unitRows = buildRentUnitRowsFromTenants(
      caseData,
      rs.unitRows,
      replaceMatched ? "replaceMatched" : "fillEmpty",
    );
    setDraft({ ...rs, unitRows });
    setPrefillMessage(
      replaceMatched
        ? `임차인 ${tenantSourceCount}호실 정보로 일치 행을 갱신했습니다.`
        : `임차인 ${tenantSourceCount}호실 정보로 빈 칸을 채웠습니다.`,
    );
  };

  const update = (patch: Partial<RentSetting>) => {
    setDraft({ ...rs, ...patch });
  };

  const updateIv = (patch: Partial<RentInvestmentYield>) => {
    setDraft({
      ...rs,
      investmentYield: { ...rs.investmentYield, ...patch },
    });
  };

  const save = () => {
    const d = computeRentSettingDerived(rs);
    onSave({
      ...rs,
      investmentYield: {
        ...rs.investmentYield,
        totalDeposit: d.totalDeposit,
        totalMonthlyRent: d.totalMonthlyRent,
      },
    });
    setDraft(null);
    setPctDraft({});
    setMoneyDraft({});
    setAreaDraft({});
  };

  const displayRows = visibleRentRows(rs.unitRows, leasingFocus);

  const removeUnitRow = (rowId: string) => {
    if (rs.unitRows.length <= 1) return;
    update({ unitRows: rs.unitRows.filter((row) => row.id !== rowId) });
  };

  const moneyFieldValue = (
    rowId: string,
    field: "deposit" | "monthlyRent",
    amount: number | null,
  ): string => {
    const key = `${rowId}-${field}`;
    if (moneyDraft[key] !== undefined) return moneyDraft[key]!;
    return moneyStr(amount);
  };

  const onMoneyFieldChange = (
    rowId: string,
    field: "deposit" | "monthlyRent",
    raw: string,
  ) => {
    const key = `${rowId}-${field}`;
    setMoneyDraft((prev) => ({ ...prev, [key]: raw }));
    const parsed = parseWonInput(raw);
    update({
      unitRows: setUnitRow(rs.unitRows, rowId, {
        [field]: raw.trim() === "" ? null : parsed,
      }),
    });
  };

  return (
    <section className={`${FMT_SECTION} bg-white dark:bg-neutral-950`}>
      {!leasingFocus && (
        <p className={`${FMT_HINT} text-neutral-600 dark:text-neutral-400`}>
          호별 임차인·임대료를 먼저 입력하면 합계 보증금·월세가 아래 요약·수익률에
          반영됩니다.{" "}
          <span className="text-neutral-500">
            실투자금 = 매도가 − 융자 − 합계 보증금 · 월순익 = 합계 월세 − 월이자
          </span>
        </p>
      )}

      <div
        className={`rounded-lg border-2 p-2.5 ${
          leasingFocus
            ? "border-violet-300/70 bg-violet-50/25 dark:border-violet-800/50 dark:bg-violet-950/15"
            : "border-amber-300/70 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3
              className={`text-sm font-semibold ${
                leasingFocus
                  ? "text-violet-950 dark:text-violet-100"
                  : "text-amber-950 dark:text-amber-100"
              }`}
            >
              {leasingFocus ? "호별 임대 계획" : "호별 임차인·임대료"}
            </h3>
            <p className={FMT_HINT}>
              {leasingFocus
                ? "임차인명은 세입자 탭에서 계약이 「계약연장」일 때만 자동 반영됩니다. 각 칸을 직접 수정한 뒤 저장하세요."
                : (
                  <>
                    {caseData.householdCount != null
                      ? `총가구수 ${caseData.householdCount}세대와 순번을 맞춰 보세요. `
                      : "물건 기본에 총가구수를 입력하면 대조에 도움이 됩니다. "}
                    임차인 반영 시 호실·방크기·룸형식·보증금·월세가 채워지고, 임차인명은 세입자 탭 계약이 「계약연장」일 때만 넣습니다.
                  </>
                )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyFromTenants(false)}
              disabled={tenantSourceCount === 0}
              className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 disabled:opacity-40 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
            >
              임차인 정보 반영
            </button>
            <button
              type="button"
              onClick={() => applyFromTenants(true)}
              disabled={tenantSourceCount === 0}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
            >
              일치 호실 덮어쓰기
            </button>
            <button
              type="button"
              onClick={() =>
                update({ unitRows: [...rs.unitRows, newRentUnitRow()] })
              }
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
            >
              행 추가
            </button>
            {!leasingFocus && (
              <button
                type="button"
                onClick={() => {
                  if (rs.unitRows.length <= 1) return;
                  update({ unitRows: rs.unitRows.slice(0, -1) });
                }}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600"
              >
                마지막 행 삭제
              </button>
            )}
            {leasingFocus && (
              <button
                type="button"
                onClick={save}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                저장
              </button>
            )}
          </div>
        </div>
        {prefillMessage && (
          <p className="mt-1.5 text-[10px] text-sky-800 dark:text-sky-200">
            {prefillMessage}
          </p>
        )}
        {!leasingFocus && (
          <p className={`mt-1 ${FMT_HINT}`}>
            거주·계약연장은 명세서 금액, 퇴거·신규임대는 공란 — 세입자 탭 「계약
            전망」으로 조정
          </p>
        )}
        {leasingFocus && (
          <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            <div className="flex gap-1.5">
              <dt className="text-neutral-500">합계 보증금</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(derived.totalDeposit)}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-neutral-500">합계 월세</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(derived.totalMonthlyRent)}
              </dd>
            </div>
          </dl>
        )}
        <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className={RENT_UNIT_TABLE}>
            <colgroup>
              <col className="w-[7ch]" />
              <col className="w-[5.5rem]" />
              <col className="w-[8ch]" />
              <col className="w-[8ch]" />
              <col className="w-[11ch]" />
              <col className="w-[9ch]" />
              <col className="w-[3.25rem]" />
              <col />
              {leasingFocus && <col className="w-[2rem]" />}
            </colgroup>
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className={`${RENT_TH} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                  호실
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_COMPACT} border border-neutral-200 dark:border-neutral-800`}>
                  임차인
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                  방크기
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                  룸구성
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_MONEY_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                  보증금
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_MONEY_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                  월세
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_COMPACT} text-center border border-neutral-200 dark:border-neutral-800`}>
                  리모델링
                </th>
                <th className={`${RENT_TH} ${RENT_CELL_MEMO_GROW} border border-neutral-200 dark:border-neutral-800`}>
                  기타 메모
                </th>
                {leasingFocus && (
                  <th className={`${RENT_TH} ${RENT_CELL_COMPACT} text-center border border-neutral-200 dark:border-neutral-800`}>
                    삭제
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const remodelingFromPanel = remodelingPlannedFromCase(
                  caseData,
                  row.floor,
                  row.unitNo,
                );
                const remodelingValue =
                  row.remodelingPlanned ?? remodelingFromPanel;
                return (
                <tr key={row.id}>
                  <td className={`${RENT_TD} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                    <input
                      className={`${TC_INPUT_CELL} ${RENT_W_7CH} px-0.5`}
                      maxLength={7}
                      value={row.unitNo}
                      placeholder={row.floor || "호"}
                      title={row.floor ? `층: ${row.floor}` : undefined}
                      onChange={(e) =>
                        update({
                          unitRows: setUnitRow(rs.unitRows, row.id, {
                            unitNo: e.target.value,
                          }),
                        })
                      }
                    />
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_COMPACT} border border-neutral-200 p-0 dark:border-neutral-800`}>
                    <input
                      className={`${TC_INPUT_CELL} w-full min-w-0`}
                      value={row.tenantName}
                      placeholder="계약연장 시만 자동"
                      onChange={(e) =>
                        update({
                          unitRows: setUnitRow(rs.unitRows, row.id, {
                            tenantName: e.target.value,
                          }),
                        })
                      }
                    />
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                    <input
                      inputMode="decimal"
                      className={`${TC_INPUT_CELL} ${RENT_W_8CH} px-0.5 tabular-nums`}
                      maxLength={8}
                      value={
                        areaDraft[row.id] ??
                        (row.areaSqm != null ? String(row.areaSqm) : "")
                      }
                      onChange={(e) => {
                        const t = filterAreaSqmInputRaw(e.target.value);
                        setAreaDraft((prev) => ({ ...prev, [row.id]: t }));
                        const areaSqm = parseAreaSqmInputToNumber(t);
                        const areaPyeong =
                          areaSqm != null
                            ? Math.round((areaSqm / PYEONG_TO_SQM) * 10) / 10
                            : null;
                        update({
                          unitRows: setUnitRow(rs.unitRows, row.id, {
                            areaSqm: t === "" ? null : areaSqm,
                            areaPyeong: t === "" ? null : areaPyeong,
                          }),
                        });
                      }}
                      onBlur={() =>
                        setAreaDraft((prev) => {
                          const next = { ...prev };
                          delete next[row.id];
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_CHAR_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                    {leasingFocus ? (
                      <select
                        className={`${RENT_W_8CH} truncate bg-transparent px-0.5 py-1 text-sm outline-none`}
                        value={row.roomType}
                        title={row.roomType}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              roomType: e.target.value,
                            }),
                          })
                        }
                      >
                        {ROOM_TYPE_OPTIONS.map((option) => (
                          <option key={option || "empty"} value={option}>
                            {option || "—"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={`${TC_INPUT_CELL} ${RENT_W_8CH} truncate px-0.5`}
                        value={row.roomType}
                        title={row.roomType}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              roomType: e.target.value,
                            }),
                          })
                        }
                      />
                    )}
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_MONEY_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                    <input
                      inputMode="numeric"
                      className={`${TC_INPUT_CELL} ${RENT_W_DEPOSIT} px-0.5`}
                      value={moneyFieldValue(row.id, "deposit", row.deposit)}
                      onChange={(e) =>
                        onMoneyFieldChange(row.id, "deposit", e.target.value)
                      }
                      onBlur={() =>
                        setMoneyDraft((prev) => {
                          const next = { ...prev };
                          delete next[`${row.id}-deposit`];
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_MONEY_CENTER} border border-neutral-200 dark:border-neutral-800`}>
                    <input
                      inputMode="numeric"
                      className={`${TC_INPUT_CELL} ${RENT_W_MONTHLY} px-0.5`}
                      value={moneyFieldValue(row.id, "monthlyRent", row.monthlyRent)}
                      onChange={(e) =>
                        onMoneyFieldChange(row.id, "monthlyRent", e.target.value)
                      }
                      onBlur={() =>
                        setMoneyDraft((prev) => {
                          const next = { ...prev };
                          delete next[`${row.id}-monthlyRent`];
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_COMPACT} border border-neutral-200 text-center dark:border-neutral-800`}>
                    <select
                      className="w-full min-w-0 bg-transparent px-1 py-1 text-sm outline-none"
                      value={
                        remodelingValue === true
                          ? "yes"
                          : remodelingValue === false
                            ? "no"
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        update({
                          unitRows: setUnitRow(rs.unitRows, row.id, {
                            remodelingPlanned:
                              v === "yes" ? true : v === "no" ? false : null,
                          }),
                        });
                      }}
                      title={
                        remodelingFromPanel != null && row.remodelingPlanned == null
                          ? "리모델링 탭 설정 반영"
                          : undefined
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">예</option>
                      <option value="no">아니오</option>
                    </select>
                  </td>
                  <td className={`${RENT_TD} ${RENT_CELL_MEMO_GROW} border border-neutral-200 p-0 dark:border-neutral-800`}>
                    <input
                      className={`${TC_INPUT_CELL} w-full min-w-0`}
                      value={row.note}
                      placeholder="기타 메모"
                      onChange={(e) =>
                        update({
                          unitRows: setUnitRow(rs.unitRows, row.id, {
                            note: e.target.value,
                          }),
                        })
                      }
                    />
                  </td>
                  {leasingFocus && (
                    <td className={`${RENT_TD} ${RENT_CELL_COMPACT} border border-neutral-200 text-center dark:border-neutral-800`}>
                      <button
                        type="button"
                        className="text-xs text-rose-600 disabled:opacity-30"
                        disabled={rs.unitRows.length <= 1}
                        onClick={() => removeUnitRow(row.id)}
                        title="행 삭제"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {leasingFocus && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              임대 계획 저장
            </button>
          </div>
        )}
      </div>

      {!leasingFocus && (
      <>
      <div className="rounded-xl border-2 border-neutral-300 bg-neutral-100/90 p-2.5 dark:border-neutral-600 dark:bg-neutral-900/65">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
            요약
          </p>
          <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            자동 계산
          </span>
        </div>
        <dl className="mt-1.5 grid gap-1.5 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className={FMT_HINT}>합계 보증금</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(derived.totalDeposit)}
            </dd>
          </div>
          <div>
            <dt className={FMT_HINT}>합계 월세</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(derived.totalMonthlyRent)}
            </dd>
          </div>
          <div>
            <dt className={FMT_HINT}>실투자금</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.equity))}
            </dd>
          </div>
          <div>
            <dt className={FMT_HINT}>월이자</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.monthlyInterest))}
            </dd>
          </div>
          <div>
            <dt className={FMT_HINT}>월순익</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.monthlyNet))}
            </dd>
          </div>
          <div>
            <dt className={FMT_HINT}>연 수익률</dt>
            <dd className="font-medium tabular-nums">
              {derived.yieldAnnualPct != null
                ? `${derived.yieldAnnualPct.toFixed(2)}%`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border-2 border-amber-300/70 bg-amber-50/35 p-2.5 dark:border-amber-800/55 dark:bg-amber-950/20">
        <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
          핵심 입력 · 매도가 · 융자 · 연이율
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <label className={FMT_LABEL}>
            매도가 (원)
          </label>
          <input
            inputMode="numeric"
            className={FMT_INPUT_CORE}
            value={moneyStr(rs.salePrice)}
            onChange={(e) =>
              update({ salePrice: parseWonInput(e.target.value) })
            }
          />
        </div>
        <div>
          <label className={FMT_LABEL}>
            융자 금액 (원)
          </label>
          <input
            inputMode="numeric"
            className={FMT_INPUT_CORE}
            value={moneyStr(rs.loanAmount)}
            onChange={(e) =>
              update({ loanAmount: parseWonInput(e.target.value) })
            }
          />
        </div>
        <div>
          <label className={FMT_LABEL}>
            연이율 (%)
          </label>
          <input
            inputMode="decimal"
            className={FMT_INPUT_CORE}
            value={pctFieldValue(pctDraft, "leaseAnnual", rs.annualRate)}
            onChange={(e) => {
              const t = filterPercentInputRaw(e.target.value);
              setPctDraft((p) => ({ ...p, leaseAnnual: t }));
              if (t === "") {
                update({ annualRate: null });
                return;
              }
              const r = parsePercentInputToRatio(t);
              if (r === "incomplete") return;
              update({ annualRate: r });
            }}
            onBlur={() =>
              setPctDraft((p) => {
                const n = { ...p };
                delete n.leaseAnnual;
                return n;
              })
            }
            placeholder="예: 4.1"
          />
        </div>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div>
          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            투자 대비 수익률 (원 단위)
          </h3>
          <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            상단 호실 합계가 총보증금·총월세에 반영됩니다. 순투자수익률 =
            (총월세−대출월이자)×12÷순투자×100
          </p>
        </div>

        <div className="rounded-lg border-2 border-amber-300/60 bg-amber-50/30 p-2.5 dark:border-amber-800/50 dark:bg-amber-950/25">
          <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
            직접 입력
          </p>
          <p className="text-[10px] text-amber-900/75 dark:text-amber-200/75">
            입찰·명도·세율·대출·시세차익
          </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={FMT_LABEL}>
              입찰금액 (원)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                inputMode="numeric"
                className={`${FMT_INPUT_CORE} flex-1`}
                value={moneyStr(iv.bidAmount)}
                onChange={(e) =>
                  updateIv({ bidAmount: parseWonInput(e.target.value) })
                }
              />
              {bidVsAppraisalPct != null && (
                <span className="text-[10px] tabular-nums text-neutral-600 dark:text-neutral-400">
                  감정 {bidVsAppraisalPct.toFixed(2)}%
                </span>
              )}
            </div>
            {winVsAppraisalPct != null && (
              <p className="mt-1 text-[10px] tabular-nums text-neutral-600 dark:text-neutral-400">
                낙찰가 감정가 대비 {winVsAppraisalPct.toFixed(2)}%
                <span className="text-neutral-500">
                  {" "}
                  (도구 탭 낙찰가 또는 판단 기록 실제 입찰가)
                </span>
              </p>
            )}
          </div>
          <div>
            <label className={FMT_LABEL}>
              명도비용 (원)
            </label>
            <input
              inputMode="numeric"
              className={FMT_INPUT_CORE}
              value={moneyStr(iv.evictionCost)}
              onChange={(e) =>
                updateIv({ evictionCost: parseWonInput(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={FMT_LABEL}>
              취득세율 (%)
            </label>
            <input
              inputMode="decimal"
              className={FMT_INPUT_CORE}
              value={pctFieldValue(
                pctDraft,
                "invAcq",
                iv.acquisitionTaxRate,
              )}
              onChange={(e) => {
                const t = filterPercentInputRaw(e.target.value);
                setPctDraft((p) => ({ ...p, invAcq: t }));
                if (t === "") {
                  updateIv({ acquisitionTaxRate: null });
                  return;
                }
                const r = parsePercentInputToRatio(t);
                if (r === "incomplete") return;
                updateIv({ acquisitionTaxRate: r });
              }}
              onBlur={() =>
                setPctDraft((p) => {
                  const n = { ...p };
                  delete n.invAcq;
                  return n;
                })
              }
              placeholder="4.5"
            />
          </div>
          <div>
            <label className={FMT_LABEL}>
              감정가 (원)
            </label>
            <input
              inputMode="numeric"
              className={FMT_INPUT_CORE}
              value={moneyStr(iv.appraisalAmount)}
              onChange={(e) =>
                updateIv({ appraisalAmount: parseWonInput(e.target.value) })
              }
            />
            <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
              비워 두면 물건 기본 탭 감정가를 투자 계산에 반영합니다.
              {iv.appraisalAmount == null &&
                caseData.appraisalPrice != null && (
                  <>
                    {" "}
                    현재 반영:{" "}
                    {formatWonWithUnit(caseData.appraisalPrice)}
                  </>
                )}
            </p>
          </div>
          <div>
            <label className={FMT_LABEL}>
              대출 담보 비율 (%)
            </label>
            <input
              inputMode="decimal"
              className={FMT_INPUT_CORE}
              value={pctFieldValue(
                pctDraft,
                "invLtv",
                iv.loanToValueRatio,
              )}
              onChange={(e) => {
                const t = filterPercentInputRaw(e.target.value);
                setPctDraft((p) => ({ ...p, invLtv: t }));
                if (t === "") {
                  updateIv({ loanToValueRatio: null });
                  return;
                }
                const r = parsePercentInputToRatio(t);
                if (r === "incomplete") return;
                updateIv({ loanToValueRatio: r });
              }}
              onBlur={() =>
                setPctDraft((p) => {
                  const n = { ...p };
                  delete n.invLtv;
                  return n;
                })
              }
              placeholder="67"
            />
          </div>
          <div>
            <label className={FMT_LABEL}>
              대출 연이율 (%)
            </label>
            <input
              inputMode="decimal"
              className={FMT_INPUT_CORE}
              value={pctFieldValue(
                pctDraft,
                "invLoan",
                iv.loanAnnualRate,
              )}
              onChange={(e) => {
                const t = filterPercentInputRaw(e.target.value);
                setPctDraft((p) => ({ ...p, invLoan: t }));
                if (t === "") {
                  updateIv({ loanAnnualRate: null });
                  return;
                }
                const r = parsePercentInputToRatio(t);
                if (r === "incomplete") return;
                updateIv({ loanAnnualRate: r });
              }}
              onBlur={() =>
                setPctDraft((p) => {
                  const n = { ...p };
                  delete n.invLoan;
                  return n;
                })
              }
              placeholder="4.7"
            />
          </div>
          <div>
            <label className={FMT_LABEL}>
              총보증금 (원)
            </label>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              호실 표 합계 (자동)
            </p>
            <div className={FMT_READONLY}>
              {formatWonWithUnit(derived.totalDeposit)}
            </div>
          </div>
          <div>
            <label className={FMT_LABEL}>
              총월세 (원/월)
            </label>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              호실 표 합계 (자동)
            </p>
            <div className={FMT_READONLY}>
              {formatWonWithUnit(derived.totalMonthlyRent)}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={FMT_LABEL}>
              매매 시세 (원) — 시세차익용 (선택)
            </label>
            <input
              inputMode="numeric"
              className={`${FMT_INPUT} tabular-nums`}
              value={moneyStr(iv.marketPrice)}
              onChange={(e) =>
                updateIv({ marketPrice: parseWonInput(e.target.value) })
              }
            />
          </div>
        </div>
        </div>

        <div className="rounded-lg border-2 border-neutral-300 bg-neutral-100/95 p-2.5 dark:border-neutral-600 dark:bg-neutral-900/70">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              계산 결과
            </p>
            <span className="rounded-md bg-neutral-300/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200">
              자동
            </span>
          </div>
          <dl className="mt-1.5 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] text-neutral-500">취득세</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.acquisitionTax))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">총투자금</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.totalInvestment))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">대출금액</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.loanAmount))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">대출 월이자</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.monthlyLoanInterest))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">실투자금</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.equityAfterLoan))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">순투자금</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.netInvestment))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">순월세소득</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.netMonthlyIncome))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-neutral-500">순투자 수익률 (연)</dt>
              <dd className="font-medium tabular-nums">
                {ivDerived.netYieldAnnualPct != null
                  ? `${ivDerived.netYieldAnnualPct.toFixed(2)}%`
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] text-neutral-500">시세차익</dt>
              <dd className="font-medium tabular-nums">
                {formatWonWithUnit(Math.round(ivDerived.priceGain))}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-2.5 dark:border-neutral-600 dark:bg-neutral-900/40">
          <p className={`${FMT_LABEL} font-semibold`}>
            참고 · 선택
          </p>
          <label className="mt-1 block text-[10px] font-medium text-neutral-500">
            구글 시트·자료 링크
          </label>
          <input
            className={FMT_INPUT}
            value={rs.sheetUrl}
            onChange={(e) => update({ sheetUrl: e.target.value })}
            placeholder="https://docs.google.com/..."
          />
          {rs.sheetUrl.trim() !== "" && (
            <a
              href={rs.sheetUrl.trim()}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-block text-[10px] text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              새 탭에서 열기
            </a>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className={`${FMT_LABEL} font-semibold`}>
            부가 정보 (선택)
          </p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={FMT_LABEL}>
                대지(평)·용도 등
              </label>
              <input
                className={FMT_INPUT}
                value={rs.landCategory}
                onChange={(e) => update({ landCategory: e.target.value })}
                placeholder="예: 제2종 근린"
              />
            </div>
            <div>
              <label className={FMT_LABEL}>
                연면적 (㎡)
              </label>
              <input
                inputMode="decimal"
                className={FMT_INPUT}
                value={rs.grossFloorAreaSqm ?? ""}
                placeholder={
                  caseData.buildingAreaSqm != null
                    ? String(caseData.buildingAreaSqm)
                    : undefined
                }
                onChange={(e) => {
                  const t = e.target.value.trim();
                  update({
                    grossFloorAreaSqm:
                      t === "" ? null : Math.min(1e9, parseFloat(t) || 0),
                  });
                }}
              />
            </div>
            <div>
              <label className={FMT_LABEL}>
                공시지가 (원)
              </label>
              <input
                inputMode="numeric"
                className={`${FMT_INPUT} tabular-nums`}
                value={moneyStr(rs.publicLandPrice)}
                onChange={(e) =>
                  update({ publicLandPrice: parseWonInput(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/35">
        <p className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
          건물 가구 수 (선택)
        </p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {COUNT_LABELS.map(({ key, label }) => (
            <label key={key} className="text-[10px] text-neutral-600 dark:text-neutral-400">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {label}
              </span>
              <input
                inputMode="numeric"
                className={FMT_INPUT}
                value={
                  rs.unitCounts[key] === 0 ? "" : String(rs.unitCounts[key])
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const n =
                    raw === "" ? 0 : Math.min(999, parseInt(raw, 10) || 0);
                  update({
                    unitCounts: { ...rs.unitCounts, [key]: n },
                  });
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
          건축·배당·메모 (선택)
        </p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={FMT_LABEL}>
            건축물대장 위반
          </label>
          <input
            className={FMT_INPUT}
            value={rs.buildingViolation}
            onChange={(e) => update({ buildingViolation: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>
            위반 내역·처리
          </label>
          <input
            className={FMT_INPUT}
            value={rs.violationDetail}
            onChange={(e) => update({ violationDetail: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>준공년도</label>
          <input
            className={FMT_INPUT}
            value={rs.builtYear}
            onChange={(e) => update({ builtYear: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>방향 등</label>
          <input
            className={FMT_INPUT}
            value={rs.facing}
            onChange={(e) => update({ facing: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>주차 대수</label>
          <input
            className={FMT_INPUT}
            value={rs.parkingCount}
            onChange={(e) => update({ parkingCount: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>
            배당·일부배당
          </label>
          <input
            className={FMT_INPUT}
            value={rs.allocationNote}
            onChange={(e) => update({ allocationNote: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>
            미배당·소유자 거주
          </label>
          <input
            className={FMT_INPUT}
            value={rs.ownerOccupiedNote}
            onChange={(e) => update({ ownerOccupiedNote: e.target.value })}
          />
        </div>
        <div>
          <label className={FMT_LABEL}>LH·HUG 등</label>
          <input
            className={FMT_INPUT}
            value={rs.lhHug}
            onChange={(e) => update({ lhHug: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className={FMT_LABEL}>세부 내역</label>
          <textarea
            className={`${FMT_INPUT} min-h-[3rem]`}
            value={rs.detailMemo}
            onChange={(e) => update({ detailMemo: e.target.value })}
          />
        </div>
        </div>
      </div>

        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          임대세팅 저장
        </button>
      </>
      )}
    </section>
  );
}
