"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CaseAddressMeta } from "@/lib/types/domain";
import { eumDetailUrl } from "@/lib/address/pnu";
import { coordsFromJusoEnt } from "@/lib/map/coords-from-meta";
import {
  kakaoMapSearchUrl,
  molitGisUrl,
  naverLandSearchUrl,
  naverMapSearchUrl,
  preferLandSearchAddress,
} from "@/lib/map/external-links";

/** 지도 탭 로딩 후 부동산 탭 열기 (ms) */
const LAND_OPEN_DELAY_MS = 3200;

type Props = {
  address: string;
  addressMeta?: CaseAddressMeta | null;
  /** 주변 시세 조회로 저장된 좌표 */
  mapLat?: number | null;
  mapLng?: number | null;
};

type Coords = { lat: number; lng: number };

const linkClass =
  "rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900 disabled:opacity-50";

export function ExternalMapLinks({
  address,
  addressMeta,
  mapLat,
  mapLng,
}: Props) {
  const trimmed = address.trim();
  const landQuery = preferLandSearchAddress(trimmed, addressMeta);
  const disabled = !trimmed;
  const jusoCoords = useMemo(
    () => coordsFromJusoEnt(addressMeta?.entX, addressMeta?.entY),
    [addressMeta?.entX, addressMeta?.entY],
  );

  const [coords, setCoords] = useState<Coords | null>(() => {
    if (mapLat != null && mapLng != null) return { lat: mapLat, lng: mapLng };
    return jusoCoords;
  });
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (mapLat != null && mapLng != null) {
      setCoords({ lat: mapLat, lng: mapLng });
      return;
    }
    if (jusoCoords) setCoords(jusoCoords);
  }, [mapLat, mapLng, jusoCoords, trimmed]);

  const resolveCoords = useCallback(async (): Promise<Coords | null> => {
    if (coords) return coords;
    if (jusoCoords) {
      setCoords(jusoCoords);
      setHint(
        `좌표 확인됨 (${jusoCoords.lat.toFixed(5)}, ${jusoCoords.lng.toFixed(5)}) (표준주소 UTM→WGS84)`,
      );
      return jusoCoords;
    }
    if (!landQuery) return null;

    setBusy(true);
    setHint("주소 좌표 확인 중…");
    try {
      const params = new URLSearchParams({ address: landQuery });
      if (addressMeta?.roadAddress?.trim()) {
        params.set("road", addressMeta.roadAddress.trim());
      }
      if (addressMeta?.jibunAddress?.trim()) {
        params.set("jibun", addressMeta.jibunAddress.trim());
      }
      if (addressMeta?.entX?.trim()) params.set("entX", addressMeta.entX.trim());
      if (addressMeta?.entY?.trim()) params.set("entY", addressMeta.entY.trim());

      const res = await fetch(`/api/address/geocode?${params.toString()}`);
      const json = (await res.json()) as
        | { ok: true; lat: number; lng: number; source?: string }
        | { ok: false; error: string };
      if (!json.ok) {
        setHint(json.error || "좌표를 찾지 못했습니다.");
        return null;
      }
      const next = { lat: json.lat, lng: json.lng };
      setCoords(next);
      const via =
        json.source === "juso"
          ? " (행안부)"
          : json.source === "naver"
            ? " (네이버)"
            : "";
      setHint(
        `좌표 확인됨 (${json.lat.toFixed(5)}, ${json.lng.toFixed(5)})${via}`,
      );
      return next;
    } catch (e) {
      setHint(e instanceof Error ? e.message : "좌표 조회 실패");
      return null;
    } finally {
      setBusy(false);
    }
  }, [coords, jusoCoords, landQuery, addressMeta]);

  const openNaverMapAt = useCallback(
    (c: Coords | null) => {
      window.open(
        naverMapSearchUrl(landQuery, c?.lat, c?.lng),
        "_blank",
        "noopener,noreferrer",
      );
    },
    [landQuery],
  );

  const openNaverLandAt = useCallback(
    (c: Coords | null) => {
      window.open(
        naverLandSearchUrl(
          landQuery,
          c?.lat,
          c?.lng,
          addressMeta?.legalDongCode,
        ),
        "_blank",
        "noopener,noreferrer",
      );
    },
    [landQuery, addressMeta?.legalDongCode],
  );

  const openMapThenLand = useCallback(async () => {
    const c = await resolveCoords();
    openNaverMapAt(c);
    if (c) {
      window.setTimeout(() => openNaverLandAt(c), LAND_OPEN_DELAY_MS);
      return;
    }
    window.setTimeout(() => {
      openNaverLandAt(null);
      setHint(
        (prev) =>
          prev ??
          "좌표 없이 주소 검색으로 열었습니다. 정확한 위치는 「표준 주소 검색」 또는 네이버 Client Secret 수정 후 다시 시도하세요.",
      );
    }, LAND_OPEN_DELAY_MS);
  }, [resolveCoords, openNaverMapAt, openNaverLandAt]);

  const lat = coords?.lat ?? mapLat ?? jusoCoords?.lat;
  const lng = coords?.lng ?? mapLng ?? jusoCoords?.lng;

  if (disabled) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        주소를 입력하면 지도·시세 참고 사이트를 바로 열 수 있습니다.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={linkClass}
          disabled={busy}
          onClick={() => {
            void resolveCoords().then((c) => openNaverMapAt(c));
          }}
        >
          네이버 지도
        </button>
        <button
          type="button"
          className={`${linkClass} border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100`}
          disabled={busy}
          onClick={() => void openMapThenLand()}
        >
          {busy ? "좌표 확인…" : "네이버 지도 → 부동산"}
        </button>
        <a
          className={linkClass}
          href={naverLandSearchUrl(
            landQuery,
            lat,
            lng,
            addressMeta?.legalDongCode,
          )}
          target="_blank"
          rel="noreferrer"
        >
          네이버 부동산
        </a>
        <a
          className={linkClass}
          href={kakaoMapSearchUrl(trimmed, lat, lng)}
          target="_blank"
          rel="noreferrer"
        >
          카카오맵
        </a>
        <a
          className={linkClass}
          href={molitGisUrl()}
          target="_blank"
          rel="noreferrer"
        >
          국토부 GIS
        </a>
        {addressMeta?.pnu ? (
          <a
            className={linkClass}
            href={eumDetailUrl(addressMeta.pnu)}
            target="_blank"
            rel="noreferrer"
          >
            토지이음
          </a>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-200">{hint}</p>
      ) : coords || jusoCoords ? (
        <p className="text-[11px] text-neutral-500">
          지도·부동산 링크는 이 물건 위치(위도{" "}
          {(coords ?? jusoCoords)!.lat.toFixed(5)}, 경도{" "}
          {(coords ?? jusoCoords)!.lng.toFixed(5)}) 기준입니다.
        </p>
      ) : (
        <p className="text-[11px] text-neutral-500">
          좌표가 없어도 주소 검색으로 지도·부동산을 엽니다. 「표준 주소 검색」을
          하면 위치가 더 정확해집니다.
        </p>
      )}
    </div>
  );
}
