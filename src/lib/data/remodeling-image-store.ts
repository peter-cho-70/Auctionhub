const DB_NAME = "auctionflow-remodeling-images";
const DB_VERSION = 1;
const STORE = "images";

export type RemodelingImageRecord = {
  key: string;
  caseId: string;
  photoId: string;
  blob: Blob;
  updatedAt: string;
};

function storageKey(caseId: string, photoId: string): string {
  return `${caseId}:${photoId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

export async function putRemodelingImage(
  caseId: string,
  photoId: string,
  blob: Blob,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record: RemodelingImageRecord = {
      key: storageKey(caseId, photoId),
      caseId,
      photoId,
      blob,
      updatedAt: new Date().toISOString(),
    };
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB write failed"));
    };
  });
}

export async function getRemodelingImage(
  caseId: string,
  photoId: string,
): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(storageKey(caseId, photoId));
    req.onsuccess = () => {
      db.close();
      const rec = req.result as RemodelingImageRecord | undefined;
      resolve(rec?.blob ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("IndexedDB read failed"));
    };
  });
}

export async function deleteRemodelingImage(
  caseId: string,
  photoId: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(storageKey(caseId, photoId));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB delete failed"));
    };
  });
}

/** 업로드용 — 긴 변 maxPx, JPEG 품질 */
export async function compressImageFile(
  file: File,
  maxPx = 1200,
  quality = 0.82,
): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 등록할 수 있습니다.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("압축 실패"))),
      "image/jpeg",
      quality,
    );
  });
  return { blob, mimeType: "image/jpeg" };
}
