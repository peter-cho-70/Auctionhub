"use client";

import { useEffect, useRef, useState } from "react";
import type { ComparableTier } from "@/lib/domain/auction-bid-analysis";
import { naverMapSearchUrl } from "@/lib/map/external-links";

export type AuctionBidMapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  kind: "anchor" | "subject" | "comparable";
  tier?: ComparableTier;
};

type NaverMapsRuntime = {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    LatLngBounds: new () => {
      extend: (ll: NaverLatLng) => void;
      isEmpty: () => boolean;
    };
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => NaverMap;
    Marker: new (options: Record<string, unknown>) => unknown;
    Circle: new (options: Record<string, unknown>) => unknown;
    Event: {
      addListener: (
        target: NaverMap,
        event: string,
        handler: (e: { coord: NaverLatLng }) => void,
      ) => void;
    };
    Point: new (x: number, y: number) => unknown;
  };
};

type NaverLatLng = { lat: () => number; lng: () => number };
type NaverMap = {
  setCenter: (ll: NaverLatLng) => void;
  setZoom: (z: number) => void;
  fitBounds: (b: unknown, opts?: Record<string, unknown>) => void;
};

const TIER_COLOR: Record<ComparableTier, string> = {
  core: "#059669",
  reference: "#d97706",
  excluded: "#9ca3af",
};

function markerColor(m: AuctionBidMapMarker): string {
  if (m.kind === "anchor") return "#2563eb";
  if (m.kind === "subject") return "#dc2626";
  return TIER_COLOR[m.tier ?? "reference"];
}

function markerHtml(m: AuctionBidMapMarker): string {
  const color = markerColor(m);
  const label =
    m.kind === "anchor" ? "기준" : m.kind === "subject" ? "물건" : "사례";
  return `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
    <div style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)">${label}</div>
    <div style="width:10px;height:10px;background:${color};border:2px solid #fff;border-radius:50%;margin-top:2px;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>
  </div>`;
}

function loadNaverMapsScript(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { naver?: NaverMapsRuntime };
    if (w.naver?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-naver-map='true']",
    );
    if (existing) {
      if (w.naver?.maps) resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.dataset.naverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("naver maps script failed"));
    document.head.appendChild(script);
  });
}

type Props = {
  address: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number;
  markers: AuctionBidMapMarker[];
  pickAnchorEnabled?: boolean;
  onPickAnchor?: (lat: number, lng: number) => void;
};

export function AuctionBidMap({
  address,
  centerLat,
  centerLng,
  radiusM,
  markers,
  pickAnchorEnabled = false,
  onPickAnchor,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMap | null>(null);
  const [mapState, setMapState] = useState<
    "loading" | "ready" | "missing-key" | "failed" | "no-center"
  >("loading");

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const hasCenter = centerLat != null && centerLng != null;

  useEffect(() => {
    if (!clientId) {
      setMapState("missing-key");
      return;
    }
    if (!hasCenter || !mapRef.current) {
      setMapState("no-center");
      mapInstanceRef.current = null;
      return;
    }

    let cancelled = false;
    setMapState("loading");

    void loadNaverMapsScript(clientId)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const naver = (window as unknown as { naver?: NaverMapsRuntime })
          .naver;
        if (!naver?.maps) {
          setMapState("failed");
          return;
        }

        const center = new naver.maps.LatLng(centerLat!, centerLng!);
        const map = new naver.maps.Map(mapRef.current, {
          center,
          zoom: 15,
        });
        mapInstanceRef.current = map;

        new naver.maps.Circle({
          map,
          center,
          radius: radiusM,
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          strokeColor: "#2563eb",
          strokeOpacity: 0.45,
          strokeWeight: 2,
        });

        const bounds = new naver.maps.LatLngBounds();
        bounds.extend(center);

        for (const m of markers) {
          const pos = new naver.maps.LatLng(m.lat, m.lng);
          bounds.extend(pos);
          new naver.maps.Marker({
            position: pos,
            map,
            title: m.title,
            icon: {
              content: markerHtml(m),
              anchor: new naver.maps.Point(14, 28),
            },
          });
        }

        if (!bounds.isEmpty()) {
          try {
            map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
          } catch {
            map.setCenter(center);
            map.setZoom(15);
          }
        }

        if (pickAnchorEnabled && onPickAnchor) {
          naver.maps.Event.addListener(map, "click", (e) => {
            onPickAnchor(e.coord.lat(), e.coord.lng());
          });
        }

        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapState("failed");
      });

    return () => {
      cancelled = true;
      mapInstanceRef.current = null;
      if (mapRef.current) mapRef.current.innerHTML = "";
    };
  }, [
    clientId,
    centerLat,
    centerLng,
    hasCenter,
    radiusM,
    markers,
    pickAnchorEnabled,
    onPickAnchor,
  ]);

  const comparableCount = markers.filter((m) => m.kind === "comparable").length;

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">매각 사례 지도</p>
        {hasCenter && (
          <a
            href={naverMapSearchUrl(address, centerLat, centerLng)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-sky-700 underline dark:text-sky-300"
          >
            네이버 지도에서 열기
          </a>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-500">
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-[#2563eb]" />{" "}
          비교 기준점
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-[#dc2626]" /> 이
          물건
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-[#059669]" />{" "}
          핵심 사례
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-[#d97706]" />{" "}
          참고 사례
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-[#9ca3af]" />{" "}
          제외
        </li>
      </ul>

      {pickAnchorEnabled && hasCenter && (
        <p className="mt-1 text-[10px] text-neutral-500">
          지도를 클릭하면 비교 기준점(파란 원 중심)을 옮길 수 있습니다.
        </p>
      )}

      <div
        ref={mapRef}
        className="mt-3 h-80 rounded-lg bg-neutral-100 dark:bg-neutral-900"
      >
        {mapState === "missing-key" && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">
            NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 없어 내부 지도를 쓸 수 없습니다.
          </div>
        )}
        {mapState === "no-center" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-neutral-500">
            <p>비교 기준 좌표가 없습니다.</p>
            <p className="text-xs">
              「주소/시세 좌표로」 또는 사례 「주소→좌표 일괄」 후 다시
              확인하세요.
            </p>
          </div>
        )}
        {mapState === "failed" && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-600">
            네이버 지도를 불러오지 못했습니다. API 키와 도메인을 확인하세요.
          </div>
        )}
        {mapState === "loading" && hasCenter && clientId && (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            지도 로딩…
          </div>
        )}
      </div>

      {hasCenter && (
        <p className="mt-2 text-[10px] text-neutral-500">
          반경 {radiusM}m · 핀 {comparableCount}건
          {comparableCount === 0
            ? " — 좌표 있는 사례가 없으면 1단계에서 지오코딩하세요."
            : ""}
        </p>
      )}
    </div>
  );
}
