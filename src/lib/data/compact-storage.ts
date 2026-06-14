import type { AppData, AuctionCase, CaseSourceDocument } from "@/lib/types/domain";
import { SNAPSHOT_STORAGE_KEY, STORAGE_KEY } from "@/lib/data/storage";

/** 로컬 persist용 — 원문은 짧은 미리보기만 */
const MAX_EXTRACTED_TEXT_CHARS = 4_000;
const MAX_GU_CACHE_ENTRIES = 8;
const MAX_MARKET_LISTINGS = 120;
/** 이 크기(문자) 넘으면 원본 그대로 저장 시도하지 않음 (~4MB 한도 대비) */
const PERSIST_JSON_SOFT_LIMIT = 3_200_000;

export type StorageQuotaListener = (message: string | null) => void;

let quotaMessage: string | null = null;
const quotaListeners = new Set<StorageQuotaListener>();

export function getStorageQuotaMessage(): string | null {
  return quotaMessage;
}

export function setStorageQuotaMessage(_message: string | null): void {
  /* UI 배너 비표시 — 내부 압축·정리 로직만 유지 */
}

export function subscribeStorageQuota(listener: StorageQuotaListener): () => void {
  quotaListeners.add(listener);
  listener(quotaMessage);
  return () => quotaListeners.delete(listener);
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function stripRawTextFields(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripRawTextFields);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "raw_text" || key === "rawText") continue;
    out[key] = stripRawTextFields(child);
  }
  return out;
}

export function compactSourceDocumentForStorage(
  doc: CaseSourceDocument,
  opts?: { stripExtractedText?: boolean },
): CaseSourceDocument {
  const strip = opts?.stripExtractedText === true;
  let extractedText = doc.extractedText ?? "";
  if (strip) {
    extractedText =
      extractedText.length > 0
        ? `[용량 절약] PDF 원문 ${extractedText.length.toLocaleString("ko-KR")}자 — 로컬에는 저장하지 않습니다.`
        : "";
  } else if (extractedText.length > MAX_EXTRACTED_TEXT_CHARS) {
    extractedText =
      extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARS) +
      `\n…(총 ${extractedText.length.toLocaleString("ko-KR")}자 — 앞부분만 저장)`;
  }

  let structuredJson = doc.structuredJson;
  if (structuredJson != null) {
    structuredJson = stripRawTextFields(structuredJson);
  }

  return {
    ...doc,
    extractedText,
    structuredJson,
  };
}

function compactCaseForStorage(
  c: AuctionCase,
  opts?: { stripExtractedText?: boolean },
): AuctionCase {
  const market = c.nearbyMarketAnalysis;
  const listings =
    market?.listings && market.listings.length > MAX_MARKET_LISTINGS
      ? market.listings.slice(0, MAX_MARKET_LISTINGS)
      : market?.listings;

  return {
    ...c,
    sourceDocuments: (c.sourceDocuments ?? []).map((d) =>
      compactSourceDocumentForStorage(d, opts),
    ),
    nearbyMarketAnalysis:
      market && listings !== market.listings
        ? { ...market, listings: listings ?? [] }
        : market,
  };
}

export function compactAppDataForStorage(
  data: AppData,
  opts?: { stripExtractedText?: boolean; maxGuCacheKeys?: number },
): AppData {
  const maxGu = opts?.maxGuCacheKeys ?? MAX_GU_CACHE_ENTRIES;
  const guEntries = Object.entries(data.guMarketCache ?? {});
  const guMarketCache =
    guEntries.length <= maxGu
      ? data.guMarketCache
      : Object.fromEntries(guEntries.slice(-maxGu));

  return {
    ...data,
    cases: data.cases.map((c) => compactCaseForStorage(c, opts)),
    guMarketCache,
  };
}

/**보내기·스냅샷용 JSON 문자열 (용량 절약) */
export function compactAppDataJsonForStorage(json: string): string {
  try {
    const parsed = JSON.parse(json) as { schemaVersion?: number; cases?: unknown };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cases)) {
      return json;
    }
    return JSON.stringify(
      compactAppDataForStorage(parsed as AppData, { stripExtractedText: true }),
    );
  } catch {
    return json;
  }
}

function ultraCompactPersistPayload(value: string): string {
  const parsed = JSON.parse(value) as {
    state?: { data?: AppData };
    version?: number;
  };
  const data = parsed.state?.data;
  if (!data) return value;
  return JSON.stringify({
    ...parsed,
    state: {
      ...parsed.state,
      data: compactAppDataForStorage(data, {
        stripExtractedText: true,
        maxGuCacheKeys: 3,
      }),
    },
  });
}

function compactPersistPayload(value: string): string {
  const parsed = JSON.parse(value) as {
    state?: { data?: AppData };
    version?: number;
  };
  const data = parsed.state?.data;
  if (!data) return value;
  return JSON.stringify({
    ...parsed,
    state: {
      ...parsed.state,
      data: compactAppDataForStorage(data, { stripExtractedText: true }),
    },
  });
}

function stripSourceDocumentsPersistPayload(value: string): string {
  const parsed = JSON.parse(value) as {
    state?: { data?: AppData };
    version?: number;
  };
  const data = parsed.state?.data;
  if (!data) return value;
  return JSON.stringify({
    ...parsed,
    state: {
      ...parsed.state,
      data: {
        ...data,
        cases: data.cases.map((c) => ({ ...c, sourceDocuments: [] })),
      },
    },
  });
}

/** 메모리 상태를 즉시 localStorage에 반영 */
export function persistAppDataNow(data: AppData, version = 0): boolean {
  const value = JSON.stringify({ state: { data }, version });
  flushDebouncedPersist();
  return safePersistToLocalStorage(STORAGE_KEY, value);
}

/** 앱 기동 시 localStorage 용량 확보 (rehydrate 전에 호출) */
export function reclaimBrowserStorageOnStartup(): {
  ok: boolean;
  message: string;
} {
  if (typeof window === "undefined") {
    return { ok: true, message: "" };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setStorageQuotaMessage(null);
    return { ok: true, message: "" };
  }

  const attempts = [
    () => ultraCompactPersistPayload(raw),
    () => {
      const parsed = JSON.parse(raw) as {
        state?: { data?: AppData };
        version?: number;
      };
      const data = parsed.state?.data;
      if (!data) return raw;
      const stripped: AppData = {
        ...data,
        cases: data.cases.map((c) => ({
          ...c,
          sourceDocuments: [],
        })),
      };
      return JSON.stringify({
        ...parsed,
        state: { ...parsed.state, data: stripped },
      });
    },
  ];

  let lastSize = raw.length;
  for (const build of attempts) {
    try {
      const next = build();
      localStorage.setItem(STORAGE_KEY, next);
      if (next.length < lastSize - 50_000) {
        setStorageQuotaMessage(
          "시작 시 저장 데이터를 압축했습니다. JSON 백업은 「데이터」 탭에서 받을 수 있습니다.",
        );
      } else {
        setStorageQuotaMessage(null);
      }
      return { ok: true, message: "compressed" };
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  setStorageQuotaMessage(
    "브라우저 저장 공간이 가득 찼습니다. 상단 「지금 정리」 또는 데이터 탭에서 백업 후 정리하세요.",
  );
  return { ok: false, message: "quota" };
}

/** 메모리 + localStorage 저장 공간 정리 (UI·데이터 탭 공용) */
export function applyStorageReclaim(data: AppData): {
  ok: boolean;
  data: AppData;
  message: string;
} {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const compacted = compactAppDataForStorage(data, {
    stripExtractedText: true,
    maxGuCacheKeys: 3,
  });
  const saved = persistAppDataNow(compacted);
  if (saved) {
    setStorageQuotaMessage(null);
    return {
      ok: true,
      data: compacted,
      message: "저장 공간을 정리했습니다.",
    };
  }

  const stripped: AppData = {
    ...compacted,
    cases: compacted.cases.map((c) => ({ ...c, sourceDocuments: [] })),
  };
  const savedStripped = persistAppDataNow(stripped);
  if (savedStripped) {
    setStorageQuotaMessage(
      "PDF 출처 문서 메타만 남기고 원문은 제거해 저장했습니다. JSON 백업을 권장합니다.",
    );
    return {
      ok: true,
      data: stripped,
      message: "출처 문서 원문을 제거하고 저장했습니다.",
    };
  }

  return {
    ok: false,
    data: compacted,
    message:
      "여전히 저장 공간이 부족합니다. 데이터 탭에서 JSON보내기 후 브라우저 사이트 데이터를 비우세요.",
  };
}

let persistWriteTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersist: { name: string; value: string } | null = null;

/** 지연 중인 persist 즉시 반영 */
export function flushDebouncedPersist(): void {
  if (persistWriteTimer) {
    clearTimeout(persistWriteTimer);
    persistWriteTimer = null;
  }
  const job = pendingPersist;
  pendingPersist = null;
  if (job) safePersistToLocalStorage(job.name, job.value);
}

/** persist 저장 지연 — PDF 선택 직후 UI가 멈추지 않도록 */
export function debouncedSafePersistToLocalStorage(
  name: string,
  value: string,
  delayMs = 600,
): void {
  pendingPersist = { name, value };
  if (persistWriteTimer) clearTimeout(persistWriteTimer);
  persistWriteTimer = setTimeout(() => {
    persistWriteTimer = null;
    const job = pendingPersist;
    pendingPersist = null;
    if (job) safePersistToLocalStorage(job.name, job.value);
  }, delayMs);
}

/** zustand persist setItem — 실패해도 예외를 밖으로 던지지 않음 */
export function safePersistToLocalStorage(name: string, value: string): boolean {
  const skipRaw = value.length > PERSIST_JSON_SOFT_LIMIT;
  const attempts = [
    ...(skipRaw ? [] : [() => value]),
    () => compactPersistPayload(value),
    () => ultraCompactPersistPayload(value),
    () => stripSourceDocumentsPersistPayload(value),
  ];

  for (const build of attempts) {
    try {
      localStorage.setItem(name, build());
      setStorageQuotaMessage(null);
      return true;
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
    }
  }

  try {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    /* ignore */
  }

  for (const build of [
    () => ultraCompactPersistPayload(value),
    () => stripSourceDocumentsPersistPayload(value),
  ]) {
    try {
      localStorage.setItem(name, build());
      setStorageQuotaMessage(
        "저장 공간이 부족해 PDF 원문·스냅샷을 줄여 저장했습니다. 「데이터」 탭에서 JSON보내기로 백업하세요.",
      );
      return true;
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
    }
  }

  setStorageQuotaMessage(
    "브라우저 저장 공간이 가득 찼습니다. 상단 「지금 정리」 또는 데이터 탭에서 백업 후 사이트 데이터를 비우세요.",
  );
  return false;
}
