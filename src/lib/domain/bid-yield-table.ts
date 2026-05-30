import type { AuctionCase } from "@/lib/types/domain";
import {
  computeInvestmentYieldDerived,
  computeRentSettingDerived,
} from "@/lib/domain/rent-setting";

export type BidYieldRow = {
  bidAmount: number;
  bidRatePct: number | null;
  loanAmount: number;
  netInvestment: number;
  netMonthlyIncome: number;
  netYieldAnnualPct: number | null;
  label: string;
};

export function computeBidYieldTable(
  c: AuctionCase,
  steps = 5,
): BidYieldRow[] {
  const rs = c.rentSetting;
  const derived = computeRentSettingDerived(rs);
  const appraisal = c.appraisalPrice ?? rs.investmentYield.appraisalAmount;
  const base =
    c.decision.maxBidPrice ??
    c.expectedBidPrice ??
    c.auctionBidAnalysis?.lastResult?.suggestedBidWon ??
    c.minPrice ??
    (appraisal != null ? Math.round(appraisal * 0.7) : null);

  if (base == null || base <= 0) return [];

  const pctSteps = [-0.1, -0.05, 0, 0.05, 0.1];
  const amounts =
    steps === 5
      ? pctSteps.map((p) => Math.round(base * (1 + p)))
      : Array.from({ length: steps }, (_, i) => {
          const t = i / (steps - 1);
          return Math.round(base * (0.85 + t * 0.3));
        });

  const unique = [...new Set(amounts)].sort((a, b) => a - b);

  return unique.map((bidAmount) => {
    const v = {
      ...rs.investmentYield,
      bidAmount,
      appraisalAmount: appraisal,
      totalDeposit: derived.totalDeposit,
      totalMonthlyRent: derived.totalMonthlyRent,
      evictionCost: rs.investmentYield.evictionCost,
    };
    const inv = computeInvestmentYieldDerived(v);
    const rate =
      appraisal != null && appraisal > 0
        ? Math.round((bidAmount / appraisal) * 10000) / 100
        : null;
    const isBase = bidAmount === base;
    return {
      bidAmount,
      bidRatePct: rate,
      loanAmount: Math.round(inv.loanAmount),
      netInvestment: Math.round(inv.netInvestment),
      netMonthlyIncome: Math.round(inv.netMonthlyIncome),
      netYieldAnnualPct:
        inv.netYieldAnnualPct != null
          ? Math.round(inv.netYieldAnnualPct * 100) / 100
          : null,
      label: isBase ? "기준" : "",
    };
  });
}
