/** 필지고유번호(PNU) 19자리 — 법정동코드·지번 기준 조합 */

export function buildPnuFromParcel(
  legalDongCode: string,
  bonbun: number,
  bubun: number,
  isMountain = false,
): string | null {
  const adm = legalDongCode.replace(/\D/g, "");
  if (adm.length !== 10) return null;
  if (!Number.isFinite(bonbun) || bonbun < 0) return null;
  const bu = Number.isFinite(bubun) && bubun >= 0 ? bubun : 0;
  const landClass = isMountain ? "2" : "1";
  return `${adm}${landClass}${String(Math.floor(bonbun)).padStart(4, "0")}${String(Math.floor(bu)).padStart(4, "0")}`;
}

export function eumDetailUrl(pnu: string): string {
  return `https://www.eum.go.kr/web/cp/cv/cvUpisDet.jsp?pnu=${encodeURIComponent(pnu)}`;
}
