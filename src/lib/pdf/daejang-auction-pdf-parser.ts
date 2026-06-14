import type {
  AuctionPdfExtract,
  SpeedAuctionBidSchedule,
  SpeedAuctionFloor,
} from "@/lib/pdf/auction-pdf-parser";
import { enrichAuctionExtractMetrics } from "@/lib/pdf/auction-text-metrics";
import {
  parseIsoDateFlexible,
  parseKrwAmount,
} from "@/lib/pdf/speed-auction-pdf-parser";

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseSpacedField(text: string, label: string): string | null {
  const re = new RegExp(`${label}\\s+([^\\t\\n]+)`, "i");
  const m = text.match(re);
  return m?.[1] ? clean(m[1]) : null;
}

function parseDaejangBidSchedules(text: string): SpeedAuctionBidSchedule[] {
  const block = text.match(
    /구분\s+입찰기일\s+최저매각가격\s+결과([\s\S]*?)(?=정정취하공고|매각물건현황|임차인\s*현황)/,
  )?.[1];
  if (!block) return [];

  const schedules: SpeedAuctionBidSchedule[] = [];
  let lastRound: string | null = "신건";

  for (const line of block.split("\n").map(clean).filter(Boolean)) {
    if (/^\d+%↓/.test(line)) continue;

    const withRound = line.match(
      /^(?:(\d+)차|신건)\s+(\d{4}-\d{2}-\d{2})\s+([\d,]+)(?:\s*(유찰|변경|예정|매각|취하))?$/,
    );
    if (withRound) {
      lastRound = withRound[1] ? `${withRound[1]}차` : "신건";
      schedules.push({
        round: lastRound,
        date: withRound[2]!,
        minimumPrice: parseKrwAmount(withRound[3]),
        result: withRound[4] ? clean(withRound[4]) : null,
        isCurrent: false,
      });
      continue;
    }

    const dateOnly = line.match(
      /^(\d{4}-\d{2}-\d{2})\s+([\d,]+)(?:\s*(유찰|변경|예정|매각|취하))?$/,
    );
    if (dateOnly) {
      schedules.push({
        round: lastRound,
        date: dateOnly[1]!,
        minimumPrice: parseKrwAmount(dateOnly[2]),
        result: dateOnly[3] ? clean(dateOnly[3]) : null,
        isCurrent: false,
      });
    }
  }

  const headerBid = text.match(/매각기일\s+(\d{4}-\d{2}-\d{2})/);
  if (headerBid && schedules.length > 0) {
    const date = headerBid[1]!;
    const idx = schedules.findIndex((s) => s.date === date);
    if (idx >= 0) schedules[idx]!.isCurrent = true;
  }

  return schedules;
}

function parseDaejangFloors(text: string): SpeedAuctionFloor[] {
  const floors: SpeedAuctionFloor[] = [];
  const block = text.match(
    /구분\s+소재지\s+층\/현황\/구조[\s\S]*?(?=감정가\s+합계|물건비고|임차인)/,
  )?.[0];
  if (!block) return floors;

  const re =
    /(\d+)층\s+([^\n]+?)\s+철근콘크리트[\s\S]*?([\d.]+)㎡[\s\S]*?([\d,]+)원/g;
  for (const m of block.matchAll(re)) {
    floors.push({
      floor: `${m[1]}층`,
      structure: "철근콘크리트구조",
      useType: clean(m[2]!),
      areaSqm: parseNumber(m[3]),
      appraisalPrice: parseKrwAmount(m[4]),
    });
  }
  return floors;
}

function parseDaejangAppraisal(text: string): {
  land: number | null;
  building: number | null;
  total: number | null;
} {
  const land = parseKrwAmount(
    text.match(/토지\s*\(\)[\s\S]*?\([\d,]+원\)\s*([\d,]+)원/)?.[1] ??
      text.match(/토지\s*\(\)[\s\S]*?([\d,]{8,})원/)?.[1],
  );
  const building = parseKrwAmount(text.match(/소계\s+([\d,]+)원/)?.[1]);
  const total =
    parseKrwAmount(parseSpacedField(text, "감\\s*정\\s*가")) ??
    parseKrwAmount(text.match(/감정가\s+합계\s+([\d,]+)원/)?.[1]);
  return { land, building, total };
}

export function parseDaejangAuctionTenants(rawText: string): {
  rows: Array<{
    rank: number | null;
    name: string | null;
    unit: string | null;
    use: string | null;
    deposit: number | null;
    monthly_rent: number | null;
    move_in_date: string | null;
    confirmed_date: string | null;
    dividend_request_date: string | null;
    notes: string | null;
  }>;
  deposit_total: number | null;
  monthly_rent_total: number | null;
} {
  const rows: Array<{
    rank: number | null;
    name: string | null;
    unit: string | null;
    use: string | null;
    deposit: number | null;
    monthly_rent: number | null;
    move_in_date: string | null;
    confirmed_date: string | null;
    dividend_request_date: string | null;
    notes: string | null;
  }> = [];

  const seen = new Set<string>();

  for (const m of rawText.matchAll(
    /([가-힣㈜A-Za-z()]+)\s+(?:주거|상가)?임차인\s*\n\s*(\d{3}호|E?\d?동?\d{3}호)[\s\S]*?보증금\s*:\s*([\d,]+)\s*원(?:[\s\S]*?월세\s*:\s*([\d,]+)\s*원)?/g,
  )) {
    const name = clean(m[1]!);
    const unitRaw = m[2]!;
    const unit = unitRaw.endsWith("호") ? unitRaw : `${unitRaw}호`;
    const key = `${name}|${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const chunk = m[0]!;
    rows.push({
      rank: rows.length + 1,
      name,
      unit,
      use: /상가/.test(chunk) ? "commercial" : "residential",
      deposit: parseKrwAmount(m[3]),
      monthly_rent: m[4] ? parseKrwAmount(m[4]) : null,
      move_in_date: parseIsoDateFlexible(
        chunk.match(/전입\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
      ),
      confirmed_date: parseIsoDateFlexible(
        chunk.match(/확정\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
      ),
      dividend_request_date: parseIsoDateFlexible(
        chunk.match(/배당\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
      ),
      notes: /현황조사/.test(chunk) ? "현황조사" : null,
    });
  }

  const depositTotal = rows.reduce((sum, r) => sum + (r.deposit ?? 0), 0);
  const rentTotal = rows.reduce((sum, r) => sum + (r.monthly_rent ?? 0), 0);

  return {
    rows,
    deposit_total: depositTotal > 0 ? depositTotal : null,
    monthly_rent_total: rentTotal > 0 ? rentTotal : null,
  };
}

export function parseDaejangRegistry(
  rawText: string,
  scope: "building" | "land",
) {
  const block =
    scope === "building"
      ? rawText.match(
          /최선순위설정\s+목록[\s\S]*?등기부채권총액\s*:\s*[\d,]+원/,
        )?.[0] ??
        rawText.match(
          /말소기준[\s\S]*?순위\s+접수일자[\s\S]*?등기부채권총액\s*:\s*[\d,]+원/,
        )?.[0]
      : rawText.match(/\(토지\)[\s\S]*?등기부채권총액\s*:\s*[\d,]+원/)?.[0];
  if (!block) return [];

  const rights: Array<{
    no: string | null;
    date: string | null;
    type: string | null;
    holder: string | null;
    amount: number | null;
    note: string | null;
    extinguished: boolean | null;
    is_key_right?: boolean;
  }> = [];

  for (const m of block.matchAll(
    /(\d+)\s+(\d{4}-\d{2}-\d{2})[\s\S]*?(근저당|임차권|임의경매|가압류|소유권|전세권)\s+([^\n]+?)\s+([\d,]+)\s*원(?:\s*(말소|말소기준|이전))?/g,
  )) {
    rights.push({
      no: m[1]!,
      date: m[2]!,
      type: clean(m[3]!),
      holder: clean(m[4]!),
      amount: parseKrwAmount(m[5]),
      note: m[6] ? clean(m[6]) : null,
      extinguished: m[6] === "말소" ? true : null,
      is_key_right: m[6] === "말소기준" ? true : undefined,
    });
  }

  return rights;
}

export function parseDaejangAuctionPdfText(text: string): AuctionPdfExtract {
  const t = text ?? "";

  const caseNumber =
    t.match(/(\d{4}\s*타경\s*\d+)/)?.[1]?.replace(/\s+/g, "") ?? null;

  const court =
    t.match(/([^\n]+지방법원)[^\n]*경매\d+계/)?.[1]?.trim() ??
    t.match(/^([^\n]+지방법원)/m)?.[1]?.trim() ??
    null;

  const auctionDivision = t.match(/경매\d+계/)?.[0] ?? null;
  const contactPhone =
    t.match(/\((\d{3}-\d{4}-\d{4})/)?.[1] ??
    t.match(/(\d{2,3}-\d{3,4}-\d{4})/)?.[1] ??
    null;

  const addressJibun =
    clean(t.match(/소재지\s+([^\t\n]+?)(?:\s+주소복사|$)/)?.[1] ?? "") || null;

  const addressRoad = (() => {
    const m = t.match(
      /도로명주\s*\n?\s*소\s*([^\t\n]+?)(?:\s+주소복사|$)/,
    );
    if (m) return clean(m[1]!);
    const inline = t.match(/\[도로명주소\]\s*([^\n]+)/)?.[1];
    return inline ? clean(inline) : null;
  })();

  const address = addressJibun ?? addressRoad;

  const propertyType = parseSpacedField(t, "물건종별");
  const auctionType = parseSpacedField(t, "경매구분");

  const owner = parseSpacedField(t, "소\\s*유\\s*자");
  const debtor = parseSpacedField(t, "채\\s*무\\s*자");
  const creditor = parseSpacedField(t, "채\\s*권\\s*자");

  const appraisalPrice =
    parseKrwAmount(parseSpacedField(t, "감\\s*정\\s*가")) ??
    parseDaejangAppraisal(t).total;

  const minPriceMatch = t.match(/최\s*저\s*가\s+\((\d+)%\)\s*([\d,]+)/);
  const minPrice = parseKrwAmount(minPriceMatch?.[2]);
  const minPriceRatePct = minPriceMatch?.[1]
    ? parseInt(minPriceMatch[1], 10)
    : null;

  const depositMatch = t.match(/보\s*증\s*금\s+\((\d+)%\)\s*([\d,]+)/);
  const depositAmount = parseKrwAmount(depositMatch?.[2]);
  const depositRatePct = depositMatch?.[1]
    ? parseInt(depositMatch[1], 10)
    : null;

  const claimAmount = parseKrwAmount(
    t.match(/임의경매\s+[^\n]+?\s+([\d,]+)\s*원\s+말소/)?.[1],
  );

  const bidDate =
    parseIsoDateFlexible(
      t.match(/매각기일\s+(\d{4}-\d{2}-\d{2})/)?.[1],
    ) ?? null;

  const landAreaSqm = parseNumber(
    t.match(/토지면적\s+([\d.]+)\s*㎡/)?.[1],
  );
  const buildingAreaSqm = parseNumber(
    t.match(/건물면적\s+([\d.]+)\s*㎡/)?.[1],
  );

  const appraisalParts = parseDaejangAppraisal(t);
  const landAppraisal = appraisalParts.land;
  const buildingAppraisal = appraisalParts.building;

  const caseReceivedDate = parseIsoDateFlexible(
    t.match(/사건접수\s+(\d{4}\.\d{1,2}\.\d{1,2})/)?.[1],
  );
  const dividendDeadline = parseIsoDateFlexible(
    t.match(/배당종기\s*\n?\s*일\s+(\d{4}-\d{2}-\d{2})/)?.[1] ??
      t.match(/배당요구종기\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1],
  );

  const bidSchedules = parseDaejangBidSchedules(t);
  const currentSchedule = [...bidSchedules]
    .reverse()
    .find((s) => s.isCurrent || s.date === bidDate);
  const currentRound = currentSchedule?.round
    ? parseInt(currentSchedule.round.replace(/\D/g, ""), 10) || null
    : null;

  const buildingFloors = parseDaejangFloors(t);
  const tenants = parseDaejangAuctionTenants(t);
  const metrics = enrichAuctionExtractMetrics({
    rawText: t,
    buildingFloors,
    tenantRowCount: tenants.rows.length,
  });

  const lienBaseline = t.match(/말소기준권리\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  const builtYear = (() => {
    const m = t.match(/사용승인:(\d{4}\.\d{1,2}\.\d{1,2})/);
    return m ? parseIsoDateFlexible(m[1]) : null;
  })();

  const zoning =
    clean(
      t.match(/용도지역지구\s+([^\n]+)/)?.[1]?.split(",")[0] ?? "",
    ) || null;

  const notes = [
    clean(t.match(/물건비고\s+([^\n]+)/)?.[1] ?? ""),
    clean(t.match(/매각조건\s+([^\t\n]+)/)?.[1] ?? ""),
    lienBaseline ? `말소기준권리: ${lienBaseline}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    format: "daejangauction",
    caseNumber,
    address,
    addressJibun,
    addressRoad,
    zipCode: null,
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
    saleTarget: clean(t.match(/매각조건\s+([^\t\n]+)/)?.[1] ?? "") || null,
    bidDate,
    landAreaSqm,
    buildingAreaSqm,
    landAppraisal,
    buildingAppraisal,
    ancillaryAppraisal: null,
    sourceUrl: null,
    parkingUnitCount: metrics.parkingUnitCount,
    builtYear,
    builtYearSource: builtYear ? "사용승인일" : null,
    appraisalDate: null,
    appraisalCompany: null,
    caseReceivedDate,
    auctionStartDate: null,
    dividendDeadline,
    currentRound,
    auctionStatus: "ongoing",
    winningBidPrice: null,
    bidRatePct: null,
    soldRound: null,
    zoning,
    landCategory: null,
    officialLandPricePerSqm: null,
    officialLandPriceDate: null,
    tenantDepositTotal: tenants.deposit_total,
    tenantMonthlyRentTotal: tenants.monthly_rent_total,
    householdCountHint: metrics.householdCountHint,
    buildingCoverageRatioPct: metrics.buildingCoverageRatioPct,
    floorAreaRatioPct: metrics.floorAreaRatioPct,
    residentialUnitHint: metrics.residentialUnitHint,
    commercialUnitHint: metrics.commercialUnitHint,
    bidSchedules,
    buildingFloors,
    ancillaryStructures: [],
    nearbyStats: [],
    notes,
  };
}
