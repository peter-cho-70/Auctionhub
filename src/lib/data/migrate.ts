import type { AppData } from "@/lib/types/domain";
import {
  SCHEMA_VERSION,
  ROOM_SHAPE_OPTIONS,
  emptyRoomShapeMix,
  type RoomShape,
} from "@/lib/types/domain";
import { createDefaultAppData } from "@/lib/data/default-data";
import {
  normalizeRentSetting,
} from "@/lib/domain/rent-setting";

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
  const caseIds = new Set(current.cases.map((c) => c.id));
  const mergedCases = [...current.cases];
  for (const c of incoming.cases) {
    if (!caseIds.has(c.id)) mergedCases.push(c);
  }
  const noteIds = new Set(current.knowledgeNotes.map((n) => n.id));
  const mergedNotes = [...current.knowledgeNotes];
  for (const n of incoming.knowledgeNotes) {
    if (!noteIds.has(n.id)) mergedNotes.push(n);
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
    processStepOrder: incoming.processStepOrder.length
      ? incoming.processStepOrder
      : current.processStepOrder,
    cases: mergedCases,
    knowledgeNotes: mergedNotes,
  };
}

export function ensureAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") return createDefaultAppData();
  const o = raw as AppData;
  if (o.schemaVersion !== SCHEMA_VERSION) return createDefaultAppData();
  if (!Array.isArray(o.cases)) return createDefaultAppData();
  const lectureGuideByStep =
    o.lectureGuideByStep && typeof o.lectureGuideByStep === "object"
      ? { ...o.lectureGuideByStep }
      : {};
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
    const hasBuildingViolation =
      typeof cAny.hasBuildingViolation === "boolean"
        ? cAny.hasBuildingViolation
        : false;

    return {
      ...c,
      fieldSurvey:
        typeof cx.fieldSurvey === "string" ? cx.fieldSurvey : "",
      floor: typeof cx.floor === "string" ? cx.floor : "",
      householdCount,
      roomShapeMix: normalizeRoomShapeMix(cx.roomShapeMix),
      landAreaSqm,
      buildingAreaSqm,
      parkingUnitCount,
      hasBuildingViolation,
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
      rentSetting: normalizeRentSetting(
        (c as { rentSetting?: unknown }).rentSetting,
      ),
    };
  });
  return { ...o, lectureGuideByStep, cases };
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
