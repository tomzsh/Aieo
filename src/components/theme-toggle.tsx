"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { resolved, setTheme } = useTheme();
  const { t } = useLocale();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border transition active:scale-95",
        "border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
        "dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700",
        compact ? "h-10 w-10" : "min-h-11 h-11 px-3 text-sm font-medium",
        className
      )}
      aria-label={isDark ? t("common.theme.toLight") : t("common.theme.toDark")}
      title={isDark ? t("common.theme.light") : t("common.theme.dark")}
      data-theme-resolved={resolved}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700" />
      )}
      {!compact ? (
        <span className="hidden sm:inline">
          {isDark ? t("common.theme.light") : t("common.theme.dark")}
        </span>
      ) : null}
    </button>
  );
}
