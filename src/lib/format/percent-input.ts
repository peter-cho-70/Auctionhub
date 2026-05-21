/**
 * 저장값은 소수 비율 (예: 0.047 = 4.7%).
 * 입력칸에는 퍼센트 숫자만 표시.
 */

export function formatRatioAsPercentInput(
  ratio: number | null | undefined,
): string {
  if (ratio == null || !Number.isFinite(ratio)) return "";
  const pct = ratio * 100;
  return String(Math.round(pct * 1e8) / 1e8);
}

export function filterPercentInputRaw(raw: string, maxDecimals = 2): string {
  const t = raw.trim().replace(/%/g, "").replace(",", ".");
  let out = "";
  let dotSeen = false;
  let decimals = 0;
  for (const c of t) {
    if (c >= "0" && c <= "9") {
      if (dotSeen) {
        if (decimals >= maxDecimals) continue;
        decimals += 1;
      }
      out += c;
    } else if (c === "." && !dotSeen) {
      dotSeen = true;
      out += ".";
    }
  }
  return out;
}

/** 저장값: 퍼센트 숫자 (예: 72.55 = 72.55%) */
export function formatPercentRateValue(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  return String(Math.round(pct * 100) / 100);
}

export function filterPercentRateInputRaw(raw: string): string {
  return filterPercentInputRaw(raw, 2);
}

export function parsePercentRateInput(
  t: string,
): number | null | "incomplete" {
  const s = filterPercentRateInputRaw(t);
  if (s === "") return null;
  if (s === "." || s.endsWith(".")) return "incomplete";
  const pct = parseFloat(s);
  if (!Number.isFinite(pct) || pct < 0) return "incomplete";
  return Math.round(Math.min(999, pct) * 100) / 100;
}

/** blur 시 "72." → 72 등 마무리 */
export function finalizePercentRateInput(t: string): number | null {
  const parsed = parsePercentRateInput(t);
  if (parsed !== "incomplete") return parsed;
  const s = filterPercentRateInputRaw(t);
  if (s.endsWith(".")) {
    const head = s.slice(0, -1);
    if (!head) return null;
    const pct = parseFloat(head);
    if (!Number.isFinite(pct) || pct < 0) return null;
    return Math.round(Math.min(999, pct) * 100) / 100;
  }
  return null;
}

export function parsePercentInputToRatio(
  t: string,
): number | null | "incomplete" {
  const s = t.trim();
  if (s === "") return null;
  if (s === ".") return "incomplete";
  const pct = parseFloat(s);
  if (!Number.isFinite(pct)) return "incomplete";
  if (pct < 0) return "incomplete";
  return Math.min(100, pct) / 100;
}
