"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  REMODELING_PHASES,
  REMODELING_PRINCIPLES,
  defaultCostLinesForPhase,
  defaultChecklistForPhase,
  getPhaseMeta,
  lineTotalManwon,
} from "@/lib/domain/remodeling";
import type { RemodelingPhase } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

function formatManwon(n: number): string {
  return `${n.toLocaleString("ko-KR")}만원`;
}

export function RemodelingGuideClient() {
  const cases = useAppStore((s) => s.data.cases);
  const [phase, setPhase] = useState<RemodelingPhase>("phase1");
  const meta = getPhaseMeta(phase);
  const checklist = useMemo(() => defaultChecklistForPhase(phase), [phase]);
  const costLines = useMemo(() => defaultCostLinesForPhase(phase), [phase]);
  const sampleTotal = useMemo(
    () =>
      costLines
        .map((line) => ({ ...line, selected: true }))
        .reduce((sum, line) => sum + lineTotalManwon(line), 0),
    [costLines],
  );

  const casesWithRemodeling = cases.filter((item) => {
    const r = item.remodeling;
    if ((r.unitAssignments?.length ?? 0) > 0) return true;
    if (
      r.scenarios?.some(
        (s) =>
          s.roomProfiles.some((p) => p.costLines.some((l) => l.selected)) ||
          s.buildingCostLines.some((l) => l.selected),
      )
    ) {
      return true;
    }
    return ((r as { units?: unknown[] }).units?.length ?? 0) > 0;
  });

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          3단계 현실적 리모델링 전략
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          완벽한 리모델링이 아니라 <strong>수익이 나는 순서</strong>로 공사하는
          방법입니다. 물건 상세의{" "}
          <strong>리모델링</strong> 탭에서 호실별로 체크·비용을 기록할 수
          있습니다.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">연결된 물건</h2>
        {casesWithRemodeling.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            아직 리모델링을 기록한 물건이 없습니다.{" "}
            <Link href="/cases" className="underline underline-offset-2">
              물건 목록
            </Link>
            에서 상세 → 리모델링 탭을 열어 주세요.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {casesWithRemodeling.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/cases/${item.id}`}
                  className="text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
                >
                  {item.caseNumber || item.address || item.id}
                </Link>
                <span className="ml-2 text-neutral-500">
                  {(item.remodeling.unitAssignments?.length ??
                    (item.remodeling as { units?: unknown[] }).units?.length ??
                    0)}
                  호실
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {REMODELING_PHASES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPhase(item.id)}
            className={`rounded-xl border p-4 text-left transition ${
              phase === item.id
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
            }`}
          >
            <p className="text-xs opacity-80">{item.period}</p>
            <p className="mt-1 font-semibold">{item.label}</p>
            <p className="mt-2 text-xs opacity-90">
              {item.budgetMinManwon}~{item.budgetMaxManwon}만원 · {item.goal}
            </p>
          </button>
        ))}
      </section>

      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">{meta.label}</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {meta.summary}
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          기간 {meta.period} · 호실(또는 건물) 예산 가이드{" "}
          {meta.budgetMinManwon}~{meta.budgetMaxManwon}만원 · 전 항목 선택 시
          참고 합계 약 {formatManwon(sampleTotal)}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-semibold">진단 체크리스트</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className="py-2 pr-2">항목</th>
                  <th className="py-2 pr-2">확인</th>
                  <th className="py-2 pr-2">양호</th>
                  <th className="py-2">조치</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-2 font-medium">{item.label}</td>
                    <td className="py-2 pr-2 text-neutral-600 dark:text-neutral-400">
                      {item.method}
                    </td>
                    <td className="py-2 pr-2 text-neutral-600 dark:text-neutral-400">
                      {item.okCriteria}
                    </td>
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">
                      {item.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-semibold">비용 항목 (만원)</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className="py-2 pr-2">항목</th>
                  <th className="py-2 pr-2">자재</th>
                  <th className="py-2 pr-2">인건비</th>
                  <th className="py-2 pr-2">DIY</th>
                  <th className="py-2">효과</th>
                </tr>
              </thead>
              <tbody>
                {costLines.map((line) => (
                  <tr key={line.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 pr-2 font-medium">{line.item}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      {line.materialManwon ?? "—"}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">
                      {line.laborManwon ?? "—"}
                    </td>
                    <td className="py-2 pr-2">{line.diy ? "가능" : "—"}</td>
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">
                      {line.effectNote}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">5가지 원칙</h2>
        <ol className="mt-4 space-y-4">
          {REMODELING_PRINCIPLES.map((item, index) => (
            <li key={item.title}>
              <p className="font-medium">
                {index + 1}. {item.title}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
