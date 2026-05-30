import type {
  CaseSourceDocument,
  CaseSourceDocumentKind,
} from "@/lib/types/domain";
import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";
import { buildSpeedAuctionStructuredJson } from "@/lib/pdf/speed-auction-structured";

export const AUCTIONONE_PDF_PARSER_VERSION = "auctionone-pdf-v1";

export type PdfImportMeta = {
  fileName: string;
  fileSize: number;
  pageCount: number | null;
};

type ParsedTenant = {
  name: string | null;
  unit: string | null;
  use: string | null;
  move_in_date: string | null;
  confirmed_date: string | null;
  business_registration_date: string | null;
  dividend_request_date: string | null;
  deposit: number | null;
  monthly_rent: number | null;
  has_opposing_power: boolean | null;
  dividend_rank: boolean | null;
  lien_registered: boolean | null;
  notes: string | null;
};

type ParsedRegistryRight = {
  no: string | null;
  date: string | null;
  type: string | null;
  unit?: string | null;
  holder: string | null;
  amount: number | null;
  move_in_date?: string | null;
  confirmed_date?: string | null;
  case_number?: string | null;
  note: string | null;
  extinguished: boolean | null;
  is_key_right?: boolean;
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `srcdoc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildPdfStructuredJson(args: {
  extracted: AuctionPdfExtract;
  rawText: string;
  meta: PdfImportMeta;
}) {
  if (args.extracted.format === "speedauction") {
    return buildSpeedAuctionStructuredJson(args);
  }
  return buildAuctionOneStructuredJson(args);
}

export function buildAuctionOneStructuredJson(args: {
  extracted: AuctionPdfExtract;
  rawText: string;
  meta: PdfImportMeta;
}) {
  const { extracted, rawText, meta } = args;
  const tenants = parseTenants(rawText);
  const buildingRights = parseRegistryRights(rawText, "building");
  const landRights = parseRegistryRights(rawText, "land");
  return {
    auction_case: {
      meta: {
        source_site: "옥션원",
        source_file: meta.fileName,
        file_size: meta.fileSize,
        page_count: meta.pageCount,
        parser_version: AUCTIONONE_PDF_PARSER_VERSION,
        imported_at: new Date().toISOString(),
      },
      case_info: {
        case_number: extracted.caseNumber,
      },
      property: {
        address: {
          full: extracted.address,
        },
        property_type: extracted.propertyType,
      },
      appraisal: {
        total_appraisal_value: extracted.appraisalPrice,
        land: {
          area_sqm: extracted.landAreaSqm,
        },
        building_total_area_sqm: extracted.buildingAreaSqm,
      },
      sale_schedule: {
        current_round: null,
        schedules: [
          {
            round: null,
            date: extracted.bidDate,
            minimum_price: extracted.minPrice,
            result: null,
            is_current: true,
          },
        ],
      },
      building_summary: {
        parking_unit_count: extracted.parkingUnitCount,
        approval_or_built_date: extracted.builtYear,
      },
      tenants,
      building_registry: {
        total_claim_amount: sumAmounts(buildingRights),
        rights: buildingRights,
      },
      land_registry: {
        total_claim_amount: sumAmounts(landRights),
        rights: landRights,
      },
      notes: extracted.notes,
      raw_text: rawText,
    },
  };
}

export function buildStructuredJsonForDocument(args: {
  kind: CaseSourceDocumentKind;
  extracted: AuctionPdfExtract;
  rawText: string;
  meta: PdfImportMeta;
}) {
  const { kind, extracted, rawText, meta } = args;
  if (kind === "auctionone-pdf") {
    return buildPdfStructuredJson({ extracted, rawText, meta });
  }

  const commonMeta = {
    source_file: meta.fileName,
    file_size: meta.fileSize,
    page_count: meta.pageCount,
    document_kind: kind,
    parser_version: AUCTIONONE_PDF_PARSER_VERSION,
    imported_at: new Date().toISOString(),
  };

  if (kind === "registry-building" || kind === "registry-land") {
    const rights = parseRegistryRights(
      rawText,
      kind === "registry-building" ? "building" : "land",
    );
    return {
      document: {
        meta: commonMeta,
        registry: {
          scope: kind === "registry-building" ? "building" : "land",
          total_claim_amount: sumAmounts(rights),
          rights,
        },
        raw_text: rawText,
      },
    };
  }

  if (kind === "tenant-report") {
    return {
      document: {
        meta: commonMeta,
        tenants: parseTenants(rawText),
        raw_text: rawText,
      },
    };
  }

  if (kind === "building-ledger") {
    return {
      document: {
        meta: commonMeta,
        building_info_official: parseBuildingLedger(rawText),
        raw_text: rawText,
      },
    };
  }

  if (kind === "appraisal-report") {
    return {
      document: {
        meta: commonMeta,
        appraisal_report: parseAppraisalReport(rawText, extracted),
        raw_text: rawText,
      },
    };
  }

  return {
    document: {
      meta: commonMeta,
      extracted,
      raw_text: rawText,
    },
  };
}

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function sectionBetween(
  lines: string[],
  startPatterns: RegExp[],
  endPatterns: RegExp[],
): string[] {
  const start = lines.findIndex((line) => startPatterns.some((p) => p.test(line)));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => endPatterns.some((p) => p.test(line)));
  return end >= 0 ? rest.slice(0, end) : rest;
}

function parseIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function dateMatches(line: string): string[] {
  return [...line.matchAll(/(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/g)]
    .map((m) => parseIsoDate(m[1]))
    .filter((v): v is string => Boolean(v));
}

function parseKoreanMoney(raw: string): number | null {
  const s = raw.replace(/\s+/g, "");
  const digit = s.match(/(\d[\d,]*)\s*원?/);
  if (digit) {
    const n = Number(digit[1].replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  let total = 0;
  let matched = false;
  const eok = s.match(/(\d+(?:\.\d+)?)억/);
  if (eok) {
    total += Number(eok[1]) * 100_000_000;
    matched = true;
  }
  const man = s.match(/(\d+(?:\.\d+)?)만/);
  if (man) {
    total += Number(man[1]) * 10_000;
    matched = true;
  }
  return matched && Number.isFinite(total) ? Math.round(total) : null;
}

function moneyMatches(line: string): number[] {
  const matches = [
    ...line.matchAll(/\d[\d,]*\s*원/g),
    ...line.matchAll(/\d+(?:\.\d+)?\s*억(?:\s*\d+(?:\.\d+)?\s*만)?\s*원?/g),
    ...line.matchAll(/\d+(?:\.\d+)?\s*만\s*원?/g),
    ...line.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g),
  ];
  return matches
    .map((m) => parseKoreanMoney(m[0]))
    .filter((v): v is number => v != null);
}

function parseBooleanNear(line: string, keyword: string): boolean | null {
  if (!line.includes(keyword)) return null;
  const tail = line.slice(Math.max(0, line.indexOf(keyword) - 8));
  if (/(있음|유|O|○|Y|true)/i.test(tail)) return true;
  if (/(없음|무|X|×|N|false)/i.test(tail)) return false;
  return true;
}

function parseTenants(rawText: string) {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const keyRight = parseKeyRightFromSaleSpecification(rawText);
  const saleSpecificationTenants = parseSaleSpecificationTenants(lines);
  const tenantLines = sectionBetween(
    lines,
    [/임차인\s*현황/, /점유관계/, /매각물건명세서/],
    [/건물\s*등기/, /토지\s*등기/, /등기부\s*현황/, /감정평가/, /현장조사/],
  );
  const source = tenantLines.length ? tenantLines : lines;
  const grouped = parseTenantGroups(source);
  const lineParsed = source
    .map(parseTenantLine)
    .filter((tenant): tenant is ParsedTenant => tenant != null);
  const list = mergeTenantsByUnit([
    ...saleSpecificationTenants,
    ...grouped,
    ...lineParsed,
  ]);
  return {
    key_date_base:
      parseIsoDate(
        rawText.match(/말소기준(?:권리|등기|일)?\s*[:：]?\s*(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/)?.[1],
      ) ?? keyRight.date,
    key_right_type:
      rawText.match(/말소기준(?:권리|등기)?[^근가압임전]{0,20}(근저당|가압류|압류|임의경매|강제경매|전세권)/)?.[1] ??
      keyRight.type,
    bid_deadline: parseIsoDate(
      rawText.match(/배당요구(?:종기|기한|마감)[^\d]*(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/)?.[1],
    ),
    total_count: list.length || null,
    total_deposit: sumTenantMoney(list, "deposit"),
    total_monthly_rent: sumTenantMoney(list, "monthly_rent"),
    status_summary: extractStatusSummary(rawText),
    list,
  };
}

function parseKeyRightFromSaleSpecification(rawText: string): {
  date: string | null;
  type: string | null;
} {
  const matches = [
    ...rawText.matchAll(
      /(?:최선순위\s*설정|목록\s*\d+\s*:)[^\d]{0,20}(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})[^\n]{0,40}(근저당권|근저당|저당권|가압류|압류|전세권)/g,
    ),
  ]
    .map((m) => ({
      date: parseIsoDate(m[1]),
      type: m[2]?.replace(/권$/, "") ?? null,
    }))
    .filter(
      (item): item is { date: string; type: string } => item.date != null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  return matches[0] ?? { date: null, type: null };
}

function parseSaleSpecificationTenants(lines: string[]): ParsedTenant[] {
  if (!lines.some((line) => line.includes("매각물건명세서"))) return [];
  const endIndex = lines.findIndex((line) => line.includes("부동산의 표시"));
  const source = endIndex >= 0 ? lines.slice(0, endIndex) : lines;
  const notesByUnit = extractSaleSpecificationNotes(source);
  const rows: ParsedTenant[] = [];
  let lastName: string | null = null;

  for (let i = 0; i < source.length; i += 1) {
    const line = source[i]!;
    const unit = normalizeSaleSpecificationUnit(
      line.match(/(?:[A-Z]동\s*)?\d{1,4}\s*호/)?.[0] ?? null,
    );
    if (!unit) continue;

    const name: string | null =
      extractSaleSpecificationName(source, i, unit) ?? lastName;
    if (name) lastName = name;

    const rowLines = [line];
    for (let j = i + 1; j < Math.min(source.length, i + 8); j += 1) {
      const next = source[j]!;
      const nextUnit = normalizeSaleSpecificationUnit(
        next.match(/(?:[A-Z]동\s*)?\d{1,4}\s*호/)?.[0] ?? null,
      );
      if (nextUnit) break;
      if (isStandaloneSaleSpecificationName(next) && rowLines.some(isTenantInfoLine)) {
        break;
      }
      rowLines.push(next);
    }

    const parsed = parseSaleSpecificationRow({
      name,
      unit,
      lines: rowLines,
      extraNote: notesByUnit.get(unit) ?? null,
    });
    if (parsed) rows.push(parsed);
  }

  return rows;
}

function extractSaleSpecificationNotes(lines: string[]): Map<string, string> {
  const notes = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/-\s*([^()]+)\s*\(([^)]+호)\)\s*:\s*(.+)/);
    const unit = normalizeSaleSpecificationUnit(m?.[2] ?? null);
    if (!unit) continue;
    notes.set(unit, cleanLine(`${m?.[1]?.trim()}: ${m?.[3]?.trim()}`));
  }
  return notes;
}

function normalizeSaleSpecificationUnit(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,4})\s*호/);
  return m ? `${m[1]}호` : cleanLine(raw);
}

function parseSaleSpecificationRow({
  name,
  unit,
  lines,
  extraNote,
}: {
  name: string | null;
  unit: string;
  lines: string[];
  extraNote: string | null;
}): ParsedTenant | null {
  const text = lines.join(" ");
  if (!/현황조사|권리신고|등기사항|임차|주거|점포|보증|차임|\d{4}[.\-/년]/.test(text)) {
    return null;
  }
  const dates = dateMatches(text);
  const monies = moneyMatches(text);
  const dateSet = datesFromSaleSpecification(text, dates);
  const use = /점포|상가|사업자/.test(text)
    ? "점포"
    : /주거|주택/.test(text)
      ? "주거용"
      : null;
  const businessRegistrationDate =
    use === "점포" && dates.length >= 2
      ? dates.at(-2) ?? dateSet.moveInDate
      : null;
  const sourceLabel =
    text.match(/(권리신고|등기사항\s*전부증명서|현황조사)/)?.[1]?.replace(/\s+/g, " ") ??
    null;

  return {
    name,
    unit,
    use,
    move_in_date: use === "점포" ? null : dateSet.moveInDate,
    confirmed_date: dateSet.confirmedDate,
    business_registration_date: businessRegistrationDate,
    dividend_request_date: dateSet.dividendDate,
    deposit: monies[0] ?? null,
    monthly_rent: monies[1] ?? null,
    has_opposing_power: null,
    dividend_rank: dateSet.dividendDate ? true : null,
    lien_registered: /임차권/.test(text) ? true : null,
    notes: [sourceLabel, text, extraNote].filter(Boolean).join("\n"),
  };
}

function datesFromSaleSpecification(
  text: string,
  dates: string[],
): {
  moveInDate: string | null;
  confirmedDate: string | null;
  dividendDate: string | null;
} {
  const hasDividendRequest = /권리신고|배당요구/.test(text);
  if (hasDividendRequest && dates.length >= 3) {
    return {
      moveInDate: dates.at(-3) ?? null,
      confirmedDate: /없음/.test(text) ? null : dates.at(-2) ?? null,
      dividendDate: dates.at(-1) ?? null,
    };
  }
  if (dates.length >= 3) {
    return {
      moveInDate: dates.at(-2) ?? null,
      confirmedDate: /없음/.test(text) ? null : dates.at(-1) ?? null,
      dividendDate: null,
    };
  }
  if (dates.length === 2) {
    return {
      moveInDate: dates[0] ?? null,
      confirmedDate: /없음/.test(text) ? null : dates[1] ?? null,
      dividendDate: null,
    };
  }
  return {
    moveInDate: dates[0] ?? null,
    confirmedDate: null,
    dividendDate: null,
  };
}

function extractSaleSpecificationName(
  lines: string[],
  unitLineIndex: number,
  unit: string,
): string | null {
  const line = lines[unitLineIndex]!;
  const prefix = cleanSaleSpecificationName(
    line.slice(0, Math.max(0, line.indexOf(unit))),
  );
  if (prefix) return prefix;

  const parts: string[] = [];
  for (let i = unitLineIndex - 1; i >= Math.max(0, unitLineIndex - 8); i -= 1) {
    const prev = lines[i]!;
    if (normalizeSaleSpecificationUnit(prev.match(/(?:[A-Z]동\s*)?\d{1,4}\s*호/)?.[0] ?? null)) {
      break;
    }
    if (isSaleSpecificationHeaderLine(prev)) break;
    const candidate = cleanSaleSpecificationName(prev);
    if (!candidate) {
      if (parts.length > 0) break;
      continue;
    }
    parts.unshift(candidate);
  }

  if (parts.length === 0) return null;
  return cleanLine(parts.join(""));
}

function cleanSaleSpecificationName(raw: string): string | null {
  const s = cleanLine(raw.replace(/[()[\]{}]/g, " "));
  if (!s || isSaleSpecificationHeaderLine(s)) return null;
  if (
    /현황조사|권리신고|등기사항|전부증명서|임차인|임차권자|주거|점포|보증금|차임|없음|해당사항|작성|일자|목록|배당|외국인|사업자|대항/.test(
      s,
    )
  ) {
    return null;
  }
  if (/\d/.test(s)) return null;
  if (!/[가-힣A-Za-z]/.test(s)) return null;
  return s.replace(/\s+/g, "");
}

function isStandaloneSaleSpecificationName(line: string): boolean {
  return Boolean(cleanSaleSpecificationName(line));
}

function isSaleSpecificationHeaderLine(line: string): boolean {
  return /점유자|성명|점유|부분|정보출처|구분|권원|임대차기간|전입신고|확정일자|배당|요구|매각물건명세서|사건|물건번호|법원|비고/.test(
    line,
  );
}

function extractUnits(line: string): string[] {
  const units = [
    ...line.matchAll(/((?:지하|지층|옥탑|옥상|\d+\s*층)\s*)?\d{1,4}\s*호/g),
  ]
    .map((m) => cleanLine(m[0]))
    .filter((unit) => !/^\d{4}\s*호$/.test(unit));
  return [...new Set(units)];
}

function isTenantInfoLine(line: string): boolean {
  return /전입|확정|배당|보증|월세|차임|임차|점유|사업자|대항력|임차권|\d{4}[.\-/년]/.test(
    line,
  );
}

function parseTenantGroups(lines: string[]): ParsedTenant[] {
  const groups: { unit: string; lines: string[] }[] = [];
  let current: { unit: string; lines: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    if (current.lines.some(isTenantInfoLine)) groups.push(current);
    current = null;
  };

  for (const line of lines) {
    const units = extractUnits(line);
    if (units.length > 0) {
      pushCurrent();
      // 층별 현황처럼 호실만 나열된 줄은 임차인 행으로 보지 않습니다.
      if (units.length > 1 && !isTenantInfoLine(line)) continue;
      current = { unit: units[0]!, lines: [line] };
      continue;
    }
    if (!current) continue;
    if (current.lines.length >= 10) {
      pushCurrent();
      continue;
    }
    current.lines.push(line);
  }
  pushCurrent();

  return groups.map(parseTenantGroup).filter((tenant): tenant is ParsedTenant => tenant != null);
}

function parseTenantGroup(group: {
  unit: string;
  lines: string[];
}): ParsedTenant | null {
  const text = group.lines.join(" ");
  if (!isTenantInfoLine(text)) return null;
  const dates = dateMatches(text);
  const monies = moneyMatches(text);
  const businessDate = dateAfterLabels(text, ["사업자", "사업자등록"]);
  const moveInDate = dateAfterLabels(text, ["전입", "입주", "점유"]) ?? dates[0] ?? null;
  const confirmedDate = dateAfterLabels(text, ["확정"]) ?? dates.find((d) => d !== moveInDate) ?? null;
  const dividendDate =
    dateAfterLabels(text, ["배당", "배당요구"]) ??
    (dates.length >= 3 ? dates[2]! : null);
  const deposit = moneyAfterLabels(text, ["보증금", "임차보증금", "임대차보증금"]) ?? monies[0] ?? null;
  const monthlyRent = moneyAfterLabels(text, ["월세", "차임", "월차임"]) ?? (monies.length >= 2 ? monies[1]! : null);
  return {
    name: extractTenantName(group.unit, group.lines),
    unit: group.unit,
    use: /점포|상가|사업자|상업/.test(text)
      ? "점포"
      : /주거|주택|세대/.test(text)
        ? "주거용"
        : null,
    move_in_date: businessDate ? null : moveInDate,
    confirmed_date: confirmedDate,
    business_registration_date: businessDate,
    dividend_request_date: dividendDate,
    deposit,
    monthly_rent: monthlyRent,
    has_opposing_power: parseBooleanNear(text, "대항력"),
    dividend_rank: parseBooleanNear(text, "배당"),
    lien_registered: /임차권/.test(text) ? true : null,
    notes: text,
  };
}

function dateAfterLabels(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const i = text.indexOf(label);
    if (i < 0) continue;
    const found = dateMatches(text.slice(i, i + 80))[0];
    if (found) return found;
  }
  return null;
}

function moneyAfterLabels(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const i = text.indexOf(label);
    if (i < 0) continue;
    const found = moneyMatches(text.slice(i, i + 80))[0];
    if (found != null) return found;
  }
  return null;
}

function extractTenantName(unit: string, lines: string[]): string | null {
  const joined = lines.join(" ");
  const labeled = joined.match(
    /(?:임차인|점유자|성명|상호|입주자|거주자)\s*[:：]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9·.\s]{1,24})/,
  )?.[1];
  const labeledName = cleanTenantName(labeled ?? "");
  if (labeledName) return labeledName;

  const unitIndex = joined.indexOf(unit);
  const afterUnit = unitIndex >= 0 ? joined.slice(unitIndex + unit.length) : joined;
  const afterUnitName = afterUnit.match(
    /^\s*([가-힣A-Za-z][가-힣A-Za-z0-9·.]{1,12})(?=\s|$|전입|확정|배당|보증|월세|\d{4})/,
  )?.[1];
  const directName = cleanTenantName(afterUnitName ?? "");
  if (directName) return directName;

  const beforeDateOrMoney = afterUnit
    .split(/\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}/)[0]!
    .split(/\d[\d,]*\s*원/)[0]!;
  const cleaned = cleanTenantName(beforeDateOrMoney);
  if (cleaned) return cleaned;
  for (const line of lines.slice(1, 4)) {
    const candidate = cleanTenantName(line);
    if (candidate) return candidate;
  }
  return null;
}

function cleanTenantName(raw: string): string | null {
  const s = cleanLine(
    raw
      .replace(
        /주거용|점포|상가|임차인|점유자|입주자|거주자|성명|상호|전입|입주|확정|배당|보증금|월세|차임|대항력|임차권|사업자등록|미상/g,
        " ",
      )
      .replace(/[|:：()[\]{}]/g, " "),
  );
  if (!s) return null;
  const tokens = s
    .split(/\s+/)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !/\d{4}/.test(token))
    .filter((token) => !/^(유|무|있음|없음|미상|해당|여부|신고|요구|일자|날짜|권리)$/.test(token));
  const candidate = tokens.join(" ").trim();
  if (!candidate || candidate.length > 40) return null;
  if (!/[가-힣A-Za-z]/.test(candidate)) return null;
  return candidate;
}

function mergeTenantsByUnit(list: ParsedTenant[]): ParsedTenant[] {
  const map = new Map<string, ParsedTenant>();
  for (const item of list) {
    const key = item.unit || `unknown-${map.size}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    map.set(key, {
      ...prev,
      name: prev.name ?? item.name,
      use: prev.use ?? item.use,
      move_in_date: prev.move_in_date ?? item.move_in_date,
      confirmed_date: prev.confirmed_date ?? item.confirmed_date,
      business_registration_date:
        prev.business_registration_date ?? item.business_registration_date,
      dividend_request_date:
        prev.dividend_request_date ?? item.dividend_request_date,
      deposit: prev.deposit ?? item.deposit,
      monthly_rent: prev.monthly_rent ?? item.monthly_rent,
      has_opposing_power: prev.has_opposing_power ?? item.has_opposing_power,
      dividend_rank: prev.dividend_rank ?? item.dividend_rank,
      lien_registered: prev.lien_registered ?? item.lien_registered,
      notes: [prev.notes, item.notes].filter(Boolean).join("\n"),
    });
  }
  return [...map.values()].sort((a, b) => compareUnit(a.unit, b.unit));
}

function compareUnit(a: string | null, b: string | null): number {
  return unitSortKey(a) - unitSortKey(b);
}

function unitSortKey(unit: string | null): number {
  if (!unit) return Number.MAX_SAFE_INTEGER;
  const floor = Number(unit.match(/(\d+)\s*층/)?.[1] ?? 0);
  const room = Number(unit.match(/(\d{1,4})\s*호/)?.[1] ?? 0);
  return floor * 10000 + room;
}

function parseTenantLine(line: string): ParsedTenant | null {
  if (!/(호|층|상가|점포)/.test(line)) return null;
  if (!/(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}|전입|확정|배당|보증|월세|임차|점유)/.test(line)) {
    return null;
  }
  const unit =
    line.match(/((?:지하|지층|옥탑|옥상|\d+\s*층)\s*)?\d{1,4}\s*호/)?.[0]?.replace(/\s+/g, " ") ??
    line.match(/\d+\s*층/)?.[0]?.replace(/\s+/g, " ") ??
    null;
  const dates = dateMatches(line);
  const monies = moneyMatches(line);
  const unitIndex = unit ? line.indexOf(unit) + unit.length : 0;
  const dateIndex = dates[0] ? line.indexOf(dates[0].replace(/-/g, ".")) : -1;
  const nameSlice =
    cleanTenantName(
      line.slice(unitIndex, dateIndex > unitIndex ? dateIndex : undefined),
    ) ?? null;
  const use = /점포|상가|사업자/.test(line)
    ? "점포"
    : /주거|주택/.test(line)
      ? "주거용"
      : null;
  return {
    name: nameSlice,
    unit,
    use,
    move_in_date: dates[0] ?? null,
    confirmed_date: dates[1] ?? null,
    business_registration_date: /사업자/.test(line) ? dates[0] ?? null : null,
    dividend_request_date: dates[2] ?? (/배당/.test(line) ? dates.at(-1) ?? null : null),
    deposit: monies[0] ?? null,
    monthly_rent: monies[1] ?? null,
    has_opposing_power: parseBooleanNear(line, "대항력"),
    dividend_rank: parseBooleanNear(line, "배당"),
    lien_registered: /임차권/.test(line) ? true : null,
    notes: line,
  };
}

function extractStatusSummary(rawText: string) {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const floor = (n: number) =>
    lines
      .filter((line) => line.includes(`${n}층`) && /호|상가|점포|주차/.test(line))
      .slice(0, 5);
  return {
    floor_1: floor(1),
    floor_2: floor(2),
    floor_3: floor(3),
    floor_4: floor(4),
    rooftop: lines.find((line) => /옥탑|옥상/.test(line)) ?? null,
    special_notes: lines
      .filter((line) => /특이|비고|주의|미상|불명|공용|창고/.test(line))
      .slice(0, 10),
  };
}

function parseRegistryRights(rawText: string, scope: "building" | "land"): ParsedRegistryRight[] {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const section = sectionBetween(
    lines,
    scope === "building"
      ? [/건물\s*등기/, /건물등기부/, /건물\s*권리/]
      : [/토지\s*등기/, /토지등기부/, /토지\s*권리/],
    scope === "building"
      ? [/토지\s*등기/, /토지등기부/, /현장조사/, /건축물/]
      : [/현장조사/, /건축물/, /매각사례/, /공시가격/],
  );
  return section
    .map(parseRegistryLine)
    .filter((right): right is ParsedRegistryRight => right != null);
}

function parseRegistryLine(line: string): ParsedRegistryRight | null {
  const no = line.match(/\b(갑|을)\s*\d+\b/)?.[0]?.replace(/\s+/g, "") ?? null;
  if (!no) return null;
  const date = dateMatches(line)[0] ?? null;
  const type =
    line.match(/(소유권보존|소유권이전|근저당|가압류|압류|임의경매|강제경매|주택임차권|상가건물임차권|전세권|가등기)/)?.[1] ??
    null;
  const amount = moneyMatches(line)[0] ?? null;
  const holder = cleanLine(
    line
      .replace(no, "")
      .replace(date?.replace(/-/g, ".") ?? "", "")
      .replace(type ?? "", "")
      .replace(amount != null ? formatMoneyForRegex(amount) : "", ""),
  );
  return {
    no,
    date,
    type,
    unit: line.match(/((?:지하|지층|옥탑|옥상|\d+\s*층)\s*)?\d{1,4}\s*호/)?.[0] ?? null,
    holder: holder || null,
    amount,
    move_in_date: /전입/.test(line) ? dateMatches(line)[0] ?? null : undefined,
    confirmed_date: /확정/.test(line) ? dateMatches(line)[1] ?? null : undefined,
    case_number: line.match(/\d{4}\s*(?:카단|타경)\s*\d+/)?.[0]?.replace(/\s+/g, "") ?? null,
    note: line,
    extinguished: /소멸|말소/.test(line) ? true : /인수/.test(line) ? false : null,
    is_key_right: /말소기준/.test(line) || /최선순위/.test(line),
  };
}

function formatMoneyForRegex(n: number): string {
  return n.toLocaleString("ko-KR");
}

function sumTenantMoney(
  list: ParsedTenant[],
  key: "deposit" | "monthly_rent",
): number | null {
  const total = list.reduce((sum, item) => sum + (item[key] ?? 0), 0);
  return total > 0 ? total : null;
}

function sumAmounts(list: ParsedRegistryRight[]): number | null {
  const total = list.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return total > 0 ? total : null;
}

export function buildPdfSourceDocument(args: {
  meta: PdfImportMeta;
  rawText: string;
  structuredJson: unknown;
  kind?: CaseSourceDocumentKind;
}): CaseSourceDocument {
  const { meta, rawText, structuredJson, kind = "auctionone-pdf" } = args;
  return {
    id: newId(),
    kind,
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    pageCount: meta.pageCount,
    extractedText: rawText,
    structuredJson,
    parserVersion: AUCTIONONE_PDF_PARSER_VERSION,
    importedAt: new Date().toISOString(),
  };
}

function parseNumberNear(rawText: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const m = rawText.match(pattern);
    if (!m?.[1]) continue;
    const n = Number(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseBuildingLedger(rawText: string) {
  const unitComposition = parseBuildingLedgerUnitComposition(rawText);
  const residentialUnits = sumCompositionUnits(unitComposition, "residential");
  const commercialUnits = sumCompositionUnits(unitComposition, "commercial");
  const ledgerUnitCount =
    (parseNumberNear(rawText, [
      /호수\/가구수\/세대수\s*(\d+)\s*호/,
      /(?:가구수|세대수|호수)\s*[:：]?\s*(\d+)/,
      /다가구주택\s*\(?(\d+)\s*가구\)?/,
    ]) ?? residentialUnits) ||
    null;
  return {
    address:
      rawText.match(/도로명주소\s*([^\n]+)/)?.[1]?.trim() ??
      rawText.match(/(?:대지위치|주소|소재지)\s*[:：]?\s*([^\n]+)/)?.[1]?.trim() ??
      null,
    building_type:
      rawText.match(/(?:건축물\s*종류|건축물대장\s*종류)\s*[:：]?\s*([^\n]+)/)?.[1]?.trim() ??
      extractBuildingMainUse(rawText) ??
      null,
    units: ledgerUnitCount,
    residential_units: residentialUnits || null,
    commercial_units: commercialUnits || null,
    unit_composition: unitComposition,
    floors_above_ground: parseNumberNear(rawText, [/지상\s*(\d+)\s*층/]),
    floors_below_ground: parseNumberNear(rawText, [/지하\s*(\d+)\s*층/]),
    total_parking: parseNumberNear(rawText, [
      /(?:총)?주차(?:대수)?\s*[:：]?\s*(\d+)/,
    ]),
    land_area_sqm: parseNumberNear(rawText, [/대지면적\s*[:：]?\s*([\d,.]+)\s*㎡/]),
    building_area_sqm: parseNumberNear(rawText, [/건축면적\s*[:：]?\s*([\d,.]+)\s*㎡/]),
    total_area_sqm: parseNumberNear(rawText, [
      /(?:연면적|총면적)\s*[:：]?\s*([\d,.]+)\s*㎡/,
    ]),
    building_coverage_ratio_pct: parseNumberNear(rawText, [
      /건폐율\s*[:：]?\s*([\d,.]+)\s*%/,
    ]),
    floor_area_ratio_pct: parseNumberNear(rawText, [
      /용적률?\s*[:：]?\s*([\d,.]+)\s*%/,
    ]),
    approval_date: parseIsoDate(
      rawText.match(/(?:사용승인|승인일|사용검사)[^\d]*(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/)?.[1],
    ),
    violation_note:
      rawText.match(/(위반건축물[^\n]*|위반[^\n]*건축[^\n]*)/)?.[1]?.trim() ??
      null,
  };
}

function extractBuildingMainUse(rawText: string): string | null {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const idx = lines.findIndex((line) => /주구조\s+주용도\s+층수/.test(line));
  if (idx >= 0) {
    const next = lines[idx + 1] ?? "";
    const m = next.match(/철근콘크리트구조\s+(.+?)\s+지하/);
    if (m?.[1]) return m[1].trim();
  }
  return rawText.match(/(다중주택\([^)]*\)[^\n]*근린생활시설[^\n]*)/)?.[1]?.trim() ?? null;
}

function parseBuildingLedgerUnitComposition(rawText: string) {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  return lines.flatMap((line, index) => {
    const m = line.match(
      /^주\d+\s+((?:지하|지상)?\s*\d+\s*층)\s+(.+?구조)\s+(.+?)\s+([\d,.]+)$/,
    );
    if (!m) return [];
    const floor = m[1]!.replace(/\s+/g, "");
    const useLabel = m[3]!.trim();
    const areaSqm = Number(m[4]!.replace(/,/g, ""));
    if (!Number.isFinite(areaSqm)) return [];
    const useType = classifyLedgerUse(useLabel);
    return [
      {
        id: `ledger-unit-${index + 1}`,
        floor,
        useType,
        useLabel,
        areaSqm,
        unitCount: parseLedgerUnitCount(useLabel, useType),
        source: "building-ledger",
      },
    ];
  });
}

function classifyLedgerUse(useLabel: string): "residential" | "commercial" | "other" {
  if (/근린생활시설|상가|점포|소매점|사무소|의원|음식점/.test(useLabel)) {
    return "commercial";
  }
  if (/주택|다가구|다중|도시형|원룸|공동주택/.test(useLabel)) {
    return "residential";
  }
  return "other";
}

function parseLedgerUnitCount(
  useLabel: string,
  useType: "residential" | "commercial" | "other",
): number {
  const explicit = Number(useLabel.match(/(\d+)\s*호/)?.[1] ?? NaN);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return useType === "commercial" || useType === "residential" ? 1 : 0;
}

function sumCompositionUnits(
  rows: ReturnType<typeof parseBuildingLedgerUnitComposition>,
  useType: "residential" | "commercial",
): number {
  return rows
    .filter((row) => row.useType === useType)
    .reduce((sum, row) => sum + row.unitCount, 0);
}

function parseAppraisalReport(rawText: string, extracted: AuctionPdfExtract) {
  const comparableLines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => /거래사례|비교사례|표준지|사례\s*\d+/.test(line))
    .slice(0, 30);
  return {
    total_appraisal_value: extracted.appraisalPrice,
    land_area_sqm: extracted.landAreaSqm,
    building_total_area_sqm: extracted.buildingAreaSqm,
    appraisal_date: parseIsoDate(
      rawText.match(/(?:가격시점|조사기간|감정평가일)[^\d]*(\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/)?.[1],
    ),
    appraiser:
      rawText.match(/([가-힣A-Za-z0-9()]+감정평가(?:법인|사무소)?)/)?.[1] ??
      null,
    comparable_count: comparableLines.length || null,
    comparable_lines: comparableLines,
    floor_plan_mentions: rawText
      .split(/\r?\n/)
      .map(cleanLine)
      .filter((line) => /도면|평면도|내부구조|층별/.test(line))
      .slice(0, 20),
  };
}
