"use client";

import { useEffect, useState } from "react";
import { getCaseMediaBlob } from "@/lib/data/case-media-store";
import {
  CASE_LIST_THUMBNAIL_REF,
  CASE_PDF_COVER_SOURCE_REF,
} from "@/lib/domain/case-list-thumbnail";
import { useAppStore } from "@/store/app-store";
import type { CaseListThumbnail } from "@/lib/types/domain";

type Props = {
  caseId: string;
  thumbnail: CaseListThumbnail | null;
  className?: string;
};

/** PDF 1페이지 상단 전체 캡처 미리보기 */
export function CasePdfCoverPreview({ caseId, thumbnail, className = "" }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const { captureWidth, captureHeight } = useAppStore(
    (s) => s.data.pdfCoverSettings,
  );

  useEffect(() => {
    if (!thumbnail) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void (async () => {
      const source = await getCaseMediaBlob(
        caseId,
        "list-thumbnail",
        CASE_PDF_COVER_SOURCE_REF,
      );
      const blob =
        source ??
        (await getCaseMediaBlob(
          caseId,
          "list-thumbnail",
          CASE_LIST_THUMBNAIL_REF,
        ));
      if (cancelled || !blob) return;
      revoked = URL.createObjectURL(blob);
      setUrl(revoked);
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [caseId, thumbnail?.updatedAt]);

  if (!thumbnail || !url) return null;

  return (
    <figure
      className={`w-full max-w-[1024px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="경매 PDF 1페이지 상단"
        width={captureWidth}
        height={captureHeight}
        className="h-auto w-full max-w-[1024px] object-cover object-top"
        style={{ aspectRatio: `${captureWidth} / ${captureHeight}` }}
      />
      <figcaption className="border-t border-neutral-200 px-3 py-1.5 text-[10px] text-neutral-500 dark:border-neutral-800">
        PDF 원문 1페이지 상단 ({captureWidth}×{captureHeight})
      </figcaption>
    </figure>
  );
}
