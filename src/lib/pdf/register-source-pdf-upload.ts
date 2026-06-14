import type { CaseSourceDocument, CaseSourceDocumentKind } from "@/lib/types/domain";
import { buildPdfSourceDocument } from "@/lib/pdf/pdf-source-document";
import type { PdfImportMeta } from "@/lib/pdf/speed-auction-structured";
import { storeSourcePdfFile } from "@/lib/pdf/store-source-pdf";
import { resolveCaseNumberForStorage } from "@/lib/pdf/stored-pdf-name";

export async function registerSourcePdfUpload(args: {
  caseId: string;
  caseNumber: string | null | undefined;
  extractedCaseNumber?: string | null;
  kind: CaseSourceDocumentKind;
  file: File;
  meta: PdfImportMeta;
  rawText: string;
  structuredJson: unknown;
}): Promise<CaseSourceDocument> {
  const cn = resolveCaseNumberForStorage(
    args.caseNumber,
    args.extractedCaseNumber,
  );
  if (!cn) {
    throw new Error(
      "사건번호를 먼저 입력하거나 PDF에서 사건번호를 추출해야 원본 PDF를 저장할 수 있습니다.",
    );
  }
  const { pdfBlobRef, storedFileName } = await storeSourcePdfFile({
    caseId: args.caseId,
    caseNumber: cn,
    kind: args.kind,
    file: args.file,
  });
  return buildPdfSourceDocument({
    meta: args.meta,
    rawText: args.rawText,
    structuredJson: args.structuredJson,
    kind: args.kind,
    storedFileName,
    pdfBlobRef,
    originalFileName: args.file.name,
  });
}
