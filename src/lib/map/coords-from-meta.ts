/** 클라이언트·서버 공용 — addressMeta 좌표 (행안부 UTM-K → WGS84) */

import proj4 from "proj4";

/** 도로명주소 API entX/entY — EPSG:5179 (UTM-K GRS80) */
const EPSG5179 =
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";

export function numberFromCoordText(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isKoreaWgs84(lat: number, lng: number): boolean {
  return lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
}

/** 법정동코드 10자리 → 네이버 부동산 cortarNo */
export function naverLandCortarNo(
  legalDongCode: string | null | undefined,
): string | null {
  const code = legalDongCode?.replace(/\D/g, "").slice(0, 10) ?? "";
  return code.length === 10 ? code : null;
}

/**
 * 행안부 entX/entY → WGS84
 * - 미터 단위(UTM-K)이면 EPSG5179 변환
 * - 이미 경위도(124~132, 33~39)이면 entX=경도, entY=위도로 사용
 */
export function coordsFromJusoEnt(
  entX: string | null | undefined,
  entY: string | null | undefined,
): { lat: number; lng: number } | null {
  const x = numberFromCoordText(entX);
  const y = numberFromCoordText(entY);
  if (x == null || y == null) return null;

  if (isKoreaWgs84(y, x)) {
    return { lat: y, lng: x };
  }

  if (x > 200_000 && x < 1_200_000 && y > 1_500_000 && y < 2_300_000) {
    const [lng, lat] = proj4(EPSG5179, "WGS84", [x, y]) as [number, number];
    if (isKoreaWgs84(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}
