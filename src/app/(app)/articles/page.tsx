"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { formatDate, statusBadge } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

type ArticleRow = {
  id: string;
  title: string | null;
  status: string;
  flagged_for_review: boolean;
  wordpress_url: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  seo_score: { seo?: number } | number | null;
  featured_image_url?: string | null;
};

function seoValue(seo: ArticleRow["seo_score"]): number | null {
  if (seo == null) return null;
  if (typeof seo === "number") return seo;
  if (typeof seo === "object" && typeof seo.seo === "number") return seo.seo;
  return null;
}

export default function ArticlesPage() {
  const { t, locale } = useLocale();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const limit = 25;

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({
      limit: String(limit),
      page: String(page),
    });
    if (status) qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    const res = await fetch(`/api/articles?${qs}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Gagal memuat artikel");
      setLoading(false);
      return;
    }
    setArticles(data.articles ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.total_pages ?? 1);
    setSelected(new Set());
    setLoading(false);
  }, [status, q, page]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Debounce search input → commit q
  useEffect(() => {
    const tmr = setTimeout(() => {
      setPage(1);
      setQ(qDraft.trim());
    }, 350);
    return () => clearTimeout(tmr);
  }, [qDraft]);

  const allSelected = useMemo(
    () => articles.length > 0 && selected.size === articles.length,
    [articles, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(articles.map((a) => a.id)));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const n = selected.size;
    if (
      !confirm(
        `Hapus ${n} artikel terpilih?\n\nJob, versi, dan log terkait ikut terhapus. Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/articles/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menghapus");
        return;
      }
      setMessage(`${data.deleted} artikel dihapus.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteOne(id: string, title: string | null) {
    if (
      !confirm(
        t("articles.deleteOneConfirm") + (title ? `\n"${title}"` : "")
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menghapus");
        return;
      }
      setMessage("Artikel dihapus.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("articles.title")}
        description={t("articles.desc")}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <div className="relative sm:w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder={
                  locale === "en" ? "Search title…" : "Cari judul…"
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none ring-indigo-500/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50 sm:h-10"
              />
            </div>
            <Select
              value={status}
              onChange={(e) => {
                setLoading(true);
                setPage(1);
                setStatus(e.target.value);
              }}
              className="sm:w-40"
            >
              <option value="">{t("articles.allStatus")}</option>
              <option value="draft">draft</option>
              <option value="processing">processing</option>
              <option value="ready">ready</option>
              <option value="flagged">flagged</option>
              <option value="published">published</option>
              <option value="failed">failed</option>
            </Select>
            <Link
              href="/articles/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 sm:h-10"
            >
              <Plus className="h-4 w-4" /> {t("articles.new")}
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/50">
          <p className="text-sm text-rose-800 dark:text-rose-200">
            <strong>{selected.size}</strong> {t("articles.selected")}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={deleting}
            >
              {t("articles.clearSelection")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={deleteSelected}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t("articles.deleteSelected")}
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("articles.loading")}
          </div>
        ) : articles.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {t("articles.empty")}
            <div className="mt-3">
              <Link
                href="/articles/new"
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t("articles.createFirst")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
              <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label={t("articles.selectAll")}
                />
                {t("articles.selectAll")} ({articles.length})
              </div>
              {articles.map((a) => {
                const seo = seoValue(a.seo_score);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      aria-label={`Pilih ${a.title || "artikel"}`}
                    />
                    <Link href={`/articles/${a.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 font-medium text-slate-900 dark:text-slate-50">
                          {a.title || t("articles.untitled")}
                        </div>
                        <Badge className={statusBadge(a.status)}>
                          {a.status}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <span>{formatDate(a.created_at)}</span>
                        <span>SEO {seo != null ? seo : "—"}</span>
                        {a.flagged_for_review ? (
                          <span className="text-amber-600">{t("articles.needsReview")}</span>
                        ) : null}
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteOne(a.id, a.title)}
                      disabled={deleting}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                      aria-label={t("articles.hapus")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="table-scroll hidden sm:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={t("articles.selectAll")}
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">{t("articles.col.title")}</th>
                    <th className="px-4 py-3 font-medium">{t("articles.col.status")}</th>
                    <th className="px-4 py-3 font-medium">{t("articles.col.seo")}</th>
                    <th className="px-4 py-3 font-medium">{t("articles.col.created")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("articles.col.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {articles.map((a) => {
                    const seo = seoValue(a.seo_score);
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(a.id)}
                            onChange={() => toggle(a.id)}
                            className="h-4 w-4 rounded border-slate-300"
                            aria-label={`Pilih ${a.title || "artikel"}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/articles/${a.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-50 dark:hover:text-indigo-400"
                          >
                            {a.title || t("articles.untitled")}
                          </Link>
                          {a.flagged_for_review ? (
                            <span className="ml-2 text-xs text-amber-600">
                              {t("articles.needsReview")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusBadge(a.status)}>
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                          {seo != null ? seo : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(a.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteOne(a.id, a.title)}
                            disabled={deleting}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("articles.hapus")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {totalPages > 1 || total > 0 ? (
        <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-slate-500">
            {locale === "en"
              ? `${total} article(s) · page ${page}/${totalPages}`
              : `${total} artikel · halaman ${page}/${totalPages}`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-slate-500 sm:text-left">
        {t("articles.cleanupLink")}{" "}
        <Link
          href="/settings/data"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {t("articles.cleanupSettings")}
        </Link>
      </p>
    </div>
  );
}
