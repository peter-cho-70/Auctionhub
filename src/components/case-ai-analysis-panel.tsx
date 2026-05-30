"use client";

import { useCallback, useRef, useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { MarkdownTablePreview } from "@/components/markdown-table-preview";
import {
  createExternalAiQaEntry,
  EXTERNAL_AI_QA_CATEGORY_LABEL,
  moveExternalAiQaEntry,
} from "@/lib/domain/external-ai-qa";
import type {
  AuctionCase,
  ExternalAiQaCategory,
  ExternalAiQaEntry,
} from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const MONO_INPUT =
  `${INPUT} font-mono text-xs leading-relaxed whitespace-pre-wrap`;
const SELECT =
  "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

const CATEGORY_OPTIONS = Object.keys(
  EXTERNAL_AI_QA_CATEGORY_LABEL,
) as ExternalAiQaCategory[];

type Props = {
  caseData: AuctionCase;
  onUpdateCase: (patch: Pick<AuctionCase, "externalAiQa">) => void;
};

function touchEntry(entry: ExternalAiQaEntry): ExternalAiQaEntry {
  return { ...entry, updatedAt: new Date().toISOString() };
}

export function CaseAiAnalysisPanel({ caseData, onUpdateCase }: Props) {
  const sharedEntries = useAppStore((s) => s.data.sharedExternalAiQa ?? []);
  const setSharedExternalAiQa = useAppStore((s) => s.setSharedExternalAiQa);

  const onUpdateCaseRef = useRef(onUpdateCase);
  onUpdateCaseRef.current = onUpdateCase;

  const caseRef = useRef(caseData);
  caseRef.current = caseData;

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftCategory, setDraftCategory] =
    useState<ExternalAiQaCategory>("market");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftFormKey, setDraftFormKey] = useState(0);

  const markSaved = () => setSavedAt(Date.now());

  const saveCaseEntries = useCallback((entries: ExternalAiQaEntry[]) => {
    onUpdateCaseRef.current({ externalAiQa: entries });
    markSaved();
  }, []);

  const saveSharedEntries = useCallback(
    (entries: ExternalAiQaEntry[]) => {
      setSharedExternalAiQa(entries);
      markSaved();
    },
    [setSharedExternalAiQa],
  );

  const updateCaseEntry = useCallback(
    (entryId: string, patch: Partial<ExternalAiQaEntry>) => {
      const base = caseRef.current.externalAiQa ?? [];
      saveCaseEntries(
        base.map((e) =>
          e.id === entryId ? touchEntry({ ...e, ...patch }) : e,
        ),
      );
    },
    [saveCaseEntries],
  );

  const updateSharedEntry = useCallback(
    (entryId: string, patch: Partial<ExternalAiQaEntry>) => {
      const current = useAppStore.getState().data.sharedExternalAiQa ?? [];
      saveSharedEntries(
        current.map((e) =>
          e.id === entryId ? touchEntry({ ...e, ...patch }) : e,
        ),
      );
    },
    [saveSharedEntries],
  );

  const addEntry = () => {
    const q = draftQuestion.trim();
    const a = draftAnswer.trim();
    if (!q && !a) return;
    const entry = createExternalAiQaEntry(draftCategory, {
      question: draftQuestion,
      answer: draftAnswer,
    });
    saveCaseEntries([...(caseRef.current.externalAiQa ?? []), entry]);
    setDraftQuestion("");
    setDraftAnswer("");
    setDraftCategory("market");
    setDraftFormKey((k) => k + 1);
  };

  const toggleCommon = (entry: ExternalAiQaEntry, isShared: boolean) => {
    if (isShared) {
      if (
        !confirm(
          "공통 항목을 해제하면 이 물건에만 남습니다. 다른 물건에서는 보이지 않습니다. 계속할까요?",
        )
      ) {
        return;
      }
      const nextShared = sharedEntries.filter((e) => e.id !== entry.id);
      const moved: ExternalAiQaEntry = {
        ...entry,
        originCaseId: caseData.id,
        updatedAt: new Date().toISOString(),
      };
      saveSharedEntries(nextShared);
      saveCaseEntries([...(caseRef.current.externalAiQa ?? []), moved]);
      return;
    }
    if (
      !confirm(
        "공통으로 저장하면 모든 경매 물건의 「AI 분석」 탭에 표시됩니다. 계속할까요?",
      )
    ) {
      return;
    }
    const moved: ExternalAiQaEntry = {
      ...entry,
      originCaseId: caseData.id,
      updatedAt: new Date().toISOString(),
    };
    saveCaseEntries(
      (caseRef.current.externalAiQa ?? []).filter((e) => e.id !== entry.id),
    );
    saveSharedEntries([
      ...(useAppStore.getState().data.sharedExternalAiQa ?? []),
      moved,
    ]);
  };

  const deleteShared = (entryId: string) => {
    if (
      !confirm(
        "공통 Q&A를 삭제하면 모든 물건에서 사라집니다. 삭제할까요?",
      )
    ) {
      return;
    }
    saveSharedEntries(sharedEntries.filter((e) => e.id !== entryId));
  };

  return (
    <div className="space-y-6">
      {savedAt != null && Date.now() - savedAt < 4000 && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">저장됨</p>
      )}

      <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
        <h3 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
          AI 분석 Q&A
        </h3>
        <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/80">
          ChatGPT·Gemini 등 외부에서 물어본 내용을 질문·답으로 붙여넣어 보관합니다.
          표(| 열 |)가 포함된 답변은 아래에 표 미리보기가 표시됩니다.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
        <h4 className="text-sm font-medium">새 Q&A 추가</h4>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-neutral-500">
            주제
            <select
              className={`${SELECT} ml-1`}
              value={draftCategory}
              onChange={(e) =>
                setDraftCategory(e.target.value as ExternalAiQaCategory)
              }
            >
              {CATEGORY_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {EXTERNAL_AI_QA_CATEGORY_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs text-neutral-500">
          질문
          <AutoGrowTextarea
            key={`dq-${draftFormKey}`}
            className={MONO_INPUT}
            value={draftQuestion}
            onChange={(e) => setDraftQuestion(e.target.value)}
            placeholder="예: 이 동네 1.5룸 월세 추이는?"
          />
        </label>
        <label className="mt-3 block text-xs text-neutral-500">
          답변
          <AutoGrowTextarea
            key={`da-${draftFormKey}`}
            className={MONO_INPUT}
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            placeholder="AI 답변을 붙여넣기"
          />
        </label>
        {draftAnswer.trim() && (
          <MarkdownTablePreview text={draftAnswer} />
        )}
        <button type="button" className={`${BTN} mt-3`} onClick={addEntry}>
          + 이 물건에 추가
        </button>
      </section>

      <QaSection
        title="이 물건"
        description="이 사건에만 해당하는 Q&A입니다. ▲▼로 순서를 바꿀 수 있습니다."
        entries={caseData.externalAiQa ?? []}
        isShared={false}
        caseId={caseData.id}
        onUpdateEntry={updateCaseEntry}
        onMove={(index, direction) =>
          saveCaseEntries(
            moveExternalAiQaEntry(caseData.externalAiQa ?? [], index, direction),
          )
        }
        onToggleCommon={(entry) => toggleCommon(entry, false)}
        onDelete={(entryId) =>
          saveCaseEntries(
            (caseData.externalAiQa ?? []).filter((e) => e.id !== entryId),
          )
        }
      />

      <QaSection
        title="공통 (모든 물건)"
        description="구·동 단위 시세, 임차 수요 등 다른 물건에도 통하는 내용입니다. 순서 변경은 모든 물건에 동일하게 적용됩니다."
        entries={sharedEntries}
        isShared
        caseId={caseData.id}
        onUpdateEntry={updateSharedEntry}
        onMove={(index, direction) =>
          saveSharedEntries(
            moveExternalAiQaEntry(sharedEntries, index, direction),
          )
        }
        onToggleCommon={(entry) => toggleCommon(entry, true)}
        onDelete={deleteShared}
      />
    </div>
  );
}

function QaSection({
  title,
  description,
  entries,
  isShared,
  caseId,
  onUpdateEntry,
  onMove,
  onToggleCommon,
  onDelete,
}: {
  title: string;
  description: string;
  entries: ExternalAiQaEntry[];
  isShared: boolean;
  caseId: string;
  onUpdateEntry: (entryId: string, patch: Partial<ExternalAiQaEntry>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onToggleCommon: (entry: ExternalAiQaEntry) => void;
  onDelete: (entryId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div>
        <h4 className="text-sm font-medium">{title}</h4>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">항목이 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-neutral-500">
                  주제
                  <select
                    className={`${SELECT} ml-1`}
                    value={entry.category}
                    onChange={(e) =>
                      onUpdateEntry(entry.id, {
                        category: e.target.value as ExternalAiQaCategory,
                      })
                    }
                  >
                    {CATEGORY_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {EXTERNAL_AI_QA_CATEGORY_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={() => onToggleCommon(entry)}
                  />
                  공통
                </label>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={BTN}
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                    title="위로"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={BTN}
                    disabled={index === entries.length - 1}
                    onClick={() => onMove(index, 1)}
                    title="아래로"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-600 dark:text-rose-400"
                    onClick={() => onDelete(entry.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
              {isShared &&
                entry.originCaseId &&
                entry.originCaseId !== caseId && (
                  <p className="mt-1 text-[10px] text-neutral-400">
                    등록 물건: 다른 사건에서 공통 등록
                  </p>
                )}
              <label className="mt-2 block text-xs text-neutral-500">
                질문
                <AutoGrowTextarea
                  className={MONO_INPUT}
                  value={entry.question}
                  onChange={(e) =>
                    onUpdateEntry(entry.id, { question: e.target.value })
                  }
                />
              </label>
              <label className="mt-2 block text-xs text-neutral-500">
                답변
                <AutoGrowTextarea
                  className={MONO_INPUT}
                  value={entry.answer}
                  onChange={(e) =>
                    onUpdateEntry(entry.id, { answer: e.target.value })
                  }
                />
              </label>
              <MarkdownTablePreview text={entry.answer} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
