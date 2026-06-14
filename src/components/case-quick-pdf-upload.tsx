"use client";

import { useCallback, useRef, useState } from "react";
import { registerSourcePdfUpload } from "@/lib/pdf/register-source-pdf-upload";
import type { CaseSourceDocument, CaseSourceDocumentKind } from "@/lib/types/domain";

type PdfToJsonOk = {
  ok: true;
  meta: unknown;
  rawText: string;
  structuredJson: unknown;
  extracted?: { caseNumber?: string | null };
};

type PdfToJsonError = { ok: false; error: string };

type Props = {
  caseId: string;
  caseNumber: string;
  kind?: CaseSourceDocumentKind;
  onDocumentAdded: (document: CaseSourceDocument) => void;
  className?: string;
  label?: string;
  busyLabel?: string;
};

export function CaseQuickPdfUpload({
  caseId,
  caseNumber,
  kind = "daejangauction-pdf",
  onDocumentAdded,
  className,
  label = "PDF 추가",
  busyLabel = "PDF 등록 중…",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (uploadingRef.current) return;
      uploadingRef.current = true;
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", kind);
        const res = await fetch("/api/pdf-to-json", { method: "POST", body: form });
        const data = (await res.json()) as PdfToJsonOk | PdfToJsonError;
        if (!res.ok || !data.ok) {
          throw new Error(data.ok ? "PDF 파싱에 실패했습니다." : data.error);
        }
        const extractedCaseNumber =
          data.extracted?.caseNumber != null
            ? String(data.extracted.caseNumber)
            : null;
        const document = await registerSourcePdfUpload({
          caseId,
          caseNumber,
          extractedCaseNumber,
          kind,
          file,
          meta: data.meta,
          rawText: data.rawText,
          structuredJson: data.structuredJson,
        });
        onDocumentAdded(document);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "PDF 등록에 실패했습니다.",
        );
      } finally {
        uploadingRef.current = false;
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [caseId, caseNumber, kind, onDocumentAdded],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={
          className ??
          "rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        }
      >
        {busy ? busyLabel : label}
      </button>
    </>
  );
}
