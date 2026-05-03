"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/cases", label: "물건" },
  { href: "/cases/new", label: "새 물건" },
  { href: "/study", label: "공부하기" },
  { href: "/lectures", label: "원본 자료" },
  { href: "/process", label: "프로세스" },
  { href: "/data", label: "데이터" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            AuctionFlow Pro
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {links.map(({ href, label }) => {
              const active =
                href === "/cases"
                  ? pathname === href || pathname.startsWith("/cases/")
                  : href === "/lectures"
                    ? pathname === href || pathname.startsWith("/lectures/")
                    : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
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
          </nav>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 bg-[var(--background)] px-4 py-6">
        {children}
      </main>
    </div>
  );
}
