"use client";

import { useMemo, useState } from "react";

type ApiOk = {
  ok: true;
  meta: {
    fileName: string;
    fileSize: number;
    pageCount: number | null;
  };
  extracted: unknown;
  rawText: string;
};

type ApiErr = { ok: false; error: string };

function downloadJsonFile(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function PdfJsonClient() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ApiOk | null>(null);

  const pretty = useMemo(() => {
    if (!result) return "";
    return JSON.stringify(
      { meta: result.meta, extracted: result.extracted },
      null,
      2,
    );
  }, [result]);

  const onFile = async (f: File) => {
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const r = await fetch("/api/pdf-to-json", { method: "POST", body: fd });
      const json = (await r.json()) as ApiOk | ApiErr;
      if (!json.ok) {
        setMsg(json.error || "실패했습니다.");
        return;
      }
      setResult(json);
      setMsg("변환 완료");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">PDF → JSON</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          PDF를 업로드하면 텍스트를 추출해 핵심 필드를 JSON으로 보여줍니다.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
            <span className="font-medium">PDF 업로드</span>
            <span className="text-xs text-neutral-500">
              {busy ? "처리 중…" : "파일 선택"}
            </span>
          </label>

          {result && (
            <button
              type="button"
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              onClick={() =>
                downloadJsonFile(
                  `${result.meta.fileName.replace(/\.pdf$/i, "")}.json`,
                  { meta: result.meta, extracted: result.extracted },
                )
              }
            >
              JSON 다운로드
            </button>
          )}
        </div>

        {msg && (
          <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
            {msg}
          </p>
        )}
      </section>

      {result && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-sm font-medium">추출된 JSON</h2>
            <pre className="mt-3 max-h-[520px] overflow-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100 dark:bg-black">
              {pretty}
            </pre>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-sm font-medium">원문 텍스트(추출)</h2>
            <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
              {result.rawText.trim() || "(텍스트가 비어있습니다)"}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}

