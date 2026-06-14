import type { AuctionCase, CaseListColor } from "@/lib/types/domain";

export const CASE_LIST_COLORS = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
] as const;

export type CaseListColorId = (typeof CASE_LIST_COLORS)[number];

export const CASE_LIST_COLOR_META: Record<
  CaseListColorId,
  { label: string; dot: string; row: string; ring: string }
> = {
  rose: {
    label: "빨강",
    dot: "bg-rose-600 shadow-sm shadow-rose-400/60 dark:bg-rose-500 dark:shadow-rose-900/80",
    row: "border-l-[5px] border-l-rose-600 bg-rose-100 dark:border-l-rose-500 dark:bg-rose-950/50",
    ring: "ring-rose-600 dark:ring-rose-400",
  },
  amber: {
    label: "노랑",
    dot: "bg-amber-500 shadow-sm shadow-amber-400/60 dark:bg-amber-400 dark:shadow-amber-900/80",
    row: "border-l-[5px] border-l-amber-500 bg-amber-100 dark:border-l-amber-400 dark:bg-amber-950/50",
    ring: "ring-amber-500 dark:ring-amber-400",
  },
  emerald: {
    label: "초록",
    dot: "bg-emerald-600 shadow-sm shadow-emerald-400/60 dark:bg-emerald-500 dark:shadow-emerald-900/80",
    row: "border-l-[5px] border-l-emerald-600 bg-emerald-100 dark:border-l-emerald-500 dark:bg-emerald-950/50",
    ring: "ring-emerald-600 dark:ring-emerald-400",
  },
  sky: {
    label: "파랑",
    dot: "bg-sky-600 shadow-sm shadow-sky-400/60 dark:bg-sky-500 dark:shadow-sky-900/80",
    row: "border-l-[5px] border-l-sky-600 bg-sky-100 dark:border-l-sky-500 dark:bg-sky-950/50",
    ring: "ring-sky-600 dark:ring-sky-400",
  },
  violet: {
    label: "보라",
    dot: "bg-violet-600 shadow-sm shadow-violet-400/60 dark:bg-violet-500 dark:shadow-violet-900/80",
    row: "border-l-[5px] border-l-violet-600 bg-violet-100 dark:border-l-violet-500 dark:bg-violet-950/50",
    ring: "ring-violet-600 dark:ring-violet-400",
  },
};

export function normalizeCaseListColor(raw: unknown): CaseListColor {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return (CASE_LIST_COLORS as readonly string[]).includes(v)
    ? (v as CaseListColorId)
    : null;
}

/** 목록·상단에 표시할 제목 (listTitle 우선, 없으면 사건번호·주소) */
export function caseListTitle(c: Pick<AuctionCase, "listTitle" | "caseNumber" | "address">): string {
  const custom = c.listTitle?.trim();
  if (custom) return custom;
  const parts = [c.caseNumber, c.address || "(주소 미입력)"].filter(Boolean);
  return parts.join(" · ") || "제목 없음";
}

export function caseListRowClass(color: CaseListColor, selected: boolean): string {
  const base = color ? CASE_LIST_COLOR_META[color].row : "";
  const selectedClass = selected
    ? "ring-1 ring-inset ring-amber-400/80 dark:ring-amber-600/80"
    : "";
  return [base, selectedClass].filter(Boolean).join(" ");
}
