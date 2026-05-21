/** 외부 지도·부동산 사이트 링크 */

import { naverLandCortarNo } from "@/lib/map/coords-from-meta";

function hasCoords(
  lat?: number | null,
  lng?: number | null,
): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

/** 네이버 지도 — 좌표 있으면 해당 위치 중심 + 검색 */
export function naverMapSearchUrl(
  address: string,
  lat?: number | null,
  lng?: number | null,
): string {
  const q = encodeURIComponent(address.trim());
  if (hasCoords(lat, lng)) {
    return `https://map.naver.com/v5/search/${q}?c=${lng},${lat},16,0,0,0,dh`;
  }
  return `https://map.naver.com/p/search/${q}`;
}

export function kakaoMapSearchUrl(
  address: string,
  lat?: number | null,
  lng?: number | null,
): string {
  const trimmed = address.trim();
  if (hasCoords(lat, lng)) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(trimmed)},${lat},${lng}`;
  }
  return `https://map.kakao.com/?q=${encodeURIComponent(trimmed)}`;
}

/** 네이버 부동산 검색·지도용 주소 (도로명 → 지번 → 입력값) */
export function preferLandSearchAddress(
  address: string,
  meta?: {
    roadAddress?: string | null;
    jibunAddress?: string | null;
  } | null,
): string {
  return (
    meta?.roadAddress?.trim() ||
    meta?.jibunAddress?.trim() ||
    address.trim()
  );
}

/** 네이버 부동산 — 다가구 조사용 원룸·투룸 + 다가구, 좌표·법정동 중심 */
export function naverLandSearchUrl(
  address: string,
  lat?: number | null,
  lng?: number | null,
  legalDongCode?: string | null,
): string {
  const propertyFilter = "OR:YR:DDDGG";
  const cortar = naverLandCortarNo(legalDongCode);
  const params = new URLSearchParams({ a: propertyFilter });

  if (cortar) params.set("cortarNo", cortar);

  if (hasCoords(lat, lng)) {
    params.set("ms", `${lat},${lng},18`);
    return `https://new.land.naver.com/rooms?${params.toString()}`;
  }

  const q = address.trim();
  if (q) params.set("query", q);
  params.set("ms", "37.5665,126.9780,12");
  return `https://new.land.naver.com/rooms?${params.toString()}`;
}

/** 단독·다가구 실거래 GIS */
export function molitGisUrl(): string {
  return "https://rt.molit.go.kr/pt/gis/gis.do?srhThingSecd=C&mobileAt=";
}
