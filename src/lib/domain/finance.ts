/**
 * 차순위 매수신고: 낙찰가 - 보증금 < 내 입찰가 → 신고 가능 (PRD)
 */
export function canSecondBidderReport(
  winPrice: number,
  deposit: number,
  myBidPrice: number,
): boolean {
  return winPrice - deposit < myBidPrice;
}

/** 유찰 후 다음 회차 예상 최저가 (단순 감액률 모델, 설정 가능) */
export function estimateNextMinPrice(
  currentMin: number,
  discountRate = 0.2,
): number {
  if (currentMin <= 0 || discountRate <= 0 || discountRate >= 1) {
    return Math.round(currentMin);
  }
  return Math.round(currentMin * (1 - discountRate));
}
