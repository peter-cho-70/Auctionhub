import {
  getCaseMediaBlob,
  putCaseMediaBlob,
} from "@/lib/data/case-media-store";
import {
  CASE_LIST_THUMBNAIL_REF,
  CASE_PDF_COVER_SOURCE_REF,
} from "@/lib/domain/case-list-thumbnail";
import type { CaseListThumbnail, PdfCoverListCrop, PdfCoverSettings } from "@/lib/types/domain";
import { cropImageBlob } from "@/lib/pdf/crop-image-blob";
import { clampPdfCoverListCrop } from "@/lib/pdf/pdf-cover-settings";
import { renderPdfCoverPreview } from "@/lib/pdf/render-pdf-cover-preview";

export async function storePdfCoverSource(args: {
  caseId: string;
  pdf: File | ArrayBuffer | Blob;
  captureWidth: number;
  captureHeight: number;
}): Promise<Blob> {
  const sourceBlob = await renderPdfCoverPreview(args.pdf, {
    width: args.captureWidth,
    height: args.captureHeight,
  });
  await putCaseMediaBlob(
    args.caseId,
    "list-thumbnail",
    CASE_PDF_COVER_SOURCE_REF,
    sourceBlob,
  );
  return sourceBlob;
}

export async function applyPdfCoverListCrop(args: {
  caseId: string;
  listCrop: PdfCoverListCrop;
  captureWidth: number;
  captureHeight: number;
  sourceBlob?: Blob | null;
}): Promise<CaseListThumbnail> {
  const crop = clampPdfCoverListCrop(
    args.listCrop,
    args.captureWidth,
    args.captureHeight,
  );
  const sourceBlob =
    args.sourceBlob ??
    (await getCaseMediaBlob(
      args.caseId,
      "list-thumbnail",
      CASE_PDF_COVER_SOURCE_REF,
    ));
  if (!sourceBlob) {
    throw new Error("표지 원본 이미지가 없습니다. PDF에서 표지를 먼저 생성하세요.");
  }

  const listBlob = await cropImageBlob(sourceBlob, crop);
  const updatedAt = new Date().toISOString();
  await putCaseMediaBlob(
    args.caseId,
    "list-thumbnail",
    CASE_LIST_THUMBNAIL_REF,
    listBlob,
  );
  return { mimeType: "image/jpeg", updatedAt };
}

export async function savePdfCoverAsListThumbnail(args: {
  caseId: string;
  pdf: File | ArrayBuffer | Blob;
  settings: PdfCoverSettings;
}): Promise<CaseListThumbnail> {
  const { captureWidth, captureHeight, listCrop } = args.settings;
  const sourceBlob = await storePdfCoverSource({
    caseId: args.caseId,
    pdf: args.pdf,
    captureWidth,
    captureHeight,
  });
  return applyPdfCoverListCrop({
    caseId: args.caseId,
    listCrop,
    captureWidth,
    captureHeight,
    sourceBlob,
  });
}

/** 저장된 원본 캡처에서 목록 썸네일만 다시 크롭 */
export async function reapplyPdfCoverListCrop(args: {
  caseId: string;
  settings: PdfCoverSettings;
}): Promise<CaseListThumbnail | null> {
  try {
    return await applyPdfCoverListCrop({
      caseId: args.caseId,
      listCrop: args.settings.listCrop,
      captureWidth: args.settings.captureWidth,
      captureHeight: args.settings.captureHeight,
    });
  } catch {
    return null;
  }
}
