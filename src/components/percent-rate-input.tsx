"use client";

import { useEffect, useState } from "react";
import {
  filterPercentInputRaw,
  filterPercentRateInputRaw,
  finalizePercentRateInput,
  formatPercentRateValue,
  formatRatioAsPercentInput,
  parsePercentInputToRatio,
  parsePercentRateInput,
} from "@/lib/format/percent-input";

type Props = {
  label?: string;
  className?: string;
  placeholder?: string;
  /** ratio: 0.725 저장 · percent: 72.5 저장 */
  valueMode?: "ratio" | "percent";
  value: number | null;
  onChange: (v: number | null) => void;
};

export function PercentRateInput({
  label,
  className = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900",
  placeholder = "예: 72.55",
  valueMode = "percent",
  value,
  onChange,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const formatStored = (v: number | null) =>
    valueMode === "percent"
      ? formatPercentRateValue(v)
      : formatRatioAsPercentInput(v);

  const filter =
    valueMode === "percent" ? filterPercentRateInputRaw : filterPercentInputRaw;

  const parse = (t: string) =>
    valueMode === "percent"
      ? parsePercentRateInput(t)
      : parsePercentInputToRatio(t);

  const finalize = (t: string): number | null => {
    if (valueMode === "percent") return finalizePercentRateInput(t);
    const p = parsePercentInputToRatio(t);
    return p === "incomplete" ? null : p;
  };

  useEffect(() => {
    if (draft == null) return;
    const committed = formatStored(value);
    if (committed === draft) setDraft(null);
  }, [value, draft]);

  const display = draft ?? formatStored(value);

  const input = (
    <input
      inputMode="decimal"
      className={className}
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const t = filter(e.target.value);
        setDraft(t);
        const parsed = parse(t);
        if (parsed !== "incomplete") {
          onChange(parsed);
        } else if (t === "") {
          onChange(null);
        }
      }}
      onBlur={() => {
        const t = draft ?? formatStored(value);
        if (t === "") {
          onChange(null);
          setDraft(null);
          return;
        }
        const parsed = parse(t);
        if (parsed !== "incomplete") {
          onChange(parsed);
        } else {
          onChange(finalize(t));
        }
        setDraft(null);
      }}
    />
  );

  if (!label) return input;

  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      {input}
    </label>
  );
}
