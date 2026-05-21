import type { Metadata } from "next";
import { FieldIntelClient } from "./field-intel-client";

export const metadata: Metadata = {
  title: "탐문·시장정보 · AuctionFlow Pro",
  description: "현장 부동산 탐문 정리 — 지역별 임대·경매 인사이트",
};

export default function FieldIntelPage() {
  return <FieldIntelClient />;
}
