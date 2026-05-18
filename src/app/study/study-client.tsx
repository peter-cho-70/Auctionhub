"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEFAULT_PROCESS_ORDER } from "@/lib/data/default-data";
import {
  getDefaultLectureBlocksForStep,
  getDefaultLectureGuideForStep,
  getResolvedLectureGuide,
  LECTURE_CONTENT_CREDIT,
  LECTURE_NOTE_SOURCE,
  type LectureGuideBlock,
} from "@/lib/data/lecture-guide";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

const STUDY_ORDER: CaseStatus[] = [...DEFAULT_PROCESS_ORDER, "abandoned"];

function parseLectureBlocks(text: string): LectureGuideBlock[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const matches = [...normalized.matchAll(/【([^】]+)】\n?/g)];
  if (matches.length === 0) {
    return [{ heading: "사용자 노트", body: normalized }];
  }
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    return {
      heading: match[1]!.trim(),
      body: normalized.slice(start, end).trim(),
    };
  });
}

function blocksForStep(
  step: CaseStatus,
  overrides: Partial<Record<CaseStatus, string>>,
): LectureGuideBlock[] {
  const custom = overrides?.[step];
  if (custom !== undefined) return parseLectureBlocks(custom);
  return getDefaultLectureBlocksForStep(step);
}

export function StudyClient() {
  const lectureGuideByStep = useAppStore((s) => s.data.lectureGuideByStep);
  const setLectureGuideForStep = useAppStore((s) => s.setLectureGuideForStep);
  const clearLectureGuideForStep = useAppStore((s) => s.clearLectureGuideForStep);
  const [selectedStep, setSelectedStep] = useState<CaseStatus>("researching");
  const [editingStep, setEditingStep] = useState<CaseStatus | null>(null);

  const customCount = useMemo(
    () => Object.keys(lectureGuideByStep ?? {}).length,
    [lectureGuideByStep],
  );

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          경매 프로세스 공부하기
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          강의 내용을 단계별 문서처럼 읽고, 필요한 부분은 직접 수정해 저장할 수
          있습니다. 저장된 내용은 프로세스의 강의 노트와 함께 반영됩니다. DOCX
          원본은{" "}
          <Link
            href="/lectures"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            강의 원본
          </Link>
          에서 미리보기·다운로드할 수 있습니다.
        </p>
        <p className="text-xs text-neutral-500">{LECTURE_NOTE_SOURCE}</p>
        <p className="text-xs text-neutral-500">{LECTURE_CONTENT_CREDIT}</p>
        {customCount > 0 && (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            사용자 편집본 {customCount}개 단계가 저장되어 있습니다.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            목차 (프로세스 단계)
          </p>
          <nav
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            aria-label="학습 목차"
          >
            {STUDY_ORDER.map((step) => {
              const selected = selectedStep === step;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    setSelectedStep(step);
                    setEditingStep(null);
                  }}
                  className={`shrink-0 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors lg:px-2 lg:py-1 ${
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900 lg:border-0 lg:bg-transparent lg:hover:bg-neutral-100 lg:dark:hover:bg-neutral-900"
                  }`}
                >
                  {STATUS_LABELS[step]}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-10">
          <div
            className="rounded-xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none"
            role="article"
            aria-label="강의 노트 미리보기"
          >
            <div className="border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">읽기·편집 가능</p>
              <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                다가구 경매 핵심 강의노트 — 단계별 저장본
              </p>
            </div>

            <div className="px-6 py-8 sm:px-10 sm:py-10">
              {(() => {
                const step = selectedStep;
                const blocks = blocksForStep(step, lectureGuideByStep ?? {});
                const resolvedLecture = getResolvedLectureGuide(step, lectureGuideByStep);
                const hasCustom = lectureGuideByStep?.[step] !== undefined;
                const editing = editingStep === step;
                return (
                  <section
                    key={step}
                    className="border-b border-neutral-100 pb-12 last:border-b-0 last:pb-0 dark:border-neutral-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                          {STATUS_LABELS[step]}
                        </h2>
                        <p className="mt-1 text-xs text-neutral-500">
                          {hasCustom
                            ? "사용자 편집본이 표시되고 있습니다."
                            : "앱 기본 강의 노트가 표시되고 있습니다."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasCustom) {
                              setLectureGuideForStep(
                                step,
                                getDefaultLectureGuideForStep(step),
                              );
                            }
                            setEditingStep(editing ? null : step);
                          }}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700"
                        >
                          {editing ? "보기로 돌아가기" : "수정"}
                        </button>
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("이 단계의 저장본을 삭제하고 기본 노트로 되돌릴까요?")) {
                                clearLectureGuideForStep(step);
                                if (editingStep === step) setEditingStep(null);
                              }
                            }}
                            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-800 dark:text-rose-300"
                          >
                            저장본 삭제
                          </button>
                        )}
                      </div>
                    </div>

                    {editing ? (
                      <textarea
                        className="mt-6 min-h-[360px] w-full resize-y rounded-lg border border-amber-200 bg-amber-50/40 p-3 font-mono text-sm leading-relaxed text-neutral-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-neutral-100"
                        value={resolvedLecture}
                        spellCheck={false}
                        onChange={(e) =>
                          setLectureGuideForStep(step, e.target.value)
                        }
                        aria-label={`${STATUS_LABELS[step]} 강의 노트 편집`}
                      />
                    ) : (
                      <div className="mt-6 space-y-8">
                        {blocks.map((block, idx) => (
                          <div key={`${step}-${idx}`}>
                            <h3 className="text-base font-medium text-amber-950 dark:text-amber-100">
                              {block.heading}
                            </h3>
                            <div className="mt-2 whitespace-pre-wrap border-l-2 border-amber-200/80 pl-4 text-sm leading-relaxed text-neutral-800 dark:border-amber-900/60 dark:text-neutral-200">
                              {block.body}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
