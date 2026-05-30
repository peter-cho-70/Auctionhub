import {
  detectAuctionPdfFormat,
  parseSpeedAuctionPdfText,
} from "@/lib/pdf/speed-auction-pdf-parser";

export type AuctionPdfFormat = "speedauction" | "auctionone";

export type SpeedAuctionBidSchedule = {
  round: string | null;
  date: string | null;
  minimumPrice: number | null;
  result: string | null;
  isCurrent?: boolean;
};

export type SpeedAuctionFloor = {
  floor: string;
  structure: string | null;
  useType: string | null;
  areaSqm: number | null;
  appraisalPrice: number | null;
};

export type SpeedAuctionNearbyStat = {
  period: string;
  saleCount: number;
  avgAppraisal: number | null;
  avgSalePrice: number | null;
  saleRatePct: number | null;
  failCountAvg: number | null;
  estimatedPrice: number | null;
};

export type AuctionPdfExtract = {
  format: AuctionPdfFormat;
  caseNumber: string | null;
  address: string | null;
  propertyType: string | null;
  appraisalPrice: number | null;
  minPrice: number | null;
  bidDate: string | null;
  landAreaSqm: number | null;
  buildingAreaSqm: number | null;
  parkingUnitCount: number | null;
  builtYear: string | null;
  winningBidPrice: number | null;
  bidRatePct: number | null;
  soldRound: number | null;
  notes: string;
  /** 스피드옥션 확장 */
  addressJibun?: string | null;
  addressRoad?: string | null;
  zipCode?: string | null;
  court?: string | null;
  auctionType?: string | null;
  auctionDivision?: string | null;
  contactPhone?: string | null;
  minPriceRatePct?: number | null;
  depositAmount?: number | null;
  depositRatePct?: number | null;
  claimAmount?: number | null;
  owner?: string | null;
  debtor?: string | null;
  creditor?: string | null;
  saleTarget?: string | null;
  landAppraisal?: number | null;
  buildingAppraisal?: number | null;
  builtYearSource?: string | null;
  appraisalDate?: string | null;
  appraisalCompany?: string | null;
  caseReceivedDate?: string | null;
  auctionStartDate?: string | null;
  dividendDeadline?: string | null;
  currentRound?: number | null;
  auctionStatus?: "ongoing" | "sold" | null;
  zoning?: string | null;
  landCategory?: string | null;
  officialLandPricePerSqm?: number | null;
  officialLandPriceDate?: string | null;
  tenantDepositTotal?: number | null;
  tenantMonthlyRentTotal?: number | null;
  householdCountHint?: number | null;
  bidSchedules?: SpeedAuctionBidSchedule[];
  buildingFloors?: SpeedAuctionFloor[];
  nearbyStats?: SpeedAuctionNearbyStat[];
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseKrwAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function parseNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseIsoDateFromDotFormat(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const y = m[1]!;
  const mm = String(m[2]!).padStart(2, "0");
  const dd = String(m[3]!).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseAuctionOnePdfText(text: string): AuctionPdfExtract {
  const t = text ?? "";

  const caseNumber =
    t.match(/(\d{4}\s*타경\s*\d{3,})/)?.[1]?.replace(/\s+/g, "") ?? null;

  const address = (() => {
    const m =
      t.match(/소\s*재\s*지\s*([^\n]+)\n/)?.[1] ??
      t.match(/소\s*재\s*지\s*([^\n]+)/)?.[1];
    return m ? clean(m) : null;
  })();

  const propertyType = (() => {
    const m = t.match(/물건종별\s*([^\n]+?)\s*감\s*정\s*가/)?.[1];
    return m ? clean(m) : null;
  })();

  const appraisalPrice = parseKrwAmount(
    t.match(/감\s*정\s*가\s*([\d,]+)\s*원/)?.[1],
  );

  const minPrice = parseKrwAmount(
    t.match(/최\s*저\s*가\s*\([^)]*\)\s*([\d,]+)\s*원/)?.[1] ??
      t.match(/최저매각가격\s*([\d,]+)\s*원/)?.[1],
  );

  const bidDate =
    parseIsoDateFromDotFormat(
      t.match(/매각기일\s*:\s*(\d{4}\.\d{1,2}\.\d{1,2})/)?.[1],
    ) ??
    parseIsoDateFromDotFormat(
      t.match(/\b(\d{4}\.\d{1,2}\.\d{1,2})\b.*?\(10:00\)/)?.[1],
    );

  const landAreaSqm = parseNumber(
    t.match(/토지면적\s*([\d.,]+)\s*㎡/)?.[1],
  );

  const buildingAreaSqm = parseNumber(
    t.match(/건물면적\s*([\d.,]+)\s*㎡/)?.[1],
  );

  const parkingUnitCount = (() => {
    const m =
      t.match(/총주차대수\s*(\d+)\s*대/)?.[1] ??
      t.match(/주차\s*대수\s*(\d+)\s*대/)?.[1];
    return m ? parseNumber(m) : null;
  })();

  const builtYear = (() => {
    const m =
      t.match(/사용승인일\s*[\s:]*([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2})/)?.[1] ??
      t.match(/사용승인[:\s]*([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2})/)?.[1] ??
      t.match(/보존등기일\s*[:\s]*([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2})/)?.[1] ??
      t.match(/\b(19|20)\d{2}\s*년\b/)?.[0];
    if (!m) return null;
    const ymd = parseIsoDateFromDotFormat(m);
    if (ymd) return ymd;
    const yearOnly = m.match(/\b(19|20)\d{2}\b/)?.[0];
    return yearOnly ?? clean(m);
  })();

  const winningSale = (() => {
    const m =
      t.match(/매각\s*:\s*([\d,]+)\s*원\s*\(([\d.]+)\s*%\)/) ??
      t.match(/매각가\s*([\d,]+)\s*원\s*\(([\d.]+)\s*%\)/);
    if (!m) return { price: null as number | null, rate: null as number | null };
    const rate = parseFloat(m[2]!.replace(/,/g, ""));
    return {
      price: parseKrwAmount(m[1]),
      rate: Number.isFinite(rate) ? rate : null,
    };
  })();

  const soldRound = (() => {
    if (winningSale.price == null) return null;
    const inline = t.match(
      /(\d)\s*차\s+\d{4}-\d{2}-\d{2}\s+[\d,]+\s*원[\s\S]{0,48}?매각\s*:/,
    );
    if (inline) {
      const n = parseInt(inline[1]!, 10);
      return Number.isFinite(n) ? n : null;
    }
    const failCount = (t.match(/유찰/g) ?? []).length;
    if (failCount > 0) return failCount + 1;
    const roundHint = t.match(/(\d)\s*차\s+\d{4}-\d{2}-\d{2}/g);
    return roundHint?.length ?? 1;
  })();

  const builtYearFromBuilding = (() => {
    const m = t.match(/사용승인일\s+(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (m) {
      return `${m[1]!}-${String(m[2]!).padStart(2, "0")}-${String(m[3]!).padStart(2, "0")}`;
    }
    return null;
  })();

  const notes = (() => {
    const lines = t
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const picked: string[] = [];
    for (const l of lines) {
      if (
        l.startsWith("참고사항") ||
        l.startsWith("☞") ||
        l.startsWith("▶") ||
        l.startsWith("*")
      ) {
        picked.push(l);
      }
    }
    return picked.slice(0, 40).join("\n");
  })();

  return {
    format: "auctionone",
    caseNumber,
    address,
    propertyType,
    appraisalPrice,
    minPrice,
    bidDate,
    landAreaSqm,
    buildingAreaSqm,
    parkingUnitCount,
    builtYear: builtYearFromBuilding ?? builtYear ?? null,
    winningBidPrice: winningSale.price,
    bidRatePct: winningSale.rate,
    soldRound,
    notes,
    auctionStatus: winningSale.price != null ? "sold" : "ongoing",
  };
}

export function parseAuctionPdfText(text: string): AuctionPdfExtract {
  const format = detectAuctionPdfFormat(text);
  if (format === "speedauction") {
    return parseSpeedAuctionPdfText(text);
  }
  return parseAuctionOnePdfText(text);
}
