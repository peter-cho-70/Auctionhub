import type {
  AuctionCase,
  PostAuctionLoanCounselorResult,
} from "@/lib/types/domain";
import {
  arrayRecords,
  getDocumentAnalysisPayload,
  numberValue,
  textValue,
} from "@/lib/domain/case-document-payload";
import { parseWonInput } from "@/lib/format/won";

export function computeMonthlyLoanInterest(
  loanAmount: number | null,
  annualRate: number | null,
): number | null {
  if (loanAmount == null || loanAmount <= 0) return null;
  if (annualRate == null || annualRate < 0) return null;
  return (loanAmount * annualRate) / 365 * 30;
}

/** 낙찰가: 문자 보조값 → decision → null */
export function resolveWinningBidPrice(
  c: AuctionCase,
  extras: Record<string, string>,
): number | null {
  const extra = extras["낙찰가"]?.trim() ?? "";
  if (extra) {
    const n = parseWonInput(extra);
    if (n != null) return n;
  }
  if (c.decision.actualBidPrice != null) return c.decision.actualBidPrice;
  return null;
}

export function resolveAppraisalPrice(c: AuctionCase): number | null {
  return c.appraisalPrice;
}

export interface LoanLimitSummary {
  appraisal: number | null;
  winningBid: number | null;
  collateralRatio: number | null;
  fromAppraisal: number | null;
  bidCap90: number | null;
  theoreticalLimit: number | null;
  confirmedLimit: number | null;
  limitVsBidPct: number | null;
  limitVsAppraisalPct: number | null;
}

export function computeLoanLimitSummary(
  c: AuctionCase,
  extras: Record<string, string>,
  collateralRatio: number | null,
  confirmedLimit: number | null,
): LoanLimitSummary {
  const appraisal = resolveAppraisalPrice(c);
  const winningBid = resolveWinningBidPrice(c, extras);
  const ratio =
    collateralRatio ??
    c.rentSetting.investmentYield.loanToValueRatio ??
    null;
  const fromAppraisal =
    appraisal != null && ratio != null ? Math.round(appraisal * ratio) : null;
  const bidCap90 =
    winningBid != null ? Math.round(winningBid * 0.9) : null;
  let theoreticalLimit: number | null = null;
  if (fromAppraisal != null && bidCap90 != null) {
    theoreticalLimit = Math.min(fromAppraisal, bidCap90);
  } else if (fromAppraisal != null) {
    theoreticalLimit = fromAppraisal;
  } else if (bidCap90 != null) {
    theoreticalLimit = bidCap90;
  }
  const limit = confirmedLimit ?? theoreticalLimit;
  const limitVsBidPct =
    winningBid != null && winningBid > 0 && limit != null
      ? Math.round((limit / winningBid) * 1000) / 10
      : null;
  const limitVsAppraisalPct =
    appraisal != null && appraisal > 0 && limit != null
      ? Math.round((limit / appraisal) * 1000) / 10
      : null;
  return {
    appraisal,
    winningBid,
    collateralRatio: ratio,
    fromAppraisal,
    bidCap90,
    theoreticalLimit,
    confirmedLimit,
    limitVsBidPct,
    limitVsAppraisalPct,
  };
}

/** 등기부 권리에서 근저당 요약 (상담사 답변 참고용) */
export function summarizeMortgageRights(c: AuctionCase): string {
  const lines: string[] = [];
  let total = 0;
  for (const doc of c.sourceDocuments) {
    const { buildingRegistry, landRegistry } = getDocumentAnalysisPayload(doc);
    for (const [label, reg] of [
      ["건물", buildingRegistry],
      ["토지", landRegistry],
    ] as const) {
      if (!reg) continue;
      for (const right of arrayRecords(reg.rights)) {
        const type = textValue(right.type);
        if (!/근저당|저당/.test(type)) continue;
        const amount = numberValue(right.amount);
        if (amount != null) total += amount;
        const date = textValue(right.registration_date ?? right.date);
        lines.push(
          `${label} ${type}${date ? ` (${date})` : ""}${
            amount != null ? ` ${amount.toLocaleString("ko-KR")}원` : ""
          }`,
        );
      }
    }
  }
  if (!lines.length) {
    if (c.lienBaseline.trim()) return `말소기준: ${c.lienBaseline}`;
    return "";
  }
  const head =
    total > 0
      ? `근저당 합계 약 ${total.toLocaleString("ko-KR")}원`
      : "근저당 권리";
  return `${head}\n${lines.join("\n")}`;
}

export function emptyPostAuctionLoanCounselorResult(): PostAuctionLoanCounselorResult {
  return {
    collateralRatio: null,
    mortgageSummary: "",
    trustSummary: "",
    confirmedLoanLimit: null,
    annualRate: null,
    notes: "",
  };
}
