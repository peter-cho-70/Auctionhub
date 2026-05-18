/**
 * 원본 강의 자료(DOCX) — public 파일과 외부 강의 정리 폴더의 allowlist를 함께 사용합니다.
 */
import type { CaseStatus } from "@/lib/types/domain";

export type LectureOriginalDoc = {
  /** 저장 파일명 */
  fileName: string;
  /** 브라우저 요청용 URL */
  href: string;
  groupTitle: string;
  title: string;
  description: string;
  relatedSteps: CaseStatus[];
};

function originalsHref(fileName: string): string {
  return `/api/lecture-original?file=${encodeURIComponent(fileName)}`;
}

export const LECTURE_ORIGINAL_FILE_NAMES = [
  "곰물주_경매_강의노트_정리본.docx",
  "경매기초_1교시_정리본.docx",
  "경매기초_2교시_정리본.docx",
  "대출1강_1교시_정리본.docx",
  "대출1강_2교시_정리본.docx",
  "명도_실무_매뉴얼_상세.docx",
  "명도1강_1교시_정리본.docx",
  "명도1강_2교시_정리본.docx",
  "명도1강_3교시_정리본.docx",
  "곰물주_경매기초_1교시_강의정리.docx",
  "곰물주_경매기초_2교시_강의정리.docx",
  "곰물주_대출2_1교시_강의정리.docx",
  "곰물주_대출2_2교시_강의정리.docx",
  "곰물주_좋은물건_1차_강의정리.docx",
  "곰물주_좋은물건2_1강_강의정리.docx",
  "곰물주_좋은물건2_2강_강의정리.docx",
  "곰물주_좋은물건2_3강_강의정리.docx",
] as const;

export const LECTURE_ORIGINAL_DOCS: LectureOriginalDoc[] = [
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[0],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[0]),
    groupTitle: "통합 정리본",
    title: "곰물주 경매 강의노트 정리본",
    description:
      "다가구 경매 핵심 — 기초·권리·배당·세금·실행·체크리스트 전반.",
    relatedSteps: [
      "watching",
      "researching",
      "rights_check",
      "bid_review",
      "bid_day",
      "won",
      "won_day_action",
      "balance",
      "eviction",
      "leasing",
    ],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[1],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[1]),
    groupTitle: "경매기초",
    title: "경매 기초 · 1교시 정리본",
    description: "경매 개념·절차·용어 등 기초 정리.",
    relatedSteps: ["watching", "researching", "rights_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[2],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[2]),
    groupTitle: "경매기초",
    title: "경매 기초 · 2교시 정리본",
    description: "기초 강의 후반 — 물건 탐색·분석 흐름과 연계.",
    relatedSteps: ["watching", "researching", "field_check", "rights_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[3],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[3]),
    groupTitle: "대출",
    title: "대출 1강 · 1교시 정리본",
    description:
      "규제·전수조사, 가계·사업자 대출, 시설·운전자금, 업종 전략, RTI 등.",
    relatedSteps: ["loan_check", "bid_review", "won_day_action"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[4],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[4]),
    groupTitle: "대출",
    title: "대출 1강 · 2교시 정리본",
    description:
      "대출 1강 후반 — 심사·한도·실무 보완(원본 목차에 맞춰 참고).",
    relatedSteps: ["loan_check", "bid_review", "won", "won_day_action"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[5],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[5]),
    groupTitle: "명도",
    title: "명도 실무 매뉴얼 (상세)",
    description:
      "잔금 후 인도명령·송달·강제집행, 빈집·가처분, 형사·민사 리스크 요약.",
    relatedSteps: ["balance", "eviction"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[6],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[6]),
    groupTitle: "명도",
    title: "명도 1강 · 1교시 정리본",
    description:
      "낙찰 당일 6가지 행동, 사건기록 열람, 연락처 확보, 임차인 최초 접촉.",
    relatedSteps: ["bid_day", "won", "won_day_action", "field_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[7],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[7]),
    groupTitle: "명도",
    title: "명도 1강 · 2교시 정리본",
    description:
      "옵션·가전, 빠른 임대·관리, 통신·앱, 월세 체납 대응.",
    relatedSteps: ["won", "leasing", "eviction"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[8],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[8]),
    groupTitle: "명도",
    title: "명도 1강 · 3교시 정리본",
    description:
      "예상 배당표·LH/HUG, 명도 실전 5단계, 제3자 화법, 가처분·재계약.",
    relatedSteps: ["rights_check", "bid_review", "eviction", "leasing"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[9],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[9]),
    groupTitle: "경매기초",
    title: "곰물주 경매기초 · 1교시 강의정리",
    description: "기초 개념, 경매 절차, 입찰 전 기본 판단 흐름 보강본.",
    relatedSteps: ["watching", "researching", "rights_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[10],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[10]),
    groupTitle: "경매기초",
    title: "곰물주 경매기초 · 2교시 강의정리",
    description: "물건 검색, 권리·현장 확인, 입찰 전 검토 흐름 보강본.",
    relatedSteps: ["researching", "field_check", "rights_check", "bid_review"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[11],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[11]),
    groupTitle: "대출",
    title: "곰물주 대출 2 · 1교시 강의정리",
    description: "잔금대출, 신용관리, 사업자·가계 대출 판단 보강본.",
    relatedSteps: ["loan_check", "bid_review", "won_day_action"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[12],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[12]),
    groupTitle: "대출",
    title: "곰물주 대출 2 · 2교시 강의정리",
    description: "대출 실행 전후 자금 여유, 리스크 관리, 대환 전략 보강본.",
    relatedSteps: ["loan_check", "bid_review", "won", "balance"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[13],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[13]),
    groupTitle: "좋은 물건 찾기",
    title: "좋은 물건 찾기 · 1차 강의정리",
    description:
      "지역 선정, 월세·전세 수요, 공급 폭탄, 감정평가서·토지가치 분석.",
    relatedSteps: ["researching", "field_check", "rights_check", "bid_review"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[14],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[14]),
    groupTitle: "좋은 물건 찾기",
    title: "좋은 물건 찾기 2 · 1강 강의정리",
    description:
      "현장 임장, 임차인 면담, 주택관리업체 활용, 공실·시설 점검.",
    relatedSteps: ["field_check", "rights_check", "won_day_action", "leasing"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[15],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[15]),
    groupTitle: "좋은 물건 찾기",
    title: "좋은 물건 찾기 2 · 2강 강의정리",
    description:
      "룸 구성, 도면 판독, 옵션 전략, 내부 사진 검색, 매매가·순수익률 계산.",
    relatedSteps: ["researching", "field_check", "bid_review", "leasing"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[16],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[16]),
    groupTitle: "좋은 물건 찾기",
    title: "좋은 물건 찾기 2 · 3강 강의정리",
    description:
      "검색 필터, 좋은 물건 13가지 포인트, 도로 지분, 입찰 주의사항, 유지비.",
    relatedSteps: [
      "researching",
      "field_check",
      "loan_check",
      "bid_review",
      "eviction",
      "leasing",
    ],
  },
];
