import type {
  MarketReferenceNote,
  MarketReferenceTradeKind,
} from "@/lib/types/domain";

const TRADE_KINDS: MarketReferenceTradeKind[] = [
  "sale",
  "monthly",
  "jeonse",
  "all",
];

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `mrn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTradeKind(raw: unknown): MarketReferenceTradeKind {
  return typeof raw === "string" &&
    (TRADE_KINDS as string[]).includes(raw)
    ? (raw as MarketReferenceTradeKind)
    : "all";
}

export function normalizeMarketReferenceNotes(raw: unknown): MarketReferenceNote[] {
  if (!Array.isArray(raw)) return [];
  const out: MarketReferenceNote[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const content = typeof o.content === "string" ? o.content : "";
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
    out.push({
      id,
      tradeKind: normalizeTradeKind(o.tradeKind),
      content,
      createdAt,
      updatedAt,
    });
  }
  return out;
}

export function createMarketReferenceNote(
  tradeKind: MarketReferenceTradeKind = "all",
): MarketReferenceNote {
  const t = nowIso();
  return {
    id: newId(),
    tradeKind,
    content: "",
    createdAt: t,
    updatedAt: t,
  };
}

export const MARKET_REFERENCE_TRADE_LABEL: Record<
  MarketReferenceTradeKind,
  string
> = {
  sale: "매매",
  monthly: "월세",
  jeonse: "전세",
  all: "공통",
};
