"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import {
  ClipboardPaste,
  Link2,
  Loader2,
  PenLine,
  Rss,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

type Category = { id: string; name: string; wp_id: number };

type TemplateOption = {
  id: string;
  version: number;
  name: string;
  is_active: boolean;
  created_at?: string;
  preview?: string;
};

type RssItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  published: string | null;
  author: string | null;
};

type SourceTab = "paste" | "url" | "rss";
/** optimize = SEO editor; paraphrase = tulis ulang kuat */
type WorkMode = "optimize" | "paraphrase";

export default function NewArticlePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [workMode, setWorkMode] = useState<WorkMode>("optimize");
  const [rawDraft, setRawDraft] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [manualCategory, setManualCategory] = useState("");
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // Import UI
  const [sourceTab, setSourceTab] = useState<SourceTab>("paste");
  const [articleUrl, setArticleUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [rssMeta, setRssMeta] = useState<{
    title: string;
    feed_url: string;
  } | null>(null);
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [importingItemId, setImportingItemId] = useState<string | null>(null);
  const [rssSelected, setRssSelected] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);
  const [modelOverride, setModelOverride] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    // Parallel light bootstraps only — do NOT auto-fetch remote model lists
    // (that hits external LLM gateways and can hang the page for seconds).
    let cancelled = false;
    Promise.all([
      fetch("/api/wordpress/categories").then((r) => r.json()).catch(() => ({})),
      fetch("/api/settings/prompt-template?light=1")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([cats, prompts]) => {
      if (cancelled) return;
      setCategories(cats.categories ?? []);
      const opts: TemplateOption[] = prompts.options ?? prompts.history ?? [];
      setTemplates(opts);
      const active = opts.find((x) => x.is_active) ?? opts[0];
      if (active) setTemplateId(active.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy-load model list only when user focuses the model field
  function ensureModelsLoaded() {
    if (availableModels.length > 0) return;
    fetch("/api/settings/llm/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.models)) {
          setAvailableModels(d.models.map((m: { id: string }) => m.id));
        }
      })
      .catch(() => {});
  }

  function toggleCategory(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  async function importFromUrl() {
    setImporting(true);
    setError(null);
    setImportMsg(null);
    try {
      const res = await fetch("/api/articles/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: articleUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Gagal mengimpor URL");
        setImporting(false);
        return;
      }
      setTitle(data.title || "");
      setRawDraft(data.content || "");
      setSourceUrl(data.source_url || articleUrl);
      setImportMsg(
        `Diimpor dari URL · ~${data.word_count ?? "?"} kata · ${data.method}`
      );
      setSourceTab("paste");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengimpor URL");
    }
    setImporting(false);
  }

  async function loadRssFeed() {
    setImporting(true);
    setError(null);
    setImportMsg(null);
    setRssItems([]);
    setRssMeta(null);
    try {
      const res = await fetch("/api/articles/import/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", feed_url: feedUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Gagal membaca RSS");
        setImporting(false);
        return;
      }
      setRssMeta({ title: data.title, feed_url: data.feed_url });
      setRssItems(data.items ?? []);
      setRssSelected(new Set());
      setImportMsg(
        `Feed “${data.title}” · ${(data.items ?? []).length} item`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca RSS");
    }
    setImporting(false);
  }

  async function importRssItem(item: RssItem) {
    setImportingItemId(item.id);
    setError(null);
    setImportMsg(null);
    try {
      const res = await fetch("/api/articles/import/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          title: item.title,
          link: item.link,
          summary: item.summary,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Gagal mengimpor item RSS");
        setImportingItemId(null);
        return;
      }
      setTitle(data.title || item.title);
      setRawDraft(data.content || "");
      setSourceUrl(data.source_url || item.link || null);
      setImportMsg(
        `Item RSS diimpor (${data.from}) · ~${data.word_count ?? "?"} kata`
      );
      setSourceTab("paste");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengimpor item RSS");
    }
    setImportingItemId(null);
  }

  function toggleRssItem(id: string) {
    setRssSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRss(checked: boolean) {
    if (!checked) {
      setRssSelected(new Set());
      return;
    }
    setRssSelected(new Set(rssItems.map((i) => i.id)));
  }

  async function batchOptimizeRss() {
    const picked = rssItems.filter((i) => rssSelected.has(i.id));
    if (picked.length === 0) {
      setError("Pilih minimal 1 item RSS");
      return;
    }
    if (!templateId) {
      setError("Pilih prompt template dulu");
      return;
    }
    setBatching(true);
    setError(null);
    setImportMsg(null);

    const cats = [...selected];
    if (manualCategory.trim()) cats.push(manualCategory.trim());

    // Import full content for each (sequential to avoid hammering sites)
    const items: Array<{
      title: string;
      raw_draft: string;
      source_url: string;
      summary: string;
      link: string;
    }> = [];

    for (const item of picked) {
      try {
        const res = await fetch("/api/articles/import/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            title: item.title,
            link: item.link,
            summary: item.summary,
          }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.content) {
          items.push({
            title: data.title || item.title,
            raw_draft: data.content,
            source_url: data.source_url || item.link,
            summary: item.summary,
            link: item.link,
          });
        } else {
          items.push({
            title: item.title,
            raw_draft: item.summary || item.title,
            source_url: item.link,
            summary: item.summary,
            link: item.link,
          });
        }
      } catch {
        items.push({
          title: item.title,
          raw_draft: item.summary || item.title,
          source_url: item.link,
          summary: item.summary,
          link: item.link,
        });
      }
    }

    const res = await fetch("/api/articles/optimize/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        prompt_template_id: templateId,
        categories: cats,
        model: modelOverride || undefined,
      }),
    });
    const data = await res.json();
    setBatching(false);
    if (!res.ok) {
      setError(data.error || "Batch gagal");
      return;
    }
    setImportMsg(
      `Batch: ${data.enqueued}/${data.total} masuk antrian${
        data.failed ? ` · ${data.failed} gagal` : ""
      }`
    );
    router.push("/jobs");
  }

  async function pollJob(jobId: string, articleId: string) {
    const started = Date.now();
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const elapsed = Math.round((Date.now() - started) / 1000);
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json();
      const label =
        data.status === "running"
          ? `running (${elapsed}s) · attempt ${data.attempts ?? "?"} `
          : `${data.status ?? "…"} (${elapsed}s)`;
      setJobStatus(data.error ? `${label} — ${data.error}` : label);
      if (data.status === "completed") {
        router.push(`/articles/${articleId}`);
        return;
      }
      if (data.status === "failed") {
        setError(
          data.error ||
            "Job gagal. Buka artikel lalu tekan Coba lagi, atau ganti template/provider."
        );
        setLoading(false);
        setTimeout(() => router.push(`/articles/${articleId}`), 1500);
        return;
      }
    }
    setError(
      "Timeout menunggu di halaman ini. Job mungkin masih jalan — cek detail artikel."
    );
    setLoading(false);
    router.push(`/articles/${articleId}`);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setJobStatus("queued");

    const cats = [...selected];
    if (manualCategory.trim()) cats.push(manualCategory.trim());

    // Prepend source attribution if imported (metadata only)
    let draft = rawDraft.trim();
    if (sourceUrl && !draft.includes(sourceUrl)) {
      draft = `${draft}\n\n[Sumber: ${sourceUrl}]`;
    }

    try {
      const res = await fetch("/api/articles/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_draft: draft,
          title: title || undefined,
          categories: cats,
          prompt_template_id:
            workMode === "paraphrase" ? undefined : templateId || undefined,
          model: modelOverride || undefined,
          source_url: sourceUrl || undefined,
          source_type: sourceUrl ? "url" : "paste",
          mode: workMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            (workMode === "paraphrase"
              ? "Gagal memulai parafrase"
              : "Gagal memulai optimasi")
        );
        setLoading(false);
        return;
      }
      if (data.prompt_template) {
        setJobStatus(
          `queued · ${workMode === "paraphrase" ? "parafrase" : "optimasi"} · ${data.prompt_template.name} v${data.prompt_template.version}`
        );
      }
      await pollJob(data.job_id, data.article_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  const tabs: { id: SourceTab; label: string; icon: typeof Link2 }[] = [
    {
      id: "paste",
      label:
        workMode === "paraphrase" ? t("new.tab.own") : t("new.tab.paste"),
      icon: workMode === "paraphrase" ? PenLine : ClipboardPaste,
    },
    { id: "url", label: t("new.tab.url"), icon: Link2 },
    ...(workMode === "optimize"
      ? ([{ id: "rss" as const, label: t("new.tab.rss"), icon: Rss }] as const)
      : []),
  ];

  const isParaphrase = workMode === "paraphrase";

  return (
    <div>
      <PageHeader
        title={
          isParaphrase ? t("new.title.paraphrase") : t("new.title.optimize")
        }
        description={
          isParaphrase ? t("new.desc.paraphrase") : t("new.desc.optimize")
        }
      />

      {/* Work mode */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setWorkMode("optimize");
          }}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
            workMode === "optimize"
              ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-600 dark:bg-indigo-950/50"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              workMode === "optimize"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-400"
            }`}
          />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {t("new.mode.optimize")}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t("new.mode.optimize.desc")}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkMode("paraphrase");
            if (sourceTab === "rss") setSourceTab("url");
          }}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
            workMode === "paraphrase"
              ? "border-violet-300 bg-violet-50 shadow-sm dark:border-violet-600 dark:bg-violet-950/50"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          }`}
        >
          <Wand2
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              workMode === "paraphrase"
                ? "text-violet-600 dark:text-violet-400"
                : "text-slate-400"
            }`}
          />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {t("new.mode.paraphrase")}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t("new.mode.paraphrase.desc")}
            </p>
          </div>
        </button>
      </div>

      {isParaphrase ? (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          <strong>Cara pakai parafrase:</strong> ambil konten lewat{" "}
          <strong>Dari URL</strong>, atau tempel di{" "}
          <strong>Draf sendiri</strong>. Hasilnya artikel dengan susunan kalimat
          berbeda (fakta sama) + field SEO siap WordPress. Template{" "}
          <code className="rounded bg-violet-100 px-1 text-xs dark:bg-violet-900">
            paraphrase-v4
          </code>{" "}
          disiapkan otomatis.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="overflow-hidden">
          <div className="flex gap-1 border-b border-slate-100 bg-slate-50/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/50">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSourceTab(t.id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    sourceTab === t.id
                      ? isParaphrase
                        ? "bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300"
                        : "bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 p-6">
            {sourceTab === "url" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="article-url">URL artikel</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="article-url"
                      type="url"
                      value={articleUrl}
                      onChange={(e) => setArticleUrl(e.target.value)}
                      placeholder="https://contoh.com/berita/slug-artikel"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={importFromUrl}
                      disabled={importing || !articleUrl.trim()}
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      {t("new.fetchUrl")}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {isParaphrase
                      ? "Ambil artikel publik lalu parafrase. Bukan halaman login/paywall."
                      : "Server mengambil halaman publik & mengekstrak judul + isi utama (bukan login/paywall)."}
                  </p>
                </div>
              </div>
            ) : null}

            {sourceTab === "rss" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="feed-url">URL feed RSS / Atom</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="feed-url"
                      type="url"
                      value={feedUrl}
                      onChange={(e) => setFeedUrl(e.target.value)}
                      placeholder="https://contoh.com/feed atau /rss.xml"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={loadRssFeed}
                      disabled={importing || !feedUrl.trim()}
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Rss className="h-4 w-4" />
                      )}
                      {t("new.loadFeed")}
                    </Button>
                  </div>
                </div>

                {rssMeta ? (
                  <p className="text-xs text-slate-500">
                    Feed: <span className="font-medium">{rssMeta.title}</span>
                  </p>
                ) : null}

                {rssItems.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            rssSelected.size > 0 &&
                            rssSelected.size === rssItems.length
                          }
                          onChange={(e) => toggleAllRss(e.target.checked)}
                        />
                        {t("new.selectAll")} ({rssSelected.size}/{rssItems.length})
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        disabled={batching || rssSelected.size === 0}
                        onClick={batchOptimizeRss}
                      >
                        {batching ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {t("new.enqueue")} {rssSelected.size || ""} terpilih
                      </Button>
                    </div>
                    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {rssItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="flex min-w-0 gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={rssSelected.has(item.id)}
                              onChange={() => toggleRssItem(item.id)}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900">
                                {item.title}
                              </div>
                              {item.summary ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                  {item.summary}
                                </p>
                              ) : null}
                              <div className="mt-1 text-[11px] text-slate-400">
                                {item.published
                                  ? formatDate(item.published)
                                  : "—"}
                                {item.link ? (
                                  <>
                                    {" · "}
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-600 hover:underline"
                                    >
                                      buka
                                    </a>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={importingItemId === item.id}
                            onClick={() => importRssItem(item)}
                          >
                            {importingItemId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {t("new.useOne")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Masukkan URL feed lalu muat untuk memilih item berita. Centang
                    beberapa item untuk optimasi massal.
                  </p>
                )}
              </div>
            ) : null}

            {(sourceTab === "paste" || rawDraft) && sourceTab !== "rss" ? (
              <>
                {sourceTab === "paste" || importMsg ? (
                  <>
                    <div>
                      <Label htmlFor="title">Judul sementara (opsional)</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                          isParaphrase
                            ? "Akan diganti judul hasil parafrase"
                            : "Akan diganti judul SEO hasil optimasi"
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="draft">
                        {isParaphrase
                          ? "Teks sumber / draf sendiri *"
                          : "Draf artikel mentah *"}
                      </Label>
                      <Textarea
                        id="draft"
                        required
                        rows={14}
                        value={rawDraft}
                        onChange={(e) => setRawDraft(e.target.value)}
                        placeholder={
                          isParaphrase
                            ? "Tempel artikel yang ingin diparafrase, atau isi draf buatan sendiri…"
                            : "Tempel draf berita di sini, atau impor dari tab URL / RSS…"
                        }
                        className="min-h-[240px] font-mono text-[13px] leading-relaxed"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          Min. 50 karakter ·{" "}
                          {
                            rawDraft
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean).length
                          }{" "}
                          kata
                        </span>
                        {sourceUrl ? (
                          <span className="truncate">
                            Sumber:{" "}
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              {sourceUrl}
                            </a>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {sourceTab === "paste" ? null : rawDraft && sourceTab === "rss" ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Draf sudah terisi dari item RSS. Buka tab <strong>Tempel teks</strong>{" "}
                untuk mengedit sebelum optimasi.
              </div>
            ) : null}

            {importMsg ? (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {importMsg}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          {isParaphrase ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2.5 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
              Template otomatis:{" "}
              <strong>paraphrase-v4</strong> (dibuat di workspace jika belum
              ada). Tidak memakai template SEO default.
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label htmlFor="template" className="mb-0">
                  {t("new.template")} *
                </Label>
                <Link
                  href="/settings/prompts"
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  {t("new.manageTemplates")}
                </Link>
              </div>
              <Select
                id="template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                required
                disabled={templates.length === 0}
              >
                {templates.length === 0 ? (
                  <option value="">Belum ada template</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · v{t.version}
                      {t.is_active ? " (default workspace)" : ""}
                    </option>
                  ))
                )}
              </Select>
              {selectedTemplate?.preview ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {selectedTemplate.preview}
                  {selectedTemplate.preview.length >= 160 ? "…" : ""}
                </p>
              ) : null}
            </div>
          )}

          <div>
            <Label>{t("new.categories")}</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada kategori tersinkron. Isi manual di bawah, atau hubungkan
                WordPress di Settings lalu sync.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.name)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected.includes(c.name)
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="manual-cat">{t("new.manualCat")}</Label>
            <Input
              id="manual-cat"
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              placeholder={t("new.manualCat.ph")}
            />
          </div>

          <div>
            <Label htmlFor="model-override">
              {t("new.model")}{" "}
              <span className="font-normal text-slate-400">
                {t("new.model.hint")}
              </span>
            </Label>
            <Input
              id="model-override"
              value={modelOverride}
              onChange={(e) => setModelOverride(e.target.value)}
              onFocus={ensureModelsLoaded}
              placeholder="Kosong = model default Settings → LLM"
              list="model-override-list"
            />
            {availableModels.length > 0 ? (
              <datalist id="model-override-list">
                {availableModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            ) : null}
          </div>
        </Card>

        {error ? (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isParaphrase ? "Memproses parafrase" : "Memproses optimasi"}…
            status: {jobStatus ?? "queued"}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/articles")}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={
              loading ||
              rawDraft.trim().length < 50 ||
              (!isParaphrase && !templateId)
            }
            className={
              isParaphrase
                ? "bg-violet-600 hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
                : undefined
            }
          >
            {loading ? (
              t("new.processing")
            ) : isParaphrase ? (
              <>
                <Wand2 className="h-4 w-4" /> {t("new.start.paraphrase")}
              </>
            ) : (
              t("new.start.optimize")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
