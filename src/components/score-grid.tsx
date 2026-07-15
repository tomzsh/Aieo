"use client";

import type { SeoScore } from "@/lib/types";
import { cn, scoreColor } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";

const labelKeys: Record<keyof SeoScore, MessageKey> = {
  seo: "score.seo",
  readability: "score.readability",
  content_quality: "score.content_quality",
  ctr: "score.ctr",
  eeat: "score.eeat",
  keyword: "score.keyword",
  heading: "score.heading",
  meta: "score.meta",
  internal_link: "score.internal_link",
};

export function ScoreGrid({ score }: { score: SeoScore | null | undefined }) {
  const { t } = useLocale();

  if (!score) {
    return <p className="text-sm text-slate-500">{t("score.none")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(Object.keys(labelKeys) as (keyof SeoScore)[]).map((key) => {
        const value = Number(score[key] ?? 0);
        return (
          <div
            key={key}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="text-xs text-slate-500">{t(labelKeys[key])}</div>
            <div
              className={cn(
                "mt-0.5 text-xl font-semibold tabular-nums",
                scoreColor(value)
              )}
            >
              {value}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={cn(
                  "h-full rounded-full",
                  value >= 80
                    ? "bg-emerald-500"
                    : value >= 60
                      ? "bg-amber-500"
                      : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
