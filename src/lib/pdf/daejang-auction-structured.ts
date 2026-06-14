import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";
import {
  parseDaejangAuctionTenants,
  parseDaejangRegistry,
} from "@/lib/pdf/daejang-auction-pdf-parser";

export const DAEJANG_AUCTION_PDF_PARSER_VERSION = "daejangauction-pdf-v1";

export type PdfImportMeta = {
  fileName: string;
  fileSize: number;
  pageCount: number | null;
};

export function buildDaejangAuctionStructuredJson(args: {
  extracted: AuctionPdfExtract;
  rawText: string;
  meta: PdfImportMeta;
}) {
  const { extracted, rawText, meta } = args;
  const tenants = parseDaejangAuctionTenants(rawText);
  const buildingRights = parseDaejangRegistry(rawText, "building");
  const landRights = parseDaejangRegistry(rawText, "land");

  const lienBaseline =
    rawText.match(/말소기준권리\s*:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  return {
    auction_case: {
      meta: {
        source_site: "대장옥션",
        source_file: meta.fileName,
        file_size: meta.fileSize,
        page_count: meta.pageCount,
        parser_version: DAEJANG_AUCTION_PDF_PARSER_VERSION,
        imported_at: new Date().toISOString(),
        format: "daejangauction",
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
        min_price: extracted.minPrice,
        lien_baseline: lienBaseline,
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
        ancillary_included_value: extracted.ancillaryAppraisal,
        ancillary_structures: extracted.ancillaryStructures ?? [],
        floors: extracted.buildingFloors ?? [],
      },
      sale_schedule: {
        current_round: extracted.currentRound,
        current_minimum_price: extracted.minPrice,
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
        building_coverage_ratio_pct: extracted.buildingCoverageRatioPct,
        floor_area_ratio_pct: extracted.floorAreaRatioPct,
        residential_unit_count: extracted.residentialUnitHint,
        commercial_unit_count: extracted.commercialUnitHint,
      },
      tenants: tenants.rows,
      tenant_totals: {
        deposit_total: tenants.deposit_total ?? extracted.tenantDepositTotal,
        monthly_rent_total:
          tenants.monthly_rent_total ?? extracted.tenantMonthlyRentTotal,
      },
      building_registry: {
        rights: buildingRights,
        total_claim_amount: buildingRights.reduce(
          (sum, r) => sum + (r.amount ?? 0),
          0,
        ),
      },
      land_registry: {
        rights: landRights,
        total_claim_amount: landRights.reduce(
          (sum, r) => sum + (r.amount ?? 0),
          0,
        ),
      },
      nearby_market_stats: extracted.nearbyStats ?? [],
      notes: extracted.notes,
      raw_text: rawText,
    },
  };
}
