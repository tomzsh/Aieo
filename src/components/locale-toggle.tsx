"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LocaleToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-500 dark:bg-slate-800",
        compact ? "h-10" : "min-h-11 h-11",
        className
      )}
      role="group"
      aria-label={t("common.locale.switch")}
    >
      <button
        type="button"
        onClick={() => setLocale("id")}
        className={cn(
          "rounded-lg px-2.5 text-xs font-semibold transition sm:px-3 sm:text-sm",
          compact ? "h-9" : "h-10 sm:h-9",
          locale === "id"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        )}
        aria-pressed={locale === "id"}
        title={t("common.locale.id")}
      >
        ID
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-lg px-2.5 text-xs font-semibold transition sm:px-3 sm:text-sm",
          compact ? "h-9" : "h-10 sm:h-9",
          locale === "en"
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        )}
        aria-pressed={locale === "en"}
        title={t("common.locale.en")}
      >
        EN
      </button>
    </div>
  );
}
