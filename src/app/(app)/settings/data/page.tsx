"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  AlertTriangle,
  Database,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

type Stats = {
  articles: {
    total: number;
    by_status: Record<string, number>;
    age: {
      last_7_days: number;
      days_8_to_30: number;
      older_than_30: number;
    };
    oldest_at: string | null;
  };
  jobs: {
    total: number;
    by_status: Record<string, number>;
    oldest_at: string | null;
  };
};

type CleanupResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  dry_run?: boolean;
  articles_matched?: number;
  articles_deleted?: number;
  jobs_matched?: number;
  jobs_deleted?: number;
  matched?: number;
  deleted?: number;
};

const ARTICLE_PRESETS = [
  {
    id: "failed",
    label: "Artikel gagal (failed)",
    target: "articles" as const,
    statuses: ["failed"],
    older_than_days: 0,
    include_published: false,
  },
  {
    id: "draft_old",
    label: "Draft & ready > 30 hari",
    target: "articles" as const,
    statuses: ["draft", "ready", "flagged"],
    older_than_days: 30,
    include_published: false,
  },
  {
    id: "failed_ready_old",
    label: "Failed/draft/flagged > 7 hari",
    target: "articles" as const,
    statuses: ["failed", "draft", "flagged"],
    older_than_days: 7,
    include_published: false,
  },
];

const JOB_PRESETS = [
  {
    id: "jobs_done",
    label: "Job selesai & gagal (semua)",
    statuses: ["completed", "failed"] as string[],
    older_than_days: 0,
  },
  {
    id: "jobs_done_7",
    label: "Job selesai & gagal > 7 hari",
    statuses: ["completed", "failed"] as string[],
    older_than_days: 7,
  },
  {
    id: "jobs_done_30",
    label: "Job selesai & gagal > 30 hari",
    statuses: ["completed", "failed"] as string[],
    older_than_days: 30,
  },
];

export default function DataSettingsPage() {
  const { t } = useLocale();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);

  // Custom form
  const [target, setTarget] = useState<"articles" | "jobs" | "both">("jobs");
  const [olderDays, setOlderDays] = useState("7");
  const [includePublished, setIncludePublished] = useState(false);
  const [articleStatuses, setArticleStatuses] = useState<string[]>([
    "failed",
    "draft",
  ]);
  const [jobStatuses, setJobStatuses] = useState<string[]>([
    "completed",
    "failed",
  ]);

  const loadStats = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/data/stats");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat statistik");
        setLoading(false);
        return;
      }
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function previewThenDelete(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const previewRes = await fetch("/api/data/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, dry_run: true }),
      });
      const preview = await previewRes.json();
      if (!previewRes.ok) {
        setError(preview.error || "Preview gagal");
        setBusy(false);
        return;
      }

      const a = preview.articles_matched ?? 0;
      const j = preview.jobs_matched ?? 0;
      if (a === 0 && j === 0) {
        setResult({
          ok: true,
          dry_run: true,
          message: "Tidak ada data yang cocok dengan filter.",
          articles_matched: 0,
          jobs_matched: 0,
        });
        setBusy(false);
        return;
      }

      const ok = confirm(
        `Akan menghapus:\n• ${a} artikel\n• ${j} job\n\nLanjutkan? Tidak bisa dibatalkan.`
      );
      if (!ok) {
        setResult({
          ok: true,
          dry_run: true,
          message: `Dibatalkan. Preview: ${a} artikel, ${j} job.`,
          articles_matched: a,
          jobs_matched: j,
        });
        setBusy(false);
        return;
      }

      const res = await fetch("/api/data/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, dry_run: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cleanup gagal");
        return;
      }
      setResult(data);
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cleanup gagal");
    } finally {
      setBusy(false);
    }
  }

  function toggleStatus(
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) {
    if (list.includes(value)) setList(list.filter((s) => s !== value));
    else setList([...list, value]);
  }

  return (
    <div>
      <PageHeader
        title={t("data.title")}
        description={t("data.desc")}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true);
              loadStats();
            }}
            disabled={loading || busy}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("common.refresh")}
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {result.message}
          {result.articles_deleted != null || result.jobs_deleted != null ? (
            <span className="mt-1 block text-xs opacity-80">
              {t("data.deletedLine", { a: result.articles_deleted ?? 0, j: result.jobs_deleted ?? 0 })}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
            <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            {t("data.articles")}
          </div>
          {loading && !stats ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("data.loading")}
            </div>
          ) : (
            <>
              <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {stats?.articles.total ?? 0}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stats?.articles.by_status ?? {}).map(
                  ([s, n]) => (
                    <Badge
                      key={s}
                      className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {s}: {n}
                    </Badge>
                  )
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                7 hari: {stats?.articles.age.last_7_days ?? 0} · 8–30 hari:{" "}
                {stats?.articles.age.days_8_to_30 ?? 0} · &gt;30 hari:{" "}
                {stats?.articles.age.older_than_30 ?? 0}
              </p>
            </>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
            <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            {t("data.jobs")}
          </div>
          {loading && !stats ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("data.loading")}
            </div>
          ) : (
            <>
              <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {stats?.jobs.total ?? 0}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stats?.jobs.by_status ?? {}).map(([s, n]) => (
                  <Badge
                    key={s}
                    className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {s}: {n}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{t("data.warning")}</p>
      </div>

      {/* Quick presets */}
      <Card className="mb-6 p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">
          {t("data.quick")}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Satu klik dengan konfirmasi. Preview jumlah dulu, baru hapus.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Job
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {JOB_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    previewThenDelete({
                      target: "jobs",
                      statuses: p.statuses,
                      older_than_days: p.older_than_days,
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Artikel
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {ARTICLE_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    previewThenDelete({
                      target: p.target,
                      statuses: p.statuses,
                      older_than_days: p.older_than_days,
                      include_published: p.include_published,
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Custom */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">
          {t("data.custom")}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Atur target, status, dan umur data.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="target">Target</Label>
            <Select
              id="target"
              value={target}
              onChange={(e) =>
                setTarget(e.target.value as "articles" | "jobs" | "both")
              }
            >
              <option value="jobs">Job saja</option>
              <option value="articles">Artikel saja</option>
              <option value="both">Artikel + job terminal</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="older">Lebih tua dari (hari)</Label>
            <Select
              id="older"
              value={olderDays}
              onChange={(e) => setOlderDays(e.target.value)}
            >
              <option value="0">Semua umur</option>
              <option value="1">1 hari</option>
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="30">30 hari</option>
              <option value="60">60 hari</option>
              <option value="90">90 hari</option>
            </Select>
          </div>
        </div>

        {(target === "articles" || target === "both") && (
          <div className="mt-4">
            <Label>Status artikel</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["draft", "ready", "flagged", "failed", "processing", "published"].map(
                (s) => (
                  <label
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={articleStatuses.includes(s)}
                      onChange={() =>
                        toggleStatus(articleStatuses, setArticleStatuses, s)
                      }
                      disabled={s === "published" && !includePublished}
                    />
                    {s}
                  </label>
                )
              )}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includePublished}
                onChange={(e) => {
                  setIncludePublished(e.target.checked);
                  if (!e.target.checked) {
                    setArticleStatuses((prev) =>
                      prev.filter((s) => s !== "published")
                    );
                  }
                }}
              />
              Izinkan hapus artikel published
            </label>
          </div>
        )}

        {(target === "jobs" || target === "both") && (
          <div className="mt-4">
            <Label>Status job</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["completed", "failed", "queued"].map((s) => (
                <label
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={jobStatuses.includes(s)}
                    onChange={() =>
                      toggleStatus(jobStatuses, setJobStatuses, s)
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const statuses =
                target === "jobs"
                  ? jobStatuses
                  : target === "articles"
                    ? articleStatuses
                    : [...articleStatuses, ...jobStatuses];
              previewThenDelete({
                target,
                statuses,
                older_than_days: Number(olderDays),
                include_published: includePublished,
              });
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {t("data.previewDelete")}
          </Button>
          <Link
            href="/articles"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-800 sm:h-10"
          >
            {t("data.manualSelect")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
