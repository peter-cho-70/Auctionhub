"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AppExperienceToggle } from "@/components/app-experience-toggle";
import {
  buildCasePatchFromDocumentFacts,
  extractCaseDocumentFacts,
  listTitleFromStructuredJson,
} from "@/lib/domain/case-document-facts";
import { registerSourcePdfUpload } from "@/lib/pdf/register-source-pdf-upload";
import { savePdfCoverAsListThumbnail } from "@/lib/pdf/save-pdf-cover-thumbnail";
import {
  readAppExperienceMode,
  type AppExperienceMode,
} from "@/lib/ui/app-experience-mode";
import type { CaseSourceDocumentKind } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

type ApiOk = {
  ok: true;
  kind?: CaseSourceDocumentKind;
  meta: { fileName: string; fileSize: number; pageCount: number | null };
  extracted?: { caseNumber?: string | null };
  newCaseInput: {
    sourceUrl: string;
    caseNumber?: string;
    address?: string;
    propertyType?: string;
    builtYear?: string;
    appraisalPrice?: number | null;
    minPrice?: number | null;
    bidDate?: string | null;
    landAreaSqm?: number | null;
    buildingAreaSqm?: number | null;
    parkingUnitCount?: number | null;
    buildingCoverageRatio?: string;
    floorAreaRatio?: string;
    memo?: string;
    listTitle?: string;
  };
  warnings: string[];
  rawText: string;
  structuredJson: unknown;
};

type ApiErr = { ok: false; error: string };

export default function SimpleCaseImportPage() {
  const router = useRouter();
  const addCase = useAppStore((s) => s.addCase);
  const updateCase = useAppStore((s) => s.updateCase);
  const pdfCoverSettings = useAppStore((s) => s.data.pdfCoverSettings);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [experienceMode, setExperienceMode] = useState<AppExperienceMode>(() =>
    readAppExperienceMode(),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pdfKind, setPdfKind] =
    useState<CaseSourceDocumentKind>("daejangauction-pdf");
  const creatingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const isPdfFile = (file: File) =>
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  const importPdf = useCallback(
    async (file: File) => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      setBusy(true);
      setMessage("PDF 분석 중…");
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", pdfKind);

        const [res] = await Promise.all([
          fetch("/api/pdf-to-case", { method: "POST", body: form }),
        ]);
        const json = (await res.json()) as ApiOk | ApiErr;
        if (!json.ok) {
          throw new Error(json.error || "PDF 파싱에 실패했습니다.");
        }

        const nc = json.newCaseInput;
        const listTitle =
          nc.listTitle?.trim() ||
          listTitleFromStructuredJson(json.structuredJson) ||
          undefined;

        const c = addCase({
          sourceUrl: nc.sourceUrl || `pdf-import:${file.name}`,
          caseNumber: nc.caseNumber?.trim() || undefined,
          address: nc.address?.trim() || undefined,
          propertyType: nc.propertyType?.trim() || undefined,
          builtYear: nc.builtYear?.trim() || undefined,
          appraisalPrice: nc.appraisalPrice ?? null,
          minPrice: nc.minPrice ?? null,
          bidDate: nc.bidDate ?? null,
          landAreaSqm: nc.landAreaSqm ?? null,
          buildingAreaSqm: nc.buildingAreaSqm ?? null,
          parkingUnitCount: nc.parkingUnitCount ?? null,
          buildingCoverageRatio: nc.buildingCoverageRatio?.trim() || undefined,
          floorAreaRatio: nc.floorAreaRatio?.trim() || undefined,
          memo: nc.memo?.trim() || undefined,
          listTitle,
          sourceDocuments: [],
        });

        const document = await registerSourcePdfUpload({
          caseId: c.id,
          caseNumber: nc.caseNumber,
          extractedCaseNumber: json.extracted?.caseNumber ?? null,
          kind: json.kind ?? pdfKind,
          file,
          meta: json.meta,
          rawText: json.rawText,
          structuredJson: json.structuredJson,
        });

        const sourceDocuments = [document];
        const facts = extractCaseDocumentFacts(sourceDocuments);
        const patch = buildCasePatchFromDocumentFacts(c, facts);

        let listThumbnail = c.listThumbnail;
        try {
          listThumbnail = await savePdfCoverAsListThumbnail({
            caseId: c.id,
            pdf: file,
            settings: pdfCoverSettings,
          });
        } catch {
          /* 표지 생성 실패 시 물건 등록은 계속 */
        }

        updateCase(c.id, { ...patch, sourceDocuments, listThumbnail });

        router.push(`/cases/${c.id}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "등록에 실패했습니다.");
        creatingRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [addCase, pdfCoverSettings, pdfKind, router, updateCase],
  );

  const pickPdfFile = useCallback(
    (file: File | undefined | null) => {
      if (!file || busy || creatingRef.current) return;
      if (!isPdfFile(file)) {
        setMessage("PDF 파일만 등록할 수 있습니다.");
        return;
      }
      setMessage(null);
      void importPdf(file);
    },
    [busy, importPdf],
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy) e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    pickPdfFile(file);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PDF로 물건 등록</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            PDF만 넣으면 파싱 후 물건 시트가 만들어집니다.
          </p>
        </div>
        <AppExperienceToggle
          compact
          value={experienceMode}
          onChange={setExperienceMode}
        />
      </div>

      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-label="PDF 파일 선택 또는 드래그하여 등록"
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!busy) fileInputRef.current?.click();
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition ${
          busy
            ? "cursor-not-allowed border-neutral-300 bg-neutral-100 opacity-70 dark:border-neutral-700 dark:bg-neutral-900"
            : dragActive
              ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
              : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-600"
        }`}
      >
        <span className="text-4xl opacity-40">📄</span>
        <span className="mt-4 text-base font-medium">
          {busy ? "분석 중…" : dragActive ? "여기에 PDF 놓기" : "PDF 선택 또는 드래그"}
        </span>
        <span className="mt-1 text-sm text-neutral-500">
          대장옥션 경매 PDF (기본)
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            pickPdfFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="text-center">
        <button
          type="button"
          className="text-xs text-neutral-500 underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "고급 옵션 숨기기" : "고급 옵션"}
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-2 text-left">
            <label className="block text-sm">
              PDF 종류
              <select
                value={pdfKind}
                onChange={(e) =>
                  setPdfKind(e.target.value as CaseSourceDocumentKind)
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="daejangauction-pdf">대장옥션</option>
                <option value="speedauction-pdf">스피드옥션</option>
                <option value="building-ledger">건축물대장</option>
              </select>
            </label>
            {experienceMode === "legacy" && (
              <Link
                href="/cases/import-pdf"
                className="block text-sm text-neutral-600 underline dark:text-neutral-400"
              >
                올드 UI: 상세 PDF 등록 (URL·수동 필드)
              </Link>
            )}
          </div>
        )}
      </div>

      {message && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            busy
              ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
