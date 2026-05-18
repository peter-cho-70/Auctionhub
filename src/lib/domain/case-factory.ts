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
    priorityLevel: 1,
    priority: input.priority ?? "normal",
    fieldSurvey: input.fieldSurvey?.trim() ?? "",
    memo: input.memo ?? "",
    sourceDocuments: input.sourceDocuments ?? [],
    rentSetting: emptyRentSetting(),
    multiFamilyAnalysis: emptyMultiFamilyAnalysis(),
    nearbyMarketAnalysis: null,
    checklists: buildCaseChecklistsFromTemplates(data),
    decision: { ...EMPTY_DECISION },
  };
  return c;
}
