"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cropImageBlob } from "@/lib/pdf/crop-image-blob";
import { clampPdfCoverListCrop } from "@/lib/pdf/pdf-cover-settings";
import type { PdfCoverListCrop } from "@/lib/types/domain";

type Props = {
  sourceUrl: string;
  captureWidth: number;
  captureHeight: number;
  crop: PdfCoverListCrop;
  onCropChange: (crop: PdfCoverListCrop) => void;
  className?: string;
};

type DragMode = "create" | "move" | "resize";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type Rect = { x: number; y: number; width: number; height: number };

const MIN_SIZE = 24;

function clampRect(rect: Rect, maxW: number, maxH: number): Rect {
  const width = Math.max(MIN_SIZE, Math.min(rect.width, maxW));
  const height = Math.max(MIN_SIZE, Math.min(rect.height, maxH));
  const x = Math.max(0, Math.min(rect.x, maxW - width));
  const y = Math.max(0, Math.min(rect.y, maxH - height));
  return { x, y, width, height };
}

function hitResizeHandle(
  px: number,
  py: number,
  rect: Rect,
  handleSize: number,
): ResizeHandle | null {
  const corners: Array<{ h: ResizeHandle; x: number; y: number }> = [
    { h: "nw", x: rect.x, y: rect.y },
    { h: "ne", x: rect.x + rect.width, y: rect.y },
    { h: "sw", x: rect.x, y: rect.y + rect.height },
    { h: "se", x: rect.x + rect.width, y: rect.y + rect.height },
  ];
  for (const c of corners) {
    if (
      Math.abs(px - c.x) <= handleSize &&
      Math.abs(py - c.y) <= handleSize
    ) {
      return c.h;
    }
  }
  return null;
}

function resizeRect(
  base: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  maxW: number,
  maxH: number,
): Rect {
  let { x, y, width, height } = base;
  if (handle === "nw") {
    x += dx;
    y += dy;
    width -= dx;
    height -= dy;
  } else if (handle === "ne") {
    y += dy;
    width += dx;
    height -= dy;
  } else if (handle === "sw") {
    x += dx;
    width -= dx;
    height += dy;
  } else {
    width += dx;
    height += dy;
  }
  return clampRect({ x, y, width, height }, maxW, maxH);
}

export function PdfCoverCropEditor({
  sourceUrl,
  captureWidth,
  captureHeight,
  crop,
  onCropChange,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    handle?: ResizeHandle;
    startX: number;
    startY: number;
    origin: Rect;
  } | null>(null);

  const scaleX = displaySize.width > 0 ? displaySize.width / captureWidth : 1;
  const scaleY = displaySize.height > 0 ? displaySize.height / captureHeight : 1;

  const displayRect: Rect = {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setDisplaySize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetch(sourceUrl)
      .then((r) => r.blob())
      .then((blob) => cropImageBlob(blob, crop))
      .then((out) => {
        if (cancelled) return;
        revoked = URL.createObjectURL(out);
        setThumbUrl(revoked);
      })
      .catch(() => {
        if (!cancelled) setThumbUrl(null);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [sourceUrl, crop]);

  const toCaptureCoords = useCallback(
    (rect: Rect): PdfCoverListCrop => {
      const raw = {
        x: Math.round(rect.x / scaleX),
        y: Math.round(rect.y / scaleY),
        width: Math.round(rect.width / scaleX),
        height: Math.round(rect.height / scaleY),
      };
      return clampPdfCoverListCrop(raw, captureWidth, captureHeight);
    },
    [captureWidth, captureHeight, scaleX, scaleY],
  );

  const pointerToLocal = (clientX: number, clientY: number) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(clientX - box.left, box.width)),
      y: Math.max(0, Math.min(clientY - box.top, box.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (displaySize.width <= 0) return;
    const p = pointerToLocal(e.clientX, e.clientY);
    const handle = hitResizeHandle(p.x, p.y, displayRect, 10);
    const inside =
      p.x >= displayRect.x &&
      p.x <= displayRect.x + displayRect.width &&
      p.y >= displayRect.y &&
      p.y <= displayRect.y + displayRect.height;

    if (handle) {
      dragRef.current = {
        mode: "resize",
        handle,
        startX: p.x,
        startY: p.y,
        origin: { ...displayRect },
      };
    } else if (inside) {
      dragRef.current = {
        mode: "move",
        startX: p.x,
        startY: p.y,
        origin: { ...displayRect },
      };
    } else {
      dragRef.current = {
        mode: "create",
        startX: p.x,
        startY: p.y,
        origin: { x: p.x, y: p.y, width: 0, height: 0 },
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || displaySize.width <= 0) return;
    const p = pointerToLocal(e.clientX, e.clientY);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;

    let next: Rect;
    if (drag.mode === "create") {
      const x = Math.min(drag.startX, p.x);
      const y = Math.min(drag.startY, p.y);
      next = clampRect(
        {
          x,
          y,
          width: Math.abs(p.x - drag.startX),
          height: Math.abs(p.y - drag.startY),
        },
        displaySize.width,
        displaySize.height,
      );
    } else if (drag.mode === "move") {
      next = clampRect(
        {
          x: drag.origin.x + dx,
          y: drag.origin.y + dy,
          width: drag.origin.width,
          height: drag.origin.height,
        },
        displaySize.width,
        displaySize.height,
      );
    } else {
      next = resizeRect(
        drag.origin,
        drag.handle!,
        dx,
        dy,
        displaySize.width,
        displaySize.height,
      );
    }
    onCropChange(toCaptureCoords(next));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs text-neutral-500">
        전체 표지에서 드래그해 썸네일 영역을 선택하세요. 박스를 끌어 이동·모서리로
        크기 조절할 수 있습니다.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div
          ref={containerRef}
          className="relative touch-none select-none overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
          style={{ aspectRatio: `${captureWidth} / ${captureHeight}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceUrl}
            alt="PDF 표지 전체"
            className="pointer-events-none h-full w-full object-cover object-top"
            draggable={false}
          />
          <div
            className="absolute border-2 border-sky-500 bg-sky-500/20"
            style={{
              left: displayRect.x,
              top: displayRect.y,
              width: displayRect.width,
              height: displayRect.height,
            }}
          >
            {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((h) => (
              <span
                key={h}
                className={`absolute h-3 w-3 rounded-full border-2 border-white bg-sky-600 shadow ${
                  h === "nw"
                    ? "-left-1.5 -top-1.5"
                    : h === "ne"
                      ? "-right-1.5 -top-1.5"
                      : h === "sw"
                        ? "-bottom-1.5 -left-1.5"
                        : "-bottom-1.5 -right-1.5"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            썸네일 미리보기
          </p>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt="선택 영역 미리보기"
              className="h-24 w-24 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-[10px] text-neutral-400">
              …
            </div>
          )}
          <p className="max-w-[140px] text-[11px] text-neutral-500">
            {crop.width}×{crop.height} @ ({crop.x}, {crop.y})
          </p>
        </div>
      </div>
    </div>
  );
}
