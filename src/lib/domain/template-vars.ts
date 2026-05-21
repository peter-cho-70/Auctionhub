import { summarizeFieldInspectionForSurvey } from "@/lib/domain/field-inspection";
import type { AuctionCase } from "@/lib/types/domain";
import { ROOM_SHAPE_OPTIONS } from "@/lib/types/domain";
import { formatWonWithUnit, parseWonInput } from "@/lib/format/won";

/** 문서·UI에 노출할 표준 변수 키 (중괄호 없이) */
export const STANDARD_TEMPLATE_KEYS = [
  "사건번호",
  "경매URL",
  "물건주소",
  "물건유형",
  "준공년도",
  "층",
  "가구수",
  "토지면적",
  "건물면적",
  "주차대수",
  "위반건축",
  "건폐율",
  "용적율",
  "말소기준",
  "가구형태",
  "임장조사",
  "감정가",
  "최저가",
  "입찰일",
  "현재회차",
  "유찰횟수",
  "내입찰가",
  "낙찰가",
  "보증금",
  "오늘날짜",
  "명의",
  "현주택수",
  "소득요약",
  "카드사용",
  "부채요약",
  "물건특징",
  "매도전략",
  "감정가대비낙찰가",
  "임차인명",
] as const;

export type TemplateContext = Record<string, string>;

function formatMoney(n: number | null | undefined): string {
  return formatWonWithUnit(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function countFailedRounds(c: AuctionCase): number {
  return c.bidRounds.filter((r) => r.result === "failed").length;
}

function formatRoomShapeSummary(mix: AuctionCase["roomShapeMix"]): string {
  const parts: string[] = [];
  for (const shape of ROOM_SHAPE_OPTIONS) {
    const n = mix[shape];
    if (n > 0) parts.push(`${shape} ${n}호`);
  }
  return parts.join(", ");
}

function formatAreaSqmLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return `${n}㎡`;
}

function formatViolationLabel(v: boolean): string {
  return v ? "있음" : "없음";
}

function buildFieldSurveyText(c: AuctionCase): string {
  const structured = summarizeFieldInspectionForSurvey(c.fieldInspection);
  const free = (c.fieldSurvey ?? "").trim();
  if (structured && free) return `${structured}\n\n${free}`;
  return structured || free;
}

/** 감정가 비교·비율용: 물건 기본이 비면 임대세팅 투자 감정가 사용 */
export function effectiveAppraisalForRatio(c: AuctionCase): number | null {
  const fromCase = c.appraisalPrice;
  if (fromCase != null && fromCase > 0) return fromCase;
  const fromRent = c.rentSetting?.investmentYield?.appraisalAmount;
  if (fromRent != null && fromRent > 0) return fromRent;
  return null;
}

/** 물건 + 사용자 입력 보조값 → 템플릿 치환 맵 */
export function buildTemplateContext(
  c: AuctionCase,
  extras: TemplateContext = {},
): TemplateContext {
  const failed = countFailedRounds(c);
  const appraisal = effectiveAppraisalForRatio(c);
  const fromDecision = c.decision.actualBidPrice;
  const extraWin = extras["낙찰가"]?.trim() ?? "";
  const winNum =
    extraWin !== ""
      ? parseWonInput(extraWin)
      : fromDecision != null
        ? fromDecision
        : null;

  let ratio = "";
  if (appraisal != null && winNum != null && appraisal > 0) {
    ratio = `${Math.round((winNum / appraisal) * 100)}%`;
  }

  const 낙찰가표시 =
    extraWin !== ""
      ? extraWin
      : fromDecision != null
        ? formatWonWithUnit(fromDecision)
        : "";

  const base: TemplateContext = {
    사건번호: c.caseNumber || "(미입력)",
    경매URL: c.sourceUrl || "",
    물건주소: c.address || "(미입력)",
    물건유형: c.propertyType || "(미입력)",
    준공년도: c.builtYear || "",
    층: c.floor || "",
    가구수:
      c.householdCount != null ? String(c.householdCount) : "",
    토지면적: formatAreaSqmLabel(c.landAreaSqm),
    건물면적: formatAreaSqmLabel(c.buildingAreaSqm),
    주차대수:
      c.parkingUnitCount != null ? String(c.parkingUnitCount) : "",
    위반건축: formatViolationLabel(c.hasBuildingViolation),
    건폐율: c.buildingCoverageRatio || "",
    용적율: c.floorAreaRatio || "",
    말소기준: c.lienBaseline || "",
    가구형태: formatRoomShapeSummary(c.roomShapeMix) || "",
    임장조사: buildFieldSurveyText(c),
    감정가: formatMoney(appraisal ?? c.appraisalPrice),
    최저가: formatMoney(c.minPrice),
    입찰일: formatDate(c.bidDate),
    현재회차: String(c.currentRound),
    유찰횟수: String(failed),
    보증금: extras["보증금"] || "",
    오늘날짜: formatDate(new Date().toISOString().slice(0, 10)),
    명의: extras["명의"] || "개인",
    현주택수: extras["현주택수"] || "",
    소득요약: extras["소득요약"] || "",
    카드사용: extras["카드사용"] || "",
    부채요약: extras["부채요약"] || "",
    물건특징: extras["물건특징"] || "",
    매도전략: extras["매도전략"] || "임대 수익 목적",
    감정가대비낙찰가: ratio || extras["감정가대비낙찰가"] || "",
    임차인명: extras["임차인명"] || "",
    ...extras,
    낙찰가: 낙찰가표시,
    내입찰가:
      extras["내입찰가"]?.trim() !== ""
        ? (extras["내입찰가"] ?? "")
        : c.decision.actualBidPrice != null
          ? formatMoney(c.decision.actualBidPrice)
          : "",
  };

  return base;
}

export function interpolateTemplate(
  body: string,
  ctx: TemplateContext,
): string {
  return body.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const v = ctx[key.trim()];
    return v != null ? v : `{${key.trim()}}`;
  });
}
