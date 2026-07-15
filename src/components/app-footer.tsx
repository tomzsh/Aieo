"use client";

import Link from "next/link";
import { GithubIcon } from "@/components/github-icon";
import { useLocale } from "@/lib/i18n/locale-provider";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

type AppFooterProps = {
  className?: string;
  /** compact = single line (app shell); full = landing/auth */
  variant?: "compact" | "full";
};

export function AppFooter({
  className,
  variant = "compact",
}: AppFooterProps) {
  const { t, locale } = useLocale();
  const year = new Date().getFullYear();

  if (variant === "full") {
    return (
      <footer
        className={cn(
          "border-t border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/80",
          className
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <div className="font-medium text-slate-700 dark:text-slate-300">
              {SITE.name} · v{SITE.version}
            </div>
            <p className="mt-0.5 max-w-xl">{t("footer.disclaimer")}</p>
            <p className="mt-1">
              © {year} {SITE.githubOwner}. {t("footer.rights")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/docs"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {t("nav.docs")}
            </Link>
            <a
              href={SITE.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={cn(
        "hidden border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 md:block",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <span>
          {SITE.name} v{SITE.version}
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          {locale === "en" ? "Early release" : "Rilis awal"}
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
          © {year}
        </span>
        <a
          href={SITE.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
        >
          <GithubIcon className="h-3.5 w-3.5" />
          {SITE.githubOwner}/{SITE.githubRepo}
        </a>
      </div>
    </footer>
  );
}
