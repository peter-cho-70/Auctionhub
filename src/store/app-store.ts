"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import {
  debouncedSafePersistToLocalStorage,
  safePersistToLocalStorage,
} from "@/lib/data/compact-storage";
import type {
  AppData,
  AuctionCase,
  GuMarketCacheEntry,
  BidRound,
  CaseChecklist,
  CaseDecision,
  CaseStatus,
  ChecklistItemInstance,
  ChecklistTemplateItem,
  AuctionSaleComparable,
  ExternalAiQaEntry,
  KnowledgeNote,
  MessageTemplate,
  PropertyAnalysisSettings,
  PdfCoverSettings,
  RemodelingPriceCatalog,
} from "@/lib/types/domain";
import { normalizeRemodelingPriceCatalog } from "@/lib/domain/remodeling-catalog";
import { STORAGE_KEY } from "@/lib/data/storage";
import { createDefaultAppData } from "@/lib/data/default-data";
import {
  markUserDataPresence,
  snapshotBeforeDestructiveChange,
} from "@/lib/data/data-protection";
import { createAuctionCase } from "@/lib/domain/case-factory";
import { reapplyChecklistsToCase } from "@/lib/domain/checklists";
import { estimateNextMinPrice } from "@/lib/domain/finance";
import {
  ensureAppData,
  mergeImportedData,
  parseAppDataJson,
} from "@/lib/data/migrate";
import {
  emptyAuctionBidAnalysis,
  MAX_AUCTION_SALE_COMPARABLES,
} from "@/lib/domain/auction-bid-analysis";

function nowIso() {
  return new Date().toISOString();
}

function touchCase(c: AuctionCase): AuctionCase {
  const minPrice = c.minPrice;
  const lastFailed = [...c.bidRounds]
    .reverse()
    .find((r) => r.result === "failed");
  const baseForNext =
    lastFailed?.minPrice != null ? lastFailed.minPrice : minPrice;
  const nextExpectedMinPrice =
    baseForNext != null ? estimateNextMinPrice(baseForNext) : null;
  return {
    ...c,
    updatedAt: nowIso(),
    nextExpectedMinPrice,
  };
}

type AppStore = {
  data: AppData;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  /** 입찰가 분석 PDF 업로드 UI (persist 제외 — 리마운트 후에도 메시지 유지) */
  bidPdfImportLog: string;
  bidPdfImportBusy: boolean;
  bidPdfImportWarnings: string[];
  setBidPdfImportLog: (message: string) => void;

  importData: (json: string, mode: "replace" | "merge") => void;
  exportDataJson: () => string;
  resetToDefaults: () => void;

  addCase: (input: Parameters<typeof createAuctionCase>[1]) => AuctionCase;
  updateCase: (id: string, patch: Partial<AuctionCase>) => void;
  deleteCase: (id: string) => void;

  setCaseStatus: (id: string, status: CaseStatus) => void;
  setWonDayActionsCompleted: (id: string, done: boolean) => void;

  toggleChecklistItem: (
    caseId: string,
    checklistId: string,
    itemId: string,
    done: boolean,
  ) => void;
  setChecklistItemNote: (
    caseId: string,
    checklistId: string,
    itemId: string,
    note: string,
  ) => void;
  updateCaseChecklistItemFields: (
    caseId: string,
    checklistId: string,
    itemId: string,
    patch: Partial<Pick<ChecklistItemInstance, "label" | "required">>,
  ) => void;
  addCaseChecklistItem: (caseId: string, checklistId: string) => void;
  removeCaseChecklistItem: (
    caseId: string,
    checklistId: string,
    itemId: string,
  ) => void;

  setDecision: (caseId: string, decision: Partial<CaseDecision>) => void;

  addBidRound: (caseId: string, round: Omit<BidRound, "id">) => void;
  updateBidRound: (
    caseId: string,
    roundId: string,
    patch: Partial<BidRound>,
  ) => void;
  removeBidRound: (caseId: string, roundId: string) => void;

  updateMessageTemplate: (id: string, patch: Partial<MessageTemplate>) => void;
  setChecklistTemplateForStep: (
    step: CaseStatus,
    items: ChecklistTemplateItem[],
  ) => void;
  reapplyTemplatesToCase: (caseId: string) => void;

  setLectureGuideForStep: (step: CaseStatus, text: string) => void;
  clearLectureGuideForStep: (step: CaseStatus) => void;
  setNoDividendRequestGuide: (text: string) => void;
  setPropertyAnalysisSettings: (patch: Partial<PropertyAnalysisSettings>) => void;
  setPdfCoverSettings: (patch: Partial<PdfCoverSettings>) => void;
  setRemodelingPriceCatalog: (catalog: RemodelingPriceCatalog) => void;

  addKnowledgeNote: (note: Omit<KnowledgeNote, "id" | "createdAt" | "updatedAt">) => void;
  updateKnowledgeNote: (id: string, patch: Partial<KnowledgeNote>) => void;
  removeKnowledgeNote: (id: string) => void;

  setSharedExternalAiQa: (entries: ExternalAiQaEntry[]) => void;

  setSharedAuctionSaleComparables: (entries: AuctionSaleComparable[]) => void;

  /** 입찰가 분석 — 매각 사례 추가 (저장 후 총 건수, 실패 시 -1) */
  appendAuctionSaleComparables: (
    caseId: string,
    items: AuctionSaleComparable[],
  ) => number;

  setGuMarketCache: (entry: GuMarketCacheEntry) => void;

  /** 모든 물건의 주변 시세·참고 메모 제거 (구 캐시는 유지) */
  clearAllMarketData: () => { guCacheKeys: number; casesCleared: number };
};

function createQuotaSafeLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      debouncedSafePersistToLocalStorage(name, value);
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

function updateCaseById(
  data: AppData,
  id: string,
  fn: (c: AuctionCase) => AuctionCase,
): AppData {
  return {
    ...data,
    cases: data.cases.map((c) => (c.id === id ? fn(c) : c)),
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      data: createDefaultAppData(),
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      bidPdfImportLog: "",
      bidPdfImportBusy: false,
      bidPdfImportWarnings: [],
      setBidPdfImportLog: (message) => set({ bidPdfImportLog: message }),

      importData: (json, mode) => {
        const before = get().exportDataJson();
        const beforeCount = get().data.cases.length;
        if (mode === "replace" && beforeCount > 0) {
          snapshotBeforeDestructiveChange(before, "before-import-replace");
        }
        const incoming = parseAppDataJson(json);
        const base = ensureAppData(get().data);
        const merged = mergeImportedData(base, incoming, mode);
        const next = ensureAppData(merged);
        set({ data: next });
        markUserDataPresence(next.cases.length);
      },

      exportDataJson: () => JSON.stringify(get().data, null, 2),

      resetToDefaults: () => {
        snapshotBeforeDestructiveChange(
          get().exportDataJson(),
          "before-reset-to-defaults",
        );
        set({ data: createDefaultAppData() });
      },

      addCase: (input) => {
        const data = get().data;
        const c = createAuctionCase(data, input);
        const next = { ...data, cases: [c, ...data.cases] };
        set({ data: next });
        markUserDataPresence(next.cases.length);
        return c;
      },

      updateCase: (id, patch) =>
        set((s) => ({
          data: updateCaseById(s.data, id, (c) =>
            touchCase({ ...c, ...patch, id: c.id }),
          ),
        })),

      deleteCase: (id) =>
        set((s) => ({
          data: {
            ...s.data,
            cases: s.data.cases.filter((c) => c.id !== id),
          },
        })),

      setCaseStatus: (id, status) =>
        set((s) => ({
          data: updateCaseById(s.data, id, (c) =>
            touchCase({ ...c, status }),
          ),
        })),

      setWonDayActionsCompleted: (id, done) =>
        set((s) => ({
          data: updateCaseById(s.data, id, (c) =>
            touchCase({ ...c, wonDayActionsCompleted: done }),
          ),
        })),

      toggleChecklistItem: (caseId, checklistId, itemId, done) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const checklists = c.checklists.map((cl: CaseChecklist) => {
              if (cl.id !== checklistId) return cl;
              return {
                ...cl,
                items: cl.items.map((it) =>
                  it.id === itemId
                    ? {
                        ...it,
                        done,
                        doneAt: done ? nowIso() : null,
                      }
                    : it,
                ),
              };
            });
            return touchCase({ ...c, checklists });
          }),
        })),

      setChecklistItemNote: (caseId, checklistId, itemId, note) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const checklists = c.checklists.map((cl) => {
              if (cl.id !== checklistId) return cl;
              return {
                ...cl,
                items: cl.items.map((it) =>
                  it.id === itemId ? { ...it, note } : it,
                ),
              };
            });
            return touchCase({ ...c, checklists });
          }),
        })),

      updateCaseChecklistItemFields: (caseId, checklistId, itemId, patch) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const checklists = c.checklists.map((cl) => {
              if (cl.id !== checklistId) return cl;
              return {
                ...cl,
                items: cl.items.map((it) =>
                  it.id === itemId ? { ...it, ...patch } : it,
                ),
              };
            });
            return touchCase({ ...c, checklists });
          }),
        })),

      addCaseChecklistItem: (caseId, checklistId) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const nid =
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `ci-${Date.now()}`;
            const newItem: ChecklistItemInstance = {
              id: nid,
              label: "",
              required: false,
              done: false,
              doneAt: null,
              note: "",
            };
            const checklists = c.checklists.map((cl) => {
              if (cl.id !== checklistId) return cl;
              return { ...cl, items: [...cl.items, newItem] };
            });
            return touchCase({ ...c, checklists });
          }),
        })),

      removeCaseChecklistItem: (caseId, checklistId, itemId) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const checklists = c.checklists.map((cl) => {
              if (cl.id !== checklistId) return cl;
              return {
                ...cl,
                items: cl.items.filter((it) => it.id !== itemId),
              };
            });
            return touchCase({ ...c, checklists });
          }),
        })),

      setDecision: (caseId, decision) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) =>
            touchCase({
              ...c,
              decision: { ...c.decision, ...decision },
            }),
          ),
        })),

      addBidRound: (caseId, round) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const id =
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `br-${Date.now()}`;
            const bidRounds: BidRound[] = [
              ...c.bidRounds,
              { ...round, id },
            ];
            const maxRound = bidRounds.reduce(
              (m, r) => Math.max(m, r.round),
              c.currentRound,
            );
            return touchCase({
              ...c,
              bidRounds,
              currentRound: maxRound,
            });
          }),
        })),

      updateBidRound: (caseId, roundId, patch) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) => {
            const bidRounds = c.bidRounds.map((r) =>
              r.id === roundId ? { ...r, ...patch } : r,
            );
            return touchCase({ ...c, bidRounds });
          }),
        })),

      removeBidRound: (caseId, roundId) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) =>
            touchCase({
              ...c,
              bidRounds: c.bidRounds.filter((r) => r.id !== roundId),
            }),
          ),
        })),

      updateMessageTemplate: (id, patch) =>
        set((s) => ({
          data: {
            ...s.data,
            messageTemplates: s.data.messageTemplates.map((t) =>
              t.id === id ? { ...t, ...patch } : t,
            ),
          },
        })),

      setChecklistTemplateForStep: (step, items) =>
        set((s) => ({
          data: {
            ...s.data,
            checklistTemplates: {
              ...s.data.checklistTemplates,
              [step]: items,
            },
          },
        })),

      reapplyTemplatesToCase: (caseId) =>
        set((s) => ({
          data: updateCaseById(s.data, caseId, (c) =>
            touchCase(reapplyChecklistsToCase(s.data, c)),
          ),
        })),

      setLectureGuideForStep: (step, text) =>
        set((s) => ({
          data: {
            ...s.data,
            lectureGuideByStep: {
              ...(s.data.lectureGuideByStep ?? {}),
              [step]: text,
            },
          },
        })),

      clearLectureGuideForStep: (step) =>
        set((s) => {
          const cur = { ...(s.data.lectureGuideByStep ?? {}) };
          delete cur[step];
          return {
            data: { ...s.data, lectureGuideByStep: cur },
          };
        }),

      setNoDividendRequestGuide: (text) =>
        set((s) => ({
          data: {
            ...s.data,
            tenantAnalysisSettings: {
              ...s.data.tenantAnalysisSettings,
              noDividendRequestGuide: text,
            },
          },
        })),

      setPropertyAnalysisSettings: (patch) =>
        set((s) => ({
          data: {
            ...s.data,
            propertyAnalysisSettings: {
              ...s.data.propertyAnalysisSettings,
              ...patch,
            },
          },
        })),

      setPdfCoverSettings: (patch) =>
        set((s) => ({
          data: {
            ...s.data,
            pdfCoverSettings: {
              ...s.data.pdfCoverSettings,
              ...patch,
              listCrop: patch.listCrop
                ? { ...s.data.pdfCoverSettings.listCrop, ...patch.listCrop }
                : s.data.pdfCoverSettings.listCrop,
            },
          },
        })),

      setRemodelingPriceCatalog: (catalog) =>
        set((s) => ({
          data: {
            ...s.data,
            remodelingPriceCatalog: normalizeRemodelingPriceCatalog(catalog),
          },
        })),

      addKnowledgeNote: (note) =>
        set((s) => {
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `kn-${Date.now()}`;
          const t = nowIso();
          const n: KnowledgeNote = {
            ...note,
            id,
            createdAt: t,
            updatedAt: t,
          };
          return {
            data: {
              ...s.data,
              knowledgeNotes: [n, ...s.data.knowledgeNotes],
            },
          };
        }),

      updateKnowledgeNote: (id, patch) =>
        set((s) => ({
          data: {
            ...s.data,
            knowledgeNotes: s.data.knowledgeNotes.map((n) =>
              n.id === id
                ? { ...n, ...patch, updatedAt: nowIso() }
                : n,
            ),
          },
        })),

      removeKnowledgeNote: (id) =>
        set((s) => ({
          data: {
            ...s.data,
            knowledgeNotes: s.data.knowledgeNotes.filter((n) => n.id !== id),
          },
        })),

      setSharedExternalAiQa: (entries) =>
        set((s) => ({
          data: {
            ...s.data,
            sharedExternalAiQa: entries,
          },
        })),

      setSharedAuctionSaleComparables: (entries) =>
        set((s) => ({
          data: {
            ...s.data,
            sharedAuctionSaleComparables: entries,
          },
        })),

      appendAuctionSaleComparables: (caseId, items) => {
        if (items.length === 0) return -1;
        const exists = get().data.cases.some((c) => c.id === caseId);
        if (!exists) return -1;

        let total = 0;
        set((s) => {
          const data = updateCaseById(s.data, caseId, (c) => {
            const current = Array.isArray(c.auctionSaleComparables)
              ? c.auctionSaleComparables
              : [];
            const next = [...current, ...items].slice(
              0,
              MAX_AUCTION_SALE_COMPARABLES,
            );
            total = next.length;
            return touchCase({
              ...c,
              auctionSaleComparables: next,
              auctionBidAnalysis:
                c.auctionBidAnalysis ?? emptyAuctionBidAnalysis(),
            });
          });
          return { data };
        });
        return total;
      },

      setGuMarketCache: (entry) =>
        set((s) => ({
          data: {
            ...s.data,
            guMarketCache: {
              ...s.data.guMarketCache,
              [entry.lawdCode]: entry,
            },
          },
        })),

      clearAllMarketData: () => {
        const current = get().data;
        const guCacheKeys = Object.keys(current.guMarketCache ?? {}).length;
        let casesCleared = 0;
        const cases = current.cases.map((c) => {
          const hasMarket =
            c.nearbyMarketAnalysis != null ||
            (c.brokerMarketNotes?.length ?? 0) > 0 ||
            (c.aiMarketNotes?.length ?? 0) > 0;
          if (!hasMarket) return c;
          casesCleared += 1;
          return touchCase({
            ...c,
            nearbyMarketAnalysis: null,
            brokerMarketNotes: [],
            aiMarketNotes: [],
          });
        });
        set({
          data: {
            ...current,
            cases,
          },
        });
        return { guCacheKeys, casesCleared };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createQuotaSafeLocalStorage()),
      partialize: (s) => ({ data: s.data }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        data: ensureAppData(
          (persisted as Partial<Pick<AppStore, "data">>).data ??
            current.data,
        ),
      }),
      skipHydration: true,
    },
  ),
);
