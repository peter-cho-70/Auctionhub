import type { Metadata } from "next";
import { LectureOriginalsView } from "./lecture-originals-view";

export const metadata: Metadata = {
  title: "강의 원본 · AuctionFlow Pro",
  description: "DOCX 원본을 미리보고 다운로드합니다.",
};

export default function LecturesPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">강의 원본</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          정리본 DOCX를 브라우저에서 읽기 전용으로 열어봅니다. 단계별 요약은{" "}
          <a
            href="/study"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            공부하기
          </a>
          를 이용하세요.
        </p>
      </div>
      <LectureOriginalsView />
    </div>
  );
}
