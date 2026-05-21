import type { AuctionCase, KnowledgeNote } from "@/lib/types/domain";

export interface FieldIntelRentRow {
  unitType: string;
  deposit: string;
  monthlyRent: string;
  note: string;
}

export interface FieldIntelAuctionRow {
  label: string;
  amount: string;
  opinion: string;
}

export interface FieldIntelSection {
  id: string;
  title: string;
  bullets: string[];
  table?: FieldIntelRentRow[] | FieldIntelAuctionRow[];
}

export interface FieldIntelGuide {
  id: string;
  title: string;
  subtitle: string;
  exploredAt: string;
  duration: string;
  participants: string;
  /** 주소·사건명 매칭용 키워드 (하나라도 포함 시 연결) */
  addressKeywords: string[];
  summaryBullets: string[];
  sections: FieldIntelSection[];
}

export const FIELD_INTEL_GUIDES: FieldIntelGuide[] = [
  {
    id: "daejeon-health",
    title: "대전 보건전문대 인근",
    subtitle: "부동산 탐문 — 임대차 핵심 정리",
    exploredAt: "2026-05-19",
    duration: "약 44분",
    participants: "부동산 사장(20년), 실장, 서울 투자자 2인",
    addressKeywords: [
      "대전",
      "보건전문대",
      "보건 전문대",
      "스케치빌",
      "유성",
      "봉명",
      "궁동",
    ],
    summaryBullets: [
      "원룸·1.5룸: 보증금 200~300만, 월세 44~50만. 50만 이상이면 경쟁력 약함.",
      "투룸: 학생 수요 거의 없음. 6호 투룸 건물이면 학생 1/3 · 일반인 2/3 가정.",
      "기숙사 완공(~200세대)이 최대 리스크. 지연 중이나 완공 전 엑시트 검토.",
      "경매: 월세 수익률보다 매입가. 2차 최저 ~6.8억 적정, 7억 초반 이상은 손해(스케치빌 기준).",
      "신탁보다 근저당이 임대·중개에 유리. 소액 월세면 신탁도 중개 가능.",
    ],
    sections: [
      {
        id: "rent",
        title: "1. 임대 시세 — 실제 현장 기준",
        bullets: [
          "사장: \"1.5룸이 45만원 가는데 50만원 받아달라 하면 경쟁력 없다. 오히려 44만원을 줘야 한다.\"",
          "학교 주변은 임차인이 '싸다'는 기대로 오기 때문에 시세보다 높으면 바로 외면받는다.",
        ],
        table: [
          {
            unitType: "원룸 / 1룸",
            deposit: "200~300만원",
            monthlyRent: "44~50만원",
            note: "학생 위주. 300만 이하 보증금이 현실적",
          },
          {
            unitType: "1.5룸",
            deposit: "200~500만원",
            monthlyRent: "44~50만원",
            note: "시세 상한. 50만 이상이면 경쟁력 없음",
          },
          {
            unitType: "2룸 (투룸)",
            deposit: "500~1,000만원",
            monthlyRent: "55~65만원",
            note: "일반인 대상. 학생 수요 거의 없음",
          },
        ],
      },
      {
        id: "student",
        title: "2. 학생 임차인 특성",
        bullets: [
          "장점: 월세 안 밀림(부모 납부), 보증금 200~300만도 리스크 낮음, 신축·깨끗하면 1년 만기 80%+",
          "졸업 전 1개월 할인 관행 → 재계약·입소문",
          "단점: 계약 1년 표준, 방학·졸업(겨울) 공실, 다부동산 비교(유람), 남학 군입대 중도 해지",
        ],
      },
      {
        id: "two-room",
        title: "3. 투룸 수요",
        bullets: [
          "\"학생들은 투룸을 안 산다. 점점 기피한다.\" — 개인 공간 선호, 룸메이트 기피",
          "투룸 6호 건물: 학생 1/3, 일반인 2/3 전략",
          "일반인 수요는 버스·자가 접근성 의존 → 무조건 채우기 어려움",
          "인근 신축 아파트 준공 시 투룸 수요가 아파트로 이탈 위험",
        ],
      },
      {
        id: "dorm",
        title: "4. 기숙사 신축 — 임대 시장 최대 위험",
        bullets: [
          "\"기숙사 완공되면 타격은 사실이다. 단, 신축 건물은 살아남는다.\"",
          "보건전문대 기숙사 신축 계획 — 시공사 부도 등으로 수차례 지연",
          "완공까지 2~3년+ 전망, 완공 시 약 200세대 공급 → 주변 원룸 직접 타격",
          "대응: 신축·고급 건물은 상대적 방어, 노후 건물은 치명적",
        ],
      },
      {
        id: "demand",
        title: "5. 학생 수요 기반 — 보건·간호계열",
        bullets: [
          "\"보건·간호계열은 고령화로 앞으로 20~30년은 수요가 안정적이다.\"",
          "전국 각지 유학생 유입, 외부 출신 절반 이상",
          "안경·간호·방사선 등 특화 학과 — 타 지역에서도 유입",
          "3년제 + 심화과정(4년제 전환 추진) → 재학 기간 연장 가능",
        ],
      },
      {
        id: "trust",
        title: "6. 신탁 대출 — 중개 현장 시각",
        bullets: [
          "\"신탁은 소유권이 누구 건지 애매해서 우리는 처음부터 안 들어간다.\"",
          "전세는 신탁에서 불가, 월세는 가능",
          "보증금 200~300만 + 소액 월세면 신탁이어도 중개 가능성",
          "근저당 방식이면 중개·임대 모두 수월",
        ],
      },
      {
        id: "auction",
        title: "7. 경매 적정가 — 스케치빌 물건 기준",
        bullets: [
          "\"월세 수익률 아무리 꼼꼼히 따져도 18억에 사면 무슨 소용이냐. 가격대가 맞아야 모든 게 된다.\"",
        ],
        table: [
          {
            label: "감정가",
            amount: "약 8억원",
            opinion: "—",
          },
          {
            label: "사장 권장 상한",
            amount: "7억 초반",
            opinion: "이상은 손해",
          },
          {
            label: "1차 낙찰(과거)",
            amount: "8억 2,000만원",
            opinion: "1억 5천 더 낸 게 소용 없었고 재경매",
          },
          {
            label: "2차 최저가(당시)",
            amount: "약 6억 8,000만원",
            opinion: "이 정도가 적정",
          },
        ],
      },
      {
        id: "ops",
        title: "8. 임대 관리 운영",
        bullets: [
          "1학기 입주 2/20 · 2학기 입주 8/20 — 학기 사이클 운영",
          "기말고사 전 다음 학기 예약 → 공실 최소화",
          "관리 업체 20년+ 장기 파트너, 월세 협상은 실장 권한(1만원 단위)",
        ],
      },
      {
        id: "conclusion",
        title: "9. 투자자 핵심 조언",
        bullets: [
          "적정 낙찰가를 지켜라 — 1원이라도 비싸면 수익률 역산이 안 됨",
          "보증금 낮게, 월세 현실가 — 학생 위주는 보증금 500만원 이내",
          "투룸은 일반인 1/3 전략 — 100% 학생으로 채우지 말 것",
          "신탁보다 근저당, 기숙사 완공 타이밍 주시·완공 전 엑시트 계획",
          "보건·간호 수요는 20~30년 장기 안정적",
        ],
      },
    ],
  },
];

export function getFieldIntelGuide(id: string): FieldIntelGuide | undefined {
  return FIELD_INTEL_GUIDES.find((guide) => guide.id === id);
}

export function matchFieldIntelGuides(caseData: Pick<AuctionCase, "address" | "caseNumber">): FieldIntelGuide[] {
  const haystack = `${caseData.address} ${caseData.caseNumber}`.toLowerCase();
  if (!haystack.trim()) return [];
  return FIELD_INTEL_GUIDES.filter((guide) =>
    guide.addressKeywords.some((keyword) =>
      haystack.includes(keyword.toLowerCase()),
    ),
  );
}

export function buildFieldSurveySnippet(guide: FieldIntelGuide): string {
  const lines = [
    `[탐문] ${guide.title} (${guide.exploredAt})`,
    "",
    ...guide.summaryBullets.map((item) => `· ${item}`),
    "",
    `전체: /field-intel?guide=${guide.id}`,
  ];
  return lines.join("\n");
}

export function knowledgeNotesForCase(
  notes: KnowledgeNote[],
  caseId: string,
  guideIds: string[] = [],
): KnowledgeNote[] {
  const guideSet = new Set(guideIds);
  return notes.filter(
    (note) =>
      note.linkedCaseId === caseId ||
      (note.fieldIntelGuideId != null && guideSet.has(note.fieldIntelGuideId)),
  );
}

export const DEFAULT_FIELD_INTEL_KNOWLEDGE_NOTE: Omit<
  KnowledgeNote,
  "id" | "createdAt" | "updatedAt"
> = {
  category: "탐문/대전",
  title: "보건전문대 인근 임대·경매 (2026-05-19)",
  fieldIntelGuideId: "daejeon-health",
  linkedCaseId: null,
  body: `대전 보건전문대 인근 부동산 탐문 요약 (2026-05-19, 약 44분)

· 원룸·1.5룸: 보증금 200~300만, 월세 44~50만 (50만↑ 경쟁력 약함)
· 투룸: 학생 수요 거의 없음 → 학생 1/3 · 일반인 2/3
· 기숙사 완공(~200세대) 최대 리스크, 지연 중·완공 전 엑시트 검토
· 스케치빌: 2차 최저 ~6.8억 적정, 7억 초반↑ 손해
· 신탁보다 근저당 유리

상세 표·9개 섹션은 메뉴 「탐문·시장정보」에서 확인하세요.`,
};
