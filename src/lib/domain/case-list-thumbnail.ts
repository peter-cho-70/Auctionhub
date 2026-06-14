import type { CaseListThumbnail } from "@/lib/types/domain";

/** IndexedDB `list-thumbnail` 미디어 ref (물건당 1장) */
export const CASE_LIST_THUMBNAIL_REF = "list-cover";

/** PDF 표지 원본 캡처(1024×640) — 목록 크롭 재적용용 */
export const CASE_PDF_COVER_SOURCE_REF = "pdf-cover-source";

export function emptyCaseListThumbnail(): CaseListThumbnail | null {
  return null;
}

export function normalizeCaseListThumbnail(raw: unknown): CaseListThumbnail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mimeType =
    typeof o.mimeType === "string" && o.mimeType.trim()
      ? o.mimeType.trim()
      : "image/jpeg";
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim()
      ? o.updatedAt.trim()
      : new Date().toISOString();
  return { mimeType, updatedAt };
}
