import type {
  AppData,
  CaseStatus,
  ChecklistTemplateItem,
  MessageTemplate,
  PropertyAnalysisSettings,
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

export const DEFAULT_NO_DIVIDEND_REQUEST_GUIDE =
  "배당요구 없는 임차인 기본 평가\n\n" +
  "1. 배당요구를 안 했다고 곧바로 안전한 것은 아님\n" +
  "전입이 말소기준권리보다 빠르고 실제 점유 중이면 대항력 있는 임차인일 수 있습니다. 이 경우 배당을 받지 못한 보증금이 매수인 인수로 이어질 수 있습니다.\n\n" +
  "2. 우선변제·최우선변제는 배당요구가 전제\n" +
  "확정일자가 있어도 배당요구종기까지 배당요구를 하지 않으면 일반적인 배당을 받기 어렵습니다. 소액임차인 최우선변제도 대항력과 배당요구 여부를 함께 봐야 합니다.\n\n" +
  "3. 명도 난이도는 높게 본다\n" +
  "배당을 받는 임차인보다 배당을 못 받는 임차인이 협의의 핵심 대상입니다. 미회수 보증금이 크면 명도비·기간·협상 난이도를 입찰가에 반영해야 합니다.\n\n" +
  "4. 반드시 교차 확인\n" +
  "매각물건명세서, 현황조사서, 권리신고 및 배당요구서, 전입세대열람원을 같이 봐야 합니다. 배당신고는 없지만 실제 전입·점유 중인 사람이 있을 수 있습니다.";

export const DEFAULT_PROPERTY_ANALYSIS_SETTINGS: PropertyAnalysisSettings = {
  smallUnitAreaSqm: 30,
  largeBuildingAreaSqm: 500,
  highLandPricePerSqmManwon: 400,
};

function researchChecklist(): ChecklistTemplateItem[] {
  let i = 0;
  const n = () => tid("rs", ++i);
  return [
    {
      id: n(),
      label: "지역 1차 선별: 원룸 월세 30만원 이상·전세 5,000만원 이상 여부 확인",
      required: true,
    },
    {
      id: n(),
      label: "다방 PC·네이버·직방·당근·공실박스에서 월세/전세 시세 3개 이상 교차 확인",
      required: true,
    },
    {
      id: n(),
      label: "최근 3개월 같은 지역 경매 물건 수 확인 — 공급 폭탄·동시 임대 물량 리스크 점검",
      required: true,
    },
    {
      id: n(),
      label: "경매 사이트 종별을 다가구·근린주택·주택까지 넓혀 숨은 다가구 검색",
      required: false,
    },
    {
      id: n(),
      label: "목록수 100개·감정가 높은 순·광역 단위 검색으로 물건 누락 방지",
      required: false,
    },
    {
      id: n(),
      label: "유효조회수 20회 미만·도면 없음·표준지 적음 등 경쟁 감소 포인트 표시",
      required: false,
    },
    {
      id: n(),
      label: "10가구 미만·LPG/기름보일러·단기임대 밀집 지역은 패스 후보로 분류",
      required: true,
    },
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
    {
      id: n(),
      label: "배당요구 임차인 수 ÷ 총 가구 수 계산 — 20% 이하이면 경매 전 공실 의심",
      required: true,
    },
    {
      id: n(),
      label: "임차 보증금 합계 + 근저당 대출 금액 ≥ 감정가 여부로 임대 수요·금융 평가 검증",
      required: false,
    },
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
    {
      id: n(),
      label: "대항력 있어 보이는 임차인이 배당으로 전액 해결되는지 예상 배당표로 재확인",
      required: true,
    },
    {
      id: n(),
      label: "다가구 호별 면적 대장·도면·임대차계약서 면적으로 향후 가처분 목적물 특정 가능성 확인",
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
      label: "건축물대장·도면과 현장 가구 수·문 위치·주차 대수·방 쪼개기 여부 대조",
      required: true,
    },
    {
      id: n(),
      label: "주변 부동산 5곳 이상 방문 — 임대·매매 시세 손품 조사",
      required: true,
    },
    {
      id: n(),
      label: "주변 유사 건물 10개 도시가스 밸브·봉인일 확인 — 3개월 이상 봉인 공실 체크",
      required: true,
    },
    {
      id: n(),
      label: "전기계량기 없음·단선 여부를 호실별 사진/영상으로 기록",
      required: false,
    },
    {
      id: n(),
      label: "우편함·커튼·불빛·장기 우편물 적재로 공실 가능성 예비 파악",
      required: false,
    },
    {
      id: n(),
      label: "배당 100% 예상 임차인→소액임차인→월세/LH→미회수 전세 순서로 면담",
      required: true,
    },
    {
      id: n(),
      label: "임차인 면담에서 누수·하자·재계약 의사·단체 카톡방/최근 민원 확인",
      required: true,
    },
    {
      id: n(),
      label: "주택관리업체/청소업체에 공실 비밀번호·수리 이력·관리비 미납대장·원격관리 가능성 확인",
      required: false,
    },
    {
      id: n(),
      label: "옥상 방수·외벽 균열·드라이비트·타일·배수 상태를 비용 항목으로 기록",
      required: true,
    },
    {
      id: n(),
      label: "엘리베이터 직접 작동 및 정지 시 관리업체에 원인/수리비 확인",
      required: false,
    },
    {
      id: n(),
      label: "룸 구성 판독: 원룸·분리형·1.5룸·투룸·주인세대 구분 및 월세 차이 반영",
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
    {
      id: n(),
      label: "수익률과 순수익률 분리 계산 — 이자·수리비·명도비·중개수수료·예비비 차감",
      required: true,
    },
    {
      id: n(),
      label: "대출이자 3개월치·중개수수료·수리비·총투자금 5~10% 예비자금 확보",
      required: true,
    },
    {
      id: n(),
      label: "나대지 평단가 + 건축비 역산으로 감정가·입찰가 적정성 확인",
      required: false,
    },
    {
      id: n(),
      label: "디스코·밸류맵 최근 1~3년 단독/다가구 실거래와 토지면적·가구수 비교",
      required: true,
    },
    {
      id: n(),
      label: "네이버 호가 매물의 보증금+대출 비율로 매수자 실투자금 역산",
      required: false,
    },
    {
      id: n(),
      label: "감정평가서 비교 표준지 수와 품질 확인 — 1~2개면 감정 오류 가능성 별도 검토",
      required: true,
    },
    {
      id: n(),
      label: "도로 지분·맹지·사유지 도로 폭을 지도 거리측정/로드뷰로 차량 통행 가능성 검증",
      required: false,
    },
    {
      id: n(),
      label: "같은 날 2개 물건 동시 입찰 금지 — 자금·잔금 리스크 기준으로 하나만 선택",
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
    {
      id: n(),
      label: "신용대출·마이너스통장 신규 실행 금지 — 잔금 전 신용점수 하락 방지",
      required: true,
    },
    {
      id: n(),
      label: "관리업체·부동산에 공실 내부 사진·수리 견적·임대 가능 월세 재확인",
      required: false,
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
      "좋은 물건 후보 근거 2~3개 이상 기록 — 도면·공실·시세·조회수·표준지 등",
      "평균 월세만 보지 않고 내 물건의 경쟁력(준신축·주차·엘리베이터·1.5룸)을 별도 메모",
    ],
    "w",
  ),
  researching: researchChecklist(),
  rights_check: rightsChecklist(),
  field_check: fieldChecklist(),
  loan_check: simple(
    [
      "입찰 전 신용점수 확인 및 신용대출 필요 시 낙찰 전 실행 여부 결정",
      "경락잔금대출 가능 여부 상담",
      "LTV·금리 조건 정리",
      "가계대출 vs 사업자대출 vs 법인 취득세·대출 구조 비교",
      "RTI(월 임대÷월 이자) 150%± 안전선 확인",
      "시설자금·운전자금 용도 증빙 가능성 검토",
      "부동산업 한도 소진·업종 한도·대환 가능성 상담사에게 확인",
    ],
    "lc",
  ),
  bid_review: bidReviewChecklist(),
  bid_day: bidDayChecklist(),
  won: simple(
    [
      "낙찰 확인",
      "매각대금 납부기한 확인",
      "매각허가결정·확정·잔금 가능일 캘린더 등록",
      "옵션·가전·잔존물 임의 폐기 금지 — 소유권/명도 절차 확인",
    ],
    "wn",
  ),
  won_day_action: wonDayChecklist(),
  balance: simple(
    [
      "잔금 일정 확인",
      "대출 실행",
      "소유권 이전 등기",
      "잔금 후 인도명령 신청 대상자 정리",
      "점유이전금지 가처분 필요 여부 판단",
      "공과금·관리비·통신사 약정/위약금 정산 확인",
    ],
    "bl",
  ),
  eviction: simple(
    [
      "임차인별 명도 상태 정리",
      "협의/내용증명/인도명령 단계 기록",
      "LH/HUG·배당 받는 임차인·미회수 전세 임차인별 협의 전략 분리",
      "점유이전금지 가처분: 호별 면적 대장·도면·계약서 면적 확보",
      "제3자 화법·문자/통화 기록·명도확인서 수령 관리",
    ],
    "ev",
  ),
  leasing: simple(
    [
      "임대 조건 확정",
      "임대차계약",
      "보증금 수령",
      "건조기·스타일러 등 옵션 제공 시 월세 상승/회수기간 계산",
      "부동산 전부 내놓기 후 주기적 컨택으로 노출 순위 유지",
      "공실 플랫폼·지역 카페·당근/피터팬 매물 등록 전략 확인",
      "통합 통신사 사용 조건을 임대차계약 특약으로 고지",
      "월세 체납 독촉 리듬·재계약 인상/잔류 설득 기준 정리",
    ],
    "ls",
  ),
  completed: simple(
    [
      "수익 결산",
      "교훈·노트에 반영",
      "좋은 물건 포인트 중 실제로 맞았던 항목과 틀린 항목 기록",
      "체크리스트·문자 템플릿·임대 세팅표를 다음 물건 기준으로 업데이트",
    ],
    "cp",
  ),
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
    tenantAnalysisSettings: {
      noDividendRequestGuide: DEFAULT_NO_DIVIDEND_REQUEST_GUIDE,
    },
    propertyAnalysisSettings: { ...DEFAULT_PROPERTY_ANALYSIS_SETTINGS },
    messageTemplates: structuredClone(DEFAULT_MESSAGE_TEMPLATES),
    knowledgeNotes: [],
    cases: [],
  };
}
