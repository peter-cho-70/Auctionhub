import type { CaseDetailTabKey } from "@/lib/domain/case-workflow";

/** 2026-05-20 기준 — 단계형 UI 도입 전 탭 구조 (비교·클래식 보기용) */
export const CLASSIC_CASE_DETAIL_UI_V1 = {
  versionId: "classic-v1",
  savedAt: "2026-05-20",
  label: "클래식 (기존 탭)",
  description:
    "15개 탭을 가로로 나열하던 물건 상세 UI. 전반/후반 구분 없이 모든 기능에 바로 접근합니다.",
  tabs: [
    { key: "source_docs" as CaseDetailTabKey, label: "원문/PDF" },
    { key: "basic" as CaseDetailTabKey, label: "기본·수동입력" },
    { key: "multi_family" as CaseDetailTabKey, label: "다가구 분석" },
    { key: "bid_analysis" as CaseDetailTabKey, label: "입찰가 분석" },
    { key: "ai_analysis" as CaseDetailTabKey, label: "AI 분석" },
    { key: "market_analysis" as CaseDetailTabKey, label: "주변 시세 분석" },
    { key: "tenant_analysis" as CaseDetailTabKey, label: "세입자 분석" },
    { key: "rent" as CaseDetailTabKey, label: "임대세팅" },
    { key: "remodeling" as CaseDetailTabKey, label: "리모델링" },
    { key: "field_inspection" as CaseDetailTabKey, label: "임장 확인" },
    { key: "checklists" as CaseDetailTabKey, label: "체크리스트" },
    { key: "rounds" as CaseDetailTabKey, label: "입찰·유찰 회차" },
    { key: "decision" as CaseDetailTabKey, label: "판단 기록" },
    { key: "templates" as CaseDetailTabKey, label: "문자·템플릿" },
    { key: "tools" as CaseDetailTabKey, label: "도구" },
  ],
} as const;

/** 단계형 프로세스 UI (전반 4블록 + 후반 4패키지) */
export const PHASE_CASE_DETAIL_UI_V2 = {
  versionId: "phase-v2",
  savedAt: "2026-05-20",
  label: "단계형 (신규)",
  description:
    "입찰 전 4블록(자료·권리 → 시세·임장 → 자금·입찰가 → 보고서·입찰)과 낙찰 후 4패키지(대출·명도·임대·리모델링)로 안내합니다.",
  preBlocks: ["① 자료·권리", "② 시세·임장", "③ 자금·입찰가", "④ 보고서·입찰"],
  postPackages: ["대출", "명도", "임대", "리모델링(선택)"],
  extraTabs: [
    { key: "analysis_report" as CaseDetailTabKey, label: "입찰 분석 보고서" },
    { key: "post_workflow" as CaseDetailTabKey, label: "후반부 패키지" },
  ],
} as const;

export type CaseDetailViewMode = "classic" | "phase";

export const CASE_DETAIL_VIEW_MODES: {
  id: CaseDetailViewMode;
  label: string;
  snapshot: typeof CLASSIC_CASE_DETAIL_UI_V1 | typeof PHASE_CASE_DETAIL_UI_V2;
}[] = [
  { id: "phase", label: PHASE_CASE_DETAIL_UI_V2.label, snapshot: PHASE_CASE_DETAIL_UI_V2 },
  { id: "classic", label: CLASSIC_CASE_DETAIL_UI_V1.label, snapshot: CLASSIC_CASE_DETAIL_UI_V1 },
];
