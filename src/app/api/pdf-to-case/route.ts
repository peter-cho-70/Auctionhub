import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { parseAuctionPdfText } from "@/lib/pdf/auction-pdf-parser";
import { auctionPdfExtractToNewCaseInput } from "@/lib/pdf/pdf-to-newcase";
import { buildAuctionOneStructuredJson } from "@/lib/pdf/auctionone-structured";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "file 필드에 PDF 파일을 넣어주세요." },
        { status: 400 },
      );
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "PDF 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    // `pdf-parse`는 번들러(webpack/rsc) import에서 깨질 수 있어,
    // Node의 require 경로로 로드합니다.
    const require = createRequire(import.meta.url);
    const { PDFParse } = require("pdf-parse") as {
      PDFParse: new (args: { data: Buffer }) => {
        getText: () => Promise<{ text?: string; pages?: unknown[] }>;
        destroy: () => Promise<void>;
      };
    };

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    const text = await parser.getText();
    await parser.destroy().catch(() => {});

    const rawText = String(text.text ?? "");
    const pageCount = Array.isArray(text.pages) ? text.pages.length : null;
    const extracted = parseAuctionPdfText(rawText);
    const meta = {
      fileName: file.name,
      fileSize: file.size,
      pageCount,
    };
    const structuredJson = buildAuctionOneStructuredJson({
      extracted,
      rawText,
      meta,
    });
    const sourceUrl = `pdf-import:${file.name}`.trim();

    const mapped = auctionPdfExtractToNewCaseInput({
      extracted,
      sourceUrl,
    });

    return NextResponse.json({
      ok: true,
      meta,
      extracted,
      structuredJson,
      newCaseInput: mapped.input,
      warnings: mapped.warnings,
      rawText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: msg || "PDF 파싱에 실패했습니다." },
      { status: 500 },
    );
  }
}

