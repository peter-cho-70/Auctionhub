import type { CaseDetailViewMode } from "@/lib/ui/case-detail-ui-versions";

export const CASE_DETAIL_VIEW_MODE_KEY = "auctionflow:case-detail-view-mode";

export function readCaseDetailViewMode(): CaseDetailViewMode {
  if (typeof window === "undefined") return "phase";
  const raw = window.localStorage.getItem(CASE_DETAIL_VIEW_MODE_KEY);
  return raw === "classic" ? "classic" : "phase";
}

export function writeCaseDetailViewMode(mode: CaseDetailViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CASE_DETAIL_VIEW_MODE_KEY, mode);
}
