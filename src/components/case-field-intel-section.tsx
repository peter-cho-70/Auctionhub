"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AuctionCase, KnowledgeNote } from "@/lib/types/domain";
import {
  buildFieldSurveySnippet,
  DEFAULT_FIELD_INTEL_KNOWLEDGE_NOTE,
  getFieldIntelGuide,
  knowledgeNotesForCase,
  matchFieldIntelGuides,
} from "@/lib/domain/field-intel";
import { useAppStore } from "@/store/app-store";

type Props = {
  caseData: AuctionCase;
  onAppendFieldSurvey?: (text: string) => void;
};

const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";

export function CaseFieldIntelSection({ caseData, onAppendFieldSurvey }: Props) {
  const knowledgeNotes = useAppStore((s) => s.data.knowledgeNotes);
  const addKnowledgeNote = useAppStore((s) => s.addKnowledgeNote);

  const matchedGuides = useMemo(() => matchFieldIntelGuides(caseData), [caseData]);
  const guideIds = matchedGuides.map((guide) => guide.id);

  const relatedNotes = useMemo(
    () => knowledgeNotesForCase(knowledgeNotes, caseData.id, guideIds),
    [knowledgeNotes, caseData.id, guideIds],
  );

  if (matchedGuides.length === 0 && relatedNotes.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
        <p>
          이 주소에 연결된 <strong>탐문·시장정보</strong>가 없습니다.{" "}
          <Link href="/field-intel" className="underline underline-offset-2">
            탐문 가이드
          </Link>
          를 확인하거나, 데이터 화면에서 지식 노트를 이 물건에 연결하세요.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sky-950 dark:text-sky-100">
            지역 탐문 참고
          </h3>
          <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-200/80">
            주소·사건명 기준으로 연결된 현장 탐문 정리입니다.
          </p>
        </div>
        <Link href="/field-intel" className={`${BTN} text-sky-900 dark:text-sky-100`}>
          전체 가이드
        </Link>
      </div>

      {matchedGuides.map((guide) => (
        <article
          key={guide.id}
          className="rounded-lg border border-sky-100 bg-white/90 p-3 dark:border-sky-900 dark:bg-neutral-950/80"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/field-intel?guide=${guide.id}`}
                className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
              >
                {guide.title}
              </Link>
              <p className="mt-0.5 text-xs text-neutral-500">
                {guide.exploredAt} · {guide.duration}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onAppendFieldSurvey && (
                <button
                  type="button"
                  className={BTN}
                  onClick={() => onAppendFieldSurvey(buildFieldSurveySnippet(guide))}
                >
                  임장조사에 요약 붙이기
                </button>
              )}
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  const existing = knowledgeNotes.find(
                    (note) =>
                      note.fieldIntelGuideId === guide.id &&
                      note.linkedCaseId === caseData.id,
                  );
                  if (existing) return;
                  addKnowledgeNote({
                    ...DEFAULT_FIELD_INTEL_KNOWLEDGE_NOTE,
                    linkedCaseId: caseData.id,
                    fieldIntelGuideId: guide.id,
                  });
                }}
              >
                이 물건에 노트 연결
              </button>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            {guide.summaryBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}

      {relatedNotes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">연결된 지식 노트</h4>
          <ul className="space-y-2 text-sm">
            {relatedNotes.map((note) => (
              <KnowledgeNoteCard key={note.id} note={note} caseId={caseData.id} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function KnowledgeNoteCard({
  note,
  caseId,
}: {
  note: KnowledgeNote;
  caseId: string;
}) {
  const guide = note.fieldIntelGuideId
    ? getFieldIntelGuide(note.fieldIntelGuideId)
    : undefined;
  return (
    <li className="rounded-lg border border-neutral-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span className="font-medium text-neutral-800 dark:text-neutral-200">
          {note.title}
        </span>
        <span>{note.category}</span>
        {note.linkedCaseId === caseId ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            이 물건
          </span>
        ) : (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">
            지역 공통
          </span>
        )}
        {guide && (
          <Link
            href={`/field-intel?guide=${guide.id}`}
            className="text-sky-700 underline dark:text-sky-300"
          >
            가이드
          </Link>
        )}
      </div>
      {note.body && (
        <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
          {note.body}
        </p>
      )}
    </li>
  );
}
