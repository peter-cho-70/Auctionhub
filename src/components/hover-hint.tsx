"use client";

import type { ReactNode } from "react";

type Props = {
  text: string;
  /** 라벨 옆에 붙일 때 */
  inline?: boolean;
  className?: string;
};

export function HoverHint({ text, inline = true, className = "" }: Props) {
  return (
    <span
      className={`group relative ${inline ? "inline-flex align-middle" : "inline-flex"} ${className}`}
    >
      <span
        tabIndex={0}
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-300 bg-neutral-50 text-[10px] font-semibold leading-none text-neutral-500 hover:border-neutral-400 hover:bg-white dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
        aria-label="설명 보기"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-[min(20rem,calc(100vw-2rem))] whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-neutral-700 shadow-lg group-hover:block group-focus-within:block dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
      >
        {text}
      </span>
    </span>
  );
}

export function LabelWithHint({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`}>
      <span>{label}</span>
      <HoverHint text={hint} />
      {children}
    </span>
  );
}
