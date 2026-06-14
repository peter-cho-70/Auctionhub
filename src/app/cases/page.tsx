"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppExperienceToggle } from "@/components/app-experience-toggle";
import { CaseListRecoveryBanner } from "@/components/case-list-recovery-banner";
import { useAppStore } from "@/store/app-store";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import {
  CaseListThumbnailEditor,
  CaseListThumbnailImg,
} from "@/components/case-list-thumbnail-ui";
import type { AuctionCase, CaseListColor, CaseStatus } from "@/lib/types/domain";
import { computeMultiFamilyScore } from "@/lib/domain/multifamily-analysis";
import {
  effectivePriorityLevel,
  PRIORITY_LEVEL_LABELS,
} from "@/lib/domain/case-priority";
import {
  CASE_LIST_COLOR_META,
  CASE_LIST_COLORS,
  caseListRowClass,
  caseListTitle,
} from "@/lib/domain/case-list-display";
import { CaseListTitleInput } from "@/components/case-list-title-input";
import { LAST_SELECTED_CASE_KEY } from "@/lib/constants/storage";
import {
  readAppExperienceMode,
  type AppExperienceMode,
  writeAppExperienceMode,
} from "@/lib/ui/app-experience-mode";

function sourceDocumentLabels(
  documents: Array<{ kind: string }> | undefined,
): string[] {
  const kinds = new Set((documents ?? []).map((doc) => doc.kind));
  const labels = [
    kinds.has("daejangauction-pdf") ||
    kinds.has("speedauction-pdf") ||
    kinds.has("auctionone-pdf")
      ? "경매 PDF"
      : "",
    kinds.has("building-ledger") ? "건축물대장" : "",
    kinds.has("tenant-report") ? "매각물건명세서/임차" : "",
    kinds.has("expected-dividend") ? "예상배당표" : "",
    kinds.has("appraisal-report") ? "감정평가서" : "",
    kinds.has("registry-building") || kinds.has("registry-land") ? "등기부" : "",
  ].filter(Boolean);
  return labels.length > 0 ? labels : (documents ?? []).length > 0 ? ["원문 자료"] : [];
}

function CaseListColorPicker({
  value,
  onChange,
}: {
  value: CaseListColor;
  onChange: (color: CaseListColor) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1"
      role="group"
      aria-label="목록 색상"
      onClick={(e) => e.preventDefault()}
    >
      {CASE_LIST_COLORS.map((color) => {
        const meta = CASE_LIST_COLOR_META[color];
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            title={meta.label}
            aria-label={meta.label}
            aria-pressed={active}
            onClick={(e) => {
              e.stopPropagation();
              onChange(active ? null : color);
            }}
            className={`h-5 w-5 rounded-full ${meta.dot} transition ${
              active
                ? `ring-2 ring-offset-2 ${meta.ring} dark:ring-offset-neutral-950`
                : "opacity-70 hover:opacity-100"
            }`}
          />
        );
      })}
    </div>
  );
}

function CaseListRow({
  caseData,
  selected,
  onSelect,
  onUpdate,
}: {
  caseData: AuctionCase;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<Pick<AuctionCase, "listTitle" | "listColor">>) => void;
}) {
  const score = computeMultiFamilyScore(caseData);
  const priorityLevel = effectivePriorityLevel(caseData);
  const sourceLabels = sourceDocumentLabels(caseData.sourceDocuments);
  const subtitle = [caseData.caseNumber, caseData.address || "(주소 미입력)"]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={caseListRowClass(caseData.listColor, selected)}>
      <div className="flex items-start gap-2 px-3 py-2">
        <CaseListColorPicker
          value={caseData.listColor}
          onChange={(listColor) => onUpdate({ listColor })}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <CaseListTitleInput
              caseData={caseData}
              stopPropagation
              onSave={(listTitle) => onUpdate({ listTitle })}
            />
            <span className="shrink-0 text-xs text-neutral-500">
              {PRIORITY_LEVEL_LABELS[priorityLevel]} · 다가구 {score.grade}{" "}
              {score.totalScore}점
            </span>
          </div>
          <Link
            href={`/cases/${caseData.id}`}
            onClick={onSelect}
            className="mt-0.5 block rounded-md transition hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50"
          >
            {caseData.listTitle.trim() ? (
              <p className="truncate px-1 text-[11px] text-neutral-500">{subtitle}</p>
            ) : null}
            <div className="flex items-start gap-2 px-1 pb-0.5">
              <CaseListThumbnailImg
                caseId={caseData.id}
                thumbnail={caseData.listThumbnail}
                className="h-12 w-12 rounded-md object-cover"
                placeholderClassName="h-12 w-12 rounded-md border border-dashed border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60"
              />
              <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                <span>
                  {STATUS_LABELS[caseData.status]}
                  {caseData.bidDate ? ` · 입찰 ${caseData.bidDate}` : ""}
                  {" · "}유찰{" "}
                  {caseData.bidRounds.filter((r) => r.result === "failed").length}회
                </span>
                {sourceLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded bg-neutral-100 px-1.5 py-px text-[11px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function CasesListPage() {
  const cases = useAppStore((s) => s.data.cases);
  const updateCase = useAppStore((s) => s.updateCase);
  const [experienceMode, setExperienceMode] = useState<AppExperienceMode>(() =>
    readAppExperienceMode(),
  );
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
          (c.listTitle ?? "").toLowerCase().includes(s) ||
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
            {experienceMode === "renewal"
              ? "PDF로 등록한 물건을 한 페이지 시트로 볼 수 있습니다."
              : "색상·제목을 목록에서 바로 바꿀 수 있습니다. 제목을 비우면 사건번호·주소가 표시됩니다."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppExperienceToggle
            compact
            value={experienceMode}
            onChange={(mode) => {
              writeAppExperienceMode(mode);
              setExperienceMode(mode);
            }}
          />
          <Link
            href={experienceMode === "renewal" ? "/cases/import" : "/cases/import-pdf"}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            PDF 등록
          </Link>
        </div>
      </div>

      <CaseListRecoveryBanner compact />

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">색상</span>
        {CASE_LIST_COLORS.map((color) => (
          <span key={color} className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full ${CASE_LIST_COLOR_META[color].dot}`}
            />
            {CASE_LIST_COLOR_META[color].label}
          </span>
        ))}
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
          placeholder="제목, 주소, 사건번호, URL 검색…"
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
            {caseListTitle(lastSelectedCase)}
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            클릭하면 이전에 보던 상세정보를 다시 엽니다.
          </span>
        </Link>
      )}

      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
        {filtered.length === 0 ? (
          <li className="p-6 text-center text-sm text-neutral-500">
            {cases.length === 0
              ? "등록된 물건이 없습니다. 위 「백업 물건 복원」 또는 PDF 등록을 이용하세요."
              : "조건에 맞는 물건이 없습니다."}
          </li>
        ) : (
          filtered.map((c) => (
            <CaseListRow
              key={c.id}
              caseData={c}
              selected={c.id === lastSelectedCaseId}
              onSelect={() => {
                window.localStorage.setItem(LAST_SELECTED_CASE_KEY, c.id);
                setLastSelectedCaseId(c.id);
              }}
              onUpdate={(patch) => updateCase(c.id, patch)}
            />
          ))
        )}
      </ul>
    </div>
  );
}
