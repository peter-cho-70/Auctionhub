import type {
  AppData,
  CaseStatus,
  ChecklistTemplateItem,
  MessageTemplate,
} from "@/lib/types/domain";
import { SCHEMA_VERSION } from "@/lib/types/domain";

function tid(prefix: string, i: number): string {
  return `${prefix}-${i}`;
}

/** PRD 14단계 순서 (abandoned 제외) */
export const DEFAULT_PROCESS_ORDER: CaseStatus[] = [
  "watching",
  "researching",
  "rights_check",
  "field_check",
  "loan_check",
  "bid_review",
  "bid_day",
  "won",
  "won_day_action",
  "balance",
  "eviction",
  "leasing",
  "completed",
];

function researchChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("rs", ++i);
  return [
    {
      id: n(),
      label: "매각물건명세서·감정평가서·현황조사서 확인",
      required: true,
    },
    {
      id: n(),
      label: "등기부등본(갑·을) 확보 — 접수일 순 정리 준비",
      required: true,
    },
    {
      id: n(),
      label: "배당요구종기일·매각기일 기록 (미신청 시 배당 불가)",
      required: true,
    },
    {
      id: n(),
      label: "유찰 시 지역별 20~30% 저감·다음 회차 전략 메모",
      required: false,
    },
    {
      id: n(),
      label: "임의경매(담보) vs 강제경매(판결) 구분 확인",
      required: false,
    },
  ];
}

function rightsChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("rt", ++i);
  return [
    { id: n(), label: "등기부등본 갑구/을구 날짜 순 정리", required: true },
    {
      id: n(),
      label:
        "말소기준권리 확인 (근저당/가압류/경매개시/담보가등기/선순위전세권)",
      required: true,
    },
    { id: n(), label: "말소기준권리 기준 선후순위 권리 구분", required: true },
    {
      id: n(),
      label: "임차인 전입일 vs 말소기준권리 날짜 비교 (대항력 여부)",
      required: true,
    },
    { id: n(), label: "확정일자 확인 (우선변제권 여부)", required: true },
    { id: n(), label: "배당요구 여부 확인", required: true },
    { id: n(), label: "인수 보증금 예상액 계산", required: true },
    {
      id: n(),
      label: "소액임차인 최우선변제 해당 여부 확인",
      required: false,
    },
    {
      id: n(),
      label:
        "건축물대장: 층수·면적·위반건축물·옥탑방 주거 사용(다세대 전환 리스크)",
      required: true,
    },
    {
      id: n(),
      label: "배당 순위표·당해세·법정기일(세금) 흐름 점검",
      required: false,
    },
  ];
}

function fieldChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("fc", ++i);
  return [
    { id: n(), label: "현장 임장 (출입·실점유·호수별 상태)", required: true },
    {
      id: n(),
      label: "주변 부동산 5곳 이상 방문 — 임대·매매 시세 손품 조사",
      required: true,
    },
    { id: n(), label: "사진·동영상·관리실·부동산 상담 기록", required: true },
    {
      id: n(),
      label: "취사시설·사무소 주거 임대 등 위반건축물 리스크 재확인",
      required: false,
    },
  ];
}

function bidReviewChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("br", ++i);
  return [
    {
      id: n(),
      label:
        "취득세: 조정·비조정 지역 및 N주택 기준으로 세율·특례 적용 검토",
      required: true,
    },
    {
      id: n(),
      label: "법인 매입 시 12% 중과 가정으로 실투자금·수익률 재계산",
      required: false,
    },
    {
      id: n(),
      label: "입찰가+취득세+법무사+수리비−대출−보증금=실투자금·ROI",
      required: true,
    },
    { id: n(), label: "최대 입찰가·리스크 등급·판단 사유 기록", required: true },
  ];
}

function bidDayChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("bd", ++i);
  return [
    {
      id: n(),
      label:
        "입찰표 금액 재확인 (볼펜/화이트 수정 불가 → 새 용지에 재작성)",
      required: true,
    },
    {
      id: n(),
      label: "최저매각가격보다 높게 기재했는지 확인",
      required: true,
    },
    {
      id: n(),
      label: "보증금 정확한 금액 확인 (최저가의 10%, 1원 부족 시 무효)",
      required: true,
    },
    {
      id: n(),
      label: "대리인 입찰 시 위임장+인감증명서+인감도장 지참 여부",
      required: false,
    },
    {
      id: n(),
      label: "차순위 매수신고 가능 여부 사전 계산",
      required: true,
    },
    {
      id: n(),
      label: "공유자 우선매수 신청 가능 물건인지 사전 확인",
      required: false,
    },
    {
      id: n(),
      label: "재매각 물건 여부 확인 (보증금 20%)",
      required: true,
    },
  ];
}

function wonDayChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("wd", ++i);
  return [
    {
      id: n(),
      label: "법원 민사집행과 사건기록 열람 (열람복사신청서, 수수료)",
      required: true,
    },
    {
      id: n(),
      label: "임차인 연락처 및 임차내역 확인 (사건기록)",
      required: true,
    },
    {
      id: n(),
      label: "해당 물건지 방문 — 임차인 접촉 (제3자 화법 권장)",
      required: true,
    },
    { id: n(), label: "수리 내역 체크 및 견적 의뢰", required: false },
    {
      id: n(),
      label: "주변 부동산 5곳 이상 방문 — 임대시세 재확인",
      required: false,
    },
    {
      id: n(),
      label: "대출 상담사에게 문자 발송 (템플릿 활용)",
      required: true,
    },
  ];
}

function simple(items: string[], prefix: string): ChecklistTemplateItem[] {
  return items.map((label, i) => ({
    id: `${prefix}-${i + 1}`,
    label,
    required: i < 2,
  }));
}

export const DEFAULT_CHECKLIST_TEMPLATES: Partial<
  Record<CaseStatus, ChecklistTemplateItem[]>
> = {
  watching: simple(
    [
      "관심 사유·낙찰 목표(조급 낙찰 방지) 메모",
      "다음 회차·입찰일 캘린더 등록",
    ],
    "w",
  ),
  researching: researchChecklist(),
  rights_check: rightsChecklist(),
  field_check: fieldChecklist(),
  loan_check: simple(
    ["대출 가능 여부 상담", "LTV·금리 조건 정리", "경락잔금대출 가능 여부"],
    "lc",
  ),
  bid_review: bidReviewChecklist(),
  bid_day: bidDayChecklist(),
  won: simple(["낙찰 확인", "매각대금 납부기한 확인"], "wn"),
  won_day_action: wonDayChecklist(),
  balance: simple(
    ["잔금 일정 확인", "대출 실행", "소유권 이전 등기"],
    "bl",
  ),
  eviction: simple(
    ["임차인별 명도 상태 정리", "협의/내용증명/인도명령 단계 기록"],
    "ev",
  ),
  leasing: simple(["임대 조건 확정", "임대차계약", "보증금 수령"], "ls"),
  completed: simple(["수익 결산", "교훈·노트에 반영"], "cp"),
};

const LOAN_BODY = `안녕하세요. 금일 낙찰 받고 경락잔금대출 상담 문자 드립니다.
근저당/신탁대출 확인 부탁드립니다.

1. 사건번호: {사건번호}
물건종류: {물건유형} / 비조정지역 / 감정가 {감정가}
낙찰가: {낙찰가} (감정가 대비 {감정가대비낙찰가})

2. 명의: {명의}

3. 현 주택수: {현주택수}

4. 소득: {소득요약}

5. 카드사용: {카드사용}

6. 부채: {부채요약}

7. 물건 특징: {물건특징}

8. 매도 전략: {매도전략}`;

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "tmpl-loan-inquiry",
    category: "loan_inquiry",
    name: "대출 상담사 문자 (낙찰 당일)",
    body: LOAN_BODY,
  },
  {
    id: "tmpl-first-contact",
    category: "first_contact",
    name: "임차인 최초 접촉 (안내)",
    body: `안녕하세요. {사건번호} 관련 낙찰자 측입니다.
{물건주소} 관하여 연락드립니다. 통화 가능 시간을 알려주시면 방문 또는 통화 드리겠습니다.`,
  },
];

export function createDefaultAppData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    processStepOrder: [...DEFAULT_PROCESS_ORDER],
    checklistTemplates: structuredClone(DEFAULT_CHECKLIST_TEMPLATES),
    lectureGuideByStep: {},
    messageTemplates: structuredClone(DEFAULT_MESSAGE_TEMPLATES),
    knowledgeNotes: [],
    cases: [],
  };
}
