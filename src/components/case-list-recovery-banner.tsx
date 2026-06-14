"use client";

import { useState } from "react";
import { restoreBundledSeedData } from "@/lib/data/seed-bootstrap";
import { useAppStore } from "@/store/app-store";

const BACKUP_CASE_SAMPLES = [
  "2025타경3714",
  "2023타경11699",
  "2025타경2187",
  "2023타경8112",
  "2025타경503020",
];

export function CaseListRecoveryBanner({ compact = false }: { compact?: boolean }) {
  const caseCount = useAppStore((s) => s.data.cases.length);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (caseCount > 0) return null;

  const restore = async (mode: "replace" | "merge") => {
    setBusy(true);
    setMsg(null);
    const result = await restoreBundledSeedData(mode);
    setBusy(false);
    if (!result.ok) {
      setMsg(result.error ?? "복원에 실패했습니다.");
      return;
    }
    setMsg(`물건 ${result.caseCount}개를 복원했습니다.`);
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
        <p className="font-medium text-rose-950 dark:text-rose-100">
          저장된 물건이 없습니다
        </p>
        <p className="mt-1 text-xs text-rose-900/90 dark:text-rose-200/90">
          백업에 16개 물건이 있습니다.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void restore("replace")}
          className="mt-2 rounded-lg bg-rose-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-rose-200 dark:text-rose-950"
        >
          {busy ? "복원 중…" : "백업 물건 복원"}
        </button>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30">
      <h2 className="font-medium text-rose-950 dark:text-rose-100">
        물건 목록 복원
      </h2>
      <p className="mt-1 text-xs text-rose-900/90 dark:text-rose-200/90">
        브라우저 저장 데이터가 비어 있습니다. 프로젝트에 보관된 백업에서{" "}
        <strong>16개 물건</strong>을 다시 불러올 수 있습니다.
      </p>
      <ul className="mt-2 list-inside list-disc text-xs text-rose-900/80 dark:text-rose-200/80">
        {BACKUP_CASE_SAMPLES.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>외 11개 물건</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void restore("replace")}
          className="rounded-lg bg-rose-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-rose-200 dark:text-rose-950"
        >
          {busy ? "복원 중…" : "백업 16개 물건 복원"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void restore("merge")}
          className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm dark:border-rose-800 dark:bg-neutral-950"
        >
          기존 데이터와 병합
        </button>
      </div>
      <p className="mt-2 text-xs text-rose-900/70 dark:text-rose-200/70">
        「데이터」 탭의 로컬 스냅샷·JSON 가져오기·Supabase 불러오기로도 복원할 수
        있습니다.
      </p>
      {msg && (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-black/20">
          {msg}
        </p>
      )}
    </section>
  );
}
