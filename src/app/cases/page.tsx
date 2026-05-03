"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus } from "@/lib/types/domain";

export default function CasesListPage() {
  const cases = useAppStore((s) => s.data.cases);
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q.trim()) return true;
      const s = q.trim().toLowerCase();
      return (
        c.address.toLowerCase().includes(s) ||
        c.caseNumber.toLowerCase().includes(s) ||
        c.sourceUrl.toLowerCase().includes(s)
      );
    });
  }, [cases, filter, q]);

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
          href="/cases/new"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          새 물건
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

      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-neutral-500">
            조건에 맞는 물건이 없습니다.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex flex-col gap-1 px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{c.address || "(주소 미입력)"}</div>
                  <div className="text-xs text-neutral-500">
                    {c.caseNumber && <span>{c.caseNumber} · </span>}
                    {STATUS_LABELS[c.status]}
                    {c.bidDate && (
                      <span>
                        {" "}
                        · 입찰 {c.bidDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-neutral-400">유찰 {c.bidRounds.filter((r) => r.result === "failed").length}회</div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
