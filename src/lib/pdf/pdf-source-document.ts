import type {
  CaseSourceDocument,
  CaseSourceDocumentKind,
} from "@/lib/types/domain";
import { SPEED_AUCTION_PDF_PARSER_VERSION } from "@/lib/pdf/speed-auction-structured";
import type { PdfImportMeta } from "@/lib/pdf/speed-auction-structured";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `srcdoc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildPdfSourceDocument(args: {
  meta: PdfImportMeta;
  rawText: string;
  structuredJson: unknown;
  kind?: CaseSourceDocumentKind;
  storedFileName?: string | null;
  pdfBlobRef?: string | null;
  originalFileName?: string | null;
}): CaseSourceDocument {
  const kind = args.kind ?? "daejangauction-pdf";
  return {
    id: newId(),
    kind,
    fileName: args.storedFileName ?? args.meta.fileName,
    originalFileName: args.originalFileName ?? args.meta.fileName,
    fileSize: args.meta.fileSize,
    pageCount: args.meta.pageCount,
    storedFileName: args.storedFileName ?? null,
    pdfBlobRef: args.pdfBlobRef ?? null,
    extractedText: args.rawText,
    structuredJson: args.structuredJson,
    parserVersion: SPEED_AUCTION_PDF_PARSER_VERSION,
    importedAt: new Date().toISOString(),
  };
}
