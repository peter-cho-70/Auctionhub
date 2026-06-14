"use client";

import { useEffect, useMemo, useState } from "react";
import { getCaseMediaBlob } from "@/lib/data/case-media-store";
import { CASE_PDF_COVER_SOURCE_REF } from "@/lib/domain/case-list-thumbnail";
import { PdfCoverCropEditor } from "@/components/pdf-cover-crop-editor";
import { DEFAULT_PDF_COVER_SETTINGS } from "@/lib/pdf/pdf-cover-settings";
import type { PdfCoverListCrop } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

function numInput(
  label: string,
  value: number,
  onChange: (n: number) => void,
  min: number,
  max: number,
) {
  return (
    <label className="block text-xs">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
    </label>
  );
}

export function PdfCoverSettingsPanel() {
  const settings = useAppStore((s) => s.data.pdfCoverSettings);
  const setPdfCoverSettings = useAppStore((s) => s.setPdfCoverSettings);
  const cases = useAppStore((s) => s.data.cases);

  const casesWithThumb = useMemo(
    () => cases.filter((c) => c.listThumbnail),
    [cases],
  );

  const [previewCaseId, setPreviewCaseId] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [draftCrop, setDraftCrop] = useState(settings.listCrop);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftCrop(settings.listCrop);
  }, [settings.listCrop]);

  useEffect(() => {
    if (!previewCaseId && casesWithThumb[0]) {
      setPreviewCaseId(casesWithThumb[0].id);
    }
  }, [previewCaseId, casesWithThumb]);

  useEffect(() => {
    if (!previewCaseId) {
      setSourceUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void getCaseMediaBlob(
      previewCaseId,
      "list-thumbnail",
      CASE_PDF_COVER_SOURCE_REF,
    ).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setSourceUrl(null);
        return;
      }
      revoked = URL.createObjectURL(blob);
      setSourceUrl(revoked);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [previewCaseId]);

  const patchCrop = (patch: Partial<PdfCoverListCrop>) => {
    setDraftCrop((prev) => ({ ...prev, ...patch }));
  };

  const saveDraftAsDefault = () => {
    setPdfCoverSettings({ listCrop: { ...draftCrop } });
    setSavedMsg("기본 썸네일 영역을 저장했습니다.");
  };

  const { captureWidth, captureHeight, listCrop } = settings;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="font-medium">PDF 표지 · 목록 크롭</h2>
      <p className="mt-1 text-xs text-neutral-500">
        PDF 1페이지를 {captureWidth}×{captureHeight}으로 캡처한 뒤, 선택한 영역을
        물건 목록 썸네일로 씁니다. 물건 상세의 「기본으로 설정」 또는 아래
        저장으로 전역 기본값을 바꿀 수 있습니다.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {numInput("크롭 X", draftCrop.x, (n) => patchCrop({ x: n }), 0, captureWidth)}
        {numInput("크롭 Y", draftCrop.y, (n) => patchCrop({ y: n }), 0, captureHeight)}
        {numInput(
          "너비",
          draftCrop.width,
          (n) => patchCrop({ width: n }),
          1,
          captureWidth,
        )}
        {numInput(
          "높이",
          draftCrop.height,
          (n) => patchCrop({ height: n }),
          1,
          captureHeight,
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = structuredClone(DEFAULT_PDF_COVER_SETTINGS);
            setPdfCoverSettings(next);
            setDraftCrop(next.listCrop);
            setSavedMsg("공장 기본값으로 복원했습니다.");
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
        >
          공장 기본값 복원
        </button>
        <button
          type="button"
          onClick={saveDraftAsDefault}
          className="rounded-lg border border-sky-400 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
        >
          기본으로 설정
        </button>
        <span className="text-xs text-neutral-500">
          저장된 기본: {listCrop.width}×{listCrop.height} @ ({listCrop.x},{" "}
          {listCrop.y})
        </span>
      </div>
      {savedMsg && (
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{savedMsg}</p>
      )}

      <div className="mt-4">
        {sourceUrl ? (
          <PdfCoverCropEditor
            sourceUrl={sourceUrl}
            captureWidth={captureWidth}
            captureHeight={captureHeight}
            crop={draftCrop}
            onCropChange={setDraftCrop}
          />
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-neutral-300 px-4 text-center text-xs text-neutral-500 dark:border-neutral-700">
            {casesWithThumb.length === 0
              ? "미리보기용 물건이 없습니다. PDF로 물건을 등록하면 여기서 확인할 수 있습니다."
              : "이 물건에는 원본 캡처가 없습니다. PDF 표지를 다시 생성하세요."}
          </div>
        )}
        {casesWithThumb.length > 0 && (
          <label className="mt-2 block text-xs">
            미리보기 물건
            <select
              value={previewCaseId}
              onChange={(e) => setPreviewCaseId(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {casesWithThumb.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.caseNumber, c.address].filter(Boolean).join(" · ") ||
                    c.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
