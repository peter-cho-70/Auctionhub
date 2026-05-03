"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus } from "@/lib/types/domain";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(t)) return null;
  const d = Math.ceil((t - Date.now()) / (86400 * 1000));
  return d;
}

function checklistProgress(c: {
  checklists: { items: { done: boolean }[] }[];
}) {
  let total = 0;
  let done = 0;
  for (const cl of c.checklists) {
    for (const it of cl.items) {
      total += 1;
      if (it.done) done += 1;
    }
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export default function DashboardPage() {
  const cases = useAppStore((s) => s.data.cases);

  const grouped = useMemo(() => {
    const g = new Map<CaseStatus, typeof cases>();
    for (const c of cases) {
      const arr = g.get(c.status) ?? [];
      arr.push(c);
      g.set(c.status, arr);
    }
    return g;
  }, [cases]);

  const active = cases.filter((c) => c.status !== "completed" && c.status !== "abandoned");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          진행 중 {active.length}건 · 전체 {cases.length}건
        </p>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
          <p className="text-neutral-600 dark:text-neutral-400">
            등록된 물건이 없습니다.
          </p>
          <Link
            href="/cases/new"
            className="mt-3 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            URL로 물건 등록
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {active.map((c) => {
            const d = daysUntil(c.bidDate);
            const pct = checklistProgress(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {c.address || c.caseNumber || "주소 미입력"}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {STATUS_LABELS[c.status]} · 체크리스트 {pct}%
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {d != null && (
                      <span
                        className={
                          d <= 3 && d >= 0
                            ? "font-semibold text-amber-700 dark:text-amber-400"
                            : "text-neutral-600 dark:text-neutral-400"
                        }
                      >
                        입찰일 D{d >= 0 ? `-${d}` : `+${-d}`}
                      </span>
                    )}
                    {c.bidDate == null && (
                      <span className="text-neutral-400">입찰일 미정</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="text-sm font-medium text-neutral-500">상태별 요약</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Array.from(grouped.entries()).map(([st, list]) => (
            <div
              key={st}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
            >
              <span className="text-neutral-500">{STATUS_LABELS[st]}</span>
              <span className="ml-2 font-semibold tabular-nums">{list.length}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
