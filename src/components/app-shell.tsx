"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StorageQuotaBanner } from "@/components/storage-quota-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { LAST_SELECTED_CASE_KEY } from "@/lib/constants/storage";
import { useAppStore } from "@/store/app-store";

const menuGroups = [
  {
    title: "물건 관리",
    links: [
      { href: "/cases", label: "물건 목록" },
      { href: "/cases", label: "상세항목", kind: "last-case-detail" },
    ],
  },
  {
    title: "가져오기",
    links: [
      { href: "/cases/import-pdf", label: "PDF 등록" },
      { href: "/cases/import-json", label: "JSON 등록" },
    ],
  },
  {
    title: "업무/자료",
    links: [
      { href: "/process", label: "프로세스" },
      { href: "/study", label: "공부하기" },
      { href: "/remodeling", label: "리모델링" },
      { href: "/field-intel", label: "탐문·시장" },
      { href: "/lectures", label: "강의 원본" },
    ],
  },
  {
    title: "관리",
    links: [
      { href: "/data", label: "데이터" },
      { href: "/login", label: "계정" },
    ],
  },
];

function isCaseDetailPath(pathname: string): boolean {
  return (
    pathname.startsWith("/cases/") &&
    !pathname.startsWith("/cases/new") &&
    !pathname.startsWith("/cases/import-")
  );
}

function isActivePath(pathname: string, href: string, kind?: string): boolean {
  if (kind === "last-case-detail") {
    return isCaseDetailPath(pathname);
  }
  if (href === "/cases") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cases = useAppStore((s) => s.data.cases);
  const [lastSelectedCaseId, setLastSelectedCaseId] = useState<string | null>(
    () =>
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(LAST_SELECTED_CASE_KEY),
  );
  const detailPathCaseId = isCaseDetailPath(pathname)
    ? decodeURIComponent(pathname.split("/")[2] ?? "") || null
    : null;
  const effectiveLastSelectedCaseId = detailPathCaseId ?? lastSelectedCaseId;
  const lastSelectedCase = useMemo(
    () => cases.find((c) => c.id === effectiveLastSelectedCaseId) ?? null,
    [cases, effectiveLastSelectedCaseId],
  );

  useEffect(() => {
    if (detailPathCaseId) {
      window.localStorage.setItem(LAST_SELECTED_CASE_KEY, detailPathCaseId);
    }
  }, [detailPathCaseId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/cases"
            className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            AuctionFlow Pro
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {menuGroups.map((group) => (
              <div key={group.title} className="flex flex-wrap items-center gap-1">
                <span className="px-1 text-[11px] font-medium text-neutral-400">
                  {group.title}
                </span>
                {group.links.map(({ href, label, kind }) => {
                  const linkHref =
                    kind === "last-case-detail" && lastSelectedCase
                      ? `/cases/${lastSelectedCase.id}`
                      : href;
                  const active = isActivePath(pathname, href, kind);
                  return (
                    <Link
                      key={`${label}-${kind ?? href}`}
                      href={linkHref}
                      onClick={() => {
                        if (!detailPathCaseId) return;
                        window.localStorage.setItem(
                          LAST_SELECTED_CASE_KEY,
                          detailPathCaseId,
                        );
                        setLastSelectedCaseId(detailPathCaseId);
                      }}
                      title={
                        kind === "last-case-detail"
                          ? lastSelectedCase
                            ? lastSelectedCase.address ||
                              lastSelectedCase.caseNumber ||
                              "선택한 물건 상세"
                            : "선택한 물건이 없으면 물건 목록으로 이동합니다."
                          : undefined
                      }
                      className={`rounded-md px-2.5 py-1.5 transition-colors ${
                        active
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <StorageQuotaBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 bg-[var(--background)] px-4 py-6">
        {children}
      </main>
    </div>
  );
}
