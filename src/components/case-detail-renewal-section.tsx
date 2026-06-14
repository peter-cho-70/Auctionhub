"use client";

import { useCallback, useEffect, useState } from "react";
import { CaseAuctionSheetView } from "@/components/case-auction-sheet-view";
import { CasePdfCoverPreview } from "@/components/case-pdf-cover-preview";
import { PdfCoverCropEditor } from "@/components/pdf-cover-crop-editor";
import { getCaseMediaBlob } from "@/lib/data/case-media-store";
import { CASE_PDF_COVER_SOURCE_REF } from "@/lib/domain/case-list-thumbnail";
import { getSourcePdfBlob } from "@/lib/pdf/store-source-pdf";
import {
  applyPdfCoverListCrop,
  storePdfCoverSource,
} from "@/lib/pdf/save-pdf-cover-thumbnail";
import type { AuctionCase, PdfCoverListCrop } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

const AUCTION_PDF_KINDS = new Set([
  "daejangauction-pdf",
  "speedauction-pdf",
  "auctionone-pdf",
]);

type Props = {
  caseId: string;
  caseData: AuctionCase;
  onListThumbnailChange: (next: AuctionCase["listThumbnail"]) => void;
};

/** 뉴 UI: PDF 커버 + 파싱 시트 */
export function CaseDetailRenewalSection({
  caseId,
  caseData,
  onListThumbnailChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [draftCrop, setDraftCrop] = useState<PdfCoverListCrop | null>(null);

  const pdfCoverSettings = useAppStore((s) => s.data.pdfCoverSettings);
  const setPdfCoverSettings = useAppStore((s) => s.setPdfCoverSettings);

  const auctionDoc = (caseData.sourceDocuments ?? []).find(
    (d) => AUCTION_PDF_KINDS.has(d.kind) && d.pdfBlobRef,
  );

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const openCropEditor = useCallback(
    async (opts?: { rerenderFromPdf?: boolean }) => {
      setBusy(true);
      setMsg(null);
      try {
        let blob: Blob | null = null;
        if (opts?.rerenderFromPdf) {
          if (!auctionDoc?.pdfBlobRef) {
            throw new Error("저장된 PDF를 찾을 수 없습니다.");
          }
          const pdf = await getSourcePdfBlob(caseId, auctionDoc.pdfBlobRef);
          if (!pdf) throw new Error("저장된 PDF를 찾을 수 없습니다.");
          blob = await storePdfCoverSource({
            caseId,
            pdf,
            captureWidth: pdfCoverSettings.captureWidth,
            captureHeight: pdfCoverSettings.captureHeight,
          });
        } else {
          blob = await getCaseMediaBlob(
            caseId,
            "list-thumbnail",
            CASE_PDF_COVER_SOURCE_REF,
          );
          if (!blob && auctionDoc?.pdfBlobRef) {
            const pdf = await getSourcePdfBlob(caseId, auctionDoc.pdfBlobRef);
            if (!pdf) throw new Error("표지 원본을 불러올 수 없습니다.");
            blob = await storePdfCoverSource({
              caseId,
              pdf,
              captureWidth: pdfCoverSettings.captureWidth,
              captureHeight: pdfCoverSettings.captureHeight,
            });
          }
        }
        if (!blob) throw new Error("표지 원본을 불러올 수 없습니다.");

        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        setSourceUrl(URL.createObjectURL(blob));
        setDraftCrop({ ...pdfCoverSettings.listCrop });
        setCropOpen(true);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "표지 생성에 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [auctionDoc?.pdfBlobRef, caseId, pdfCoverSettings, sourceUrl],
  );

  const applyThumbnail = useCallback(
    async (saveAsDefault: boolean) => {
      if (!draftCrop) return;
      setBusy(true);
      setMsg(null);
      try {
        if (saveAsDefault) {
          setPdfCoverSettings({ listCrop: { ...draftCrop } });
        }
        const thumb = await applyPdfCoverListCrop({
          caseId,
          listCrop: draftCrop,
          captureWidth: pdfCoverSettings.captureWidth,
          captureHeight: pdfCoverSettings.captureHeight,
        });
        onListThumbnailChange(thumb);
        setCropOpen(false);
        setMsg(
          saveAsDefault
            ? "썸네일을 적용하고 기본 영역으로 저장했습니다. 이후 등록 물건에도 동일하게 적용됩니다."
            : "선택한 영역으로 썸네일을 저장했습니다.",
        );
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "썸네일 저장에 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [
      caseId,
      draftCrop,
      onListThumbnailChange,
      pdfCoverSettings.captureHeight,
      pdfCoverSettings.captureWidth,
      setPdfCoverSettings,
    ],
  );

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            물건 기본 정보
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            PDF 1페이지 전체 표지에서 썸네일 영역을 선택합니다.
          </p>
        </div>
        {auctionDoc && !cropOpen && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void openCropEditor({ rerenderFromPdf: true })}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-950"
            >
              {busy ? "생성 중…" : caseData.listThumbnail ? "표지 다시 생성" : "PDF에서 표지 생성"}
            </button>
            {caseData.listThumbnail && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void openCropEditor()}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-950"
              >
                썸네일 영역 수정
              </button>
            )}
          </div>
        )}
      </div>

      {msg && <p className="text-xs text-neutral-600 dark:text-neutral-400">{msg}</p>}

      {cropOpen && sourceUrl && draftCrop && (
        <div className="space-y-3 rounded-lg border border-sky-200 bg-white p-3 dark:border-sky-900 dark:bg-neutral-950">
          <PdfCoverCropEditor
            sourceUrl={sourceUrl}
            captureWidth={pdfCoverSettings.captureWidth}
            captureHeight={pdfCoverSettings.captureHeight}
            crop={draftCrop}
            onCropChange={setDraftCrop}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyThumbnail(false)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {busy ? "저장 중…" : "썸네일 적용"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyThumbnail(true)}
              className="rounded-lg border border-sky-400 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
            >
              기본으로 설정
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCropOpen(false)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
            >
              취소
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            「기본으로 설정」은 이 영역을 전역 기본값으로 저장하고, 새 PDF 등록 시
            자동 썸네일에도 사용합니다.
          </p>
        </div>
      )}

      {!cropOpen && (
        <CasePdfCoverPreview caseId={caseId} thumbnail={caseData.listThumbnail} />
      )}

      {!caseData.listThumbnail && !auctionDoc && !cropOpen && (
        <p className="text-xs text-neutral-500">
          PDF 표지가 없습니다.{" "}
          <a href="/cases/import" className="underline">
            PDF 등록
          </a>
          으로 추가하거나 올드 UI 원문/PDF 탭에서 등록하세요.
        </p>
      )}
      <CaseAuctionSheetView caseData={caseData} />
    </section>
  );
}
