import type { PdfCoverListCrop, PdfCoverSettings } from "@/lib/types/domain";

/** 캡처 이미지 왼쪽 하단 1/4 영역 (가로·세로 각 절반) */
export function bottomLeftQuarterCrop(
  captureWidth: number,
  captureHeight: number,
): PdfCoverListCrop {
  const width = Math.floor(captureWidth / 2);
  const height = Math.floor(captureHeight / 2);
  return {
    x: 0,
    y: captureHeight - height,
    width,
    height,
  };
}

/** 1/4 영역의 2배 크기, 왼쪽 상단(0,0) 고정 */
export function topLeftDoubleQuarterCrop(
  captureWidth: number,
  captureHeight: number,
): PdfCoverListCrop {
  const quarterWidth = Math.floor(captureWidth / 2);
  const quarterHeight = Math.floor(captureHeight / 2);
  return {
    x: 0,
    y: 0,
    width: Math.min(captureWidth, quarterWidth * 2),
    height: Math.min(captureHeight, quarterHeight * 2),
  };
}

export const DEFAULT_PDF_COVER_SETTINGS: PdfCoverSettings = {
  captureWidth: 1024,
  captureHeight: 640,
  listCrop: topLeftDoubleQuarterCrop(1024, 640),
};

const LEGACY_LIST_CROPS: PdfCoverListCrop[] = [
  { x: 0, y: 0, width: 520, height: 520 },
  { x: 30, y: 70, width: 500, height: 300 },
  { x: 0, y: 320, width: 512, height: 320 },
];

function isLegacyListCrop(crop: PdfCoverListCrop): boolean {
  return LEGACY_LIST_CROPS.some(
    (legacy) =>
      crop.x === legacy.x &&
      crop.y === legacy.y &&
      crop.width === legacy.width &&
      crop.height === legacy.height,
  );
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.round(Math.min(max, Math.max(min, raw)));
}

function normalizeListCrop(
  raw: unknown,
  captureWidth: number,
  captureHeight: number,
): PdfCoverListCrop {
  const fallback = DEFAULT_PDF_COVER_SETTINGS.listCrop;
  if (!raw || typeof raw !== "object") return { ...fallback };
  const o = raw as Record<string, unknown>;
  const width = clampInt(o.width, fallback.width, 1, captureWidth);
  const height = clampInt(o.height, fallback.height, 1, captureHeight);
  const maxX = Math.max(0, captureWidth - width);
  const maxY = Math.max(0, captureHeight - height);
  return {
    x: clampInt(o.x, fallback.x, 0, maxX),
    y: clampInt(o.y, fallback.y, 0, maxY),
    width,
    height,
  };
}

export function normalizePdfCoverSettings(raw: unknown): PdfCoverSettings {
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_PDF_COVER_SETTINGS);
  }
  const o = raw as Record<string, unknown>;
  const captureWidth = clampInt(
    o.captureWidth,
    DEFAULT_PDF_COVER_SETTINGS.captureWidth,
    320,
    4096,
  );
  const captureHeight = clampInt(
    o.captureHeight,
    DEFAULT_PDF_COVER_SETTINGS.captureHeight,
    200,
    4096,
  );
  const result = {
    captureWidth,
    captureHeight,
    listCrop: normalizeListCrop(o.listCrop, captureWidth, captureHeight),
  };
  if (isLegacyListCrop(result.listCrop)) {
    return {
      ...result,
      listCrop: topLeftDoubleQuarterCrop(captureWidth, captureHeight),
    };
  }
  return result;
}

/** 캡처 이미지 범위 안으로 크롭 좌표를 맞춥니다. */
export function clampPdfCoverListCrop(
  crop: PdfCoverListCrop,
  captureWidth: number,
  captureHeight: number,
): PdfCoverListCrop {
  return normalizeListCrop(crop, captureWidth, captureHeight);
}
