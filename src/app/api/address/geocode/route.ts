import { NextResponse } from "next/server";
import { normalizeCaseAddressMeta } from "@/lib/address/normalize";
import { emptyCaseAddressMeta } from "@/lib/types/domain";
import { resolveGeocode } from "@/lib/map/geocode-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  const road = url.searchParams.get("road")?.trim() || null;
  const jibun = url.searchParams.get("jibun")?.trim() || null;
  const entX = url.searchParams.get("entX")?.trim() || null;
  const entY = url.searchParams.get("entY")?.trim() || null;

  if (!address && !road && !jibun) {
    return NextResponse.json(
      { ok: false, error: "주소가 필요합니다." },
      { status: 400 },
    );
  }

  const meta =
    normalizeCaseAddressMeta({
      roadAddress: road,
      jibunAddress: jibun,
      entX,
      entY,
      resolvedAt: road || jibun || entX || entY ? new Date().toISOString() : null,
    }) ??
    (entX || entY
      ? {
          ...emptyCaseAddressMeta(),
          roadAddress: road,
          jibunAddress: jibun,
          entX,
          entY,
          resolvedAt: new Date().toISOString(),
        }
      : null);

  const result = await resolveGeocode(address || road || jibun || "", meta);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message, reason: result.reason });
  }

  return NextResponse.json({
    ok: true,
    lat: result.lat,
    lng: result.lng,
    source: result.source,
  });
}
