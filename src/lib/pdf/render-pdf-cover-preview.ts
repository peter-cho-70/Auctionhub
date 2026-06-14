"use client";

export const PDF_COVER_WIDTH = 1024;
export const PDF_COVER_HEIGHT = 640;

const PDFJS_PUBLIC_MODULE = "/pdf.mjs";
const PDFJS_PUBLIC_WORKER = "/pdf.worker.min.mjs";

type PdfJsModule = {
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<PdfDocument>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};

type PdfDocument = {
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

let pdfjsModule: PdfJsModule | null = null;

async function getPdfJs(): Promise<PdfJsModule> {
  if (pdfjsModule) return pdfjsModule;
  if (typeof window === "undefined") {
    throw new Error("PDF 표지 생성은 브라우저에서만 가능합니다.");
  }

  const moduleUrl = new URL(PDFJS_PUBLIC_MODULE, window.location.origin).href;
  const loaded = (await import(
    /* webpackIgnore: true */
    moduleUrl
  )) as PdfJsModule;

  loaded.GlobalWorkerOptions.workerSrc = PDFJS_PUBLIC_WORKER;
  pdfjsModule = loaded;
  return loaded;
}

/** PDF 1페이지 상단을 1024×640 JPEG로 래스터 */
export async function renderPdfCoverPreview(
  input: File | ArrayBuffer | Blob,
  opts?: { width?: number; height?: number; quality?: number },
): Promise<Blob> {
  const width = opts?.width ?? PDF_COVER_WIDTH;
  const height = opts?.height ?? PDF_COVER_HEIGHT;
  const quality = opts?.quality ?? 0.88;

  const buffer =
    input instanceof ArrayBuffer
      ? input
      : await (input instanceof File ? input : input).arrayBuffer();
  const data = new Uint8Array(buffer);

  const pdfjs = await getPdfJs();
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = width / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 사용할 수 없습니다.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  await pdf.destroy();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("PDF 미리보기 이미지 생성에 실패했습니다.")),
      "image/jpeg",
      quality,
    );
  });
}
