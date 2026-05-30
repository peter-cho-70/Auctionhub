"use client";

import Link from "next/link";
import type { AuctionCase, CasePhase } from "@/lib/types/domain";
import {
  computeOverallPreAuctionReadiness,
  computePostAuctionPackageReadiness,
  computePreAuctionBlockReadiness,
  POST_AUCTION_PACKAGES,
  PRE_AUCTION_BLOCKS,
  type CaseDetailTabKey,
  type PostAuctionPackageId,
  type PreAuctionBlockId,
} from "@/lib/domain/case-workflow";
import { LECTURE_ORIGINAL_DOCS } from "@/lib/data/lecture-sources";

type Props = {
  caseData: AuctionCase;
  phase: CasePhase;
  onPhaseChange: (phase: CasePhase) => void;
  activeTab: CaseDetailTabKey;
  onSelectTab: (tab: CaseDetailTabKey) => void;
  activeBlockId?: PreAuctionBlockId | null;
  activePackageId?: PostAuctionPackageId | null;
  onSelectBlock?: (id: PreAuctionBlockId) => void;
  onSelectPackage?: (id: PostAuctionPackageId) => void;
};

export function CasePhaseWorkflowNav({
  caseData,
  phase,
  onPhaseChange,
  activeTab,
  onSelectTab,
  activeBlockId,
  activePackageId,
  onSelectBlock,
  onSelectPackage,
}: Props) {
  const preReadiness = computeOverallPreAuctionReadiness(caseData);
  const blockReady = computePreAuctionBlockReadiness(caseData);
  const packageReady = computePostAuctionPackageReadiness(caseData);

  const phaseSegment: CasePhase[] = ["pre_auction", "post_auction"];
  const phaseLabels: Record<CasePhase, string> = {
    pre_auction: "전반부 · 입찰가 산정",
    post_auction: "후반부 · 낙찰 후 실행",
    closed: "종료",
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {phaseSegment.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPhaseChange(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                phase === p
                  ? "bg-emerald-700 text-white dark:bg-emerald-600"
                  : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              }`}
            >
              {phaseLabels[p]}
            </button>
          ))}
          {caseData.casePhase === "closed" && (
            <span className="self-center px-2 text-xs text-neutral-500">
              (종료된 물건)
            </span>
          )}
        </div>
        {phase === "pre_auction" && (
          <p className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
            전반 준비도{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {preReadiness}%
            </strong>
          </p>
        )}
      </div>

      {phase === "pre_auction" ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRE_AUCTION_BLOCKS.map((block) => {
            const ready = blockReady[block.id];
            const active = activeBlockId === block.id;
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => {
                  onSelectBlock?.(block.id);
                  onSelectTab(block.tabs[0]!);
                }}
                className={`rounded-lg border p-3 text-left text-sm ${
                  active
                    ? "border-emerald-600 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{block.label}</span>
                  <span className="text-xs tabular-nums text-neutral-500">
                    {ready.pct}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{block.summary}</p>
                {ready.hints.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {ready.hints[0]}
                  </p>
                )}
                <StudyLinks steps={block.studySteps} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {POST_AUCTION_PACKAGES.map((pkg) => {
            const ready = packageReady[pkg.id];
            const disabled = pkg.id === "remodeling" && !caseData.postAuction.remodelingEnabled;
            const active = activePackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => {
                  onSelectPackage?.(pkg.id);
                  onSelectTab("post_workflow");
                }}
                className={`rounded-lg border p-3 text-left text-sm ${
                  active
                    ? "border-violet-600 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                    : disabled
                      ? "border-neutral-200 opacity-60 dark:border-neutral-800"
                      : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{pkg.label}</span>
                  <span className="text-xs tabular-nums text-neutral-500">
                    {ready.pct}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{pkg.summary}</p>
                {pkg.id === "remodeling" && !caseData.postAuction.remodelingEnabled && (
                  <p className="mt-1 text-xs text-neutral-400">후반부 패키지에서 활성화</p>
                )}
                <StudyLinks steps={pkg.studySteps} />
              </button>
            );
          })}
        </div>
      )}

      <PhaseTabStrip
        phase={phase}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        remodelingEnabled={caseData.postAuction.remodelingEnabled}
      />
    </div>
  );
}

function StudyLinks({ steps }: { steps: import("@/lib/types/domain").CaseStatus[] }) {
  const docs = LECTURE_ORIGINAL_DOCS.filter((d) =>
    d.relatedSteps.some((s) => steps.includes(s)),
  ).slice(0, 2);
  if (!docs.length) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-2 text-xs">
      {docs.map((d) => (
        <Link
          key={d.fileName}
          href={`/study?step=${steps[0]}`}
          className="text-emerald-700 underline dark:text-emerald-400"
          onClick={(e) => e.stopPropagation()}
        >
          공부하기 ↗
        </Link>
      ))}
    </p>
  );
}

function PhaseTabStrip({
  phase,
  activeTab,
  onSelectTab,
  remodelingEnabled,
}: {
  phase: CasePhase;
  activeTab: CaseDetailTabKey;
  onSelectTab: (tab: CaseDetailTabKey) => void;
  remodelingEnabled: boolean;
}) {
  const blocks =
    phase === "pre_auction" ? PRE_AUCTION_BLOCKS : POST_AUCTION_PACKAGES;
  const tabMap = new Map<string, string>();
  for (const b of blocks) {
    for (const t of b.tabs) {
      if (t === "remodeling" && !remodelingEnabled) continue;
      if (!tabMap.has(t)) tabMap.set(t, TAB_LABELS[t] ?? t);
    }
  }
  const entries = [...tabMap.entries()];

  return (
    <div className="flex flex-wrap gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-900">
      {entries.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelectTab(key as CaseDetailTabKey)}
          className={`rounded-md px-2 py-1 text-xs ${
            activeTab === key
              ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const TAB_LABELS: Partial<Record<CaseDetailTabKey, string>> = {
  source_docs: "원문/PDF",
  basic: "기본정보",
  tenant_analysis: "세입자",
  checklists: "체크리스트",
  market_analysis: "주변 시세",
  field_inspection: "임장",
  multi_family: "다가구",
  rent: "임대",
  bid_analysis: "입찰가",
  ai_analysis: "AI",
  decision: "판단",
  rounds: "회차",
  analysis_report: "분석 보고서",
  post_workflow: "후반부 패키지",
  remodeling: "리모델링",
  tools: "도구",
  templates: "템플릿",
};
