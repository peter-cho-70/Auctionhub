"use client";

import type { ReactNode } from "react";

/** 화면용 짧은 날짜 (2021-03-02 → 21.03.02) */
export function shortDateLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().slice(0, 10);
  if (!t) return "—";
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]!.slice(2)}.${m[2]}.${m[3]}`;
  return t.length > 12 ? t.slice(0, 12) : t;
}

type DateChipProps = {
  label: string;
  value: string;
  missing?: boolean;
};

function DateChip({ label, value, missing }: DateChipProps) {
  const hasValue = value.trim() !== "" && value !== "—";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${
        missing || !hasValue
          ? "bg-rose-50 font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
      title={`${label}: ${hasValue ? value : "미입력"}`}
    >
      <span className="text-neutral-400 dark:text-neutral-500">{label}</span>
      <span className="tabular-nums">{hasValue ? shortDateLabel(value) : "—"}</span>
    </span>
  );
}

export function TenantDateSummary({
  moveIn,
  confirmed,
  dividend,
  highlightMissingDividend,
}: {
  moveIn: string;
  confirmed: string;
  dividend: string;
  highlightMissingDividend?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <DateChip label="전입" value={moveIn} />
      <DateChip label="확정" value={confirmed} />
      <DateChip
        label="배당"
        value={dividend}
        missing={highlightMissingDividend && !dividend.trim()}
      />
    </div>
  );
}

const DETAIL_INPUT =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900";

export function TenantDateDetailGrid({
  moveIn,
  businessDate,
  confirmed,
  dividend,
  notes,
  notesPlaceholder,
  onMoveInChange,
  onBusinessDateChange,
  onConfirmedChange,
  onDividendChange,
  onNotesChange,
  extra,
}: {
  moveIn: string;
  businessDate?: string;
  confirmed: string;
  dividend: string;
  notes?: string;
  notesPlaceholder?: string;
  onMoveInChange: (v: string) => void;
  onBusinessDateChange?: (v: string) => void;
  onConfirmedChange: (v: string) => void;
  onDividendChange: (v: string) => void;
  onNotesChange?: (v: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/40 sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-[11px] font-medium text-neutral-500">
        전입일
        <input
          className={`${DETAIL_INPUT} mt-1`}
          value={moveIn}
          onChange={(e) => onMoveInChange(e.target.value)}
          placeholder="YYYY-MM-DD"
        />
      </label>
      {onBusinessDateChange != null && (
        <label className="block text-[11px] font-medium text-neutral-500">
          사업자등록일
          <input
            className={`${DETAIL_INPUT} mt-1`}
            value={businessDate ?? ""}
            onChange={(e) => onBusinessDateChange(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        </label>
      )}
      <label className="block text-[11px] font-medium text-neutral-500">
        확정일자
        <input
          className={`${DETAIL_INPUT} mt-1`}
          value={confirmed}
          onChange={(e) => onConfirmedChange(e.target.value)}
          placeholder="YYYY-MM-DD"
        />
      </label>
      <label className="block text-[11px] font-medium text-neutral-500">
        배당요구일
        <input
          className={`${DETAIL_INPUT} mt-1 ${
            !dividend.trim() ? "border-rose-300 dark:border-rose-800" : ""
          }`}
          value={dividend}
          onChange={(e) => onDividendChange(e.target.value)}
          placeholder="없음"
        />
      </label>
      {onNotesChange != null && (
        <label className="block text-[11px] font-medium text-neutral-500 sm:col-span-2 lg:col-span-4">
          메모
          <textarea
            className={`${DETAIL_INPUT} mt-1 min-h-[4rem] resize-y`}
            value={notes ?? ""}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={notesPlaceholder ?? "임장·협의 메모"}
          />
        </label>
      )}
      {extra}
    </div>
  );
}
