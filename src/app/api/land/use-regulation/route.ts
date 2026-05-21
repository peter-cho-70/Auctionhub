import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_URL =
  "https://apis.data.go.kr/1613000/ArLandUseInfoService/getArLandUseInfo";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  const serviceKey =
    process.env.DATA_GO_KR_SERVICE_KEY?.trim() ||
    process.env.MOLIT_API_KEY?.trim();
  if (!serviceKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "DATA_GO_KR_SERVICE_KEY 또는 MOLIT_API_KEY가 필요합니다. (공공데이터포털 토지이용규제 활용신청)",
      },
      { status: 500 },
    );
  }

  const pnu = text(new URL(req.url).searchParams.get("pnu")).replace(/\D/g, "");
  if (pnu.length !== 19) {
    return NextResponse.json(
      { ok: false, error: "PNU 19자리가 필요합니다. 표준 주소 검색 후 조회하세요." },
      { status: 400 },
    );
  }

  const keyParam = serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
  const params = new URLSearchParams({
    serviceKey: keyParam,
    pnu,
    pageNo: "1",
    numOfRows: "20",
    format: "json",
  });

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !json) {
      return NextResponse.json(
        { ok: false, error: `토지이용규제 API 호출 실패(${response.status})` },
        { status: 502 },
      );
    }

    const landUses = extractLandUses(json);
    return NextResponse.json({ ok: true, pnu, landUses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg || "토지이용규제 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

function extractLandUses(json: Record<string, unknown>): string[] {
  const response = json.response as Record<string, unknown> | undefined;
  const body = response?.body as Record<string, unknown> | undefined;
  const items = body?.items as Record<string, unknown> | undefined;
  const item = items?.item;
  const rows = Array.isArray(item) ? item : item ? [item] : [];
  const labels: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const parts = [
      text(r.prposAreaDstrcCodeNm ?? r.용도지역),
      text(r.prposDstrcCodeNm ?? r.용도지구),
      text(r.ladUseSittnNm ?? r.토지이용상황),
      text(r.cnflcAtNm),
    ].filter(Boolean);
    if (parts.length) labels.push(parts.join(" · "));
  }
  return [...new Set(labels)];
}
