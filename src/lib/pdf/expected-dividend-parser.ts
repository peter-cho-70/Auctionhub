import { parseKrwAmount } from "@/lib/pdf/speed-auction-pdf-parser";
import type { TenantDividendStatus } from "@/lib/types/domain";

export const EXPECTED_DIVIDEND_PARSER_VERSION = "expected-dividend-v1";

export type ParsedExpectedDividendRow = {
  name: string;
  right_type: string;
  claim_amount: number;
  dividend_amount: number;
  undivided_amount: number;
  status: TenantDividendStatus;
  note: string;
};

export type ParsedExpectedDividend = {
  bid_price: number | null;
  case_number: string | null;
  address: string | null;
  rows: ParsedExpectedDividendRow[];
};

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

export function dividendStatusFromAmounts(
  claim: number,
  dividend: number,
  note: string,
): TenantDividendStatus {
  if (/전액배당/.test(note) && dividend > 0) return "full";
  if (/일부배당/.test(note) && dividend > 0) return "partial";
  if (claim <= 0) return "unknown";
  if (dividend >= claim) return "full";
  if (dividend > 0) return "partial";
  return "none";
}

export function parseExpectedDividendText(rawText: string): ParsedExpectedDividend {
  const text = rawText.replace(/\u00a0/g, " ");
  const bid_price = parseKrwAmount(
    text.match(/매각\s*예상가격[^0-9]*([\d,]+)\s*원/)?.[1] ??
      text.match(/매각가\s+([\d,]+)원/)?.[1],
  );
  const case_number =
    text.match(/(\d{4}\s*타경\s*\d+)/)?.[1]?.replace(/\s+/g, " ") ?? null;
  const address =
    cleanLine(text.match(/소재지\s+([^\n]+)/)?.[1] ?? "") || null;

  const summaryStart = text.indexOf("예상배당내역표");
  const summaryBlock =
    summaryStart >= 0
      ? text.slice(summaryStart).split(/소유권이전|총 매입가액/)[0] ?? ""
      : "";

  const rows: ParsedExpectedDividendRow[] = [];
  const seen = new Map<string, ParsedExpectedDividendRow>();

  for (const line of summaryBlock.split("\n").map(cleanLine).filter(Boolean)) {
    const tenantMatch = line.match(
      /^주거임차인\s+([가-힣A-Za-z·.'\s]{2,20}?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)(?:\s+(소멸|대항|소멸기준))?/,
    );
    if (!tenantMatch) continue;

    const name = cleanLine(tenantMatch[1]!);
    const claim_amount = parseKrwAmount(tenantMatch[2]) ?? 0;
    const dividend_amount = parseKrwAmount(tenantMatch[3]) ?? 0;
    const undivided_amount = parseKrwAmount(tenantMatch[4]) ?? 0;
    const noteTail = line.slice(tenantMatch[0].length).trim();
    const note = cleanLine(noteTail);

    const key = normalizeName(name);
    const status = dividendStatusFromAmounts(claim_amount, dividend_amount, note);
    const row: ParsedExpectedDividendRow = {
      name,
      right_type: "주거임차인",
      claim_amount,
      dividend_amount,
      undivided_amount,
      status,
      note,
    };

    const prev = seen.get(key);
    if (!prev || dividend_amount > prev.dividend_amount) {
      seen.set(key, row);
    }
  }

  rows.push(...seen.values());

  if (rows.length === 0) {
    for (const line of text.split("\n").map(cleanLine)) {
      const fallback = line.match(
        /주거임차인\s+([가-힣A-Za-z·.'\s]{2,20}?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/,
      );
      if (!fallback) continue;
      const name = cleanLine(fallback[1]!);
      const claim_amount = parseKrwAmount(fallback[2]) ?? 0;
      const dividend_amount = parseKrwAmount(fallback[3]) ?? 0;
      const undivided_amount = parseKrwAmount(fallback[4]) ?? 0;
      const key = normalizeName(name);
      if (seen.has(key)) continue;
      const row: ParsedExpectedDividendRow = {
        name,
        right_type: "주거임차인",
        claim_amount,
        dividend_amount,
        undivided_amount,
        status: dividendStatusFromAmounts(claim_amount, dividend_amount, ""),
        note: "",
      };
      seen.set(key, row);
      rows.push(row);
    }
  }

  return {
    bid_price,
    case_number,
    address,
    rows,
  };
}

export function buildExpectedDividendStructuredJson(args: {
  rawText: string;
  meta: { fileName: string; fileSize: number; pageCount: number | null };
}) {
  const parsed = parseExpectedDividendText(args.rawText);
  return {
    document: {
      meta: {
        source_file: args.meta.fileName,
        file_size: args.meta.fileSize,
        page_count: args.meta.pageCount,
        document_kind: "expected-dividend",
        parser_version: EXPECTED_DIVIDEND_PARSER_VERSION,
        imported_at: new Date().toISOString(),
        source_site: "스피드옥션",
      },
      expected_dividend: parsed,
      raw_text: args.rawText,
    },
  };
}
