"use client";

import mammoth from "mammoth";
import { useCallback, useState } from "react";
import {
  FORM_ORIGINAL_DOCS,
  getFormFilePreviewKind,
} from "@/lib/data/form-sources";

export function FormOriginalsView() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = FORM_ORIGINAL_DOCS.find((d) => d.fileName === selectedFile);
  const previewKind = selected ? getFormFilePreviewKind(selected.href) : null;

  const loadDocx = useCallback(async (href: string) => {
    setLoading(true);
    setErr(null);
    setHtml("");
    try {
      const res = await fetch(href);
      if (!res.ok) {
        throw new Error(`파일을 불러오지 못했습니다 (${res.status})`);
      }
      const buf = await res.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      setHtml(value);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "미리보기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectFile = useCallback(
    (fileName: string) => {
      setSelectedFile(fileName);
      const doc = FORM_ORIGINAL_DOCS.find((d) => d.fileName === fileName);
      if (!doc) return;
      if (getFormFilePreviewKind(doc.href) === "docx") {
        void loadDocx(doc.href);
      } else {
        setHtml("");
        setErr(null);
        setLoading(false);
      }
    },
    [loadDocx],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      <aside
        className="w-full shrink-0 space-y-3 lg:sticky lg:top-20 lg:w-80"
        aria-label="문서 양식 목록"
      >
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          등록된 양식
        </h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          `public/forms/`에 파일을 두고 `src/lib/data/form-sources.ts`의{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            FORM_ORIGINAL_DOCS
          </code>
          에 항목을 추가하면 목록에 표시됩니다. PDF는 바로 미리보기, DOCX는
          변환된 본문이 표시됩니다.
        </p>
        <ul className="space-y-2">
          {FORM_ORIGINAL_DOCS.map((doc) => {
            const active = doc.fileName === selectedFile;
            return (
              <li key={doc.fileName}>
                <button
                  type="button"
                  onClick={() => selectFile(doc.fileName)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                    active
                      ? "border-amber-500/70 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
                      : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                  }`}
                >
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {doc.title}
                  </span>
                  <span className="mt-1 block text-xs text-neutral-600 dark:text-neutral-400">
                    {doc.description}
                  </span>
                  <span className="mt-2 inline-block text-[11px] font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200">
                    {active ? "선택됨" : "미리보기"}
                  </span>
                </button>
                <a
                  href={doc.href}
                  download
                  className="mt-1 block text-center text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
                >
                  다운로드
                </a>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        {!selectedFile && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-8 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-400">
            오른쪽 목록에서 양식을 선택하면 여기에 미리보기가 표시됩니다.
          </div>
        )}

        {selectedFile && selected && (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-5">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                {selected.title}
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">{selected.description}</p>
            </div>

            <div className="max-h-[min(85vh,1200px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {previewKind === "pdf" && (
                <iframe
                  title={selected.title}
                  src={selected.href}
                  className="h-[min(80vh,1100px)] w-full rounded-lg border border-neutral-200 dark:border-neutral-700"
                />
              )}

              {previewKind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- public 동적 경로
                <img
                  src={selected.href}
                  alt={selected.title}
                  className="max-h-[min(80vh,900px)] w-auto max-w-full rounded-lg object-contain"
                />
              )}

              {previewKind === "docx" && (
                <>
                  {loading && (
                    <p className="text-sm text-neutral-500">불러오는 중…</p>
                  )}
                  {err && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">{err}</p>
                  )}
                  {!loading && !err && html && (
                    <div
                      className="lecture-doc-preview text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                </>
              )}

              {previewKind === "download" && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  이 형식은 브라우저 미리보기를 제공하지 않습니다. 아래 링크로
                  내려받아 한글·워드 등에서 여세요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
