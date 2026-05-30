import {
  createAuctionSaleComparable,
  parseUseApprovalDate,
} from "@/lib/domain/auction-bid-analysis";
import type { AuctionSaleComparable, AuctionSaleSellerType } from "@/lib/types/domain";
import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";

export type PdfToComparableResult = {
  comparable: AuctionSaleComparable;
  warnings: string[];
};

function inferSellerType(
  text: string,
  propertyType: string | null,
): AuctionSaleSellerType {
  const hay = `${text}\n${propertyType ?? ""}`;
  if (/한국토지주택|LH|엘에이치/i.test(hay)) return "lh";
  if (/\bSH\b|서울주택도시공사/i.test(hay)) return "sh";
  if (/신탁/i.test(hay)) return "trust";
  return "private";
}

function inferMultifamilyFlags(propertyType: string | null): {
  isMultifamily: boolean;
  hasNeighborhoodCommercial: boolean;
} {
  const p = propertyType ?? "";
  const commercial =
    /근린|상가|점포|오피스텔/i.test(p) && !/다가구/i.test(p);
  const multi =
    /다가구|원룸|다세대|연립|빌라|주택/i.test(p) || commercial === false;
  return {
    isMultifamily: multi || !commercial,
    hasNeighborhoodCommercial: commercial,
  };
}

function bidRateFromPrices(
  appraisal: number | null,
  winning: number | null,
  parsedRate: number | null,
): number | null {
  if (parsedRate != null && Number.isFinite(parsedRate)) return parsedRate;
  if (
    appraisal != null &&
    appraisal > 0 &&
    winning != null &&
    winning > 0
  ) {
    return Math.round((winning / appraisal) * 1000) / 10;
  }
  return null;
}

export function auctionPdfExtractToComparable(args: {
  extracted: AuctionPdfExtract;
  sourceUrl: string;
  rawText?: string;
  defaultDong?: string;
}): PdfToComparableResult {
  const { extracted, sourceUrl, rawText = "", defaultDong = "" } = args;
  const warnings: string[] = [];

  if (!extracted.address) warnings.push("주소를 찾지 못했습니다.");
  if (!extracted.caseNumber) warnings.push("사건번호를 찾지 못했습니다.");
  if (!extracted.appraisalPrice) warnings.push("감정가를 찾지 못했습니다.");
  if (!extracted.winningBidPrice) {
    if (extracted.auctionStatus === "ongoing") {
      warnings.push(
        "진행 중 경매 PDF입니다. 매각완료 사례가 아니므로 낙찰가·가율은 비워 둡니다.",
      );
    } else {
      warnings.push(
        "낙찰가·가율을 찾지 못했습니다. 매각 완료 PDF인지 확인하고 표에서 입력하세요.",
      );
    }
  }

  const flags = inferMultifamilyFlags(extracted.propertyType);
  const sellerType = inferSellerType(rawText, extracted.propertyType);
  const useApprovalDate = parseUseApprovalDate(extracted.builtYear);
  const bidRatePct = bidRateFromPrices(
    extracted.appraisalPrice,
    extracted.winningBidPrice,
    extracted.bidRatePct,
  );

  const comparable = createAuctionSaleComparable({
    caseNumber: extracted.caseNumber ?? "",
    address: extracted.address ?? "",
    dong: defaultDong,
    useApprovalDate,
    landAreaSqm: extracted.landAreaSqm,
    buildingAreaSqm: extracted.buildingAreaSqm,
    parkingCount: extracted.parkingUnitCount,
    isMultifamily: flags.isMultifamily,
    hasNeighborhoodCommercial: flags.hasNeighborhoodCommercial,
    appraisalPrice: extracted.appraisalPrice,
    winningBidPrice: extracted.winningBidPrice,
    bidRatePct,
    soldRound: extracted.soldRound,
    sellerType,
    bidDate: extracted.bidDate ?? "",
    memo: extracted.notes?.trim() ?? "",
    sourceUrl: sourceUrl.trim(),
    sourceExtractedText:
      rawText.length > 0
        ? rawText.length > 12_000
          ? `${rawText.slice(0, 12_000)}\n…(원문 ${rawText.length.toLocaleString("ko-KR")}자 중 앞부분만 저장)`
          : rawText
        : undefined,
  });

  return { comparable, warnings };
}
