import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    draft:
      "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
    processing:
      "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100",
    ready:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100",
    flagged:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
    published:
      "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-100",
    failed: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-100",
    scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
    queued:
      "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100",
    completed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100",
  };
  return (
    map[status] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
  );
}
