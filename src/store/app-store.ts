"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppData,
  AuctionCase,
  BidRound,
  CaseChecklist,
  CaseDecision,
  CaseStatus,
  ChecklistItemInstance,
  ChecklistTemplateItem,
  KnowledgeNote,
  MessageTemplate,
  PropertyAnalysisSettings,
} from "@/lib/types/domain";
import { STORAGE_KEY } from "@/lib/data/storage";
import { createDefaultAppData } from "@/lib/data/default-data";
import { createAuctionCase } from "@/lib/domain/case-factory";
import { reapplyChecklistsToCase } from "@/lib/domain/checklists";
import { estimateNextMinPrice } from "@/lib/domain/finance";
import {
  ensureAppData,
  mergeImportedData,
  parseAppDataJson,
} from "@/lib/data/migrate";

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

  addKnowledgeNote: (note: Omit<KnowledgeNote, "id" | "createdAt" | "updatedAt">) => void;
  updateKnowledgeNote: (id: string, patch: Partial<KnowledgeNote>) => void;
  removeKnowledgeNote: (id: string) => void;
};

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

      importData: (json, mode) => {
        const incoming = parseAppDataJson(json);
        const base = ensureAppData(get().data);
        const merged = mergeImportedData(base, incoming, mode);
        set({ data: ensureAppData(merged) });
      },

      exportDataJson: () => JSON.stringify(get().data, null, 2),

      resetToDefaults: () => set({ data: createDefaultAppData() }),

      addCase: (input) => {
        const data = get().data;
        const c = createAuctionCase(data, input);
        set({ data: { ...data, cases: [c, ...data.cases] } });
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
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
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
