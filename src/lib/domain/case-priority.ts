import type { AuctionCase, PriorityLevel } from "@/lib/types/domain";
import {
  computeMultiFamilyScore,
  computePreFieldInfoReadiness,
} from "@/lib/domain/multifamily-analysis";

export const PRIORITY_LEVEL_LABELS: Record<PriorityLevel, string> = {
  1: "1단계 · 신규",
  2: "2단계 · 정보보강",
  3: "3단계 · 시스템 권장",
  4: "4단계 · 선호",
  5: "5단계 · 최우선",
};

export function computeRecommendedPriorityLevel(c: AuctionCase): PriorityLevel {
  const score = computeMultiFamilyScore(c);
  const readiness = computePreFieldInfoReadiness(c);
  const hasDocuments = (c.sourceDocuments ?? []).length > 0;
  const hasMarket = c.nearbyMarketAnalysis != null;

  if (
    readiness.completenessPct >= 65 &&
    score.totalScore >= 95 &&
    score.hardFailReasons.length === 0 &&
    (hasDocuments || hasMarket)
  ) {
    return 3;
  }
  if (readiness.completenessPct >= 40 || hasDocuments || hasMarket) {
    return 2;
  }
  return 1;
}

export function effectivePriorityLevel(c: AuctionCase): PriorityLevel {
  if (c.priorityLevel >= 4) return c.priorityLevel;
  return Math.max(c.priorityLevel, computeRecommendedPriorityLevel(c)) as PriorityLevel;
}
