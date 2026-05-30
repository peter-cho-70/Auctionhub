import { useState } from "react";
import {
  CASE_DETAIL_VIEW_MODES,
  CLASSIC_CASE_DETAIL_UI_V1,
  PHASE_CASE_DETAIL_UI_V2,
  type CaseDetailViewMode,
} from "@/lib/ui/case-detail-ui-versions";
import {
  writeCaseDetailViewMode,
} from "@/lib/ui/case-detail-view-mode";

type Props = {
  value: CaseDetailViewMode;
  onChange: (mode: CaseDetailViewMode) => void;
};

export function CaseDetailViewToggle({ value, onChange }: Props) {
  const [showCompare, setShowCompare] = useState(false);

  const setMode = (mode: CaseDetailViewMode) => {
    writeCaseDetailViewMode(mode);
    onChange(mode);
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">물건 상세 UI</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {value === "phase"
              ? "단계형 — 전반·후반 프로세스 안내"
              : "클래식 — 기존 15탭 그대로"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {CASE_DETAIL_VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                value === m.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCompare((v) => !v)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
          >
            {showCompare ? "비교 닫기" : "버전 비교"}
          </button>
        </div>
      </div>
      {showCompare && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <VersionCard
            title={CLASSIC_CASE_DETAIL_UI_V1.label}
            savedAt={CLASSIC_CASE_DETAIL_UI_V1.savedAt}
            description={CLASSIC_CASE_DETAIL_UI_V1.description}
            items={CLASSIC_CASE_DETAIL_UI_V1.tabs.map((t) => t.label)}
          />
          <VersionCard
            title={PHASE_CASE_DETAIL_UI_V2.label}
            savedAt={PHASE_CASE_DETAIL_UI_V2.savedAt}
            description={PHASE_CASE_DETAIL_UI_V2.description}
            items={[
              ...PHASE_CASE_DETAIL_UI_V2.preBlocks,
              ...PHASE_CASE_DETAIL_UI_V2.postPackages,
              ...PHASE_CASE_DETAIL_UI_V2.extraTabs.map((t) => t.label),
            ]}
          />
        </div>
      )}
    </div>
  );
}

function VersionCard({
  title,
  savedAt,
  description,
  items,
}: {
  title: string;
  savedAt: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-500">저장일 {savedAt}</p>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{description}</p>
      <ul className="mt-2 list-inside list-disc text-xs text-neutral-500">
        {items.slice(0, 8).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length > 8 && <li>…외 {items.length - 8}개</li>}
      </ul>
    </div>
  );
}
