"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Newspaper } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppFooter } from "@/components/app-footer";
import { isNavActive, MAIN_NAV } from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";

const bottomNav = MAIN_NAV.filter((n) => n.mobilePrimary);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex min-h-dvh bg-slate-100 dark:bg-slate-950">
      <div className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 md:block">
        <Sidebar />
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-900/40 transition-opacity dark:bg-black/70",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
          aria-label={t("nav.closeOverlay")}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] transform shadow-xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 md:hidden pt-[max(0.625rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-800 active:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:active:bg-slate-700"
            aria-label={t("nav.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Newspaper className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                Aieo
              </div>
            </div>
          </Link>
          <LocaleToggle compact />
          <ThemeToggle compact />
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-6xl px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 md:px-6 md:py-8 md:pb-8 lg:px-8">
            {children}
          </div>
        </main>

        <AppFooter />

        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:hidden pb-[env(safe-area-inset-bottom)]"
          aria-label={t("nav.main")}
        >
          <ul
            className="mx-auto grid max-w-lg gap-0.5 px-1 pt-1"
            style={{
              gridTemplateColumns: `repeat(${Math.min(bottomNav.length, 5)}, minmax(0, 1fr))`,
            }}
          >
            {bottomNav.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              const isCta = item.href === "/articles/new";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition active:scale-95",
                      isCta
                        ? "text-indigo-600 dark:text-indigo-300"
                        : active
                          ? "text-indigo-700 dark:text-indigo-300"
                          : "text-slate-500 dark:text-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        isCta
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                          : active
                            ? "bg-indigo-50 dark:bg-indigo-950"
                            : "bg-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="max-w-full truncate">
                      {t(item.shortLabelKey ?? item.labelKey)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
