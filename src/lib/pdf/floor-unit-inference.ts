import type { BuildingUnitComposition, BuildingUnitUseType } from "@/lib/types/domain";

export function parseUnitCountFromUseLabel(useLabel: string): number {
  const m = useLabel.match(/(\d+)\s*개호/);
  if (m) return Math.max(1, parseInt(m[1]!, 10));
  const ho = useLabel.match(/(\d+)\s*호/);
  if (ho) return Math.max(1, parseInt(ho[1]!, 10));
  return 1;
}

export function classifyUseLabel(useLabel: string): BuildingUnitUseType {
  if (/근린|상가|점포|소매|사무|의원|음식|근린생활/.test(useLabel)) {
    return "commercial";
  }
  if (/주택|다가구|다중|도시형|원룸|공동주택|주거/.test(useLabel)) {
    return "residential";
  }
  return "other";
}

export type FloorUnitInference = {
  residentialUnits: number;
  commercialUnits: number;
  totalUnits: number;
  composition: BuildingUnitComposition[];
};

export function inferUnitsFromAppraisalFloors(
  floors: unknown[],
  source = "auction-pdf",
): FloorUnitInference {
  const composition: BuildingUnitComposition[] = [];
  let residentialUnits = 0;
  let commercialUnits = 0;

  floors.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const useLabel = String(row.useType ?? row.use_type ?? "").trim();
    if (!useLabel) return;
    const useType = classifyUseLabel(useLabel);
    const unitCount = parseUnitCountFromUseLabel(useLabel);
    const areaRaw = row.areaSqm ?? row.area_sqm;
    const areaSqm =
      typeof areaRaw === "number" && Number.isFinite(areaRaw) ? areaRaw : null;
    const floor = String(row.floor ?? "").trim() || `${index + 1}층`;

    composition.push({
      id: `auction-floor-${index + 1}`,
      floor,
      useType,
      useLabel,
      areaSqm,
      unitCount,
      source,
    });

    if (useType === "residential") residentialUnits += unitCount;
    else if (useType === "commercial") commercialUnits += unitCount;
  });

  return {
    residentialUnits,
    commercialUnits,
    totalUnits: residentialUnits + commercialUnits,
    composition,
  };
}

export function sumHouseholdFromText(rawText: string): number | null {
  let sum = 0;
  for (const m of rawText.matchAll(/(\d+)\s*개호/g)) {
    sum += parseInt(m[1]!, 10);
  }
  return sum > 0 ? sum : null;
}

export function parseParkingFromText(rawText: string): number | null {
  const patterns = [
    /(?:총|합계)?\s*주차\s*(?:대수|장)?\s*[:：]?\s*(\d+)/,
    /주차\s*(\d+)\s*대/,
    /주차장\s*[:：]?\s*(\d+)/,
    /옥(?:내|외)?\s*주차[^\d]*(\d+)/,
  ];
  for (const re of patterns) {
    const m = rawText.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

export function parseCoverageRatiosFromText(rawText: string): {
  buildingCoveragePct: number | null;
  floorAreaPct: number | null;
} {
  const buildingCoveragePct = (() => {
    const m =
      rawText.match(/건\s*폐\s*율\s*[:：]?\s*([\d,.]+)\s*%/) ??
      rawText.match(/건폐율\s*[:：]?\s*([\d,.]+)\s*%/);
    if (!m?.[1]) return null;
    const n = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  })();

  const floorAreaPct = (() => {
    const m =
      rawText.match(/용\s*적\s*률\s*[:：]?\s*([\d,.]+)\s*%/) ??
      rawText.match(/용적률?\s*[:：]?\s*([\d,.]+)\s*%/);
    if (!m?.[1]) return null;
    const n = Number(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  })();

  return { buildingCoveragePct, floorAreaPct };
}
