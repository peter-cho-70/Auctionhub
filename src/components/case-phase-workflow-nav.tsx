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
import { CLASSIC_CASE_DETAIL_UI_V1 } from "@/lib/ui/case-detail-ui-versions";
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

/** ① 자료·권리 블록 — 클래식 탭을 작은 체크박스로 */
const BLOCK1_CLASSIC_TABS: CaseDetailTabKey[] = [
  "source_docs",
  "basic",
  "tenant_analysis",
  "checklists",
];

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
    pre_auction: "전반부",
    post_auction: "후반부",
    closed: "종료",
  };

  const activeBlock =
    phase === "pre_auction"
      ? activeBlockId ?? PRE_AUCTION_BLOCKS[0]!.id
      : null;
  const activePkg =
    phase === "post_auction"
      ? activePackageId ?? POST_AUCTION_PACKAGES[0]!.id
      : null;

  const currentTabs =
    phase === "pre_auction"
      ? PRE_AUCTION_BLOCKS.find((b) => b.id === activeBlock)?.tabs ?? []
      : POST_AUCTION_PACKAGES.find((p) => p.id === activePkg)?.tabs ?? [];

  const studySteps =
    phase === "pre_auction"
      ? PRE_AUCTION_BLOCKS.find((b) => b.id === activeBlock)?.studySteps ?? []
      : POST_AUCTION_PACKAGES.find((p) => p.id === activePkg)?.studySteps ?? [];

  const visibleTabs = currentTabs.filter(
    (t) => t !== "remodeling" || caseData.postAuction.remodelingEnabled,
  );
  const showClassicChecks =
    phase === "pre_auction" && activeBlock === "docs_rights";
  const showTabRow =
    showClassicChecks || visibleTabs.length > 1 || phase === "pre_auction";

  return (
    <div className="space-y-1.5 rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 gap-0.5">
          {phaseSegment.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPhaseChange(p)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium ${
                phase === p
                  ? "bg-emerald-700 text-white dark:bg-emerald-600"
                  : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              }`}
            >
              {phaseLabels[p]}
            </button>
          ))}
          {caseData.casePhase === "closed" && (
            <span className="self-center px-1 text-xs text-neutral-500">종료</span>
          )}
        </div>

        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
          aria-label={phase === "pre_auction" ? "전반부 단계" : "후반부 단계"}
        >
          {phase === "pre_auction"
            ? PRE_AUCTION_BLOCKS.map((block) => {
                const ready = blockReady[block.id];
                const active = activeBlock === block.id;
                return (
                  <button
                    key={block.id}
                    type="button"
                    title={block.summary}
                    onClick={() => {
                      onSelectBlock?.(block.id);
                      onSelectTab(block.tabs[0]!);
                    }}
                    className={`min-w-0 flex-1 whitespace-nowrap rounded-md border px-2 py-1 text-left text-xs ${
                      active
                        ? "border-emerald-600 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
                        : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"
                    }`}
                  >
                    <span className="font-medium">{block.label}</span>
                    <span className="ml-1 tabular-nums text-neutral-500">
                      {ready.pct}%
                    </span>
                  </button>
                );
              })
            : POST_AUCTION_PACKAGES.map((pkg) => {
                const ready = packageReady[pkg.id];
                const disabled =
                  pkg.id === "remodeling" &&
                  !caseData.postAuction.remodelingEnabled;
                const active = activePkg === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={disabled}
                    title={pkg.summary}
                    onClick={() => {
                      onSelectPackage?.(pkg.id);
                      onSelectTab(pkg.tabs[0]!);
                    }}
                    className={`min-w-0 flex-1 whitespace-nowrap rounded-md border px-2 py-1 text-left text-xs ${
                      active
                        ? "border-violet-600 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                        : disabled
                          ? "border-neutral-200 opacity-50 dark:border-neutral-800"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"
                    }`}
                  >
                    <span className="font-medium">{pkg.label}</span>
                    <span className="ml-1 tabular-nums text-neutral-500">
                      {ready.pct}%
                    </span>
                  </button>
                );
              })}
        </div>

        {phase === "pre_auction" && (
          <span className="shrink-0 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
            준비도{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {preReadiness}%
            </strong>
          </span>
        )}
      </div>

      {showTabRow && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-neutral-100 pt-1.5 dark:border-neutral-900">
          {showClassicChecks && (
            <ClassicTabChecks
              tabs={BLOCK1_CLASSIC_TABS}
              activeTab={activeTab}
              onSelectTab={onSelectTab}
            />
          )}

          {visibleTabs.length > 1 && (
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {visibleTabs.map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => onSelectTab(tabKey)}
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${
                    activeTab === tabKey
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  {tabLabel(tabKey, phase === "post_auction" ? activePkg : null)}
                </button>
              ))}
            </div>
          )}

          {phase === "pre_auction" && <StudyLinks steps={studySteps} />}
        </div>
      )}
    </div>
  );
}

function ClassicTabChecks({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: CaseDetailTabKey[];
  activeTab: CaseDetailTabKey;
  onSelectTab: (tab: CaseDetailTabKey) => void;
}) {
  const labelByKey = new Map(
    CLASSIC_CASE_DETAIL_UI_V1.tabs.map((t) => [t.key, t.label]),
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="text-[11px] text-neutral-500">기본</span>
      {tabs.map((key) => (
        <label
          key={key}
          className="inline-flex cursor-pointer items-center gap-1 text-xs text-neutral-700 dark:text-neutral-300"
        >
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-neutral-300"
            checked={activeTab === key}
            onChange={() => onSelectTab(key)}
          />
          {labelByKey.get(key) ?? TAB_LABELS[key] ?? key}
        </label>
      ))}
    </div>
  );
}

function StudyLinks({ steps }: { steps: import("@/lib/types/domain").CaseStatus[] }) {
  const docs = LECTURE_ORIGINAL_DOCS.filter((d) =>
    d.relatedSteps.some((s) => steps.includes(s)),
  ).slice(0, 2);
  if (!docs.length) return null;
  return (
    <span className="flex shrink-0 flex-wrap gap-2 text-[11px]">
      {docs.map((d) => (
        <Link
          key={d.fileName}
          href={`/study?step=${steps[0]}`}
          className="text-emerald-700 underline dark:text-emerald-400"
        >
          공부하기 ↗
        </Link>
      ))}
    </span>
  );
}

function tabLabel(
  tabKey: CaseDetailTabKey,
  activePkg: PostAuctionPackageId | null,
): string {
  if (activePkg === "loan" && tabKey === "templates") {
    return "대출 문의";
  }
  return TAB_LABELS[tabKey] ?? tabKey;
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
  templates: "문자",
};
