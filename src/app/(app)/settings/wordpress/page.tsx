"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

import { FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";
import {
  CheckCircle2,
  ExternalLink,
  Laptop,
  Loader2,
  PlugZap,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { LOCAL_WP_PRESETS } from "@/lib/wordpress/url";

type Site = {
  id: string;
  name: string;
  base_url: string;
  username: string;
  is_default: boolean;
  is_local?: boolean;
};

type TestStep = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  error?: string;
};

type TestResult = {
  ok: boolean;
  connected?: boolean;
  status_label?: string;
  message?: string;
  error?: string;
  hint?: string;
  hints?: string[];
  is_local?: boolean;
  site_url?: string;
  name?: string;
  latency_ms?: number;
  rest_style?: "pretty" | "index" | "query";
  user?: { name?: string; roles?: string[] };
  can_create_posts?: boolean;
  categories_count?: number;
  steps?: TestStep[];
  where_to_look?: {
    rest?: string;
    admin?: string;
    posts_all?: string;
    posts_draft?: string;
    posts_publish?: string;
  };
};

export default function WordpressSettingsPage() {
  const { t, locale } = useLocale();
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    username: "",
    app_password: "",
    is_default: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  /** last known status per site id: ok | fail | unknown */
  const [siteStatus, setSiteStatus] = useState<
    Record<string, "ok" | "partial" | "fail">
  >({});

  async function load() {
    const res = await fetch("/api/settings/wordpress");
    const data = await res.json();
    setSites(data.sites ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function applyTestResult(data: TestResult, siteId?: string) {
    setTestResult(data);
    if (siteId) {
      setSiteStatus((prev) => ({
        ...prev,
        [siteId]: data.ok
          ? "ok"
          : data.connected
            ? "partial"
            : "fail",
      }));
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    setTestResult(null);
    const res = await fetch("/api/settings/wordpress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage(
      locale === "en"
        ? `Site saved: ${data.base_url}. Click Test on the site card to verify connection.`
        : `Situs disimpan: ${data.base_url}. Klik Tes di kartu situs untuk memastikan terhubung.`
    );
    setForm({
      name: "",
      base_url: "",
      username: "",
      app_password: "",
      is_default: false,
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm(t("wp.deleteConfirm"))) return;
    await fetch(`/api/settings/wordpress?id=${id}`, { method: "DELETE" });
    load();
  }

  async function syncCategories(siteId?: string) {
    setSyncing(true);
    setError(null);
    setMessage(null);
    const qs = siteId ? `?site_id=${siteId}&sync=1` : "?sync=1";
    const res = await fetch(`/api/wordpress/categories${qs}`);
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage(
      locale === "en"
        ? `Sync done: ${(data.categories ?? []).length} categories from ${data.site?.name ?? "site"}.`
        : `Sync selesai: ${(data.categories ?? []).length} kategori dari ${data.site?.name ?? "site"}.`
    );
  }

  async function testSite(siteId: string) {
    setTestingId(siteId);
    setError(null);
    setMessage(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId }),
      });
      const data = await res.json();
      applyTestResult(data, siteId);
      if (!data.ok && !data.connected) {
        setError(data.error || data.hint || t("llm.testFail"));
      } else {
        setMessage(data.status_label || data.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tes gagal");
      setTestResult({
        ok: false,
        connected: false,
        status_label: "GAGAL TERHUBUNG",
        error: e instanceof Error ? e.message : "Tes gagal",
      });
    }
    setTestingId(null);
  }

  async function testFormCredentials() {
    setTestingForm(true);
    setError(null);
    setMessage(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      applyTestResult(data);
      if (!data.ok && !data.connected) {
        setError(data.error || data.hint || t("llm.testFail"));
      } else {
        setMessage(data.status_label || data.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tes gagal");
    }
    setTestingForm(false);
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("wp.loading")}
      </p>
    );
  }

  const resultOk = testResult?.ok;
  const resultConnected = testResult?.connected ?? testResult?.ok;

  return (
    <div>
      <PageHeader title={t("wp.title")} description={t("wp.desc")} />

      {error ? (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Clear connection status panel */}
      {testResult ? (
        <Card
          className={`mb-4 border-2 p-4 sm:p-5 ${
            resultOk
              ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
              : resultConnected
                ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
                : "border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
          }`}
        >
          <div className="flex items-start gap-3">
            {resultOk ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            ) : resultConnected ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
            ) : (
              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`text-base font-bold tracking-tight ${
                  resultOk
                    ? "text-emerald-900 dark:text-emerald-100"
                    : resultConnected
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-rose-900 dark:text-rose-100"
                }`}
              >
                {testResult.status_label ||
                  (resultOk
                    ? "TERHUBUNG"
                    : resultConnected
                      ? "TERHUBUNG SEBAGIAN"
                      : "TIDAK TERHUBUNG")}
              </div>
              <p className="mt-1 text-sm">
                {testResult.message || testResult.error}
              </p>
              {testResult.site_url || testResult.name ? (
                <p className="mt-1 text-xs opacity-80">
                  {testResult.name ? `${testResult.name} · ` : ""}
                  {testResult.site_url}
                  {testResult.latency_ms != null
                    ? ` · ${testResult.latency_ms}ms`
                    : ""}
                  {testResult.is_local ? " · local" : ""}
                  {testResult.rest_style
                    ? ` · REST: ${
                        testResult.rest_style === "pretty"
                          ? "/wp-json"
                          : testResult.rest_style === "index"
                            ? "/index.php/wp-json"
                            : "?rest_route="
                      }`
                    : ""}
                </p>
              ) : null}
              {testResult.user?.name ? (
                <p className="mt-1 text-xs font-medium opacity-90">
                  Login sebagai: {testResult.user.name}
                  {testResult.user.roles?.length
                    ? ` (${testResult.user.roles.join(", ")})`
                    : ""}
                  {testResult.can_create_posts === false
                    ? " — ⚠ tidak bisa create post"
                    : testResult.can_create_posts
                      ? " — ✓ bisa publish"
                      : ""}
                </p>
              ) : null}

              {testResult.steps && testResult.steps.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {testResult.steps.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-black/20"
                    >
                      {s.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                      )}
                      <div>
                        <div className="font-medium">{s.label}</div>
                        {s.detail ? (
                          <div className="text-slate-600 dark:text-slate-300">
                            {s.detail}
                          </div>
                        ) : null}
                        {s.error ? (
                          <div className="text-rose-700 dark:text-rose-300">
                            {s.error}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {testResult.where_to_look ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {testResult.where_to_look.rest ? (
                    <a
                      href={testResult.where_to_look.rest}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
                    >
                      <ExternalLink className="h-3 w-3" /> REST /wp-json/
                    </a>
                  ) : null}
                  {testResult.where_to_look.admin ? (
                    <a
                      href={testResult.where_to_look.admin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
                    >
                      <ExternalLink className="h-3 w-3" /> WP Admin
                    </a>
                  ) : null}
                  {testResult.where_to_look.posts_draft ? (
                    <a
                      href={testResult.where_to_look.posts_draft}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
                    >
                      Posts → Drafts
                    </a>
                  ) : null}
                  {testResult.where_to_look.posts_publish ? (
                    <a
                      href={testResult.where_to_look.posts_publish}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
                    >
                      Posts → Published
                    </a>
                  ) : null}
                </div>
              ) : null}

              {testResult.hints && testResult.hints.length > 0 ? (
                <ul className="mt-3 list-inside list-disc text-xs opacity-90">
                  {testResult.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {message && !testResult ? (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      <Card className="mb-6 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:p-5">
        <div className="flex items-start gap-3">
          <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
          <div className="min-w-0 space-y-2 text-sm text-sky-950 dark:text-sky-100">
            <div className="font-semibold">
              {locale === "en"
                ? "Localhost WordPress (testing)"
                : "WordPress localhost (testing)"}
            </div>
            <p className="text-xs leading-relaxed text-sky-900/90 dark:text-sky-200/90">
              {locale === "en"
                ? "Your Docker WP is typically http://localhost:8080 (site: Suaranara). After Test you MUST see a big green panel “TERHUBUNG · LOKAL · SIAP PUBLISH”. Red = not connected. After Publish: open WP Admin → Posts (Drafts if draft — not only homepage)."
                : "WP Docker kamu biasanya http://localhost:8080 (situs: Suaranara). Setelah Tes HARUS muncul panel hijau besar “TERHUBUNG · LOKAL · SIAP PUBLISH”. Merah = belum terhubung. Setelah Publish: buka WP Admin → Posts (Drafts jika draft — bukan hanya homepage)."}
            </p>
            <ol className="list-inside list-decimal space-y-0.5 text-xs text-sky-900/90 dark:text-sky-200/90">
              <li>
                {locale === "en"
                  ? "Base URL = http://localhost:8080 → Save site → click Tes"
                  : "Base URL = http://localhost:8080 → Simpan situs → klik Tes"}
              </li>
              <li>
                {locale === "en"
                  ? "Green panel = connected. Then publish with “Publish now”"
                  : "Panel hijau = terhubung. Lalu publish mode “Publish sekarang”"}
              </li>
              <li>
                {locale === "en"
                  ? "Find post in WP Admin → Posts (button appears after success)"
                  : "Cari post di WP Admin → Posts (tombol muncul setelah sukses)"}
              </li>
            </ol>
            <pre className="overflow-x-auto rounded-lg bg-white/80 p-2 text-[11px] text-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
{`// wp-config.php (local only)
define('WP_ENVIRONMENT_TYPE', 'local');
// Users → Profile → Application Passwords
// Optional: Settings → Permalinks → Post name → Save
// REST fallback (Plain): http://localhost:8080/?rest_route=/`}
            </pre>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {LOCAL_WP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      name: f.name || p.name,
                      base_url: p.base_url,
                      is_default: true,
                    }))
                  }
                  className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-100 dark:hover:bg-slate-800"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">
            {t("wp.sites")}
          </h3>
          {sites.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("wp.sites.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {sites.map((s) => {
                const st = siteStatus[s.id];
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {s.name}{" "}
                        {s.is_default ? (
                          <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
                            default
                          </span>
                        ) : null}{" "}
                        {s.is_local ? (
                          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                            local
                          </span>
                        ) : null}{" "}
                        {st === "ok" ? (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            ✓ connected
                          </span>
                        ) : st === "partial" ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                            ~ partial
                          </span>
                        ) : st === "fail" ? (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                            ✗ fail
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            ? untested
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {s.base_url}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        @{s.username}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => testSite(s.id)}
                        disabled={testingId === s.id}
                      >
                        {testingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlugZap className="h-3.5 w-3.5" />
                        )}
                        Tes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => syncCategories(s.id)}
                        disabled={syncing}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("wp.sync")}
                      </Button>
                      <a
                        href={`${s.base_url}/wp-admin/edit.php`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-300 px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Admin
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <form onSubmit={onSubmit}>
          <Card className="space-y-4 p-4 sm:p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-50">
              {t("wp.add")}
            </h3>
            <div>
              <Label>{t("wp.name")}</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="WP Local Test"
              />
            </div>
            <div>
              <Label>{t("wp.baseUrl")}</Label>
              <Input
                required
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="http://localhost:8080"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {locale === "en"
                  ? "Local OK: localhost, 127.0.0.1, *.local, host.docker.internal"
                  : "Lokal OK: localhost, 127.0.0.1, *.local, host.docker.internal"}
              </p>
            </div>
            <div>
              <Label>{t("wp.username")}</Label>
              <Input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
              />
            </div>
            <div>
              <Label>{t("wp.appPassword")}</Label>
              <Input
                required
                type="password"
                value={form.app_password}
                onChange={(e) =>
                  setForm({ ...form, app_password: e.target.value })
                }
                placeholder="xxxx xxxx xxxx xxxx"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {locale === "en"
                  ? "Use Application Password (Users → Profile), NOT the login password."
                  : "Pakai Application Password (Users → Profile), BUKAN password login biasa."}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
              />
              {t("wp.isDefault")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={
                  testingForm ||
                  !form.base_url ||
                  !form.username ||
                  !form.app_password
                }
                onClick={testFormCredentials}
                className="w-full sm:w-auto"
              >
                {testingForm ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                {t("wp.testConn")}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? t("wp.saving") : t("wp.save")}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              {locale === "en"
                ? "Recommended: Test first → if green CONNECTED → Save. Then publish with mode “Publish now” (not Draft) to see it live."
                : "Saran: Tes dulu → jika hijau TERHUBUNG → Simpan. Lalu publish dengan mode “Publish sekarang” (bukan Draft) agar muncul di depan."}
            </p>
          </Card>
        </form>
      </div>
    </div>
  );
}
