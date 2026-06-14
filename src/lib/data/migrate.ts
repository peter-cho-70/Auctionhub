import type { AppData, AuctionCase } from "@/lib/types/domain";
import {
  SCHEMA_VERSION,
  ROOM_SHAPE_OPTIONS,
  emptyRoomShapeMix,
  type BuildingUnitComposition,
  type BuildingUnitUseType,
  type CaseSourceDocument,
  type CaseSourceDocumentKind,
  type Priority,
  type PriorityLevel,
  type RoomShape,
} from "@/lib/types/domain";
import {
  createDefaultAppData,
  DEFAULT_NO_DIVIDEND_REQUEST_GUIDE,
  DEFAULT_PROPERTY_ANALYSIS_SETTINGS,
} from "@/lib/data/default-data";
import {
  normalizeRentSetting,
} from "@/lib/domain/rent-setting";
import { normalizeMultiFamilyAnalysis } from "@/lib/domain/multifamily-analysis";
import { normalizeNearbyMarketAnalysis } from "@/lib/domain/nearby-market";
import { normalizeRemodelingPriceCatalog } from "@/lib/domain/remodeling-catalog";
import { normalizeFieldInspection } from "@/lib/domain/field-inspection";
import { normalizeCaseRemodeling } from "@/lib/domain/remodeling";
import { normalizeCaseAddressMeta } from "@/lib/address/normalize";
import { normalizeFieldPhotoGallery } from "@/lib/domain/field-photo-gallery";
import { normalizeTenantRecords } from "@/lib/domain/case-tenant-records";
import { normalizeMarketReferenceNotes } from "@/lib/domain/market-reference-notes";
import { normalizeCaseListColor } from "@/lib/domain/case-list-display";
import { normalizeCaseListThumbnail } from "@/lib/domain/case-list-thumbnail";
import { normalizePdfCoverSettings } from "@/lib/pdf/pdf-cover-settings";
import { normalizeExternalAiQaList } from "@/lib/domain/external-ai-qa";
import {
  normalizeAuctionBidAnalysis,
  normalizeAuctionSaleComparableList,
} from "@/lib/domain/auction-bid-analysis";
import {
  normalizeCasePhase,
  normalizePostAuctionWorkflow,
  normalizePreAuctionWorkflow,
} from "@/lib/domain/case-workflow";
import { DEFAULT_FIELD_INTEL_KNOWLEDGE_NOTE } from "@/lib/domain/field-intel";
import type { KnowledgeNote } from "@/lib/types/domain";
import { compactAppDataForStorage } from "@/lib/data/compact-storage";

export function parseAppDataJson(text: string): AppData {
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON이 객체가 아닙니다.");
  }
  const o = raw as Record<string, unknown>;
  const ver = o.schemaVersion;
  if (ver !== SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion이 ${SCHEMA_VERSION}이 아닙니다. (현재: ${String(ver)})`,
    );
  }
  return raw as AppData;
}

export function safeParseAppDataJson(text: string): AppData | Error {
  try {
    return parseAppDataJson(text);
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

export function mergeImportedData(
  current: AppData,
  incoming: AppData,
  mode: "replace" | "merge",
): AppData {
  if (mode === "replace") {
    return structuredClone(incoming);
  }
  const currentCasesById = new Map(current.cases.map((c) => [c.id, c]));
  const incomingCaseIds = new Set(incoming.cases.map((c) => c.id));
  const mergedCases = current.cases.map((currentCase) => {
    const incomingCase = incomingCaseIds.has(currentCase.id)
      ? incoming.cases.find((c) => c.id === currentCase.id)
      : undefined;
    return incomingCase
      ? mergeSameCasePreservingLocalAnalysis(currentCase, incomingCase)
      : currentCase;
  });
  for (const c of incoming.cases) {
    if (!currentCasesById.has(c.id)) mergedCases.push(c);
  }
  const noteIds = new Set(current.knowledgeNotes.map((n) => n.id));
  const mergedNotes = [...current.knowledgeNotes];
  for (const n of incoming.knowledgeNotes) {
    if (!noteIds.has(n.id)) mergedNotes.push(n);
  }
  const sharedIds = new Set(current.sharedExternalAiQa?.map((e) => e.id) ?? []);
  const mergedShared = [...(current.sharedExternalAiQa ?? [])];
  for (const e of incoming.sharedExternalAiQa ?? []) {
    if (!sharedIds.has(e.id)) mergedShared.push(e);
  }
  const auctionSharedIds = new Set(
    current.sharedAuctionSaleComparables?.map((e) => e.id) ?? [],
  );
  const mergedAuctionShared = [...(current.sharedAuctionSaleComparables ?? [])];
  for (const e of incoming.sharedAuctionSaleComparables ?? []) {
    if (!auctionSharedIds.has(e.id)) mergedAuctionShared.push(e);
  }
  return {
    ...current,
    messageTemplates: incoming.messageTemplates.length
      ? incoming.messageTemplates
      : current.messageTemplates,
    checklistTemplates: {
      ...current.checklistTemplates,
      ...incoming.checklistTemplates,
    },
    lectureGuideByStep: {
      ...(current.lectureGuideByStep ?? {}),
      ...(incoming.lectureGuideByStep ?? {}),
    },
    tenantAnalysisSettings: {
      ...current.tenantAnalysisSettings,
      ...incoming.tenantAnalysisSettings,
    },
    propertyAnalysisSettings: {
      ...current.propertyAnalysisSettings,
      ...incoming.propertyAnalysisSettings,
    },
    pdfCoverSettings: incoming.pdfCoverSettings
      ? normalizePdfCoverSettings(incoming.pdfCoverSettings)
      : current.pdfCoverSettings,
    processStepOrder: incoming.processStepOrder.length
      ? incoming.processStepOrder
      : current.processStepOrder,
    cases: mergedCases,
    knowledgeNotes: mergedNotes,
    sharedExternalAiQa: mergedShared,
    sharedAuctionSaleComparables: mergedAuctionShared,
    guMarketCache: {
      ...current.guMarketCache,
      ...incoming.guMarketCache,
    },
  };
}

function mergeSameCasePreservingLocalAnalysis(
  currentCase: AuctionCase,
  incomingCase: AuctionCase,
): AuctionCase {
  const nearbyMarketAnalysis =
    currentCase.nearbyMarketAnalysis ?? incomingCase.nearbyMarketAnalysis ?? null;
  const hasLocalRemodeling =
    (currentCase.remodeling.unitAssignments?.length ?? 0) > 0 ||
    (currentCase.remodeling.scenarios?.some(
      (s) =>
        s.roomProfiles.some((p) => p.costLines.some((l) => l.selected)) ||
        s.buildingCostLines.some((l) => l.selected),
    ) ??
      false) ||
    // legacy
    ((currentCase.remodeling as { units?: unknown[] }).units?.length ?? 0) > 0;
  const remodeling = hasLocalRemodeling
    ? currentCase.remodeling
    : incomingCase.remodeling ?? currentCase.remodeling;
  const hasLocalFieldInspection =
    (currentCase.fieldInspection?.nearbyBrokers?.length ?? 0) > 0 ||
    (currentCase.fieldInspection?.buildingManagement?.companyName?.trim() ?? "")
      .length > 0 ||
    (currentCase.fieldInspection?.memo?.trim() ?? "").length > 0;
  const fieldInspection = hasLocalFieldInspection
    ? currentCase.fieldInspection
    : incomingCase.fieldInspection ?? currentCase.fieldInspection;
  const brokerMarketNotes =
    currentCase.brokerMarketNotes?.length > 0
      ? currentCase.brokerMarketNotes
      : incomingCase.brokerMarketNotes ?? [];
  const aiMarketNotes =
    currentCase.aiMarketNotes?.length > 0
      ? currentCase.aiMarketNotes
      : incomingCase.aiMarketNotes ?? [];
  const externalAiQa =
    currentCase.externalAiQa?.length > 0
      ? currentCase.externalAiQa
      : incomingCase.externalAiQa ?? [];
  const auctionSaleComparables =
    currentCase.auctionSaleComparables?.length > 0
      ? currentCase.auctionSaleComparables
      : incomingCase.auctionSaleComparables ?? [];
  const auctionBidAnalysis =
    currentCase.auctionBidAnalysis?.lastResult != null ||
    (currentCase.auctionSaleComparables?.length ?? 0) > 0
      ? currentCase.auctionBidAnalysis
      : incomingCase.auctionBidAnalysis ?? currentCase.auctionBidAnalysis;
  return {
    ...currentCase,
    listTitle:
      currentCase.listTitle?.trim() ||
      incomingCase.listTitle?.trim() ||
      "",
    listColor: currentCase.listColor ?? incomingCase.listColor ?? null,
    listThumbnail: currentCase.listThumbnail ?? incomingCase.listThumbnail ?? null,
    nearbyMarketAnalysis,
    remodeling,
    fieldInspection,
    brokerMarketNotes,
    aiMarketNotes,
    externalAiQa,
    auctionSaleComparables,
    auctionBidAnalysis,
    multiFamilyAnalysis: nearbyMarketAnalysis
      ? {
          ...currentCase.multiFamilyAnalysis,
          rentAskingChecked:
            currentCase.multiFamilyAnalysis.rentAskingChecked ||
            incomingCase.multiFamilyAnalysis.rentAskingChecked ||
            true,
        }
      : currentCase.multiFamilyAnalysis,
  };
}

export function ensureAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return createDefaultAppData();
  const o = raw as AppData;
  if (o.schemaVersion !== SCHEMA_VERSION) {
    if (Array.isArray(o.cases) && o.cases.length > 0) {
      return ensureAppData({ ...o, schemaVersion: SCHEMA_VERSION });
    }
    return createDefaultAppData();
  }
  if (!Array.isArray(o.cases)) {
    return ensureAppData({ ...o, cases: [], schemaVersion: SCHEMA_VERSION });
  }
  const lectureGuideByStep =
    o.lectureGuideByStep && typeof o.lectureGuideByStep === "object"
      ? { ...o.lectureGuideByStep }
      : {};
  const tenantAnalysisSettings =
    o.tenantAnalysisSettings && typeof o.tenantAnalysisSettings === "object"
      ? {
          noDividendRequestGuide:
            typeof o.tenantAnalysisSettings.noDividendRequestGuide === "string" &&
            o.tenantAnalysisSettings.noDividendRequestGuide.trim()
              ? o.tenantAnalysisSettings.noDividendRequestGuide
              : DEFAULT_NO_DIVIDEND_REQUEST_GUIDE,
        }
      : { noDividendRequestGuide: DEFAULT_NO_DIVIDEND_REQUEST_GUIDE };
  const propertyAnalysisSettings = normalizePropertyAnalysisSettings(
    (o as unknown as Record<string, unknown>).propertyAnalysisSettings,
  );
  const pdfCoverSettings = normalizePdfCoverSettings(
    (o as unknown as Record<string, unknown>).pdfCoverSettings,
  );
  const cases = o.cases.map((c) => {
    const cx = c as {
      fieldSurvey?: unknown;
      floor?: unknown;
      householdCount?: unknown;
      roomShapeMix?: unknown;
    };
    const hcRaw = cx.householdCount;
    const householdCount =
      hcRaw === null || hcRaw === undefined
        ? null
        : typeof hcRaw === "number" && Number.isFinite(hcRaw) && hcRaw >= 0
          ? Math.min(99999, Math.floor(hcRaw))
          : null;

    const cAny = c as unknown as Record<string, unknown>;
    const landAreaSqm = normalizeAreaSqm(cAny.landAreaSqm);
    const buildingAreaSqm = normalizeAreaSqm(cAny.buildingAreaSqm);
    const parkingUnitCount = normalizeParkingCount(cAny.parkingUnitCount);
    const residentialUnitCount = normalizeUnitCount(cAny.residentialUnitCount);
    const commercialUnitCount = normalizeUnitCount(cAny.commercialUnitCount);
    const appraisalPrice =
      typeof cAny.appraisalPrice === "number" && Number.isFinite(cAny.appraisalPrice)
        ? Math.round(Math.max(0, cAny.appraisalPrice))
        : null;
    const expectedBidPrice =
      typeof cAny.expectedBidPrice === "number" &&
      Number.isFinite(cAny.expectedBidPrice)
        ? Math.round(Math.max(0, cAny.expectedBidPrice))
        : appraisalPrice != null
          ? Math.round(appraisalPrice * 0.7)
          : null;
    const hasBuildingViolation =
      typeof cAny.hasBuildingViolation === "boolean"
        ? cAny.hasBuildingViolation
        : false;
    const priorityLevel = normalizePriorityLevel(cAny.priorityLevel, cAny.priority);
    const status =
      typeof cAny.status === "string"
        ? (cAny.status as AppData["cases"][number]["status"])
        : "watching";

    return {
      ...c,
      fieldSurvey:
        typeof cx.fieldSurvey === "string" ? cx.fieldSurvey : "",
      floor: typeof cx.floor === "string" ? cx.floor : "",
      householdCount,
      roomShapeMix: normalizeRoomShapeMix(cx.roomShapeMix),
      residentialUnitCount,
      commercialUnitCount,
      buildingUnitComposition: normalizeBuildingUnitComposition(
        cAny.buildingUnitComposition,
      ),
      landAreaSqm,
      buildingAreaSqm,
      parkingUnitCount,
      hasBuildingViolation,
      priorityLevel,
      builtYear:
        typeof cAny.builtYear === "string" ? cAny.builtYear : "",
      buildingCoverageRatio:
        typeof cAny.buildingCoverageRatio === "string"
          ? cAny.buildingCoverageRatio
          : "",
      floorAreaRatio:
        typeof cAny.floorAreaRatio === "string" ? cAny.floorAreaRatio : "",
      lienBaseline:
        typeof cAny.lienBaseline === "string" ? cAny.lienBaseline : "",
      appraisalPrice,
      expectedBidPrice,
      sourceDocuments: normalizeSourceDocuments(cAny.sourceDocuments),
      rentSetting: normalizeRentSetting(
        (c as { rentSetting?: unknown }).rentSetting,
      ),
      multiFamilyAnalysis: normalizeMultiFamilyAnalysis(
        (c as { multiFamilyAnalysis?: unknown }).multiFamilyAnalysis,
      ),
      nearbyMarketAnalysis: normalizeNearbyMarketAnalysis(
        cAny.nearbyMarketAnalysis,
        c as unknown as AppData["cases"][number],
      ),
      brokerMarketNotes: normalizeMarketReferenceNotes(cAny.brokerMarketNotes),
      aiMarketNotes: normalizeMarketReferenceNotes(cAny.aiMarketNotes),
      externalAiQa: normalizeExternalAiQaList(cAny.externalAiQa),
      auctionSaleComparables: normalizeAuctionSaleComparableList(
        cAny.auctionSaleComparables,
      ),
      auctionBidAnalysis: normalizeAuctionBidAnalysis(cAny.auctionBidAnalysis),
      remodeling: normalizeCaseRemodeling(cAny.remodeling),
      fieldInspection: normalizeFieldInspection(cAny.fieldInspection),
      fieldPhotoGallery: normalizeFieldPhotoGallery(cAny.fieldPhotoGallery),
      tenantRecords: normalizeTenantRecords(cAny.tenantRecords),
      addressMeta: normalizeCaseAddressMeta(cAny.addressMeta),
      listTitle: typeof cAny.listTitle === "string" ? cAny.listTitle : "",
      listColor: normalizeCaseListColor(cAny.listColor),
      listThumbnail: normalizeCaseListThumbnail(cAny.listThumbnail),
      casePhase: normalizeCasePhase(cAny.casePhase, status),
      preAuction: normalizePreAuctionWorkflow(cAny.preAuction),
      postAuction: normalizePostAuctionWorkflow(cAny.postAuction),
    };
  });
  const knowledgeNotes = ensureFieldIntelKnowledgeNotes(
    normalizeKnowledgeNotes(o.knowledgeNotes),
  );
  const guMarketCache =
    o.guMarketCache && typeof o.guMarketCache === "object" && !Array.isArray(o.guMarketCache)
      ? (o.guMarketCache as AppData["guMarketCache"])
      : {};

  const oAny = o as unknown as Record<string, unknown>;

  const base: AppData = {
    ...o,
    lectureGuideByStep,
    tenantAnalysisSettings,
    propertyAnalysisSettings,
    pdfCoverSettings,
    cases,
    knowledgeNotes,
    sharedExternalAiQa: normalizeExternalAiQaList(oAny.sharedExternalAiQa),
    sharedAuctionSaleComparables: normalizeAuctionSaleComparableList(
      oAny.sharedAuctionSaleComparables,
    ),
    guMarketCache,
    remodelingPriceCatalog: normalizeRemodelingPriceCatalog(
      (o as unknown as Record<string, unknown>).remodelingPriceCatalog,
    ),
  };
  return compactAppDataForStorage(base);
}

function normalizeKnowledgeNotes(raw: unknown): KnowledgeNote[] {
  if (!Array.isArray(raw)) return [];
  const out: KnowledgeNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    const title = typeof n.title === "string" ? n.title.trim() : "";
    if (!title) continue;
    const id =
      typeof n.id === "string" && n.id.trim()
        ? n.id.trim()
        : `kn-${Date.now()}-${out.length}`;
    const createdAt =
      typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString();
    out.push({
      id,
      category: typeof n.category === "string" ? n.category : "general",
      title,
      body: typeof n.body === "string" ? n.body : "",
      linkedCaseId:
        typeof n.linkedCaseId === "string" && n.linkedCaseId.trim()
          ? n.linkedCaseId.trim()
          : null,
      fieldIntelGuideId:
        typeof n.fieldIntelGuideId === "string" && n.fieldIntelGuideId.trim()
          ? n.fieldIntelGuideId.trim()
          : null,
      createdAt,
      updatedAt:
        typeof n.updatedAt === "string" ? n.updatedAt : createdAt,
    });
  }
  return out;
}

function ensureFieldIntelKnowledgeNotes(notes: KnowledgeNote[]): KnowledgeNote[] {
  if (notes.some((note) => note.fieldIntelGuideId === "daejeon-health")) {
    return notes;
  }
  const t = new Date().toISOString();
  const seeded: KnowledgeNote = {
    ...DEFAULT_FIELD_INTEL_KNOWLEDGE_NOTE,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `kn-field-intel-${Date.now()}`,
    createdAt: t,
    updatedAt: t,
  };
  return [seeded, ...notes];
}

function normalizePropertyAnalysisSettings(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROPERTY_ANALYSIS_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    smallUnitAreaSqm: normalizePositiveNumber(
      o.smallUnitAreaSqm,
      DEFAULT_PROPERTY_ANALYSIS_SETTINGS.smallUnitAreaSqm,
      999,
    ),
    largeBuildingAreaSqm: normalizePositiveNumber(
      o.largeBuildingAreaSqm,
      DEFAULT_PROPERTY_ANALYSIS_SETTINGS.largeBuildingAreaSqm,
      999999,
    ),
    highLandPricePerSqmManwon: normalizePositiveNumber(
      o.highLandPricePerSqmManwon,
      DEFAULT_PROPERTY_ANALYSIS_SETTINGS.highLandPricePerSqmManwon,
      999999,
    ),
  };
}

function normalizePositiveNumber(raw: unknown, fallback: number, max: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.round(Math.min(max, raw) * 100) / 100;
}

function normalizePriorityLevel(raw: unknown, legacy: unknown): PriorityLevel {
  if (
    typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= 1 &&
    raw <= 5
  ) {
    return raw as PriorityLevel;
  }
  const legacyPriority = typeof legacy === "string" ? (legacy as Priority) : "normal";
  if (legacyPriority === "high") return 4;
  if (legacyPriority === "low") return 1;
  return 1;
}

function normalizeRoomShapeMix(raw: unknown): Record<RoomShape, number> {
  const base = emptyRoomShapeMix();
  if (!raw || typeof raw !== "object") return base;
  const ro = raw as Record<string, unknown>;
  for (const k of ROOM_SHAPE_OPTIONS) {
    const v = ro[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      base[k] = Math.min(9999, Math.floor(v));
    }
  }
  return base;
}

function normalizeAreaSqm(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.round(Math.min(1e9, raw) * 100) / 100;
  }
  return null;
}

function normalizeParkingCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(99999, Math.floor(raw));
  }
  return null;
}

function normalizeUnitCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(99999, Math.floor(raw));
  }
  return null;
}

function normalizeBuildingUnitUseType(raw: unknown): BuildingUnitUseType {
  return raw === "residential" || raw === "commercial" || raw === "other"
    ? raw
    : "other";
}

function normalizeBuildingUnitComposition(raw: unknown): BuildingUnitComposition[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const areaSqm = normalizeAreaSqm(o.areaSqm);
    const unitCount = normalizeUnitCount(o.unitCount) ?? 1;
    return [
      {
        id:
          typeof o.id === "string" && o.id.trim()
            ? o.id
            : `building-unit-${index + 1}`,
        floor: typeof o.floor === "string" ? o.floor : "",
        useType: normalizeBuildingUnitUseType(o.useType),
        useLabel: typeof o.useLabel === "string" ? o.useLabel : "",
        areaSqm,
        unitCount,
        source: typeof o.source === "string" ? o.source : "",
      },
    ];
  });
}

function normalizeSourceDocuments(raw: unknown): CaseSourceDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const kind = normalizeSourceDocumentKind(o.kind);
    const importedAt =
      typeof o.importedAt === "string" && o.importedAt.trim()
        ? o.importedAt
        : new Date(0).toISOString();
    return [
      {
        id:
          typeof o.id === "string" && o.id.trim()
            ? o.id
            : `srcdoc-${i + 1}`,
        kind,
        fileName: typeof o.fileName === "string" ? o.fileName : "",
        originalFileName:
          typeof o.originalFileName === "string" ? o.originalFileName : null,
        storedFileName:
          typeof o.storedFileName === "string" ? o.storedFileName : null,
        pdfBlobRef:
          typeof o.pdfBlobRef === "string" ? o.pdfBlobRef : null,
        fileSize:
          typeof o.fileSize === "number" && Number.isFinite(o.fileSize)
            ? Math.max(0, Math.floor(o.fileSize))
            : null,
        pageCount:
          typeof o.pageCount === "number" && Number.isFinite(o.pageCount)
            ? Math.max(0, Math.floor(o.pageCount))
            : null,
        extractedText:
          typeof o.extractedText === "string" ? o.extractedText : "",
        structuredJson:
          o.structuredJson === undefined ? null : o.structuredJson,
        parserVersion:
          typeof o.parserVersion === "string" && o.parserVersion.trim()
            ? o.parserVersion
            : "unknown",
        importedAt,
      },
    ];
  });
}

function normalizeSourceDocumentKind(raw: unknown): CaseSourceDocumentKind {
  if (raw === "auctionone-pdf") return "speedauction-pdf";
  return raw === "daejangauction-pdf" ||
    raw === "speedauction-pdf" ||
    raw === "registry-building" ||
    raw === "registry-land" ||
    raw === "building-ledger" ||
    raw === "appraisal-report" ||
    raw === "tenant-report" ||
    raw === "expected-dividend" ||
    raw === "json"
    ? raw
    : "pdf";
}
