"use client";

import type { PdfCoverListCrop } from "@/lib/types/domain";
import { clampPdfCoverListCrop } from "@/lib/pdf/pdf-cover-settings";

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    img.src = url;
  });
}

/** 소스 이미지에서 고정 영역을 잘라 JPEG Blob으로 반환 */
export async function cropImageBlob(
  source: Blob,
  crop: PdfCoverListCrop,
  opts?: { quality?: number },
): Promise<Blob> {
  const img = await loadImageFromBlob(source);
  const safe = clampPdfCoverListCrop(
    crop,
    img.naturalWidth,
    img.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = safe.width;
  canvas.height = safe.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 사용할 수 없습니다.");

  ctx.drawImage(
    img,
    safe.x,
    safe.y,
    safe.width,
    safe.height,
    0,
    0,
    safe.width,
    safe.height,
  );

  const quality = opts?.quality ?? 0.88;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("크롭 이미지 생성에 실패했습니다.")),
      "image/jpeg",
      quality,
    );
  });
}
