import type { Metadata } from "next";
import { RemodelingGuideClient } from "./remodeling-guide-client";

export const metadata: Metadata = {
  title: "3단계 리모델링 전략 · AuctionFlow Pro",
  description:
    "공실 즉시 수익화, 거주 중 관계 공사, 건물 가치 완성 — 호실별 체크리스트와 비용 가이드",
};

export default function RemodelingPage() {
  return <RemodelingGuideClient />;
}
