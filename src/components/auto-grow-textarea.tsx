"use client";

import { useLayoutEffect, useRef } from "react";

export type AutoGrowTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    /** 최소 높이(px) */
    minHeightPx?: number;
    /** 뷰포트 높이 대비 최대 비율 (기본 0.7) */
    maxViewportFraction?: number;
  };

/**
 * 내용에 맞춰 높이가 늘어나며, 최대 뷰포트의 일정 비율까지는 스크롤 없이 보이다가 그 이상은 스크롤.
 */
export function AutoGrowTextarea({
  minHeightPx = 72,
  maxViewportFraction = 0.7,
  className = "",
  value,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const cap =
      typeof window !== "undefined"
        ? window.innerHeight * maxViewportFraction
        : minHeightPx * 6;
    const next = Math.min(Math.max(el.scrollHeight, minHeightPx), cap);
    el.style.height = `${next}px`;
  }, [value, minHeightPx, maxViewportFraction]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={`resize-y overflow-y-auto ${className}`}
      {...rest}
    />
  );
}
