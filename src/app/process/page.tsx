"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus, ChecklistTemplateItem } from "@/lib/types/domain";
import { DEFAULT_PROCESS_ORDER } from "@/lib/data/default-data";
import {
  getDefaultLectureGuideForStep,
  getResolvedLectureGuide,
  LECTURE_NOTE_SOURCE,
} from "@/lib/data/lecture-guide";

function newTemplateItemId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cti-${Date.now()}`;
}

type Panel = "checklist" | "lecture";

export default function ProcessPage() {
  const data = useAppStore((s) => s.data);
  const setChecklistTemplateForStep = useAppStore(
    (s) => s.setChecklistTemplateForStep,
  );
  const setLectureGuideForStep = useAppStore((s) => s.setLectureGuideForStep);
  const clearLectureGuideForStep = useAppStore(
    (s) => s.clearLectureGuideForStep,
  );

  const order =
    data.processStepOrder.length > 0
      ? data.processStepOrder
      : DEFAULT_PROCESS_ORDER;

  const [step, setStep] = useState<CaseStatus>(order[0]);
  const [panel, setPanel] = useState<Panel>("checklist");

  const activeStep = order.includes(step) ? step : order[0];

  const items = data.checklistTemplates[activeStep] ?? [];

  const lectureGuideByStep = data.lectureGuideByStep;
  const resolvedLecture = useMemo(
    () => getResolvedLectureGuide(activeStep, lectureGuideByStep),
    [activeStep, lectureGuideByStep],
  );

  const hasCustomLecture =
    lectureGuideByStep?.[activeStep] !== undefined;

  const updateItems = (next: ChecklistTemplateItem[]) => {
    setChecklistTemplateForStep(activeStep, next);
  };

  const addRow = () => {
    updateItems([
      ...items,
      {
        id: newTemplateItemId(),
        label: "",
        required: false,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          프로세스 · 체크리스트
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          왼쪽에서 <strong>체크리스트 템플릿</strong> 문구를 수정·추가하면 바로
          저장됩니다. 오른쪽 <strong>강의 노트</strong>는 입력 시 자동
          저장됩니다. 새 물건에만 템플릿이
          자동 적용되고, 기존 물건은 상세 화면에서 &quot;재생성&quot;이
          필요합니다.
        </p>
        <p className="mt-1 text-xs text-neutral-500">{LECTURE_NOTE_SOURCE}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStep(st)}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              activeStep === st
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "border border-neutral-200 dark:border-neutral-800"
            }`}
          >
            {STATUS_LABELS[st]}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg border border-neutral-200 p-1 md:hidden dark:border-neutral-800">
        <button
          type="button"
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            panel === "checklist"
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : ""
          }`}
          onClick={() => setPanel("checklist")}
        >
          체크리스트
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            panel === "lecture"
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : ""
          }`}
          onClick={() => setPanel("lecture")}
        >
          강의 노트
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          className={`rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 ${
            panel !== "checklist" ? "hidden md:block" : ""
          }`}
        >
          <h2 className="font-medium">{STATUS_LABELS[activeStep]} — 템플릿</h2>
          <p className="mt-1 text-xs text-neutral-500">
            각 행의 문구·필수 여부를 바꾸거나 삭제·추가할 수 있습니다.
          </p>
          <ul className="mt-4 space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.id}
                className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-2 sm:flex-row sm:items-center dark:border-neutral-900"
              >
                <input
                  className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  placeholder="체크리스트 문구"
                  value={it.label}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...it, label: e.target.value };
                    updateItems(next);
                  }}
                />
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={it.required}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, required: e.target.checked };
                      updateItems(next);
                    }}
                  />
                  필수
                </label>
                <button
                  type="button"
                  className="text-xs text-rose-600 hover:underline"
                  onClick={() => {
                    updateItems(items.filter((x) => x.id !== it.id));
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addRow}
            className="mt-4 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            항목 추가
          </button>
        </section>

        <section
          className={`flex flex-col rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 ${
            panel !== "lecture" ? "hidden md:block" : ""
          }`}
        >
          <h2 className="font-medium text-amber-950 dark:text-amber-100">
            강의 노트 — {STATUS_LABELS[activeStep]}
          </h2>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            {hasCustomLecture
              ? "이 단계는 사용자 편집본이 저장되어 있습니다. 입력 시마다 자동 저장됩니다."
              : "기본 노트가 표시됩니다. 처음 수정할 때 포커스하면 이 단계에 복사본이 저장됩니다."}
          </p>
          <textarea
            className="mt-3 min-h-[min(55vh,520px)] w-full flex-1 resize-y rounded-lg border border-amber-200/90 bg-white/90 p-3 font-mono text-sm leading-relaxed text-neutral-900 dark:border-amber-900/60 dark:bg-neutral-950/80 dark:text-neutral-100"
            spellCheck={false}
            value={resolvedLecture}
            onFocus={() => {
              if (lectureGuideByStep?.[activeStep] === undefined) {
                setLectureGuideForStep(
                  activeStep,
                  getDefaultLectureGuideForStep(activeStep),
                );
              }
            }}
            onChange={(e) =>
              setLectureGuideForStep(activeStep, e.target.value)
            }
            aria-label="강의 노트 편집"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setLectureGuideForStep(
                  activeStep,
                  getDefaultLectureGuideForStep(activeStep),
                )
              }
              className="rounded-lg border border-amber-800/40 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:text-amber-100"
            >
              기본 노트 문구로 덮어쓰기
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "저장된 사용자 노트를 삭제하고 앱 기본 노트만 표시합니다.",
                  )
                ) {
                  clearLectureGuideForStep(activeStep);
                }
              }}
              className="rounded-lg border border-neutral-400 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
            >
              저장본 삭제(기본값만 표시)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
