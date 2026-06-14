"use client";

import {
  APP_EXPERIENCE_MODES,
  type AppExperienceMode,
  writeAppExperienceMode,
} from "@/lib/ui/app-experience-mode";

type Props = {
  value: AppExperienceMode;
  onChange: (mode: AppExperienceMode) => void;
  compact?: boolean;
};

export function AppExperienceToggle({ value, onChange, compact }: Props) {
  const setMode = (mode: AppExperienceMode) => {
    writeAppExperienceMode(mode);
    onChange(mode);
  };

  if (compact) {
    return (
      <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-950">
        {APP_EXPERIENCE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              value === m.id
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
      <p className="text-xs font-medium text-neutral-500">화면 모드</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {APP_EXPERIENCE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm ${
              value === m.id
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "border border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
            }`}
          >
            <span className="font-medium">{m.label}</span>
            <span
              className={`mt-0.5 block text-xs ${
                value === m.id
                  ? "text-neutral-300 dark:text-neutral-600"
                  : "text-neutral-500"
              }`}
            >
              {m.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
