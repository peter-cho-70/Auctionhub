"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "복사",
}: {
  text: string;
  label?: string;
}) {
  const [done, setDone] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt("복사할 내용 (Ctrl+C):", text);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
    >
      {done ? "복사됨" : label}
    </button>
  );
}
