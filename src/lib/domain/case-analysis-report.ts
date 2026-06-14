import type {
  AuctionCase,
  CaseAnalysisReportSnapshot,
} from "@/lib/types/domain";
import {
  asRecord,
  caseMapCoords,
  getPrimaryAuctionPayload,
  registryRightsFromCase,
  tenantRowsFromCase,
  textValue,
  numberValue,
} from "@/lib/domain/case-document-payload";
import {
  computeRentSettingDerived,
} from "@/lib/domain/rent-setting";
import { DEFAULT_REPORT_TEMPLATE_VERSION } from "@/lib/domain/case-workflow";
import { formatManwonWithSuffix } from "@/lib/format/manwon";
import { formatWonWithUnit } from "@/lib/format/won";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import {
  kakaoMapSearchUrl,
  naverMapSearchUrl,
} from "@/lib/map/external-links";
import {
  FIELD_PHOTO_REPORT_SECTION,
  FIELD_PHOTO_ZONE_LABEL,
} from "@/lib/domain/field-photo-gallery";
import {
  tenantRecordsForReport,
  TENANT_DIVIDEND_STATUS_LABEL,
  summarizeTenantRecordDividends,
} from "@/lib/domain/case-tenant-records";
import { getExpectedDividendFromDocuments } from "@/lib/domain/tenant-dividend-display";
import { computeBidYieldTable } from "@/lib/domain/bid-yield-table";

export type CaseAnalysisReportOptions = {
  /** imageRef → data URL (보고서 §6·§7 embed) */
  fieldPhotoDataUrls?: Record<string, string>;
};

export const REPORT_SECTION_DEFS = [
  { id: 1, title: "경매물건 기본정보", key: "basic" },
  { id: 2, title: "경매물건 상세정보", key: "detail" },
  { id: 3, title: "건축물대장·건물 전반", key: "building_overview" },
  { id: 4, title: "권리분석", key: "rights" },
  { id: 5, title: "건축물대장 상세·공시·위반", key: "building_detail" },
  { id: 6, title: "위치·주변환경", key: "location" },
  { id: 7, title: "건물 사진·구조", key: "photos" },
  { id: 8, title: "임차인 정보", key: "tenants" },
  { id: 9, title: "인근 시세·임장", key: "market" },
  { id: 10, title: "경매 관심도", key: "interest" },
  { id: 11, title: "인근 매각가율", key: "comparables" },
  { id: 12, title: "대출", key: "loan" },
  { id: 13, title: "수익률표", key: "yield" },
  { id: 14, title: "최종 입찰", key: "decision" },
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_DEFS)[number]["key"];

export type ReportSectionStatus = {
  key: ReportSectionKey;
  title: string;
  filled: boolean;
  hint: string;
};

const VERDICT_LABEL: Record<string, string> = {
  recommend: "입찰 권장",
  caution: "신중 검토",
  not_recommend: "비추천",
  abandon: "포기",
};

const CSS = `
body{font-family:"Apple SD Gothic Neo",system-ui,sans-serif;max-width:920px;margin:2rem auto;padding:0 1.25rem;color:#111;line-height:1.55;font-size:14px}
h1{font-size:1.4rem;margin:0}
h2{font-size:1.05rem;border-bottom:2px solid #222;padding-bottom:.35rem;margin:1.75rem 0 .75rem;page-break-after:avoid}
h3{font-size:.95rem;margin:1rem 0 .4rem}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.5rem 0}
th,td{border:1px solid #ccc;padding:.35rem .45rem;text-align:left;vertical-align:top}
th{background:#f3f4f6}
tr.opposing{background:#fef2f2;font-weight:600}
.muted{color:#666;font-size:.85rem}
.warn{color:#b45309;background:#fffbeb;border:1px solid #fcd34d;padding:.5rem .75rem;border-radius:6px;margin:.5rem 0}
.empty{color:#999;font-style:italic}
@media print{body{margin:1cm}h2{page-break-before:auto}}
`;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(text: string): string {
  if (!text.trim()) return `<p class="empty">(미입력)</p>`;
  return `<p>${esc(text)}</p>`;
}

function preBlock(text: string): string {
  if (!text.trim()) return `<p class="empty">(미입력)</p>`;
  return `<pre style="white-space:pre-wrap;font-family:inherit;font-size:.9rem;background:#f9fafb;padding:.75rem;border-radius:6px">${esc(text)}</pre>`;
}

function kvTable(rows: [string, string][]): string {
  const filled = rows.filter(([, v]) => v.trim());
  if (!filled.length) return `<p class="empty">(데이터 없음)</p>`;
  return `<table><tbody>${filled
    .map(
      ([k, v]) =>
        `<tr><th style="width:28%">${esc(k)}</th><td>${esc(v)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function dataTable(
  headers: string[],
  rows: string[][],
  opposingRows?: Set<number>,
): string {
  if (!rows.length) return `<p class="empty">(표 데이터 없음)</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (row, i) =>
        `<tr class="${opposingRows?.has(i) ? "opposing" : ""}">${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function section(num: number, title: string, body: string): string {
  return `<section id="s${num}"><h2>${num}. ${esc(title)}</h2>${body}</section>`;
}

function renderFieldPhotoGrid(
  c: AuctionCase,
  sectionNum: 6 | 7,
  dataUrls: Record<string, string>,
): string {
  const photos = c.fieldPhotoGallery.photos.filter(
    (p) => FIELD_PHOTO_REPORT_SECTION[p.zone] === sectionNum,
  );
  if (!photos.length) return "";
  const cells = photos
    .map((p) => {
      const url = dataUrls[p.imageRef];
      if (!url) return "";
      return `<figure style="margin:0"><img src="${url.replace(/"/g, "&quot;")}" alt="${esc(p.caption || FIELD_PHOTO_ZONE_LABEL[p.zone])}" style="width:100%;border-radius:6px;max-height:180px;object-fit:cover"/><figcaption style="font-size:.72rem;color:#666;margin-top:.25rem">${esc(FIELD_PHOTO_ZONE_LABEL[p.zone])}${p.caption.trim() ? ` · ${esc(p.caption)}` : ""}</figcaption></figure>`;
    })
    .filter(Boolean)
    .join("");
  if (!cells) return "";
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin:.75rem 0">${cells}</div>`;
}

function opposingLabel(v: boolean | null): string {
  if (v === true) return "있음 ⚠";
  if (v === false) return "없음";
  return "확인필요";
}

function won(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return formatWonWithUnit(v);
}

function manwon(v: number | null | undefined): string {
  return formatManwonWithSuffix(v);
}

export function computeReportSectionStatus(c: AuctionCase): ReportSectionStatus[] {
  const p = getPrimaryAuctionPayload(c);
  const tenants = tenantRowsFromCase(c);
  const pre = c.preAuction;
  const comps = c.auctionSaleComparables;
  const rent = computeRentSettingDerived(c.rentSetting);

  return REPORT_SECTION_DEFS.map((def) => {
    let filled = false;
    let hint = "";
    switch (def.key) {
      case "basic":
        filled = Boolean(c.caseNumber && c.address);
        hint = filled ? "" : "사건번호·주소";
        break;
      case "detail":
        filled = Boolean(c.appraisalPrice != null || p);
        hint = "PDF 등록 또는 가격 입력";
        break;
      case "building_overview":
        filled =
          c.buildingUnitComposition.length > 0 ||
          c.householdCount != null ||
          Boolean(p?.appraisal);
        hint = "건축물대장·가구수";
        break;
      case "rights":
        filled = Boolean(c.lienBaseline.trim() || tenants.length > 0);
        hint = "말소기준·임차인";
        break;
      case "building_detail":
        filled =
          c.landAreaSqm != null ||
          c.hasBuildingViolation ||
          Boolean(c.buildingCoverageRatio.trim());
        hint = "면적·위반·건폐율";
        break;
      case "location":
        filled =
          Boolean(pre.reportLocationNotes.trim() || c.fieldSurvey.trim()) ||
          c.fieldPhotoGallery.photos.some(
            (p) => FIELD_PHOTO_REPORT_SECTION[p.zone] === 6,
          );
        hint = "위치 메모·주변 사진";
        break;
      case "photos":
        filled =
          Boolean(pre.reportFieldPhotoNotes.trim()) ||
          c.fieldPhotoGallery.photos.some(
            (p) => FIELD_PHOTO_REPORT_SECTION[p.zone] === 7,
          );
        hint = "건물 사진·구조";
        break;
      case "tenants":
        filled =
          c.tenantRecords.length > 0 ||
          tenants.length > 0 ||
          c.rentSetting.unitRows.length > 0;
        hint = "임차인 표·PDF";
        break;
      case "market":
        filled =
          c.nearbyMarketAnalysis != null ||
          c.brokerMarketNotes.length > 0 ||
          c.multiFamilyAnalysis.yieldTableDone;
        hint = "주변 시세·다가구 분석";
        break;
      case "interest":
        filled =
          Boolean(pre.reportAuctionInterest.trim()) ||
          pre.viewCountTotal != null ||
          pre.viewCountValid != null;
        hint = "조회수·관심도";
        break;
      case "comparables":
        filled = comps.filter((x) => !x.isOngoing).length >= 5;
        hint =
          comps.length > 0
            ? `완료 ${comps.filter((x) => !x.isOngoing).length}/5건`
            : "매각 사례 5건+";
        break;
      case "loan":
        filled = Boolean(
          pre.reportLoanSummary.trim() || c.rentSetting.loanAmount != null,
        );
        hint = "대출 요약·LTV";
        break;
      case "yield":
        filled =
          rent.yieldAnnualPct != null ||
          computeBidYieldTable(c).length > 0 ||
          c.rentSetting.unitRows.some((r) => r.monthlyRent != null);
        hint = "입찰가별 수익률표";
        break;
      case "decision":
        filled =
          c.decision.verdict != null ||
          c.decision.maxBidPrice != null ||
          Boolean(c.decision.reason.trim());
        hint = "판단·입찰가";
        break;
    }
    return { key: def.key, title: def.title, filled, hint };
  });
}

export function buildCaseAnalysisReport(
  c: AuctionCase,
  options: CaseAnalysisReportOptions = {},
): CaseAnalysisReportSnapshot {
  const photoUrls = options.fieldPhotoDataUrls ?? {};
  const pre = c.preAuction;
  const templateVersion = pre.reportTemplateVersion || DEFAULT_REPORT_TEMPLATE_VERSION;
  const generatedAt = new Date().toISOString();
  const nickname =
    pre.reportNickname.trim() ||
    c.address.split(/\s+/).slice(-1)[0] ||
    c.caseNumber;
  const title = `${c.caseNumber || "사건번호 미입력"} ${nickname} — 입찰가 산정 보고서`;
  const payload = getPrimaryAuctionPayload(c);
  const caseInfo = asRecord(payload?.case_info);
  const property = asRecord(payload?.property);
  const address = asRecord(property?.address);
  const appraisal = asRecord(payload?.appraisal);
  const land = asRecord(appraisal?.land);
  const buildingAp = asRecord(appraisal?.building);
  const saleSchedule = asRecord(payload?.sale_schedule);
  const buildingSummary = asRecord(payload?.building_summary);
  const parties = asRecord(payload?.parties);
  const tenantTotals = asRecord(payload?.tenant_totals);
  const tenants = tenantRowsFromCase(c);
  const { lat, lng } = caseMapCoords(c);
  const addr = c.address || textValue(address?.full) || textValue(address?.road);
  const bidResult = c.auctionBidAnalysis?.lastResult;
  const rentDerived = computeRentSettingDerived(c.rentSetting);

  const sections: string[] = [];

  // §1
  sections.push(
    section(
      1,
      "경매물건 기본정보",
      [
        kvTable([
          ["사건번호", c.caseNumber || textValue(caseInfo?.case_number)],
          ["주소", addr],
          ["물건 별칭", pre.reportNickname],
          ["상태", STATUS_LABELS[c.status]],
        ]),
        `<p><strong>지도</strong> · <a href="${esc(naverMapSearchUrl(addr, lat, lng))}">네이버 지도</a> · <a href="${esc(kakaoMapSearchUrl(addr, lat, lng))}">카카오맵</a>${lat != null && lng != null ? ` · 좌표 ${lat.toFixed(5)}, ${lng.toFixed(5)}` : ""}</p>`,
        `<h3>왜 이 물건을 고른가</h3>`,
        preBlock(
          pre.reportSelectionReason.trim() ||
            c.decision.reason.trim() ||
            c.memo.trim(),
        ),
      ].join(""),
    ),
  );

  // §2
  const schedules = Array.isArray(saleSchedule?.schedules)
    ? saleSchedule.schedules
    : [];
  const currentSched = schedules
    .map((x) => asRecord(x))
    .find((x) => x?.is_current === true) ?? asRecord(schedules[0]);
  sections.push(
    section(
      2,
      "경매물건 상세정보",
      kvTable([
        ["주소", addr],
        ["도로명", textValue(address?.road ?? address?.road_address)],
        ["물건종별", c.propertyType || textValue(property?.property_type)],
        ["토지면적", c.landAreaSqm != null ? `${c.landAreaSqm}㎡` : areaSqm(land?.area_sqm)],
        ["건물면적", c.buildingAreaSqm != null ? `${c.buildingAreaSqm}㎡` : areaSqm(buildingAp?.total_area_sqm ?? appraisal?.building_total_area_sqm)],
        ["매각물건", textValue(property?.sale_target)],
        ["개시결정", textValue(caseInfo?.auction_start_date)],
        ["배당종기", textValue(caseInfo?.dividend_deadline)],
        ["사건명", textValue(caseInfo?.case_name)],
        ["관련사건", textValue(caseInfo?.related_cases)],
        ["감정가", won(c.appraisalPrice ?? numberValue(appraisal?.total_appraisal_value))],
        ["최저가", won(c.minPrice ?? numberValue(currentSched?.minimum_price))],
        ["보증금", won(numberValue(saleSchedule?.deposit_amount))],
        ["소유자", textValue(parties?.owner)],
        ["채무자", textValue(parties?.debtor)],
        ["채권자", textValue(parties?.creditor)],
        ["매각회차", textValue(saleSchedule?.current_round ?? c.currentRound)],
        ["매각기일", c.bidDate || textValue(currentSched?.date)],
        ["사용승인", c.builtYear || textValue(buildingSummary?.approval_or_built_date)],
        ["세대·가구", c.householdCount != null ? `${c.householdCount}세대` : textValue(buildingSummary?.household_count_hint)],
        ["경매상태", textValue(caseInfo?.auction_status)],
        ["청구금액", won(numberValue(caseInfo?.claim_amount))],
      ]),
    ),
  );

  // §3
  const floorRows = c.buildingUnitComposition.map((u) => [
    u.floor,
    u.useLabel || u.useType,
    u.areaSqm != null ? `${u.areaSqm}㎡` : "",
    String(u.unitCount),
    u.source,
  ]);
  const pdfFloors = arrayRecords(appraisal?.floors).map((f) => [
    textValue(f.floor),
    textValue(f.useType ?? f.use_type),
    areaSqm(f.areaSqm ?? f.area_sqm),
    won(numberValue(f.appraisalPrice ?? f.appraisal_price)),
    "",
  ]);
  const unitCounts = c.rentSetting.unitCounts;
  sections.push(
    section(
      3,
      "건축물대장·건물 전반",
      [
        kvTable([
          ["총 가구·세대", c.householdCount != null ? `${c.householdCount}` : ""],
          ["주택 호수", c.residentialUnitCount != null ? `${c.residentialUnitCount}` : ""],
          ["상가 호수", c.commercialUnitCount != null ? `${c.commercialUnitCount}` : ""],
          ["주인세대", unitCounts.ownerUnit > 0 ? `${unitCounts.ownerUnit}세대` : "—"],
          ["룸 구성", Object.entries(c.roomShapeMix).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(", ")],
          ["주차", c.parkingUnitCount != null ? `${c.parkingUnitCount}대` : textValue(buildingSummary?.parking_unit_count)],
          ["층 정보", c.floor],
        ]),
        floorRows.length > 0
          ? `<h3>층별 구성 (건축물대장·수동)</h3>${dataTable(["층", "용도", "면적", "호수", "출처"], floorRows)}`
          : "",
        pdfFloors.length > 0
          ? `<h3>층별 감정 (PDF)</h3>${dataTable(["층", "용도", "면적", "감정가", ""], pdfFloors)}`
          : "",
      ].join(""),
    ),
  );

  // §4
  const buildingRights = registryRightsFromCase(c, "building");
  const landRights = registryRightsFromCase(c, "land");
  const rightsRows = [...buildingRights, ...landRights].slice(0, 30).map((r) => [
    textValue(r.no ?? r.rank),
    textValue(r.date),
    textValue(r.type),
    textValue(r.holder),
    won(numberValue(r.amount)),
    textValue(r.extinguished) === "true" ? "말소" : "",
  ]);
  sections.push(
    section(
      4,
      "권리분석",
      [
        `<h3>말소기준·등기 요약</h3>`,
        preBlock(c.lienBaseline),
        kvTable([
          ["임차인 수", textValue(tenantTotals?.count ?? tenants.length)],
          ["임차보증금 합", won(numberValue(tenantTotals?.deposit_total))],
          ["월세 합", won(numberValue(tenantTotals?.monthly_rent_total))],
        ]),
        rightsRows.length > 0
          ? `<h3>등기부 권리 (건물·토지)</h3>${dataTable(["순위", "접수", "종류", "권리자", "금액", "비고"], rightsRows)}`
          : `<p class="muted">등기 PDF에서 권리 목록을 추출하면 여기에 표시됩니다.</p>`,
        `<p class="muted">대항력 있는 임차인은 §8 표에서 빨간색으로 강조됩니다.</p>`,
      ].join(""),
    ),
  );

  // §5
  const officialLand = asRecord(property?.official_land_price);
  sections.push(
    section(
      5,
      "건축물대장 상세·공시지가·위반",
      kvTable([
        ["대지면적", c.landAreaSqm != null ? `${c.landAreaSqm}㎡` : areaSqm(land?.area_sqm)],
        ["연면적/건물", c.buildingAreaSqm != null ? `${c.buildingAreaSqm}㎡` : ""],
        ["건폐율", c.buildingCoverageRatio],
        ["용적률", c.floorAreaRatio],
        ["높이/층수", c.floor],
        ["주차", c.parkingUnitCount != null ? `${c.parkingUnitCount}대` : ""],
        ["공시지가(㎡)", won(numberValue(officialLand?.per_sqm))],
        ["공시 기준일", textValue(officialLand?.as_of)],
        ["위반건축물", c.hasBuildingViolation ? "해당" : "해당 없음(미확인 포함)"],
        ["용도지역", textValue(property?.zoning)],
        ["지목", textValue(property?.land_category)],
      ]),
    ),
  );

  // §6
  sections.push(
    section(
      6,
      "경매물건 위치·주변환경",
      [
        `<p><a href="${esc(naverMapSearchUrl(addr, lat, lng))}">네이버 지도</a> · ${esc(c.nearbyMarketAnalysis ? `${c.nearbyMarketAnalysis.city} ${c.nearbyMarketAnalysis.gu} ${c.nearbyMarketAnalysis.dong}` : "")}</p>`,
        renderFieldPhotoGrid(c, 6, photoUrls),
        `<h3>교통·편의·주변 (보고서 메모)</h3>`,
        preBlock(pre.reportLocationNotes),
        `<h3>임장 메모</h3>`,
        preBlock(c.fieldSurvey),
        c.fieldInspection.nearbyBrokers.length > 0
          ? `<h3>주변 부동산</h3>${dataTable(["상호", "연락처", "메모"], c.fieldInspection.nearbyBrokers.slice(0, 8).map((b) => [b.agencyName, b.phone, b.memo || b.rentOpinion]))}`
          : "",
      ].join(""),
    ),
  );

  // §7
  sections.push(
    section(
      7,
      "건물 사진·구조",
      [
        renderFieldPhotoGrid(c, 7, photoUrls),
        preBlock(
          pre.reportFieldPhotoNotes ||
            c.fieldInspection.memo ||
            "(외관·내부·층별·옥상·호실·구조도 — 임장 탭에서 사진 업로드)",
        ),
      ].join(""),
    ),
  );

  // §8
  const structuredTenants = tenantRecordsForReport(c);
  const opposing = new Set<number>();
  const tenantTableRows: string[][] = structuredTenants.map((r, i) => {
    if (r.hasOpposingPower === true) opposing.add(i);
    return [
      r.unit,
      r.occupantName,
      won(r.deposit),
      won(r.monthlyRent),
      r.moveInDate.slice(0, 10),
      r.confirmedDate.slice(0, 10),
      r.dividendRequestDate.slice(0, 10),
      opposingLabel(r.hasOpposingPower),
      won(r.dividendAmount),
      won(r.undividedAmount),
      TENANT_DIVIDEND_STATUS_LABEL[r.dividendStatus],
      (r.inquiryNotes || r.memo).slice(0, 60),
    ];
  });
  if (tenantTableRows.length === 0) {
    for (const r of c.rentSetting.unitRows) {
        tenantTableRows.push([
        r.unitNo || r.floor || "—",
        "",
        won(r.deposit),
        won(r.monthlyRent),
        "",
        "",
        "",
        "확인필요",
        "",
        "",
        "",
        r.note.slice(0, 60),
      ]);
    }
  }
  const tenantDividendSummary = summarizeTenantRecordDividends(structuredTenants);
  const expectedDividend = getExpectedDividendFromDocuments(c.sourceDocuments);
  const tenantBidPrice =
    expectedDividend?.bid_price ?? c.expectedBidPrice ?? c.minPrice;
  sections.push(
    section(
      8,
      "임차인 정보",
      [
        tenantTableRows.length > 0
          ? [
              `<p class="muted">배당 기준 입찰가: ${won(tenantBidPrice)} · 전액 ${tenantDividendSummary.full} · 일부 ${tenantDividendSummary.partial} · 미배당 ${tenantDividendSummary.none}</p>`,
              dataTable(
                ["호실", "권리자", "보증금", "월세", "전입", "확정", "배당", "대항력", "배당액", "미배당액", "상태", "비고"],
                tenantTableRows,
                opposing,
              ),
            ].join("")
          : `<p class="empty">임차인 PDF 또는 임대세팅 호실을 입력하세요.</p>`,
        `<h3>건물관리업체</h3>`,
        kvTable([
          ["업체명", c.fieldInspection.buildingManagement.companyName],
          ["담당", c.fieldInspection.buildingManagement.contactName],
          ["연락처", c.fieldInspection.buildingManagement.phone],
          ["월 관리비(호당)", c.fieldInspection.buildingManagement.monthlyFeePerUnitManwon != null ? manwon(c.fieldInspection.buildingManagement.monthlyFeePerUnitManwon) : ""],
        ]),
      ].join(""),
    ),
  );

  // §9
  const market = c.nearbyMarketAnalysis;
  sections.push(
    section(
      9,
      "인근 다가구 매매·임대·임장",
      [
        market
          ? kvTable([
              ["지역", `${market.city} ${market.gu} ${market.dong}`],
              ["매매 실거래(국토부)", manwon(market.saleAvgMolitManwon)],
              ["매매(네이버)", manwon(market.saleAvgNaverManwon)],
              ["조회 건수", `매매 ${market.molitCount} / 네이버 ${market.naverCount}`],
            ])
          : "",
        market?.roomSummaries.length
          ? `<h3>룸타입별 시세</h3>${dataTable(["룸", "네이버 월세", "국토부 월세", "건수"], market.roomSummaries.map((r) => [r.roomType, manwon(r.naverMonthlyRentAvgManwon), manwon(r.molitMonthlyRentAvgManwon), `${r.naverCount + r.molitCount}`]))}`
          : "",
        c.brokerMarketNotes.length > 0
          ? `<h3>부동산·호가 메모</h3>${c.brokerMarketNotes.map((n) => `<p>· ${esc(n.content)}</p>`).join("")}`
          : "",
        `<h3>다가구·임장 분석</h3>`,
        preBlock(c.multiFamilyAnalysis.memo || c.multiFamilyAnalysis.postFieldGapReason),
        `<h3>임대 수익 요약</h3>`,
        kvTable([
          ["총 보증금", won(rentDerived.totalDeposit)],
          ["총 월세", won(rentDerived.totalMonthlyRent)],
          ["순월세(이자 후)", won(Math.round(rentDerived.monthlyNet))],
        ]),
      ].join(""),
    ),
  );

  // §10
  sections.push(
    section(
      10,
      "경매 관심도(조회수)",
      [
        kvTable([
          ["전체 조회수", pre.viewCountTotal != null ? `${pre.viewCountTotal}` : ""],
          ["유효 조회", pre.viewCountValid != null ? `${pre.viewCountValid}` : ""],
          ["온비드 등", pre.viewCountOnbid != null ? `${pre.viewCountOnbid}` : ""],
        ]),
        `<h3>관심도·메모</h3>`,
        preBlock(pre.reportAuctionInterest),
      ].join(""),
    ),
  );

  // §11
  const comps = c.auctionSaleComparables;
  const completedComps = comps.filter((row) => !row.isOngoing);
  const ongoingComps = comps.filter((row) => row.isOngoing);
  const compRowMap = (row: (typeof comps)[number]) => [
    row.isOngoing ? "진행중" : "매각",
    row.caseNumber || "—",
    row.address.slice(0, 36),
    row.useApprovalDate?.slice(0, 4) || "—",
    won(row.appraisalPrice),
    row.isOngoing ? "—" : won(row.winningBidPrice),
    row.bidRatePct != null ? `${row.bidRatePct}%` : "—",
    row.isOngoing
      ? row.bidderCount != null
        ? `${row.bidderCount}명`
        : "—"
      : row.soldRound != null
        ? `${row.soldRound}회`
        : "—",
    row.failedRoundCount != null ? `유찰${row.failedRoundCount}` : "",
    row.memo.slice(0, 36),
  ];
  sections.push(
    section(
      11,
      "인근 지역 매각가율·비교",
      [
        completedComps.length < 5
          ? `<div class="warn">매각완료 비교 ${completedComps.length}건 — 권장 5건 이상</div>`
          : "",
        completedComps.length > 0
          ? `<h3>매각 완료 사례</h3>${dataTable(
              ["구분", "사건", "주소", "연식", "감정가", "낙찰가", "가율", "회차", "유찰", "메모"],
              completedComps.map(compRowMap),
            )}`
          : `<p class="empty">매각 완료 비교 사례 없음</p>`,
        ongoingComps.length > 0
          ? `<h3>진행 중 경매</h3>${dataTable(
              ["구분", "사건", "주소", "연식", "감정가", "낙찰가", "가율", "입찰자", "유찰", "메모"],
              ongoingComps.map(compRowMap),
            )}`
          : "",
        c.bidRounds.length > 0
          ? `<h3>본건 입찰·유찰 회차</h3>${dataTable(["회차", "최저가", "입찰가", "결과", "일자"], c.bidRounds.map((r) => [String(r.round), won(r.minPrice), won(r.myBidPrice), r.result, r.bidDate ?? ""]))}`
          : "",
        bidResult?.narrative
          ? `<h3>입찰가 통합 분석 요약</h3>${para(bidResult.narrative)}`
          : "",
      ].join(""),
    ),
  );

  // §12
  sections.push(
    section(
      12,
      "대출 가능·담보·신탁",
      [
        preBlock(pre.reportLoanSummary),
        kvTable([
          ["대출액(입력)", won(c.rentSetting.loanAmount)],
          ["담보 LTV", c.rentSetting.investmentYield.loanToValueRatio != null ? `${(c.rentSetting.investmentYield.loanToValueRatio * 100).toFixed(0)}%` : ""],
          ["연이율", c.rentSetting.annualRate != null ? `${(c.rentSetting.annualRate * 100).toFixed(2)}%` : ""],
          ["감정가(대출)", won(c.rentSetting.investmentYield.appraisalAmount ?? c.appraisalPrice)],
          ["월 이자(추정)", won(Math.round(rentDerived.monthlyInterest))],
        ]),
        c.postAuction.loanPackage.preApprovalNotes.trim()
          ? `<h3>사전 한도 메모</h3>${preBlock(c.postAuction.loanPackage.preApprovalNotes)}`
          : "",
      ].join(""),
    ),
  );

  // §13
  const yieldRows = computeBidYieldTable(c);
  sections.push(
    section(
      13,
      "입찰금액별 수익률표",
      [
        kvTable([
          ["감정가", won(c.appraisalPrice ?? c.rentSetting.investmentYield.appraisalAmount)],
          ["기준 입찰가", won(c.decision.maxBidPrice ?? c.expectedBidPrice ?? bidResult?.suggestedBidWon ?? null)],
          ["연 순수익률(현재)", rentDerived.yieldAnnualPct != null ? `${rentDerived.yieldAnnualPct.toFixed(2)}%` : "—"],
        ]),
        yieldRows.length > 0
          ? `<h3>입찰가 ±5~10% 시나리오</h3>${dataTable(
              ["입찰가", "가율%", "대출", "순투자", "순월세", "연수익률%", "비고"],
              yieldRows.map((r) => [
                won(r.bidAmount),
                r.bidRatePct != null ? `${r.bidRatePct}%` : "—",
                won(r.loanAmount),
                won(r.netInvestment),
                won(r.netMonthlyIncome),
                r.netYieldAnnualPct != null ? `${r.netYieldAnnualPct}%` : "—",
                r.label,
              ]),
            )}`
          : `<p class="empty">기준 입찰가·임대 세팅을 입력하면 표가 생성됩니다.</p>`,
        c.rentSetting.unitRows.length > 0
          ? `<h3>호실별 임대</h3>${dataTable(["층/호", "룸", "보증금", "월세"], c.rentSetting.unitRows.map((r) => [r.floor ? `${r.floor} ${r.unitNo}` : r.unitNo, r.roomType, won(r.deposit), won(r.monthlyRent)]))}`
          : "",
      ].join(""),
    ),
  );

  // §14
  sections.push(
    section(
      14,
      "최종 입찰가·판단",
      [
        kvTable([
          ["판단", c.decision.verdict ? VERDICT_LABEL[c.decision.verdict] ?? c.decision.verdict : ""],
          ["상한 입찰가", won(c.decision.maxBidPrice)],
          ["실제 입찰가", won(c.decision.actualBidPrice)],
          ["예상 낙찰가", won(c.expectedBidPrice)],
          ["리스크", c.decision.riskLevel ?? ""],
        ]),
        `<h3>입찰 이유·근거</h3>`,
        preBlock(c.decision.reason),
        `<h3>입찰 당일 여유분</h3>`,
        preBlock(pre.reportBidDayBuffer),
      ].join(""),
    ),
  );

  const status = computeReportSectionStatus(c);
  const filledCount = status.filter((s) => s.filled).length;
  const toc = `<nav class="muted"><p>생성: ${esc(generatedAt.slice(0, 16).replace("T", " "))} · ${esc(templateVersion)} · 섹션 준비 ${filledCount}/${status.length}</p><ol>${REPORT_SECTION_DEFS.map((d) => `<li><a href="#s${d.id}">${d.id}. ${esc(d.title)}</a></li>`).join("")}</ol></nav>`;

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${CSS}</style></head><body><header style="border-bottom:2px solid #111;padding-bottom:.75rem;margin-bottom:1rem"><h1>${esc(title)}</h1>${pre.reportCohort.trim() ? `<p class="muted">${esc(pre.reportCohort)}</p>` : ""}</header>${toc}${sections.join("")}<footer class="muted" style="margin-top:2rem;border-top:1px solid #ddd;padding-top:1rem">Auctionflow 입찰가 산정 보고서 · 앱 저장 데이터 자동 생성 · 참고용 PDF와 대조하여 검토하세요.</footer></body></html>`;

  return { generatedAt, html, htmlRef: null, templateVersion };
}

function areaSqm(v: unknown): string {
  const n = numberValue(v);
  return n != null ? `${n}㎡` : textValue(v);
}

function arrayRecords(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.map(asRecord).filter((x): x is Record<string, unknown> => x != null);
}
