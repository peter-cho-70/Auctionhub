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

export function filterPercentInputRaw(raw: string): string {
  const t = raw.trim().replace(/%/g, "").replace(",", ".");
  let out = "";
  let dotSeen = false;
  for (const c of t) {
    if (c >= "0" && c <= "9") out += c;
    else if (c === "." && !dotSeen) {
      dotSeen = true;
      out += ".";
    }
  }
  return out;
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
