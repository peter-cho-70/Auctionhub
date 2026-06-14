"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { AuctionCase, CaseTenantRecord, TenantDividendStatus } from "@/lib/types/domain";
import {
  createTenantRecord,
  refreshTenantRecordsFromCase,
  summarizeTenantRecordDividends,
  TENANT_DIVIDEND_STATUS_LABEL,
} from "@/lib/domain/case-tenant-records";
import { getExpectedDividendFromDocuments } from "@/lib/domain/tenant-dividend-display";
import { tenantRecordNameTone } from "@/lib/domain/tenant-dividend-display";
import { printTenantRecords } from "@/lib/domain/tenant-records-print";
import { compareTenantUnit } from "@/lib/domain/tenant-spec-merge";
import {
  TenantDateDetailGrid,
  TenantDateSummary,
} from "@/components/tenant/tenant-date-ui";
import { formatWonWithUnit } from "@/lib/format/won";
import {
  TABLE_COMPACT,
  TC_ACTION,
  TC_DATE,
  TC_MONEY,
  TC_MONEY_SM,
  TC_NAME,
  TC_SELECT,
  TC_TD,
  TC_TH,
  TC_UNIT,
} from "@/lib/ui/compact-table";

type Props = {
  caseData: AuctionCase;
  onChange: (records: CaseTenantRecord[]) => void;
};

const INPUT =
  "w-full min-w-0 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";

function toneInputClass(tone: ReturnType<typeof tenantRecordNameTone>): string {
  if (tone === "success") {
    return "border-emerald-300 font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300";
  }
  if (tone === "warning") {
    return "border-amber-300 font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-200";
  }
  if (tone === "risk") {
    return "border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400";
  }
  return "";
}

function moneyInput(
  value: number | null,
  onChange: (v: number | null) => void,
  className = INPUT,
): ReactNode {
  return (
    <input
      className={className}
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "");
        onChange(v === "" ? null : parseInt(v, 10) || null);
      }}
    />
  );
}

function StatusBadge({ status }: { status: TenantDividendStatus }) {
  const label = TENANT_DIVIDEND_STATUS_LABEL[status];
  const className =
    status === "full"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "partial"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : status === "none"
          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300";
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

export function CaseTenantRecordsPanel({ caseData, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const records = [...caseData.tenantRecords].sort((a, b) =>
    compareTenantUnit({ unit: a.unit }, { unit: b.unit }),
  );
  const expectedDividend = getExpectedDividendFromDocuments(caseData.sourceDocuments);
  const bidPrice =
    expectedDividend?.bid_price ??
    caseData.expectedBidPrice ??
    caseData.minPrice;
  const summary = summarizeTenantRecordDividends(records);

  const patch = (id: string, p: Partial<CaseTenantRecord>) => {
    onChange(
      records.map((r) =>
        r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r,
      ),
    );
  };

  const remove = (id: string) => {
    if (!confirm("행을 삭제할까요?")) return;
    onChange(records.filter((r) => r.id !== id));
  };

  const syncFromAnalysis = () => {
    onChange(refreshTenantRecordsFromCase(caseData));
  };

  return (
    <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/30 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">§8 임차인 구조화</h3>
          <p className="text-[11px] text-neutral-500">
            입찰가{" "}
            <strong className="tabular-nums text-neutral-700 dark:text-neutral-300">
              {bidPrice != null ? formatWonWithUnit(bidPrice) : "미입력"}
            </strong>
            {expectedDividend ? " · 배당표 반영" : ""}
            {" · "}
            전액 {summary.full} · 일부 {summary.partial} · 미배당 {summary.none}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={BTN} onClick={syncFromAnalysis}>
            분석 반영
          </button>
          <button type="button" className={BTN} onClick={() => printTenantRecords(caseData)}>
            인쇄
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => onChange([...records, createTenantRecord()])}
          >
            + 행
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className={TABLE_COMPACT}>
          <thead className="sticky top-0 z-[1] bg-neutral-100 text-[11px] text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className={`${TC_TH} ${TC_UNIT}`}>호실</th>
              <th className={`${TC_TH} ${TC_NAME}`}>권리자</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>보증금</th>
              <th className={`${TC_TH} ${TC_MONEY_SM}`}>월세</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>배당</th>
              <th className={`${TC_TH} ${TC_SELECT}`}>대항</th>
              <th className={`${TC_TH} ${TC_DATE}`}>날짜 요약</th>
              <th className={`${TC_TH} ${TC_ACTION}`} />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-neutral-400">
                  「분석 반영」 또는 + 행으로 시작
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const tone = tenantRecordNameTone(r);
                const expanded = expandedId === r.id;
                const rowTint =
                  r.hasOpposingPower === true
                    ? "bg-rose-50/80 dark:bg-rose-950/20"
                    : tone === "success"
                      ? "bg-emerald-50/40 dark:bg-emerald-950/10"
                      : tone === "warning"
                        ? "bg-amber-50/50 dark:bg-amber-950/10"
                        : tone === "risk"
                          ? "bg-rose-50/40 dark:bg-rose-950/10"
                          : "";
                return (
                  <Fragment key={r.id}>
                    <tr className={`border-t border-neutral-100 dark:border-neutral-900 ${rowTint}`}>
                      <td className={`${TC_TD} ${TC_UNIT}`}>
                        <input
                          className={INPUT}
                          value={r.unit}
                          onChange={(e) => patch(r.id, { unit: e.target.value })}
                        />
                      </td>
                      <td className={`${TC_TD} ${TC_NAME}`}>
                        <input
                          className={`${INPUT} ${toneInputClass(tone)}`}
                          value={r.occupantName}
                          onChange={(e) => patch(r.id, { occupantName: e.target.value })}
                        />
                      </td>
                      <td className={`${TC_TD} ${TC_MONEY}`}>
                        {moneyInput(r.deposit, (v) => patch(r.id, { deposit: v }))}
                      </td>
                      <td className={`${TC_TD} ${TC_MONEY_SM}`}>
                        {moneyInput(r.monthlyRent, (v) => patch(r.id, { monthlyRent: v }))}
                      </td>
                      <td className={`${TC_TD} ${TC_MONEY}`}>
                        <div className="space-y-0.5">
                          <StatusBadge status={r.dividendStatus} />
                          <div className="flex gap-0.5">
                            {moneyInput(
                              r.dividendAmount,
                              (v) => patch(r.id, { dividendAmount: v }),
                              `${INPUT} text-[10px]`,
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`${TC_TD} ${TC_SELECT}`}>
                        <select
                          className={INPUT}
                          value={
                            r.hasOpposingPower === null
                              ? ""
                              : r.hasOpposingPower
                                ? "yes"
                                : "no"
                          }
                          onChange={(e) =>
                            patch(r.id, {
                              hasOpposingPower:
                                e.target.value === ""
                                  ? null
                                  : e.target.value === "yes",
                            })
                          }
                        >
                          <option value="">?</option>
                          <option value="yes">O</option>
                          <option value="no">X</option>
                        </select>
                      </td>
                      <td className={`${TC_TD} ${TC_DATE}`}>
                        <TenantDateSummary
                          moveIn={r.moveInDate}
                          confirmed={r.confirmedDate}
                          dividend={r.dividendRequestDate}
                          highlightMissingDividend
                        />
                      </td>
                      <td className={`${TC_TD} ${TC_ACTION} text-center`}>
                        <button
                          type="button"
                          className="text-[10px] text-sky-700 underline dark:text-sky-300"
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                        >
                          {expanded ? "닫기" : "상세"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className={`border-t border-neutral-100 dark:border-neutral-900 ${rowTint}`}>
                        <td colSpan={8} className="px-2 py-2">
                          <TenantDateDetailGrid
                            moveIn={r.moveInDate}
                            confirmed={r.confirmedDate}
                            dividend={r.dividendRequestDate}
                            notes={r.inquiryNotes || r.memo}
                            onMoveInChange={(v) => patch(r.id, { moveInDate: v })}
                            onConfirmedChange={(v) => patch(r.id, { confirmedDate: v })}
                            onDividendChange={(v) =>
                              patch(r.id, { dividendRequestDate: v })
                            }
                            onNotesChange={(v) =>
                              patch(r.id, {
                                inquiryNotes: v,
                                memo: v.slice(0, 200),
                              })
                            }
                            extra={
                              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                                <label className="text-[11px] font-medium text-neutral-500">
                                  배당 상태
                                  <select
                                    className={`${INPUT} mt-1 w-32`}
                                    value={r.dividendStatus}
                                    onChange={(e) =>
                                      patch(r.id, {
                                        dividendStatus: e.target
                                          .value as TenantDividendStatus,
                                      })
                                    }
                                  >
                                    {(
                                      Object.keys(
                                        TENANT_DIVIDEND_STATUS_LABEL,
                                      ) as TenantDividendStatus[]
                                    ).map((k) => (
                                      <option key={k} value={k}>
                                        {TENANT_DIVIDEND_STATUS_LABEL[k]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="text-[11px] font-medium text-neutral-500">
                                  미배당액
                                  {moneyInput(r.undividedAmount, (v) =>
                                    patch(r.id, { undividedAmount: v }),
                                  )}
                                </label>
                                <button
                                  type="button"
                                  className="text-xs text-rose-600"
                                  onClick={() => remove(r.id)}
                                >
                                  행 삭제
                                </button>
                              </div>
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
