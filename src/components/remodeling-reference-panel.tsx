"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import {
  formatManwonWithSuffix,
  parseManwonInput,
} from "@/lib/format/manwon";
import type {
  RemodelingIdealReference,
  RemodelingPriceCatalog,
  RemodelingReferencePhoto,
  RemodelingReferenceZone,
} from "@/lib/types/domain";
import {
  compressImageFile,
  deleteRemodelingImage,
  getRemodelingImage,
  putRemodelingImage,
} from "@/lib/data/remodeling-image-store";
import {
  createReferencePhoto,
  idealReferenceCostSummary,
  MAX_REFERENCE_PHOTOS_PER_ZONE,
  photoLinkedCatalogCostManwon,
  photoTotalCostManwon,
  REMODELING_REFERENCE_ZONE_LABEL,
  REMODELING_REFERENCE_ZONES,
} from "@/lib/domain/remodeling-reference";

type Props = {
  caseId: string;
  idealReference: RemodelingIdealReference;
  priceCatalog: RemodelingPriceCatalog;
  onChange: (next: RemodelingIdealReference) => void;
};

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800";

const formatManwon = formatManwonWithSuffix;

function ReferencePhotoThumb({
  caseId,
  photo,
  selected,
  onSelect,
}: {
  caseId: string;
  photo: RemodelingReferencePhoto;
  selected: boolean;
  onSelect: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void getRemodelingImage(caseId, photo.imageRef).then((blob) => {
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
        selected
          ? "ring-2 ring-emerald-600 border-emerald-600"
          : "border-neutral-200 dark:border-neutral-700"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={photo.caption || "레퍼런스"} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-900">
          로딩…
        </span>
      )}
      {photo.caption.trim() && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-left text-[10px] text-white line-clamp-1">
          {photo.caption}
        </span>
      )}
    </button>
  );
}

export function RemodelingReferencePanel({
  caseId,
  idealReference,
  priceCatalog,
  onChange,
}: Props) {
  const [zone, setZone] = useState<RemodelingReferenceZone>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const costSummary = useMemo(
    () => idealReferenceCostSummary(priceCatalog, idealReference),
    [priceCatalog, idealReference],
  );

  const zonePhotos = idealReference.photos.filter((p) => p.zone === zone);
  const selected =
    idealReference.photos.find((p) => p.id === selectedId) ??
    zonePhotos[0] ??
    null;

  const patchRef = useCallback(
    (patch: Partial<RemodelingIdealReference>) => {
      onChange({ ...idealReference, ...patch });
    },
    [idealReference, onChange],
  );

  const patchPhoto = useCallback(
    (photoId: string, patch: Partial<RemodelingReferencePhoto>) => {
      onChange({
        ...idealReference,
        photos: idealReference.photos.map((p) =>
          p.id === photoId
            ? { ...p, ...patch, updatedAt: new Date().toISOString() }
            : p,
        ),
      });
    },
    [idealReference, onChange],
  );

  const removePhoto = useCallback(
    async (photo: RemodelingReferencePhoto) => {
      if (!confirm("이 사진을 삭제할까요?")) return;
      try {
        await deleteRemodelingImage(caseId, photo.imageRef);
      } catch {
        /* IndexedDB 없어도 메타는 제거 */
      }
      const next = idealReference.photos.filter((p) => p.id !== photo.id);
      onChange({ ...idealReference, photos: next });
      if (selectedId === photo.id) setSelectedId(next[0]?.id ?? null);
    },
    [caseId, idealReference, onChange, selectedId],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (zonePhotos.length >= MAX_REFERENCE_PHOTOS_PER_ZONE) {
      alert(
        `${REMODELING_REFERENCE_ZONE_LABEL[zone]} 구역은 최대 ${MAX_REFERENCE_PHOTOS_PER_ZONE}장까지 등록할 수 있습니다.`,
      );
      return;
    }
    setUploading(true);
    const added: RemodelingReferencePhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        if (zonePhotos.length + added.length >= MAX_REFERENCE_PHOTOS_PER_ZONE) break;
        const { blob, mimeType } = await compressImageFile(file);
        const photo = createReferencePhoto(zone, mimeType);
        await putRemodelingImage(caseId, photo.imageRef, blob);
        added.push(photo);
      }
      if (added.length === 0) return;
      const nextPhotos = [...idealReference.photos, ...added];
      onChange({ ...idealReference, photos: nextPhotos });
      setSelectedId(added[added.length - 1]!.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "사진 등록에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleCatalogKey = (photoId: string, key: string) => {
    const photo = idealReference.photos.find((p) => p.id === photoId);
    if (!photo) return;
    const keys = photo.linkedCatalogKeys.includes(key)
      ? photo.linkedCatalogKeys.filter((k) => k !== key)
      : [...photo.linkedCatalogKeys, key];
    patchPhoto(photoId, { linkedCatalogKeys: keys });
  };

  return (
    <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div>
        <h2 className="text-lg font-semibold">이상형 인테리어 레퍼런스</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          구역별 참고 사진·공사 방법·연결 공종 비용으로 목표 다가구 건물
          모습을 정리합니다. 사진은 브라우저 IndexedDB에 저장됩니다
          (localStorage 용량과 별도).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-neutral-500">
          제목
          <input
            className={INPUT}
            value={idealReference.title}
            onChange={(e) => patchRef({ title: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-neutral-500 sm:col-span-2">
          한 줄 요약
          <input
            className={INPUT}
            placeholder="예: 밝은 복도 + 원룸형 현관 + 통일된 욕실 타일"
            value={idealReference.summary}
            onChange={(e) => patchRef({ summary: e.target.value })}
          />
        </label>
      </div>

      <label className="block text-xs font-medium text-neutral-500">
        건물 공통 공사 방법·자재 기준
        <AutoGrowTextarea
          className={INPUT}
          placeholder="예: 복도·현관은 에폭시 바닥, 방은 장판+도배, 욕실은 300×600 타일 통일…"
          value={idealReference.globalConstructionNotes}
          onChange={(e) =>
            patchRef({ globalConstructionNotes: e.target.value })
          }
        />
      </label>

      <dl className="grid gap-2 rounded-lg border border-amber-200/80 bg-white/70 p-3 text-sm dark:border-amber-900/40 dark:bg-neutral-950/50 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-neutral-500">등록 사진</dt>
          <dd className="font-medium tabular-nums">{costSummary.photoCount}장</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">연결 공종 합계</dt>
          <dd className="font-medium tabular-nums">
            {formatManwon(costSummary.linkedCatalogManwon)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">수동 추가 비용</dt>
          <dd className="font-medium tabular-nums">
            {formatManwon(costSummary.manualManwon)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">레퍼런스 비용 합</dt>
          <dd className="font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
            {formatManwon(costSummary.totalManwon)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1">
        {REMODELING_REFERENCE_ZONES.map((z) => {
          const count = idealReference.photos.filter((p) => p.zone === z).length;
          const zoneCost = costSummary.byZone[z];
          return (
            <button
              key={z}
              type="button"
              onClick={() => {
                setZone(z);
                const first = idealReference.photos.find((p) => p.zone === z);
                setSelectedId(first?.id ?? null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                zone === z
                  ? "bg-amber-700 text-white"
                  : "bg-white text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              }`}
            >
              {REMODELING_REFERENCE_ZONE_LABEL[z]}
              {count > 0 && (
                <span className="ml-1 text-xs opacity-80">
                  {count}
                  {zoneCost > 0 && ` · ${zoneCost.toLocaleString("ko-KR")}만`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          className={BTN}
          disabled={uploading || zonePhotos.length >= MAX_REFERENCE_PHOTOS_PER_ZONE}
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? "업로드 중…"
            : `+ ${REMODELING_REFERENCE_ZONE_LABEL[zone]} 사진`}
        </button>
        <span className="text-xs text-neutral-500">
          {zonePhotos.length}/{MAX_REFERENCE_PHOTOS_PER_ZONE}장 · JPEG 자동 압축
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {zonePhotos.length === 0 ? (
            <p className="col-span-full rounded-lg border border-dashed border-neutral-300 px-3 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
              {REMODELING_REFERENCE_ZONE_LABEL[zone]} 구역 사진이 없습니다.
            </p>
          ) : (
            zonePhotos.map((photo) => (
              <ReferencePhotoThumb
                key={photo.id}
                caseId={caseId}
                photo={photo}
                selected={selected?.id === photo.id}
                onSelect={() => setSelectedId(photo.id)}
              />
            ))
          )}
        </div>

        {selected && selected.zone === zone && (
          <PhotoEditor
            photo={selected}
            priceCatalog={priceCatalog}
            onPatch={(patch) => patchPhoto(selected.id, patch)}
            onDelete={() => void removePhoto(selected)}
            onToggleCatalog={(key) => toggleCatalogKey(selected.id, key)}
          />
        )}
      </div>
    </section>
  );
}

function PhotoEditor({
  photo,
  priceCatalog,
  onPatch,
  onDelete,
  onToggleCatalog,
}: {
  photo: RemodelingReferencePhoto;
  priceCatalog: RemodelingPriceCatalog;
  onPatch: (patch: Partial<RemodelingReferencePhoto>) => void;
  onDelete: () => void;
  onToggleCatalog: (key: string) => void;
}) {
  const linkedCost = photoLinkedCatalogCostManwon(priceCatalog, photo);
  const totalCost = photoTotalCostManwon(priceCatalog, photo);
  const categories = useMemo(() => {
    const map = new Map<string, typeof priceCatalog.items>();
    for (const item of priceCatalog.items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [priceCatalog.items]);

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">사진 상세 · 비용</p>
        <button type="button" className="text-xs text-rose-600" onClick={onDelete}>
          삭제
        </button>
      </div>

      <label className="block text-xs font-medium text-neutral-500">
        캡션
        <input
          className={INPUT}
          placeholder="예: 복도형 원룸 — 밝은 조명·신발장"
          value={photo.caption}
          onChange={(e) => onPatch({ caption: e.target.value })}
        />
      </label>

      <label className="block text-xs font-medium text-neutral-500">
        공사 방법 (이 구역)
        <AutoGrowTextarea
          className={INPUT}
          placeholder="시공 순서, 자재 규격, 주의사항…"
          value={photo.constructionMethod}
          onChange={(e) => onPatch({ constructionMethod: e.target.value })}
        />
      </label>

      <div>
        <p className="text-xs font-medium text-neutral-500">연결 공종 (카탈로그)</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          선택한 공종 단가 합계: {formatManwon(linkedCost)}
        </p>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
          {categories.map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold uppercase text-neutral-400">
                {category}
              </p>
              <ul className="mt-1 space-y-1">
                {items.map((item) => (
                  <li key={item.key}>
                    <label className="flex cursor-pointer items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={photo.linkedCatalogKeys.includes(item.key)}
                        onChange={() => onToggleCatalog(item.key)}
                        className="mt-0.5"
                      />
                      <span>
                        {item.item}{" "}
                        <span className="text-neutral-400">
                          ({formatManwon(item.materialManwon + item.laborManwon)})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <label className="block text-xs font-medium text-neutral-500">
        추가 예상 비용 (만원, 수동)
        <input
          inputMode="decimal"
          className={`${INPUT} tabular-nums`}
          placeholder="카탈로그 외 추가비 (예: 12.5)"
          value={photo.estimatedCostManwon ?? ""}
          onChange={(e) => {
            onPatch({
              estimatedCostManwon: parseManwonInput(e.target.value),
            });
          }}
        />
      </label>

      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
        이 사진 기준 합계: {formatManwon(totalCost)}
      </p>
    </div>
  );
}
