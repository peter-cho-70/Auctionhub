import type { ReportSectionKey } from "@/lib/domain/case-analysis-report";
import type { CaseDetailTabKey } from "@/lib/domain/case-workflow";

/** 보고서 § → 물건 상세 탭 (점프용) */
export const REPORT_SECTION_TAB: Record<ReportSectionKey, CaseDetailTabKey> = {
  basic: "basic",
  detail: "source_docs",
  building_overview: "basic",
  rights: "tenant_analysis",
  building_detail: "basic",
  location: "field_inspection",
  photos: "field_inspection",
  tenants: "tenant_analysis",
  market: "market_analysis",
  interest: "analysis_report",
  comparables: "bid_analysis",
  loan: "analysis_report",
  yield: "rent",
  decision: "decision",
};

export const REPORT_SECTION_HINT: Partial<Record<ReportSectionKey, string>> = {
  photos: "임장 탭 → 임장·건물 사진",
  tenants: "세입자 분석 → 임차인 표",
  comparables: "입찰가 분석 → 매각 사례 5건+",
};
