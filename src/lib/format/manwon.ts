/** 만원 단위 금액 — 소수 첫째·둘째 자리까지 허용 */

const MANWON_SCALE = 100;

export function roundManwon(n: number): number {
  return Math.round(n * MANWON_SCALE) / MANWON_SCALE;
}

/** 입력 필드: 쉼표·공백·'만원' 제거 후 파싱 */
export function parseManwonInput(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, "").replace(/만원?/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundManwon(n);
}

/** 숫자 표시 (접미사 없음) */
export function formatManwonDigits(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return roundManwon(n).toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** 표시용 "12.5만원" */
export function formatManwonWithSuffix(n: number | null | undefined): string {
  const s = formatManwonDigits(n);
  return s === "" ? "" : `${s}만원`;
}

/** 저장·마이그레이션용 정규화 */
export function normalizeStoredManwon(
  raw: unknown,
  max = 999_999,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(max, roundManwon(Math.max(0, raw)));
  }
  if (typeof raw === "string") {
    const parsed = parseManwonInput(raw);
    return parsed == null ? null : Math.min(max, parsed);
  }
  return null;
}
