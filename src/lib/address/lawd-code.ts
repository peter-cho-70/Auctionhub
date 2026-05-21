/** 국토부 실거래 API LAWD_CD (시군구 5자리) — 대전광역시 */

export const DAEJEON_GU_LAWD_CODES: Record<string, string> = {
  동구: "30110",
  중구: "30140",
  서구: "30170",
  유성구: "30200",
  대덕구: "30230",
};

const GU_NAMES = Object.keys(DAEJEON_GU_LAWD_CODES);

export function inferGuFromAddressText(address: string): string {
  return GU_NAMES.find((gu) => address.includes(gu)) ?? "";
}

export function resolveMolitLawdCode(
  address: string,
  meta?: { molitLawdCode?: string | null; sggNm?: string | null; roadAddress?: string | null; jibunAddress?: string | null } | null,
): string | null {
  const stored = meta?.molitLawdCode?.trim();
  if (stored && /^\d{5}$/.test(stored)) return stored;

  const texts = [
    address,
    meta?.roadAddress ?? "",
    meta?.jibunAddress ?? "",
    meta?.sggNm ?? "",
  ].filter(Boolean);

  for (const text of texts) {
    const gu = inferGuFromAddressText(text);
    if (gu) return DAEJEON_GU_LAWD_CODES[gu] ?? null;
  }
  return null;
}
