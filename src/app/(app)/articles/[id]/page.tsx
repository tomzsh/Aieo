"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { ScoreGrid } from "@/components/score-grid";
import { TextDiffCompare } from "@/components/text-diff";
import type { Article, OptimizedArticle } from "@/lib/types";
import { formatDate, statusBadge } from "@/lib/utils";
import { verdictLabel } from "@/lib/text/similarity";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  History,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { defaultScheduleLocal } from "@/lib/publish/schedule";
import { useLocale } from "@/lib/i18n/locale-provider";

type VersionRow = {
  id: string;
  version: number;
  change_note: string | null;
  created_at: string;
  title: string | null;
  llm_model: string | null;
  mode: string | null;
};

export default function ArticleDetailPage() {
  const { t, locale } = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [optimized, setOptimized] = useState<OptimizedArticle | null>(null);
  const [tab, setTab] = useState<
    "preview" | "seo" | "social" | "raw" | "compare" | "versions"
  >("preview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [publishMode, setPublishMode] = useState<
    "draft" | "pending" | "publish" | "schedule"
  >("publish");
  /** Auto-generate featured image from prompt when none set yet */
  const [autoFeaturedImage, setAutoFeaturedImage] = useState(true);
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleLocal(1));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [featuredUrl, setFeaturedUrl] = useState<string | null>(null);
  const [featuredWpId, setFeaturedWpId] = useState<number | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  /** Image LLM model (not chat model) */
  const [imageModel, setImageModel] = useState("pollinations/flux");
  const [imageProvider, setImageProvider] = useState("pollinations");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imagePresets, setImagePresets] = useState<
    Array<{
      id: string;
      label: string;
      providerHint: string;
      supportsEdit: boolean;
      free?: boolean;
      note?: string;
    }>
  >([]);
  const [imageRemoteModels, setImageRemoteModels] = useState<
    Array<{ id: string }>
  >([]);
  const [editFromUpload, setEditFromUpload] = useState(false);
  const [publishLinks, setPublishLinks] = useState<{
    view: string | null;
    edit: string | null;
    list: string | null;
    status: string | null;
  } | null>(null);
  const pollCount = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const loadVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${id}/versions`);
      const data = await res.json();
      if (res.ok) setVersions(data.versions ?? []);
    } catch {
      /* ignore */
    }
  }, [id]);

  const load = useCallback(async (opts?: { silent?: boolean; versions?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const res = await fetch(`/api/articles/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      if (!opts?.silent) setLoading(false);
      return;
    }
    setArticle(data);
    setOptimized(data.optimized);
    const opt = data.optimized as OptimizedArticle | null;
    setFeaturedUrl(
      data.featured_image_url ||
        opt?.featured_image_url ||
        null
    );
    setFeaturedWpId(
      data.featured_image_wp_id ||
        opt?.featured_image_wp_media_id ||
        null
    );
    if (!opts?.silent) setLoading(false);
    // Versions are heavy (JSON history) — load only when requested / on versions tab
    if (opts?.versions) await loadVersions();
  }, [id, loadVersions]);

  useEffect(() => {
    load({ versions: false });
  }, [load]);

  // Lazy-load version history only when user opens the tab
  useEffect(() => {
    if (tab === "versions" && versions.length === 0) {
      loadVersions();
    }
  }, [tab, versions.length, loadVersions]);

  async function restoreVersion(version: number) {
    if (
      !confirm(
        t("detail.restoreConfirm", { v: version })
      )
    ) {
      return;
    }
    setRestoring(version);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/articles/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal restore");
        return;
      }
      setMessage(data.message || `Restore v${version} berhasil`);
      if (data.article) {
        setArticle(data.article);
        setOptimized(data.article.optimized);
      } else {
        await load({ silent: true });
      }
      await loadVersions();
      setTab("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal restore");
    } finally {
      setRestoring(null);
    }
  }

  // Silent poll while processing (no full-page loading flash)
  useEffect(() => {
    if (!article || article.status !== "processing") {
      pollCount.current = 0;
      return;
    }
    pollCount.current = 0;
    // Poll slower to reduce server load; only article payload (no versions)
    const intervalId = setInterval(async () => {
      pollCount.current += 1;
      // stop after ~6 minutes (80 * 4.5s)
      if (pollCount.current > 80) {
        clearInterval(intervalId);
        setJobError(t("detail.processing") + " (timeout)");
        return;
      }
      await load({ silent: true, versions: false });
    }, 4500);
    return () => clearInterval(intervalId);
  }, [article?.status, load]);

  async function save() {
    if (!optimized) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/articles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        optimized,
        clear_flags: true,
        change_note: "Manual edit from dashboard",
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setArticle(data);
    setOptimized(data.optimized);
    setMessage(t("detail.saved"));
  }

  async function retryOptimize() {
    setRetrying(true);
    setError(null);
    setJobError(null);
    setMessage(null);
    const res = await fetch(`/api/articles/${id}/retry`, { method: "POST" });
    const data = await res.json();
    setRetrying(false);
    if (!res.ok) {
      setError(data.error || "Gagal memulai ulang");
      return;
    }
    setJobStatus(data.status);
    setMessage("Optimasi dijalankan ulang…");
    await load({ silent: true });
  }

  async function deleteArticle() {
    const title = optimized?.title || article?.title || "artikel ini";
    if (
      !confirm(
        `Hapus "${title}"?\n\nJob, versi optimasi, dan log publish terkait ikut terhapus. Tidak bisa dibatalkan.`
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
        setDeleting(false);
        return;
      }
      router.push("/articles");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus");
      setDeleting(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setMessage(null);

    const isSchedule = publishMode === "schedule";
    const res = await fetch(`/api/articles/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: isSchedule ? "future" : publishMode,
        schedule: isSchedule,
        date: isSchedule ? scheduleAt : undefined,
        force: true,
        auto_featured_image: autoFeaturedImage,
        skip_featured_image: !autoFeaturedImage,
        image_model: imageModel,
        image_provider: imageProvider,
      }),
    });
    const data = await res.json();
    setPublishing(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const parts: string[] = [];
    if (data.message) parts.push(data.message);
    if (data.featured_image_generated && data.featured_media) {
      parts.push(
        locale === "en"
          ? `🖼 Featured image generated & uploaded (media #${data.featured_media}).`
          : `🖼 Featured image di-generate & diunggah (media #${data.featured_media}).`
      );
    } else if (data.featured_image_uploaded && data.featured_media) {
      parts.push(
        locale === "en"
          ? `🖼 Featured image uploaded (media #${data.featured_media}).`
          : `🖼 Featured image diunggah (media #${data.featured_media}).`
      );
    } else if (data.featured_media) {
      parts.push(
        locale === "en"
          ? `🖼 Featured image linked (media #${data.featured_media}).`
          : `🖼 Featured image terhubung (media #${data.featured_media}).`
      );
    } else if (data.featured_image_error) {
      parts.push(
        locale === "en"
          ? `⚠ Featured image skipped: ${data.featured_image_error}`
          : `⚠ Featured image dilewati: ${data.featured_image_error}`
      );
    }
    if (data.where_to_look) parts.push(data.where_to_look);
    if (data.wordpress_url) parts.push(`View: ${data.wordpress_url}`);
    if (data.wordpress_edit_url) parts.push(`Edit admin: ${data.wordpress_edit_url}`);
    if (data.wordpress_admin_list)
      parts.push(`Daftar post: ${data.wordpress_admin_list}`);
    setMessage(parts.join("\n") || "Publish OK");
    // Keep last publish links for UI buttons
    if (data.wordpress_url || data.wordpress_edit_url) {
      setPublishLinks({
        view: data.wordpress_url ?? null,
        edit: data.wordpress_edit_url ?? null,
        list: data.wordpress_admin_list ?? null,
        status: data.status ?? publishMode,
      });
    }
    load({ silent: true });
  }

  function updateField<K extends keyof OptimizedArticle>(
    key: K,
    value: OptimizedArticle[K]
  ) {
    if (!optimized) return;
    setOptimized({ ...optimized, [key]: value });
  }

  async function setFeaturedImage(body: Record<string, unknown> | FormData) {
    setImageBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/articles/${id}/featured-image`, {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          [data.error, data.hint].filter(Boolean).join(" — ") ||
            "Gagal set featured image"
        );
        return;
      }
      if (data.cleared) {
        setFeaturedUrl(null);
        setFeaturedWpId(null);
        setImageUrlInput("");
        setMessage(
          locale === "en" ? "Featured image cleared." : "Featured image dihapus."
        );
      } else {
        setFeaturedUrl(data.featured_image_url ?? null);
        setFeaturedWpId(data.featured_image_wp_id ?? null);
        if (data.article?.optimized) setOptimized(data.article.optimized);
        const gen = data.generation;
        const genNote = gen?.model
          ? locale === "en"
            ? ` Generated with ${gen.model} (${gen.source || gen.provider}).`
            : ` Di-generate dengan ${gen.model} (${gen.source || gen.provider}).`
          : "";
        setMessage(
          (data.uploaded_to_wp
            ? locale === "en"
              ? "Image uploaded to WordPress Media."
              : "Gambar diunggah ke Media WordPress."
            : locale === "en"
              ? "Featured image saved."
              : "Featured image disimpan.") + genNote
        );
      }
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal set featured image");
    } finally {
      setImageBusy(false);
    }
  }

  async function generateFeatured(opts?: { file?: File | null }) {
    const prompt = optimized?.featured_image_prompt?.trim();
    if (!prompt) {
      setError(
        locale === "en"
          ? "Fill the image prompt first."
          : "Isi prompt gambar dulu."
      );
      return;
    }
    const file = opts?.file;
    if (file) {
      const fd = new FormData();
      fd.set("generate", "true");
      fd.set("edit", "true");
      fd.set("file", file);
      fd.set("image_model", imageModel);
      fd.set("image_provider", imageProvider);
      fd.set("image_size", imageSize);
      fd.set("prompt", prompt);
      await setFeaturedImage(fd);
      return;
    }
    await setFeaturedImage({
      generate: true,
      edit: editFromUpload && Boolean(featuredUrl),
      image_model: imageModel,
      image_provider: imageProvider,
      image_size: imageSize,
      prompt,
      // re-edit from current featured if toggle on
      ...(editFromUpload && featuredUrl && !featuredUrl.startsWith("data:")
        ? { reference_url: featuredUrl }
        : editFromUpload && featuredUrl?.startsWith("data:")
          ? { reference_data_url: featuredUrl }
          : {}),
    });
  }

  // Load default image model from LLM settings + presets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/llm");
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.image_model_presets)) {
          setImagePresets(data.image_model_presets);
        }
        const s = data.settings;
        if (s?.image_model) setImageModel(String(s.image_model));
        if (s?.image_provider) setImageProvider(String(s.image_provider));
        if (s?.image_size) setImageSize(String(s.image_size));
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch("/api/settings/llm/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: "image" }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.presets) && data.presets.length) {
          setImagePresets(data.presets);
        }
        if (Array.isArray(data.models)) {
          setImageRemoteModels(data.models);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(
        locale === "en" ? "File must be an image." : "File harus berupa gambar."
      );
      return;
    }
    // Prefer FormData upload
    const fd = new FormData();
    fd.append("file", file);
    await setFeaturedImage(fd);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("detail.loading")}
      </div>
    );
  }

  if (!article) {
    return (
      <div className="py-20 text-center text-slate-500">
        {t("detail.notFound")}{" "}
        <button className="text-indigo-600" onClick={() => router.push("/articles")}>
          {t("common.back")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={optimized?.title || article.title || "Artikel"}
        description={t("detail.created", { created: formatDate(article.created_at), updated: formatDate(article.updated_at) })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadge(article.status)}>{article.status}</Badge>
            {article.wordpress_url ? (
              <a
                href={article.wordpress_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <ExternalLink className="h-4 w-4" /> WP
              </a>
            ) : null}
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={deleteArticle}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t("detail.delete")}
            </Button>
          </div>
        }
      />

      {article.flagged_for_review ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{t("detail.needsReview")}</div>
            <ul className="mt-1 list-inside list-disc text-amber-800">
              {(article.flag_reasons ?? []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {article.status === "processing" ? (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {t("detail.processing")}
              {jobStatus ? ` · job: ${jobStatus}` : ""}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retrying}
            onClick={retryOptimize}
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("detail.retry")}
          </Button>
        </div>
      ) : null}

      {article.status === "failed" || jobError ? (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {jobError ||
              t("detail.failed")}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retrying}
            onClick={retryOptimize}
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("detail.retry")}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="mb-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <div className="font-semibold">
            {locale === "en" ? "Success" : "Berhasil"}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
            {message}
          </pre>
          {publishLinks ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {publishLinks.view ? (
                <a
                  href={publishLinks.view}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg bg-emerald-700 px-3 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  {locale === "en" ? "Open post" : "Buka post"}
                </a>
              ) : null}
              {publishLinks.edit ? (
                <a
                  href={publishLinks.edit}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-emerald-700 px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100"
                >
                  {locale === "en" ? "Edit in WP Admin" : "Edit di WP Admin"}
                </a>
              ) : null}
              {publishLinks.list ? (
                <a
                  href={publishLinks.list}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-emerald-700 px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100"
                >
                  {publishLinks.status === "draft"
                    ? locale === "en"
                      ? "Open Drafts list"
                      : "Buka daftar Draft"
                    : locale === "en"
                      ? "Open Posts list"
                      : "Buka daftar Posts"}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!optimized ? (
        <Card className="p-6">
          <h3 className="font-medium text-slate-900">Draf asli</h3>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {article.raw_draft}
          </pre>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {(
                [
                  ["preview", t("detail.tab.preview")],
                  ["seo", t("detail.tab.seo")],
                  ["social", t("detail.tab.social")],
                  ["compare", t("detail.tab.compare")],
                  ["versions", t("detail.tab.versions")],
                  ["raw", t("detail.tab.raw")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium transition sm:flex-1 sm:text-sm ${
                    tab === key
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "preview" ? (
              <Card className="space-y-4 p-6">
                <div>
                  <Label>{t("detail.titleField")}</Label>
                  <Input
                    value={optimized.title}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.lead")}</Label>
                  <Textarea
                    rows={3}
                    value={optimized.lead}
                    onChange={(e) => updateField("lead", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.content")}</Label>
                  <Textarea
                    rows={16}
                    className="font-mono text-[13px]"
                    value={optimized.content}
                    onChange={(e) => updateField("content", e.target.value)}
                  />
                </div>
                <div className="article-preview rounded-lg border border-slate-100 bg-slate-50 p-5 text-sm text-slate-800">
                  <h2 className="mb-4 text-xl font-semibold">{optimized.title}</h2>
                  <div dangerouslySetInnerHTML={{ __html: optimized.content }} />
                </div>
              </Card>
            ) : null}

            {tab === "seo" ? (
              <Card className="space-y-4 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("detail.metaTitle")}</Label>
                    <Input
                      value={optimized.meta_title}
                      onChange={(e) => updateField("meta_title", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {optimized.meta_title?.length ?? 0}/60
                    </p>
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={optimized.slug}
                      onChange={(e) => updateField("slug", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("detail.metaDesc")}</Label>
                  <Textarea
                    rows={2}
                    value={optimized.meta_description}
                    onChange={(e) => updateField("meta_description", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {optimized.meta_description?.length ?? 0}/155
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("detail.primaryKw")}</Label>
                    <Input
                      value={optimized.primary_keyword}
                      onChange={(e) => updateField("primary_keyword", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("detail.category")}</Label>
                    <Input
                      value={optimized.category}
                      onChange={(e) => updateField("category", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("detail.tags")}</Label>
                  <Input
                    value={(optimized.tags ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(
                        "tags",
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </div>
                <div>
                  <Label>{t("detail.excerpt")}</Label>
                  <Textarea
                    rows={2}
                    value={optimized.excerpt}
                    onChange={(e) => updateField("excerpt", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.altTitles")}</Label>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {(optimized.alternative_titles ?? []).map((t, i) => (
                      <li key={i} className="rounded-md bg-slate-50 px-3 py-1.5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label>{t("detail.suggestions")}</Label>
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                    {(optimized.suggestions ?? []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : null}

            {tab === "social" ? (
              <Card className="space-y-4 p-6">
                <div>
                  <Label>{t("detail.facebook")}</Label>
                  <Textarea
                    rows={3}
                    value={optimized.facebook_caption}
                    onChange={(e) => updateField("facebook_caption", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.twitter")}</Label>
                  <Textarea
                    rows={2}
                    value={optimized.twitter_caption}
                    onChange={(e) => updateField("twitter_caption", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.linkedin")}</Label>
                  <Textarea
                    rows={3}
                    value={optimized.linkedin_caption}
                    onChange={(e) => updateField("linkedin_caption", e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("detail.imagePrompt")}</Label>
                  <Textarea
                    rows={3}
                    value={optimized.featured_image_prompt}
                    onChange={(e) =>
                      updateField("featured_image_prompt", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>{t("detail.altText")}</Label>
                  <Input
                    value={optimized.featured_image_alt}
                    onChange={(e) =>
                      updateField("featured_image_alt", e.target.value)
                    }
                  />
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
                    <ImageIcon className="h-4 w-4 text-indigo-600" />
                    Featured image
                  </div>
                  <p className="mb-3 text-xs text-slate-500">
                    {locale === "en"
                      ? "Pick an image model (chat models cannot generate images). Optionally upload a reference photo to edit. Publish can also auto-generate if empty."
                      : "Pilih model image (model chat tidak bisa generate gambar). Opsional: upload foto referensi untuk di-edit. Publish juga bisa auto-generate jika kosong."}
                  </p>

                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">
                        {locale === "en" ? "Image model" : "Model gambar"}
                      </Label>
                      <Select
                        value={imageModel}
                        onChange={(e) => {
                          const id = e.target.value;
                          setImageModel(id);
                          const preset = imagePresets.find((p) => p.id === id);
                          if (preset) setImageProvider(preset.providerHint);
                        }}
                      >
                        <optgroup
                          label={
                            locale === "en" ? "Presets" : "Preset"
                          }
                        >
                          {imagePresets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                              {p.free ? " · free" : ""}
                              {p.supportsEdit ? " · edit" : ""}
                            </option>
                          ))}
                        </optgroup>
                        {imageRemoteModels.length > 0 ? (
                          <optgroup
                            label={
                              locale === "en"
                                ? "From provider /models"
                                : "Dari provider /models"
                            }
                          >
                            {imageRemoteModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.id}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </Select>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {imagePresets.find((p) => p.id === imageModel)?.note ||
                          (locale === "en"
                            ? "Default from Settings → LLM → Image. Not all models support images."
                            : "Default dari Settings → LLM → Image. Tidak semua model support gambar.")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Size</Label>
                      <Select
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value)}
                      >
                        <option value="1024x1024">1024×1024</option>
                        <option value="1280x720">1280×720 (16:9)</option>
                        <option value="1792x1024">1792×1024 (wide)</option>
                        <option value="1024x1792">1024×1792 (portrait)</option>
                        <option value="512x512">512×512</option>
                      </Select>
                      <Input
                        className="mt-2"
                        value={imageProvider}
                        onChange={(e) => setImageProvider(e.target.value)}
                        placeholder="provider (openai, together, …)"
                      />
                    </div>
                  </div>

                  {featuredUrl ? (
                    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featuredUrl}
                        alt={optimized.featured_image_alt || "Featured"}
                        className="max-h-56 w-full object-cover bg-slate-100"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500">
                        <span className="truncate">
                          {featuredWpId
                            ? `WP media #${featuredWpId}`
                            : featuredUrl.slice(0, 60)}
                        </span>
                        <button
                          type="button"
                          className="font-medium text-rose-600 hover:underline"
                          disabled={imageBusy}
                          onClick={() => setFeaturedImage({ clear: true })}
                        >
                          {locale === "en" ? "Remove" : "Hapus"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://…/image.jpg"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={imageBusy || !imageUrlInput.trim()}
                      onClick={() =>
                        setFeaturedImage({ image_url: imageUrlInput.trim() })
                      }
                    >
                      {imageBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      URL
                    </Button>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={editFromUpload}
                      onChange={(e) => setEditFromUpload(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {locale === "en"
                          ? "Edit mode (image-to-image)"
                          : "Mode edit (image-to-image)"}
                      </span>
                      <span className="mt-0.5 block text-slate-500">
                        {locale === "en"
                          ? "Use current featured or upload a photo as reference + prompt. Needs model with edit support (DALL·E 2 / GPT Image 1)."
                          : "Pakai featured saat ini atau upload foto sebagai referensi + prompt. Butuh model yang support edit (DALL·E 2 / GPT Image 1)."}
                      </span>
                    </span>
                  </label>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) =>
                        onPickFile(e.target.files?.[0] ?? null)
                      }
                    />
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        if (f) void generateFeatured({ file: f });
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={imageBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {locale === "en" ? "Upload as featured" : "Upload jadi featured"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        imageBusy || !optimized.featured_image_prompt?.trim()
                      }
                      onClick={() => editFileRef.current?.click()}
                      title={
                        locale === "en"
                          ? "Upload photo → edit with prompt + selected model"
                          : "Upload foto → edit dengan prompt + model terpilih"
                      }
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {locale === "en" ? "Upload & edit" : "Upload & edit"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        imageBusy || !optimized.featured_image_prompt?.trim()
                      }
                      onClick={() => generateFeatured()}
                      title={
                        locale === "en"
                          ? "Generate with selected image model"
                          : "Generate dengan model gambar terpilih"
                      }
                    >
                      {imageBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {locale === "en" ? "Generate" : "Generate"}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {tab === "compare" ? (
              <Card className="p-4 sm:p-6">
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  {t("detail.compare.hint")}
                </p>
                {optimized.meta_processing?.similarity ? (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {verdictLabel(optimized.meta_processing.similarity.verdict)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      · similarity {optimized.meta_processing.similarity.score}%
                      · orisinalitas{" "}
                      {optimized.meta_processing.similarity.originality}%
                    </span>
                  </div>
                ) : null}
                <TextDiffCompare
                  source={article.raw_draft}
                  result={`${optimized.title}\n\n${optimized.content || ""}`}
                  resultIsHtml
                />
                {article.source_url ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {t("detail.source")}:{" "}
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {article.source_url}
                    </a>
                  </p>
                ) : null}
              </Card>
            ) : null}

            {tab === "versions" ? (
              <Card className="p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                    {t("detail.versions")}
                  </h3>
                </div>
                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                  {t("detail.versions.hint")}
                </p>
                {versions.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("detail.versions.empty")}</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                              v{v.version}
                            </Badge>
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                              {v.title || t("articles.untitled")}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(v.created_at)}
                            {v.change_note ? ` · ${v.change_note}` : ""}
                            {v.mode ? ` · ${v.mode}` : ""}
                            {v.llm_model ? ` · ${v.llm_model}` : ""}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={restoring === v.version}
                          onClick={() => restoreVersion(v.version)}
                        >
                          {restoring === v.version ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {t("detail.restore")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}

            {tab === "raw" ? (
              <Card className="p-4 sm:p-6">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {article.raw_draft}
                </pre>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            {optimized.meta_processing?.similarity ? (
              <Card className="p-5">
                <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-50">
                  {t("detail.similarity")}
                </h3>
                <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {optimized.meta_processing.similarity.originality}
                  <span className="text-base font-normal text-slate-500">
                    {t("detail.original")}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {verdictLabel(optimized.meta_processing.similarity.verdict)}
                  {" · "}
                  similarity {optimized.meta_processing.similarity.score}%
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {optimized.meta_processing.mode === "paraphrase"
                    ? t("detail.paraphrase.hint")
                    : t("detail.optimize.hint")}
                </p>
              </Card>
            ) : null}

            <Card className="p-5">
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-50">
                {t("detail.score")}
              </h3>
              <ScoreGrid score={optimized.seo_score} />
            </Card>

            <Card className="space-y-3 p-5">
              <h3 className="font-semibold text-slate-900">{t("detail.keywords")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {optimized.primary_keyword ? (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                    {optimized.primary_keyword}
                  </span>
                ) : null}
                {(optimized.secondary_keywords ?? []).map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {k}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {t("detail.intent")}: {optimized.search_intent || "—"} · {t("detail.schema")}:{" "}
                {optimized.schema || "NewsArticle"}
              </p>
              {optimized.meta_processing ? (
                <p className="text-xs text-slate-400">
                  {optimized.meta_processing.llm_provider}/
                  {optimized.meta_processing.llm_model} · v
                  {optimized.meta_processing.prompt_version}
                </p>
              ) : null}
            </Card>

            <Card className="space-y-3 p-5">
              <h3 className="font-semibold text-slate-900">{t("detail.actions")}</h3>
              <Button
                className="w-full"
                variant="outline"
                onClick={save}
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                {saving ? t("detail.saving") : t("detail.saveEdit")}
              </Button>

              <div>
                <Label>{t("detail.publishMode")}</Label>
                <Select
                  value={publishMode}
                  onChange={(e) =>
                    setPublishMode(e.target.value as typeof publishMode)
                  }
                >
                  <option value="publish">{t("detail.mode.publish")}</option>
                  <option value="draft">{t("detail.mode.draft")}</option>
                  <option value="pending">{t("detail.mode.pending")}</option>
                  <option value="schedule">{t("detail.mode.schedule")}</option>
                </Select>
                {publishMode === "draft" ? (
                  <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    {locale === "en"
                      ? "⚠ Draft does NOT appear on the site homepage. After success open WP Admin → Posts → Drafts (or use the button below)."
                      : "⚠ Draft TIDAK muncul di homepage. Setelah sukses buka WP Admin → Posts → Drafts (atau tombol di banner hijau)."}
                  </p>
                ) : publishMode === "publish" ? (
                  <p className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                    {locale === "en"
                      ? "Will go live immediately. After success, use “Open post” or WP Admin → Posts → Published."
                      : "Langsung live. Setelah sukses, pakai “Buka post” atau WP Admin → Posts → Published."}
                  </p>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5 dark:border-indigo-900 dark:bg-indigo-950/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={autoFeaturedImage}
                  onChange={(e) => setAutoFeaturedImage(e.target.checked)}
                />
                <span className="min-w-0 text-xs leading-relaxed text-indigo-950 dark:text-indigo-100">
                  <span className="font-semibold">
                    {locale === "en"
                      ? "Featured image on publish"
                      : "Featured image saat publish"}
                  </span>
                  <span className="mt-0.5 block opacity-90">
                    {featuredUrl || featuredWpId
                      ? locale === "en"
                        ? "Existing image will be uploaded/linked to WordPress Media."
                        : "Gambar yang sudah ada diunggah/dihubungkan ke Media WordPress."
                      : locale === "en"
                        ? "No image yet → auto-generate from Social tab prompt, upload to WP, set as featured."
                        : "Belum ada gambar → auto-generate dari prompt tab Sosial, upload ke WP, set featured."}
                  </span>
                </span>
              </label>

              {publishMode === "schedule" ? (
                <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50/60 p-3">
                  <Label htmlFor="schedule-at" className="text-sky-900">
                    {t("detail.scheduleAt")}
                  </Label>
                  <Input
                    id="schedule-at"
                    type="datetime-local"
                    value={scheduleAt}
                    min={defaultScheduleLocal(0).slice(0, 16)}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                  <p className="text-[11px] leading-relaxed text-sky-800/80">
                    {t("detail.schedule.hint")}
                  </p>
                </div>
              ) : null}

              {article.status === "scheduled" && article.scheduled_at ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t("detail.scheduled")}
                  </div>
                  <p className="mt-0.5">
                    {new Date(article.scheduled_at).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </p>
                  {article.wordpress_url ? (
                    <a
                      href={article.wordpress_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-indigo-600 hover:underline"
                    >
                      {t("detail.viewWp")}
                    </a>
                  ) : null}
                </div>
              ) : null}

              <Button
                className="w-full"
                onClick={publish}
                disabled={
                  publishing ||
                  (publishMode === "schedule" && !scheduleAt)
                }
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : publishMode === "schedule" ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {publishing
                  ? t("detail.sending")
                  : publishMode === "schedule"
                    ? t("detail.scheduleBtn")
                    : publishMode === "publish"
                      ? t("detail.mode.publish")
                      : "Kirim ke WordPress"}
              </Button>
              <p className="text-xs text-slate-500">
                {locale === "en"
                  ? "WP site must be connected (Settings → WordPress → green TERHUBUNG). After publish, open the green success buttons — not only the homepage if you chose Draft."
                  : "Situs WP harus terhubung (Settings → WordPress → panel hijau TERHUBUNG). Setelah publish, buka tombol di banner hijau — bukan hanya homepage jika mode Draft."}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
