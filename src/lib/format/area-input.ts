/** ㎡ 입력: 숫자와 소수점 한 자리만 허용하는 필터 */
export function filterAreaSqmInputRaw(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot === -1) return s;
  const rest = s.slice(firstDot + 1).replace(/\./g, "");
  s = s.slice(0, firstDot + 1) + rest;
  return s.slice(0, 16);
}

/** 저장용 ㎡ 숫자 (소수 둘째 자리 반올림, null = 비움·미완 입력) */
export function parseAreaSqmInputToNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || t === ".") return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(Math.min(1e9, n) * 100) / 100;
}
