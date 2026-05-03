"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { safeParseAppDataJson } from "@/lib/data/migrate";
import { STANDARD_TEMPLATE_KEYS } from "@/lib/domain/template-vars";

export default function DataPage() {
  const exportDataJson = useAppStore((s) => s.exportDataJson);
  const importData = useAppStore((s) => s.importData);
  const resetToDefaults = useAppStore((s) => s.resetToDefaults);
  const addKnowledgeNote = useAppStore((s) => s.addKnowledgeNote);
  const notes = useAppStore((s) => s.data.knowledgeNotes);
  const removeKnowledgeNote = useAppStore((s) => s.removeKnowledgeNote);

  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportDataJson()], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auctionflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("파일을 내려받았습니다.");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const parsed = safeParseAppDataJson(text);
    if (parsed instanceof Error) {
      setMsg(parsed.message);
      return;
    }
    const mode = confirm(
      "확인=덮어쓰기(전체 교체), 취소=병합(같은 ID 제외 추가)",
    )
      ? "replace"
      : "merge";
    importData(text, mode);
    setMsg(mode === "replace" ? "데이터를 교체했습니다." : "데이터를 병합했습니다.");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">데이터</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          브라우저 <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">localStorage</code>
          에 자동 저장됩니다. 백업·이전은 JSON 파일로 하세요.
        </p>
      </div>

      {msg && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {msg}
        </p>
      )}

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          JSON보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          JSON 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e)}
        />
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "모든 물건·노트·템플릿 수정이 초기화됩니다. 계속할까요?",
              )
            ) {
              resetToDefaults();
              setMsg("초기 데이터로 초기화했습니다.");
            }
          }}
          className="rounded-lg border border-rose-300 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:text-rose-300"
        >
          초기화
        </button>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-medium">지식 노트 (간단)</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const title = String(fd.get("title") ?? "").trim();
            const body = String(fd.get("body") ?? "").trim();
            const category = String(fd.get("category") ?? "general").trim();
            if (!title) return;
            addKnowledgeNote({
              category: category || "general",
              title,
              body,
              linkedCaseId: null,
            });
            e.currentTarget.reset();
            setMsg("노트를 추가했습니다.");
          }}
        >
          <input
            name="category"
            placeholder="카테고리 (권리분석/명도/…)"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <input
            name="title"
            required
            placeholder="제목"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <textarea
            name="body"
            rows={3}
            placeholder="내용"
            className="sm:col-span-2 rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            노트 추가
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-2 rounded border border-neutral-100 p-2 dark:border-neutral-900"
            >
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-xs text-neutral-500">{n.category}</div>
                {n.body && (
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                    {n.body}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-rose-600 hover:underline"
                onClick={() => removeKnowledgeNote(n.id)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-neutral-500">
        <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
          문자 템플릿 표준 변수
        </h3>
        <p className="mt-2 leading-relaxed">
          {STANDARD_TEMPLATE_KEYS.map((k) => `{${k}}`).join(" · ")}
        </p>
      </section>
    </div>
  );
}
