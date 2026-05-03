import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_PROCESS_ORDER } from "@/lib/data/default-data";
import {
  getDefaultLectureBlocksForStep,
  LECTURE_CONTENT_CREDIT,
  LECTURE_NOTE_SOURCE,
} from "@/lib/data/lecture-guide";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import type { CaseStatus } from "@/lib/types/domain";

export const metadata: Metadata = {
  title: "경매 프로세스 공부하기 · AuctionFlow Pro",
  description: "강의 노트 정리본 미리보기 — 단계별로 읽으며 복습합니다.",
};

const STUDY_ORDER: CaseStatus[] = [...DEFAULT_PROCESS_ORDER, "abandoned"];

function stepAnchor(step: CaseStatus): string {
  return `study-${step}`;
}

export default function StudyPage() {
  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          경매 프로세스 공부하기
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          정리본 텍스트를 문서처럼 붙여 두었습니다. 왼쪽(넓은 화면) 목차에서 단계로
          이동하거나 아래로 스크롤해 연속으로 읽을 수 있습니다.           실무 체크리스트·노트
          편집은{" "}
          <Link
            href="/process"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            프로세스
          </Link>
          에서 다룹니다. DOCX 원본은{" "}
          <Link
            href="/lectures"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            원본 자료
          </Link>
          에서 미리보기·다운로드할 수 있습니다.
        </p>
        <p className="text-xs text-neutral-500">{LECTURE_NOTE_SOURCE}</p>
        <p className="text-xs text-neutral-500">{LECTURE_CONTENT_CREDIT}</p>
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
            {STUDY_ORDER.map((step) => (
              <a
                key={step}
                href={`#${stepAnchor(step)}`}
                className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900 lg:border-0 lg:bg-transparent lg:px-2 lg:py-1 lg:hover:bg-neutral-100 lg:dark:hover:bg-neutral-900"
              >
                {STATUS_LABELS[step]}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-10">
          <div
            className="rounded-xl border border-neutral-200/90 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-none"
            role="article"
            aria-label="강의 노트 미리보기"
          >
            <div className="border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">미리보기 · 읽기 전용</p>
              <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
                다가구 경매 핵심 강의노트 — 단계별 편집
              </p>
            </div>

            <div className="space-y-12 px-6 py-8 sm:px-10 sm:py-10">
              {STUDY_ORDER.map((step) => {
                const blocks = getDefaultLectureBlocksForStep(step);
                return (
                  <section
                    key={step}
                    id={stepAnchor(step)}
                    className="scroll-mt-24 border-b border-neutral-100 pb-12 last:border-b-0 last:pb-0 dark:border-neutral-800"
                  >
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                      {STATUS_LABELS[step]}
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      앱 진행 단계와 같은 순서로 묶었습니다.
                    </p>
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
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
