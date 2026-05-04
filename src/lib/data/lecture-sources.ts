/**
 * 원본 강의 자료(DOCX) — `public/lectures/originals/` 정적 파일과 짝을 맞춥니다.
 */
import type { CaseStatus } from "@/lib/types/domain";

export type LectureOriginalDoc = {
  /** 저장 파일명 (public 하위 경로용) */
  fileName: string;
  /** 브라우저 요청용 URL */
  href: string;
  title: string;
  description: string;
  relatedSteps: CaseStatus[];
};

function originalsHref(fileName: string): string {
  return `/lectures/originals/${encodeURIComponent(fileName)}`;
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
] as const;

export const LECTURE_ORIGINAL_DOCS: LectureOriginalDoc[] = [
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[0],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[0]),
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
    title: "경매 기초 · 1교시 정리본",
    description: "경매 개념·절차·용어 등 기초 정리.",
    relatedSteps: ["watching", "researching", "rights_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[2],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[2]),
    title: "경매 기초 · 2교시 정리본",
    description: "기초 강의 후반 — 물건 탐색·분석 흐름과 연계.",
    relatedSteps: ["watching", "researching", "field_check", "rights_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[3],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[3]),
    title: "대출 1강 · 1교시 정리본",
    description:
      "규제·전수조사, 가계·사업자 대출, 시설·운전자금, 업종 전략, RTI 등.",
    relatedSteps: ["loan_check", "bid_review", "won_day_action"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[4],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[4]),
    title: "대출 1강 · 2교시 정리본",
    description:
      "대출 1강 후반 — 심사·한도·실무 보완(원본 목차에 맞춰 참고).",
    relatedSteps: ["loan_check", "bid_review", "won", "won_day_action"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[5],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[5]),
    title: "명도 실무 매뉴얼 (상세)",
    description:
      "잔금 후 인도명령·송달·강제집행, 빈집·가처분, 형사·민사 리스크 요약.",
    relatedSteps: ["balance", "eviction"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[6],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[6]),
    title: "명도 1강 · 1교시 정리본",
    description:
      "낙찰 당일 6가지 행동, 사건기록 열람, 연락처 확보, 임차인 최초 접촉.",
    relatedSteps: ["bid_day", "won", "won_day_action", "field_check"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[7],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[7]),
    title: "명도 1강 · 2교시 정리본",
    description:
      "옵션·가전, 빠른 임대·관리, 통신·앱, 월세 체납 대응.",
    relatedSteps: ["won", "leasing", "eviction"],
  },
  {
    fileName: LECTURE_ORIGINAL_FILE_NAMES[8],
    href: originalsHref(LECTURE_ORIGINAL_FILE_NAMES[8]),
    title: "명도 1강 · 3교시 정리본",
    description:
      "예상 배당표·LH/HUG, 명도 실전 5단계, 제3자 화법, 가처분·재계약.",
    relatedSteps: ["rights_check", "bid_review", "eviction", "leasing"],
  },
];
