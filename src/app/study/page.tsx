import type { Metadata } from "next";
import { StudyClient } from "./study-client";

export const metadata: Metadata = {
  title: "경매 프로세스 공부하기 · AuctionFlow Pro",
  description: "강의 노트 정리본 미리보기 — 단계별로 읽으며 복습합니다.",
};

export default function StudyPage() {
  return <StudyClient />;
}
