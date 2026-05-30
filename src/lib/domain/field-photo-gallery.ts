import type {
  CaseFieldPhotoGallery,
  FieldPhotoRecord,
  FieldPhotoZone,
} from "@/lib/types/domain";

export const FIELD_PHOTO_ZONES: FieldPhotoZone[] = [
  "exterior",
  "interior",
  "floor",
  "roof",
  "unit",
  "structure",
  "surroundings",
];

export const FIELD_PHOTO_ZONE_LABEL: Record<FieldPhotoZone, string> = {
  exterior: "외관",
  interior: "내부",
  floor: "층별",
  roof: "옥상",
  unit: "호실",
  structure: "구조도",
  surroundings: "주변·도로",
};

/** §6 주변, §7 건물 */
export const FIELD_PHOTO_REPORT_SECTION: Record<FieldPhotoZone, 6 | 7> = {
  exterior: 7,
  interior: 7,
  floor: 7,
  roof: 7,
  unit: 7,
  structure: 7,
  surroundings: 6,
};

export const MAX_FIELD_PHOTOS_PER_ZONE = 10;

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyFieldPhotoGallery(): CaseFieldPhotoGallery {
  return { photos: [] };
}

function normalizeZone(raw: unknown): FieldPhotoZone {
  return typeof raw === "string" &&
    (FIELD_PHOTO_ZONES as string[]).includes(raw)
    ? (raw as FieldPhotoZone)
    : "exterior";
}

function normalizePhoto(raw: unknown): FieldPhotoRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId();
  const now = new Date().toISOString();
  return {
    id,
    zone: normalizeZone(o.zone),
    caption: typeof o.caption === "string" ? o.caption : "",
    imageRef:
      typeof o.imageRef === "string" && o.imageRef.trim()
        ? o.imageRef.trim()
        : id,
    mimeType:
      typeof o.mimeType === "string" && o.mimeType.trim()
        ? o.mimeType
        : "image/jpeg",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
  };
}

export function normalizeFieldPhotoGallery(raw: unknown): CaseFieldPhotoGallery {
  if (!raw || typeof raw !== "object") return emptyFieldPhotoGallery();
  const o = raw as Record<string, unknown>;
  const photos = Array.isArray(o.photos)
    ? o.photos
        .map((p) => normalizePhoto(p))
        .filter((p): p is FieldPhotoRecord => p != null)
    : [];
  return { photos };
}

export function createFieldPhoto(
  zone: FieldPhotoZone,
  mimeType: string,
): FieldPhotoRecord {
  const now = new Date().toISOString();
  const id = newId();
  return {
    id,
    zone,
    caption: "",
    imageRef: id,
    mimeType,
    createdAt: now,
    updatedAt: now,
  };
}
