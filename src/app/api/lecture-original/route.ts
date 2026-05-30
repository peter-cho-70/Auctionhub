import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { LECTURE_ORIGINAL_FILE_NAMES } from "@/lib/data/lecture-sources";

export const runtime = "nodejs";

const ORIGINALS_DIR = path.join(
  process.cwd(),
  "public",
  "lectures",
  "originals",
);

const FILE_PATHS = new Map<string, string>(
  LECTURE_ORIGINAL_FILE_NAMES.map((fileName) => [
    fileName,
    path.join(ORIGINALS_DIR, fileName),
  ]),
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("file");
  const filePath = fileName ? FILE_PATHS.get(fileName) : null;

  if (!fileName || !filePath) {
    return NextResponse.json(
      { ok: false, error: "등록된 강의 원본 파일이 아닙니다." },
      { status: 404 },
    );
  }

  try {
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error:
          msg.includes("ENOENT")
            ? "강의 원본 파일이 서버에 없습니다. 배포에 public/lectures/originals/ 파일이 포함되어 있는지 확인하세요."
            : msg || "강의 원본 파일을 불러오지 못했습니다.",
      },
      { status: msg.includes("ENOENT") ? 404 : 500 },
    );
  }
}
