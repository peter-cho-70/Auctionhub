"use client";

import { useEffect, useRef, useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import {
  createMarketReferenceNote,
  MARKET_REFERENCE_TRADE_LABEL,
} from "@/lib/domain/market-reference-notes";
import type {
  AuctionCase,
  MarketReferenceNote,
  MarketReferenceTradeKind,
} from "@/lib/types/domain";

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const SELECT =
  "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900";

type Props = {
  caseData: AuctionCase;
  onUpdateCase: (
    patch: Partial<Pick<AuctionCase, "brokerMarketNotes" | "aiMarketNotes">>,
  ) => void;
};

const SECTIONS: {
  key: "brokerMarketNotes" | "aiMarketNotes";
  title: string;
  description: string;
  placeholder: string;
}[] = [
  {
    key: "brokerMarketNotes",
    title: "부동산 참고 시세·호가",
    description: "부동산 상담, 네이버·현장 호가, 매물 설명을 매매·월세·전세별로 기록합니다.",
    placeholder: "예: 동일 지번 매매 호가 4.2억, 월세 500/45, 전세 2.1억 문의…",
  },
  {
    key: "aiMarketNotes",
    title: "AI·자료 참고 시세",
    description: "AI 분석, 감정·실거래 요약, 자료 조사 내용을 별도로 보관합니다.",
    placeholder: "예: 국토부 유사 3건 평균, AI 추정 월세 밴드, 리스크 요약…",
  },
];

export function CaseMarketReferenceNotes({ caseData, onUpdateCase }: Props) {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const caseRef = useRef(caseData);
  caseRef.current = caseData;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Pick<
    AuctionCase,
    "brokerMarketNotes" | "aiMarketNotes"
  > | null>(null);

  const flush = () => {
    if (!pendingRef.current) return;
    onUpdateCase(pendingRef.current);
    pendingRef.current = null;
    setSavedAt(Date.now());
  };

  const scheduleSave = (
    patch: Partial<Pick<AuctionCase, "brokerMarketNotes" | "aiMarketNotes">>,
  ) => {
    const base = caseRef.current;
    pendingRef.current = {
      brokerMarketNotes:
        patch.brokerMarketNotes ?? base.brokerMarketNotes ?? [],
      aiMarketNotes: patch.aiMarketNotes ?? base.aiMarketNotes ?? [],
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 600);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, []);

  const updateList = (
    key: "brokerMarketNotes" | "aiMarketNotes",
    notes: MarketReferenceNote[],
    options?: { immediate?: boolean },
  ) => {
    if (options?.immediate) {
      onUpdateCase(
        key === "brokerMarketNotes"
          ? { brokerMarketNotes: notes }
          : { aiMarketNotes: notes },
      );
      setSavedAt(Date.now());
      return;
    }
    scheduleSave({ [key]: notes });
  };

  return (
    <div className="space-y-4">
      {savedAt != null && Date.now() - savedAt < 4000 && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          참고 메모 저장됨
        </p>
      )}
      {SECTIONS.map((section) => (
        <MarketReferenceSection
          key={section.key}
          title={section.title}
          description={section.description}
          placeholder={section.placeholder}
          notes={caseData[section.key] ?? []}
          onChange={(notes, options) => updateList(section.key, notes, options)}
        />
      ))}
    </div>
  );
}

function MarketReferenceSection({
  title,
  description,
  placeholder,
  notes,
  onChange,
}: {
  title: string;
  description: string;
  placeholder: string;
  notes: MarketReferenceNote[];
  onChange: (
    notes: MarketReferenceNote[],
    options?: { immediate?: boolean },
  ) => void;
}) {
  const touch = (next: MarketReferenceNote[]) => {
    onChange(
      next.map((n) => ({
        ...n,
        updatedAt: new Date().toISOString(),
      })),
    );
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium dark:border-neutral-700"
          onClick={() =>
            onChange([...(notes ?? []), createMarketReferenceNote("all")], {
              immediate: true,
            })
          }
        >
          + 메모 추가
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          아직 메모가 없습니다. 「+ 메모 추가」로 매매·월세·전세 참고를 남기세요.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-neutral-500">
                  구분
                  <select
                    className={`${SELECT} ml-1`}
                    value={note.tradeKind}
                    onChange={(e) =>
                      touch(
                        notes.map((n) =>
                          n.id === note.id
                            ? {
                                ...n,
                                tradeKind: e.target
                                  .value as MarketReferenceTradeKind,
                              }
                            : n,
                        ),
                      )
                    }
                  >
                    {(
                      Object.keys(
                        MARKET_REFERENCE_TRADE_LABEL,
                      ) as MarketReferenceTradeKind[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {MARKET_REFERENCE_TRADE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ml-auto text-xs text-rose-600 dark:text-rose-400"
                  onClick={() =>
                    onChange(notes.filter((n) => n.id !== note.id))
                  }
                >
                  삭제
                </button>
              </div>
              <AutoGrowTextarea
                className={INPUT}
                value={note.content}
                onChange={(e) =>
                  touch(
                    notes.map((n) =>
                      n.id === note.id ? { ...n, content: e.target.value } : n,
                    ),
                  )
                }
                placeholder={placeholder}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
