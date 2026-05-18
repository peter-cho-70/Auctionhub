import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PUBLIC_ORIGINALS_DIR = path.join(
  process.cwd(),
  "public",
  "lectures",
  "originals",
);

const EXTERNAL_ORIGINALS_DIR =
  "/Users/ubsob/Documents/경매자료/강의 내용 정리";

const PUBLIC_FILE_NAMES = [
  "곰물주_경매_강의노트_정리본.docx",
  "경매기초_1교시_정리본.docx",
  "경매기초_2교시_정리본.docx",
  "대출1강_1교시_정리본.docx",
  "대출1강_2교시_정리본.docx",
  "명도_실무_매뉴얼_상세.docx",
  "명도1강_1교시_정리본.docx",
  "명도1강_2교시_정리본.docx",
  "명도1강_3교시_정리본.docx",
] as const;

const EXTERNAL_FILE_NAMES = [
  "곰물주_경매기초_1교시_강의정리.docx",
  "곰물주_경매기초_2교시_강의정리.docx",
  "곰물주_대출2_1교시_강의정리.docx",
  "곰물주_대출2_2교시_강의정리.docx",
  "곰물주_좋은물건_1차_강의정리.docx",
  "곰물주_좋은물건2_1강_강의정리.docx",
  "곰물주_좋은물건2_2강_강의정리.docx",
  "곰물주_좋은물건2_3강_강의정리.docx",
] as const;

const FILE_PATHS = new Map<string, string>([
  ...PUBLIC_FILE_NAMES.map((fileName) => [
    fileName,
    path.join(PUBLIC_ORIGINALS_DIR, fileName),
  ] as const),
  ...EXTERNAL_FILE_NAMES.map((fileName) => [
    fileName,
    path.join(EXTERNAL_ORIGINALS_DIR, fileName),
  ] as const),
]);

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
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg || "강의 원본 파일을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
