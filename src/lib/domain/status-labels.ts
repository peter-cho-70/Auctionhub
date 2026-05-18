import type { CaseStatus } from "@/lib/types/domain";

export const STATUS_LABELS: Record<CaseStatus, string> = {
  watching: "관심물건",
  researching: "물건 검색",
  rights_check: "권리분석중",
  field_check: "임장예정/중",
  loan_check: "대출조사중",
  bid_review: "입찰검토",
  bid_day: "입찰 당일",
  won: "낙찰",
  won_day_action: "낙찰 당일",
  balance: "잔금/이전",
  eviction: "명도중",
  leasing: "임대/매도중",
  completed: "완료",
  abandoned: "포기/보류",
};
