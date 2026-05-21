import type { ScoreFactor } from "@/lib/domain/multifamily-analysis";
import type { PreFieldDecisionGrade } from "@/lib/types/domain";

export function explainTotalScore(totalScore: number): string {
  return (
    `기준 100점에서 가산·감점 요인을 합산한 값입니다(0~150점 클램프). ` +
    `현재 ${totalScore}점 = 100 + (수익성·안전성·현장성·매도성 항목 점수 합). ` +
    `룸 구성, 순수익률, 위반·도로 리스크, 임장 체크 등이 반영됩니다.`
  );
}

export function explainGrade(
  grade: PreFieldDecisionGrade,
  totalScore: number,
  hardFailReasons: string[],
): string {
  if (hardFailReasons.length > 0) {
    return (
      `F등급: Hard Fail 조건(${hardFailReasons.join(", ")})이 있어 ` +
      `총점 ${totalScore}점과 무관하게 임장·입찰 전에 해당 리스크를 먼저 해소해야 합니다.`
    );
  }
  const bands: Record<PreFieldDecisionGrade, string> = {
    A: `120점 이상 → 바로 임장 우선. 총점 ${totalScore}점.`,
    B: `95~119점 → 전화·손품 보강 후 임장. 총점 ${totalScore}점.`,
    C: `75~94점 → 추가 정보 수집 후 재판단. 총점 ${totalScore}점.`,
    D: `75점 미만 → 온라인·부동산 조사 선행. 총점 ${totalScore}점.`,
    F: "Hard Fail",
  };
  return bands[grade];
}

export function explainConfidence(confidencePct: number): string {
  return (
    `각 점수 요인에 붙은 신뢰도(0~100)의 평균입니다. 현재 ${confidencePct}%. ` +
    `문서·임대세팅·손품 입력이 많을수록 높아지고, 추정만 있으면 낮게 나옵니다.`
  );
}

export function explainCategoryScore(
  category: ScoreFactor["category"],
  score: number,
  factors: ScoreFactor[],
): string {
  const items = factors
    .filter((f) => f.category === category)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5)
    .map((f) => `${f.label} (${f.score > 0 ? "+" : ""}${f.score})`);
  const detail = items.length > 0 ? items.join(" · ") : "반영된 요인 없음";
  return `${category} 카테고리 합계 ${score > 0 ? "+" : ""}${score}점. 주요 요인: ${detail}`;
}

export const FIELD_CHECK_ITEM_HINTS: Record<string, string> = {
  mailOverflow:
    "우편함에 장기 적체된 물건은 실제 공실·거주 이탈 신호로, 공실률을 과대 추정할 때 씁니다.",
  waterLeakSigns:
    "복도·천장 누수는 수리비·입찰가 하향 근거. 감정가 대비 실투자금에 반영합니다.",
  exteriorCrack: "외벽 크랙은 방수·구조 점검 필요 신호로 매도성·안전성에 감점 요인이 됩니다.",
  dryvitFront:
    "전면 드라이비트는 저가 마감·하자 논란이 잦아 매도 시 할인 요인으로 봅니다.",
  roofWaterproofRisk: "옥상 방수는 건물 공용 대형 공사. 3단계 리모델링·수리비에 연결됩니다.",
  nearbyRentalDemandScore:
    "1~5 주관 평가. (점수−3)×5가 사전 임장 점수에 반영됩니다. 주변 임대 수요 체감용.",
  subjectiveTenantScore:
    "1~5 「내가 살 만한가」. (점수−3)×6이 현장성 점수에 반영됩니다.",
  gasVacancyMonths:
    "가스 봉인 3개월 이상이면 장기 공실 가능성으로 가산. 2개월 이내 봉인은 이사 공백일 수 있음.",
  actualParkingCount:
    "가구 수 대비 주차 45% 이상이면 가산, 미만이면 감점. 문서 주차 대수와 비교하세요.",
  elevatorWorking: "미작동 시 매도성 감점. 승강기 교체·수리비를 입찰가에 고려합니다.",
  postFieldScore:
    "임장 후 직접 매긴 총점. 사전 점수와 차이가 크면 「점수 차이 원인」에 기록합니다.",
};
