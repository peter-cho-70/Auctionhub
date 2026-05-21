/** 서버 전용 — 주소 → WGS84 좌표 (행안부 entX/Y 우선, 네이버 Geocoding) */

import type { CaseAddressMeta } from "@/lib/types/domain";
import { coordsFromJusoEnt } from "@/lib/map/coords-from-meta";

export type GeocodeSource = "naver" | "juso";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; source: GeocodeSource }
  | {
      ok: false;
      reason: "empty_address" | "missing_keys" | "auth" | "no_result";
      message: string;
      httpStatus?: number;
    };

function numberFromText(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function naverGeocodeKeys(): { keyId: string; key: string } | null {
  const keyId =
    process.env.NAVER_MAP_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID?.trim() ||
    "";
  const key = process.env.NAVER_MAP_CLIENT_SECRET?.trim() || "";
  if (!keyId || !key) return null;
  return { keyId, key };
}

/** Geocoding에 넣을 주소 후보 (앞쪽부터 시도) */
export function buildGeocodeCandidates(
  address: string,
  meta?: Pick<
    CaseAddressMeta,
    | "roadAddress"
    | "jibunAddress"
    | "siNm"
    | "sggNm"
    | "emdNm"
    | "bonbun"
    | "bubun"
  > | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    const t = value?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  add(meta?.roadAddress);
  add(meta?.jibunAddress);
  add(address.trim());

  if (meta) {
    const lot =
      meta.bonbun != null
        ? `${meta.bonbun}${meta.bubun ? `-${meta.bubun}` : ""}`
        : "";
    add(
      [meta.siNm, meta.sggNm, meta.emdNm, lot].filter(Boolean).join(" ").trim(),
    );
    add([meta.siNm, meta.sggNm, meta.emdNm].filter(Boolean).join(" ").trim());
  }

  return out;
}

export { coordsFromJusoEnt } from "@/lib/map/coords-from-meta";

async function naverGeocodeOne(
  query: string,
  keys: { keyId: string; key: string },
): Promise<
  | { ok: true; lat: number; lng: number }
  | { ok: false; authFailed: boolean; httpStatus: number }
> {
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": keys.keyId,
      "x-ncp-apigw-api-key": keys.key,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      authFailed: response.status === 401 || response.status === 403,
      httpStatus: response.status,
    };
  }

  const json = (await response.json().catch(() => null)) as
    | { addresses?: Array<{ x?: string; y?: string }> }
    | null;
  const first = json?.addresses?.[0];
  const lat = numberFromText(first?.y);
  const lng = numberFromText(first?.x);
  if (lat != null && lng != null) return { ok: true, lat, lng };
  return { ok: false, authFailed: false, httpStatus: 200 };
}

export async function resolveGeocode(
  address: string,
  meta?: CaseAddressMeta | null,
): Promise<GeocodeResult> {
  const candidates = buildGeocodeCandidates(address, meta);
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "empty_address",
      message: "주소가 비어 있습니다.",
    };
  }

  const juso = coordsFromJusoEnt(meta?.entX, meta?.entY);
  if (juso) {
    return { ok: true, ...juso, source: "juso" };
  }

  const keys = naverGeocodeKeys();
  if (!keys) {
    return {
      ok: false,
      reason: "missing_keys",
      message:
        ".env.local에 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID와 NAVER_MAP_CLIENT_SECRET을 설정하세요.",
    };
  }

  let lastAuth = false;
  let lastStatus = 0;

  for (const query of candidates) {
    const hit = await naverGeocodeOne(query, keys);
    if (hit.ok) {
      return { ok: true, lat: hit.lat, lng: hit.lng, source: "naver" };
    }
    if (hit.authFailed) {
      lastAuth = true;
      lastStatus = hit.httpStatus;
      break;
    }
  }

  if (lastAuth) {
    const secretLen = process.env.NAVER_MAP_CLIENT_SECRET?.trim().length ?? 0;
    const secretHint =
      secretLen > 0 && secretLen < 20
        ? ` (현재 Secret ${secretLen}자 — 콘솔에서 전체 값을 다시 복사하세요)`
        : "";
    return {
      ok: false,
      reason: "auth",
      httpStatus: lastStatus,
      message: `네이버 Geocoding 인증 실패(401)입니다. Application Client Secret 전체·Geocoding API 사용을 확인하세요.${secretHint} 「표준 주소 검색」을 하면 네이버 없이도 좌표를 쓸 수 있습니다.`,
    };
  }

  return {
    ok: false,
    reason: "no_result",
    message:
      "입력 주소로 좌표를 찾지 못했습니다. 「표준 주소 검색」으로 도로명·지번을 확정한 뒤 다시 시도하세요.",
  };
}

/** 기존 호출부 호환 — 실패 시 null */
export async function geocodeAddress(
  address: string,
  meta?: CaseAddressMeta | null,
): Promise<{ lat: number; lng: number } | null> {
  const result = await resolveGeocode(address, meta);
  return result.ok ? { lat: result.lat, lng: result.lng } : null;
}
