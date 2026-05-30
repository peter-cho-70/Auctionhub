"use client";

import type { ReactNode } from "react";
import type { AuctionCase, CaseTenantRecord, TenantDividendStatus } from "@/lib/types/domain";
import {
  createTenantRecord,
  mergeTenantRecordsFromPdf,
  TENANT_DIVIDEND_STATUS_LABEL,
} from "@/lib/domain/case-tenant-records";

type Props = {
  caseData: AuctionCase;
  onChange: (records: CaseTenantRecord[]) => void;
};

const INPUT =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";

function moneyInput(
  value: number | null,
  onChange: (v: number | null) => void,
): ReactNode {
  return (
    <input
      className={INPUT}
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "");
        onChange(v === "" ? null : parseInt(v, 10) || null);
      }}
    />
  );
}

export function CaseTenantRecordsPanel({ caseData, onChange }: Props) {
  const records = caseData.tenantRecords;

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

  const mergePdf = () => {
    const merged = mergeTenantRecordsFromPdf(records, caseData);
    onChange(merged);
  };

  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">임차인 구조화 표 (보고서 §8)</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            PDF·탐문 데이터 병합 · 대항력 행은 보고서에서 강조
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={BTN} onClick={mergePdf}>
            PDF에서 병합
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() => onChange([...records, createTenantRecord()])}
          >
            + 행 추가
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-1">호실</th>
              <th className="p-1">권리자</th>
              <th className="p-1">보증금</th>
              <th className="p-1">월세</th>
              <th className="p-1">전입</th>
              <th className="p-1">확정</th>
              <th className="p-1">배당</th>
              <th className="p-1">대항</th>
              <th className="p-1">배당액</th>
              <th className="p-1">상태</th>
              <th className="p-1 w-16" />
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-4 text-center text-neutral-400">
                  행 추가 또는 PDF 병합
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-neutral-100 dark:border-neutral-900 ${
                    r.hasOpposingPower === true ? "bg-rose-50/80 dark:bg-rose-950/20" : ""
                  }`}
                >
                  <td className="p-1">
                    <input
                      className={INPUT}
                      value={r.unit}
                      onChange={(e) => patch(r.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      className={INPUT}
                      value={r.occupantName}
                      onChange={(e) => patch(r.id, { occupantName: e.target.value })}
                    />
                  </td>
                  <td className="p-1 w-24">{moneyInput(r.deposit, (v) => patch(r.id, { deposit: v }))}</td>
                  <td className="p-1 w-20">{moneyInput(r.monthlyRent, (v) => patch(r.id, { monthlyRent: v }))}</td>
                  <td className="p-1 w-28">
                    <input
                      type="date"
                      className={INPUT}
                      value={r.moveInDate.slice(0, 10)}
                      onChange={(e) => patch(r.id, { moveInDate: e.target.value })}
                    />
                  </td>
                  <td className="p-1 w-28">
                    <input
                      type="date"
                      className={INPUT}
                      value={r.confirmedDate.slice(0, 10)}
                      onChange={(e) => patch(r.id, { confirmedDate: e.target.value })}
                    />
                  </td>
                  <td className="p-1 w-28">
                    <input
                      type="date"
                      className={INPUT}
                      value={r.dividendRequestDate.slice(0, 10)}
                      onChange={(e) => patch(r.id, { dividendRequestDate: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className={INPUT}
                      value={r.hasOpposingPower === null ? "" : r.hasOpposingPower ? "yes" : "no"}
                      onChange={(e) =>
                        patch(r.id, {
                          hasOpposingPower:
                            e.target.value === "" ? null : e.target.value === "yes",
                        })
                      }
                    >
                      <option value="">미확인</option>
                      <option value="yes">있음</option>
                      <option value="no">없음</option>
                    </select>
                  </td>
                  <td className="p-1 w-20">
                    {moneyInput(r.dividendAmount, (v) => patch(r.id, { dividendAmount: v }))}
                  </td>
                  <td className="p-1">
                    <select
                      className={INPUT}
                      value={r.dividendStatus}
                      onChange={(e) =>
                        patch(r.id, {
                          dividendStatus: e.target.value as TenantDividendStatus,
                        })
                      }
                    >
                      {(Object.keys(TENANT_DIVIDEND_STATUS_LABEL) as TenantDividendStatus[]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {TENANT_DIVIDEND_STATUS_LABEL[k]}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="p-1">
                    <button type="button" className="text-rose-600" onClick={() => remove(r.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
