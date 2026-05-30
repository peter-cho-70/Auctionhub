import type {
  AuctionPdfExtract,
  AuctionPdfFormat,
  SpeedAuctionBidSchedule,
  SpeedAuctionFloor,
  SpeedAuctionNearbyStat,
} from "@/lib/pdf/auction-pdf-parser";

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseKrwAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function parseNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function parseIsoDateFlexible(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

export function detectAuctionPdfFormat(text: string): AuctionPdfFormat {
  if (/스피드옥션|speedauction\.co\.kr/i.test(text)) return "speedauction";
  if (
    /매각기일[^0-9]*\d{4}-\d{2}-\d{2}/.test(text) &&
    /용도[\s\t]+[^\n\t]+[\s\t]+채권자/.test(text)
  ) {
    return "speedauction";
  }
  if (/물건종별\s*[^\n]+\s*감\s*정\s*가/.test(text) && /소\s*재\s*지/.test(text)) {
    return "auctionone";
  }
  return "speedauction";
}

function parseSpeedAuctionBidSchedules(text: string): SpeedAuctionBidSchedule[] {
  const block = text.match(
    /회차\s+매각기일\s+최저매각금액\s+결과([\s\S]*?)(?=모의입찰|감정평가현황)/,
  )?.[1];
  if (!block) return [];

  const schedules: SpeedAuctionBidSchedule[] = [];
  for (const line of block.split("\n").map(clean).filter(Boolean)) {
    const withRound = line.match(
      /^(?:(\d+)차|신건)\s+(\d{4}-\d{2}-\d{2})\s+([\d,]+)\s*원(?:\s+(.+))?$/,
    );
    if (withRound) {
      schedules.push({
        round: withRound[1] === "신건" ? "신건" : `${withRound[1]}차`,
        date: withRound[2]!,
        minimumPrice: parseKrwAmount(withRound[3]),
        result: withRound[4] ? clean(withRound[4]) : null,
        isCurrent: false,
      });
      continue;
    }
    const dateOnly = line.match(
      /^(\d{4}-\d{2}-\d{2})\s+([\d,]+)\s*원(?:\s+(.+))?$/,
    );
    if (dateOnly) {
      schedules.push({
        round: null,
        date: dateOnly[1]!,
        minimumPrice: parseKrwAmount(dateOnly[2]),
        result: dateOnly[3] ? clean(dateOnly[3]) : null,
        isCurrent: false,
      });
    }
  }

  const current = text.match(
    /(\d+)차\s+(\d{4}-\d{2}-\d{2})\s+([\d,]+)\s*원/,
  );
  if (current) {
    const date = current[2]!;
    const price = parseKrwAmount(current[3]);
    const idx = schedules.findIndex(
      (s) => s.date === date && s.minimumPrice === price,
    );
    if (idx >= 0) {
      schedules[idx]!.isCurrent = true;
      schedules[idx]!.round = `${current[1]}차`;
    } else {
      schedules.push({
        round: `${current[1]}차`,
        date,
        minimumPrice: price,
        result: null,
        isCurrent: true,
      });
    }
  }

  return schedules;
}

function parseSpeedAuctionFloors(text: string): SpeedAuctionFloor[] {
  const floors: SpeedAuctionFloor[] = [];
  const re =
    /(\d+)층\s+철근콘크리트조\s+([^\t\n]+?)\s+([\d.]+)㎡(?:\([^)]+\))?\s+[\d,]+원\s+([\d,]+)원/g;
  for (const m of text.matchAll(re)) {
    floors.push({
      floor: `${m[1]}층`,
      structure: "철근콘크리트조",
      useType: clean(m[2]!),
      areaSqm: parseNumber(m[3]),
      appraisalPrice: parseKrwAmount(m[4]),
    });
  }
  return floors;
}

function parseNearbyStats(text: string): SpeedAuctionNearbyStat[] {
  const block = text.match(/인근\s*통계[\s\S]*?(?=계획고시공고|$)/)?.[0];
  if (!block) return [];

  const stats: SpeedAuctionNearbyStat[] = [];
  for (const m of block.matchAll(
    /(\d+개월)\s+(\d+)건\s+([\d,]+)원\s+([\d,]+)원\s+([\d.]+)%\s+([\d.]+)회\s+([\d,]+)원/g,
  )) {
    stats.push({
      period: m[1]!,
      saleCount: parseInt(m[2]!, 10),
      avgAppraisal: parseKrwAmount(m[3]),
      avgSalePrice: parseKrwAmount(m[4]),
      saleRatePct: parseNumber(m[5]),
      failCountAvg: parseNumber(m[6]),
      estimatedPrice: parseKrwAmount(m[7]),
    });
  }
  return stats;
}

function buildSpeedAuctionNotes(text: string, extra: string[]): string {
  const picked: string[] = [...extra];
  const remark = text.match(/비고\s*\n([\s\S]*?)(?=다성감정|건물현황)/)?.[1];
  if (remark) {
    for (const line of remark.split("\n").map(clean).filter(Boolean)) {
      if (line.length > 2) picked.push(line);
    }
  }
  const caution = text.match(
    /주의사항\s*\/\s*법원문건접수\s*요약\s*\n([\s\S]*?)(?=부동산종합공부|$)/,
  )?.[1];
  if (caution) picked.push(clean(caution.slice(0, 500)));
  return picked.slice(0, 30).join("\n");
}

function countHouseholdHint(text: string): number | null {
  const m = text.match(
    /다중주택\s*\((\d+)개호[^)]*\)[^)]*다중주택\s*\((\d+)개호[^)]*\)[^)]*다중주택\s*\((\d+)개호/,
  );
  if (m) {
    return (
      parseInt(m[1]!, 10) + parseInt(m[2]!, 10) + parseInt(m[3]!, 10)
    );
  }
  const units = new Set([...text.matchAll(/(\d{3})호/g)].map((x) => x[1]));
  return units.size > 0 ? units.size : null;
}

export function parseSpeedAuctionPdfText(text: string): AuctionPdfExtract {
  const t = text ?? "";

  const caseNumber =
    t.match(/(\d{4}\s*타경\s*\d+)/)?.[1]?.replace(/\s+/g, "") ?? null;

  const court = t.match(/^([^\n]+지방법원)/m)?.[1]?.trim() ?? null;

  const headerLine = t.match(/\d{4}\s*타경\s*\d+[^\n]*/)?.[0];
  const auctionType = headerLine?.match(/\(([^)]+)\)/)?.[1] ?? null;
  const auctionDivision = headerLine?.match(/경매\d+계/)?.[0] ?? null;
  const contactPhone = headerLine?.match(/(\d{2,3}-\d{3,4}-\d{4})/)?.[1] ?? null;

  const addressJibun =
    clean(t.match(/\(\d{5}\)\s*([^\n\[]+)/)?.[1] ?? "") || null;
  const addressRoad =
    clean(t.match(/\[도로명주소\]\s*([^\n]+)/)?.[1] ?? "") || null;
  const address = addressRoad ?? addressJibun;
  const zipCode = t.match(/\((\d{5})\)/)?.[1] ?? null;

  const propertyType =
    clean(t.match(/용도\s+([^\t\n]+)/)?.[1] ?? "") || null;

  const appraisalPrice = parseKrwAmount(
    t.match(/감정가\s+([\d,]+)\s*원/)?.[1],
  );

  const minPriceMatch = t.match(/최저가\s+\((\d+)%\)\s*([\d,]+)\s*원/);
  const minPrice = parseKrwAmount(minPriceMatch?.[2]);
  const minPriceRatePct = minPriceMatch?.[1]
    ? parseInt(minPriceMatch[1], 10)
    : null;

  const depositMatch = t.match(/보증금\s+\((\d+)%\)\s*([\d,]+)\s*원/);
  const depositAmount = parseKrwAmount(depositMatch?.[2]);
  const depositRatePct = depositMatch?.[1]
    ? parseInt(depositMatch[1], 10)
    : null;

  const claimAmount = parseKrwAmount(
    t.match(/청구금액\s+([\d,]+)\s*원/)?.[1],
  );

  const owner = clean(t.match(/소유자\s+([^\t\n]+)/)?.[1] ?? "") || null;
  const debtor = clean(t.match(/채무자\s+([^\t\n]+)/)?.[1] ?? "") || null;
  const creditor = clean(t.match(/채권자\s+([^\t\n]+)/)?.[1] ?? "") || null;
  const saleTarget = clean(t.match(/매각대상\s+([^\t\n]+)/)?.[1] ?? "") || null;

  const bidDate =
    parseIsoDateFlexible(
      t.match(/매각기일[^0-9]*(\d{4}-\d{2}-\d{2})/)?.[1],
    ) ?? null;

  const landAreaSqm = parseNumber(
    t.match(/토지면적\s+([\d.]+)\s*㎡/)?.[1],
  );
  const buildingAreaSqm = parseNumber(
    t.match(/건물면적\s+([\d.]+)\s*㎡/)?.[1],
  );

  const landAppraisal = parseKrwAmount(
    t.match(
      /감정평가현황[\s\S]*?토지\s+건물[\s\S]*?\n([\d,]+)원\s+([\d,]+)원/,
    )?.[1],
  );
  const buildingAppraisal = parseKrwAmount(
    t.match(
      /감정평가현황[\s\S]*?토지\s+건물[\s\S]*?\n([\d,]+)원\s+([\d,]+)원/,
    )?.[2],
  );

  const builtYear =
    parseIsoDateFlexible(
      t.match(/소유권\s*보존등기일\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
    ) ??
    parseIsoDateFlexible(
      t.match(/사용승인일\s*[:\s]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/)?.[1],
    );

  const builtYearSource = t.match(/소유권\s*보존등기일/)
    ? "소유권 보존등기일"
    : t.match(/사용승인일/)
      ? "사용승인일"
      : null;

  const appraisalDate = parseIsoDateFlexible(
    t.match(/가격시점\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
  );
  const appraisalCompany =
    clean(t.match(/([^\n,]+감정)\s*,\s*가격시점/)?.[1] ?? "") || null;

  const caseReceivedDate = parseIsoDateFlexible(
    t.match(/사건접수\s+(\d{4}-\d{2}-\d{2})/)?.[1],
  );
  const auctionStartDate = parseIsoDateFlexible(
    t.match(/개시결정\s+(\d{4}-\d{2}-\d{2})/)?.[1],
  );
  const dividendDeadline = parseIsoDateFlexible(
    t.match(/배당종기일\s+(\d{4}-\d{2}-\d{2})/)?.[1],
  );

  const bidSchedules = parseSpeedAuctionBidSchedules(t);
  const currentRoundMatch = t.match(/(\d+)차\s+\d{4}-\d{2}-\d{2}\s+[\d,]+원/);
  const currentRound = currentRoundMatch
    ? parseInt(currentRoundMatch[1]!, 10)
    : null;

  const winningSale = (() => {
    const m =
      t.match(/매각\s*:\s*([\d,]+)\s*원\s*\(([\d.]+)\s*%\)/) ??
      t.match(/매각가\s*([\d,]+)\s*원\s*\(([\d.]+)\s*%\)/);
    if (!m) return { price: null as number | null, rate: null as number | null };
    return {
      price: parseKrwAmount(m[1]),
      rate: parseNumber(m[2]),
    };
  })();

  const soldRound = winningSale.price != null ? currentRound : null;
  const auctionStatus = winningSale.price != null ? "sold" : "ongoing";

  const zoning =
    clean(
      t.match(/토지이용계획\s+([^\t\n]+)/)?.[1] ??
        t.match(/(제\d+종[^\n*]+)/)?.[1] ??
        "",
    ) || null;
  const landCategory =
    clean(t.match(/지목\/면적\s+([^\(]+)/)?.[1] ?? "") || null;

  const officialLandPricePerSqm = parseKrwAmount(
    t.match(/공시지가[^\n→]*→\s*([\d,]+)원\s*\/\s*㎡/)?.[1],
  );
  const officialLandPriceDate =
    t.match(/기준일\s*:\s*(\d{4}\/\d{2})/)?.[1] ?? null;

  const tenantDepositTotal = parseKrwAmount(
    t.match(/보증금합계\s*:\s*\n?\s*([\d,]+)\s*원/)?.[1],
  );
  const tenantMonthlyRentTotal = parseKrwAmount(
    t.match(/월세합계\s*:\s*([\d,]+)\s*원/)?.[1],
  );

  const buildingFloors = parseSpeedAuctionFloors(t);
  const nearbyStats = parseNearbyStats(t);
  const householdCountHint = countHouseholdHint(t);

  const parkingUnitCount = (() => {
    const m =
      t.match(/총주차대수\s*(\d+)\s*대/)?.[1] ??
      t.match(/주차\s*대수\s*(\d+)\s*대/)?.[1];
    return m ? parseNumber(m) : null;
  })();

  const notes = buildSpeedAuctionNotes(
    t,
    [
      auctionStatus === "ongoing"
        ? `※ 진행 중 경매 (다음 기일 ${bidDate ?? "미상"})`
        : "",
      tenantDepositTotal
        ? `임차 보증금 합계 ${tenantDepositTotal.toLocaleString("ko-KR")}원`
        : "",
    ].filter(Boolean),
  );

  return {
    format: "speedauction",
    caseNumber,
    address,
    addressJibun,
    addressRoad,
    zipCode,
    court,
    auctionType,
    auctionDivision,
    contactPhone,
    propertyType,
    appraisalPrice,
    minPrice,
    minPriceRatePct,
    depositAmount,
    depositRatePct,
    claimAmount,
    owner,
    debtor,
    creditor,
    saleTarget,
    bidDate,
    landAreaSqm,
    buildingAreaSqm,
    landAppraisal,
    buildingAppraisal,
    parkingUnitCount,
    builtYear,
    builtYearSource,
    appraisalDate,
    appraisalCompany,
    caseReceivedDate,
    auctionStartDate,
    dividendDeadline,
    currentRound,
    auctionStatus,
    winningBidPrice: winningSale.price,
    bidRatePct: winningSale.rate,
    soldRound,
    zoning,
    landCategory,
    officialLandPricePerSqm,
    officialLandPriceDate,
    tenantDepositTotal,
    tenantMonthlyRentTotal,
    householdCountHint,
    bidSchedules,
    buildingFloors,
    nearbyStats,
    notes,
  };
}
