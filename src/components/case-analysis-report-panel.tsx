"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuctionCase, PreAuctionWorkflow } from "@/lib/types/domain";
import {
  buildCaseAnalysisReport,
  computeReportSectionStatus,
  REPORT_SECTION_DEFS,
  type CaseDetailTabKey,
} from "@/lib/domain/case-workflow";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { loadFieldPhotoDataUrls } from "@/components/field-photo-gallery-panel";
import {
  getCaseMediaText,
  putCaseMediaText,
} from "@/lib/data/case-media-store";
import {
  REPORT_SECTION_HINT,
  REPORT_SECTION_TAB,
} from "@/lib/domain/report-section-links";

type Props = {
  caseId: string;
  caseData: AuctionCase;
  onSave: (patch: { preAuction: PreAuctionWorkflow }) => void;
  onJumpToTab?: (tab: CaseDetailTabKey) => void;
};

const REPORT_TEXT_FIELDS: {
  key: keyof PreAuctionWorkflow;
  label: string;
  placeholder: string;
  section: number;
}[] = [
  {
    key: "reportSelectionReason",
    label: "§1 선정 이유",
    placeholder: "왜 이 물건을 골랐는지 — 수익률, 룸 구성, 저조회, 임장 인상…",
    section: 1,
  },
  {
    key: "reportLocationNotes",
    label: "§6 위치·교통·편의",
    placeholder: "버스·지하철, 병원·학교·아파트, 주변 노후도…",
    section: 6,
  },
  {
    key: "reportFieldPhotoNotes",
    label: "§7 건물·임장 사진 메모",
    placeholder: "외관·내부·층별·옥상·호실·구조도 — 촬영 위치·파일명…",
    section: 7,
  },
  {
    key: "reportAuctionInterest",
    label: "§10 경매 조회수·관심도 (메모)",
    placeholder: "스피드옥션/온비드 조회수, 유효 조회, 관심도 판단…",
    section: 10,
  },
  {
    key: "reportLoanSummary",
    label: "§12 대출·LTV·신탁",
    placeholder: "대출 가능 여부, 담보인정비율, 근저당·신탁 정리…",
    section: 12,
  },
  {
    key: "reportBidDayBuffer",
    label: "§14 입찰 당일 여유분",
    placeholder: "최종 입찰가, 차순위 대비 여유, 당일 현금 준비…",
    section: 14,
  },
];

function reportHtmlRef(caseId: string): string {
  return `report-${caseId}`;
}

async function loadReportHtml(
  caseId: string,
  report: NonNullable<PreAuctionWorkflow["lastReport"]>,
): Promise<string> {
  if (report.html.trim()) return report.html;
  if (report.htmlRef) {
    const fromDb = await getCaseMediaText(caseId, "report-html", report.htmlRef);
    if (fromDb) return fromDb;
  }
  return "";
}

export function CaseAnalysisReportPanel({
  caseId,
  caseData,
  onSave,
  onJumpToTab,
}: Props) {
  const [draft, setDraft] = useState(caseData.preAuction);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [generating, setGenerating] = useState(false);

  const report = caseData.preAuction.lastReport;
  const mergedCase = useMemo(
    () => ({ ...caseData, preAuction: draft }),
    [caseData, draft],
  );
  const finalized = caseData.preAuction.reportFinalized;

  const sectionStatus = useMemo(
    () => computeReportSectionStatus(mergedCase),
    [mergedCase],
  );
  const filledSections = sectionStatus.filter((s) => s.filled).length;

  useEffect(() => {
    let cancelled = false;
    if (!previewOpen && !report) {
      setPreviewHtml("");
      return;
    }
    const load = async () => {
      if (previewOpen && !report) {
        const photoUrls = await loadFieldPhotoDataUrls(caseId, mergedCase.fieldPhotoGallery);
        if (!cancelled) {
          setPreviewHtml(
            buildCaseAnalysisReport(mergedCase, { fieldPhotoDataUrls: photoUrls }).html,
          );
        }
        return;
      }
      if (report) {
        const html = await loadReportHtml(caseId, report);
        if (!cancelled) setPreviewHtml(html);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [previewOpen, report, mergedCase, caseId]);

  const generate = useCallback(async () => {
    if (finalized && !confirm("확정된 보고서입니다. 다시 생성할까요?")) return;
    setGenerating(true);
    try {
      const photoUrls = await loadFieldPhotoDataUrls(caseId, mergedCase.fieldPhotoGallery);
      const built = buildCaseAnalysisReport(mergedCase, {
        fieldPhotoDataUrls: photoUrls,
      });
      const ref = reportHtmlRef(caseId);
      await putCaseMediaText(caseId, "report-html", ref, built.html);
      const snapshot = {
        generatedAt: built.generatedAt,
        html: "",
        htmlRef: ref,
        templateVersion: built.templateVersion,
      };
      onSave({
        preAuction: {
          ...draft,
          lastReport: snapshot,
          reportFinalized: false,
        },
      });
      setPreviewHtml(built.html);
      setPreviewOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "보고서 생성 실패");
    } finally {
      setGenerating(false);
    }
  }, [caseId, draft, finalized, mergedCase, onSave]);

  const finalize = () => {
    onSave({
      preAuction: {
        ...draft,
        reportFinalized: true,
      },
    });
  };

  const saveMeta = () => {
    onSave({ preAuction: draft });
  };

  const printReport = async () => {
    const html =
      previewHtml ||
      (report ? await loadReportHtml(caseId, report) : "") ||
      buildCaseAnalysisReport(mergedCase).html;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const patchViewCount = (
    key: "viewCountTotal" | "viewCountValid" | "viewCountOnbid",
    raw: string,
  ) => {
    const v = raw.replace(/\D/g, "");
    setDraft((d) => ({
      ...d,
      [key]: v === "" ? null : parseInt(v, 10),
    }));
  };

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="text-lg font-semibold">입찰가 산정 보고서</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          14개 섹션 HTML 보고서 · HTML은 IndexedDB, 메타는 로컬 저장
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <p className="text-sm font-medium">
          섹션 준비도{" "}
          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
            {filledSections}/{REPORT_SECTION_DEFS.length}
          </span>
        </p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {sectionStatus.map((s, i) => {
            const tab = REPORT_SECTION_TAB[s.key];
            const hint = REPORT_SECTION_HINT[s.key];
            return (
              <li
                key={s.key}
                className={`text-xs ${s.filled ? "text-neutral-700 dark:text-neutral-300" : "text-amber-800 dark:text-amber-200"}`}
              >
                {onJumpToTab ? (
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => onJumpToTab(tab)}
                    title={hint ?? "해당 탭으로 이동"}
                  >
                    {i + 1}. {s.title}
                  </button>
                ) : (
                  <span>
                    {i + 1}. {s.title}
                  </span>
                )}
                {s.filled ? " ✓" : s.hint ? ` — ${s.hint}` : ""}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-neutral-500">
          보고서 별칭
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="예: 나경빌라"
            value={draft.reportNickname}
            onChange={(e) =>
              setDraft((d) => ({ ...d, reportNickname: e.target.value }))
            }
          />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          기수·코호트
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="예: 2026-1기"
            value={draft.reportCohort}
            onChange={(e) =>
              setDraft((d) => ({ ...d, reportCohort: e.target.value }))
            }
          />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          템플릿 버전
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={draft.reportTemplateVersion}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                reportTemplateVersion: e.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-neutral-500">
          §10 전체 조회수
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            inputMode="numeric"
            value={draft.viewCountTotal ?? ""}
            onChange={(e) => patchViewCount("viewCountTotal", e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          §10 유효 조회
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            inputMode="numeric"
            value={draft.viewCountValid ?? ""}
            onChange={(e) => patchViewCount("viewCountValid", e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          §10 온비드 등
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            inputMode="numeric"
            value={draft.viewCountOnbid ?? ""}
            onChange={(e) => patchViewCount("viewCountOnbid", e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-3">
        {REPORT_TEXT_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs font-medium text-neutral-500">
            {f.label}
            <AutoGrowTextarea
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder={f.placeholder}
              value={String(draft[f.key] ?? "")}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [f.key]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveMeta}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          메타·메모 저장
        </button>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {generating ? "생성 중…" : "보고서 생성 (14섹션)"}
        </button>
        {report && (
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
            >
              미리보기
            </button>
            <button
              type="button"
              onClick={() => void printReport()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
            >
              인쇄/PDF
            </button>
            <button
              type="button"
              onClick={finalize}
              disabled={finalized}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {finalized ? "확정됨" : "보고서 확정"}
            </button>
          </>
        )}
      </div>

      {report && (
        <p className="text-xs text-neutral-500">
          마지막 생성: {report.generatedAt.slice(0, 16).replace("T", " ")} ·{" "}
          {report.templateVersion}
          {report.htmlRef ? " · IndexedDB" : report.html ? " · 인라인 HTML" : ""}
          {finalized && " · 확정"}
        </p>
      )}

      {(previewOpen || report) && previewHtml && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          <iframe
            title="분석 보고서 미리보기"
            srcDoc={previewHtml}
            className="h-[min(70vh,640px)] w-full rounded-lg bg-white"
            sandbox=""
          />
        </div>
      )}
    </section>
  );
}
