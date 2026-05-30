import type { AuctionCase, CaseSourceDocument } from "@/lib/types/domain";

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function textValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) {
    return v.toLocaleString("ko-KR");
  }
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return "";
}

export function numberValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function arrayRecords(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.map(asRecord).filter((x): x is Record<string, unknown> => x != null);
}

export function getAuctionCasePayload(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  return asRecord(root.auction_case) ?? root;
}

export function getDocumentPayload(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  return asRecord(root.document);
}

export function getDocumentAnalysisPayload(doc: CaseSourceDocument): {
  tenants: Record<string, unknown> | null;
  buildingRegistry: Record<string, unknown> | null;
  landRegistry: Record<string, unknown> | null;
  sourcePayload: Record<string, unknown> | null;
} {
  const auctionCase = getAuctionCasePayload(doc.structuredJson);
  const document = getDocumentPayload(doc.structuredJson);
  const registry = asRecord(document?.registry);
  const tenantsRaw = auctionCase?.tenants ?? document?.tenants;
  const tenantsObj = asRecord(tenantsRaw);
  return {
    tenants:
      tenantsObj ??
      (Array.isArray(tenantsRaw) ? { list: tenantsRaw } : null),
    buildingRegistry:
      asRecord(auctionCase?.building_registry) ??
      (doc.kind === "registry-building" ? registry : null),
    landRegistry:
      asRecord(auctionCase?.land_registry) ??
      (doc.kind === "registry-land" ? registry : null),
    sourcePayload: auctionCase,
  };
}

/** 물건에 등록된 PDF 중 가장 풍부한 auction_case 페이로드 */
export function getPrimaryAuctionPayload(c: AuctionCase): Record<string, unknown> | null {
  for (const doc of c.sourceDocuments) {
    const p = getDocumentAnalysisPayload(doc).sourcePayload;
    if (p) return p;
  }
  return null;
}

export function tenantRowsFromCase(c: AuctionCase): Record<string, unknown>[] {
  for (const doc of c.sourceDocuments) {
    const { tenants } = getDocumentAnalysisPayload(doc);
    if (!tenants) continue;
    const list = tenants.list;
    if (Array.isArray(list)) return arrayRecords(list);
    if (Array.isArray(tenants)) return arrayRecords(tenants);
  }
  return [];
}

export function registryRightsFromCase(
  c: AuctionCase,
  kind: "building" | "land",
): Record<string, unknown>[] {
  for (const doc of c.sourceDocuments) {
    const { buildingRegistry, landRegistry } = getDocumentAnalysisPayload(doc);
    const reg = kind === "building" ? buildingRegistry : landRegistry;
    if (!reg) continue;
    const rights = reg.rights;
    if (Array.isArray(rights)) return arrayRecords(rights);
  }
  return [];
}

export function caseMapCoords(c: AuctionCase): { lat: number | null; lng: number | null } {
  const m = c.nearbyMarketAnalysis;
  if (m?.lat != null && m?.lng != null) return { lat: m.lat, lng: m.lng };
  const meta = c.addressMeta;
  if (meta?.entY && meta?.entX) {
    const lat = Number(meta.entY);
    const lng = Number(meta.entX);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const anchor = c.auctionBidAnalysis?.anchor;
  if (anchor?.lat != null && anchor?.lng != null) {
    return { lat: anchor.lat, lng: anchor.lng };
  }
  return { lat: null, lng: null };
}
