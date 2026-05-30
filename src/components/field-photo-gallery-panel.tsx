"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseFieldPhotoGallery, FieldPhotoRecord, FieldPhotoZone } from "@/lib/types/domain";
import {
  compressImageFile,
  deleteCaseMedia,
  getCaseMediaBlob,
  putCaseMediaBlob,
} from "@/lib/data/case-media-store";
import {
  createFieldPhoto,
  FIELD_PHOTO_REPORT_SECTION,
  FIELD_PHOTO_ZONE_LABEL,
  FIELD_PHOTO_ZONES,
  MAX_FIELD_PHOTOS_PER_ZONE,
} from "@/lib/domain/field-photo-gallery";

type Props = {
  caseId: string;
  gallery: CaseFieldPhotoGallery;
  onChange: (next: CaseFieldPhotoGallery) => void;
};

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";

function FieldPhotoThumb({
  caseId,
  photo,
  selected,
  onSelect,
}: {
  caseId: string;
  photo: FieldPhotoRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void getCaseMediaBlob(caseId, "field-photo", photo.imageRef).then((blob) => {
      if (cancelled || !blob) return;
      revoked = URL.createObjectURL(blob);
      setUrl(revoked);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [caseId, photo.imageRef]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-lg border ${
        selected ? "ring-2 ring-sky-600" : "border-neutral-200 dark:border-neutral-700"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.caption || "임장"} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-xs text-neutral-400">로딩…</span>
      )}
    </button>
  );
}

export function FieldPhotoGalleryPanel({ caseId, gallery, onChange }: Props) {
  const [zone, setZone] = useState<FieldPhotoZone>("exterior");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const zonePhotos = gallery.photos.filter((p) => p.zone === zone);
  const selected =
    gallery.photos.find((p) => p.id === selectedId) ?? zonePhotos[0] ?? null;

  const persist = useCallback(
    (photos: FieldPhotoRecord[]) => onChange({ photos }),
    [onChange],
  );

  const patchPhoto = (id: string, patch: Partial<FieldPhotoRecord>) => {
    persist(
      gallery.photos.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    );
  };

  const removePhoto = async (photo: FieldPhotoRecord) => {
    if (!confirm("사진을 삭제할까요?")) return;
    try {
      await deleteCaseMedia(caseId, "field-photo", photo.imageRef);
    } catch {
      /* ignore */
    }
    persist(gallery.photos.filter((p) => p.id !== photo.id));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (zonePhotos.length >= MAX_FIELD_PHOTOS_PER_ZONE) {
      alert(`구역당 최대 ${MAX_FIELD_PHOTOS_PER_ZONE}장`);
      return;
    }
    setUploading(true);
    const added: FieldPhotoRecord[] = [];
    try {
      for (const file of Array.from(files)) {
        if (zonePhotos.length + added.length >= MAX_FIELD_PHOTOS_PER_ZONE) break;
        const { blob, mimeType } = await compressImageFile(file);
        const photo = createFieldPhoto(zone, mimeType);
        await putCaseMediaBlob(caseId, "field-photo", photo.imageRef, blob);
        added.push(photo);
      }
      if (added.length) {
        persist([...gallery.photos, ...added]);
        setSelectedId(added[added.length - 1]!.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div>
        <h3 className="text-sm font-semibold">임장·건물 사진 (보고서 §6·§7)</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          IndexedDB 저장 · 보고서 생성 시 썸네일 포함
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {FIELD_PHOTO_ZONES.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => {
              setZone(z);
              const first = gallery.photos.find((p) => p.zone === z);
              setSelectedId(first?.id ?? null);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs ${
              zone === z ? "bg-sky-700 text-white" : "bg-white dark:bg-neutral-900"
            }`}
          >
            {FIELD_PHOTO_ZONE_LABEL[z]}
            <span className="ml-1 opacity-70">§{FIELD_PHOTO_REPORT_SECTION[z]}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button type="button" className={BTN} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "업로드…" : `+ ${FIELD_PHOTO_ZONE_LABEL[zone]}`}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {zonePhotos.map((p) => (
          <FieldPhotoThumb
            key={p.id}
            caseId={caseId}
            photo={p}
            selected={selected?.id === p.id}
            onSelect={() => setSelectedId(p.id)}
          />
        ))}
      </div>
      {selected && selected.zone === zone && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <label className="block text-xs text-neutral-500">
            캡션
            <input
              className={INPUT}
              value={selected.caption}
              onChange={(e) => patchPhoto(selected.id, { caption: e.target.value })}
            />
          </label>
          <button type="button" className="text-xs text-rose-600" onClick={() => void removePhoto(selected)}>
            삭제
          </button>
        </div>
      )}
    </section>
  );
}

/** 보고서 HTML용 data URL 로드 */
export async function loadFieldPhotoDataUrls(
  caseId: string,
  gallery: CaseFieldPhotoGallery,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const photo of gallery.photos) {
    const blob = await getCaseMediaBlob(caseId, "field-photo", photo.imageRef);
    if (!blob) continue;
    out[photo.imageRef] = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  return out;
}
