import { normalizeStoredManwon } from "@/lib/format/manwon";
import type {
  RemodelingIdealReference,
  RemodelingPriceCatalog,
  RemodelingReferencePhoto,
  RemodelingReferenceZone,
} from "@/lib/types/domain";

export const REMODELING_REFERENCE_ZONES: RemodelingReferenceZone[] = [
  "overview",
  "entrance",
  "living",
  "bathroom",
  "bedroom",
  "other",
];

export const REMODELING_REFERENCE_ZONE_LABEL: Record<
  RemodelingReferenceZone,
  string
> = {
  overview: "전체",
  entrance: "입구",
  living: "거실",
  bathroom: "화장실",
  bedroom: "방",
  other: "기타",
};

export const MAX_REFERENCE_PHOTOS_PER_ZONE = 8;

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `rrp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeZone(raw: unknown): RemodelingReferenceZone {
  return typeof raw === "string" &&
    (REMODELING_REFERENCE_ZONES as string[]).includes(raw)
    ? (raw as RemodelingReferenceZone)
    : "other";
}

export function emptyIdealReference(): RemodelingIdealReference {
  return {
    title: "목표 다가구 인테리어",
    summary: "",
    globalConstructionNotes: "",
    photos: [],
  };
}

function normalizePhoto(raw: unknown): RemodelingReferencePhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId();
  const imageRef =
    typeof o.imageRef === "string" && o.imageRef.trim()
      ? o.imageRef.trim()
      : id;
  const linked = Array.isArray(o.linkedCatalogKeys)
    ? o.linkedCatalogKeys.filter((k): k is string => typeof k === "string")
    : [];
  const est =
    typeof o.estimatedCostManwon === "number" &&
    Number.isFinite(o.estimatedCostManwon)
      ? normalizeStoredManwon(o.estimatedCostManwon)
      : null;
  const now = new Date().toISOString();
  return {
    id,
    zone: normalizeZone(o.zone),
    caption: typeof o.caption === "string" ? o.caption : "",
    constructionMethod:
      typeof o.constructionMethod === "string" ? o.constructionMethod : "",
    linkedCatalogKeys: linked,
    estimatedCostManwon: est,
    imageRef,
    mimeType:
      typeof o.mimeType === "string" && o.mimeType.trim()
        ? o.mimeType
        : "image/jpeg",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}

export function normalizeIdealReference(raw: unknown): RemodelingIdealReference {
  const base = emptyIdealReference();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const photos = Array.isArray(o.photos)
    ? o.photos
        .map((p) => normalizePhoto(p))
        .filter((p): p is RemodelingReferencePhoto => p != null)
    : [];
  return {
    title:
      typeof o.title === "string" && o.title.trim()
        ? o.title.trim()
        : base.title,
    summary: typeof o.summary === "string" ? o.summary : "",
    globalConstructionNotes:
      typeof o.globalConstructionNotes === "string"
        ? o.globalConstructionNotes
        : "",
    photos,
  };
}

export function catalogItemCostManwon(
  catalog: RemodelingPriceCatalog,
  catalogKey: string,
): number {
  const item = catalog.items.find((i) => i.key === catalogKey);
  if (!item) return 0;
  return item.materialManwon + item.laborManwon;
}

export function photoLinkedCatalogCostManwon(
  catalog: RemodelingPriceCatalog,
  photo: RemodelingReferencePhoto,
): number {
  return photo.linkedCatalogKeys.reduce(
    (sum, key) => sum + catalogItemCostManwon(catalog, key),
    0,
  );
}

export function photoTotalCostManwon(
  catalog: RemodelingPriceCatalog,
  photo: RemodelingReferencePhoto,
): number {
  const linked = photoLinkedCatalogCostManwon(catalog, photo);
  const manual = photo.estimatedCostManwon ?? 0;
  return linked + manual;
}

export function idealReferenceCostSummary(
  catalog: RemodelingPriceCatalog,
  ref: RemodelingIdealReference,
): {
  photoCount: number;
  linkedCatalogManwon: number;
  manualManwon: number;
  totalManwon: number;
  byZone: Record<RemodelingReferenceZone, number>;
} {
  const byZone = Object.fromEntries(
    REMODELING_REFERENCE_ZONES.map((z) => [z, 0]),
  ) as Record<RemodelingReferenceZone, number>;
  let linkedCatalogManwon = 0;
  let manualManwon = 0;
  for (const photo of ref.photos) {
    const linked = photoLinkedCatalogCostManwon(catalog, photo);
    const manual = photo.estimatedCostManwon ?? 0;
    linkedCatalogManwon += linked;
    manualManwon += manual;
    byZone[photo.zone] += linked + manual;
  }
  return {
    photoCount: ref.photos.length,
    linkedCatalogManwon,
    manualManwon,
    totalManwon: linkedCatalogManwon + manualManwon,
    byZone,
  };
}

export function createReferencePhoto(
  zone: RemodelingReferenceZone,
  mimeType: string,
): RemodelingReferencePhoto {
  const now = new Date().toISOString();
  const id = newId();
  return {
    id,
    zone,
    caption: "",
    constructionMethod: "",
    linkedCatalogKeys: [],
    estimatedCostManwon: null,
    imageRef: id,
    mimeType,
    createdAt: now,
    updatedAt: now,
  };
}
