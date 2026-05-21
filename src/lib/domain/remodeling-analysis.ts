import {
  catalogItemsForScenario,
  costLineFromCatalogItem,
  rentUpliftForRoomType,
} from "@/lib/domain/remodeling-catalog";
import { DEFAULT_REMODELING_PRICE_CATALOG } from "@/lib/domain/remodeling-catalog-daejeon";
import type {
  AuctionCase,
  CaseRemodeling,
  RemodelingCostLine,
  RemodelingPriceCatalog,
  RemodelingRoomProfile,
  RemodelingRoomUnitType,
  RemodelingScenarioPlan,
  RemodelingScenarioTier,
  UnitRemodelingAssignment,
} from "@/lib/types/domain";

export const SCENARIO_TIERS: RemodelingScenarioTier[] = [
  "minimal",
  "balanced",
  "full",
];

export const ROOM_PROFILE_DEFS: {
  profileKey: string;
  roomUnitType: RemodelingRoomUnitType;
  label: string;
}[] = [
  { profileKey: "one_room", roomUnitType: "one_room", label: "원룸형" },
  { profileKey: "one_half_room", roomUnitType: "one_half_room", label: "1.5룸형" },
  { profileKey: "two_room", roomUnitType: "two_room", label: "투룸 이상" },
  { profileKey: "owner", roomUnitType: "owner", label: "주인세대" },
  { profileKey: "unknown", roomUnitType: "unknown", label: "미분류" },
];

export type RemodelingCostBreakdown = {
  materialManwon: number;
  laborManwon: number;
  diyLaborSavedManwon: number;
  totalManwon: number;
  monthlyRentUpliftManwon: number;
  selectedLineCount: number;
};

export type RemodelingScenarioTotals = RemodelingCostBreakdown & {
  tier: RemodelingScenarioTier;
  unitCountApplied: number;
  unitCountTotal: number;
  profileTotals: {
    profileKey: string;
    label: string;
    unitCount: number;
    perUnit: RemodelingCostBreakdown;
    subtotal: RemodelingCostBreakdown;
  }[];
  building: RemodelingCostBreakdown;
  paybackYears: number | null;
};

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inferRoomUnitTypeFromRentLabel(roomType: string): RemodelingRoomUnitType {
  const t = roomType.replace(/\s/g, "").toLowerCase();
  if (/1\.5|1\.5룸|원룸반|투룸반/.test(t)) return "one_half_room";
  if (/투룸|2룸|쓰리|3룸|four|4룸/.test(t)) return "two_room";
  if (/원룸|one|1룸|오피스텔/.test(t)) return "one_room";
  if (/주인|사장|점주|owner/.test(t)) return "owner";
  return "unknown";
}

export function profileKeyForRoomType(roomType: RemodelingRoomUnitType): string {
  return ROOM_PROFILE_DEFS.find((d) => d.roomUnitType === roomType)?.profileKey ?? "unknown";
}

export function applyCatalogPricesToLine(
  line: RemodelingCostLine,
  catalog: RemodelingPriceCatalog,
): RemodelingCostLine {
  if (!line.catalogKey) return line;
  const item = catalog.items.find((i) => i.key === line.catalogKey);
  if (!item) return line;
  return {
    ...line,
    item: item.item,
    materialManwon: item.materialManwon,
    laborManwon: item.laborManwon,
    diy: item.diy,
    workScope: item.workScope,
    effectNote: item.effectNote,
  };
}

export function applyCatalogPricesToLines(
  lines: RemodelingCostLine[],
  catalog: RemodelingPriceCatalog,
): RemodelingCostLine[] {
  return lines.map((line) => applyCatalogPricesToLine(line, catalog));
}

/** 시나리오 포함 항목은 기본 체크(selected) */
export function buildProfileCostLines(
  catalog: RemodelingPriceCatalog,
  tier: RemodelingScenarioTier,
  roomType: RemodelingRoomUnitType,
  existing?: RemodelingCostLine[],
): RemodelingCostLine[] {
  const items = catalogItemsForScenario(catalog, tier, { buildingOnly: false });
  const existingByKey = new Map(
    (existing ?? [])
      .filter((l) => l.catalogKey)
      .map((l) => [l.catalogKey!, l]),
  );
  const lines: RemodelingCostLine[] = items.map((item) => {
    const prev = existingByKey.get(item.key);
    const line = costLineFromCatalogItem(item, true);
    const uplift = rentUpliftForRoomType(item, roomType);
    if (prev) {
      return applyCatalogPricesToLine(
        {
          ...line,
          id: prev.id,
          selected: prev.selected,
          rentUpliftManwon:
            uplift > 0 ? uplift : (prev.rentUpliftManwon ?? line.rentUpliftManwon),
        },
        catalog,
      );
    }
    return { ...line, rentUpliftManwon: uplift > 0 ? uplift : null };
  });
  for (const prev of existing ?? []) {
    if (!prev.catalogKey || existingByKey.has(prev.catalogKey)) continue;
    if (items.some((i) => i.key === prev.catalogKey)) continue;
    lines.push(applyCatalogPricesToLine(prev, catalog));
  }
  return lines;
}

export function buildBuildingCostLines(
  catalog: RemodelingPriceCatalog,
  tier: RemodelingScenarioTier,
  existing?: RemodelingCostLine[],
): RemodelingCostLine[] {
  const items = catalogItemsForScenario(catalog, tier, { buildingOnly: true });
  const existingByKey = new Map(
    (existing ?? [])
      .filter((l) => l.catalogKey)
      .map((l) => [l.catalogKey!, l]),
  );
  return items.map((item) => {
    const prev = existingByKey.get(item.key);
    const line = costLineFromCatalogItem(item, true);
    if (prev) {
      return applyCatalogPricesToLine(
        { ...line, id: prev.id, selected: prev.selected },
        catalog,
      );
    }
    return line;
  });
}

export function breakdownFromLines(lines: RemodelingCostLine[]): RemodelingCostBreakdown {
  let materialManwon = 0;
  let laborManwon = 0;
  let diyLaborSavedManwon = 0;
  let monthlyRentUpliftManwon = 0;
  let selectedLineCount = 0;
  for (const line of lines) {
    if (!line.selected) continue;
    selectedLineCount += 1;
    const m = line.materialManwon ?? 0;
    const l = line.laborManwon ?? 0;
    materialManwon += m;
    if (line.diy) {
      diyLaborSavedManwon += l;
    } else {
      laborManwon += l;
    }
    monthlyRentUpliftManwon += line.rentUpliftManwon ?? 0;
  }
  return {
    materialManwon,
    laborManwon,
    diyLaborSavedManwon,
    totalManwon: materialManwon + laborManwon,
    monthlyRentUpliftManwon,
    selectedLineCount,
  };
}

function addBreakdown(
  a: RemodelingCostBreakdown,
  b: RemodelingCostBreakdown,
): RemodelingCostBreakdown {
  return {
    materialManwon: a.materialManwon + b.materialManwon,
    laborManwon: a.laborManwon + b.laborManwon,
    diyLaborSavedManwon: a.diyLaborSavedManwon + b.diyLaborSavedManwon,
    totalManwon: a.totalManwon + b.totalManwon,
    monthlyRentUpliftManwon: a.monthlyRentUpliftManwon + b.monthlyRentUpliftManwon,
    selectedLineCount: a.selectedLineCount + b.selectedLineCount,
  };
}

function scaleBreakdown(
  b: RemodelingCostBreakdown,
  count: number,
): RemodelingCostBreakdown {
  if (count <= 0) {
    return {
      materialManwon: 0,
      laborManwon: 0,
      diyLaborSavedManwon: 0,
      totalManwon: 0,
      monthlyRentUpliftManwon: 0,
      selectedLineCount: 0,
    };
  }
  return {
    materialManwon: b.materialManwon * count,
    laborManwon: b.laborManwon * count,
    diyLaborSavedManwon: b.diyLaborSavedManwon * count,
    totalManwon: b.totalManwon * count,
    monthlyRentUpliftManwon: b.monthlyRentUpliftManwon * count,
    selectedLineCount: b.selectedLineCount,
  };
}

export function countAssignmentsByRoomType(
  assignments: UnitRemodelingAssignment[],
  options?: { appliedOnly?: boolean },
): Record<RemodelingRoomUnitType, number> {
  const counts: Record<RemodelingRoomUnitType, number> = {
    one_room: 0,
    one_half_room: 0,
    two_room: 0,
    owner: 0,
    unknown: 0,
  };
  for (const a of assignments) {
    if (options?.appliedOnly && !a.apply) continue;
    counts[a.roomUnitType] = (counts[a.roomUnitType] ?? 0) + 1;
  }
  return counts;
}

export function computeScenarioTotals(
  catalog: RemodelingPriceCatalog,
  scenario: RemodelingScenarioPlan,
  assignments: UnitRemodelingAssignment[],
  options?: { appliedOnly?: boolean },
): RemodelingScenarioTotals {
  const appliedOnly = options?.appliedOnly ?? false;
  const counts = countAssignmentsByRoomType(assignments, { appliedOnly });
  const buildingLines = applyCatalogPricesToLines(
    scenario.buildingCostLines,
    catalog,
  );
  const building = breakdownFromLines(buildingLines);

  let aggregate: RemodelingCostBreakdown = {
    materialManwon: 0,
    laborManwon: 0,
    diyLaborSavedManwon: 0,
    totalManwon: 0,
    monthlyRentUpliftManwon: 0,
    selectedLineCount: 0,
  };

  const profileTotals = scenario.roomProfiles.map((profile) => {
    const lines = applyCatalogPricesToLines(profile.costLines, catalog);
    const perUnit = breakdownFromLines(lines);
    const unitCount = counts[profile.roomUnitType] ?? 0;
    const subtotal = scaleBreakdown(perUnit, unitCount);
    aggregate = addBreakdown(aggregate, subtotal);
    return {
      profileKey: profile.profileKey,
      label: profile.label,
      unitCount,
      perUnit,
      subtotal,
    };
  });

  aggregate = addBreakdown(aggregate, building);

  const unitCountApplied = assignments.filter((a) => a.apply).length;
  const unitCountTotal = assignments.length;

  const annualRentManwon = aggregate.monthlyRentUpliftManwon * 12;
  const paybackYears =
    aggregate.totalManwon > 0 && annualRentManwon > 0
      ? Math.round((aggregate.totalManwon / annualRentManwon) * 10) / 10
      : null;

  return {
    tier: scenario.tier,
    ...aggregate,
    unitCountApplied,
    unitCountTotal,
    profileTotals,
    building,
    paybackYears,
  };
}

export function createDefaultScenarioPlan(
  tier: RemodelingScenarioTier,
  catalog: RemodelingPriceCatalog = DEFAULT_REMODELING_PRICE_CATALOG,
  existing?: RemodelingScenarioPlan,
): RemodelingScenarioPlan {
  return {
    tier,
    roomProfiles: ROOM_PROFILE_DEFS.map((def) => {
      const prev = existing?.roomProfiles.find(
        (p) => p.profileKey === def.profileKey,
      );
      return {
        profileKey: def.profileKey,
        roomUnitType: def.roomUnitType,
        label: def.label,
        costLines: buildProfileCostLines(
          catalog,
          tier,
          def.roomUnitType,
          prev?.costLines,
        ),
        memo: prev?.memo ?? "",
      };
    }),
    buildingCostLines: buildBuildingCostLines(
      catalog,
      tier,
      existing?.buildingCostLines,
    ),
    memo: existing?.memo ?? "",
  };
}

export function createEmptyAssignment(
  unitLabel: string,
  roomUnitType: RemodelingRoomUnitType = "unknown",
): UnitRemodelingAssignment {
  const key = unitLabel.trim() || newId("unit");
  return {
    unitKey: key,
    unitLabel: unitLabel.trim() || "호실 미상",
    roomUnitType,
    apply: false,
    profileKey: profileKeyForRoomType(roomUnitType),
    scenarioTier: null,
    occupancy: "unknown",
    memo: "",
    completed: false,
  };
}

export function syncAssignmentsFromCase(
  existing: UnitRemodelingAssignment[],
  caseData: AuctionCase,
): UnitRemodelingAssignment[] {
  const byKey = new Map(existing.map((a) => [a.unitKey, a]));
  const next: UnitRemodelingAssignment[] = [];

  for (const row of caseData.rentSetting.unitRows) {
    const parts = [row.floor, row.unitNo].map((p) => p.trim()).filter(Boolean);
    const label = parts.length > 0 ? parts.join(" ") : "";
    if (!label) continue;
    const roomType = inferRoomUnitTypeFromRentLabel(row.roomType);
    const found = byKey.get(label);
    if (found) {
      next.push(found);
      continue;
    }
    next.push(createEmptyAssignment(label, roomType));
  }

  for (const a of existing) {
    if (!next.some((n) => n.unitKey === a.unitKey)) next.push(a);
  }

  return next.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "ko"));
}

export function refreshAllScenariosFromCatalog(
  remodeling: CaseRemodeling,
  catalog: RemodelingPriceCatalog,
): CaseRemodeling {
  return {
    ...remodeling,
    scenarios: SCENARIO_TIERS.map((tier) => {
      const existing = remodeling.scenarios.find((s) => s.tier === tier);
      return createDefaultScenarioPlan(tier, catalog, existing);
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function syncCatalogToRemodeling(
  remodeling: CaseRemodeling,
  catalog: RemodelingPriceCatalog,
): CaseRemodeling {
  return {
    ...remodeling,
    scenarios: remodeling.scenarios.map((scenario) => ({
      ...scenario,
      roomProfiles: scenario.roomProfiles.map((profile) => ({
        ...profile,
        costLines: applyCatalogPricesToLines(profile.costLines, catalog),
      })),
      buildingCostLines: applyCatalogPricesToLines(
        scenario.buildingCostLines,
        catalog,
      ),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function caseRemodelingAnalysis(
  remodeling: CaseRemodeling,
  catalog: RemodelingPriceCatalog,
) {
  const scenarios = SCENARIO_TIERS.map((tier) => {
    const plan =
      remodeling.scenarios.find((s) => s.tier === tier) ??
      createDefaultScenarioPlan(tier, catalog);
    return {
      plan,
      totals: computeScenarioTotals(catalog, plan, remodeling.unitAssignments),
      totalsApplied: computeScenarioTotals(catalog, plan, remodeling.unitAssignments, {
        appliedOnly: true,
      }),
    };
  });
  const active =
    scenarios.find((s) => s.plan.tier === remodeling.activeScenarioTier) ??
    scenarios[0]!;
  return {
    scenarios,
    active,
    assignments: remodeling.unitAssignments,
  };
}
