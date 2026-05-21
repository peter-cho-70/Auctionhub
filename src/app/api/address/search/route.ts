import { NextResponse } from "next/server";
import type { JusoApiRow } from "@/lib/address/normalize";

export const runtime = "nodejs";

const JUSO_API_URL = "https://business.juso.go.kr/addrlink/addrLinkApi.do";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  const confmKey = process.env.JUSO_CONF_KEY?.trim();
  if (!confmKey) {
    return NextResponse.json(
      { ok: false, error: "JUSO_CONF_KEY가 .env.local에 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const keyword = text(searchParams.get("keyword"));
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const countPerPage = Math.min(
    20,
    Math.max(1, Number(searchParams.get("count") ?? "10") || 10),
  );

  if (keyword.length < 2) {
    return NextResponse.json(
      { ok: false, error: "검색어를 2글자 이상 입력하세요." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    confmKey,
    currentPage: String(currentPage),
    countPerPage: String(countPerPage),
    keyword,
    resultType: "json",
    hstryYn: "N",
    firstSort: "none",
    addInfoYn: "Y",
  });

  try {
    const response = await fetch(`${JUSO_API_URL}?${params.toString()}`, {
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as {
      results?: {
        common?: { errorCode?: string; errorMessage?: string; totalCount?: string };
        juso?: JusoApiRow[];
      };
    } | null;

    const common = json?.results?.common;
    const errorCode = text(common?.errorCode);
    if (errorCode && errorCode !== "0") {
      return NextResponse.json({
        ok: false,
        error: text(common?.errorMessage) || `주소 API 오류(${errorCode})`,
      });
    }

    const rows = Array.isArray(json?.results?.juso) ? json!.results!.juso! : [];
    return NextResponse.json({
      ok: true,
      totalCount: Number(common?.totalCount ?? rows.length) || rows.length,
      currentPage,
      items: rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg || "주소 검색에 실패했습니다." },
      { status: 500 },
    );
  }
}
