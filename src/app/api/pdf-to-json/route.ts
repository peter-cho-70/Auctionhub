import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { parseAuctionPdfByKind } from "@/lib/pdf/auction-pdf-parser";
import { buildStructuredJsonForDocument } from "@/lib/pdf/auctionone-structured";
import type { CaseSourceDocumentKind } from "@/lib/types/domain";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = normalizeKind(form.get("kind"));
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
    const extracted = parseAuctionPdfByKind(rawText, kind);
    const meta = {
      fileName: file.name,
      fileSize: file.size,
      pageCount,
    };
    const structuredJson = buildStructuredJsonForDocument({
      kind,
      extracted,
      rawText,
      meta,
    });

    return NextResponse.json({
      ok: true,
      meta,
      extracted,
      structuredJson,
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

function normalizeKind(raw: FormDataEntryValue | null): CaseSourceDocumentKind {
  return raw === "daejangauction-pdf" ||
    raw === "speedauction-pdf" ||
    raw === "auctionone-pdf" ||
    raw === "registry-building" ||
    raw === "registry-land" ||
    raw === "building-ledger" ||
    raw === "appraisal-report" ||
    raw === "tenant-report" ||
    raw === "expected-dividend" ||
    raw === "pdf"
    ? raw
    : "daejangauction-pdf";
}

