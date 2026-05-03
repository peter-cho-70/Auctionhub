"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuctionCase, RentInvestmentYield, RentSetting, RentSettingUnitRow } from "@/lib/types/domain";
import {
  computeInvestmentYieldDerived,
  computeRentSettingDerived,
  emptyRentSetting,
  newRentUnitRow,
} from "@/lib/domain/rent-setting";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";
import {
  filterPercentInputRaw,
  formatRatioAsPercentInput,
  parsePercentInputToRatio,
} from "@/lib/format/percent-input";

type Props = {
  caseId: string;
  caseData: AuctionCase;
  /** 문자·도구 탭과 동일 보조값 — 낙찰가 입력 시 낙찰가 대비 감정가 % 표시 */
  templateExtras?: Record<string, string>;
  onSave: (rentSetting: RentSetting) => void;
};

const COUNT_LABELS: { key: keyof RentSetting["unitCounts"]; label: string }[] = [
  { key: "commercial", label: "상가" },
  { key: "oneRoom", label: "원룸" },
  { key: "oneHalfRoom", label: "1.5룸" },
  { key: "twoRoom", label: "투룸" },
  { key: "threeRoom", label: "쓰리룸" },
  { key: "ownerUnit", label: "주인세대" },
];

/** 직접 입력(핵심) — 앰버 테두리 */
const CN_INPUT_CORE =
  "mt-1 w-full rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2 text-sm tabular-nums dark:border-amber-900/50 dark:bg-amber-950/25";
/** 선택·부가 입력 — 기본 테두리 */
const CN_INPUT_OPTIONAL =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

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
  caseId,
  caseData,
  templateExtras,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<RentSetting | null>(null);
  const [pctDraft, setPctDraft] = useState<Partial<Record<PctKey, string>>>(
    {},
  );

  useEffect(() => {
    setDraft(null);
    setPctDraft({});
  }, [caseId]);

  const rs = draft ?? caseData.rentSetting ?? emptyRentSetting();
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
  };

  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          다가구 임대·수익률용 숫자를 입력합니다. 합계 보증금·합계 월세는
          아래 호실 표에서 자동으로 더하며,{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">
            실투자금 = 매도가 − 융자 − 합계 보증금
          </strong>
          ,{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">
            월이자 = 융자 × 연이율 ÷ 365 × 30
          </strong>
          ,{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">
            월순익 = 합계 월세 − 월이자
          </strong>
          ,{" "}
          <strong className="font-medium text-neutral-800 dark:text-neutral-200">
            수익률 = 월순익 × 12 ÷ 실투자금 × 100
          </strong>
          (실투자금이 0 이하면 표시 생략) 입니다.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-3 dark:border-neutral-600 dark:bg-neutral-900/40">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          참고 · 선택
        </p>
        <label className="mt-2 block text-xs font-medium text-neutral-500">
          구글 시트·자료 링크 (선택)
        </label>
        <input
          className={CN_INPUT_OPTIONAL}
          value={rs.sheetUrl}
          onChange={(e) => update({ sheetUrl: e.target.value })}
          placeholder="https://docs.google.com/spreadsheets/..."
        />
        {rs.sheetUrl.trim() !== "" && (
          <a
            href={rs.sheetUrl.trim()}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
          >
            새 탭에서 열기
          </a>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          부가 정보 (선택)
        </p>
        <p className="mt-0.5 text-[10px] text-neutral-500">
          대지·연면적(㎡)·공시지가 등 — 필수 아님
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-neutral-500">
            대지(평)·용도 등
          </label>
          <input
            className={CN_INPUT_OPTIONAL}
            value={rs.landCategory}
            onChange={(e) => update({ landCategory: e.target.value })}
            placeholder="예: 제2종 근린"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            연면적 (㎡)
          </label>
          <input
            inputMode="decimal"
            className={CN_INPUT_OPTIONAL}
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
          {rs.grossFloorAreaSqm == null &&
            caseData.buildingAreaSqm != null && (
              <p className="mt-0.5 text-[10px] text-neutral-500">
                물건 기본 탭 건물면적 {caseData.buildingAreaSqm}㎡ — 필요하면 위에
                입력해 저장하세요.
              </p>
            )}
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            공시지가 (원)
          </label>
          <input
            inputMode="numeric"
            className={`${CN_INPUT_OPTIONAL} tabular-nums`}
            value={moneyStr(rs.publicLandPrice)}
            onChange={(e) =>
              update({ publicLandPrice: parseWonInput(e.target.value) })
            }
          />
        </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-amber-300/70 bg-amber-50/35 p-4 dark:border-amber-800/55 dark:bg-amber-950/20">
        <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
          핵심 입력 · 매도가 · 융자 · 연이율
        </p>
        <p className="mt-0.5 text-[10px] text-amber-900/80 dark:text-amber-200/80">
          수익률 요약에 바로 반영되는 값입니다.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-neutral-500">
            매도가 (원)
          </label>
          <input
            inputMode="numeric"
            className={CN_INPUT_CORE}
            value={moneyStr(rs.salePrice)}
            onChange={(e) =>
              update({ salePrice: parseWonInput(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            융자 금액 (원)
          </label>
          <input
            inputMode="numeric"
            className={CN_INPUT_CORE}
            value={moneyStr(rs.loanAmount)}
            onChange={(e) =>
              update({ loanAmount: parseWonInput(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            연이율 (%)
          </label>
          <input
            inputMode="decimal"
            className={CN_INPUT_CORE}
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

      <div className="rounded-xl border-2 border-neutral-300 bg-neutral-100/90 p-3 dark:border-neutral-600 dark:bg-neutral-900/65">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            요약
          </p>
          <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            자동 계산
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-neutral-500">
          호실 표 합계·위 매도·융자·이율로 계산됩니다. 입력 불가.
        </p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[11px] text-neutral-500">합계 보증금</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(derived.totalDeposit)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">합계 월세</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(derived.totalMonthlyRent)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">실투자금</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.equity))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">월이자</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.monthlyInterest))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">월순익</dt>
            <dd className="font-medium tabular-nums">
              {formatWonWithUnit(Math.round(derived.monthlyNet))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-neutral-500">연 수익률 (%)</dt>
            <dd className="font-medium tabular-nums">
              {derived.yieldAnnualPct != null
                ? `${derived.yieldAnnualPct.toFixed(2)}%`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            투자 대비 수익률 (원 단위)
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
            다가구 수익표(수정본)과 동일한 수식입니다. 금액은 원으로 통일했습니다.
            취득세 = 입찰×취득세율, 총투자 = 입찰+명도+취득세,
            대출 = MIN(감정가×담보비율, 입찰×0.9), 순투자 = (총투자−대출)−총보증금,
            순월세소득 = 총월세−대출월이자, 순투자수익률 = 순월세소득×12÷순투자×100(% 표기).
            총보증금·총월세는 아래 호실 표 합계와 동일하게 자동 반영됩니다.
          </p>
        </div>

        <div className="rounded-lg border-2 border-amber-300/60 bg-amber-50/30 p-3 dark:border-amber-800/50 dark:bg-amber-950/25">
          <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
            직접 입력
          </p>
          <p className="mt-0.5 text-[10px] text-amber-900/75 dark:text-amber-200/75">
            입찰·명도·세율·대출 조건·시세차익용 시세 등
          </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              입찰금액 (원)
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                className="min-w-[10rem] flex-1 rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2 text-sm tabular-nums dark:border-amber-900/50 dark:bg-amber-950/25"
                value={moneyStr(iv.bidAmount)}
                onChange={(e) =>
                  updateIv({ bidAmount: parseWonInput(e.target.value) })
                }
              />
              {bidVsAppraisalPct != null && (
                <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                  입찰 감정가 대비 {bidVsAppraisalPct.toFixed(2)}%
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
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              명도비용 (원)
            </label>
            <input
              inputMode="numeric"
              className={CN_INPUT_CORE}
              value={moneyStr(iv.evictionCost)}
              onChange={(e) =>
                updateIv({ evictionCost: parseWonInput(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              취득세율 (%)
            </label>
            <input
              inputMode="decimal"
              className={CN_INPUT_CORE}
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
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              감정가 (원)
            </label>
            <input
              inputMode="numeric"
              className={CN_INPUT_CORE}
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
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              대출 담보 비율 (%)
            </label>
            <input
              inputMode="decimal"
              className={CN_INPUT_CORE}
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
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              대출 연이율 (%)
            </label>
            <input
              inputMode="decimal"
              className={CN_INPUT_CORE}
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
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              총보증금 (원)
            </label>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              호실 표 합계 (자동)
            </p>
            <div className="mt-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm tabular-nums text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800/90 dark:text-neutral-200">
              {formatWonWithUnit(derived.totalDeposit)}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              총월세 (원/월)
            </label>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              호실 표 합계 (자동)
            </p>
            <div className="mt-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm tabular-nums text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800/90 dark:text-neutral-200">
              {formatWonWithUnit(derived.totalMonthlyRent)}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              매매 시세 (원) — 시세차익용 (선택)
            </label>
            <input
              inputMode="numeric"
              className={`${CN_INPUT_OPTIONAL} tabular-nums`}
              value={moneyStr(iv.marketPrice)}
              onChange={(e) =>
                updateIv({ marketPrice: parseWonInput(e.target.value) })
              }
            />
          </div>
        </div>
        </div>

        <div className="rounded-lg border-2 border-neutral-300 bg-neutral-100/95 p-3 dark:border-neutral-600 dark:bg-neutral-900/70">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              계산 결과
            </p>
            <span className="rounded-md bg-neutral-300/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200">
              자동
            </span>
          </div>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="rounded-xl border-2 border-amber-300/70 bg-amber-50/30 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                호실별 보증금·월세
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                {caseData.householdCount != null
                  ? `순번을 물건 기본의 총가구수 (${caseData.householdCount}세대)와 맞춰 보세요. `
                  : "물건 기본 탭에 총가구수를 입력하면 대조에 도움이 됩니다. "}
                합계는 상단 요약·투자 수익률에 반영됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  update({ unitRows: [...rs.unitRows, newRentUnitRow()] })
                }
                className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-600"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rs.unitRows.length <= 1) return;
                  update({ unitRows: rs.unitRows.slice(0, -1) });
                }}
                className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-600"
              >
                마지막 행 삭제
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-[min(70vh,480px)] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th className="border border-neutral-200 px-2 py-2 text-center font-medium dark:border-neutral-800">
                    순번
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    층
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    호
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    룸형태
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    보증금
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    월세
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    평
                  </th>
                  <th className="border border-neutral-200 px-2 py-2 font-medium dark:border-neutral-800">
                    기타
                  </th>
                </tr>
              </thead>
              <tbody>
                {rs.unitRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="border border-neutral-200 px-2 py-1.5 text-center tabular-nums text-neutral-500 dark:border-neutral-800">
                      {index + 1}
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        className="w-full min-w-[4rem] bg-transparent px-2 py-1.5 text-xs outline-none"
                        value={row.floor}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              floor: e.target.value,
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        className="w-full min-w-[3rem] bg-transparent px-2 py-1.5 text-xs outline-none"
                        value={row.unitNo}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              unitNo: e.target.value,
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        className="w-full min-w-[5rem] bg-transparent px-2 py-1.5 text-xs outline-none"
                        value={row.roomType}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              roomType: e.target.value,
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        inputMode="numeric"
                        className="w-full min-w-[6rem] bg-transparent px-2 py-1.5 text-xs tabular-nums outline-none"
                        value={moneyStr(row.deposit)}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              deposit: parseWonInput(e.target.value),
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        inputMode="numeric"
                        className="w-full min-w-[6rem] bg-transparent px-2 py-1.5 text-xs tabular-nums outline-none"
                        value={moneyStr(row.monthlyRent)}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              monthlyRent: parseWonInput(e.target.value),
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        inputMode="decimal"
                        className="w-full min-w-[3rem] bg-transparent px-2 py-1.5 text-xs outline-none"
                        value={row.areaPyeong ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.trim();
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              areaPyeong:
                                t === "" ? null : parseFloat(t) || null,
                            }),
                          });
                        }}
                      />
                    </td>
                    <td className="border border-neutral-200 p-0 dark:border-neutral-800">
                      <input
                        className="w-full min-w-[5rem] bg-transparent px-2 py-1.5 text-xs outline-none"
                        value={row.note}
                        onChange={(e) =>
                          update({
                            unitRows: setUnitRow(rs.unitRows, row.id, {
                              note: e.target.value,
                            }),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/35">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          건물 가구 수 (선택)
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {COUNT_LABELS.map(({ key, label }) => (
            <label key={key} className="text-[11px] text-neutral-600 dark:text-neutral-400">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {label}
              </span>
              <input
                inputMode="numeric"
                className={`${CN_INPUT_OPTIONAL} mt-1 px-2 py-1.5 text-xs`}
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

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          건축·배당·메모 (선택)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-neutral-500">
            건축물대장 위반 여부
          </label>
          <input
            className={CN_INPUT_OPTIONAL}
            value={rs.buildingViolation}
            onChange={(e) => update({ buildingViolation: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            위반 내역 및 처리
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.violationDetail}
            onChange={(e) => update({ violationDetail: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">준공년도</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.builtYear}
            onChange={(e) => update({ builtYear: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">방향 등</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.facing}
            onChange={(e) => update({ facing: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">주차 대수</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.parkingCount}
            onChange={(e) => update({ parkingCount: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            배당·일부배당 등
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.allocationNote}
            onChange={(e) => update({ allocationNote: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">
            미배당·소유자 거주 등
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.ownerOccupiedNote}
            onChange={(e) => update({ ownerOccupiedNote: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">LH·HUG 등</label>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.lhHug}
            onChange={(e) => update({ lhHug: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-neutral-500">세부 내역</label>
          <textarea
            className="mt-1 min-h-[4rem] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={rs.detailMemo}
            onChange={(e) => update({ detailMemo: e.target.value })}
          />
        </div>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        임대세팅 저장
      </button>
    </section>
  );
}
