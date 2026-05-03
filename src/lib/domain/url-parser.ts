/**
 * 법원 경매 사이트 URL에서 초기 필드를 추출합니다.
 * CORS로 페이지를 가져올 수 없으므로 URL 문자열만 분석합니다.
 */
export interface ParsedAuctionUrl {
  caseNumber: string;
  address: string;
  /** 추출 실패 시에도 원본은 저장 */
  normalizedUrl: string;
}

function tryParseUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return new URL(t.startsWith("http") ? t : `https://${t}`);
  } catch {
    return null;
  }
}

/** 사건번호 후보: 2024타경12345, 2024타기12345 등 */
const CASE_NO_REGEX = /(\d{4}타(?:경|기)\d+)/;

export function parseAuctionUrl(raw: string): ParsedAuctionUrl {
  const normalizedUrl = raw.trim();
  let caseNumber = "";
  let address = "";

  const u = tryParseUrl(normalizedUrl);
  if (u) {
    const candidates = [
      u.searchParams.get("saNo"),
      u.searchParams.get("realSaNo"),
      u.searchParams.get("csNo"),
    ];
    for (const c of candidates) {
      if (c && /^\d+$/.test(c)) {
        caseNumber = caseNumber || c;
      }
    }
    address =
      decodeURIComponent(
        u.searchParams.get("rnAdrs") ||
          u.searchParams.get("tyaddress") ||
          u.searchParams.get("address") ||
          "",
      ) || address;
  }

  const pathOrAll = u ? `${u.pathname}${u.search}` : normalizedUrl;
  const m = pathOrAll.match(CASE_NO_REGEX);
  if (m) caseNumber = caseNumber || m[1];

  return {
    caseNumber,
    address,
    normalizedUrl: u?.toString() ?? normalizedUrl,
  };
}
