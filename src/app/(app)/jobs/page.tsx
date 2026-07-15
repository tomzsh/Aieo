"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { formatDate, statusBadge } from "@/lib/utils";
import { Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

type JobRow = {
  id: string;
  article_id: string;
  status: string;
  attempts: number;
  max_attempts?: number;
  error: string | null;
  llm_model: string | null;
  llm_provider: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  articles?: {
    id: string;
    title: string | null;
    status: string;
    source_url?: string | null;
  } | null;
};

export default function JobsPage() {
  const { t } = useLocale();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [kicking, setKicking] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (opts?: { kick?: boolean }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      // kick=0 on background polls to avoid re-scheduling every few seconds
      const kick = opts?.kick === false ? "0" : "1";
      const qs = filter
        ? `?status=${filter}&limit=40&kick=${kick}`
        : `?limit=40&kick=${kick}`;
      const res = await fetch(`/api/jobs${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat jobs");
        return;
      }
      setJobs(data.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat jobs");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [filter]);

  const hasActive = useMemo(
    () => jobs.some((j) => j.status === "queued" || j.status === "running"),
    [jobs]
  );

  useEffect(() => {
    setLoading(true);
    load({ kick: true });
  }, [load]);

  // Adaptive poll: 5s when active jobs, 12s when idle (less lag/network)
  useEffect(() => {
    const ms = hasActive ? 5000 : 12000;
    const id = setInterval(() => load({ kick: hasActive }), ms);
    return () => clearInterval(id);
  }, [load, hasActive]);

  async function kick(jobId: string) {
    setKicking(jobId);
    try {
      await fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      await load({ kick: false });
    } finally {
      setKicking(null);
    }
  }

  async function cleanupJobs(statuses: ("completed" | "failed")[]) {
    const label = statuses.join(" + ");
    if (
      !confirm(
        `Hapus semua job berstatus ${label} dari riwayat?\n\nArtikel tidak ikut terhapus. Hanya log antrian.`
      )
    ) {
      return;
    }
    setCleaning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/jobs/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statuses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membersihkan job");
        return;
      }
      setMessage(data.message || `${data.deleted} job dihapus`);
      await load({ kick: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membersihkan job");
    } finally {
      setCleaning(false);
    }
  }

  const counts = {
    queued: jobs.filter((j) => j.status === "queued").length,
    running: jobs.filter((j) => j.status === "running").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  };

  return (
    <div>
      <PageHeader
        title={t("jobs.title")}
        description={t("jobs.desc")}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Select
              value={filter}
              onChange={(e) => {
                setLoading(true);
                setFilter(e.target.value);
              }}
              className="sm:w-40"
            >
              <option value="">{t("jobs.allStatus")}</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLoading(true);
                load({ kick: true });
              }}
            >
              <RefreshCw className="h-4 w-4" />
              {t("common.refresh")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={cleaning || counts.completed + counts.failed === 0}
              onClick={() => cleanupJobs(["completed", "failed"])}
              title={t("jobs.clean")}
            >
              {cleaning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t("jobs.clean")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          [t("jobs.queued"), counts.queued, "text-slate-700"],
          [t("jobs.running"), counts.running, "text-blue-700"],
          [t("jobs.completed"), counts.completed, "text-emerald-700"],
          [t("jobs.failed"), counts.failed, "text-rose-700"],
        ].map(([label, n, color]) => (
          <Card key={label as string} className="p-3 sm:p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-2xl font-semibold tabular-nums ${color}`}>
              {n as number}
            </div>
          </Card>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {message}{" "}
          <Link
            href="/settings/data"
            className="font-medium underline underline-offset-2"
          >
            {t("jobs.manageData")}
          </Link>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("jobs.loading")}
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {t("jobs.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((j) => {
              const art = Array.isArray(j.articles)
                ? j.articles[0]
                : j.articles;
              return (
                <li
                  key={j.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusBadge(j.status)}>{j.status}</Badge>
                      <span className="truncate font-medium text-slate-900 dark:text-slate-50">
                        {art?.title || t("articles.untitled")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{formatDate(j.created_at)}</span>
                      <span>
                        attempt {j.attempts}/{j.max_attempts ?? 3}
                      </span>
                      {j.llm_model ? <span>{j.llm_model}</span> : null}
                      {j.error ? (
                        <span className="line-clamp-1 text-rose-600">
                          {j.error}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {art?.id ? (
                      <Link
                        href={`/articles/${art.id}`}
                        className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
                      >
                        {t("jobs.article")}
                      </Link>
                    ) : null}
                    {j.status === "queued" || j.status === "failed" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={kicking === j.id}
                        onClick={() => kick(j.id)}
                      >
                        {kicking === j.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {t("jobs.run")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
