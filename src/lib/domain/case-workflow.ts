import type {
  AuctionCase,
  CasePhase,
  CaseStatus,
  PostAuctionLoanCounselorResult,
  PostAuctionWorkflow,
  PreAuctionWorkflow,
} from "@/lib/types/domain";
import { emptyPostAuctionLoanCounselorResult } from "@/lib/domain/loan-inquiry";
import { computePreFieldInfoReadiness } from "@/lib/domain/multifamily-analysis";

export const DEFAULT_REPORT_TEMPLATE_VERSION = "Ver0530";

export type PreAuctionBlockId =
  | "docs_rights"
  | "market_field"
  | "fund_bid"
  | "report_bid";

export type PostAuctionPackageId = "loan" | "eviction" | "leasing" | "remodeling";

export type CaseDetailTabKey =
  | "basic"
  | "multi_family"
  | "bid_analysis"
  | "ai_analysis"
  | "market_analysis"
  | "tenant_analysis"
  | "remodeling"
  | "field_inspection"
  | "source_docs"
  | "checklists"
  | "rounds"
  | "decision"
  | "templates"
  | "tools"
  | "rent"
  | "analysis_report"
  | "post_workflow";

export const PRE_AUCTION_BLOCKS: {
  id: PreAuctionBlockId;
  label: string;
  summary: string;
  tabs: CaseDetailTabKey[];
  studySteps: CaseStatus[];
}[] = [
  {
    id: "docs_rights",
    label: "① 자료·권리",
    summary: "원문 PDF, 기본정보, 세입자·권리, 체크리스트",
    tabs: ["source_docs", "basic", "tenant_analysis", "checklists"],
    studySteps: ["researching", "rights_check"],
  },
  {
    id: "market_field",
    label: "② 시세·임장",
    summary: "주변 시세, 임장, 다가구·임대 수익 분석",
    tabs: ["market_analysis", "field_inspection", "multi_family", "rent", "remodeling"],
    studySteps: ["field_check", "loan_check"],
  },
  {
    id: "fund_bid",
    label: "③ 자금·입찰가",
    summary: "입찰가 분석, AI 참고, 판단·회차",
    tabs: ["bid_analysis", "ai_analysis", "decision", "rounds", "remodeling"],
    studySteps: ["bid_review", "loan_check"],
  },
  {
    id: "report_bid",
    label: "④ 보고서·입찰",
    summary: "입찰 분석 보고서 생성·확정, 입찰 실행",
    tabs: ["analysis_report", "decision", "rounds", "tools"],
    studySteps: ["bid_review", "bid_day"],
  },
];

export const POST_AUCTION_PACKAGES: {
  id: PostAuctionPackageId;
  label: string;
  summary: string;
  tabs: CaseDetailTabKey[];
  studySteps: CaseStatus[];
}[] = [
  {
    id: "loan",
    label: "대출",
    summary: "대출 문의 문자",
    tabs: ["templates"],
    studySteps: ["loan_check", "won", "balance"],
  },
  {
    id: "eviction",
    label: "명도",
    summary: "세입자·점유 현황",
    tabs: ["tenant_analysis"],
    studySteps: ["eviction", "won_day_action"],
  },
  {
    id: "leasing",
    label: "임대",
    summary: "임대 세팅·수익",
    tabs: ["rent"],
    studySteps: ["leasing"],
  },
  {
    id: "remodeling",
    label: "리모델링",
    summary: "선택 — 공사 범위·비용",
    tabs: ["remodeling"],
    studySteps: ["leasing"],
  },
];

const PRE_AUCTION_STATUSES = new Set<CaseStatus>([
  "watching",
  "researching",
  "rights_check",
  "field_check",
  "loan_check",
  "bid_review",
  "bid_day",
]);

const POST_AUCTION_STATUSES = new Set<CaseStatus>([
  "won",
  "won_day_action",
  "balance",
  "eviction",
  "leasing",
]);

const CLOSED_STATUSES = new Set<CaseStatus>(["completed", "abandoned"]);

export function emptyPreAuctionWorkflow(): PreAuctionWorkflow {
  return {
    reportNickname: "",
    reportCohort: "",
    reportTemplateVersion: DEFAULT_REPORT_TEMPLATE_VERSION,
    reportSelectionReason: "",
    reportLocationNotes: "",
    reportFieldPhotoNotes: "",
    reportAuctionInterest: "",
    viewCountTotal: null,
    viewCountValid: null,
    viewCountOnbid: null,
    reportLoanSummary: "",
    reportBidDayBuffer: "",
    lastReport: null,
    reportFinalized: false,
  };
}

export function emptyPostAuctionWorkflow(): PostAuctionWorkflow {
  return {
    loanPackage: {
      preApprovalNotes: "",
      executionNotes: "",
      memo: "",
      counselorResult: emptyPostAuctionLoanCounselorResult(),
      calcLoanAmount: null,
      calcAnnualRate: null,
    },
    evictionPackage: { tenantSummary: "", planNotes: "", memo: "" },
    leasingPackage: { targetRentNotes: "", marketingNotes: "", memo: "" },
    remodelingEnabled: false,
    remodelingPackage: { scopeNotes: "", budgetNotes: "", memo: "" },
  };
}

export function inferCasePhaseFromStatus(status: CaseStatus): CasePhase {
  if (CLOSED_STATUSES.has(status)) return "closed";
  if (POST_AUCTION_STATUSES.has(status)) return "post_auction";
  if (PRE_AUCTION_STATUSES.has(status)) return "pre_auction";
  return "pre_auction";
}

export function normalizePreAuctionWorkflow(raw: unknown): PreAuctionWorkflow {
  const base = emptyPreAuctionWorkflow();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const last = o.lastReport;
  let lastReport = base.lastReport;
  if (last && typeof last === "object") {
    const lr = last as Record<string, unknown>;
    if (typeof lr.html === "string" && typeof lr.generatedAt === "string") {
      lastReport = {
        generatedAt: lr.generatedAt,
        html: typeof lr.html === "string" ? lr.html : "",
        htmlRef:
          typeof lr.htmlRef === "string" && lr.htmlRef.trim()
            ? lr.htmlRef.trim()
            : null,
        templateVersion:
          typeof lr.templateVersion === "string"
            ? lr.templateVersion
            : DEFAULT_REPORT_TEMPLATE_VERSION,
      };
    }
  }
  return {
    reportNickname:
      typeof o.reportNickname === "string" ? o.reportNickname : "",
    reportCohort: typeof o.reportCohort === "string" ? o.reportCohort : "",
    reportTemplateVersion:
      typeof o.reportTemplateVersion === "string" && o.reportTemplateVersion.trim()
        ? o.reportTemplateVersion.trim()
        : DEFAULT_REPORT_TEMPLATE_VERSION,
    reportSelectionReason:
      typeof o.reportSelectionReason === "string" ? o.reportSelectionReason : "",
    reportLocationNotes:
      typeof o.reportLocationNotes === "string" ? o.reportLocationNotes : "",
    reportFieldPhotoNotes:
      typeof o.reportFieldPhotoNotes === "string" ? o.reportFieldPhotoNotes : "",
    reportAuctionInterest:
      typeof o.reportAuctionInterest === "string" ? o.reportAuctionInterest : "",
    viewCountTotal:
      typeof o.viewCountTotal === "number" && Number.isFinite(o.viewCountTotal)
        ? Math.max(0, Math.floor(o.viewCountTotal))
        : null,
    viewCountValid:
      typeof o.viewCountValid === "number" && Number.isFinite(o.viewCountValid)
        ? Math.max(0, Math.floor(o.viewCountValid))
        : null,
    viewCountOnbid:
      typeof o.viewCountOnbid === "number" && Number.isFinite(o.viewCountOnbid)
        ? Math.max(0, Math.floor(o.viewCountOnbid))
        : null,
    reportLoanSummary:
      typeof o.reportLoanSummary === "string" ? o.reportLoanSummary : "",
    reportBidDayBuffer:
      typeof o.reportBidDayBuffer === "string" ? o.reportBidDayBuffer : "",
    lastReport,
    reportFinalized: o.reportFinalized === true,
  };
}

function normalizePackageNotes(
  raw: unknown,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) out[key] = "";
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of keys) {
    if (typeof o[key] === "string") out[key] = o[key] as string;
  }
  return out;
}

function normalizeMoneyField(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeRatioField(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return v;
}

function normalizeLoanCounselorResult(raw: unknown): PostAuctionLoanCounselorResult {
  const base = emptyPostAuctionLoanCounselorResult();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    collateralRatio: normalizeRatioField(o.collateralRatio),
    mortgageSummary:
      typeof o.mortgageSummary === "string" ? o.mortgageSummary : "",
    trustSummary: typeof o.trustSummary === "string" ? o.trustSummary : "",
    confirmedLoanLimit: normalizeMoneyField(o.confirmedLoanLimit),
    annualRate: normalizeRatioField(o.annualRate),
    notes: typeof o.notes === "string" ? o.notes : "",
  };
}

export function normalizePostAuctionWorkflow(raw: unknown): PostAuctionWorkflow {
  const base = emptyPostAuctionWorkflow();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const loanRaw =
    o.loanPackage && typeof o.loanPackage === "object"
      ? (o.loanPackage as Record<string, unknown>)
      : null;
  const loan = normalizePackageNotes(loanRaw, [
    "preApprovalNotes",
    "executionNotes",
    "memo",
  ] as const);
  const eviction = normalizePackageNotes(o.evictionPackage, [
    "tenantSummary",
    "planNotes",
    "memo",
  ] as const);
  const leasing = normalizePackageNotes(o.leasingPackage, [
    "targetRentNotes",
    "marketingNotes",
    "memo",
  ] as const);
  const remodeling = normalizePackageNotes(o.remodelingPackage, [
    "scopeNotes",
    "budgetNotes",
    "memo",
  ] as const);
  return {
    loanPackage: {
      preApprovalNotes: loan.preApprovalNotes ?? "",
      executionNotes: loan.executionNotes ?? "",
      memo: loan.memo ?? "",
      counselorResult: normalizeLoanCounselorResult(loanRaw?.counselorResult),
      calcLoanAmount: normalizeMoneyField(loanRaw?.calcLoanAmount),
      calcAnnualRate: normalizeRatioField(loanRaw?.calcAnnualRate),
    },
    evictionPackage: {
      tenantSummary: eviction.tenantSummary ?? "",
      planNotes: eviction.planNotes ?? "",
      memo: eviction.memo ?? "",
    },
    leasingPackage: {
      targetRentNotes: leasing.targetRentNotes ?? "",
      marketingNotes: leasing.marketingNotes ?? "",
      memo: leasing.memo ?? "",
    },
    remodelingEnabled: o.remodelingEnabled === true,
    remodelingPackage: {
      scopeNotes: remodeling.scopeNotes ?? "",
      budgetNotes: remodeling.budgetNotes ?? "",
      memo: remodeling.memo ?? "",
    },
  };
}

export function normalizeCasePhase(raw: unknown, status: CaseStatus): CasePhase {
  if (raw === "pre_auction" || raw === "post_auction" || raw === "closed") {
    return raw;
  }
  return inferCasePhaseFromStatus(status);
}

export type BlockReadiness = {
  pct: number;
  completed: number;
  total: number;
  hints: string[];
};

function pct(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function computePreAuctionBlockReadiness(
  c: AuctionCase,
): Record<PreAuctionBlockId, BlockReadiness> {
  const hasRightsChecklist = c.checklists.some(
    (cl) =>
      cl.stepKey === "rights_check" &&
      cl.items.some((it) => it.done),
  );
  const hasTenantSource = c.sourceDocuments.some((d) =>
    ["daejangauction-pdf", "speedauction-pdf", "auctionone-pdf", "tenant-report", "pdf"].includes(
      d.kind,
    ),
  );
  const hasBidAnalysis =
    c.auctionSaleComparables.length > 0 ||
    c.auctionBidAnalysis?.lastResult != null;
  const hasMarket =
    c.nearbyMarketAnalysis != null ||
    c.brokerMarketNotes.length > 0 ||
    c.aiMarketNotes.length > 0;
  const hasField =
    Boolean(c.fieldSurvey.trim()) ||
    c.fieldInspection.nearbyBrokers.length > 0 ||
    Boolean(c.fieldInspection.buildingManagement.companyName.trim()) ||
    Boolean(c.fieldInspection.memo.trim());
  const hasDecision =
    c.decision.verdict != null || Boolean(c.decision.reason.trim());
  const hasReport = c.preAuction.lastReport != null;

  const docsChecks = [
    c.sourceDocuments.length > 0,
    Boolean(c.caseNumber && c.address),
    hasTenantSource,
    hasRightsChecklist,
  ];
  const marketChecks = [
    hasMarket,
    hasField,
    c.multiFamilyAnalysis.postFieldScore != null ||
      c.multiFamilyAnalysis.yieldTableDone,
    c.rentSetting.unitRows.length > 0,
  ];
  const fundChecks = [
    hasBidAnalysis,
    c.externalAiQa.length > 0 || c.aiMarketNotes.length > 0,
    hasDecision,
    c.bidRounds.length > 0 || c.currentRound >= 1,
  ];
  const reportChecks = [
    hasReport,
    c.preAuction.reportFinalized,
    hasDecision,
    c.bidDate != null,
  ];

  function build(checks: boolean[], hints: string[]): BlockReadiness {
    const completed = checks.filter(Boolean).length;
    return {
      pct: pct(completed, checks.length),
      completed,
      total: checks.length,
      hints: hints.filter(Boolean),
    };
  }

  return {
    docs_rights: build(docsChecks, [
      !c.sourceDocuments.length ? "원문 PDF 등록" : "",
      !hasRightsChecklist ? "권리 체크리스트 진행" : "",
    ]),
    market_field: build(marketChecks, [
      !hasMarket ? "주변 시세 분석" : "",
      !hasField ? "임장 메모·연락처" : "",
    ]),
    fund_bid: build(fundChecks, [
      !hasBidAnalysis ? "입찰가·비교 사례" : "",
      !hasDecision ? "판단 기록" : "",
    ]),
    report_bid: build(reportChecks, [
      !hasReport ? "분석 보고서 생성" : "",
      !c.preAuction.reportFinalized ? "보고서 확정" : "",
    ]),
  };
}

export function computeOverallPreAuctionReadiness(c: AuctionCase): number {
  const blocks = computePreAuctionBlockReadiness(c);
  const pre = computePreFieldInfoReadiness(c);
  const blockAvg =
    Object.values(blocks).reduce((sum, b) => sum + b.pct, 0) /
    Object.keys(blocks).length;
  return Math.round((blockAvg + pre.completenessPct) / 2);
}

export function computePostAuctionPackageReadiness(
  c: AuctionCase,
): Record<PostAuctionPackageId, BlockReadiness> {
  const p = c.postAuction;
  const cr = p.loanPackage.counselorResult;
  const loanFilled = [
    cr.collateralRatio != null,
    cr.mortgageSummary.trim(),
    cr.confirmedLoanLimit != null,
    cr.annualRate != null,
  ].filter(Boolean).length;
  const evictionFilled = [
    p.evictionPackage.tenantSummary.trim(),
    p.evictionPackage.planNotes.trim(),
  ].filter(Boolean).length;
  const leasingFilled = [
    p.leasingPackage.targetRentNotes.trim(),
    p.leasingPackage.marketingNotes.trim(),
    c.rentSetting.unitRows.length > 0,
  ].filter(Boolean).length;
  const remodelingFilled = p.remodelingEnabled
    ? [
        p.remodelingPackage.scopeNotes.trim(),
        p.remodelingPackage.budgetNotes.trim(),
        c.remodeling.unitAssignments.some((a) => a.completed),
      ].filter(Boolean).length
    : 0;

  function build(completed: number, total: number, hints: string[]): BlockReadiness {
    return { pct: pct(completed, total), completed, total, hints };
  }

  return {
    loan: build(
      loanFilled,
      4,
      loanFilled < 3
        ? ["담보인정비율·근저당·한도·이율 정리"]
        : [],
    ),
    eviction: build(
      evictionFilled,
      2,
      evictionFilled < 2 ? ["세입자 요약·명도 계획"] : [],
    ),
    leasing: build(
      leasingFilled,
      3,
      leasingFilled < 2 ? ["임대 목표·마케팅"] : [],
    ),
    remodeling: p.remodelingEnabled
      ? build(remodelingFilled, 3, remodelingFilled < 2 ? ["공사 범위·비용"] : [])
      : { pct: 100, completed: 0, total: 0, hints: ["선택 항목 (비활성)"] },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section style="margin:1.25rem 0"><h2 style="font-size:1.05rem;border-bottom:1px solid #ddd;padding-bottom:.35rem">${escapeHtml(title)}</h2>${body}</section>`;
}

function para(text: string): string {
  return `<p style="margin:.5rem 0;line-height:1.55">${escapeHtml(text)}</p>`;
}

function list(items: string[]): string {
  const rows = items.filter(Boolean);
  if (!rows.length) return "";
  return `<ul style="margin:.35rem 0;padding-left:1.25rem">${rows.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

export {
  buildCaseAnalysisReport,
  computeReportSectionStatus,
  REPORT_SECTION_DEFS,
} from "@/lib/domain/case-analysis-report";
export type {
  ReportSectionKey,
  ReportSectionStatus,
} from "@/lib/domain/case-analysis-report";

export function buildPostAuctionPackageHtml(
  c: AuctionCase,
  packageId: PostAuctionPackageId,
): string {
  const p = c.postAuction;
  const title = {
    loan: "대출 패키지",
    eviction: "명도 패키지",
    leasing: "임대 패키지",
    remodeling: "리모델링 패키지",
  }[packageId];
  let body = "";
  if (packageId === "loan") {
    const cr = p.loanPackage.counselorResult;
    body = [
      cr.collateralRatio != null
        ? para(
            `담보인정비율: ${Math.round(cr.collateralRatio * 1000) / 10}%`,
          )
        : "",
      cr.mortgageSummary.trim()
        ? para(`근저당: ${cr.mortgageSummary}`)
        : "",
      cr.trustSummary.trim() ? para(`신탁: ${cr.trustSummary}`) : "",
      cr.confirmedLoanLimit != null
        ? para(`확인 대출 한도: ${cr.confirmedLoanLimit.toLocaleString("ko-KR")}원`)
        : "",
      cr.annualRate != null
        ? para(`연 이율: ${Math.round(cr.annualRate * 10000) / 100}%`)
        : "",
      cr.notes.trim() ? para(cr.notes) : "",
      para(`사전 한도: ${p.loanPackage.preApprovalNotes || "—"}`),
      para(`실행 대출: ${p.loanPackage.executionNotes || "—"}`),
      para(p.loanPackage.memo || ""),
    ].join("");
  } else if (packageId === "eviction") {
    body = [
      para(`세입자: ${p.evictionPackage.tenantSummary || "—"}`),
      para(`명도 계획: ${p.evictionPackage.planNotes || "—"}`),
      para(p.evictionPackage.memo || ""),
    ].join("");
  } else if (packageId === "leasing") {
    body = [
      para(`목표 임대: ${p.leasingPackage.targetRentNotes || "—"}`),
      para(`마케팅: ${p.leasingPackage.marketingNotes || "—"}`),
      para(p.leasingPackage.memo || ""),
    ].join("");
  } else {
    body = [
      para(`범위: ${p.remodelingPackage.scopeNotes || "—"}`),
      para(`예산: ${p.remodelingPackage.budgetNotes || "—"}`),
      para(p.remodelingPackage.memo || ""),
    ].join("");
  }
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem">${section(`${c.caseNumber} · ${title}`, body)}</body></html>`;
}
