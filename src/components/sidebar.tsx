"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Newspaper, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isNavActive, MAIN_NAV } from "@/components/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { GithubIcon } from "@/components/github-icon";
import { useLocale } from "@/lib/i18n/locale-provider";
import { SITE } from "@/lib/site";

export function Sidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    onNavigate?.();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex h-full w-full max-w-[18rem] flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5 dark:border-slate-700">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Newspaper className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              Aieo
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-300">
              {t("app.tagline")}
            </div>
          </div>
        </Link>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2 sm:p-3">
        {MAIN_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition active:scale-[0.99]",
                active
                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-600 dark:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3 dark:border-slate-700">
        <div className="flex gap-2">
          <LocaleToggle className="flex-1 justify-center" />
          <ThemeToggle className="flex-1" />
        </div>
        <a
          href={SITE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <GithubIcon className="h-4 w-4" />
          GitHub
        </a>
        <button
          type="button"
          onClick={signOut}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
}
