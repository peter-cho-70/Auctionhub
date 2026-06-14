"use client";

import { useEffect, useRef, useState } from "react";
import type { CaseListThumbnail } from "@/lib/types/domain";
import {
  compressImageFile,
  deleteCaseMedia,
  getCaseMediaBlob,
  putCaseMediaBlob,
} from "@/lib/data/case-media-store";
import {
  CASE_LIST_THUMBNAIL_REF,
  CASE_PDF_COVER_SOURCE_REF,
} from "@/lib/domain/case-list-thumbnail";

type ThumbnailImgProps = {
  caseId: string;
  thumbnail: CaseListThumbnail | null;
  className?: string;
  placeholderClassName?: string;
  alt?: string;
};

export function CaseListThumbnailImg({
  caseId,
  thumbnail,
  className = "h-14 w-14 rounded-md object-cover",
  placeholderClassName = "h-14 w-14 rounded-md border border-dashed border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900",
  alt = "물건 썸네일",
}: ThumbnailImgProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnail) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void getCaseMediaBlob(caseId, "list-thumbnail", CASE_LIST_THUMBNAIL_REF).then(
      (blob) => {
        if (cancelled || !blob) return;
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      },
    );
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [caseId, thumbnail?.updatedAt]);

  if (!thumbnail) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center text-[10px] text-neutral-400 ${placeholderClassName}`}
        aria-hidden
      >
        —
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center text-[10px] text-neutral-400 ${placeholderClassName}`}
      >
        …
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={`shrink-0 ${className}`} />
  );
}

type EditorProps = {
  caseId: string;
  thumbnail: CaseListThumbnail | null;
  onChange: (next: CaseListThumbnail | null) => void;
};

export function CaseListThumbnailEditor({
  caseId,
  thumbnail,
  onChange,
}: EditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const { blob, mimeType } = await compressImageFile(file);
      await putCaseMediaBlob(
        caseId,
        "list-thumbnail",
        CASE_LIST_THUMBNAIL_REF,
        blob,
      );
      onChange({ mimeType, updatedAt: new Date().toISOString() });
      setMessage("목록 썸네일을 저장했습니다.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "사진 저장에 실패했습니다.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeThumbnail = async () => {
    if (!thumbnail) return;
    if (!confirm("목록 썸네일을 삭제할까요?")) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteCaseMedia(caseId, "list-thumbnail", CASE_LIST_THUMBNAIL_REF);
      onChange(null);
      setMessage("썸네일을 삭제했습니다.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
      <p className="text-sm font-medium">목록 썸네일</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        물건 목록에 표시할 대표 사진입니다. 상태 정보 왼쪽에 작게 보입니다.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <CaseListThumbnailImg
          caseId={caseId}
          thumbnail={thumbnail}
          className="h-24 w-24 rounded-lg object-cover"
          placeholderClassName="h-24 w-24 rounded-lg border border-dashed border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="flex min-w-[160px] flex-1 flex-col gap-2">
          <label className="text-xs text-neutral-600 dark:text-neutral-400">
            사진 파일 (JPG·PNG·WEBP)
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              disabled={busy}
              className="mt-1 block w-full max-w-xs text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {thumbnail && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeThumbnail()}
              className="w-fit rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"
            >
              썸네일 삭제
            </button>
          )}
          {message && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export async function deleteCaseListThumbnailMedia(caseId: string): Promise<void> {
  try {
    await deleteCaseMedia(caseId, "list-thumbnail", CASE_LIST_THUMBNAIL_REF);
    await deleteCaseMedia(caseId, "list-thumbnail", CASE_PDF_COVER_SOURCE_REF);
  } catch {
    /* ignore */
  }
}
