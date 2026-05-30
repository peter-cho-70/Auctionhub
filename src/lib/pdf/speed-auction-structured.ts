import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";

export const SPEED_AUCTION_PDF_PARSER_VERSION = "speedauction-pdf-v1";

export type PdfImportMeta = {
  fileName: string;
  fileSize: number;
  pageCount: number | null;
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function parseKrw(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function sectionText(text: string, start: RegExp, end: RegExp): string {
  const startIdx = text.search(start);
  if (startIdx < 0) return "";
  const rest = text.slice(startIdx);
  const endMatch = rest.slice(1).search(end);
  return endMatch >= 0 ? rest.slice(0, endMatch + 1) : rest;
}

export function parseSpeedAuctionTenants(rawText: string): {
  rows: Array<{
    rank: number | null;
    name: string | null;
    unit: string | null;
    use: string | null;
    deposit: number | null;
    monthly_rent: number | null;
    notes: string | null;
  }>;
  deposit_total: number | null;
  monthly_rent_total: number | null;
} {
  const empty = {
    rows: [] as Array<{
      rank: number | null;
      name: string | null;
      unit: string | null;
      use: string | null;
      deposit: number | null;
      monthly_rent: number | null;
      notes: string | null;
    }>,
    deposit_total: null as number | null,
    monthly_rent_total: null as number | null,
  };

  const block = sectionText(
    rawText,
    /임차인현황/,
    /건물\s*등기\s*사항|건물소멸기준/,
  );
  if (!block) return empty;

  const rows: Array<{
    rank: number | null;
    name: string | null;
    unit: string | null;
    use: string | null;
    deposit: number | null;
    monthly_rent: number | null;
    notes: string | null;
  }> = [];

  const unitMatches = [
    ...block.matchAll(
      /(\d+)\s*\n[\s\S]*?([가-힣A-Za-z0-9()]+(?:임차인|전세권자|주거전세권자))\s*\n[\s\S]*?(\d{3})호[\s\S]*?([\d,]+)\s*원(?:\s*\n[\s\S]*?([\d,]+)\s*원)?/g,
    ),
  ];

  for (const m of unitMatches) {
    const monthly = m[5] ? parseKrw(m[5]) : null;
    const deposit = parseKrw(m[4]);
    rows.push({
      rank: parseInt(m[1]!, 10) || null,
      name: clean(m[2]!),
      unit: `${m[3]}호`,
      use: /상가/.test(m[2]!) ? "commercial" : /전세/.test(m[2]!) ? "jeonse" : "residential",
      deposit,
      monthly_rent: monthly,
      notes: null,
    });
  }

  if (rows.length === 0) {
    const simple = [
      ...block.matchAll(
        /(\d{3})호[\s\S]{0,120}?([\d,]+)\s*원/g,
      ),
    ];
    for (const m of simple) {
      rows.push({
        rank: null,
        name: null,
        unit: `${m[1]}호`,
        use: null,
        deposit: parseKrw(m[2]),
        monthly_rent: null,
        notes: null,
      });
    }
  }

  const depositTotal = parseKrw(
    block.match(/보증금합계\s*:\s*\n?\s*([\d,]+)\s*원/)?.[1],
  );
  const rentTotal = parseKrw(
    block.match(/월세합계\s*:\s*([\d,]+)\s*원/)?.[1],
  );

  return {
    rows,
    deposit_total: depositTotal,
    monthly_rent_total: rentTotal,
  };
}

export function parseSpeedAuctionRegistry(rawText: string, scope: "building" | "land") {
  const start =
    scope === "building" ? /건물\s*등기\s*사항/ : /토지\s*등기\s*사항/;
  const end =
    scope === "building"
      ? /토지\s*등기\s*사항|명세서\s*요약/
      : /명세서\s*요약|부동산종합공부/;
  const block = sectionText(rawText, start, end);
  if (!block) return [];

  const rights: Array<{
    no: string | null;
    date: string | null;
    type: string | null;
    holder: string | null;
    amount: number | null;
    note: string | null;
    extinguished: boolean | null;
  }> = [];

  for (const line of block.split("\n").map(clean).filter(Boolean)) {
    const m = line.match(
      /^(갑|을)(\d+)\s+(\d{4}-\d{2}-\d{2})?\s*(.+?)\s+([\d,]+원|청구:[\d,]+원|이전|보존|소멸|소멸기준|매매)?/,
    );
    if (!m) continue;
    rights.push({
      no: `${m[1]}${m[2]}`,
      date: parseIsoDate(m[3] ?? ""),
      type: clean(m[4] ?? ""),
      holder: null,
      amount: parseKrw(m[5]),
      note: m[5] ?? null,
      extinguished: /소멸/.test(line) ? true : null,
    });
  }

  return rights;
}

export function buildSpeedAuctionStructuredJson(args: {
  extracted: AuctionPdfExtract;
  rawText: string;
  meta: PdfImportMeta;
}) {
  const { extracted, rawText, meta } = args;
  const tenants = parseSpeedAuctionTenants(rawText);
  const buildingRights = parseSpeedAuctionRegistry(rawText, "building");
  const landRights = parseSpeedAuctionRegistry(rawText, "land");

  return {
    auction_case: {
      meta: {
        source_site: "스피드옥션",
        source_file: meta.fileName,
        file_size: meta.fileSize,
        page_count: meta.pageCount,
        parser_version: SPEED_AUCTION_PDF_PARSER_VERSION,
        imported_at: new Date().toISOString(),
        format: "speedauction",
      },
      case_info: {
        case_number: extracted.caseNumber,
        court: extracted.court,
        auction_type: extracted.auctionType,
        auction_division: extracted.auctionDivision,
        contact_phone: extracted.contactPhone,
        case_received_date: extracted.caseReceivedDate,
        auction_start_date: extracted.auctionStartDate,
        dividend_deadline: extracted.dividendDeadline,
        claim_amount: extracted.claimAmount,
        auction_status: extracted.auctionStatus,
      },
      parties: {
        owner: extracted.owner,
        debtor: extracted.debtor,
        creditor: extracted.creditor,
      },
      property: {
        address: {
          jibun: extracted.addressJibun,
          road: extracted.addressRoad,
          full: extracted.address,
          zip_code: extracted.zipCode,
        },
        property_type: extracted.propertyType,
        sale_target: extracted.saleTarget,
        zoning: extracted.zoning,
        land_category: extracted.landCategory,
        official_land_price: {
          per_sqm: extracted.officialLandPricePerSqm,
          as_of: extracted.officialLandPriceDate,
        },
      },
      appraisal: {
        total_appraisal_value: extracted.appraisalPrice,
        land: {
          area_sqm: extracted.landAreaSqm,
          appraisal_value: extracted.landAppraisal,
        },
        building: {
          total_area_sqm: extracted.buildingAreaSqm,
          appraisal_value: extracted.buildingAppraisal,
        },
        appraisal_date: extracted.appraisalDate,
        appraisal_company: extracted.appraisalCompany,
        floors: extracted.buildingFloors ?? [],
      },
      sale_schedule: {
        current_round: extracted.currentRound,
        deposit_amount: extracted.depositAmount,
        deposit_rate_pct: extracted.depositRatePct,
        min_price_rate_pct: extracted.minPriceRatePct,
        schedules: extracted.bidSchedules ?? [],
      },
      building_summary: {
        parking_unit_count: extracted.parkingUnitCount,
        approval_or_built_date: extracted.builtYear,
        built_year_source: extracted.builtYearSource,
        household_count_hint: extracted.householdCountHint,
      },
      tenants: tenants.rows,
      tenant_totals: {
        deposit_total: tenants.deposit_total ?? extracted.tenantDepositTotal,
        monthly_rent_total:
          tenants.monthly_rent_total ?? extracted.tenantMonthlyRentTotal,
      },
      building_registry: {
        rights: buildingRights,
        read_date: rawText.match(/건물열람일\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      },
      land_registry: {
        rights: landRights,
        read_date: rawText.match(/토지열람일\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      },
      nearby_market_stats: extracted.nearbyStats ?? [],
      notes: extracted.notes,
      raw_text: rawText,
    },
  };
}
