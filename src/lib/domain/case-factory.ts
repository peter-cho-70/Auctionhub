import type {
  AppData,
  AuctionCase,
  CaseSourceDocument,
  CaseStatus,
  RoomShape,
} from "@/lib/types/domain";
import { EMPTY_DECISION, emptyRoomShapeMix } from "@/lib/types/domain";
import { buildCaseChecklistsFromTemplates } from "@/lib/domain/checklists";
import { parseAuctionUrl } from "@/lib/domain/url-parser";
import { estimateNextMinPrice } from "@/lib/domain/finance";
import { emptyRentSetting } from "@/lib/domain/rent-setting";
import { emptyMultiFamilyAnalysis } from "@/lib/domain/multifamily-analysis";
import { emptyFieldInspection } from "@/lib/domain/field-inspection";
import { emptyFieldPhotoGallery, normalizeFieldPhotoGallery } from "@/lib/domain/field-photo-gallery";
import { normalizeTenantRecords } from "@/lib/domain/case-tenant-records";
import { emptyCaseRemodeling } from "@/lib/domain/remodeling";
import {
  emptyAuctionBidAnalysis,
} from "@/lib/domain/auction-bid-analysis";
import {
  emptyPostAuctionWorkflow,
  emptyPreAuctionWorkflow,
  inferCasePhaseFromStatus,
} from "@/lib/domain/case-workflow";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface NewCaseInput {
  sourceUrl: string;
  caseNumber?: string;
  address?: string;
  addressMeta?: AuctionCase["addressMeta"];
  propertyType?: string;
  builtYear?: string;
  floor?: string;
  householdCount?: number | null;
  roomShapeMix?: Record<RoomShape, number>;
  appraisalPrice?: number | null;
  minPrice?: number | null;
  expectedBidPrice?: number | null;
  bidDate?: string | null;
  priority?: AuctionCase["priority"];
  fieldSurvey?: string;
  memo?: string;
  landAreaSqm?: number | null;
  buildingAreaSqm?: number | null;
  parkingUnitCount?: number | null;
  hasBuildingViolation?: boolean;
  buildingCoverageRatio?: string;
  floorAreaRatio?: string;
  lienBaseline?: string;
  listTitle?: string;
  sourceDocuments?: CaseSourceDocument[];
  initialStatus?: CaseStatus;
}

export function createAuctionCase(
  data: AppData,
  input: NewCaseInput,
): AuctionCase {
  const parsed = parseAuctionUrl(input.sourceUrl);
  const now = new Date().toISOString();
  const minPrice = input.minPrice ?? null;
  const c: AuctionCase = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    sourceUrl: parsed.normalizedUrl || input.sourceUrl.trim(),
    caseNumber: input.caseNumber?.trim() || parsed.caseNumber,
    address: input.address?.trim() || parsed.address,
    listTitle: input.listTitle?.trim() ?? "",
    listColor: null,
    listThumbnail: null,
    addressMeta: input.addressMeta ?? null,
    propertyType: input.propertyType?.trim() || "",
    builtYear: input.builtYear?.trim() ?? "",
    floor: input.floor?.trim() ?? "",
    householdCount:
      input.householdCount === undefined ? null : input.householdCount,
    roomShapeMix: input.roomShapeMix
      ? { ...emptyRoomShapeMix(), ...input.roomShapeMix }
      : emptyRoomShapeMix(),
    residentialUnitCount: null,
    commercialUnitCount: null,
    buildingUnitComposition: [],
    landAreaSqm:
      input.landAreaSqm === undefined ? null : input.landAreaSqm,
    buildingAreaSqm:
      input.buildingAreaSqm === undefined ? null : input.buildingAreaSqm,
    parkingUnitCount:
      input.parkingUnitCount === undefined ? null : input.parkingUnitCount,
    hasBuildingViolation: input.hasBuildingViolation === true,
    buildingCoverageRatio: input.buildingCoverageRatio?.trim() ?? "",
    floorAreaRatio: input.floorAreaRatio?.trim() ?? "",
    lienBaseline: input.lienBaseline?.trim() ?? "",
    appraisalPrice:
      input.appraisalPrice === undefined ? null : input.appraisalPrice,
    minPrice,
    expectedBidPrice:
      input.expectedBidPrice === undefined
        ? input.appraisalPrice != null
          ? Math.round(input.appraisalPrice * 0.7)
          : null
        : input.expectedBidPrice,
    bidDate: input.bidDate ?? null,
    currentRound: 1,
    bidRounds: [],
    nextExpectedMinPrice:
      minPrice != null ? estimateNextMinPrice(minPrice) : null,
    wonDayActionsCompleted: false,
    status: input.initialStatus ?? "watching",
    casePhase: inferCasePhaseFromStatus(input.initialStatus ?? "watching"),
    preAuction: emptyPreAuctionWorkflow(),
    postAuction: emptyPostAuctionWorkflow(),
    priorityLevel: 1,
    priority: input.priority ?? "normal",
    fieldSurvey: input.fieldSurvey?.trim() ?? "",
    fieldInspection: emptyFieldInspection(),
    fieldPhotoGallery: emptyFieldPhotoGallery(),
    tenantRecords: [],
    memo: input.memo ?? "",
    sourceDocuments: input.sourceDocuments ?? [],
    rentSetting: emptyRentSetting(),
    multiFamilyAnalysis: emptyMultiFamilyAnalysis(),
    nearbyMarketAnalysis: null,
    brokerMarketNotes: [],
    aiMarketNotes: [],
    externalAiQa: [],
    auctionSaleComparables: [],
    auctionBidAnalysis: emptyAuctionBidAnalysis(),
    remodeling: emptyCaseRemodeling(),
    checklists: buildCaseChecklistsFromTemplates(data),
    decision: { ...EMPTY_DECISION },
  };
  return c;
}
