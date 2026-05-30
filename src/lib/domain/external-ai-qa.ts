import type {
  ExternalAiQaCategory,
  ExternalAiQaEntry,
} from "@/lib/types/domain";

const CATEGORIES: ExternalAiQaCategory[] = [
  "market",
  "bid",
  "rent_trend",
  "tenant",
  "other",
];

export const EXTERNAL_AI_QA_CATEGORY_LABEL: Record<ExternalAiQaCategory, string> =
  {
    market: "시세·호가",
    bid: "입찰가",
    rent_trend: "월세 추이",
    tenant: "임차 수요",
    other: "기타",
  };

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `aiqa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategory(raw: unknown): ExternalAiQaCategory {
  return typeof raw === "string" &&
    (CATEGORIES as string[]).includes(raw)
    ? (raw as ExternalAiQaCategory)
    : "market";
}

export function normalizeExternalAiQaEntry(raw: unknown): ExternalAiQaEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question : "";
  const answer = typeof o.answer === "string" ? o.answer : "";
  if (!question.trim() && !answer.trim()) return null;
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId();
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim()
      ? o.createdAt
      : nowIso();
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim()
      ? o.updatedAt
      : createdAt;
  const originCaseId =
    typeof o.originCaseId === "string" && o.originCaseId.trim()
      ? o.originCaseId.trim()
      : null;
  return {
    id,
    category: normalizeCategory(o.category),
    question,
    answer,
    createdAt,
    updatedAt,
    originCaseId,
  };
}

export function normalizeExternalAiQaList(raw: unknown): ExternalAiQaEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ExternalAiQaEntry[] = [];
  for (const item of raw) {
    const entry = normalizeExternalAiQaEntry(item);
    if (entry) out.push(entry);
  }
  return out;
}

export function createExternalAiQaEntry(
  category: ExternalAiQaCategory = "market",
  partial?: Partial<Pick<ExternalAiQaEntry, "question" | "answer" | "originCaseId">>,
): ExternalAiQaEntry {
  const t = nowIso();
  return {
    id: newId(),
    category,
    question: partial?.question ?? "",
    answer: partial?.answer ?? "",
    createdAt: t,
    updatedAt: t,
    originCaseId: partial?.originCaseId ?? null,
  };
}

export function moveExternalAiQaEntry(
  items: ExternalAiQaEntry[],
  index: number,
  direction: -1 | 1,
): ExternalAiQaEntry[] {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [removed] = copy.splice(index, 1);
  copy.splice(next, 0, removed);
  return copy;
}

export function touchExternalAiQaEntries(
  items: ExternalAiQaEntry[],
): ExternalAiQaEntry[] {
  const t = nowIso();
  return items.map((e) => ({ ...e, updatedAt: t }));
}
