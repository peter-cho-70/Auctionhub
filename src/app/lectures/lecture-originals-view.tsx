"use client";

import mammoth from "mammoth";
import { useCallback, useState } from "react";
import { LECTURE_ORIGINAL_DOCS } from "@/lib/data/lecture-sources";
import { STATUS_LABELS } from "@/lib/domain/status-labels";

export function LectureOriginalsView() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = LECTURE_ORIGINAL_DOCS.find(
    (d) => d.fileName === selectedFile,
  );

  const loadDoc = useCallback(async (fileName: string, href: string) => {
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
      const doc = LECTURE_ORIGINAL_DOCS.find((d) => d.fileName === fileName);
      if (doc) void loadDoc(doc.fileName, doc.href);
    },
    [loadDoc],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
      <aside
        className="w-full shrink-0 space-y-3 lg:sticky lg:top-20 lg:w-80"
        aria-label="원본 강의 자료 목록"
      >
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          원본 자료 (DOCX)
        </h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          항목을 누르면 왼쪽에 변환된 본문이 표시됩니다. 서식은 단순화될 수
          있으니 필요 시 파일을 내려받아 확인하세요.
        </p>
        <ul className="space-y-2">
          {LECTURE_ORIGINAL_DOCS.map((doc) => {
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
                  <span className="mt-1.5 block text-[11px] text-neutral-500">
                    {doc.relatedSteps.map((s) => STATUS_LABELS[s]).join(" · ")}
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
            오른쪽 목록에서 자료를 선택하면 여기에 내용이 표시됩니다.
          </div>
        )}

        {selectedFile && (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800 sm:px-5">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                {selected?.title}
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">{selected?.description}</p>
            </div>

            <div className="max-h-[min(85vh,1200px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
