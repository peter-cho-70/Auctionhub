/**
 * 원화 금액 표시 — 천 단위 구분은 ko-KR 로케일 쉼표 사용.
 */

/** 숫자만 쉼표 구분 (접미사 없음). null/NaN 이면 빈 문자열. */
export function formatWonDigits(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 표시용 "12,345원" */
export function formatWonWithUnit(n: number | null | undefined): string {
  const s = formatWonDigits(n);
  return s === "" ? "" : `${s}원`;
}

/** 입력 필드용: 쉼표·공백·'원' 제거 후 숫자 파싱 */
export function parseWonInput(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, "").replace(/원/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
