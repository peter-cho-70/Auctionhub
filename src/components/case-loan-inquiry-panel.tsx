"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuctionCase, PostAuctionWorkflow } from "@/lib/types/domain";
import {
  computeLoanLimitSummary,
  computeMonthlyLoanInterest,
  summarizeMortgageRights,
} from "@/lib/domain/loan-inquiry";
import {
  buildTemplateContext,
  interpolateTemplate,
} from "@/lib/domain/template-vars";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";
import {
  filterPercentInputRaw,
  formatRatioAsPercentInput,
  parsePercentInputToRatio,
} from "@/lib/format/percent-input";
import { CopyButton } from "@/components/copy-button";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";

const LOAN_INQUIRY_EXTRA_KEYS = [
  "명의",
  "현주택수",
  "소득요약",
  "카드사용",
  "부채요약",
  "물건특징",
  "매도전략",
  "낙찰가",
] as const;

const MONEY_EXTRA_KEYS = new Set(["낙찰가"]);

type Props = {
  caseData: AuctionCase;
  templateBody: string;
  extras: Record<string, string>;
  onExtrasChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (patch: { postAuction: PostAuctionWorkflow }) => void;
};

export function CaseLoanInquiryPanel({
  caseData,
  templateBody,
  extras,
  onExtrasChange,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(caseData.postAuction);
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});
  const [moneyDraft, setMoneyDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(caseData.postAuction);
  }, [caseData.updatedAt, caseData.postAuction]);

  const inquiryBody = useMemo(() => {
    const ctx = buildTemplateContext(caseData, extras);
    return interpolateTemplate(templateBody, ctx);
  }, [caseData, extras, templateBody]);

  const result = draft.loanPackage.counselorResult;
  const limitSummary = useMemo(
    () =>
      computeLoanLimitSummary(
        caseData,
        extras,
        result.collateralRatio,
        result.confirmedLoanLimit,
      ),
    [caseData, extras, result.collateralRatio, result.confirmedLoanLimit],
  );

  const calcLoan =
    draft.loanPackage.calcLoanAmount ??
    result.confirmedLoanLimit ??
    limitSummary.theoreticalLimit;
  const calcRate =
    draft.loanPackage.calcAnnualRate ?? result.annualRate;
  const monthlyInterest = computeMonthlyLoanInterest(calcLoan, calcRate);

  const mortgageHint = useMemo(
    () => summarizeMortgageRights(caseData),
    [caseData.sourceDocuments, caseData.lienBaseline],
  );

  const updateResult = (
    patch: Partial<typeof result>,
  ) => {
    setDraft((d) => ({
      ...d,
      loanPackage: {
        ...d.loanPackage,
        counselorResult: { ...d.loanPackage.counselorResult, ...patch },
      },
    }));
  };

  const save = () => {
    onSave({ postAuction: draft });
  };

  const prefillMortgage = () => {
    if (mortgageHint.trim()) {
      updateResult({ mortgageSummary: mortgageHint });
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
        <h3 className="text-sm font-medium text-violet-950 dark:text-violet-100">
          월 이자 계산
        </h3>
        <p className="mt-0.5 text-xs text-violet-900/70 dark:text-violet-200/70">
          대출금 × 연 이율 ÷ 365 × 30일
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            대출금 (원)
            <input
              inputMode="numeric"
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              value={
                moneyDraft.calcLoan ??
                (draft.loanPackage.calcLoanAmount != null
                  ? formatWonDigits(draft.loanPackage.calcLoanAmount)
                  : calcLoan != null
                    ? formatWonDigits(calcLoan)
                    : "")
              }
              onChange={(e) => {
                const raw = e.target.value;
                setMoneyDraft((p) => ({ ...p, calcLoan: raw }));
                const n = parseWonInput(raw);
                setDraft((d) => ({
                  ...d,
                  loanPackage: {
                    ...d.loanPackage,
                    calcLoanAmount: n,
                  },
                }));
              }}
              onBlur={() =>
                setMoneyDraft((p) => {
                  const n = { ...p };
                  delete n.calcLoan;
                  return n;
                })
              }
              placeholder={
                limitSummary.theoreticalLimit != null
                  ? formatWonDigits(limitSummary.theoreticalLimit)
                  : "한도 입력"
              }
            />
          </label>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            연 이율 (%)
            <input
              inputMode="decimal"
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              value={pctFieldValue(
                pctDraft,
                "calcRate",
                draft.loanPackage.calcAnnualRate ?? result.annualRate,
              )}
              onChange={(e) => {
                const t = filterPercentInputRaw(e.target.value);
                setPctDraft((p) => ({ ...p, calcRate: t }));
                if (t === "") {
                  setDraft((d) => ({
                    ...d,
                    loanPackage: { ...d.loanPackage, calcAnnualRate: null },
                  }));
                  return;
                }
                const r = parsePercentInputToRatio(t);
                if (r === "incomplete") return;
                setDraft((d) => ({
                  ...d,
                  loanPackage: { ...d.loanPackage, calcAnnualRate: r },
                }));
              }}
              onBlur={() =>
                setPctDraft((p) => {
                  const n = { ...p };
                  delete n.calcRate;
                  return n;
                })
              }
              placeholder="4.7"
            />
          </label>
          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            월 이자 (자동)
            <p className="mt-0.5 rounded border border-violet-200 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-violet-900 dark:border-violet-800 dark:bg-neutral-900 dark:text-violet-100">
              {monthlyInterest != null
                ? formatWonWithUnit(Math.round(monthlyInterest))
                : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">상담사 문의</h3>
            <CopyButton text={inquiryBody} label="문자 복사" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LOAN_INQUIRY_EXTRA_KEYS.map((key) => (
              <label
                key={key}
                className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
              >
                {key}
                <input
                  className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  inputMode={
                    MONEY_EXTRA_KEYS.has(key) ? "numeric" : undefined
                  }
                  value={extras[key] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (MONEY_EXTRA_KEYS.has(key)) {
                      const n = parseWonInput(raw);
                      onExtrasChange((prev) => ({
                        ...prev,
                        [key]:
                          raw.trim() === ""
                            ? ""
                            : n != null
                              ? formatWonDigits(n)
                              : raw,
                      }));
                    } else {
                      onExtrasChange((prev) => ({ ...prev, [key]: raw }));
                    }
                  }}
                />
              </label>
            ))}
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-sm leading-relaxed dark:bg-neutral-900">
            {inquiryBody}
          </pre>
        </div>

        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/15">
          <h3 className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
            상담사 답변 정리
          </h3>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              담보인정비율 (%)
              <input
                inputMode="decimal"
                className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                value={pctFieldValue(
                  pctDraft,
                  "collateral",
                  result.collateralRatio,
                )}
                onChange={(e) => {
                  const t = filterPercentInputRaw(e.target.value);
                  setPctDraft((p) => ({ ...p, collateral: t }));
                  if (t === "") {
                    updateResult({ collateralRatio: null });
                    return;
                  }
                  const r = parsePercentInputToRatio(t);
                  if (r === "incomplete") return;
                  updateResult({ collateralRatio: r });
                }}
                onBlur={() =>
                  setPctDraft((p) => {
                    const n = { ...p };
                    delete n.collateral;
                    return n;
                  })
                }
                placeholder="67"
              />
            </label>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              연 이율 (%)
              <input
                inputMode="decimal"
                className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                value={pctFieldValue(pctDraft, "annual", result.annualRate)}
                onChange={(e) => {
                  const t = filterPercentInputRaw(e.target.value);
                  setPctDraft((p) => ({ ...p, annual: t }));
                  if (t === "") {
                    updateResult({ annualRate: null });
                    return;
                  }
                  const r = parsePercentInputToRatio(t);
                  if (r === "incomplete") return;
                  updateResult({ annualRate: r });
                }}
                onBlur={() =>
                  setPctDraft((p) => {
                    const n = { ...p };
                    delete n.annual;
                    return n;
                  })
                }
                placeholder="4.7"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span className="flex flex-wrap items-center justify-between gap-2">
              근저당
              {mortgageHint.trim() && !result.mortgageSummary.trim() && (
                <button
                  type="button"
                  onClick={prefillMortgage}
                  className="text-[11px] font-medium text-emerald-700 underline dark:text-emerald-400"
                >
                  등기부에서 가져오기
                </button>
              )}
            </span>
            <AutoGrowTextarea
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={result.mortgageSummary}
              onChange={(e) => updateResult({ mortgageSummary: e.target.value })}
              placeholder="근저당 금액·순위·대출 가능 여부"
            />
          </label>

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            신탁
            <AutoGrowTextarea
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={result.trustSummary}
              onChange={(e) => updateResult({ trustSummary: e.target.value })}
              placeholder="신탁 여부, 낙찰가·감정가 대비 한도 조건"
            />
          </label>

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            확인 대출 한도 (원)
            <input
              inputMode="numeric"
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              value={
                moneyDraft.confirmedLimit ??
                (result.confirmedLoanLimit != null
                  ? formatWonDigits(result.confirmedLoanLimit)
                  : "")
              }
              onChange={(e) => {
                const raw = e.target.value;
                setMoneyDraft((p) => ({ ...p, confirmedLimit: raw }));
                updateResult({
                  confirmedLoanLimit: parseWonInput(raw),
                });
              }}
              onBlur={() =>
                setMoneyDraft((p) => {
                  const n = { ...p };
                  delete n.confirmedLimit;
                  return n;
                })
              }
              placeholder={
                limitSummary.theoreticalLimit != null
                  ? formatWonDigits(limitSummary.theoreticalLimit)
                  : ""
              }
            />
          </label>

          <LoanLimitSummaryTable summary={limitSummary} />

          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            답변 메모
            <AutoGrowTextarea
              className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={result.notes}
              onChange={(e) => updateResult({ notes: e.target.value })}
              placeholder="상담사 원문·추가 조건"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          대출 답변 저장
        </button>
      </div>
    </section>
  );
}

function LoanLimitSummaryTable({
  summary,
}: {
  summary: ReturnType<typeof computeLoanLimitSummary>;
}) {
  const limit =
    summary.confirmedLimit ?? summary.theoreticalLimit;
  const rows: [string, string][] = [
    [
      "감정가",
      summary.appraisal != null
        ? formatWonWithUnit(summary.appraisal)
        : "—",
    ],
    [
      "낙찰가",
      summary.winningBid != null
        ? formatWonWithUnit(summary.winningBid)
        : "—",
    ],
    [
      "담보인정 한도",
      summary.fromAppraisal != null
        ? formatWonWithUnit(summary.fromAppraisal)
        : "—",
    ],
    [
      "낙찰가 90% 상한",
      summary.bidCap90 != null
        ? formatWonWithUnit(summary.bidCap90)
        : "—",
    ],
    [
      "이론 한도",
      summary.theoreticalLimit != null
        ? formatWonWithUnit(summary.theoreticalLimit)
        : "—",
    ],
    [
      "확인 한도",
      limit != null ? formatWonWithUnit(limit) : "—",
    ],
    [
      "낙찰가 대비",
      summary.limitVsBidPct != null ? `${summary.limitVsBidPct}%` : "—",
    ],
    [
      "감정가 대비",
      summary.limitVsAppraisalPct != null
        ? `${summary.limitVsAppraisalPct}%`
        : "—",
    ],
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-emerald-200/80 bg-white/80 dark:border-emerald-900/40 dark:bg-neutral-950/60">
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr
              key={label}
              className="border-b border-emerald-100 last:border-0 dark:border-emerald-900/30"
            >
              <th className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-neutral-500">
                {label}
              </th>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pctFieldValue(
  draft: Record<string, string>,
  key: string,
  ratio: number | null | undefined,
): string {
  if (draft[key] !== undefined) return draft[key]!;
  return formatRatioAsPercentInput(ratio);
}
