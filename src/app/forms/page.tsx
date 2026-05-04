import type { Metadata } from "next";
import { FormOriginalsView } from "./form-originals-view";

export const metadata: Metadata = {
  title: "문서양식 · AuctionFlow Pro",
  description: "등록한 양식 파일(PDF·DOCX 등)을 미리보고 다운로드합니다.",
};

export default function FormsPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">문서양식</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          강의 원본 DOCX 목록은{" "}
          <a
            href="/lectures"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            원본 자료
          </a>
          와 같이, 파일은{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            public/forms/
          </code>
          에 두고{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            form-sources.ts
          </code>
          의{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">
            FORM_ORIGINAL_DOCS
          </code>
          에 등록합니다. 체크리스트·강의 노트 편집은{" "}
          <a
            href="/process"
            className="font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            프로세스
          </a>
          에서 합니다.
        </p>
      </div>
      <FormOriginalsView />
    </div>
  );
}
