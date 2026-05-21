"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { FieldIntelGuideView } from "@/components/field-intel-guide-view";
import {
  FIELD_INTEL_GUIDES,
  getFieldIntelGuide,
} from "@/lib/domain/field-intel";
import { useAppStore } from "@/store/app-store";

export function FieldIntelClient() {
  const searchParams = useSearchParams();
  const guideParam = searchParams.get("guide");
  const cases = useAppStore((s) => s.data.cases);
  const knowledgeNotes = useAppStore((s) => s.data.knowledgeNotes);

  const selectedId =
    guideParam && getFieldIntelGuide(guideParam)
      ? guideParam
      : FIELD_INTEL_GUIDES[0]?.id ?? "";
  const selectedGuide = getFieldIntelGuide(selectedId);

  const linkedCases = useMemo(() => {
    if (!selectedGuide) return [];
    return cases.filter((item) =>
      selectedGuide.addressKeywords.some((keyword) => {
        const haystack = `${item.address} ${item.caseNumber}`.toLowerCase();
        return haystack.includes(keyword.toLowerCase());
      }),
    );
  }, [cases, selectedGuide]);

  const guideNotes = useMemo(
    () =>
      knowledgeNotes.filter(
        (note) => note.fieldIntelGuideId === selectedId,
      ),
    [knowledgeNotes, selectedId],
  );

  return (
    <div className="space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">탐문·시장정보</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          현장에서 부동산·관리인과 나눈 대화를 지역별로 정리합니다. 주소가
          맞는 물건은 상세 <strong>임장 확인</strong> 탭에서 요약 카드로
          표시됩니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FIELD_INTEL_GUIDES.map((guide) => (
          <Link
            key={guide.id}
            href={`/field-intel?guide=${guide.id}`}
            className={`rounded-lg border px-3 py-2 text-sm ${
              guide.id === selectedId
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
            }`}
          >
            {guide.title}
          </Link>
        ))}
      </div>

      {selectedGuide ? (
        <>
          <FieldIntelGuideView guide={selectedGuide} />

          <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-medium">연결된 물건</h2>
            {linkedCases.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                키워드에 맞는 등록 물건이 없습니다. 주소에 지역명을 입력하면
                임장 탭에서 자동 연결됩니다.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {linkedCases.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/cases/${item.id}?tab=field_inspection`}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.caseNumber || item.address || item.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-medium">지식 노트</h2>
            {guideNotes.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">
                이 가이드에 연결된 노트가 없습니다. 데이터 화면에서 추가하거나
                물건 임장 탭에서 「이 물건에 노트 연결」을 사용하세요.
              </p>
            ) : (
              <ul className="mt-2 space-y-3 text-sm">
                {guideNotes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-900"
                  >
                    <div className="font-medium">{note.title}</div>
                    <div className="text-xs text-neutral-500">{note.category}</div>
                    {note.linkedCaseId && (
                      <Link
                        href={`/cases/${note.linkedCaseId}`}
                        className="mt-1 inline-block text-xs text-sky-700 underline dark:text-sky-300"
                      >
                        연결 물건 보기
                      </Link>
                    )}
                    {note.body && (
                      <p className="mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {note.body}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-neutral-500">표시할 탐문 가이드가 없습니다.</p>
      )}
    </div>
  );
}
