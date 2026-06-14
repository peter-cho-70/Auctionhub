import { createRequire } from "node:module";
import fs from "node:fs";
import { parseDaejangAuctionPdfText } from "../src/lib/pdf/daejang-auction-pdf-parser.ts";
import { buildDaejangAuctionStructuredJson } from "../src/lib/pdf/daejang-auction-structured.ts";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const path =
  process.argv[2] ??
  "/Users/mbp/Documents/auctionhub/주요물건/대장옥션/2023타경9863 물건 대장옥션.pdf";

async function main() {
  const buf = fs.readFileSync(path);
  const parser = new PDFParse({ data: buf });
  const text = await parser.getText();
  await parser.destroy().catch(() => {});
  const rawText = String(text.text ?? "");
  const extracted = parseDaejangAuctionPdfText(rawText);
  const structured = buildDaejangAuctionStructuredJson({
    extracted,
    rawText,
    meta: {
      fileName: path.split("/").pop() ?? "test.pdf",
      fileSize: buf.length,
      pageCount: Array.isArray(text.pages) ? text.pages.length : null,
    },
  });
  console.log(
    JSON.stringify(
      {
        caseNumber: extracted.caseNumber,
        addressJibun: extracted.addressJibun,
        debtor: extracted.debtor,
        owner: extracted.owner,
        creditor: extracted.creditor,
        propertyType: extracted.propertyType,
        appraisal: extracted.appraisalPrice,
        landAppraisal: extracted.landAppraisal,
        buildingAppraisal: extracted.buildingAppraisal,
        minPrice: extracted.minPrice,
        bidDate: extracted.bidDate,
        bidSchedules: extracted.bidSchedules?.length ?? 0,
        floors: extracted.buildingFloors?.length ?? 0,
        tenants: structured.auction_case.tenants.length,
        buildingRights: structured.auction_case.building_registry.rights.length,
        landRights: structured.auction_case.land_registry.rights.length,
        tenantDepositTotal: extracted.tenantDepositTotal,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
