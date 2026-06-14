"use client";

import { useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import type { AuctionCase } from "@/lib/types/domain";
import { caseListTitle } from "@/lib/domain/case-list-display";

type Props = {
  caseData: Pick<AuctionCase, "listTitle" | "caseNumber" | "address">;
  onSave: (listTitle: string) => void;
  className?: string;
  title?: string;
  /** 목록 행 안에서 클릭이 링크로 전파되지 않도록 */
  stopPropagation?: boolean;
  /** 상세 헤더 등 — 긴 제목을 줄바꿈으로 전체 표시 */
  multiline?: boolean;
};

export function CaseListTitleInput({
  caseData,
  onSave,
  className = "min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-neutral-200 focus:border-neutral-300 focus:bg-white focus:outline-none dark:hover:border-neutral-700 dark:focus:border-neutral-600 dark:focus:bg-neutral-900",
  title = "목록·상세 제목 (비우면 사건번호·주소 표시)",
  stopPropagation = false,
  multiline = false,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = caseListTitle(caseData);
  const value = draft ?? displayed;

  const save = () => {
    if (draft == null) return;
    onSave(draft.trim());
    setDraft(null);
  };

  const commonHandlers = {
    title,
    onClick: stopPropagation
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
        }
      : undefined,
    onFocus: (e: React.FocusEvent) => {
      if (stopPropagation) e.stopPropagation();
      setDraft(displayed);
    },
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (stopPropagation) e.stopPropagation();
      if (e.key === "Enter" && (!multiline || !e.shiftKey)) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
  };

  if (multiline) {
    return (
      <AutoGrowTextarea
        {...commonHandlers}
        value={value}
        minHeightPx={32}
        maxViewportFraction={0.35}
        rows={1}
        onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
        className={`w-full resize-none overflow-hidden break-words ${className}`}
      />
    );
  }

  return (
    <input
      type="text"
      {...commonHandlers}
      value={value}
      onChange={(e) => setDraft(e.target.value)}
      className={className}
    />
  );
}
