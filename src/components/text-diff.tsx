"use client";

import { useMemo } from "react";
import {
  diffWords,
  stripHtml,
  summarizeDiff,
  type DiffPart,
} from "@/lib/diff/text-diff";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";

function DiffView({
  parts,
  mode,
  className,
}: {
  parts: DiffPart[];
  mode: "source" | "result";
  className?: string;
}) {
  const filtered =
    mode === "source"
      ? parts.filter((p) => p.type !== "insert")
      : parts.filter((p) => p.type !== "delete");

  return (
    <pre
      className={cn(
        "max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl p-3 text-xs leading-relaxed sm:text-sm",
        className
      )}
    >
      {filtered.map((p, i) => {
        if (p.type === "equal") {
          return (
            <span key={i} className="text-slate-700 dark:text-slate-200">
              {p.text}
            </span>
          );
        }
        if (mode === "source" && p.type === "delete") {
          return (
            <span
              key={i}
              className="rounded-sm bg-rose-200/80 text-rose-950 dark:bg-rose-900/70 dark:text-rose-100"
            >
              {p.text}
            </span>
          );
        }
        if (mode === "result" && p.type === "insert") {
          return (
            <span
              key={i}
              className="rounded-sm bg-emerald-200/80 text-emerald-950 dark:bg-emerald-900/70 dark:text-emerald-100"
            >
              {p.text}
            </span>
          );
        }
        return (
          <span key={i} className="text-slate-700 dark:text-slate-200">
            {p.text}
          </span>
        );
      })}
    </pre>
  );
}

export function TextDiffCompare({
  source,
  result,
  resultIsHtml = false,
}: {
  source: string;
  result: string;
  resultIsHtml?: boolean;
}) {
  const { t } = useLocale();

  const { parts, summary } = useMemo(() => {
    const a = source;
    const b = resultIsHtml ? stripHtml(result) : result;
    const p = diffWords(a, b);
    return { parts: p, summary: summarizeDiff(p) };
  }, [source, result, resultIsHtml]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-300 dark:bg-rose-700" />
          {t("diff.removed")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
          {t("diff.added")}
        </span>
        <span className="ml-auto tabular-nums">
          {t("diff.change")} ~{summary.change_ratio}% · −{summary.delete} / +
          {summary.insert}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("diff.source")}
          </div>
          <DiffView
            parts={parts}
            mode="source"
            className="bg-slate-50 dark:bg-slate-950"
          />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("diff.result")}
          </div>
          <DiffView
            parts={parts}
            mode="result"
            className="bg-slate-50 dark:bg-slate-950"
          />
        </div>
      </div>
    </div>
  );
}
