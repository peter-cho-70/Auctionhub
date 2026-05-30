const DB_NAME = "auctionflow-case-media";
const DB_VERSION = 1;
const STORE = "blobs";

export type CaseMediaKind = "field-photo" | "report-html";

function storageKey(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
): string {
  return `${caseId}:${kind}:${refId}`;
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

export async function putCaseMediaBlob(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
  blob: Blob,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: storageKey(caseId, kind, refId),
      caseId,
      kind,
      refId,
      blob,
      updatedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function putCaseMediaText(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
  text: string,
): Promise<void> {
  await putCaseMediaBlob(
    caseId,
    kind,
    refId,
    new Blob([text], { type: "text/html;charset=utf-8" }),
  );
}

export async function getCaseMediaBlob(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(storageKey(caseId, kind, refId));
    req.onsuccess = () => {
      db.close();
      const rec = req.result as { blob?: Blob } | undefined;
      resolve(rec?.blob ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getCaseMediaText(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
): Promise<string | null> {
  const blob = await getCaseMediaBlob(caseId, kind, refId);
  if (!blob) return null;
  return blob.text();
}

export async function deleteCaseMedia(
  caseId: string,
  kind: CaseMediaKind,
  refId: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(storageKey(caseId, kind, refId));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export { compressImageFile } from "@/lib/data/remodeling-image-store";
