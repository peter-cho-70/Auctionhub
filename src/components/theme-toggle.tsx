"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "auctionflow-theme";

export type ThemePreference = "light" | "dim" | "dark";

function applyTheme(theme: ThemePreference) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("light");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let initial: ThemePreference = "light";
    if (raw === "dim" || raw === "dark") initial = raw;
    else if (raw === "light") initial = "light";
    else if (raw === "system") initial = "light";
    setPreference(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, preference);
    applyTheme(preference);
  }, [preference]);

  const btn =
    "rounded-md px-2 py-1 text-xs font-medium transition-colors border border-transparent";

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100/90 p-0.5 dark:border-neutral-700 dark:bg-neutral-900/90"
      role="group"
      aria-label="화면 테마"
    >
      {(
        [
          { key: "light" as const, label: "밝게" },
          { key: "dim" as const, label: "어두운 회색" },
          { key: "dark" as const, label: "어둡게" },
        ] as const
      ).map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`${btn} ${
            preference === key
              ? "border-neutral-300 bg-white text-neutral-900 shadow-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              : "text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }`}
          onClick={() => setPreference(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
