/**
 * 문서양식 원본 — `public/forms/` 정적 파일과 `FORM_ORIGINAL_DOCS`를 맞춥니다.
 * (원본 강의 자료 `lecture-sources.ts` / `/lectures` 와 같은 방식으로 등록합니다.)
 */

export type FormOriginalDoc = {
  /** 저장 파일명 (`public/forms/` 기준) */
  fileName: string;
  /** 브라우저 요청용 URL */
  href: string;
  title: string;
  description: string;
};

export function formOriginalsHref(fileName: string): string {
  return `/forms/${encodeURIComponent(fileName)}`;
}

export type FormFilePreviewKind = "pdf" | "docx" | "image" | "download";

export function getFormFilePreviewKind(href: string): FormFilePreviewKind {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  return "download";
}

/** `public/forms/`에 둔 파일명과 순서를 맞춥니다. */
export const FORM_ORIGINAL_FILE_NAMES = ["sample.pdf"] as const;

/** 새 양식: 파일을 복사한 뒤 여기에 항목을 추가합니다. */
export const FORM_ORIGINAL_DOCS: FormOriginalDoc[] = [
  {
    fileName: FORM_ORIGINAL_FILE_NAMES[0],
    href: formOriginalsHref(FORM_ORIGINAL_FILE_NAMES[0]),
    title: "샘플 PDF",
    description:
      "등록 예시입니다. `npm run forms:sample-pdf` 로 동일 파일을 다시 만들 수 있습니다.",
  },
];

/** 샘플 PDF 생성 스크립트 출력 파일명 */
export const FORMS_SAMPLE_PDF_FILE_NAME = "sample.pdf" as const;
