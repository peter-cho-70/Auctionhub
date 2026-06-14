export type AppExperienceMode = "renewal" | "legacy";

export const APP_EXPERIENCE_MODE_KEY = "auctionflow:app-experience-mode";

export const APP_EXPERIENCE_MODES: {
  id: AppExperienceMode;
  label: string;
  description: string;
}[] = [
  {
    id: "renewal",
    label: "뉴 UI",
    description: "PDF 표지 + 파싱 시트 + 아래 분석·탭",
  },
  {
    id: "legacy",
    label: "올드 UI",
    description: "표지·시트 숨김, 기존 탭·단계형만",
  },
];

export function readAppExperienceMode(): AppExperienceMode {
  if (typeof window === "undefined") return "renewal";
  const raw = window.localStorage.getItem(APP_EXPERIENCE_MODE_KEY);
  return raw === "legacy" ? "legacy" : "renewal";
}

export function writeAppExperienceMode(mode: AppExperienceMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_EXPERIENCE_MODE_KEY, mode);
}
