import { parseWonInput } from "@/lib/format/won";
import type {
  RentInvestmentYield,
  RentSetting,
  RentSettingUnitCounts,
  RentSettingUnitRow,
} from "@/lib/types/domain";

/** 제곱미터법 기준 1평 ≈ 3.305785㎡ */
export const PYEONG_TO_SQM = 3.305785;

function rowId(i: number): string {
  return `rent-row-${i}`;
}

export function emptyRentSetting(): RentSetting {
  const unitRows: RentSettingUnitRow[] = Array.from({ length: 12 }, (_, i) => ({
    id: rowId(i),
    floor: "",
    unitNo: "",
    roomType: "",
    deposit: null,
    monthlyRent: null,
    areaPyeong: null,
    note: "",
  }));
  return {
    sheetUrl: "",
    landCategory: "",
    grossFloorAreaPyeong: null,
    grossFloorAreaSqm: null,
    salePrice: null,
    loanAmount: null,
    annualRate: null,
    publicLandPrice: null,
    buildingViolation: "",
    violationDetail: "",
    builtYear: "",
    facing: "",
    parkingCount: "",
    allocationNote: "",
    ownerOccupiedNote: "",
    lhHug: "",
    detailMemo: "",
    unitCounts: {
      commercial: 0,
      oneRoom: 0,
      oneHalfRoom: 0,
      twoRoom: 0,
      threeRoom: 0,
      ownerUnit: 0,
    },
    unitRows,
    investmentYield: emptyInvestmentYield(),
  };
}

export function emptyInvestmentYield(): RentInvestmentYield {
  return {
    bidAmount: null,
    evictionCost: null,
    acquisitionTaxRate: 0.045,
    appraisalAmount: null,
    loanToValueRatio: 0.67,
    loanAnnualRate: 0.047,
    totalDeposit: null,
    totalMonthlyRent: null,
    marketPrice: null,
  };
}

export function newRentUnitRow(): RentSettingUnitRow {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `ru-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    floor: "",
    unitNo: "",
    roomType: "",
    deposit: null,
    monthlyRent: null,
    areaPyeong: null,
    note: "",
  };
}

export interface RentSettingDerived {
  totalDeposit: number;
  totalMonthlyRent: number;
  equity: number;
  monthlyInterest: number;
  monthlyNet: number;
  yieldAnnualPct: number | null;
}

/** 엑셀 시트와 동일: E50/F50 합계, C9/F9/H9/C10 수식 */
export function computeRentSettingDerived(s: RentSetting): RentSettingDerived {
  let totalDeposit = 0;
  let totalMonthlyRent = 0;
  for (const r of s.unitRows) {
    totalDeposit += r.deposit ?? 0;
    totalMonthlyRent += r.monthlyRent ?? 0;
  }
  const sale = s.salePrice ?? 0;
  const loan = s.loanAmount ?? 0;
  const rate = s.annualRate ?? 0;
  const equity = sale - loan - totalDeposit;
  const monthlyInterest = (loan * rate) / 365 * 30;
  const monthlyNet = totalMonthlyRent - monthlyInterest;
  const yieldAnnualPct =
    equity > 0 ? (monthlyNet * 12 * 100) / equity : null;
  return {
    totalDeposit,
    totalMonthlyRent,
    equity,
    monthlyInterest,
    monthlyNet,
    yieldAnnualPct,
  };
}

export interface InvestmentYieldDerived {
  acquisitionTax: number;
  totalInvestment: number;
  loanAmount: number;
  monthlyLoanInterest: number;
  equityAfterLoan: number;
  netInvestment: number;
  netMonthlyIncome: number;
  netYieldAnnualPct: number | null;
  priceGain: number;
}

/** 수익표 sheet3 수식 (금액 원) */
export function computeInvestmentYieldDerived(
  v: RentInvestmentYield,
): InvestmentYieldDerived {
  const bid = v.bidAmount ?? 0;
  const eviction = v.evictionCost ?? 0;
  const acqRate = v.acquisitionTaxRate ?? 0;
  const acquisitionTax = bid * acqRate;
  const totalInvestment = bid + eviction + acquisitionTax;
  const appraisal = v.appraisalAmount ?? 0;
  const ltv = v.loanToValueRatio ?? 0;
  const loanAmount = Math.min(appraisal * ltv, bid * 0.9);
  const loanRate = v.loanAnnualRate ?? 0;
  const monthlyLoanInt = (loanAmount * loanRate) / 365 * 30;
  const equityAfterLoan = totalInvestment - loanAmount;
  const deposit = v.totalDeposit ?? 0;
  const netInvestment = equityAfterLoan - deposit;
  const rent = v.totalMonthlyRent ?? 0;
  const netMonthly = rent - monthlyLoanInt;
  const netYieldAnnualPct =
    netInvestment > 0 ? (netMonthly * 12 * 100) / netInvestment : null;
  const market = v.marketPrice ?? 0;
  const priceGain = market - totalInvestment;
  return {
    acquisitionTax,
    totalInvestment,
    loanAmount,
    monthlyLoanInterest: monthlyLoanInt,
    equityAfterLoan,
    netInvestment,
    netMonthlyIncome: netMonthly,
    netYieldAnnualPct,
    priceGain,
  };
}

function clampUint(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

function normalizeCounts(raw: unknown): RentSettingUnitCounts {
  const base = emptyRentSetting().unitCounts;
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    commercial: clampUint(Number(o.commercial), 999),
    oneRoom: clampUint(Number(o.oneRoom), 999),
    oneHalfRoom: clampUint(Number(o.oneHalfRoom), 999),
    twoRoom: clampUint(Number(o.twoRoom), 999),
    threeRoom: clampUint(Number(o.threeRoom), 999),
    ownerUnit: clampUint(Number(o.ownerUnit), 999),
  };
}

function normalizeMoney(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  if (typeof n === "number" && Number.isFinite(n)) {
    const v = Math.max(-1e15, Math.min(1e15, n));
    return Math.round(v);
  }
  if (typeof n === "string") {
    const parsed = parseWonInput(n);
    if (parsed == null || !Number.isFinite(parsed)) return null;
    const v = Math.max(-1e15, Math.min(1e15, parsed));
    return Math.round(v);
  }
  return null;
}

function normalizePyeong(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.round(Math.min(999999, Math.max(0, n)) * 100) / 100;
  }
  return null;
}

function normalizeSqm(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
    return Math.round(Math.min(1e9, n) * 100) / 100;
  }
  return null;
}

function normalizeRows(raw: unknown): RentSettingUnitRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return emptyRentSetting().unitRows;
  }
  return raw.map((item, i) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id
        : rowId(i);
    return {
      id,
      floor: typeof o.floor === "string" ? o.floor : "",
      unitNo: typeof o.unitNo === "string" ? o.unitNo : "",
      roomType: typeof o.roomType === "string" ? o.roomType : "",
      deposit: normalizeMoney(o.deposit),
      monthlyRent: normalizeMoney(o.monthlyRent),
      areaPyeong: normalizePyeong(o.areaPyeong),
      note: typeof o.note === "string" ? o.note : "",
    };
  });
}

const MAN_WON = 10_000;

function pickWonAfterManMigration(
  o: Record<string, unknown>,
  wonKey: string,
  manKey: string,
): number | null {
  const fromWon = normalizeMoney(o[wonKey]);
  if (fromWon != null) return fromWon;
  const fromMan = o[manKey];
  if (typeof fromMan === "number" && Number.isFinite(fromMan)) {
    return Math.round(
      Math.min(1e15, Math.max(-1e15, fromMan * MAN_WON)),
    );
  }
  return null;
}

function normalizeInvestmentYield(raw: unknown): RentInvestmentYield {
  const b = emptyInvestmentYield();
  if (!raw || typeof raw !== "object") return b;
  const o = raw as Record<string, unknown>;
  const ratio = (x: unknown): number | null => {
    if (x === null || x === undefined) return null;
    if (typeof x === "number" && Number.isFinite(x)) {
      return Math.min(1, Math.max(0, x));
    }
    return null;
  };
  return {
    bidAmount: pickWonAfterManMigration(o, "bidAmount", "bidAmountMan"),
    evictionCost: pickWonAfterManMigration(
      o,
      "evictionCost",
      "evictionCostMan",
    ),
    acquisitionTaxRate:
      ratio(o.acquisitionTaxRate) ?? b.acquisitionTaxRate,
    appraisalAmount: pickWonAfterManMigration(
      o,
      "appraisalAmount",
      "appraisalAmountMan",
    ),
    loanToValueRatio: ratio(o.loanToValueRatio) ?? b.loanToValueRatio,
    loanAnnualRate: ratio(o.loanAnnualRate) ?? b.loanAnnualRate,
    totalDeposit: pickWonAfterManMigration(
      o,
      "totalDeposit",
      "totalDepositMan",
    ),
    totalMonthlyRent: pickWonAfterManMigration(
      o,
      "totalMonthlyRent",
      "totalMonthlyRentMan",
    ),
    marketPrice: pickWonAfterManMigration(
      o,
      "marketPrice",
      "marketPriceMan",
    ),
  };
}

export function normalizeRentSetting(raw: unknown): RentSetting {
  const base = emptyRentSetting();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    sheetUrl: typeof o.sheetUrl === "string" ? o.sheetUrl : "",
    landCategory: typeof o.landCategory === "string" ? o.landCategory : "",
    grossFloorAreaPyeong: normalizePyeong(o.grossFloorAreaPyeong),
    grossFloorAreaSqm: (() => {
      let sqm = normalizeSqm(o.grossFloorAreaSqm);
      if (sqm == null) {
        const py = normalizePyeong(o.grossFloorAreaPyeong);
        if (py != null) {
          sqm = Math.round(py * PYEONG_TO_SQM * 100) / 100;
        }
      }
      return sqm;
    })(),
    salePrice: normalizeMoney(o.salePrice),
    loanAmount: normalizeMoney(o.loanAmount),
    annualRate:
      o.annualRate === null || o.annualRate === undefined
        ? null
        : typeof o.annualRate === "number" && Number.isFinite(o.annualRate)
          ? Math.min(1, Math.max(0, o.annualRate))
          : null,
    publicLandPrice: normalizeMoney(o.publicLandPrice),
    buildingViolation:
      typeof o.buildingViolation === "string" ? o.buildingViolation : "",
    violationDetail:
      typeof o.violationDetail === "string" ? o.violationDetail : "",
    builtYear: typeof o.builtYear === "string" ? o.builtYear : "",
    facing: typeof o.facing === "string" ? o.facing : "",
    parkingCount: typeof o.parkingCount === "string" ? o.parkingCount : "",
    allocationNote:
      typeof o.allocationNote === "string" ? o.allocationNote : "",
    ownerOccupiedNote:
      typeof o.ownerOccupiedNote === "string" ? o.ownerOccupiedNote : "",
    lhHug: typeof o.lhHug === "string" ? o.lhHug : "",
    detailMemo: typeof o.detailMemo === "string" ? o.detailMemo : "",
    unitCounts: normalizeCounts(o.unitCounts),
    unitRows: normalizeRows(o.unitRows),
    investmentYield: normalizeInvestmentYield(o.investmentYield),
  };
}
