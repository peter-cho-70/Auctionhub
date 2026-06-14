"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { InputHTMLAttributes } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppExperienceToggle } from "@/components/app-experience-toggle";
import { CaseDetailRenewalSection } from "@/components/case-detail-renewal-section";
import { CaseQuickPdfUpload } from "@/components/case-quick-pdf-upload";
import {
  readAppExperienceMode,
  type AppExperienceMode,
  writeAppExperienceMode,
} from "@/lib/ui/app-experience-mode";
import { CopyButton } from "@/components/copy-button";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { PercentRateInput } from "@/components/percent-rate-input";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import {
  buildTemplateContext,
  interpolateTemplate,
  STANDARD_TEMPLATE_KEYS,
} from "@/lib/domain/template-vars";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";
import {
  TABLE_COMPACT,
  TC_MONEY,
  TC_TD,
  TC_TH,
  TC_UNIT,
} from "@/lib/ui/compact-table";
import { canSecondBidderReport } from "@/lib/domain/finance";
import type {
  AuctionCase,
  BidRound,
  BidRoundResult,
  BuildingUnitComposition,
  BuildingUnitUseType,
  CaseAddressMeta,
  GuMarketCacheEntry,
  CaseSourceDocument,
  CaseSourceDocumentKind,
  CaseRemodeling,
  CaseStatus,
  PriorityLevel,
} from "@/lib/types/domain";
import { AddressSearchField } from "@/components/address-search-field";
import { resolveMolitLawdCode } from "@/lib/address/lawd-code";
import { caseListTitle } from "@/lib/domain/case-list-display";
import {
  CaseListThumbnailEditor,
  CaseListThumbnailImg,
  deleteCaseListThumbnailMedia,
} from "@/components/case-list-thumbnail-ui";
import { CaseListTitleInput } from "@/components/case-list-title-input";
import { guMarketCacheKey, MOLIT_RENT_MONTHS, MOLIT_SALE_MONTHS } from "@/lib/data/gu-market-cache";
import {
  molitGisUrl,
  naverLandSearchUrl,
  naverMapSearchUrl,
  preferLandSearchAddress,
} from "@/lib/map/external-links";
import { ExternalMapLinks } from "@/components/external-map-links";
import {
  emptyRoomShapeMix,
  ROOM_SHAPE_OPTIONS,
} from "@/lib/types/domain";
import { CaseAiAnalysisPanel } from "@/components/case-ai-analysis-panel";
import { CaseAuctionBidAnalysisPanel } from "@/components/case-auction-bid-analysis-panel";
import { CaseAnalysisReportPanel } from "@/components/case-analysis-report-panel";
import { CaseTenantRecordsPanel } from "@/components/case-tenant-records-panel";
import { TenantAnalysisCompactTable } from "@/components/tenant/tenant-analysis-compact-table";
import { FieldPhotoGalleryPanel } from "@/components/field-photo-gallery-panel";
import { CasePhaseWorkflowNav } from "@/components/case-phase-workflow-nav";
import { CaseLoanInquiryPanel } from "@/components/case-loan-inquiry-panel";
import { CasePostAuctionPanel } from "@/components/case-post-auction-panel";
import { CaseRentSettingPanel } from "@/components/case-rent-setting-panel";
import {
  CaseFieldInspectionPanel,
  CaseMultiFamilyAnalysisPanel,
} from "@/components/case-multifamily-analysis-panel";
import { CaseRemodelingPanel } from "@/components/case-remodeling-panel";
import {
  computeRentSettingDerived,
  newRentUnitRow,
  normalizeRentSetting,
  PYEONG_TO_SQM,
} from "@/lib/domain/rent-setting";
import {
  applyRentSettingFromTenants,
  hasMeaningfulRentUnitRows,
} from "@/lib/domain/rent-setting-from-tenants";
import {
  computePreFieldInfoReadiness,
  normalizeMultiFamilyAnalysis,
} from "@/lib/domain/multifamily-analysis";
import { normalizeCaseRemodeling } from "@/lib/domain/remodeling";
import {
  buildSuggestedRentRows,
  formatManwon,
  inferDong,
  normalizeNearbyMarketAnalysis,
} from "@/lib/domain/nearby-market";
import {
  computeRecommendedPriorityLevel,
  PRIORITY_LEVEL_LABELS,
} from "@/lib/domain/case-priority";
import {
  buildCasePatchFromDocumentFacts,
  extractCaseDocumentFacts,
} from "@/lib/domain/case-document-facts";
import { DEFAULT_NO_DIVIDEND_REQUEST_GUIDE } from "@/lib/data/default-data";
import { syncTenantRecordsFromExpectedDividend } from "@/lib/domain/case-tenant-records";
import {
  distributionStatusLabel,
  getExpectedDividendFromDocuments,
  resolveTenantDistributionView,
  tenantNameToneFromDistribution,
  type TenantDistributionView,
} from "@/lib/domain/tenant-dividend-display";
import {
  applyTenantMetadataFromSpecification,
  compareTenantUnit,
  resetTenantRowsFromSpecification,
  sortTenantRowsByUnit,
} from "@/lib/domain/tenant-spec-merge";
import { EXPECTED_DIVIDEND_PARSER_VERSION } from "@/lib/pdf/expected-dividend-parser";
import { registerSourcePdfUpload } from "@/lib/pdf/register-source-pdf-upload";
import {
  deleteAllSourcePdfBlobsForCase,
  downloadBlobAsFile,
  getSourcePdfBlob,
  openSourcePdfInNewTab,
} from "@/lib/pdf/store-source-pdf";
import {
  formatAppraisalBreakdown,
  formatMinPriceLine,
  speedAuctionDisplayMetaForCase,
} from "@/lib/pdf/speed-auction-case-meta";
import {
  normalizeCaseNumber,
  sourceDocumentKindFileLabel,
} from "@/lib/pdf/stored-pdf-name";
import {
  LAST_CASE_TAB_KEY_PREFIX,
  LAST_SELECTED_CASE_KEY,
} from "@/lib/constants/storage";
import { saveLocalDataSnapshot } from "@/lib/data/client-backup";
import {
  inferCasePhaseFromStatus,
  type PostAuctionPackageId,
  type PreAuctionBlockId,
} from "@/lib/domain/case-workflow";
import type { CasePhase } from "@/lib/types/domain";
import { useAppStore } from "@/store/app-store";

type Tab =
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

const TAB_KEYS: Tab[] = [
  "source_docs",
  "basic",
  "multi_family",
  "bid_analysis",
  "ai_analysis",
  "market_analysis",
  "tenant_analysis",
  "rent",
  "remodeling",
  "field_inspection",
  "checklists",
  "rounds",
  "decision",
  "templates",
  "tools",
  "analysis_report",
  "post_workflow",
];

const MONEY_EXTRA_KEYS = ["낙찰가", "보증금", "내입찰가"] as const;
const LOAN_INQUIRY_EXTRA_KEYS = [
  "명의",
  "현주택수",
  "소득요약",
  "카드사용",
  "부채요약",
  "물건특징",
  "매도전략",
  "낙찰가",
] as const;

const SOURCE_DOCUMENT_KIND_OPTIONS: {
  value: CaseSourceDocumentKind;
  label: string;
  help: string;
}[] = [
  {
    value: "daejangauction-pdf",
    label: "대장옥션 경매 PDF",
    help: "임차인·등기·입찰기일까지 포함. 기본 경매 PDF 형식",
  },
  {
    value: "speedauction-pdf",
    label: "스피드옥션 경매 PDF",
    help: "물건 기본정보, 감정·면적, 임차인, 등기부 권리까지 함께 추출",
  },
  {
    value: "registry-building",
    label: "건물 등기부등본",
    help: "건물 권리관계와 청구금액 중심으로 추출",
  },
  {
    value: "registry-land",
    label: "토지 등기부등본",
    help: "토지 권리관계와 청구금액 중심으로 추출",
  },
  {
    value: "building-ledger",
    label: "건축물대장",
    help: "층수, 주차, 면적, 사용승인, 위반건축물 메모 추출",
  },
  {
    value: "appraisal-report",
    label: "감정평가서",
    help: "감정가, 면적, 거래사례·평면 관련 문구 보존",
  },
  {
    value: "tenant-report",
    label: "임차인 현황 문서",
    help: "호실별 임차인, 전입일, 보증금, 배당요구 정보 추출",
  },
  {
    value: "expected-dividend",
    label: "예상배당표",
    help: "스피드옥션 예상배당표 PDF에서 입찰가·호실별 배당액 추출",
  },
];

const BASIC_INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BASIC_INPUT_MISSING_CLASS =
  "border-rose-400 bg-rose-50/60 dark:border-rose-700 dark:bg-rose-950/20";

function basicInputClass(missing: boolean, extra = ""): string {
  return `${BASIC_INPUT_CLASS} ${extra} ${missing ? BASIC_INPUT_MISSING_CLASS : ""}`.trim();
}

function BasicFieldLabel({
  children,
  missing,
}: {
  children: React.ReactNode;
  missing: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-1.5 text-xs font-medium ${
        missing ? "text-rose-700 dark:text-rose-300" : "text-neutral-500"
      }`}
    >
      <span>{children}</span>
      {missing && (
        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          임장 전 필수
        </span>
      )}
    </label>
  );
}

function PropertyBadge({
  tone,
  children,
}: {
  tone: "green" | "orange" | "purple" | "blue";
  children: React.ReactNode;
}) {
  const className =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : tone === "orange"
        ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
        : tone === "purple"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function buildBasicPreFieldMissing(
  c: AuctionCase,
  landSqmInput: string,
  buildingSqmInput: string,
  parkingCountInput: string,
): Set<string> {
  const missing = new Set<string>();
  const landAreaSqm = parseAreaSqmInputToNumber(landSqmInput);
  const buildingAreaSqm = parseAreaSqmInputToNumber(buildingSqmInput);
  const parkingRaw = parkingCountInput.trim().replace(/\D/g, "");
  const parkingUnitCount =
    parkingRaw === "" ? c.parkingUnitCount : parseInt(parkingRaw, 10);
  const roomShapeCount = Object.values(c.roomShapeMix).reduce(
    (sum, value) => sum + value,
    0,
  );

  if (!c.caseNumber.trim()) missing.add("caseNumber");
  if (!c.address.trim()) missing.add("address");
  if (c.appraisalPrice == null) missing.add("appraisalPrice");
  if (c.minPrice == null) missing.add("minPrice");
  if (!c.bidDate) missing.add("bidDate");
  if (landAreaSqm == null) missing.add("landAreaSqm");
  if (buildingAreaSqm == null) missing.add("buildingAreaSqm");
  if (!c.builtYear.trim()) missing.add("builtYear");
  if (c.householdCount == null) missing.add("householdCount");
  if (!Number.isFinite(parkingUnitCount) || parkingUnitCount == null) {
    missing.add("parkingUnitCount");
  }
  if (!c.buildingCoverageRatio.trim()) missing.add("buildingCoverageRatio");
  if (!c.floorAreaRatio.trim()) missing.add("floorAreaRatio");
  if (!c.lienBaseline.trim()) missing.add("lienBaseline");
  if (roomShapeCount <= 0) missing.add("roomShapeMix");
  return missing;
}

function newBuildingUnitCompositionRow(): BuildingUnitComposition {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `building-unit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    floor: "",
    useType: "residential",
    useLabel: "",
    areaSqm: null,
    unitCount: 1,
    source: "manual",
  };
}

function countCompositionUnits(
  rows: BuildingUnitComposition[] | undefined,
  useType: BuildingUnitUseType,
): number {
  return (rows ?? [])
    .filter((row) => row.useType === useType)
    .reduce((sum, row) => sum + row.unitCount, 0);
}

function averageResidentialUnitArea(rows: BuildingUnitComposition[]): number | null {
  const residential = rows.filter(
    (row) => row.useType === "residential" && row.areaSqm != null && row.unitCount > 0,
  );
  const totalUnits = residential.reduce((sum, row) => sum + row.unitCount, 0);
  if (totalUnits <= 0) return null;
  const totalArea = residential.reduce(
    (sum, row) => sum + (row.areaSqm ?? 0),
    0,
  );
  return Math.round((totalArea / totalUnits) * 100) / 100;
}

function landPricePerSqmManwon(c: AuctionCase): number | null {
  const price = c.expectedBidPrice ?? c.minPrice ?? c.appraisalPrice;
  if (price == null || c.landAreaSqm == null || c.landAreaSqm <= 0) return null;
  return Math.round((price / c.landAreaSqm / 10_000) * 100) / 100;
}

function isNeighborhoodMixed(c: AuctionCase): boolean {
  const text = [
    c.propertyType,
    ...c.buildingUnitComposition.map((row) => row.useLabel),
  ].join(" ");
  return /근린|상가|점포|사무소|소매점/.test(text);
}

function updateBuildingUnitComposition(
  c: Partial<AuctionCase>,
  rowId: string,
  patch: Partial<BuildingUnitComposition>,
): Partial<AuctionCase> {
  const buildingUnitComposition = (c.buildingUnitComposition ?? []).map((row) =>
    row.id === rowId ? { ...row, ...patch } : row,
  );
  const residentialUnitCount = countCompositionUnits(
    buildingUnitComposition,
    "residential",
  );
  const commercialUnitCount = countCompositionUnits(
    buildingUnitComposition,
    "commercial",
  );
  return {
    ...c,
    buildingUnitComposition,
    residentialUnitCount: residentialUnitCount || null,
    commercialUnitCount: commercialUnitCount || null,
    householdCount: residentialUnitCount || c.householdCount,
  };
}

const TENANT_ROOM_TYPE_OPTIONS = [
  "",
  "원룸",
  "분리형 원룸",
  "1.5룸",
  "투룸",
  "정투룸",
  "미니쓰리룸",
  "쓰리룸",
  "주인세대",
  "상가/점포",
  "기타",
] as const;

const FIELD_OCCUPANCY_OPTIONS = [
  { value: "needs_check", label: "확인필요" },
  { value: "occupied", label: "거주" },
  { value: "vacant", label: "미거주" },
] as const;

const FIELD_CONTRACT_INTENT_OPTIONS = [
  { value: "", label: "자동" },
  { value: "renew", label: "계약연장" },
  { value: "vacate", label: "퇴거·공실" },
  { value: "relet", label: "신규임대" },
  { value: "unknown", label: "미확인" },
] as const;

type PdfToJsonOk = {
  ok: true;
  meta: {
    fileName: string;
    fileSize: number;
    pageCount: number | null;
  };
  extracted?: { caseNumber?: string | null };
  rawText: string;
  structuredJson: unknown;
};

type PdfToJsonError = {
  ok: false;
  error: string;
};

function onExtraMoneyChange(
  key: (typeof MONEY_EXTRA_KEYS)[number],
  raw: string,
  setExtras: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const v = raw;
  const n = parseWonInput(v);
  setExtras((prev) => ({
    ...prev,
    [key]:
      v.trim() === "" ? "" : n != null ? formatWonDigits(n) : v,
  }));
}

function isTab(value: unknown): value is Tab {
  return typeof value === "string" && TAB_KEYS.includes(value as Tab);
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const c = useAppStore((s) => s.data.cases.find((x) => x.id === id));
  const allCases = useAppStore((s) => s.data.cases);
  const updateCase = useAppStore((s) => s.updateCase);
  const deleteCase = useAppStore((s) => s.deleteCase);
  const setCaseStatus = useAppStore((s) => s.setCaseStatus);
  const toggleChecklistItem = useAppStore((s) => s.toggleChecklistItem);
  const setChecklistItemNote = useAppStore((s) => s.setChecklistItemNote);
  const updateCaseChecklistItemFields = useAppStore(
    (s) => s.updateCaseChecklistItemFields,
  );
  const addCaseChecklistItem = useAppStore((s) => s.addCaseChecklistItem);
  const removeCaseChecklistItem = useAppStore((s) => s.removeCaseChecklistItem);
  const setDecision = useAppStore((s) => s.setDecision);
  const addBidRound = useAppStore((s) => s.addBidRound);
  const updateBidRound = useAppStore((s) => s.updateBidRound);
  const removeBidRound = useAppStore((s) => s.removeBidRound);
  const setWonDayActionsCompleted = useAppStore(
    (s) => s.setWonDayActionsCompleted,
  );
  const reapplyTemplatesToCase = useAppStore((s) => s.reapplyTemplatesToCase);
  const templates = useAppStore((s) => s.data.messageTemplates);
  const noDividendRequestGuide = useAppStore(
    (s) => s.data.tenantAnalysisSettings.noDividendRequestGuide,
  );
  const setNoDividendRequestGuide = useAppStore(
    (s) => s.setNoDividendRequestGuide,
  );
  const propertyAnalysisSettings = useAppStore(
    (s) => s.data.propertyAnalysisSettings,
  );
  const setPropertyAnalysisSettings = useAppStore(
    (s) => s.setPropertyAnalysisSettings,
  );
  const remodelingPriceCatalog = useAppStore((s) => s.data.remodelingPriceCatalog);
  const setRemodelingPriceCatalog = useAppStore((s) => s.setRemodelingPriceCatalog);

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "basic";
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) return fromUrl;
    const saved = window.localStorage.getItem(`${LAST_CASE_TAB_KEY_PREFIX}${id}`);
    return isTab(saved) ? saved : "basic";
  });

  const [phaseUiBlock, setPhaseUiBlock] = useState<PreAuctionBlockId | null>(null);
  const [phaseUiPackage, setPhaseUiPackage] = useState<PostAuctionPackageId | null>(
    null,
  );

  const [basicDraft, setBasicDraft] = useState<Partial<AuctionCase> | null>(
    null,
  );
  const caseForForm = basicDraft ?? c ?? null;

  const [extras, setExtras] = useState<Record<string, string>>({
    명의: "개인",
    현주택수: "",
    소득요약: "",
    카드사용: "",
    부채요약: "",
    물건특징: "",
    매도전략: "임대 수익 목적",
    낙찰가: "",
    보증금: "",
    내입찰가: "",
  });

  const [winP, setWinP] = useState("");
  const [dep, setDep] = useState("");
  const [myBid, setMyBid] = useState("");

  const secondOk = useMemo(() => {
    const w = parseWonInput(winP);
    const d = parseWonInput(dep);
    const m = parseWonInput(myBid);
    if (w == null || d == null || m == null) return null;
    return canSecondBidderReport(w, d, m);
  }, [winP, dep, myBid]);

  const [landSqmInput, setLandSqmInput] = useState("");
  const [buildingSqmInput, setBuildingSqmInput] = useState("");
  const [parkingCountInput, setParkingCountInput] = useState("");

  const [experienceMode, setExperienceMode] = useState<AppExperienceMode>(() =>
    readAppExperienceMode(),
  );

  const handleExperienceModeChange = useCallback((mode: AppExperienceMode) => {
    writeAppExperienceMode(mode);
    setExperienceMode(mode);
  }, []);

  useEffect(() => {
    if (!c) return;
    window.localStorage.setItem(LAST_SELECTED_CASE_KEY, c.id);
  }, [c]);

  useEffect(() => {
    window.localStorage.setItem(`${LAST_CASE_TAB_KEY_PREFIX}${id}`, tab);
  }, [id, tab]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, [id]);

  // 물건 저장값이 바뀌면 입력칸과 맞춤 (같은 사건에서 갱신될 때)
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- 면적·주차만 저장값과 동기화 */
  useEffect(() => {
    if (!c) return;
    setLandSqmInput(c.landAreaSqm != null ? String(c.landAreaSqm) : "");
    setBuildingSqmInput(
      c.buildingAreaSqm != null ? String(c.buildingAreaSqm) : "",
    );
    setParkingCountInput(
      c.parkingUnitCount != null ? String(c.parkingUnitCount) : "",
    );
  }, [
    c?.id,
    c?.landAreaSqm,
    c?.buildingAreaSqm,
    c?.parkingUnitCount,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const caseViewForRent = useMemo((): AuctionCase | null => {
    if (!c) return null;
    const merged = { ...c, ...(basicDraft ?? {}) };
    const landParsed = parseAreaSqmInputToNumber(landSqmInput);
    const buildingParsed = parseAreaSqmInputToNumber(buildingSqmInput);
    return {
      ...merged,
      landAreaSqm: landParsed ?? merged.landAreaSqm ?? null,
      buildingAreaSqm: buildingParsed ?? merged.buildingAreaSqm ?? null,
      // 기본 탭 draft는 예전 스냅샷이라, 다른 탭 데이터는 항상 스토어(c) 기준
      auctionSaleComparables: c.auctionSaleComparables,
      auctionBidAnalysis: c.auctionBidAnalysis,
      externalAiQa: c.externalAiQa,
      nearbyMarketAnalysis: c.nearbyMarketAnalysis,
      sourceDocuments: c.sourceDocuments,
      multiFamilyAnalysis: c.multiFamilyAnalysis,
      remodeling: c.remodeling,
      fieldInspection: c.fieldInspection,
      rentSetting: c.rentSetting,
      brokerMarketNotes: c.brokerMarketNotes,
      aiMarketNotes: c.aiMarketNotes,
    };
  }, [c, basicDraft, landSqmInput, buildingSqmInput]);

  const updateCaseExternalAiQa = useCallback(
    (patch: Pick<AuctionCase, "externalAiQa">) => {
      updateCase(id, patch);
    },
    [id, updateCase],
  );

  const updateCaseBidAnalysis = useCallback(
    (
      patch: Partial<
        Pick<AuctionCase, "auctionSaleComparables" | "auctionBidAnalysis">
      >,
    ) => {
      updateCase(id, patch);
    },
    [id, updateCase],
  );

  const saveWorkflowPatch = useCallback(
    (patch: Parameters<typeof updateCase>[1]) => {
      updateCase(id, patch);
    },
    [id, updateCase],
  );

  if (!c) {
    return (
      <div className="space-y-3">
        <p>물건을 찾을 수 없습니다.</p>
        <Link href="/cases" className="text-sm underline">
          목록으로
        </Link>
      </div>
    );
  }

  const viewCase = caseViewForRent ?? c;
  const basicPreFieldMissing = buildBasicPreFieldMissing(
    viewCase,
    landSqmInput,
    buildingSqmInput,
    parkingCountInput,
  );
  const preFieldReadiness = computePreFieldInfoReadiness(
    viewCase,
    viewCase.multiFamilyAnalysis,
  );
  const avgResidentialArea = averageResidentialUnitArea(
    viewCase.buildingUnitComposition,
  );
  const landPriceManwon = landPricePerSqmManwon(viewCase);
  const neighborhoodMixed = isNeighborhoodMixed(viewCase);
  const recommendedPriorityLevel = computeRecommendedPriorityLevel(viewCase);
  const saleCaseAnalysis = c.multiFamilyAnalysis;
  const saleCaseRate =
    saleCaseAnalysis.saleCaseBidRatePct ??
    (saleCaseAnalysis.saleCaseBidPrice != null &&
    viewCase.appraisalPrice != null &&
    viewCase.appraisalPrice > 0
      ? (saleCaseAnalysis.saleCaseBidPrice / viewCase.appraisalPrice) * 100
      : null);
  const saleCaseBasedBid =
    saleCaseRate != null && viewCase.appraisalPrice != null
      ? Math.round(viewCase.appraisalPrice * (saleCaseRate / 100))
      : null;
  const nearbySaleAvgWon =
    viewCase.nearbyMarketAnalysis?.saleAvgMolitManwon != null
      ? viewCase.nearbyMarketAnalysis.saleAvgMolitManwon * 10000
      : null;
  const saleCaseVsNearby =
    saleCaseAnalysis.saleCaseBidPrice != null && nearbySaleAvgWon != null
      ? saleCaseAnalysis.saleCaseBidPrice - nearbySaleAvgWon
      : null;

  const syncDraftFromCase = () => setBasicDraft(null);

  const saveBasic = () => {
    if (!caseForForm) return;
    updateCase(id, {
      caseNumber: caseForForm.caseNumber ?? "",
      address: caseForForm.address ?? "",
      addressMeta: caseForForm.addressMeta ?? null,
      propertyType: caseForForm.propertyType ?? "",
      builtYear: caseForForm.builtYear ?? "",
      floor: caseForForm.floor ?? "",
      householdCount: caseForForm.householdCount ?? null,
      roomShapeMix: {
        ...emptyRoomShapeMix(),
        ...(caseForForm.roomShapeMix ?? {}),
      },
      residentialUnitCount: caseForForm.residentialUnitCount ?? null,
      commercialUnitCount: caseForForm.commercialUnitCount ?? null,
      buildingUnitComposition: caseForForm.buildingUnitComposition ?? [],
      appraisalPrice: caseForForm.appraisalPrice ?? null,
      minPrice: caseForForm.minPrice ?? null,
      expectedBidPrice:
        caseForForm.expectedBidPrice ??
        (caseForForm.appraisalPrice != null
          ? Math.round(caseForForm.appraisalPrice * 0.7)
          : null),
      bidDate: caseForForm.bidDate ?? null,
      priorityLevel: caseForForm.priorityLevel ?? 1,
      priority: caseForForm.priority ?? "normal",
      fieldSurvey: caseForForm.fieldSurvey ?? "",
      memo: caseForForm.memo ?? "",
      sourceUrl: caseForForm.sourceUrl ?? c.sourceUrl,
      landAreaSqm: parseAreaSqmInputToNumber(landSqmInput),
      buildingAreaSqm: parseAreaSqmInputToNumber(buildingSqmInput),
      parkingUnitCount: (() => {
        const raw = parkingCountInput.trim().replace(/\D/g, "");
        if (raw === "") return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0
          ? Math.min(99999, n)
          : null;
      })(),
      hasBuildingViolation:
        (caseForForm ?? c).hasBuildingViolation === true,
      buildingCoverageRatio: caseForForm.buildingCoverageRatio ?? "",
      floorAreaRatio: caseForForm.floorAreaRatio ?? "",
      lienBaseline: caseForForm.lienBaseline ?? "",
    });
    syncDraftFromCase();
  };

  const saveRentSetting = (rentSetting: Parameters<typeof normalizeRentSetting>[0]) => {
    updateCase(id, { rentSetting: normalizeRentSetting(rentSetting) });
  };
  const prefillRentSettingFromTenants = () => {
    const next = normalizeRentSetting(applyRentSettingFromTenants(c, "fillEmpty"));
    const derived = computeRentSettingDerived(next);
    saveRentSetting({
      ...next,
      investmentYield: {
        ...next.investmentYield,
        totalDeposit: derived.totalDeposit,
        totalMonthlyRent: derived.totalMonthlyRent,
      },
    });
  };
  const applyMarketRentToRentSetting = (
    listing: MarketListingItem,
    mode: RentSettingApplyMode,
  ) => {
    const result = buildRentSettingFromMarketListing(
      viewCase.rentSetting,
      listing,
      mode,
    );
    if (result.count === 0) return 0;
    updateCase(id, { rentSetting: result.rentSetting });
    return result.count;
  };

  const saveMultiFamilyAnalysis = (
    analysis: Parameters<typeof normalizeMultiFamilyAnalysis>[0],
  ) => {
    updateCase(id, { multiFamilyAnalysis: normalizeMultiFamilyAnalysis(analysis) });
  };

  const saveRemodeling = (remodeling: CaseRemodeling) => {
    updateCase(id, { remodeling: normalizeCaseRemodeling(remodeling) });
  };

  const applyRemodelingRepairCost = (totalManwon: number) => {
    updateCase(id, {
      multiFamilyAnalysis: normalizeMultiFamilyAnalysis({
        ...c.multiFamilyAnalysis,
        repairCost: totalManwon * 10_000,
      }),
    });
  };
  const updateBasicSaleCaseAnalysis = (
    patch: Partial<typeof c.multiFamilyAnalysis>,
  ) => {
    updateCase(id, {
      multiFamilyAnalysis: normalizeMultiFamilyAnalysis({
        ...c.multiFamilyAnalysis,
        appraisalComparablesChecked: true,
        ...patch,
      }),
    });
  };
  const saveNearbyMarketAnalysis = (raw: unknown) => {
    const beforeJson = useAppStore.getState().exportDataJson();
    saveLocalDataSnapshot(beforeJson, "before-nearby-market-save");
    updateCase(id, {
      nearbyMarketAnalysis: normalizeNearbyMarketAnalysis(raw, viewCase),
      multiFamilyAnalysis: {
        ...viewCase.multiFamilyAnalysis,
        rentAskingChecked: true,
      },
    });
    window.setTimeout(() => {
      saveLocalDataSnapshot(
        useAppStore.getState().exportDataJson(),
        "after-nearby-market-save",
      );
    }, 0);
  };
  const clearNearbyMarketAnalysis = () => {
    if (!confirm("주변 시세 분석 데이터를 이 물건에서 제거할까요?")) return;
    updateCase(id, { nearbyMarketAnalysis: null });
  };

  const addSourceDocument = (document: CaseSourceDocument) => {
    const sourceDocuments = [document, ...(c.sourceDocuments ?? [])];
    const facts = extractCaseDocumentFacts(sourceDocuments);
    const patch = buildCasePatchFromDocumentFacts(c, facts);
    updateCase(id, {
      ...patch,
      sourceDocuments,
    });
  };
  const updateSourceDocumentsFromAnalysis = (
    sourceDocuments: CaseSourceDocument[],
  ) => {
    const facts = extractCaseDocumentFacts(sourceDocuments);
    const patch = buildCasePatchFromDocumentFacts(c, facts);
    updateCase(id, {
      ...patch,
      sourceDocuments,
    });
  };

  const fillBlankBasicFromDocuments = () => {
    const facts = extractCaseDocumentFacts(c.sourceDocuments ?? []);
    const patch = buildCasePatchFromDocumentFacts(c, facts);
    if (Object.keys(patch).length === 0) {
      alert("문서에서 새로 채울 빈 기본정보를 찾지 못했습니다.");
      return;
    }
    updateCase(id, patch);
    syncDraftFromCase();
  };

  const handleDeleteCase = () => {
    const title = caseListTitle(c);
    if (
      !confirm(
        `${title}을 삭제할까요?\n삭제 후에는 현재 브라우저 저장 데이터에서 제거됩니다.`,
      )
    ) {
      return;
    }
    deleteCase(id);
    void deleteCaseListThumbnailMedia(id);
    void deleteAllSourcePdfBlobsForCase(id, c.sourceDocuments ?? []);
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(LAST_SELECTED_CASE_KEY);
      if (last === id) {
        window.localStorage.removeItem(LAST_SELECTED_CASE_KEY);
      }
    }
    router.replace("/cases");
  };

  const workflowPhase: CasePhase =
    c.casePhase === "closed" ? "closed" : c.casePhase;
  const phaseNavPhase: CasePhase =
    workflowPhase === "closed" ? inferCasePhaseFromStatus(c.status) : workflowPhase;
  const postLoanInquiryView =
    phaseNavPhase === "post_auction" && phaseUiPackage === "loan";
  const postEvictionTenantView =
    phaseNavPhase === "post_auction" && phaseUiPackage === "eviction";
  const postLeasingRentView =
    phaseNavPhase === "post_auction" && phaseUiPackage === "leasing";

  const speedMeta = speedAuctionDisplayMetaForCase(c);
  const appraisalLine =
    speedMeta != null ? formatAppraisalBreakdown(speedMeta) : null;
  const minPriceLine =
    speedMeta != null ? formatMinPriceLine(speedMeta, c.minPrice) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href="/cases"
            className="mb-2 inline-block text-xs text-neutral-500 hover:underline"
          >
            ← 목록
          </Link>
          <div className="flex min-w-0 items-start gap-3">
            <CaseListThumbnailImg
              caseId={id}
              thumbnail={c.listThumbnail}
              className="h-24 w-24 shrink-0 rounded-lg object-cover shadow-sm"
              placeholderClassName="h-24 w-24 shrink-0 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
            />
            <div className="min-w-0 flex-1 flex flex-col gap-1 pt-0.5">
              <CaseListTitleInput
                caseData={c}
                multiline
                onSave={(listTitle) => updateCase(id, { listTitle })}
                className="rounded-md border border-transparent bg-transparent px-0 py-0 text-lg font-semibold leading-snug tracking-tight hover:border-neutral-200 focus:border-neutral-300 focus:bg-white focus:px-2 focus:py-1 focus:outline-none dark:hover:border-neutral-700 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
              />
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {STATUS_LABELS[c.status]}
                {c.bidDate && ` · 입찰 ${c.bidDate}`}
                {speedMeta?.debtor &&
                  !caseListTitle(c).includes(speedMeta.debtor) &&
                  ` · 채무자 ${speedMeta.debtor}`}
              </p>
              {(appraisalLine || minPriceLine) && (
                <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {[appraisalLine, minPriceLine].filter(Boolean).join(" · ")}
                </p>
              )}
              {speedMeta?.propertyType && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {speedMeta.propertyType}
                  {speedMeta.currentRound != null &&
                    ` · ${speedMeta.currentRound}차`}
                  {speedMeta.tenantCount != null &&
                    ` · 임차인 ${speedMeta.tenantCount}명`}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <AppExperienceToggle
            compact
            value={experienceMode}
            onChange={handleExperienceModeChange}
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">상태</span>
            <select
              value={c.status}
              onChange={(e) =>
                setCaseStatus(id, e.target.value as CaseStatus)
              }
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={c.wonDayActionsCompleted}
              onChange={(e) =>
                setWonDayActionsCompleted(id, e.target.checked)
              }
            />
            낙찰 당일 액션 완료
          </label>
          <CaseQuickPdfUpload
            caseId={id}
            caseNumber={c.caseNumber}
            onDocumentAdded={addSourceDocument}
          />
          <button
            type="button"
            onClick={handleDeleteCase}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            물건 삭제
          </button>
        </div>
      </div>

      {experienceMode === "renewal" && (
        <CaseDetailRenewalSection
          caseId={id}
          caseData={c}
          onListThumbnailChange={(listThumbnail) => updateCase(id, { listThumbnail })}
        />
      )}

      <CasePhaseWorkflowNav
        caseData={c}
        phase={phaseNavPhase}
        onPhaseChange={(p) => saveWorkflowPatch({ casePhase: p })}
        activeTab={tab}
        onSelectTab={setTab}
        activeBlockId={phaseUiBlock}
        activePackageId={phaseUiPackage}
        onSelectBlock={setPhaseUiBlock}
        onSelectPackage={setPhaseUiPackage}
      />

      {tab === "basic" && (
        <section className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            필드를 수정한 뒤 저장하세요. 체크리스트 구조는 &quot;프로세스&quot;
            메뉴에서 바꾼 뒤, 아래 버튼으로 이 물건에 다시 적용할 수 있습니다.
          </p>
          {basicPreFieldMissing.size > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
              임장 전 필수 기본정보 {basicPreFieldMissing.size}개가 비어 있습니다.
              정보충실도는 현재 {preFieldReadiness.completenessPct}%입니다.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {neighborhoodMixed && (
              <PropertyBadge tone="green">
                근린 포함
              </PropertyBadge>
            )}
            {avgResidentialArea != null &&
              avgResidentialArea <= propertyAnalysisSettings.smallUnitAreaSqm && (
                <PropertyBadge tone="orange">
                  평균 주택면적 {avgResidentialArea}㎡ 이하
                </PropertyBadge>
              )}
            {viewCase.buildingAreaSqm != null &&
              viewCase.buildingAreaSqm >=
                propertyAnalysisSettings.largeBuildingAreaSqm && (
                <PropertyBadge tone="purple">
                  건물면적 {viewCase.buildingAreaSqm.toLocaleString("ko-KR")}㎡ 이상
                </PropertyBadge>
              )}
            {landPriceManwon != null &&
              landPriceManwon >=
                propertyAnalysisSettings.highLandPricePerSqmManwon && (
                <PropertyBadge tone="blue">
                  토지가격 {landPriceManwon.toLocaleString("ko-KR")}만원/㎡ 이상
                </PropertyBadge>
              )}
          </div>
          <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium">
              물건 특성 표시 기준
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-neutral-500">
                소형 가구 면적 기준 (㎡ 이하)
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={propertyAnalysisSettings.smallUnitAreaSqm}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n > 0) {
                      setPropertyAnalysisSettings({ smallUnitAreaSqm: n });
                    }
                  }}
                />
              </label>
              <label className="text-xs font-medium text-neutral-500">
                대형 건물면적 기준 (㎡ 이상)
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={propertyAnalysisSettings.largeBuildingAreaSqm}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n > 0) {
                      setPropertyAnalysisSettings({ largeBuildingAreaSqm: n });
                    }
                  }}
                />
              </label>
              <label className="text-xs font-medium text-neutral-500">
                높은 토지가격 기준 (만원/㎡ 이상)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={propertyAnalysisSettings.highLandPricePerSqmManwon}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n > 0) {
                      setPropertyAnalysisSettings({ highLandPricePerSqmManwon: n });
                    }
                  }}
                />
              </label>
            </div>
          </details>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">
                경매 URL
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).sourceUrl}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    sourceUrl: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <BasicFieldLabel missing={basicPreFieldMissing.has("caseNumber")}>
                사건번호
              </BasicFieldLabel>
              <input
                className={basicInputClass(basicPreFieldMissing.has("caseNumber"))}
                value={(caseForForm ?? c).caseNumber}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    caseNumber: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                우선순위
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).priorityLevel ?? 1}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    priorityLevel: Number(e.target.value) as PriorityLevel,
                  })
                }
              >
                {(Object.keys(PRIORITY_LEVEL_LABELS) as unknown as PriorityLevel[]).map(
                  (level) => (
                    <option key={level} value={level}>
                      {PRIORITY_LEVEL_LABELS[level]}
                    </option>
                  ),
                )}
              </select>
              <p className="mt-1 text-[11px] text-neutral-500">
                시스템 권장: {PRIORITY_LEVEL_LABELS[recommendedPriorityLevel]} ·
                4~5단계는 사용자가 직접 지정하는 선호/최우선 매물입니다.
              </p>
            </div>
            <div className="sm:col-span-2">
              <BasicFieldLabel missing={basicPreFieldMissing.has("address")}>
                주소
              </BasicFieldLabel>
              <AddressSearchField
                address={(caseForForm ?? c).address ?? ""}
                addressMeta={(caseForForm ?? c).addressMeta ?? null}
                inputClassName={basicInputClass(basicPreFieldMissing.has("address"))}
                onAddressChange={(next) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    address: next,
                  })
                }
                onAddressMetaChange={(meta) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    addressMeta: meta,
                  })
                }
              />
              <ExternalMapLinks
                address={(caseForForm ?? c).address ?? ""}
                addressMeta={(caseForForm ?? c).addressMeta}
                mapLat={c.nearbyMarketAnalysis?.lat}
                mapLng={c.nearbyMarketAnalysis?.lng}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:col-span-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  물건 유형
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).propertyType}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      propertyType: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("builtYear")}>
                  준공년도
                </BasicFieldLabel>
                <input
                  className={basicInputClass(basicPreFieldMissing.has("builtYear"))}
                  value={(caseForForm ?? c).builtYear ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      builtYear: e.target.value,
                    })
                  }
                  placeholder="예: 1998"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  층
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).floor}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      floor: e.target.value,
                    })
                  }
                  placeholder="예: 지상3층"
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("householdCount")}>
                  가구 수
                </BasicFieldLabel>
                <input
                  inputMode="numeric"
                  className={basicInputClass(
                    basicPreFieldMissing.has("householdCount"),
                    "tabular-nums",
                  )}
                  value={
                    (caseForForm ?? c).householdCount != null
                      ? String((caseForForm ?? c).householdCount)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const n =
                      raw === ""
                        ? null
                        : Math.min(99999, parseInt(raw, 10) || 0);
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      householdCount: n,
                    });
                  }}
                  placeholder="세대·호 수"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:col-span-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  주택 호수
                </label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={
                    (caseForForm ?? c).residentialUnitCount != null
                      ? String((caseForForm ?? c).residentialUnitCount)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const n = raw === "" ? null : Math.min(99999, parseInt(raw, 10) || 0);
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      residentialUnitCount: n,
                      householdCount: n ?? (caseForForm ?? c).householdCount,
                    });
                  }}
                  placeholder="예: 9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  상가·근린 호수
                </label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={
                    (caseForForm ?? c).commercialUnitCount != null
                      ? String((caseForForm ?? c).commercialUnitCount)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const n = raw === "" ? null : Math.min(99999, parseInt(raw, 10) || 0);
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      commercialUnitCount: n,
                    });
                  }}
                  placeholder="예: 2"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:col-span-2">
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("landAreaSqm")}>
                  토지면적 (㎡)
                </BasicFieldLabel>
                <input
                  inputMode="decimal"
                  className={basicInputClass(
                    basicPreFieldMissing.has("landAreaSqm"),
                    "tabular-nums",
                  )}
                  value={landSqmInput}
                  onChange={(e) =>
                    setLandSqmInput(filterAreaSqmInputRaw(e.target.value))
                  }
                  placeholder="예: 165.2"
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("buildingAreaSqm")}>
                  건물면적 (㎡)
                </BasicFieldLabel>
                <input
                  inputMode="decimal"
                  className={basicInputClass(
                    basicPreFieldMissing.has("buildingAreaSqm"),
                    "tabular-nums",
                  )}
                  value={buildingSqmInput}
                  onChange={(e) =>
                    setBuildingSqmInput(filterAreaSqmInputRaw(e.target.value))
                  }
                  placeholder="예: 298.45"
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("parkingUnitCount")}>
                  주차 대수
                </BasicFieldLabel>
                <input
                  inputMode="numeric"
                  className={basicInputClass(
                    basicPreFieldMissing.has("parkingUnitCount"),
                    "tabular-nums",
                  )}
                  value={parkingCountInput}
                  onChange={(e) =>
                    setParkingCountInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="대"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={(caseForForm ?? c).hasBuildingViolation}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      hasBuildingViolation: e.target.checked,
                    })
                  }
                  className="rounded border-neutral-300"
                />
                위반건축 (건축물대장 등)
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:col-span-2">
              <div>
                <BasicFieldLabel
                  missing={basicPreFieldMissing.has("buildingCoverageRatio")}
                >
                  건폐율
                </BasicFieldLabel>
                <input
                  className={basicInputClass(
                    basicPreFieldMissing.has("buildingCoverageRatio"),
                  )}
                  value={(caseForForm ?? c).buildingCoverageRatio ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      buildingCoverageRatio: e.target.value,
                    })
                  }
                  placeholder="예: 60%"
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("floorAreaRatio")}>
                  용적률
                </BasicFieldLabel>
                <input
                  className={basicInputClass(
                    basicPreFieldMissing.has("floorAreaRatio"),
                  )}
                  value={(caseForForm ?? c).floorAreaRatio ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      floorAreaRatio: e.target.value,
                    })
                  }
                  placeholder="예: 200%"
                />
              </div>
              <div>
                <BasicFieldLabel missing={basicPreFieldMissing.has("lienBaseline")}>
                  말소기준일
                </BasicFieldLabel>
                <input
                  className={basicInputClass(basicPreFieldMissing.has("lienBaseline"))}
                  value={(caseForForm ?? c).lienBaseline ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      lienBaseline: e.target.value,
                    })
                  }
                  placeholder="예: 2020-09-15 근저당"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <p
                  className={`text-xs font-medium ${
                    basicPreFieldMissing.has("roomShapeMix")
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-neutral-500"
                  }`}
                >
                  가구 형태
                </p>
                {basicPreFieldMissing.has("roomShapeMix") && (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                    임장 전 필수
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                룸 타입별 호실 수
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ROOM_SHAPE_OPTIONS.map((shape) => {
                  const mix = {
                    ...emptyRoomShapeMix(),
                    ...((caseForForm ?? c).roomShapeMix ?? {}),
                  };
                  return (
                    <label
                      key={shape}
                      className="block text-[11px] text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {shape}
                      </span>
                      <input
                        inputMode="numeric"
                        className={`mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-sm tabular-nums dark:bg-neutral-900 ${
                          basicPreFieldMissing.has("roomShapeMix")
                            ? "border-rose-400 bg-rose-50/60 dark:border-rose-700 dark:bg-rose-950/20"
                            : "border-neutral-300 dark:border-neutral-700"
                        }`}
                        value={
                          mix[shape] === 0 ? "" : String(mix[shape])
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const num =
                            raw === ""
                              ? 0
                              : Math.min(9999, parseInt(raw, 10) || 0);
                          const base = caseForForm ?? c;
                          setBasicDraft({
                            ...base,
                            roomShapeMix: {
                              ...emptyRoomShapeMix(),
                              ...(base.roomShapeMix ?? {}),
                              [shape]: num,
                            },
                          });
                        }}
                        placeholder="0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    건축물대장 층별 구성
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    층별 용도, 면적, 주택/상가 호수를 입력하면 평균 주택면적과 근린 포함 여부가 자동 표시됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
                  onClick={() => {
                    const base = caseForForm ?? c;
                    setBasicDraft({
                      ...base,
                      buildingUnitComposition: [
                        ...(base.buildingUnitComposition ?? []),
                        newBuildingUnitCompositionRow(),
                      ],
                    });
                  }}
                >
                  층별 행 추가
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {((caseForForm ?? c).buildingUnitComposition ?? []).length === 0 ? (
                  <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-900">
                    건축물대장 PDF를 `원문/PDF` 탭에서 `건축물대장` 종류로 등록하면 자동으로 채워집니다.
                  </p>
                ) : (
                  ((caseForForm ?? c).buildingUnitComposition ?? []).map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900 sm:grid-cols-[0.8fr_1fr_1.4fr_0.8fr_0.8fr_auto]"
                    >
                      <input
                        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                        value={row.floor}
                        onChange={(e) =>
                          setBasicDraft(
                            updateBuildingUnitComposition(caseForForm ?? c, row.id, {
                              floor: e.target.value,
                            }),
                          )
                        }
                        placeholder="층"
                      />
                      <select
                        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                        value={row.useType}
                        onChange={(e) =>
                          setBasicDraft(
                            updateBuildingUnitComposition(caseForForm ?? c, row.id, {
                              useType: e.target.value as BuildingUnitUseType,
                            }),
                          )
                        }
                      >
                        <option value="residential">주택</option>
                        <option value="commercial">상가·근린</option>
                        <option value="other">기타</option>
                      </select>
                      <input
                        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                        value={row.useLabel}
                        onChange={(e) =>
                          setBasicDraft(
                            updateBuildingUnitComposition(caseForForm ?? c, row.id, {
                              useLabel: e.target.value,
                            }),
                          )
                        }
                        placeholder="용도"
                      />
                      <input
                        inputMode="decimal"
                        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                        value={row.areaSqm ?? ""}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(",", "."));
                          setBasicDraft(
                            updateBuildingUnitComposition(caseForForm ?? c, row.id, {
                              areaSqm: Number.isFinite(n) && n >= 0 ? n : null,
                            }),
                          );
                        }}
                        placeholder="면적㎡"
                      />
                      <input
                        inputMode="numeric"
                        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                        value={row.unitCount === 0 ? "" : String(row.unitCount)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          setBasicDraft(
                            updateBuildingUnitComposition(caseForForm ?? c, row.id, {
                              unitCount:
                                raw === "" ? 0 : Math.min(9999, parseInt(raw, 10) || 0),
                            }),
                          );
                        }}
                        placeholder="호수"
                      />
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-2 py-1.5 text-xs text-rose-700 dark:border-rose-900 dark:text-rose-300"
                        onClick={() => {
                          const base = caseForForm ?? c;
                          const buildingUnitComposition = (
                            base.buildingUnitComposition ?? []
                          ).filter((x) => x.id !== row.id);
                          const residentialUnitCount = countCompositionUnits(
                            buildingUnitComposition,
                            "residential",
                          );
                          const commercialUnitCount = countCompositionUnits(
                            buildingUnitComposition,
                            "commercial",
                          );
                          setBasicDraft({
                            ...base,
                            buildingUnitComposition,
                            residentialUnitCount: residentialUnitCount || null,
                            commercialUnitCount: commercialUnitCount || null,
                            householdCount: residentialUnitCount || base.householdCount,
                          });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <BasicFieldLabel missing={basicPreFieldMissing.has("appraisalPrice")}>
                감정가 (원)
              </BasicFieldLabel>
              <input
                inputMode="numeric"
                className={basicInputClass(basicPreFieldMissing.has("appraisalPrice"))}
                value={
                  (caseForForm ?? c).appraisalPrice != null
                    ? formatWonDigits((caseForForm ?? c).appraisalPrice)
                    : ""
                }
                onChange={(e) =>
                  {
                    const appraisalPrice = parseWonInput(e.target.value);
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    appraisalPrice,
                    expectedBidPrice:
                      (caseForForm ?? c).expectedBidPrice ??
                      (appraisalPrice != null ? Math.round(appraisalPrice * 0.7) : null),
                  });
                  }
                }
              />
            </div>
            <div>
              <BasicFieldLabel missing={basicPreFieldMissing.has("minPrice")}>
                최저가 (원)
              </BasicFieldLabel>
              <input
                inputMode="numeric"
                className={basicInputClass(basicPreFieldMissing.has("minPrice"))}
                value={
                  (caseForForm ?? c).minPrice != null
                    ? formatWonDigits((caseForForm ?? c).minPrice)
                    : ""
                }
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    minPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                예상 낙찰가 (원, 감정가 70% 기본)
              </label>
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  (caseForForm ?? c).expectedBidPrice != null
                    ? formatWonDigits((caseForForm ?? c).expectedBidPrice)
                    : (caseForForm ?? c).appraisalPrice != null
                      ? formatWonDigits(Math.round((caseForForm ?? c).appraisalPrice! * 0.7))
                      : ""
                }
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    expectedBidPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-950 dark:text-sky-100">
                    인근 매각사례 분석
                  </p>
                  <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-100/80">
                    기본정보 입력 단계에서 주변 낙찰 사례를 함께 기록해 감정가 대비
                    입찰가와 실거래 매매 평균을 비교합니다.
                  </p>
                </div>
                {viewCase.nearbyMarketAnalysis && (
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-sky-800 dark:bg-neutral-950 dark:text-sky-200">
                    주변 시세 반영됨
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium text-sky-900 dark:text-sky-100">
                  인근 매각가
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm tabular-nums text-neutral-900 dark:border-sky-900 dark:bg-neutral-950 dark:text-neutral-100"
                    value={
                      saleCaseAnalysis.saleCaseBidPrice != null
                        ? formatWonDigits(saleCaseAnalysis.saleCaseBidPrice)
                        : ""
                    }
                    onChange={(e) =>
                      updateBasicSaleCaseAnalysis({
                        saleCaseBidPrice: parseWonInput(e.target.value),
                      })
                    }
                    placeholder="낙찰가"
                  />
                </label>
                <label className="text-xs font-medium text-sky-900 dark:text-sky-100">
                  인근 낙찰가율 (%)
                  <PercentRateInput
                    className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm tabular-nums text-neutral-900 dark:border-sky-900 dark:bg-neutral-950 dark:text-neutral-100"
                    valueMode="percent"
                    value={saleCaseAnalysis.saleCaseBidRatePct}
                    onChange={(v) =>
                      updateBasicSaleCaseAnalysis({ saleCaseBidRatePct: v })
                    }
                    placeholder={
                      saleCaseRate != null
                        ? saleCaseRate.toFixed(2)
                        : "예: 72.55"
                    }
                  />
                </label>
                <label className="text-xs font-medium text-sky-900 dark:text-sky-100">
                  사례 보증금
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm tabular-nums text-neutral-900 dark:border-sky-900 dark:bg-neutral-950 dark:text-neutral-100"
                    value={
                      saleCaseAnalysis.saleCaseDeposit != null
                        ? formatWonDigits(saleCaseAnalysis.saleCaseDeposit)
                        : ""
                    }
                    onChange={(e) =>
                      updateBasicSaleCaseAnalysis({
                        saleCaseDeposit: parseWonInput(e.target.value),
                      })
                    }
                    placeholder="보증금"
                  />
                </label>
                <label className="text-xs font-medium text-sky-900 dark:text-sky-100">
                  사례 월세
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm tabular-nums text-neutral-900 dark:border-sky-900 dark:bg-neutral-950 dark:text-neutral-100"
                    value={
                      saleCaseAnalysis.saleCaseMonthlyRent != null
                        ? formatWonDigits(saleCaseAnalysis.saleCaseMonthlyRent)
                        : ""
                    }
                    onChange={(e) =>
                      updateBasicSaleCaseAnalysis({
                        saleCaseMonthlyRent: parseWonInput(e.target.value),
                      })
                    }
                    placeholder="월세"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MarketMetric
                  label="사례 기준 입찰가"
                  value={formatWonWithUnit(saleCaseBasedBid)}
                />
                <MarketMetric
                  label="국토부 매매 평균"
                  value={formatWonWithUnit(nearbySaleAvgWon)}
                />
                <MarketMetric
                  label="사례-실거래 평균 차이"
                  value={formatWonWithUnit(saleCaseVsNearby)}
                />
              </div>
              <label className="mt-3 block text-xs font-medium text-sky-900 dark:text-sky-100">
                매각사례 메모
                <AutoGrowTextarea
                  className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-sky-900 dark:bg-neutral-950 dark:text-neutral-100"
                  value={saleCaseAnalysis.saleCaseMemo}
                  onChange={(e) =>
                    updateBasicSaleCaseAnalysis({ saleCaseMemo: e.target.value })
                  }
                  placeholder="사례 주소, 준공연도, 세대수, 주차, 권리 차이, 수리상태 등을 기록하세요."
                  maxViewportFraction={0.5}
                />
              </label>
            </div>
            <div className="sm:col-span-2">
              <BasicFieldLabel missing={basicPreFieldMissing.has("bidDate")}>
                입찰일
              </BasicFieldLabel>
              <input
                type="date"
                className={basicInputClass(basicPreFieldMissing.has("bidDate"))}
                value={(caseForForm ?? c).bidDate ?? ""}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    bidDate: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">
                임장조사
              </label>
              <AutoGrowTextarea
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="현장 확인, 주변 시세, 관리비·공실 등"
                value={(caseForForm ?? c).fieldSurvey}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    fieldSurvey: e.target.value,
                  })
                }
                maxViewportFraction={0.7}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">메모</label>
              <AutoGrowTextarea
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).memo}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    memo: e.target.value,
                  })
                }
                maxViewportFraction={0.7}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveBasic}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              기본 정보 저장
            </button>
            <button
              type="button"
              onClick={() => {
                if (basicDraft) syncDraftFromCase();
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
            >
              편집 취소
            </button>
            <button
              type="button"
              onClick={fillBlankBasicFromDocuments}
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:text-emerald-200"
            >
              문서로 빈칸 자동 채우기
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "저장된 체크리스트 진행 상황이 초기화될 수 있습니다. 계속할까요?",
                  )
                ) {
                  reapplyTemplatesToCase(id);
                }
              }}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:text-amber-200"
            >
              최신 프로세스 템플릿으로 체크리스트 재생성
            </button>
          </div>
          {c.nextExpectedMinPrice != null && (
            <p className="text-xs text-neutral-500">
              다음 회차 예상 최저가(감액 20% 가정):{" "}
              <strong className="tabular-nums">
                {formatWonWithUnit(c.nextExpectedMinPrice)}
              </strong>
            </p>
          )}
        </section>
      )}

      {tab === "rent" && (
        <CaseRentSettingPanel
          key={id}
          caseData={viewCase}
          leasingFocus={postLeasingRentView}
          templateExtras={extras}
          onSave={saveRentSetting}
        />
      )}

      {tab === "multi_family" && (
        <CaseMultiFamilyAnalysisPanel
          key={id}
          caseData={viewCase}
          onSave={saveMultiFamilyAnalysis}
          onUpdateCase={(patch) => updateCase(id, patch)}
        />
      )}

      {tab === "bid_analysis" && (
        <CaseAuctionBidAnalysisPanel
          key={id}
          caseId={id}
          caseData={c}
          onUpdateCase={updateCaseBidAnalysis}
        />
      )}

      {tab === "analysis_report" && (
        <CaseAnalysisReportPanel
          key={`${id}-${c.updatedAt}`}
          caseId={id}
          caseData={c}
          onSave={(patch) => saveWorkflowPatch(patch)}
          onJumpToTab={(t) => setTab(t as Tab)}
        />
      )}

      {tab === "post_workflow" && (
        <CasePostAuctionPanel
          key={`${id}-${c.updatedAt}`}
          caseData={c}
          activePackageId={phaseUiPackage}
          onSave={(patch) => saveWorkflowPatch(patch)}
        />
      )}

      {tab === "ai_analysis" && (
        <CaseAiAnalysisPanel
          key={id}
          caseData={viewCase}
          onUpdateCase={updateCaseExternalAiQa}
        />
      )}

      {tab === "market_analysis" && (
        <NearbyMarketAnalysisPanel
          caseData={viewCase}
          allCases={allCases}
          onImport={saveNearbyMarketAnalysis}
          onClear={clearNearbyMarketAnalysis}
          onApplyRentSetting={applyMarketRentToRentSetting}
        />
      )}

      {tab === "source_docs" && (
        <SourceDocumentsPanel
          caseId={id}
          caseNumber={c.caseNumber}
          documents={c.sourceDocuments}
          listThumbnail={c.listThumbnail}
          onAddDocument={addSourceDocument}
          onListThumbnailChange={(listThumbnail) => {
            updateCase(id, { listThumbnail });
          }}
        />
      )}

      {tab === "tenant_analysis" && (
        <div className="space-y-3">
          <TenantAnalysisPanel
            caseId={id}
            caseNumber={c.caseNumber}
            compact={postEvictionTenantView}
            documents={c.sourceDocuments}
            onDocumentsChange={updateSourceDocumentsFromAnalysis}
            noDividendRequestGuide={noDividendRequestGuide}
            onNoDividendRequestGuideChange={setNoDividendRequestGuide}
            fallbackAddress={c.address}
            fallbackMinimumPrice={c.minPrice}
            fallbackExpectedBidPrice={c.expectedBidPrice}
            fallbackAppraisalPrice={c.appraisalPrice}
            tenantRecords={c.tenantRecords}
            onExpectedBidPriceChange={(expectedBidPrice) => {
              updateCase(id, { expectedBidPrice });
              syncDraftFromCase();
            }}
            onTenantRecordsChange={(tenantRecords) => {
              updateCase(id, { tenantRecords });
              syncDraftFromCase();
            }}
            onTenantSpecApplied={() => {
              if (!hasMeaningfulRentUnitRows(c.rentSetting?.unitRows)) {
                prefillRentSettingFromTenants();
              }
            }}
          />
          {!postEvictionTenantView && (
            <details className="rounded-xl border border-amber-200/80 bg-amber-50/20 dark:border-amber-900/50 dark:bg-amber-950/10">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-amber-950 dark:text-amber-100">
                §8 보고서 표 · 인쇄 (펼치기)
              </summary>
              <div className="border-t border-amber-200/60 px-2 pb-2 pt-1 dark:border-amber-900/40">
                <CaseTenantRecordsPanel
                  caseData={c}
                  onChange={(tenantRecords) => {
                    updateCase(id, { tenantRecords });
                    syncDraftFromCase();
                  }}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "remodeling" && (
        <CaseRemodelingPanel
          key={id}
          caseData={viewCase}
          priceCatalog={remodelingPriceCatalog}
          onSaveCatalog={setRemodelingPriceCatalog}
          onSave={saveRemodeling}
          onApplyRepairCost={applyRemodelingRepairCost}
        />
      )}

      {tab === "field_inspection" && (
        <div className="space-y-4">
          <FieldPhotoGalleryPanel
            caseId={id}
            gallery={c.fieldPhotoGallery}
            onChange={(fieldPhotoGallery) => {
              updateCase(id, { fieldPhotoGallery });
              syncDraftFromCase();
            }}
          />
          <CaseFieldInspectionPanel
            key={id}
            caseData={viewCase}
            onSave={saveMultiFamilyAnalysis}
            onUpdateCase={(patch) => {
              updateCase(id, patch);
              syncDraftFromCase();
            }}
            onAppendFieldSurvey={(text) => {
              const base = (c.fieldSurvey ?? "").trim();
              updateCase(id, {
                fieldSurvey: base ? `${base}\n\n${text}` : text,
              });
              syncDraftFromCase();
            }}
          />
        </div>
      )}

      {tab === "checklists" && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            항목 문구·필수 여부를 바꾸거나 행을 추가·삭제할 수 있습니다. 전체
            단계를 프로세스 템플릿과 맞추려면 기본 정보 탭의
            &quot;재생성&quot;을 사용하세요.
          </p>
          {c.checklists.map((cl) => (
            <section
              key={cl.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <h3 className="font-medium">{cl.title}</h3>
              <ul className="mt-3 space-y-3">
                {cl.items.map((it) => (
                  <li
                    key={it.id}
                    className="rounded-lg border border-neutral-100 p-2 dark:border-neutral-900"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <label className="flex shrink-0 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={(e) =>
                            toggleChecklistItem(
                              id,
                              cl.id,
                              it.id,
                              e.target.checked,
                            )
                          }
                          className="mt-1"
                        />
                        <span className="text-xs text-neutral-500">완료</span>
                      </label>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="w-full min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                            placeholder="체크리스트 항목"
                            value={it.label}
                            onChange={(e) =>
                              updateCaseChecklistItemFields(
                                id,
                                cl.id,
                                it.id,
                                { label: e.target.value },
                              )
                            }
                          />
                          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={it.required}
                              onChange={(e) =>
                                updateCaseChecklistItemFields(
                                  id,
                                  cl.id,
                                  it.id,
                                  { required: e.target.checked },
                                )
                              }
                            />
                            필수
                          </label>
                          <button
                            type="button"
                            className="text-xs text-rose-600 hover:underline"
                            onClick={() =>
                              removeCaseChecklistItem(id, cl.id, it.id)
                            }
                          >
                            삭제
                          </button>
                        </div>
                        <input
                          placeholder="완료 메모"
                          className="w-full rounded border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900"
                          value={it.note}
                          onChange={(e) =>
                            setChecklistItemNote(
                              id,
                              cl.id,
                              it.id,
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => addCaseChecklistItem(id, cl.id)}
                className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
              >
                항목 추가
              </button>
            </section>
          ))}
        </div>
      )}

      {tab === "rounds" && (
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <BidRoundsEditor
            caseId={id}
            rounds={c.bidRounds}
            addBidRound={addBidRound}
            updateBidRound={updateBidRound}
            removeBidRound={removeBidRound}
          />
        </section>
      )}

      {tab === "decision" && (
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              판단
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={c.decision.verdict ?? ""}
                onChange={(e) =>
                  setDecision(id, {
                    verdict:
                      e.target.value === ""
                        ? null
                        : (e.target.value as NonNullable<
                            AuctionCase["decision"]["verdict"]
                          >),
                  })
                }
              >
                <option value="">미정</option>
                <option value="recommend">입찰 추천</option>
                <option value="caution">주의</option>
                <option value="not_recommend">비추천</option>
                <option value="abandon">포기</option>
              </select>
            </label>
            <label className="text-sm">
              리스크
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={c.decision.riskLevel ?? ""}
                onChange={(e) =>
                  setDecision(id, {
                    riskLevel:
                      e.target.value === ""
                        ? null
                        : (e.target.value as NonNullable<
                            AuctionCase["decision"]["riskLevel"]
                          >),
                  })
                }
              >
                <option value="">미정</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label className="text-sm">
              최대 입찰 가능가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  c.decision.maxBidPrice != null
                    ? formatWonDigits(c.decision.maxBidPrice)
                    : ""
                }
                onChange={(e) =>
                  setDecision(id, {
                    maxBidPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm">
              실제 입찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  c.decision.actualBidPrice != null
                    ? formatWonDigits(c.decision.actualBidPrice)
                    : ""
                }
                onChange={(e) =>
                  setDecision(id, {
                    actualBidPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="text-sm">
            판단 사유
            <textarea
              rows={5}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={c.decision.reason}
              onChange={(e) =>
                setDecision(id, { reason: e.target.value })
              }
            />
          </label>
        </section>
      )}

      {tab === "templates" && postLoanInquiryView && (
        <CaseLoanInquiryPanel
          caseData={viewCase}
          templateBody={
            templates.find(
              (tm) =>
                tm.id === "tmpl-loan-inquiry" ||
                tm.category === "loan_inquiry",
            )?.body ?? ""
          }
          extras={extras}
          onExtrasChange={setExtras}
          onSave={(patch) => saveWorkflowPatch(patch)}
        />
      )}

      {tab === "templates" && !postLoanInquiryView && (
        <section className="space-y-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="text-sm font-medium">문자에 넣을 추가 값</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              물건 기본 필드 외에 문자에 필요한 값입니다.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ...LOAN_INQUIRY_EXTRA_KEYS,
                  "보증금",
                  "내입찰가",
                ] as const
              ).map((key) => (
                <label key={key} className="text-xs font-medium text-neutral-600">
                  {key}
                  <input
                    className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm tabular-nums dark:border-neutral-800 dark:bg-neutral-900"
                    inputMode={
                      (MONEY_EXTRA_KEYS as readonly string[]).includes(key)
                        ? "numeric"
                        : undefined
                    }
                    value={extras[key] ?? ""}
                    onChange={(e) =>
                      (MONEY_EXTRA_KEYS as readonly string[]).includes(key)
                        ? onExtraMoneyChange(
                            key as (typeof MONEY_EXTRA_KEYS)[number],
                            e.target.value,
                            setExtras,
                          )
                        : setExtras((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          {templates.map((tm) => {
            const ctx = buildTemplateContext(viewCase, extras);
            const body = interpolateTemplate(tm.body, ctx);
            return (
              <div
                key={tm.id}
                className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{tm.name}</h3>
                  <CopyButton text={body} label="원클릭 복사" />
                </div>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                  {body}
                </pre>
              </div>
            );
          })}

          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer">표준 변수 키 목록</summary>
            <p className="mt-2">
              {STANDARD_TEMPLATE_KEYS.map((k) => `{${k}}`).join(" · ")}
            </p>
          </details>
        </section>
      )}

      {tab === "tools" && (
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="font-medium">차순위 매수신고 가능 여부</h3>
          <p className="text-xs text-neutral-500">
            낙찰가 − 보증금 &lt; 내 입찰가 이면 신고 가능 (PRD).
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              낙찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={winP}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setWinP(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
            <label className="text-xs">
              보증금 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={dep}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setDep(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
            <label className="text-xs">
              내 입찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={myBid}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setMyBid(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
          </div>
          {secondOk != null && (
            <p className="text-sm font-medium">
              결과:{" "}
              {secondOk ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  차순위 매수신고 가능 조건 충족
                </span>
              ) : (
                <span className="text-rose-700 dark:text-rose-400">
                  조건 미충족 (입찰가가 더 낮거나 같음)
                </span>
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function NearbyMarketAnalysisPanel({
  caseData,
  allCases,
  onImport,
  onClear,
  onApplyRentSetting,
}: {
  caseData: AuctionCase;
  allCases: AuctionCase[];
  onImport: (raw: unknown) => void;
  onClear: () => void;
  onApplyRentSetting: (listing: MarketListingItem, mode: RentSettingApplyMode) => number;
}) {
  const [jsonText, setJsonText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [rentCondition, setRentCondition] = useState<RentCondition>("pre_field");
  const [marketBusy, setMarketBusy] = useState(false);
  const guMarketCache = useAppStore((s) => s.data.guMarketCache);
  const setGuMarketCache = useAppStore((s) => s.setGuMarketCache);
  const analysis = caseData.nearbyMarketAnalysis;
  const hasMolitMarketData = marketMolitDataAppliesToCase(caseData);
  const lawdCode = resolveMolitLawdCode(caseData.address, caseData.addressMeta);
  const guCacheEntry =
    lawdCode && guMarketCache[guMarketCacheKey(lawdCode)]
      ? guMarketCache[guMarketCacheKey(lawdCode)]
      : null;
  const guCacheMolitCount =
    guCacheEntry?.listings.filter((item) => item.source === "molit").length ?? 0;
  const reusableMarketCases = findReusableMarketCases(allCases, caseData);
  const sortedListings = analysis
    ? sortMarketListingsForCase(analysis.listings, caseData)
    : [];
  const tenantRentComparisons = analysis
    ? buildTenantRentComparisons(caseData, analysis)
    : [];
  const suggestedRows = analysis ? buildSuggestedRentRows(caseData, analysis) : [];
  const recentRentGroups = analysis
    ? buildRecentRentGroups(analysis, rentCondition, caseData)
    : [];

  const importJsonText = (text: string) => {
    try {
      const raw = JSON.parse(text);
      const parsed = normalizeNearbyMarketAnalysis(raw, caseData);
      if (!parsed) {
        setMessage("시세 분석 JSON 형식을 읽지 못했습니다.");
        return;
      }
      onImport(parsed);
      setMessage("주변 시세 분석 데이터를 가져왔습니다.");
      setJsonText("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "JSON 파싱에 실패했습니다.");
    }
  };

  const fetchNearbyMarket = async (forceRefresh = false) => {
    if (!caseData.address.trim()) {
      setMessage("주소를 먼저 입력하세요.");
      return;
    }
    if (hasMolitMarketData && !forceRefresh) {
      setMessage(
        "이 물건에 국토부 주변 시세가 이미 있습니다. 다시 조회하려면 「분석 데이터 제거」 또는 「구 캐시 갱신」을 사용하세요.",
      );
      return;
    }
    const lawdCode = resolveMolitLawdCode(
      caseData.address,
      caseData.addressMeta,
    );
    const cacheKey = lawdCode ? guMarketCacheKey(lawdCode) : "";
    const cached = cacheKey ? guMarketCache[cacheKey] : undefined;

    setMarketBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/market/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: caseData.address,
          addressMeta: caseData.addressMeta,
          lawdCode: lawdCode ?? undefined,
          guMarketCache: cached,
          forceRefresh,
          buildingAreaSqm: caseData.buildingAreaSqm,
          builtYear: caseData.builtYear,
        }),
      });
      const json = (await response.json()) as
        | {
            ok: true;
            analysis: unknown;
            guMarketCache?: unknown;
            warnings?: string[];
            cacheUsed?: boolean;
          }
        | { ok: false; error: string };
      if (!json.ok) {
        setMessage(json.error || "주변 시세 조회에 실패했습니다.");
        return;
      }
      const parsed = normalizeNearbyMarketAnalysis(json.analysis, caseData);
      if (!parsed) {
        setMessage("국토부 응답을 주변 시세 형식으로 읽지 못했습니다.");
        return;
      }
      onImport(parsed);
      if (
        json.guMarketCache &&
        typeof json.guMarketCache === "object" &&
        "lawdCode" in (json.guMarketCache as object)
      ) {
        setGuMarketCache(json.guMarketCache as GuMarketCacheEntry);
      }
      const warningText =
        json.warnings && json.warnings.length > 0
          ? ` ${json.warnings.slice(0, 2).join(" / ")}`
          : "";
      const cacheNote = json.cacheUsed ? " (구 캐시 재사용)" : "";
      setMessage(
        parsed.molitCount > 0
          ? `국토부 실거래 ${parsed.molitCount}건 (매매 10년·전월세 1년)${cacheNote}.${warningText}`
          : `조회는 완료됐지만 해당 구 실거래가 없습니다.${warningText}`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "주변 시세 조회에 실패했습니다.");
    } finally {
      setMarketBusy(false);
    }
  };

  const reuseFromGuCache = () => {
    if (hasMolitMarketData) {
      setMessage(
        "이 물건에 국토부 주변 시세가 이미 있습니다. 다른 데이터를 쓰려면 「분석 데이터 제거」 후 진행하세요.",
      );
      return;
    }
    if (!guCacheEntry || guCacheMolitCount === 0) {
      setMessage("이 구에 저장된 국토부 캐시가 없습니다. 「주변 시세 조회」로 먼저 수집하세요.");
      return;
    }
    const reused = buildNearbyMarketAnalysisFromListings(
      guCacheEntry.listings,
      {
        city: guCacheEntry.city,
        gu: guCacheEntry.gu,
        saleMonths: MOLIT_SALE_MONTHS,
        rentMonths: MOLIT_RENT_MONTHS,
        months: MOLIT_RENT_MONTHS,
      },
      caseData,
    );
    onImport(reused);
    setMessage(
      `저장된 ${guCacheEntry.gu || "같은 구"} 국토부 캐시 ${reused.molitCount}건을 현재 물건 기준으로 적용했습니다.`,
    );
  };

  const reuseNearbyMarket = (sourceCase: AuctionCase) => {
    if (hasMolitMarketData) {
      setMessage(
        "이 물건에 국토부 주변 시세가 이미 있습니다. 다른 물건 시세를 쓰려면 「분석 데이터 제거」 후 진행하세요.",
      );
      return;
    }
    if (!sourceCase.nearbyMarketAnalysis) return;
    const reused = buildReusedNearbyMarketAnalysis(sourceCase, caseData);
    if (!reused) {
      setMessage("기존 시세 데이터를 현재 물건 기준으로 재계산하지 못했습니다.");
      return;
    }
    onImport(reused);
    setMessage(
      `${sourceCase.caseNumber || sourceCase.address || "기존 물건"}의 같은 구 시세 ${reused.molitCount}건을 현재 물건 기준으로 재정렬했습니다.`,
    );
  };

  const applyRentSetting = (item: MarketListingItem, mode: RentSettingApplyMode) => {
    const count = onApplyRentSetting(item, mode);
    if (count === 0) {
      setMessage("선택한 월세를 적용할 임대세팅 행을 찾지 못했습니다.");
      return;
    }
    const target =
      mode === "sameRoomType" ? `같은 룸타입 ${count}개 행` : "첫 빈 호실 1개 행";
    setMessage(
      `${item.roomType || "월세"} ${formatManwon(item.depositManwon)} / ${formatManwon(item.monthlyRentManwon)}을 ${target}에 반영했습니다.`,
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">주변 월세 및 전세 가격분석</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            물건 주소를 기준으로 국토부 실거래 데이터를 바로 조회해 방 크기별
            전월세 시세를 비교합니다. 기존 물건 데이터는 지우지 않고 이 물건에만
            분석 결과를 갱신합니다.
          </p>
        </div>
        {analysis && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"
          >
            분석 데이터 제거
          </button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-sm font-medium">국토부 실거래 바로 조회</p>
          <p className="mt-1 text-xs text-neutral-500">
            매매 <strong>10년</strong>·전월세 <strong>1년</strong>을 구 단위로
            수집합니다. 같은 구는 캐시를 재사용해 API 호출을 줄입니다. 월세·전세
            탭에서 표시는 3/6/12개월을 선택할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => void fetchNearbyMarket(false)}
              disabled={marketBusy || !caseData.address.trim() || hasMolitMarketData}
              title={
                hasMolitMarketData
                  ? "분석 데이터 제거 후 다시 조회할 수 있습니다."
                  : undefined
              }
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {marketBusy
                ? "조회 중..."
                : hasMolitMarketData
                  ? "주변 시세 조회됨"
                  : "주변 시세 조회 (10년·1년)"}
            </button>
            {hasMolitMarketData && (
              <button
                type="button"
                onClick={() => void fetchNearbyMarket(true)}
                disabled={marketBusy || !caseData.address.trim()}
                className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                {marketBusy ? "갱신 중…" : "구 캐시 갱신"}
              </button>
            )}
            <a
              href={molitGisUrl()}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
            >
              국토부 GIS
            </a>
            <a
              href={naverLandSearchUrl(
                preferLandSearchAddress(caseData.address, caseData.addressMeta),
                analysis?.lat,
                analysis?.lng,
                caseData.addressMeta?.legalDongCode,
              )}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
            >
              네이버 부동산 지도
            </a>
          </div>
          {!hasMolitMarketData &&
            (guCacheMolitCount > 0 || reusableMarketCases.length > 0) && (
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium">같은 구 기존 시세 재사용</p>
              <p className="mt-1 opacity-80">
                저장된 구 캐시 또는 다른 물건의 시세를 현재 물건의 동·면적·준공·세입자
                조건으로 다시 정렬해 사용합니다.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {guCacheMolitCount > 0 && (
                  <button
                    type="button"
                    onClick={reuseFromGuCache}
                    className="rounded-lg border border-sky-400 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-700 dark:bg-neutral-950 dark:text-sky-100"
                  >
                    구 캐시 ({guCacheEntry?.gu || "같은 구"}) · {guCacheMolitCount}건
                  </button>
                )}
                {reusableMarketCases.slice(0, 5).map((sourceCase) => (
                  <button
                    key={sourceCase.id}
                    type="button"
                    onClick={() => reuseNearbyMarket(sourceCase)}
                    className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-neutral-950 dark:text-sky-100"
                  >
                    {(sourceCase.caseNumber || sourceCase.address || "기존 시세").slice(0, 24)} ·{" "}
                    {sourceCase.nearbyMarketAnalysis?.molitCount ?? sourceCase.nearbyMarketAnalysis?.listings.length ?? 0}건
                  </button>
                ))}
              </div>
            </div>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-neutral-500">
              수동 JSON 가져오기
            </summary>
            <textarea
              className="mt-2 min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-900"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{"marketAnalysis":{"listings":[...]}}'
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => importJsonText(jsonText)}
                disabled={!jsonText.trim()}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                붙여넣은 JSON 반영
              </button>
              <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">
                JSON 파일 선택
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    importJsonText(await file.text());
                  }}
                />
              </label>
            </div>
          </details>
          {message && (
            <p className="mt-2 rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-900">
              {message}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">필요한 API 키</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>`MOLIT_API_KEY`: 국토부 실거래 바로 조회용</li>
            <li>`NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`: 앱 지도 표시용</li>
            <li>`NAVER_MAP_CLIENT_SECRET`: 주소 좌표 변환용</li>
            <li>`GEMINI_API_KEY`: 시세 해석 코멘트 생성용</li>
          </ul>
        </div>
      </div>

      {!analysis ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          아직 저장된 주변 시세 분석이 없습니다. `주변 시세 조회`를 누르면
          국토부 실거래를 조회해 KPI, 지도, 룸타입별 비교가 표시됩니다.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <MarketMetric label="지역" value={`${analysis.gu} ${analysis.dong}`.trim()} />
            <MarketMetric label="네이버 매물" value={`${analysis.naverCount}건`} />
            <MarketMetric label="국토부 실거래" value={`${analysis.molitCount}건`} />
            <MarketMetric
              label="유사 매매 평균"
              value={formatManwon(analysis.saleAvgMolitManwon)}
            />
            <MarketMetric
              label="네이버 매매 평균"
              value={formatManwon(analysis.saleAvgNaverManwon)}
            />
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
            <p className="font-medium">정렬·평균 기준</p>
            <p className="mt-1">
              {analysis.dong || inferDong(caseData.address) || "해당 동"}을 먼저
              보여주고, 인접 동, 면적 유사도, 준공연도 유사도, 최신 거래순으로
              정렬합니다. 유사 매매 평균은 같은 동/인접 동과 면적·준공이 가까운
              매매 사례의 평균을 우선 사용합니다.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
                  해당 물건 월세 영향 분석
                </p>
                <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                  이 물건의 룸 구성과 맞는 월세 실거래를 우선 보여줍니다. 전체
                  매매·전세·월세 목록은 아래 상세 표에서 확인합니다.
                </p>
              </div>
              <label className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                상태 보정
                <select
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-xs text-neutral-900 dark:border-emerald-800 dark:bg-neutral-950 dark:text-neutral-100"
                  value={rentCondition}
                  onChange={(e) => setRentCondition(e.target.value as RentCondition)}
                >
                  <option value="pre_field">임장 전 보수</option>
                  <option value="poor">노후·옵션 부족</option>
                  <option value="normal">보통</option>
                  <option value="good">상태 좋음·주차 양호</option>
                  <option value="excellent">리모델링·풀옵션</option>
                </select>
              </label>
            </div>
            {recentRentGroups.length > 0 ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {recentRentGroups.map((group) => (
                  <div
                    key={group.roomType}
                    className="rounded-lg bg-white p-3 text-xs dark:bg-neutral-950"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{group.roomType}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                        최근 {group.count}건
                      </span>
                    </div>
                    <dl className="mt-2 space-y-1">
                      <MarketRow label="평균 월세" value={formatManwon(group.avgRent)} />
                      <MarketRow label="중간값 월세" value={formatManwon(group.medianRent)} />
                      <MarketRow
                        label="하한~상한"
                        value={`${formatManwon(group.lowRent)} ~ ${formatManwon(group.highRent)}`}
                      />
                      <MarketRow
                        label="상태 보정 적용"
                        value={formatManwon(group.adjustedRent)}
                      />
                      <MarketRow
                        label="평균 보증금"
                        value={formatManwon(group.avgDeposit)}
                      />
                    </dl>
                    <div className="mt-3 max-h-40 space-y-1 overflow-auto">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-950"
                        >
                          <div className="flex justify-between gap-2">
                            <span>
                              {item.areaSqm != null ? `${item.areaSqm}㎡` : "면적 미상"} ·{" "}
                              {item.dong || item.address || "-"}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatManwon(item.depositManwon)} / {formatManwon(item.monthlyRentManwon)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            {item.dealDate || "일자 미상"} · {item.propertyType || item.tradeType}
                          </p>
                          {item.monthlyRentManwon != null && item.monthlyRentManwon > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => applyRentSetting(item, "sameRoomType")}
                                className="rounded border border-emerald-300 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800 dark:text-emerald-200"
                              >
                                같은 룸 전체
                              </button>
                              <button
                                type="button"
                                onClick={() => applyRentSetting(item, "firstEmpty")}
                                className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                              >
                                첫 빈칸
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-emerald-950 dark:bg-neutral-950 dark:text-emerald-100">
                조회된 실거래 중 이 물건의 룸 구성에 바로 적용할 월세 거래가
                없습니다. 아래 전체 상세에서 전세·매매 거래는 확인할 수 있습니다.
              </div>
            )}
          </div>

          {tenantRentComparisons.length > 0 && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
              <div>
                <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
                  기존 세입자 조건 기반 월세 범위
                </p>
                <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-100/80">
                  세입자 분석의 방크기·룸형식·보증금·월세를 주변 유사 월세와
                  비교합니다.
                </p>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {tenantRentComparisons.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-lg bg-white p-2 text-xs dark:bg-neutral-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {row.unit || "호실 미상"} · {row.roomType || "룸 미상"}
                        {row.areaSqm != null ? ` · ${row.areaSqm}㎡` : ""}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.tone === "low"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                            : row.tone === "high"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        }`}
                      >
                        {row.label}
                      </span>
                    </div>
                    <dl className="mt-2 space-y-1">
                      <MarketRow
                        label="현재 보증금/월세"
                        value={`${formatManwon(wonToManwon(row.depositWon))} / ${formatManwon(wonToManwon(row.monthlyRentWon))}`}
                      />
                      <MarketRow
                        label="주변 월세 범위"
                        value={`${formatManwon(row.lowRent)} ~ ${formatManwon(row.highRent)}`}
                      />
                      <MarketRow
                        label="주변 중간 월세"
                        value={formatManwon(row.medianRent)}
                      />
                      <MarketRow label="유사 표본" value={`${row.sampleCount}건`} />
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedRows.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                건축물대장/룸구성 기준 예상 임대세팅
              </p>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                {suggestedRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded bg-white p-2 text-xs dark:bg-neutral-950"
                  >
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                      {row.unitCount}호 × 보증금 {formatManwon(row.deposit)} / 월세{" "}
                      {formatManwon(row.monthlyRent)}
                    </p>
                    <p className="mt-1 font-semibold">
                      합계 보증금 {formatManwon((row.deposit ?? 0) * row.unitCount)} · 월세{" "}
                      {formatManwon((row.monthlyRent ?? 0) * row.unitCount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            {analysis.roomSummaries.map((summary) => (
              <div
                key={summary.roomType}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <p className="text-sm font-semibold">{summary.roomType}</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <MarketRow
                    label="네이버 월세"
                    value={formatManwon(summary.naverMonthlyRentAvgManwon)}
                  />
                  <MarketRow
                    label="네이버 보증금"
                    value={formatManwon(summary.naverDepositAvgManwon)}
                  />
                  <MarketRow
                    label="실거래 월세"
                    value={formatManwon(summary.molitMonthlyRentAvgManwon)}
                  />
                  <MarketRow
                    label="실거래 보증금"
                    value={formatManwon(summary.molitDepositAvgManwon)}
                  />
                  <MarketRow
                    label="표본"
                    value={`네이버 ${summary.naverCount}건 / 실거래 ${summary.molitCount}건`}
                  />
                </dl>
              </div>
            ))}
          </div>

          {analysis.geminiInsight && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/30">
              <p className="font-medium text-sky-950 dark:text-sky-100">
                Gemini 시세 해석
              </p>
              <p className="mt-1">{analysis.geminiInsight.oneLine}</p>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                <SummaryMiniList title="핵심 포인트" items={analysis.geminiInsight.keyPoints} />
                <SummaryMiniList title="주의사항" items={analysis.geminiInsight.warnings} />
              </div>
            </div>
          )}

          <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium">
              매물·실거래 상세 {sortedListings.length}건
            </summary>
            <div className="mt-3 max-h-[520px] overflow-auto">
              <table className={TABLE_COMPACT}>
                <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-900">
                  <tr>
                    <th className={`${TC_TH} w-14`}>출처</th>
                    <th className={`${TC_TH} w-12`}>거래</th>
                    <th className={`${TC_TH} w-14`}>룸</th>
                    <th className={TC_TH}>동/주소</th>
                    <th className={`${TC_TH} w-14 text-right`}>면적</th>
                    <th className={`${TC_TH} ${TC_MONEY} text-right`}>보증금</th>
                    <th className={`${TC_TH} w-[4.5rem] text-right`}>월세</th>
                    <th className={`${TC_TH} ${TC_MONEY} text-right`}>매매가</th>
                    <th className={`${TC_TH} w-16`}>일자</th>
                    <th className={`${TC_TH} w-20`}>적용</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedListings.slice(0, 120).map((item) => (
                    <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-900">
                      <td className={`${TC_TD} w-14`}>{item.source}</td>
                      <td className={`${TC_TD} w-12`}>{item.tradeType}</td>
                      <td className={`${TC_TD} w-14`}>{item.roomType}</td>
                      <td className={TC_TD}>
                        {item.dong || item.address || item.title || "-"}
                      </td>
                      <td className={`${TC_TD} w-14 text-right`}>
                        {item.areaSqm != null ? `${item.areaSqm}㎡` : "-"}
                      </td>
                      <td className={`${TC_TD} ${TC_MONEY} text-right`}>
                        {formatManwon(item.depositManwon)}
                      </td>
                      <td className={`${TC_TD} w-[4.5rem] text-right`}>
                        {formatManwon(item.monthlyRentManwon)}
                      </td>
                      <td className={`${TC_TD} ${TC_MONEY} text-right`}>
                        {formatManwon(item.dealAmountManwon)}
                      </td>
                      <td className={`${TC_TD} w-16`}>{item.dealDate || "현재"}</td>
                      <td className={`${TC_TD} w-20`}>
                        {item.monthlyRentManwon != null && item.monthlyRentManwon > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => applyRentSetting(item, "sameRoomType")}
                              className="rounded border border-emerald-300 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800 dark:text-emerald-200"
                            >
                              전체
                            </button>
                            <button
                              type="button"
                              onClick={() => applyRentSetting(item, "firstEmpty")}
                              className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
                            >
                              빈칸
                            </button>
                          </div>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <NearbyMarketMap caseData={caseData} analysis={analysis} />
        </>
      )}
    </section>
  );
}

function MarketMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value || "-"}</p>
    </div>
  );
}

function MarketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type RentCondition = "pre_field" | "poor" | "normal" | "good" | "excellent";
type RentSettingApplyMode = "sameRoomType" | "firstEmpty";
type MarketListingItem = NonNullable<AuctionCase["nearbyMarketAnalysis"]>["listings"][number];

const ADJACENT_DONGS_FOR_MARKET: Record<string, string[]> = {
  선화동: ["목동", "은행동", "대흥동", "중촌동", "용두동"],
  대흥동: ["선화동", "은행동", "문창동", "대사동", "부사동"],
  은행동: ["선화동", "대흥동", "중앙로"],
  목동: ["선화동", "중촌동", "용두동"],
  중촌동: ["목동", "선화동", "용두동"],
  용두동: ["목동", "선화동", "오류동"],
};

function rentConditionFactor(condition: RentCondition): number {
  if (condition === "pre_field") return 0.92;
  if (condition === "poor") return 0.85;
  if (condition === "good") return 1.08;
  if (condition === "excellent") return 1.15;
  return 1;
}

function buildRentSettingFromMarketListing(
  current: AuctionCase["rentSetting"],
  listing: MarketListingItem,
  mode: RentSettingApplyMode,
) {
  const base = normalizeRentSetting(current);
  const deposit = manwonToWon(listing.depositManwon);
  const monthlyRent = manwonToWon(listing.monthlyRentManwon);
  if (monthlyRent == null || monthlyRent <= 0) {
    return { rentSetting: base, count: 0 };
  }

  const roomType = rentSettingRoomTypeFromMarket(listing.roomType);
  const areaSqm = listing.areaSqm;
  const areaPyeong =
    areaSqm != null
      ? Math.round((areaSqm / PYEONG_TO_SQM) * 10) / 10
      : null;
  const note = [
    "주변시세 선택",
    listing.dong || listing.address || listing.title,
    listing.dealDate,
  ]
    .filter(Boolean)
    .join(" · ");
  const patch = {
    roomType,
    deposit,
    monthlyRent,
    areaSqm,
    areaPyeong,
    note,
  };

  let count = 0;
  let unitRows = base.unitRows;
  if (mode === "sameRoomType") {
    const targetRoom = normalizeRentRoomType(roomType);
    unitRows = base.unitRows.map((row) => {
      if (normalizeRentRoomType(row.roomType) !== targetRoom) return row;
      count += 1;
      return { ...row, ...patch };
    });
    if (count === 0) {
      const index = unitRows.findIndex((row) => !row.roomType.trim());
      if (index >= 0) {
        unitRows = unitRows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row,
        );
      } else {
        unitRows = [...unitRows, { ...newRentUnitRow(), ...patch }];
      }
      count = 1;
    }
  } else {
    const targetRoom = normalizeRentRoomType(roomType);
    const index = unitRows.findIndex(
      (row) =>
        row.deposit == null &&
        row.monthlyRent == null &&
        (!row.roomType.trim() || normalizeRentRoomType(row.roomType) === targetRoom),
    );
    if (index >= 0) {
      unitRows = unitRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      );
    } else {
      unitRows = [...unitRows, { ...newRentUnitRow(), ...patch }];
    }
    count = 1;
  }

  const rentSetting = normalizeRentSetting({ ...base, unitRows });
  const derived = computeRentSettingDerived(rentSetting);
  return {
    rentSetting: {
      ...rentSetting,
      investmentYield: {
        ...rentSetting.investmentYield,
        totalDeposit: derived.totalDeposit,
        totalMonthlyRent: derived.totalMonthlyRent,
      },
    },
    count,
  };
}

function manwonToWon(value: number | null): number | null {
  return value != null && value > 0 ? Math.round(value * 10000) : null;
}

function rentSettingRoomTypeFromMarket(roomType: string): string {
  const normalized = normalizeRentRoomType(roomType);
  if (normalized === "1") return "1룸";
  if (normalized === "1.5") return "1.5룸";
  if (normalized === "2") return "2룸";
  if (normalized === "3") return "3룸";
  return roomType || "월세";
}

function normalizeRentRoomType(roomType: string): string {
  const text = roomType.replace(/\s/g, "");
  if (/1\.5|1.5|원\.5|일점오|1\.5룸/.test(text)) return "1.5";
  if (/원룸|1룸|1Room|ONE/i.test(text)) return "1";
  if (/투룸|2룸|2Room|TWO/i.test(text)) return "2";
  if (/쓰리룸|3룸|3Room|THREE|3룸이상/i.test(text)) return "3";
  return text;
}

function marketDateSortValue(item: MarketListingItem): number {
  const digits = item.dealDate.replace(/[^\d]/g, "");
  if (digits.length >= 6) return Number(digits.slice(0, 8).padEnd(8, "0"));
  return 0;
}

function builtYearFromCase(caseData: AuctionCase): number | null {
  const match = caseData.builtYear.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function marketDongRank(item: MarketListingItem, targetDong: string): number {
  if (!targetDong || !item.dong) return 2;
  if (item.dong.includes(targetDong) || targetDong.includes(item.dong)) return 0;
  const adjacent = ADJACENT_DONGS_FOR_MARKET[targetDong] ?? [];
  return adjacent.some((dong) => item.dong.includes(dong) || dong.includes(item.dong))
    ? 1
    : 2;
}

function marketAreaDiffRatio(item: MarketListingItem, targetAreaSqm: number | null): number {
  if (targetAreaSqm == null || targetAreaSqm <= 0 || item.areaSqm == null) return 9;
  return Math.abs(item.areaSqm - targetAreaSqm) / targetAreaSqm;
}

function marketBuiltYearDiff(item: MarketListingItem, targetBuiltYear: number | null): number {
  if (targetBuiltYear == null || item.buildYear == null) return 99;
  return Math.abs(item.buildYear - targetBuiltYear);
}

function sortMarketListingsForCase(
  listings: MarketListingItem[],
  caseData: AuctionCase,
): MarketListingItem[] {
  const targetDong = inferDong(caseData.address);
  const targetAreaSqm = caseData.buildingAreaSqm;
  const targetBuiltYear = builtYearFromCase(caseData);
  return [...listings].sort((a, b) => {
    const dongDelta = marketDongRank(a, targetDong) - marketDongRank(b, targetDong);
    if (dongDelta !== 0) return dongDelta;

    const areaDelta =
      marketAreaDiffRatio(a, targetAreaSqm) - marketAreaDiffRatio(b, targetAreaSqm);
    if (Math.abs(areaDelta) > 0.01) return areaDelta;

    const yearDelta =
      marketBuiltYearDiff(a, targetBuiltYear) - marketBuiltYearDiff(b, targetBuiltYear);
    if (yearDelta !== 0) return yearDelta;

    return marketDateSortValue(b) - marketDateSortValue(a);
  });
}

function wonToManwon(value: number | null): number | null {
  return value != null && value > 0 ? Math.round(value / 10000) : null;
}

function caseGu(address: string): string {
  return ["동구", "중구", "서구", "유성구", "대덕구"].find((gu) => address.includes(gu)) ?? "";
}

/** 이 물건에 국토부 주변 시세가 이미 붙어 있으면 API 재조회 불필요 */
function marketMolitDataAppliesToCase(caseData: AuctionCase): boolean {
  const analysis = caseData.nearbyMarketAnalysis;
  if (!analysis?.listings?.length) return false;
  const hasMolit = analysis.listings.some((item) => item.source === "molit");
  if (!hasMolit) return false;
  const gu = caseGu(caseData.address);
  if (gu && analysis.gu && analysis.gu !== gu) return false;
  return true;
}

function findReusableMarketCases(allCases: AuctionCase[], targetCase: AuctionCase): AuctionCase[] {
  const gu = caseGu(targetCase.address);
  if (!gu) return [];
  return allCases
    .filter(
      (item) =>
        item.id !== targetCase.id &&
        item.nearbyMarketAnalysis != null &&
        (item.nearbyMarketAnalysis.molitCount ?? 0) > 0 &&
        (item.address.includes(gu) || item.nearbyMarketAnalysis.gu === gu),
    )
    .sort((a, b) => {
      const aTime = Date.parse(a.nearbyMarketAnalysis?.importedAt ?? a.updatedAt);
      const bTime = Date.parse(b.nearbyMarketAnalysis?.importedAt ?? b.updatedAt);
      return bTime - aTime;
    });
}

function buildRoomSummariesFromListings(listings: MarketListingItem[]) {
  return ["원룸", "1.5룸", "2룸", "3룸 이상"].map((roomType) => {
    const molit = listings.filter((item) => item.source === "molit" && item.roomType === roomType);
    return {
      roomType,
      naverCount: 0,
      molitCount: molit.length,
      naverDepositAvgManwon: null,
      naverMonthlyRentAvgManwon: null,
      molitDepositAvgManwon: averageManwon(molit.map((item) => item.depositManwon)),
      molitMonthlyRentAvgManwon: averageManwon(molit.map((item) => item.monthlyRentManwon)),
    };
  });
}

function similarSaleAverageForCase(listings: MarketListingItem[], caseData: AuctionCase) {
  const targetDong = inferDong(caseData.address);
  const sorted = sortMarketListingsForCase(
    listings.filter((item) => item.tradeType === "매매" && item.dealAmountManwon != null),
    caseData,
  );
  const sameOrNear = sorted.filter((item) => marketDongRank(item, targetDong) <= 1);
  const base = sameOrNear.length >= 3 ? sameOrNear : sorted;
  return averageManwon(base.slice(0, 15).map((item) => item.dealAmountManwon));
}

function buildNearbyMarketAnalysisFromListings(
  listings: MarketListingItem[],
  meta: {
    city: string;
    gu: string;
    saleMonths?: number | null;
    rentMonths?: number | null;
    months?: number | null;
  },
  targetCase: AuctionCase,
): NonNullable<AuctionCase["nearbyMarketAnalysis"]> {
  const sorted = sortMarketListingsForCase(listings, targetCase);
  return {
    importedAt: new Date().toISOString(),
    city: meta.city,
    gu: caseGu(targetCase.address) || meta.gu,
    dong: inferDong(targetCase.address) || "",
    lat: null,
    lng: null,
    months: meta.months ?? MOLIT_RENT_MONTHS,
    saleMonths: meta.saleMonths ?? MOLIT_SALE_MONTHS,
    rentMonths: meta.rentMonths ?? MOLIT_RENT_MONTHS,
    molitCount: sorted.filter((item) => item.source === "molit").length,
    naverCount: sorted.filter((item) => item.source === "naver").length,
    saleAvgMolitManwon: similarSaleAverageForCase(sorted, targetCase),
    saleAvgNaverManwon: null,
    roomSummaries: buildRoomSummariesFromListings(sorted),
    listings: sorted,
    geminiInsight: null,
  };
}

function buildReusedNearbyMarketAnalysis(
  sourceCase: AuctionCase,
  targetCase: AuctionCase,
): NonNullable<AuctionCase["nearbyMarketAnalysis"]> | null {
  const source = sourceCase.nearbyMarketAnalysis;
  if (!source) return null;
  return buildNearbyMarketAnalysisFromListings(
    source.listings,
    {
      city: source.city,
      gu: source.gu,
      saleMonths: source.saleMonths,
      rentMonths: source.rentMonths,
      months: source.months,
    },
    targetCase,
  );
}

function averageManwon(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && value > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function medianManwon(values: Array<number | null>): number | null {
  const valid = values
    .filter((value): value is number => value != null && value > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[mid]!;
  return Math.round((valid[mid - 1]! + valid[mid]!) / 2);
}

function percentileManwon(values: Array<number | null>, pct: number): number | null {
  const valid = values
    .filter((value): value is number => value != null && value > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const index = Math.min(
    valid.length - 1,
    Math.max(0, Math.round((valid.length - 1) * pct)),
  );
  return valid[index]!;
}

function tenantRowsFromCase(caseData: AuctionCase): Record<string, unknown>[] {
  const payload = caseData.sourceDocuments
    .map((doc) => getDocumentAnalysisPayload(doc))
    .find((item) => item.tenants);
  return arrayRecords(asRecord(payload?.tenants)?.list);
}

function buildTenantRentComparisons(
  caseData: AuctionCase,
  analysis: NonNullable<AuctionCase["nearbyMarketAnalysis"]>,
) {
  return tenantRowsFromCase(caseData).flatMap((tenant, index) => {
    const roomTypeRaw = textValue(tenant.room_type);
    const roomType = roomTypeRaw === "3룸" ? "3룸 이상" : roomTypeRaw;
    const areaSqm = numberValue(tenant.area_sqm);
    const depositWon = numberValue(tenant.deposit);
    const monthlyRentWon = numberValue(tenant.monthly_rent);
    if (!roomType || monthlyRentWon == null) return [];
    const similar = sortMarketListingsForCase(analysis.listings, caseData)
      .filter(
        (item) =>
          item.tradeType === "월세" &&
          item.monthlyRentManwon != null &&
          item.roomType === roomType &&
          (areaSqm == null ||
            item.areaSqm == null ||
            Math.abs(item.areaSqm - areaSqm) / areaSqm <= 0.35),
      )
      .slice(0, 20);
    if (similar.length === 0) return [];
    const rents = similar.map((item) => item.monthlyRentManwon);
    const medianRent = medianManwon(rents);
    const currentRent = wonToManwon(monthlyRentWon);
    const tone =
      currentRent != null && medianRent != null && currentRent < medianRent * 0.9
        ? "low"
        : currentRent != null && medianRent != null && currentRent > medianRent * 1.1
          ? "high"
          : "normal";
    return [
      {
        key: `${textValue(tenant.unit) || "tenant"}-${index}`,
        unit: textValue(tenant.unit),
        roomType,
        areaSqm,
        depositWon,
        monthlyRentWon,
        lowRent: percentileManwon(rents, 0.25),
        highRent: percentileManwon(rents, 0.75),
        medianRent,
        sampleCount: similar.length,
        tone,
        label: tone === "low" ? "상향 여지" : tone === "high" ? "높은 편" : "적정권",
      },
    ];
  });
}

function buildRecentRentGroups(
  analysis: NonNullable<AuctionCase["nearbyMarketAnalysis"]>,
  condition: RentCondition,
  caseData: AuctionCase,
) {
  const configuredRoomTypes = ROOM_SHAPE_OPTIONS.filter(
    (roomType) => (caseData.roomShapeMix[roomType] ?? 0) > 0,
  );
  const roomTypes = configuredRoomTypes.length > 0
    ? configuredRoomTypes
    : (["원룸", "1.5룸", "2룸", "3룸"] as const);
  const factor = rentConditionFactor(condition);
  return roomTypes.flatMap((roomType) => {
    const normalizedRoomType = roomType === "3룸" ? "3룸 이상" : roomType;
    const items = sortMarketListingsForCase(analysis.listings, caseData)
      .filter(
        (item) =>
          item.source === "molit" &&
          item.roomType === normalizedRoomType &&
          (item.tradeType === "월세" || item.tradeType === "전월세") &&
          item.monthlyRentManwon != null &&
          item.monthlyRentManwon > 0,
      )
      .sort((a, b) => marketDateSortValue(b) - marketDateSortValue(a))
      .slice(0, 15);
    if (items.length === 0) return [];
    const rents = items.map((item) => item.monthlyRentManwon);
    const deposits = items.map((item) => item.depositManwon);
    const medianRent = medianManwon(rents);
    return [
      {
        roomType: normalizedRoomType,
        count: items.length,
        items,
        avgRent: averageManwon(rents),
        medianRent,
        lowRent: percentileManwon(rents, 0.25),
        highRent: percentileManwon(rents, 0.75),
        adjustedRent:
          medianRent != null ? Math.max(1, Math.round(medianRent * factor)) : null,
        avgDeposit: averageManwon(deposits),
      },
    ];
  });
}

function SummaryMiniList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function NearbyMarketMap({
  caseData,
  analysis,
}: {
  caseData: AuctionCase;
  analysis: NonNullable<AuctionCase["nearbyMarketAnalysis"]>;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapState, setMapState] = useState<"ready" | "missing-key" | "failed">("ready");
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const centerLat = analysis.lat ?? analysis.listings.find((x) => x.lat != null)?.lat ?? null;
  const centerLng = analysis.lng ?? analysis.listings.find((x) => x.lng != null)?.lng ?? null;
  const dong = analysis.dong || inferDong(caseData.address);
  const hasCenter = centerLat != null && centerLng != null;

  useEffect(() => {
    if (!clientId || centerLat == null || centerLng == null || !mapRef.current) {
      setMapState(clientId ? "ready" : "missing-key");
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-naver-map='true']",
    );
    const render = () => {
      type NaverMapsRuntime = {
        maps: {
          LatLng: new (lat: number, lng: number) => unknown;
          Map: new (
            element: HTMLElement,
            options: Record<string, unknown>,
          ) => unknown;
          Marker: new (options: Record<string, unknown>) => unknown;
        };
      };
      const naver = (window as unknown as { naver?: NaverMapsRuntime }).naver;
      if (!naver?.maps || !mapRef.current) {
        setMapState("failed");
        return;
      }
      const center = new naver.maps.LatLng(centerLat, centerLng);
      const map = new naver.maps.Map(mapRef.current, {
        center,
        zoom: 15,
      });
      new naver.maps.Marker({
        position: center,
        map,
        title: caseData.address || "현재 물건",
      });
      analysis.listings
        .flatMap((item) =>
          item.lat != null && item.lng != null
            ? [{ ...item, lat: item.lat, lng: item.lng }]
            : [],
        )
        .slice(0, 80)
        .forEach((item) => {
          new naver.maps.Marker({
            position: new naver.maps.LatLng(item.lat, item.lng),
            map,
            title: `${item.tradeType} ${item.roomType}`,
          });
        });
    };
    if (existing) {
      if ((window as unknown as { naver?: unknown }).naver) render();
      else existing.addEventListener("load", render, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.naverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = render;
    script.onerror = () => setMapState("failed");
    document.head.appendChild(script);
  }, [analysis.listings, caseData.address, centerLat, centerLng, clientId]);

  if (!hasCenter) {
    return (
      <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">지도 연동</p>
            <p className="mt-1 text-xs text-neutral-500">
              내부 지도 좌표는 아직 없지만, 주소 검색으로 외부 지도는 바로 열 수
              있습니다.
            </p>
          </div>
          <a
            href={naverMapSearchUrl(caseData.address || dong)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700"
          >
            네이버 지도에서 열기
          </a>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          내부 지도를 보려면 `NAVER_MAP_CLIENT_SECRET`, Geocoding 권한, 주소 값을
          확인한 뒤 주변 시세를 다시 조회하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">지도 연동</p>
        <a
          href={naverMapSearchUrl(
            caseData.address || dong,
            centerLat,
            centerLng,
          )}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-sky-700 underline dark:text-sky-300"
        >
          네이버 지도에서 열기
        </a>
      </div>
      <div
        ref={mapRef}
        className="mt-3 h-72 rounded-lg bg-neutral-100 dark:bg-neutral-900"
      >
        {mapState === "missing-key" && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">
            NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 없어서 앱 내부 지도는 비활성화되어 있습니다.
          </div>
        )}
        {mapState === "failed" && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-600">
            네이버 지도 스크립트를 불러오지 못했습니다. API 키와 도메인 설정을 확인하세요.
          </div>
        )}
      </div>
    </div>
  );
}

function SourceDocumentsPanel({
  caseId,
  caseNumber,
  documents,
  listThumbnail,
  onAddDocument,
  onListThumbnailChange,
}: {
  caseId: string;
  caseNumber: string;
  documents: CaseSourceDocument[];
  listThumbnail: AuctionCase["listThumbnail"];
  onAddDocument: (document: CaseSourceDocument) => void;
  onListThumbnailChange: (next: AuctionCase["listThumbnail"]) => void;
}) {
  const [kind, setKind] = useState<CaseSourceDocumentKind>("daejangauction-pdf");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadingRef = useRef(false);
  const selectedKind = SOURCE_DOCUMENT_KIND_OPTIONS.find((x) => x.value === kind);

  const uploadSelectedFile = useCallback(async (selectedFile: File) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("kind", kind);
      const res = await fetch("/api/pdf-to-json", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as PdfToJsonOk | PdfToJsonError;
      if (!res.ok || !data.ok) {
        throw new Error(data.ok ? "PDF 파싱에 실패했습니다." : data.error);
      }
      const extractedCaseNumber =
        data.extracted?.caseNumber != null
          ? String(data.extracted.caseNumber)
          : null;
      const document = await registerSourcePdfUpload({
        caseId,
        caseNumber,
        extractedCaseNumber,
        kind,
        file: selectedFile,
        meta: data.meta,
        rawText: data.rawText,
        structuredJson: data.structuredJson,
      });
      onAddDocument(document);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(
        `문서를 추가했습니다. 원본 PDF는 ${document.pdfBlobRef ?? "저장 경로 미상"} 에 보관됩니다.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "문서 등록에 실패했습니다.");
    } finally {
      uploadingRef.current = false;
      setBusy(false);
    }
  }, [caseId, caseNumber, kind, onAddDocument]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (autoUploadTimerRef.current) {
      clearTimeout(autoUploadTimerRef.current);
      autoUploadTimerRef.current = null;
    }
    if (!file) {
      setMessage("등록할 PDF 파일을 선택해 주세요.");
      return;
    }
    await uploadSelectedFile(file);
  };

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h3 className="font-medium">등록 원문 자료</h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          PDF 등록 시 추출한 원문 텍스트 전체와 구조화 JSON을 보존합니다.
          파서가 개선되면 이 원문으로 다시 분석할 수 있습니다.
        </p>
      </div>

      <CaseListThumbnailEditor
        caseId={caseId}
        thumbnail={listThumbnail}
        onChange={onListThumbnailChange}
      />

      <form
        onSubmit={handleUpload}
        className="space-y-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/40"
      >
        <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto] lg:items-end">
          <label className="text-sm">
            문서 종류
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CaseSourceDocumentKind)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {SOURCE_DOCUMENT_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            PDF 파일
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] ?? null;
                setFile(selectedFile);
                if (autoUploadTimerRef.current) {
                  clearTimeout(autoUploadTimerRef.current);
                  autoUploadTimerRef.current = null;
                }
                setMessage(
                  selectedFile
                    ? "PDF 선택됨: 1초 후 자동으로 등록합니다."
                    : null,
                );
                if (selectedFile) {
                  autoUploadTimerRef.current = setTimeout(() => {
                    autoUploadTimerRef.current = null;
                    void uploadSelectedFile(selectedFile);
                  }, 1000);
                }
              }}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {busy ? "추출 중..." : "문서 추가"}
          </button>
        </div>
        {selectedKind && (
          <p className="text-xs text-neutral-500">{selectedKind.help}</p>
        )}
        {message && (
          <p className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
            {message}
          </p>
        )}
        <p className="text-xs text-neutral-500">
          원본 PDF는 브라우저 IndexedDB에{" "}
          <span className="font-mono">{`{사건번호}/{사건번호}_{문서종류}.pdf`}</span>{" "}
          형식으로 저장됩니다. 추출 텍스트·구조화 JSON과 함께 보관되어 파서
          개선 후 재분석할 수 있습니다.
        </p>
      </form>

      {documents.length === 0 ? (
        <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500 dark:bg-neutral-900">
          저장된 PDF 원문이 없습니다. 새 PDF 등록부터 원본 파일이 함께 저장됩니다.
        </p>
      ) : (
        <SourceDocumentFolderList caseId={caseId} documents={documents} />
      )}
    </section>
  );
}

function SourceDocumentFolderList({
  caseId,
  documents,
}: {
  caseId: string;
  documents: CaseSourceDocument[];
}) {
  const folders = useMemo(() => {
    const map = new Map<string, CaseSourceDocument[]>();
    for (const doc of documents) {
      const folder =
        doc.pdfBlobRef?.includes("/")
          ? doc.pdfBlobRef.split("/")[0]!
          : normalizeCaseNumber(
              (doc.structuredJson as { auction_case?: { case_info?: { case_number?: string } } })
                ?.auction_case?.case_info?.case_number ?? "",
            ) || "원문";
      const list = map.get(folder) ?? [];
      list.push(doc);
      map.set(folder, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [documents]);

  return (
    <div className="space-y-4">
      {folders.map(([folder, docs]) => (
        <div
          key={folder}
          className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <p className="font-mono text-sm font-medium">{folder}/</p>
          <div className="mt-2 space-y-3">
            {docs.map((doc, index) => (
              <SourceDocumentCard
                key={doc.id}
                caseId={caseId}
                doc={doc}
                index={index}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceDocumentCard({
  caseId,
  doc,
  index,
}: {
  caseId: string;
  doc: CaseSourceDocument;
  index: number;
}) {
  const storedName =
    doc.storedFileName ??
    doc.pdfBlobRef?.split("/").pop() ??
    doc.fileName;
  const originalName = doc.originalFileName ?? doc.fileName;

  return (
    <article className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {index + 1}. {storedName || "(파일명 없음)"}
          </p>
          {originalName !== storedName && (
            <p className="mt-0.5 text-xs text-neutral-500">
              업로드: {originalName}
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {sourceDocumentKindLabel(doc.kind)} · 페이지 {doc.pageCount ?? "?"} ·{" "}
            {doc.fileSize != null
              ? `${(doc.fileSize / 1024 / 1024).toFixed(2)}MB`
              : "크기 미상"}{" "}
            · {doc.parserVersion}
          </p>
          {doc.pdfBlobRef && (
            <p className="mt-0.5 font-mono text-xs text-neutral-500">
              {doc.pdfBlobRef}
            </p>
          )}
          <p className="mt-0.5 text-xs text-neutral-500">
            등록: {doc.importedAt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.pdfBlobRef && (
            <>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                onClick={() => {
                  void openSourcePdfInNewTab(caseId, doc.pdfBlobRef!);
                }}
              >
                PDF 보기
              </button>
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                onClick={async () => {
                  const blob = await getSourcePdfBlob(caseId, doc.pdfBlobRef!);
                  if (blob) downloadBlobAsFile(blob, storedName || "document.pdf");
                }}
              >
                다운로드
              </button>
            </>
          )}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            원문 {doc.extractedText.length.toLocaleString("ko-KR")}자
          </span>
        </div>
      </div>

      <StructuredBasicInfoSummary document={doc} />

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">
          원문 텍스트 보기
        </summary>
        <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
          {doc.extractedText.trim() || "(텍스트가 비어있습니다)"}
        </pre>
      </details>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">
          구조화 JSON 보기
        </summary>
        <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
          {doc.structuredJson
            ? JSON.stringify(doc.structuredJson, null, 2)
            : "(구조화 JSON이 없습니다)"}
        </pre>
      </details>
    </article>
  );
}

function TenantAnalysisPanel({
  caseId,
  caseNumber,
  compact = false,
  documents,
  onDocumentsChange,
  noDividendRequestGuide,
  onNoDividendRequestGuideChange,
  fallbackAddress,
  fallbackMinimumPrice,
  fallbackExpectedBidPrice,
  fallbackAppraisalPrice,
  tenantRecords,
  onExpectedBidPriceChange,
  onTenantRecordsChange,
  onTenantSpecApplied,
}: {
  caseId: string;
  caseNumber: string;
  compact?: boolean;
  documents: CaseSourceDocument[];
  onDocumentsChange: (documents: CaseSourceDocument[]) => void;
  noDividendRequestGuide: string;
  onNoDividendRequestGuideChange: (text: string) => void;
  fallbackAddress: string;
  fallbackMinimumPrice: number | null;
  fallbackExpectedBidPrice: number | null;
  fallbackAppraisalPrice: number | null;
  tenantRecords: AuctionCase["tenantRecords"];
  onExpectedBidPriceChange: (price: number | null) => void;
  onTenantRecordsChange: (records: AuctionCase["tenantRecords"]) => void;
  onTenantSpecApplied?: () => void;
}) {
  const [expandedTenantKey, setExpandedTenantKey] = useState<string | null>(null);
  const [guideEditing, setGuideEditing] = useState(false);
  const [guideDraft, setGuideDraft] = useState(noDividendRequestGuide);
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [specBusy, setSpecBusy] = useState(false);
  const [specMessage, setSpecMessage] = useState<string | null>(null);
  const [dividendFile, setDividendFile] = useState<File | null>(null);
  const [dividendBusy, setDividendBusy] = useState(false);
  const [dividendMessage, setDividendMessage] = useState<string | null>(null);
  const specFileInputRef = useRef<HTMLInputElement | null>(null);
  const dividendFileInputRef = useRef<HTMLInputElement | null>(null);
  const specAutoUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dividendAutoUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const specUploadingRef = useRef(false);
  const dividendUploadingRef = useRef(false);
  const tenantDocIndex = documents.findIndex((doc) => getDocumentAnalysisPayload(doc).tenants);
  const tenantPayload =
    tenantDocIndex >= 0 ? getDocumentAnalysisPayload(documents[tenantDocIndex]!) : undefined;
  const buildingRegistryPayload = documents
    .map((doc) => getDocumentAnalysisPayload(doc))
    .find((p) => p.buildingRegistry);
  const landRegistryPayload = documents
    .map((doc) => getDocumentAnalysisPayload(doc))
    .find((p) => p.landRegistry);

  const tenants = tenantPayload?.tenants ?? null;
  const tenantRows = arrayRecords(tenants?.list);
  const buildingRegistry = buildingRegistryPayload?.buildingRegistry ?? null;
  const landRegistry = landRegistryPayload?.landRegistry ?? null;
  const buildingRights = arrayRecords(buildingRegistry?.rights);
  const landRights = arrayRecords(landRegistry?.rights);
  const statusSummary = asRecord(tenants?.status_summary);
  const appraisalPrice = documents
    .map((doc) => getAuctionCasePayload(doc.structuredJson))
    .map((payload) => asRecord(payload?.appraisal))
    .map((appraisal) => numberValue(appraisal?.total_appraisal_value))
    .find((value): value is number => value != null) ?? fallbackAppraisalPrice;
  const totalDeposit = numberValue(tenants?.total_deposit) ?? tenantRows.reduce(
    (sum, tenant) => sum + (numberValue(tenant.deposit) ?? 0),
    0,
  );
  const mortgageAmount = [...buildingRights, ...landRights].reduce((sum, right) => {
    const type = textValue(right.type);
    if (!/근저당|저당/.test(type)) return sum;
    return sum + (numberValue(right.amount) ?? 0);
  }, 0);
  const depositMortgageComment =
    appraisalPrice != null && totalDeposit + mortgageAmount > appraisalPrice
      ? "총 보증금과 근저당 합계가 감정가를 초과합니다. 기존 임대수요와 금융 평가가 강하게 형성된 후보일 수 있으나, 선순위·배당부족·인수 가능성은 별도 확인하세요."
      : appraisalPrice != null
        ? "총 보증금과 근저당 합계가 감정가보다 낮습니다. 전세 수요와 금융 평가가 충분한지 추가 확인하세요."
        : "";
  const saleSchedule = documents
    .map((doc) => getAuctionCasePayload(doc.structuredJson))
    .map((payload) => asRecord(payload?.sale_schedule))
    .find((schedule) => schedule != null);
  const currentSchedule = arrayRecords(saleSchedule?.schedules)
    .find((schedule) => schedule.is_current === true) ?? arrayRecords(saleSchedule?.schedules)[0];
  const expectedDividend = getExpectedDividendFromDocuments(documents);
  const distributionBasePrice =
    expectedDividend?.bid_price ??
    fallbackExpectedBidPrice ??
    (fallbackAppraisalPrice != null ? Math.round(fallbackAppraisalPrice * 0.7) : null) ??
    numberValue(currentSchedule?.minimum_price) ??
    fallbackMinimumPrice;
  const distributionRows = estimateTenantDistributions({
    tenants: tenantRows,
    buildingRights,
    landRights,
    minimumPrice: distributionBasePrice,
    address:
      textValue(
        asRecord(asRecord(tenantPayload?.sourcePayload?.property)?.address)?.full,
      ) || fallbackAddress,
    keyDateBase: textValue(tenants?.key_date_base),
  });
  const tenantDisplayRows = buildTenantDisplayRows(tenantRows, distributionRows).map(
    (row) => {
      const computed: TenantDistributionView = {
        ...row.distribution,
        source: "computed",
      };
      return {
        ...row,
        distribution: resolveTenantDistributionView({
          tenant: row.tenant,
          computed,
          pdfRows: expectedDividend?.rows ?? [],
          bidPrice: expectedDividend?.bid_price ?? distributionBasePrice,
        }),
      };
    },
  );
  const uploadSaleSpecificationFile = useCallback(async (selectedFile: File) => {
    if (specUploadingRef.current) return;
    specUploadingRef.current = true;
    setSpecBusy(true);
    setSpecMessage(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("kind", "tenant-report");
      const res = await fetch("/api/pdf-to-json", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as PdfToJsonOk | PdfToJsonError;
      if (!res.ok || !data.ok) {
        throw new Error(data.ok ? "PDF 파싱에 실패했습니다." : data.error);
      }
      const document = await registerSourcePdfUpload({
        caseId,
        caseNumber,
        extractedCaseNumber: null,
        kind: "tenant-report",
        file: selectedFile,
        meta: data.meta,
        rawText: data.rawText,
        structuredJson: data.structuredJson,
      });
      normalizeTenantDocumentRows(document);
      const nextDocuments = mergeTenantReportDocument(documents, document);
      onDocumentsChange(nextDocuments);
      onTenantSpecApplied?.();
      setSpecFile(null);
      if (specFileInputRef.current) specFileInputRef.current.value = "";
      setSpecMessage(
        "매각물건명세서 기준으로 호실별 임차인 현황을 갱신했습니다. 잘못된 경우 명세서를 다시 등록하면 리셋됩니다.",
      );
    } catch (err) {
      setSpecMessage(
        err instanceof Error ? err.message : "매각물건명세서 추가에 실패했습니다.",
      );
    } finally {
      specUploadingRef.current = false;
      setSpecBusy(false);
    }
  }, [caseId, caseNumber, documents, onDocumentsChange, onTenantSpecApplied]);
  const uploadExpectedDividendFile = useCallback(
    async (selectedFile: File) => {
      if (dividendUploadingRef.current) return;
      dividendUploadingRef.current = true;
      setDividendBusy(true);
      setDividendMessage(null);
      try {
        const form = new FormData();
        form.append("file", selectedFile);
        form.append("kind", "expected-dividend");
        const res = await fetch("/api/pdf-to-json", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as PdfToJsonOk | PdfToJsonError;
        if (!res.ok || !data.ok) {
          throw new Error(data.ok ? "PDF 파싱에 실패했습니다." : data.error);
        }
        const baseDocument = await registerSourcePdfUpload({
          caseId,
          caseNumber,
          extractedCaseNumber: null,
          kind: "expected-dividend",
          file: selectedFile,
          meta: data.meta,
          rawText: data.rawText,
          structuredJson: data.structuredJson,
        });
        const document: CaseSourceDocument = {
          ...baseDocument,
          parserVersion: EXPECTED_DIVIDEND_PARSER_VERSION,
        };
        const parsed = getExpectedDividendFromDocuments([document]);
        if (!parsed?.rows.length) {
          throw new Error("예상배당표에서 임차인 배당 내역을 찾지 못했습니다.");
        }
        const nextDocuments = [
          document,
          ...documents.filter((doc) => doc.kind !== "expected-dividend"),
        ];
        onDocumentsChange(nextDocuments);
        if (parsed.bid_price != null) {
          onExpectedBidPriceChange(parsed.bid_price);
        }
        onTenantRecordsChange(
          syncTenantRecordsFromExpectedDividend(
            tenantRecords,
            parsed,
            tenantRows,
          ),
        );
        setDividendFile(null);
        if (dividendFileInputRef.current) dividendFileInputRef.current.value = "";
        setDividendMessage(
          `예상배당표를 반영했습니다. 임차인 ${parsed.rows.length}명 · 입찰가 ${parsed.bid_price != null ? formatWonWithUnit(parsed.bid_price) : "미확인"}`,
        );
      } catch (err) {
        setDividendMessage(
          err instanceof Error ? err.message : "예상배당표 반영에 실패했습니다.",
        );
      } finally {
        dividendUploadingRef.current = false;
        setDividendBusy(false);
      }
    },
    [
      caseId,
      caseNumber,
      documents,
      onDocumentsChange,
      onExpectedBidPriceChange,
      onTenantRecordsChange,
      tenantRecords,
      tenantRows,
    ],
  );
  const uploadExpectedDividend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dividendAutoUploadTimerRef.current) {
      clearTimeout(dividendAutoUploadTimerRef.current);
      dividendAutoUploadTimerRef.current = null;
    }
    if (!dividendFile) {
      setDividendMessage("예상배당표 PDF를 선택해 주세요.");
      return;
    }
    await uploadExpectedDividendFile(dividendFile);
  };
  const uploadSaleSpecification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (specAutoUploadTimerRef.current) {
      clearTimeout(specAutoUploadTimerRef.current);
      specAutoUploadTimerRef.current = null;
    }
    if (!specFile) {
      setSpecMessage("매각물건명세서 PDF를 선택해 주세요.");
      return;
    }
    await uploadSaleSpecificationFile(specFile);
  };
  const updateTenantField = (
    rowIndex: number,
    field: string,
    value: unknown,
  ) => {
    updateTenantList((list, tenantRoot) => {
      const row = asRecord(list[rowIndex]);
      if (!row) return;
      row[field] = value;
      refreshTenantTotals(tenantRoot);
    });
  };
  const addTenantRow = () => {
    updateTenantList((list, tenantRoot) => {
      list.push(createEmptyTenantRow(list.length + 1));
      refreshTenantTotals(tenantRoot);
    });
  };
  const deleteTenantRow = (rowIndex: number) => {
    if (!confirm("이 임차인 항목을 삭제할까요?")) return;
    updateTenantList((list, tenantRoot) => {
      list.splice(rowIndex, 1);
      refreshTenantTotals(tenantRoot);
    });
  };
  const updateTenantList = (
    mutator: (list: unknown[], tenantRoot: Record<string, unknown>) => void,
  ) => {
    const nextDocs = structuredClone(documents);
    let doc =
      tenantDocIndex >= 0 ? nextDocs[tenantDocIndex] : undefined;
    if (!doc) {
      doc = createManualTenantDocument();
      nextDocs.unshift(doc);
    }
    const tenantRoot = ensureTenantRoot(doc);
    const list = Array.isArray(tenantRoot.list) ? tenantRoot.list : [];
    tenantRoot.list = list;
    mutator(list, tenantRoot);
    const sortedRows = sortTenantRowsByUnit(arrayRecords(list));
    tenantRoot.list = sortedRows;
    normalizeTenantRentRows(sortedRows);
    refreshTenantTotals(tenantRoot);
    onDocumentsChange(nextDocs);
  };
  const hasData =
    tenantRows.length > 0 ||
    buildingRights.length > 0 ||
    landRights.length > 0 ||
    tenants != null;

  if (!hasData) {
    return (
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{compact ? "세입자" : "세입자 분석"}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <form
                onSubmit={uploadExpectedDividend}
                className="flex flex-wrap items-center gap-2"
              >
                <label className="cursor-pointer rounded-lg border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/30">
                  예상배당표 선택
                  <input
                    ref={dividendFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0] ?? null;
                      setDividendFile(selectedFile);
                      if (dividendAutoUploadTimerRef.current) {
                        clearTimeout(dividendAutoUploadTimerRef.current);
                        dividendAutoUploadTimerRef.current = null;
                      }
                      setDividendMessage(
                        selectedFile
                          ? "예상배당표 선택됨: 1초 후 자동으로 반영합니다."
                          : null,
                      );
                      if (selectedFile) {
                        dividendAutoUploadTimerRef.current = setTimeout(() => {
                          dividendAutoUploadTimerRef.current = null;
                          void uploadExpectedDividendFile(selectedFile);
                        }, 1000);
                      }
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={dividendBusy}
                  className="rounded-lg bg-sky-800 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-200 dark:text-sky-950"
                >
                  {dividendBusy ? "반영 중..." : "배당표 반영"}
                </button>
              </form>
            )}
            <form
              onSubmit={uploadSaleSpecification}
              className="flex flex-wrap items-center gap-2"
            >
              <label className="cursor-pointer rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30">
                매각물건명세서 선택
                <input
                  ref={specFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] ?? null;
                    setSpecFile(selectedFile);
                    if (specAutoUploadTimerRef.current) {
                      clearTimeout(specAutoUploadTimerRef.current);
                      specAutoUploadTimerRef.current = null;
                    }
                    setSpecMessage(
                      selectedFile
                        ? "매각물건명세서 선택됨: 1초 후 자동으로 반영합니다."
                        : null,
                    );
                    if (selectedFile) {
                      specAutoUploadTimerRef.current = setTimeout(() => {
                        specAutoUploadTimerRef.current = null;
                        void uploadSaleSpecificationFile(selectedFile);
                      }, 1000);
                    }
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={specBusy}
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950"
              >
                {specBusy ? "반영 중..." : "명세서 반영"}
              </button>
            </form>
            <button
              type="button"
              onClick={addTenantRow}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              임차인 항목 추가
            </button>
          </div>
        </div>
        {specFile && (
          <p className="text-xs text-neutral-500">선택한 파일: {specFile.name}</p>
        )}
        {specMessage && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {specMessage}
          </p>
        )}
        {!compact && dividendMessage && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
            {dividendMessage}
          </p>
        )}
        <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500 dark:bg-neutral-900">
          {compact
            ? "등록된 세입자 정보가 없습니다. 매각물건명세서를 등록하거나 임차인 항목을 추가하세요."
            : (
              <>
                저장된 구조화 JSON에서 임차인 현황이나 등기부 권리 목록을 찾지
                못했습니다. 옥션원 스키마의 <code>tenants</code>,{" "}
                <code>building_registry</code>, <code>land_registry</code> 항목이
                저장되면 이 화면에 자동으로 표시됩니다. 정보가 불분명하면 먼저
                수동 임차인 항목을 추가해 기록할 수 있습니다.
              </>
            )}
        </p>
      </section>
    );
  }

  return (
    <section
      className={`rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 ${
        compact ? "space-y-2 p-3" : "space-y-5 p-4"
      }`}
    >
      {compact ? (
        <h3 className="text-sm font-medium">세입자</h3>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-medium">세입자 · 임차인 구조화</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              녹/노/빨 = 배당 상태 · 명세서 우선 · 날짜는 행 「상세」
            </p>
          </div>
          <label className="text-xs font-medium text-neutral-500">
            배당 기준 입찰가
            <input
              inputMode="numeric"
              className="mt-1 block w-40 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
              value={
                distributionBasePrice != null
                  ? formatWonDigits(distributionBasePrice)
                  : ""
              }
              onChange={(e) =>
                onExpectedBidPriceChange(parseWonInput(e.target.value))
              }
              placeholder="예상 낙찰가"
            />
          </label>
        </div>
      )}
      {!compact && dividendMessage && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          {dividendMessage}
        </p>
      )}

      {!compact && (
      <details className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          요약·권리·등기 ({textValue(tenants?.total_count) || "0"}명 · 보증금{" "}
          {wonValue(tenants?.total_deposit)} · 월세 {wonValue(tenants?.total_monthly_rent)})
        </summary>
        <div className="space-y-3 border-t border-neutral-100 px-3 py-3 dark:border-neutral-900">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox label="임차인 수" value={textValue(tenants?.total_count)} />
            <MetricBox label="총 보증금" value={wonValue(tenants?.total_deposit)} />
            <MetricBox label="총 월세" value={wonValue(tenants?.total_monthly_rent)} />
            <MetricBox label="배당요구 종기" value={textValue(tenants?.bid_deadline)} />
          </div>
          {depositMortgageComment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-medium">보증금+근저당 검토</p>
              <p className="mt-1">{depositMortgageComment}</p>
              <p className="mt-1 text-xs tabular-nums">
                감정가 {wonValue(appraisalPrice)} · 총 보증금 {wonValue(totalDeposit)} · 근저당 합계{" "}
                {wonValue(mortgageAmount)}
              </p>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <TenantRightsSummaryCard
              keyDate={textValue(tenants?.key_date_base)}
              keyRight={textValue(tenants?.key_right_type)}
              buildingClaim={wonValue(buildingRegistry?.total_claim_amount)}
              landClaim={wonValue(landRegistry?.total_claim_amount)}
            />
            <TenantStatusSummaryCard
              floor1={statusSummary?.floor_1}
              floor2={statusSummary?.floor_2}
              floor3={statusSummary?.floor_3}
              floor4={statusSummary?.floor_4}
              rooftop={statusSummary?.rooftop}
              notes={statusSummary?.special_notes}
            />
          </div>
        </div>
      </details>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>
            {compact ? "호실별 현황" : "호실별 임차인 현황"}
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <form
                onSubmit={uploadExpectedDividend}
                className="flex flex-wrap items-center gap-2"
              >
                <label className="cursor-pointer rounded-lg border border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-900 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/30">
                  예상배당표 선택
                  <input
                    ref={dividendFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0] ?? null;
                      setDividendFile(selectedFile);
                      if (dividendAutoUploadTimerRef.current) {
                        clearTimeout(dividendAutoUploadTimerRef.current);
                        dividendAutoUploadTimerRef.current = null;
                      }
                      setDividendMessage(
                        selectedFile
                          ? "예상배당표 선택됨: 1초 후 자동으로 반영합니다."
                          : null,
                      );
                      if (selectedFile) {
                        dividendAutoUploadTimerRef.current = setTimeout(() => {
                          dividendAutoUploadTimerRef.current = null;
                          void uploadExpectedDividendFile(selectedFile);
                        }, 1000);
                      }
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={dividendBusy}
                  className="rounded-lg bg-sky-800 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-200 dark:text-sky-950"
                >
                  {dividendBusy ? "반영 중..." : "배당표 반영"}
                </button>
              </form>
            )}
            <form
              onSubmit={uploadSaleSpecification}
              className="flex flex-wrap items-center gap-2"
            >
              <label className="cursor-pointer rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30">
                매각물건명세서 선택
                <input
                  ref={specFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] ?? null;
                    setSpecFile(selectedFile);
                    if (specAutoUploadTimerRef.current) {
                      clearTimeout(specAutoUploadTimerRef.current);
                      specAutoUploadTimerRef.current = null;
                    }
                    setSpecMessage(
                      selectedFile
                        ? "매각물건명세서 선택됨: 1초 후 자동으로 반영합니다."
                        : null,
                    );
                    if (selectedFile) {
                      specAutoUploadTimerRef.current = setTimeout(() => {
                        specAutoUploadTimerRef.current = null;
                        void uploadSaleSpecificationFile(selectedFile);
                      }, 1000);
                    }
                  }}
                />
              </label>
              {specFile && (
                <span className="max-w-[180px] truncate text-xs text-neutral-500">
                  {specFile.name}
                </span>
              )}
              <button
                type="submit"
                disabled={specBusy}
                className="rounded-lg bg-amber-900 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950"
              >
                {specBusy ? "반영 중..." : "명세서 반영"}
              </button>
            </form>
            <button
              type="button"
              onClick={addTenantRow}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              임차인 항목 추가
            </button>
          </div>
        </div>
        {!compact && (
          <p className="text-[11px] text-neutral-500">
            핵심 항목은 한 표에 표시합니다. 전입·확정·배당일과 메모는 각 행의 「상세」에서
            편집하세요.
          </p>
        )}
        {specMessage && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {specMessage}
          </p>
        )}
        <TenantAnalysisCompactTable
          rows={tenantDisplayRows}
          expandedKey={expandedTenantKey}
          onExpandedKeyChange={setExpandedTenantKey}
          occupancyOptions={FIELD_OCCUPANCY_OPTIONS}
          contractIntentOptions={FIELD_CONTRACT_INTENT_OPTIONS}
          roomTypeOptions={TENANT_ROOM_TYPE_OPTIONS}
          fieldOccupancyValue={fieldOccupancyValue}
          fieldContractIntentValue={fieldContractIntentValue}
          onUpdateField={updateTenantField}
          onDeleteRow={deleteTenantRow}
          parseAreaSqm={parseAreaSqmInputToNumber}
          wonValue={wonValue}
          tenantNameTone={tenantNameToneFromDistribution}
          isHousingCorp={isHousingCorporationTenant}
          DistributionBadge={DistributionBadge}
          RiskFlag={RiskFlag}
        />
      </div>

      {!compact && (
      <details className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          배당요구 없는 임차인 기본 평가 (펼치기)
        </summary>
        <div className="border-t border-amber-200/60 p-3 dark:border-amber-900/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="sr-only">배당요구 없는 임차인 기본 평가</h4>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
              저장한 문구는 모든 물건의 세입자 분석에서 기본값으로 사용됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {guideEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onNoDividendRequestGuideChange(guideDraft);
                    setGuideEditing(false);
                  }}
                  className="rounded-lg bg-amber-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-amber-200 dark:text-amber-950"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGuideDraft(noDividendRequestGuide);
                    setGuideEditing(false);
                  }}
                  className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:text-amber-200"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => setGuideDraft(DEFAULT_NO_DIVIDEND_REQUEST_GUIDE)}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                >
                  기본값으로 되돌리기
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGuideDraft(noDividendRequestGuide);
                  setGuideEditing(true);
                }}
                className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:text-amber-200"
              >
                수정
              </button>
            )}
          </div>
        </div>
        {guideEditing ? (
          <AutoGrowTextarea
            className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm leading-6 dark:border-amber-800 dark:bg-neutral-950"
            value={guideDraft}
            onChange={(e) => setGuideDraft(e.target.value)}
          />
        ) : (
          <div className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-sm leading-6 text-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-200">
            {noDividendRequestGuide}
          </div>
        )}
        </div>
      </details>
      )}

      {!compact && (
      <details className="rounded-xl border border-neutral-200 dark:border-neutral-800">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          룸형식 가이드 · 등기부 권리 (펼치기)
        </summary>
        <div className="space-y-3 border-t border-neutral-100 px-3 py-3 dark:border-neutral-900">
          <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/40">
            <div className="grid gap-2 text-xs text-neutral-600 dark:text-neutral-400 md:grid-cols-2">
              <p><strong>원룸</strong>: 주방·침대가 한 공간. 월세 40만원 미만, 전세 5천만원 미만이면 수요 약함 주의.</p>
              <p><strong>분리형 원룸</strong>: 중문/슬라이딩 도어로 주방·침실 분리.</p>
              <p><strong>1.5룸</strong>: 거실 또는 소파 공간 + 방 1개 수준.</p>
              <p><strong>투룸</strong>: 방 2개 또는 거실 겸 방 + 방 1개.</p>
              <p><strong>정투룸</strong>: 방 2개 + 별도 거실.</p>
              <p><strong>미니쓰리룸/쓰리룸</strong>: 방 3개 구성. 주변 아파트 공급과 경쟁 확인.</p>
              <p><strong>주인세대</strong>: 쓰리룸급 구조에 자재·싱크대·인테리어가 고급인 세대.</p>
              <p><strong>상가/점포</strong>: 사업자등록일, 환산보증금, 상가임대차 기준 별도 확인.</p>
            </div>
          </div>
          <RegistryRightsTable title="건물등기부 권리" rights={buildingRights} />
          <RegistryRightsTable title="토지등기부 권리" rights={landRights} />
        </div>
      </details>
      )}
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-900 dark:bg-neutral-900/50">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value || "-"}</p>
    </div>
  );
}

function createManualTenantDocument(): CaseSourceDocument {
  const now = new Date().toISOString();
  return {
    id: `tenant-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "tenant-report",
    fileName: "수동 임차인 현황",
    fileSize: null,
    pageCount: null,
    extractedText: "수동으로 입력한 임차인 현황입니다.",
    structuredJson: {
      document: {
        meta: {
          source_file: "수동 임차인 현황",
          document_kind: "tenant-report",
          parser_version: "manual-tenant-v1",
          imported_at: now,
        },
        tenants: {
          total_count: 0,
          total_deposit: 0,
          total_monthly_rent: 0,
          bid_deadline: null,
          key_date_base: null,
          key_right_type: null,
          status_summary: {},
          list: [],
        },
        raw_text: "",
      },
    },
    parserVersion: "manual-tenant-v1",
    importedAt: now,
  };
}

function createEmptyTenantRow(index: number): Record<string, unknown> {
  return {
    unit: `${index}호`,
    name: "",
    room_type: "",
    field_occupancy_status: "needs_check",
    field_contract_intent: "",
    use: "주거",
    move_in_date: null,
    confirmed_date: null,
    business_registration_date: null,
    dividend_request_date: null,
    deposit: null,
    monthly_rent: null,
    area_sqm: null,
    has_opposing_power: null,
    dividend_rank: null,
    lien_registered: null,
    notes: "",
  };
}

function ensureTenantRoot(doc: CaseSourceDocument): Record<string, unknown> {
  let root = asRecord(doc.structuredJson);
  if (!root) {
    root = {};
    doc.structuredJson = root;
  }
  const auctionCase = asRecord(root.auction_case);
  if (auctionCase) {
    let tenants = asRecord(auctionCase.tenants);
    if (!tenants) {
      tenants = { list: [] };
      auctionCase.tenants = tenants;
    }
    return tenants;
  }
  let document = asRecord(root.document);
  if (!document) {
    document = {
      meta: {
        source_file: doc.fileName || "수동 임차인 현황",
        document_kind: "tenant-report",
        parser_version: doc.parserVersion || "manual-tenant-v1",
        imported_at: doc.importedAt,
      },
      raw_text: doc.extractedText ?? "",
    };
    root.document = document;
  }
  let tenants = asRecord(document.tenants);
  if (!tenants) {
    tenants = { list: [] };
    document.tenants = tenants;
  }
  return tenants;
}

function refreshTenantTotals(tenantRoot: Record<string, unknown>) {
  const list = Array.isArray(tenantRoot.list) ? tenantRoot.list : [];
  const rows = list.map(asRecord).filter(Boolean);
  tenantRoot.total_count = rows.length;
  tenantRoot.total_deposit = rows.reduce(
    (sum, row) => sum + (numberValue(row?.deposit) ?? 0),
    0,
  );
  tenantRoot.total_monthly_rent = rows.reduce(
    (sum, row) => sum + (numberValue(row?.monthly_rent) ?? 0),
    0,
  );
}

function normalizeTenantRentRows(rows: unknown[]) {
  for (const row of rows) {
    const tenant = asRecord(row);
    if (!tenant) continue;
    const deposit = numberValue(tenant.deposit);
    const monthlyRent = numberValue(tenant.monthly_rent);
    if (deposit != null && monthlyRent != null && deposit > 0 && deposit === monthlyRent) {
      tenant.monthly_rent = 0;
      tenant.lease_type = "전세";
    }
  }
}

function normalizeTenantDocumentRows(document: CaseSourceDocument) {
  const tenantRoot = ensureTenantRoot(document);
  const list = sortTenantRowsByUnit(arrayRecords(tenantRoot.list));
  tenantRoot.list = list;
  normalizeTenantRentRows(list);
  refreshTenantTotals(tenantRoot);
}

function isHousingCorporationTenant(name: string): boolean {
  return /(주택공사|한국토지주택공사|\bLH\b|엘에이치)/i.test(name);
}

function buildTenantDisplayRows(
  tenantRows: Record<string, unknown>[],
  distributionRows: TenantDistribution[],
) {
  return tenantRows
    .map((tenant, originalIndex) => ({
      tenant,
      originalIndex,
      distribution: distributionRows[originalIndex] ?? {
        status: "unknown" as const,
        estimatedAmount: null,
        ratioPct: null,
        note: "배당 계산 정보가 없습니다.",
      },
    }))
    .sort((a, b) => compareTenantUnit(a.tenant, b.tenant) || a.originalIndex - b.originalIndex);
}

function mergeTenantReportDocument(
  documents: CaseSourceDocument[],
  document: CaseSourceDocument,
): CaseSourceDocument[] {
  normalizeTenantDocumentRows(document);
  const incomingPayload = getDocumentAnalysisPayload(document);
  const incomingRows = arrayRecords(incomingPayload.tenants?.list);
  const existingTenantIndex = documents.findIndex(
    (doc) => getDocumentAnalysisPayload(doc).tenants,
  );
  if (existingTenantIndex < 0) return [document, ...documents];

  const nextDocuments = structuredClone(documents);
  const target = nextDocuments[existingTenantIndex];
  if (!target) return [document, ...documents];

  const tenantRoot = ensureTenantRoot(target);
  const existingRows = arrayRecords(tenantRoot.list);
  const resetRows = resetTenantRowsFromSpecification(existingRows, incomingRows);
  tenantRoot.list = resetRows;
  applyTenantMetadataFromSpecification(tenantRoot, incomingPayload.tenants);
  normalizeTenantRentRows(resetRows);
  refreshTenantTotals(tenantRoot);
  nextDocuments.splice(existingTenantIndex + 1, 0, document);
  return nextDocuments;
}

function TenantRightsSummaryCard({
  keyDate,
  keyRight,
  buildingClaim,
  landClaim,
}: {
  keyDate: string;
  keyRight: string;
  buildingClaim: string;
  landClaim: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">말소기준 / 기본 권리</h4>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          권리 기준
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <TenantSummaryTile label="기준일" value={keyDate} />
        <TenantSummaryTile label="기준 권리" value={keyRight} />
        <TenantSummaryTile label="건물 청구액" value={buildingClaim} emphasis />
        <TenantSummaryTile label="토지 청구액" value={landClaim} emphasis />
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        기준 권리보다 앞선 전입·확정일자와 배당요구 여부를 먼저 확인하세요.
      </p>
    </div>
  );
}

function TenantStatusSummaryCard({
  floor1,
  floor2,
  floor3,
  floor4,
  rooftop,
  notes,
}: {
  floor1: unknown;
  floor2: unknown;
  floor3: unknown;
  floor4: unknown;
  rooftop: unknown;
  notes: unknown;
}) {
  const floors = [
    ["1층", stringifyValue(floor1)],
    ["2층", stringifyValue(floor2)],
    ["3층", stringifyValue(floor3)],
    ["4층", stringifyValue(floor4)],
  ].filter(([, value]) => value);
  const noteItems = [...new Set(arrayTextValues(notes))];
  const rooftopText = stringifyValue(rooftop);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">기타 현황</h4>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          층별 메모
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {floors.length > 0 ? (
          floors.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg bg-neutral-50 p-2 text-xs dark:bg-neutral-900"
            >
              <p className="font-medium text-neutral-500">{label}</p>
              <p className="mt-1 line-clamp-2 text-neutral-800 dark:text-neutral-200">
                {value}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500 dark:bg-neutral-900 sm:col-span-2">
            층별 현황 정보가 없습니다.
          </p>
        )}
      </div>
      {(rooftopText || noteItems.length > 0) && (
        <div className="mt-3 space-y-2">
          {rooftopText && (
            <p className="rounded-lg border border-neutral-100 px-2 py-1.5 text-xs dark:border-neutral-900">
              <span className="font-medium text-neutral-500">옥탑</span>{" "}
              {rooftopText}
            </p>
          )}
          {noteItems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-medium">특이사항</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {noteItems.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TenantSummaryTile({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={`mt-1 break-words text-sm ${
          emphasis ? "font-semibold tabular-nums" : "font-medium"
        }`}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function TenantTextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  tone,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  tone?: "risk" | "success" | "warning";
}) {
  const [draft, setDraft] = useState(value);
  /* eslint-disable react-hooks/set-state-in-effect -- 입력값은 Enter/blur 저장 후 외부 보정값과 다시 동기화 */
  useEffect(() => {
    setDraft(value);
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  const toneClass =
    tone === "risk"
      ? "border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400"
      : tone === "success"
        ? "border-emerald-300 font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
        : tone === "warning"
          ? "border-amber-300 font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-200"
          : "border-neutral-300 dark:border-neutral-700";
  return (
    <label className="block text-xs font-medium text-neutral-500">
      {label}
      <input
        inputMode={inputMode}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-neutral-900 ${toneClass}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
      />
    </label>
  );
}

function TenantInlineInput({
  value,
  onChange,
  placeholder,
  inputMode,
  tone,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  tone?: "risk" | "success" | "warning";
}) {
  const [draft, setDraft] = useState(value);
  /* eslint-disable react-hooks/set-state-in-effect -- 입력값은 Enter/blur 저장 후 외부 보정값과 다시 동기화 */
  useEffect(() => {
    setDraft(value);
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  const toneClass =
    tone === "risk"
      ? "border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400"
      : tone === "success"
        ? "border-emerald-300 font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
        : tone === "warning"
          ? "border-amber-300 font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-200"
          : "border-neutral-200 dark:border-neutral-800";
  return (
    <input
      inputMode={inputMode}
      className={`w-full min-w-0 rounded border px-2 py-1 text-xs tabular-nums dark:bg-neutral-900 ${toneClass}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
    />
  );
}

function RiskFlag({ value }: { value: unknown }) {
  if (typeof value !== "boolean") {
    return <span className="text-neutral-400">-</span>;
  }
  return value ? (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      있음
    </span>
  ) : (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
      없음
    </span>
  );
}

type TenantDistribution = {
  status: "full" | "partial" | "none" | "unknown" | "no_request";
  estimatedAmount: number | null;
  ratioPct: number | null;
  note: string;
};

function DistributionBadge({
  distribution,
}: {
  distribution: TenantDistributionView | undefined;
}) {
  if (!distribution || distribution.status === "unknown") {
    return <span className="text-neutral-400">계산불가</span>;
  }
  const base =
    "inline-flex max-w-[180px] flex-col rounded-md px-2 py-1 text-[11px] font-medium leading-snug";
  const ratio = distribution.ratioPct;
  const className =
    distribution.status === "no_request" || distribution.status === "none"
      ? `${base} bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200`
      : distribution.status === "full" || (ratio != null && ratio >= 100)
      ? `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200`
      : distribution.status === "partial" || (ratio != null && ratio > 0)
        ? `${base} bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`
        : `${base} bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200`;
  const label = distributionStatusLabel(distribution.status);
  return (
    <span className={className} title={distribution.note}>
      <span>{label}</span>
      {distribution.estimatedAmount != null && (
        <span className="tabular-nums">
          {wonValue(distribution.estimatedAmount)}
          {distribution.ratioPct != null ? ` (${Math.round(distribution.ratioPct)}%)` : ""}
        </span>
      )}
    </span>
  );
}

function estimateTenantDistributions(args: {
  tenants: Record<string, unknown>[];
  buildingRights: Record<string, unknown>[];
  landRights: Record<string, unknown>[];
  minimumPrice: number | null;
  address: string;
  keyDateBase: string;
}): TenantDistribution[] {
  const { tenants, buildingRights, landRights, minimumPrice, address, keyDateBase } = args;
  if (!minimumPrice || minimumPrice <= 0) {
    return tenants.map(() => ({
      status: "unknown",
      estimatedAmount: null,
      ratioPct: null,
      note: "배당 기준금액을 찾지 못했습니다.",
    }));
  }

  const rule = smallTenantRuleFor(address, keyDateBase);
  const deposits = tenants.map((tenant) => numberValue(tenant.deposit) ?? 0);
  const smallClaims = tenants.map((tenant, index) => {
    const deposit = deposits[index] ?? 0;
    const movedIn = Boolean(parseDateLike(tenant.move_in_date));
    if (!movedIn || deposit <= 0 || deposit > rule.depositLimit) return 0;
    return Math.min(deposit, rule.priorityLimit);
  });
  const smallClaimTotal = smallClaims.reduce((sum, amount) => sum + amount, 0);
  const smallClaimCap = Math.floor(minimumPrice / 2);
  const smallScale =
    smallClaimTotal > smallClaimCap && smallClaimTotal > 0
      ? smallClaimCap / smallClaimTotal
      : 1;
  const smallPaid = smallClaims.map((amount) => Math.floor(amount * smallScale));

  const priorClaims = [...buildingRights, ...landRights].reduce(
    (sum, right) => sum + (numberValue(right.amount) ?? 0),
    0,
  );
  let remaining = Math.max(
    0,
    minimumPrice - priorClaims - smallPaid.reduce((sum, amount) => sum + amount, 0),
  );

  const normalOrder = tenants
    .map((tenant, index) => ({
      index,
      date:
        parseDateLike(tenant.confirmed_date) ??
        parseDateLike(tenant.move_in_date) ??
        "9999-12-31",
      requested: Boolean(textValue(tenant.dividend_request_date)),
      remainingDeposit: Math.max(0, deposits[index]! - smallPaid[index]!),
    }))
    .filter((item) => item.requested && item.remainingDeposit > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const normalPaid = tenants.map(() => 0);
  for (const item of normalOrder) {
    const paid = Math.min(item.remainingDeposit, remaining);
    normalPaid[item.index] = paid;
    remaining -= paid;
  }

  return tenants.map((tenant, index) => {
    const deposit = deposits[index] ?? 0;
    const estimatedAmount = (smallPaid[index] ?? 0) + (normalPaid[index] ?? 0);
    const ratioPct = deposit > 0 ? (estimatedAmount / deposit) * 100 : null;
    const requested = Boolean(textValue(tenant.dividend_request_date));
    const moveInDate = parseDateLike(tenant.move_in_date);
    const keyDate = parseDateLike(keyDateBase);
    const opposing = Boolean(keyDate && moveInDate && moveInDate < keyDate);
    const noteParts = [
      `예상가 ${wonValue(minimumPrice)} 기준 간이 계산`,
      `소액 ${wonValue(smallPaid[index] ?? 0)}`,
      `순위 ${wonValue(normalPaid[index] ?? 0)}`,
    ];
    if (priorClaims > 0) noteParts.push(`등기부 청구액 우선 차감 ${wonValue(priorClaims)}`);
    if (opposing && estimatedAmount < deposit) noteParts.push("대항력 임차인 인수 가능성");
    if (!requested && deposit > 0) {
      return {
        status: "no_request",
        estimatedAmount,
        ratioPct,
        note: [...noteParts, "배당요구일을 찾지 못했습니다."].join(" · "),
      };
    }
    if (deposit <= 0) {
      return {
        status: "unknown",
        estimatedAmount: null,
        ratioPct: null,
        note: "보증금 정보를 찾지 못했습니다.",
      };
    }
    if (estimatedAmount >= deposit) {
      return { status: "full", estimatedAmount, ratioPct, note: noteParts.join(" · ") };
    }
    if (estimatedAmount > 0) {
      return { status: "partial", estimatedAmount, ratioPct, note: noteParts.join(" · ") };
    }
    return { status: "none", estimatedAmount, ratioPct, note: noteParts.join(" · ") };
  });
}

function smallTenantRuleFor(address: string, keyDateBase: string): {
  depositLimit: number;
  priorityLimit: number;
} {
  const date = parseDateLike(keyDateBase) ?? new Date().toISOString().slice(0, 10);
  const region =
    address.includes("서울")
      ? "seoul"
      : /(세종|용인|화성|김포|의정부|구리|남양주|하남|고양|수원|성남|안양|부천|광명|과천|의왕|군포|시흥|인천)/.test(address)
        ? "overcrowded"
        : /(광역시|안산|광주|파주|이천|평택)/.test(address)
          ? "metro"
          : "other";

  const latest =
    region === "seoul"
      ? { depositLimit: 165_000_000, priorityLimit: 55_000_000 }
      : region === "overcrowded"
        ? { depositLimit: 145_000_000, priorityLimit: 48_000_000 }
        : region === "metro"
          ? { depositLimit: 85_000_000, priorityLimit: 28_000_000 }
          : { depositLimit: 75_000_000, priorityLimit: 25_000_000 };
  if (date >= "2023-02-21") return latest;
  if (date >= "2021-05-11") {
    return region === "seoul"
      ? { depositLimit: 150_000_000, priorityLimit: 50_000_000 }
      : region === "overcrowded"
        ? { depositLimit: 130_000_000, priorityLimit: 43_000_000 }
        : region === "metro"
          ? { depositLimit: 70_000_000, priorityLimit: 23_000_000 }
          : { depositLimit: 60_000_000, priorityLimit: 20_000_000 };
  }
  if (date >= "2018-09-18") {
    return region === "seoul"
      ? { depositLimit: 110_000_000, priorityLimit: 37_000_000 }
      : region === "overcrowded"
        ? { depositLimit: 100_000_000, priorityLimit: 34_000_000 }
        : region === "metro"
          ? { depositLimit: 60_000_000, priorityLimit: 20_000_000 }
          : { depositLimit: 50_000_000, priorityLimit: 17_000_000 };
  }
  return latest;
}

function RegistryRightsTable({
  title,
  rights,
}: {
  title: string;
  rights: Record<string, unknown>[];
}) {
  if (rights.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="overflow-x-auto">
        <table className={TABLE_COMPACT}>
          <thead>
            <tr className="border-b text-neutral-500 dark:border-neutral-800">
              <th className={`${TC_TH} w-10`}>번호</th>
              <th className={`${TC_TH} w-20`}>일자</th>
              <th className={`${TC_TH} w-20`}>종류</th>
              <th className={`${TC_TH} ${TC_UNIT}`}>권리자/입주자</th>
              <th className={`${TC_TH} ${TC_UNIT}`}>호실</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>금액</th>
              <th className={`${TC_TH} w-16`}>소멸</th>
              <th className={TC_TH}>기타</th>
            </tr>
          </thead>
          <tbody>
            {rights.map((right, i) => (
              <tr
                key={`${textValue(right.no)}-${textValue(right.type)}-${i}`}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className={`${TC_TD} w-10`}>{textValue(right.no) || "-"}</td>
                <td className={`${TC_TD} w-20`}>{textValue(right.date) || "-"}</td>
                <td className={`${TC_TD} w-20`}>
                  {right.is_key_right === true ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {textValue(right.type) || "-"} · 말소기준
                    </span>
                  ) : (
                    textValue(right.type) || "-"
                  )}
                </td>
                <td className={`${TC_TD} ${TC_UNIT}`}>{textValue(right.holder) || "-"}</td>
                <td className={`${TC_TD} ${TC_UNIT}`}>{textValue(right.unit) || "-"}</td>
                <td className={`${TC_TD} ${TC_MONEY} tabular-nums`}>
                  {wonValue(right.amount) || "-"}
                </td>
                <td className={`${TC_TD} w-16`}>
                  {typeof right.extinguished === "boolean"
                    ? right.extinguished
                      ? "소멸"
                      : "인수 가능"
                    : "-"}
                </td>
                <td className={TC_TD}>
                  {joinText([
                    right.note,
                    right.case_number,
                    right.move_in_date ? `전입 ${textValue(right.move_in_date)}` : "",
                    right.confirmed_date
                      ? `확정 ${textValue(right.confirmed_date)}`
                      : "",
                  ]) || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StructuredBasicInfoSummary({
  document,
}: {
  document: CaseSourceDocument;
}) {
  const root = asRecord(document.structuredJson);
  const genericPayload = asRecord(root?.document);
  const auctionPayload = asRecord(root?.auction_case);
  if (!auctionPayload && genericPayload) {
    return (
      <GenericStructuredDocumentSummary
        document={document}
        payload={genericPayload}
      />
    );
  }

  const payload = auctionPayload ?? getAuctionCasePayload(document.structuredJson);
  if (!payload) return null;

  const meta = asRecord(payload.meta);
  const caseInfo = asRecord(payload.case_info);
  const property = asRecord(payload.property);
  const address = asRecord(property?.address);
  const appraisal = asRecord(payload.appraisal);
  const land = asRecord(appraisal?.land);
  const saleSchedule = asRecord(payload.sale_schedule);
  const buildingSummary = asRecord(payload.building_summary);
  const tenants = asRecord(payload.tenants);
  const schedules = Array.isArray(saleSchedule?.schedules)
    ? saleSchedule.schedules
    : [];
  const currentSchedule = schedules
    .map((x) => asRecord(x))
    .find((x) => x?.is_current === true) ?? asRecord(schedules[0]);
  const buildingTotalArea = numberValue(appraisal?.building_total_area_sqm);
  const parkingCount = numberValue(buildingSummary?.parking_unit_count);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-900 dark:bg-neutral-900/50">
      <p className="text-sm font-medium">등록 기본정보 요약</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoGroup
          title="사건"
          rows={[
            ["출처", textValue(meta?.source_site)],
            ["법원/계", textValue(meta?.court ?? caseInfo?.court_division)],
            ["사건번호", textValue(caseInfo?.case_number)],
            ["사건명", textValue(caseInfo?.case_name)],
            ["개시일", textValue(caseInfo?.open_date)],
            ["이관/비고", textValue(caseInfo?.transfer_note)],
          ]}
        />
        <InfoGroup
          title="물건"
          rows={[
            ["주소", textValue(address?.full)],
            ["도로명", textValue(address?.road_address)],
            ["지역", joinText([address?.city, address?.gu, address?.dong])],
            ["지번", textValue(address?.lot_number)],
            ["종류", textValue(property?.property_type)],
            ["매각 방식", textValue(property?.sale_method)],
          ]}
        />
        <InfoGroup
          title="감정/면적"
          rows={[
            ["감정가", wonValue(appraisal?.total_appraisal_value)],
            ["토지면적", areaValue(land?.area_sqm, "㎡")],
            ["토지면적(평)", areaValue(land?.area_pyeong, "평")],
            [
              "건물 연면적",
              highlightedMetric(
                areaValue(appraisal?.building_total_area_sqm, "㎡"),
                buildingTotalArea != null && buildingTotalArea >= 500 ? "good" : null,
              ),
            ],
            ["건물 연면적(평)", areaValue(appraisal?.building_total_area_pyeong, "평")],
            ["토지 평단가", wonValue(appraisal?.land_price_per_pyeong)],
          ]}
        />
        <InfoGroup
          title="입찰/임차"
          rows={[
            ["현재 회차", textValue(saleSchedule?.current_round)],
            ["입찰일", textValue(currentSchedule?.date)],
            ["최저가", wonValue(currentSchedule?.minimum_price)],
            ["보증금", wonValue(saleSchedule?.deposit_amount)],
            ["임차인 수", textValue(tenants?.total_count)],
            ["총 보증금/월세", joinText([
              wonValue(tenants?.total_deposit),
              wonValue(tenants?.total_monthly_rent),
            ])],
          ]}
        />
        <InfoGroup
          title="소유/채무"
          rows={[
            ["소유자", textValue(property?.owner)],
            ["채무자", textValue(property?.debtor)],
            ["채권자", textValue(property?.creditor)],
            [
              "주차",
              highlightedMetric(
                textValue(buildingSummary?.parking_unit_count),
                parkingCount != null && parkingCount >= 10 ? "good" : null,
              ),
            ],
            [
              "사용승인/준공",
              highlightedMetric(
                textValue(buildingSummary?.approval_or_built_date),
                buildingApprovalTone(buildingSummary?.approval_or_built_date),
              ),
            ],
          ]}
        />
      </div>
    </div>
  );
}

function GenericStructuredDocumentSummary({
  document,
  payload,
}: {
  document: CaseSourceDocument;
  payload: Record<string, unknown>;
}) {
  const registry = asRecord(payload.registry);
  const building = asRecord(payload.building_info_official);
  const appraisal = asRecord(payload.appraisal_report);
  const tenants = asRecord(payload.tenants);
  const meta = asRecord(payload.meta);
  const buildingArea = numberValue(building?.total_area_sqm);
  const parkingCount = numberValue(building?.total_parking);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-900 dark:bg-neutral-900/50">
      <p className="text-sm font-medium">추가 문서 요약</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoGroup
          title="문서"
          rows={[
            ["종류", sourceDocumentKindLabel(document.kind)],
            ["파일", textValue(meta?.source_file)],
            ["페이지", textValue(meta?.page_count)],
            ["파서", textValue(meta?.parser_version)],
          ]}
        />
        {registry && (
          <InfoGroup
            title="등기부"
            rows={[
              ["범위", textValue(registry.scope)],
              ["권리 수", textValue(arrayRecords(registry.rights).length)],
              ["청구금액", wonValue(registry.total_claim_amount)],
            ]}
          />
        )}
        {building && (
          <InfoGroup
            title="건축물대장"
            rows={[
              ["소재지", textValue(building.address)],
              ["종류", textValue(building.building_type)],
              ["가구/세대", textValue(building.units)],
              ["층수", joinText([
                building.floors_below_ground
                  ? `지하 ${textValue(building.floors_below_ground)}층`
                  : "",
                building.floors_above_ground
                  ? `지상 ${textValue(building.floors_above_ground)}층`
                  : "",
              ])],
              [
                "주차",
                highlightedMetric(
                  textValue(building.total_parking),
                  parkingCount != null && parkingCount >= 10 ? "good" : null,
                ),
              ],
              [
                "연면적",
                highlightedMetric(
                  areaValue(building.total_area_sqm, "㎡"),
                  buildingArea != null && buildingArea >= 500 ? "good" : null,
                ),
              ],
              [
                "사용승인",
                highlightedMetric(
                  textValue(building.approval_date),
                  buildingApprovalTone(building.approval_date),
                ),
              ],
              ["위반", textValue(building.violation_note)],
            ]}
          />
        )}
        {appraisal && (
          <InfoGroup
            title="감정평가서"
            rows={[
              ["감정가", wonValue(appraisal.total_appraisal_value)],
              ["평가일", textValue(appraisal.appraisal_date)],
              ["평가기관", textValue(appraisal.appraiser)],
              ["거래사례", textValue(appraisal.comparable_count)],
              ["토지면적", areaValue(appraisal.land_area_sqm, "㎡")],
              ["건물면적", areaValue(appraisal.building_total_area_sqm, "㎡")],
            ]}
          />
        )}
        {tenants && (
          <InfoGroup
            title="임차인 현황"
            rows={[
              ["임차인 수", textValue(tenants.total_count)],
              ["총 보증금", wonValue(tenants.total_deposit)],
              ["총 월세", wonValue(tenants.total_monthly_rent)],
              ["배당요구 종기", textValue(tenants.bid_deadline)],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function sourceDocumentKindLabel(kind: CaseSourceDocumentKind): string {
  return (
    SOURCE_DOCUMENT_KIND_OPTIONS.find((option) => option.value === kind)
      ?.label ?? sourceDocumentKindFileLabel(kind)
  );
}

type HighlightTone = "good" | "bad" | null;

function highlightedMetric(value: string, tone: HighlightTone): React.ReactNode {
  if (!value) return "";
  if (tone === "good") {
    return (
      <span className="font-bold text-emerald-700 dark:text-emerald-400">
        {value}
      </span>
    );
  }
  if (tone === "bad") {
    return (
      <span className="font-bold text-rose-700 dark:text-rose-400">
        {value}
      </span>
    );
  }
  return value;
}

function buildingApprovalTone(raw: unknown): HighlightTone {
  const iso = parseDateLike(raw);
  if (!iso) return null;
  const approvedAt = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(approvedAt)) return null;
  const ageYears = (Date.now() - approvedAt) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 5) return "good";
  if (ageYears >= 15) return "bad";
  return null;
}

function InfoGroup({
  title,
  rows,
}: {
  title: string;
  rows: [string, React.ReactNode][];
}) {
  const visibleRows = rows.filter(([, value]) => value !== "");
  if (visibleRows.length === 0) return null;
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-neutral-950">
      <p className="text-xs font-semibold text-neutral-500">{title}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {visibleRows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[88px_1fr] gap-2">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="min-w-0 break-words text-neutral-800 dark:text-neutral-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function arrayRecords(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  const records: Record<string, unknown>[] = [];
  for (const x of v) {
    const record = asRecord(x);
    if (record) records.push(record);
  }
  return records;
}

function getAuctionCasePayload(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  return asRecord(root.auction_case) ?? root;
}

function getDocumentPayload(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  return asRecord(root.document);
}

function getDocumentAnalysisPayload(doc: CaseSourceDocument): {
  tenants: Record<string, unknown> | null;
  buildingRegistry: Record<string, unknown> | null;
  landRegistry: Record<string, unknown> | null;
  sourcePayload: Record<string, unknown> | null;
} {
  const auctionCase = getAuctionCasePayload(doc.structuredJson);
  const document = getDocumentPayload(doc.structuredJson);
  const registry = asRecord(document?.registry);
  return {
    tenants: asRecord(auctionCase?.tenants) ?? asRecord(document?.tenants),
    buildingRegistry:
      asRecord(auctionCase?.building_registry) ??
      (doc.kind === "registry-building" ? registry : null),
    landRegistry:
      asRecord(auctionCase?.land_registry) ??
      (doc.kind === "registry-land" ? registry : null),
    sourcePayload: auctionCase,
  };
}

function textValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) {
    return v.toLocaleString("ko-KR");
  }
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return "";
}

function fieldOccupancyValue(raw: unknown): (typeof FIELD_OCCUPANCY_OPTIONS)[number]["value"] {
  const value = textValue(raw);
  return FIELD_OCCUPANCY_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof FIELD_OCCUPANCY_OPTIONS)[number]["value"])
    : "needs_check";
}

function fieldContractIntentValue(
  raw: unknown,
): (typeof FIELD_CONTRACT_INTENT_OPTIONS)[number]["value"] {
  const value = textValue(raw);
  return FIELD_CONTRACT_INTENT_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof FIELD_CONTRACT_INTENT_OPTIONS)[number]["value"])
    : "";
}

function numberValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDateLike(v: unknown): string | null {
  const s = textValue(v);
  if (!s) return null;
  const m = s.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  const year = s.match(/(19|20)\d{2}/)?.[0];
  if (year) return `${year}-01-01`;
  return null;
}

function wonValue(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return textValue(v);
  return formatWonWithUnit(v);
}

function areaValue(v: unknown, unit: string): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return textValue(v);
  return `${v.toLocaleString("ko-KR")}${unit}`;
}

function joinText(values: unknown[]): string {
  return values.map(textValue).filter(Boolean).join(" · ");
}

function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean).join(", ");
  return textValue(v);
}

function arrayTextValues(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(textValue).filter(Boolean);
  const value = textValue(v);
  return value ? [value] : [];
}

function BidRoundsEditor({
  caseId,
  rounds,
  addBidRound,
  updateBidRound,
  removeBidRound,
}: {
  caseId: string;
  rounds: BidRound[];
  addBidRound: (caseId: string, round: Omit<BidRound, "id">) => void;
  updateBidRound: (
    caseId: string,
    roundId: string,
    patch: Partial<BidRound>,
  ) => void;
  removeBidRound: (caseId: string, roundId: string) => void;
}) {
  const sorted = [...rounds].sort((a, b) => a.round - b.round);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className={TABLE_COMPACT}>
          <thead>
            <tr className="border-b text-xs text-neutral-500">
              <th className={`${TC_TH} w-10`}>회차</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>최저가</th>
              <th className={`${TC_TH} ${TC_MONEY}`}>내 입찰</th>
              <th className={`${TC_TH} w-14`}>결과</th>
              <th className={`${TC_TH} w-24`}>입찰일</th>
              <th className={TC_TH}>메모</th>
              <th className={`${TC_TH} w-8`} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className={`${TC_TD} w-10`}>
                  <input
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs dark:bg-neutral-900"
                    type="number"
                    value={r.round}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        round: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_MONEY}`}>
                  <input
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs tabular-nums dark:bg-neutral-900"
                    inputMode="numeric"
                    value={
                      r.minPrice != null ? formatWonDigits(r.minPrice) : ""
                    }
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        minPrice: parseWonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} ${TC_MONEY}`}>
                  <input
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs tabular-nums dark:bg-neutral-900"
                    inputMode="numeric"
                    value={
                      r.myBidPrice != null ? formatWonDigits(r.myBidPrice) : ""
                    }
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        myBidPrice: parseWonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className={`${TC_TD} w-14`}>
                  <select
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs dark:bg-neutral-900"
                    value={r.result}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        result: e.target.value as BidRoundResult,
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="failed">유찰/실패</option>
                    <option value="won">낙찰</option>
                    <option value="lost">패찰</option>
                  </select>
                </td>
                <td className={`${TC_TD} w-24`}>
                  <input
                    type="date"
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs dark:bg-neutral-900"
                    value={r.bidDate ?? ""}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        bidDate: e.target.value || null,
                      })
                    }
                  />
                </td>
                <td className={TC_TD}>
                  <input
                    className="w-full min-w-0 rounded border px-1 py-0.5 text-xs dark:bg-neutral-900"
                    value={r.memo}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, { memo: e.target.value })
                    }
                  />
                </td>
                <td className={`${TC_TD} w-8`}>
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => removeBidRound(caseId, r.id)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        onClick={() => {
          const next =
            sorted.length > 0
              ? Math.max(...sorted.map((x) => x.round)) + 1
              : 1;
          addBidRound(caseId, {
            round: next,
            minPrice: null,
            myBidPrice: null,
            result: "failed",
            bidDate: null,
            memo: "",
          });
        }}
      >
        회차 추가
      </button>
    </div>
  );
}
