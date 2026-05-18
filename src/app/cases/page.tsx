"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus } from "@/lib/types/domain";
import { computeMultiFamilyScore } from "@/lib/domain/multifamily-analysis";
import {
  effectivePriorityLevel,
  PRIORITY_LEVEL_LABELS,
} from "@/lib/domain/case-priority";
import { LAST_SELECTED_CASE_KEY } from "@/lib/constants/storage";

function sourceDocumentLabels(
  documents: Array<{ kind: string }> | undefined,
): string[] {
  const kinds = new Set((documents ?? []).map((doc) => doc.kind));
  const labels = [
    kinds.has("auctionone-pdf") ? "경매 PDF" : "",
    kinds.has("building-ledger") ? "건축물대장" : "",
    kinds.has("tenant-report") ? "매각물건명세서/임차" : "",
    kinds.has("appraisal-report") ? "감정평가서" : "",
    kinds.has("registry-building") || kinds.has("registry-land") ? "등기부" : "",
  ].filter(Boolean);
  return labels.length > 0 ? labels : (documents ?? []).length > 0 ? ["원문 자료"] : [];
}

export default function CasesListPage() {
  const cases = useAppStore((s) => s.data.cases);
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const [q, setQ] = useState("");
  const [lastSelectedCaseId, setLastSelectedCaseId] = useState<string | null>(
    () =>
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(LAST_SELECTED_CASE_KEY),
  );

  const filtered = useMemo(() => {
    return cases
      .filter((c) => {
        if (filter !== "all" && c.status !== filter) return false;
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          c.address.toLowerCase().includes(s) ||
          c.caseNumber.toLowerCase().includes(s) ||
          c.sourceUrl.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        const pa = effectivePriorityLevel(a);
        const pb = effectivePriorityLevel(b);
        if (pa !== pb) return pb - pa;
        const sa = computeMultiFamilyScore(a);
        const sb = computeMultiFamilyScore(b);
        if (sa.totalScore !== sb.totalScore) return sb.totalScore - sa.totalScore;
        return (a.bidDate ?? "9999-99-99").localeCompare(b.bidDate ?? "9999-99-99");
      });
  }, [cases, filter, q]);
  const lastSelectedCase = cases.find((c) => c.id === lastSelectedCaseId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">물건 목록</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            상태·검색으로 필터링합니다.
          </p>
        </div>
        <Link
          href="/cases/import-pdf"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          PDF 등록
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CaseStatus | "all")}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="all">전체 상태</option>
          {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((st) => (
            <option key={st} value={st}>
              {STATUS_LABELS[st]}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="주소, 사건번호, URL 검색…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      {lastSelectedCase && (
        <Link
          href={`/cases/${lastSelectedCase.id}`}
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
            바로 전에 선택한 물건
          </span>
          <span className="mt-1 block font-medium text-neutral-900 dark:text-neutral-100">
            {lastSelectedCase.address || lastSelectedCase.caseNumber || "주소 미입력"}
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            클릭하면 이전에 보던 상세정보를 다시 엽니다.
          </span>
        </Link>
      )}

      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-neutral-500">
            조건에 맞는 물건이 없습니다.
          </li>
        ) : (
          filtered.map((c) => {
            const score = computeMultiFamilyScore(c);
            const priorityLevel = effectivePriorityLevel(c);
            const sourceLabels = sourceDocumentLabels(c.sourceDocuments);
            const selected = c.id === lastSelectedCaseId;
            return (
              <li
                key={c.id}
                className={
                  selected
                    ? "bg-amber-50/70 dark:bg-amber-950/20"
                    : undefined
                }
              >
                <Link
                  href={`/cases/${c.id}`}
                  onClick={() => {
                    window.localStorage.setItem(LAST_SELECTED_CASE_KEY, c.id);
                    setLastSelectedCaseId(c.id);
                  }}
                  className="flex flex-col gap-2 px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {[c.caseNumber, c.address || "(주소 미입력)"]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {STATUS_LABELS[c.status]}
                      {c.bidDate && (
                        <span>
                          {" "}
                          · 입찰 {c.bidDate}
                        </span>
                      )}
                    </div>
                    {sourceLabels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {sourceLabels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                      {PRIORITY_LEVEL_LABELS[priorityLevel]}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      다가구 {score.grade} · {score.totalScore}점
                    </span>
                    <span className="text-neutral-400">
                      유찰 {c.bidRounds.filter((r) => r.result === "failed").length}회
                    </span>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
