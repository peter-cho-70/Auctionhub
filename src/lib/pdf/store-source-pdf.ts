import {
  deleteCaseMedia,
  getCaseMediaBlob,
  putCaseMediaBlob,
} from "@/lib/data/case-media-store";
import type { CaseSourceDocumentKind } from "@/lib/types/domain";
import {
  buildStoredPdfRefPath,
  normalizeCaseNumber,
} from "@/lib/pdf/stored-pdf-name";

const SOURCE_PDF_KIND = "source-document" as const;

export async function storeSourcePdfFile(args: {
  caseId: string;
  caseNumber: string;
  kind: CaseSourceDocumentKind;
  file: File | Blob;
}): Promise<{ pdfBlobRef: string; storedFileName: string }> {
  const cn = normalizeCaseNumber(args.caseNumber);
  if (!cn) {
    throw new Error("사건번호가 없어 원본 PDF를 저장할 수 없습니다.");
  }
  const pdfBlobRef = buildStoredPdfRefPath(cn, args.kind);
  const storedFileName = pdfBlobRef.split("/").pop() ?? pdfBlobRef;
  const blob =
    args.file instanceof File
      ? args.file
      : new Blob([args.file], { type: "application/pdf" });

  await putCaseMediaBlob(args.caseId, SOURCE_PDF_KIND, pdfBlobRef, blob);
  return { pdfBlobRef, storedFileName };
}

export async function getSourcePdfBlob(
  caseId: string,
  pdfBlobRef: string,
): Promise<Blob | null> {
  return getCaseMediaBlob(caseId, SOURCE_PDF_KIND, pdfBlobRef);
}

export async function deleteSourcePdfBlob(
  caseId: string,
  pdfBlobRef: string,
): Promise<void> {
  try {
    await deleteCaseMedia(caseId, SOURCE_PDF_KIND, pdfBlobRef);
  } catch {
    /* ignore */
  }
}

export async function deleteAllSourcePdfBlobsForCase(
  caseId: string,
  documents: Array<{ pdfBlobRef?: string | null }>,
): Promise<void> {
  const refs = new Set(
    documents
      .map((d) => d.pdfBlobRef?.trim())
      .filter((r): r is string => Boolean(r)),
  );
  await Promise.all(
    [...refs].map((ref) => deleteSourcePdfBlob(caseId, ref)),
  );
}

export function downloadBlobAsFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openSourcePdfInNewTab(
  caseId: string,
  pdfBlobRef: string,
): Promise<boolean> {
  const blob = await getSourcePdfBlob(caseId, pdfBlobRef);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
