import {
  inferUnitsFromAppraisalFloors,
  parseCoverageRatiosFromText,
  parseParkingFromText,
  sumHouseholdFromText,
} from "@/lib/pdf/floor-unit-inference";
import type { SpeedAuctionFloor } from "@/lib/pdf/auction-pdf-parser";

export function enrichAuctionExtractMetrics(args: {
  rawText: string;
  buildingFloors: SpeedAuctionFloor[];
  tenantRowCount: number;
}): {
  parkingUnitCount: number | null;
  buildingCoverageRatioPct: number | null;
  floorAreaRatioPct: number | null;
  householdCountHint: number | null;
  residentialUnitHint: number | null;
  commercialUnitHint: number | null;
} {
  const parkingUnitCount = parseParkingFromText(args.rawText);
  const { buildingCoveragePct, floorAreaPct } =
    parseCoverageRatiosFromText(args.rawText);

  const fromFloors = inferUnitsFromAppraisalFloors(
    args.buildingFloors.map((f) => ({
      floor: f.floor,
      useType: f.useType,
      area_sqm: f.areaSqm,
    })),
  );
  const fromText = sumHouseholdFromText(args.rawText);

  const householdCountHint = Math.max(
    args.tenantRowCount,
    fromFloors.totalUnits,
    fromText ?? 0,
  );

  return {
    parkingUnitCount,
    buildingCoverageRatioPct: buildingCoveragePct,
    floorAreaRatioPct: floorAreaPct,
    householdCountHint: householdCountHint > 0 ? householdCountHint : null,
    residentialUnitHint:
      fromFloors.residentialUnits > 0 ? fromFloors.residentialUnits : null,
    commercialUnitHint:
      fromFloors.commercialUnits > 0 ? fromFloors.commercialUnits : null,
  };
}
