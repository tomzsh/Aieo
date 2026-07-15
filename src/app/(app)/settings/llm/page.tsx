"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import { Loader2, PlugZap, RefreshCw } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

type ProviderOption = {
  id: string;
  label: string;
  defaultBaseUrl: string | null;
  defaultModel: string;
  envApiKey: string | null;
  group: string;
  supportsJsonMode: boolean;
  help: string | null;
  requiresBaseUrl: boolean;
};

type RemoteModel = {
  id: string;
  owned_by?: string | null;
};



export default function LlmSettingsPage() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [form, setForm] = useState({
    provider: "xai",
    model: "grok-4.5",
    base_url: "",
    api_key: "",
    clear_api_key: false,
    api_key_set: false,
    fallback_provider: "",
    fallback_model: "",
    fallback_base_url: "",
    fallback_api_key: "",
    clear_fallback_api_key: false,
    fallback_api_key_set: false,
    use_json_mode: true,
    temperature: 0.2,
    max_tokens: 8192,
    top_p: 0.9,
    // Image generation (separate from chat model)
    image_provider: "pollinations",
    image_model: "pollinations/flux",
    image_base_url: "",
    image_api_key: "",
    clear_image_api_key: false,
    image_api_key_set: false,
    image_size: "1024x1024",
    image_quality: "standard",
  });
  const [imagePresets, setImagePresets] = useState<
    Array<{
      id: string;
      label: string;
      providerHint: string;
      supportsEdit?: boolean;
      free?: boolean;
      note?: string;
    }>
  >([]);
  const [imageModels, setImageModels] = useState<RemoteModel[]>([]);
  const [imageModelsLoading, setImageModelsLoading] = useState(false);
  const [imageModelsNote, setImageModelsNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto model lists
  const [models, setModels] = useState<RemoteModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsMeta, setModelsMeta] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<"select" | "manual">("select");

  const [fbModels, setFbModels] = useState<RemoteModel[]>([]);
  const [fbModelsLoading, setFbModelsLoading] = useState(false);
  const [fbModelsError, setFbModelsError] = useState<string | null>(null);
  const [fbModelMode, setFbModelMode] = useState<"select" | "manual">("manual");

  const selected = useMemo(
    () => providers.find((p) => p.id === form.provider),
    [providers, form.provider]
  );

  const fetchModels = useCallback(
    async (opts?: {
      target?: "primary" | "fallback";
      silent?: boolean;
    }) => {
      const target = opts?.target ?? "primary";
      const isPrimary = target === "primary";

      if (isPrimary) {
        setModelsLoading(true);
        setModelsError(null);
        if (!opts?.silent) setModelsMeta(null);
      } else {
        setFbModelsLoading(true);
        setFbModelsError(null);
      }

      try {
        const body =
          target === "fallback"
            ? {
                target: "fallback",
                provider: form.fallback_provider || form.provider,
                base_url: form.fallback_base_url || form.base_url || null,
                api_key:
                  form.fallback_api_key || form.api_key || undefined,
              }
            : {
                provider: form.provider,
                base_url: form.base_url || null,
                api_key: form.api_key || undefined,
              };

        const res = await fetch("/api/settings/llm/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          const err = data.error || "Gagal mengambil daftar model";
          if (isPrimary) {
            setModels([]);
            setModelsError(err);
            setModelMode("manual");
          } else {
            setFbModels([]);
            setFbModelsError(err);
            setFbModelMode("manual");
          }
          return;
        }

        const list: RemoteModel[] = data.models ?? [];
        if (isPrimary) {
          setModels(list);
          setModelsMeta(
            `${list.length} model · ${data.provider}${
              data.base_url ? ` · ${data.base_url}` : ""
            }`
          );
          setModelMode(list.length > 0 ? "select" : "manual");
          // If current model not in list, keep it but allow manual
          if (
            list.length > 0 &&
            form.model &&
            !list.some((m) => m.id === form.model)
          ) {
            // keep custom value visible via select+option or switch manual
            setModelMode("manual");
          }
        } else {
          setFbModels(list);
          setFbModelMode(list.length > 0 ? "select" : "manual");
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : "Gagal fetch models";
        if (isPrimary) {
          setModelsError(err);
          setModelMode("manual");
        } else {
          setFbModelsError(err);
          setFbModelMode("manual");
        }
      } finally {
        if (isPrimary) setModelsLoading(false);
        else setFbModelsLoading(false);
      }
    },
    [
      form.provider,
      form.base_url,
      form.api_key,
      form.fallback_provider,
      form.fallback_base_url,
      form.fallback_api_key,
      form.model,
    ]
  );

  useEffect(() => {
    fetch("/api/settings/llm")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings ?? d;
        if (Array.isArray(d.providers)) setProviders(d.providers);
        if (Array.isArray(d.image_model_presets)) {
          setImagePresets(d.image_model_presets);
        }
        if (!d.error && s) {
          setForm((prev) => ({
            ...prev,
            provider: s.provider ?? "xai",
            model: s.model ?? "grok-4.5",
            base_url: s.base_url ?? "",
            api_key: "",
            api_key_set: Boolean(s.api_key_set),
            clear_api_key: false,
            fallback_provider: s.fallback_provider ?? "",
            fallback_model: s.fallback_model ?? "",
            fallback_base_url: s.fallback_base_url ?? "",
            fallback_api_key: "",
            fallback_api_key_set: Boolean(s.fallback_api_key_set),
            clear_fallback_api_key: false,
            use_json_mode:
              s.use_json_mode === undefined ? true : Boolean(s.use_json_mode),
            temperature: Number(s.temperature ?? 0.2),
            max_tokens: Number(s.max_tokens ?? 8192),
            top_p: Number(s.top_p ?? 0.9),
            image_provider: s.image_provider ?? "pollinations",
            image_model: s.image_model ?? "pollinations/flux",
            image_base_url: s.image_base_url ?? "",
            image_api_key: "",
            image_api_key_set: Boolean(s.image_api_key_set),
            clear_image_api_key: false,
            image_size: s.image_size ?? "1024x1024",
            image_quality: s.image_quality ?? "standard",
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-fetch models when provider/base URL ready (after initial load)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      void fetchModels({ target: "primary", silent: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional debounce on provider/base
  }, [loading, form.provider, form.base_url]);

  function onProviderChange(providerId: string) {
    const def = providers.find((p) => p.id === providerId);
    setForm((prev) => ({
      ...prev,
      provider: providerId,
      model: def?.defaultModel || prev.model,
      base_url:
        providerId === "custom"
          ? prev.base_url
          : def?.defaultBaseUrl || prev.base_url || "",
      use_json_mode: def?.supportsJsonMode ?? prev.use_json_mode,
    }));
    setModels([]);
    setModelsError(null);
    setModelsMeta(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.provider,
        model: form.model,
        base_url: form.base_url || null,
        api_key: form.clear_api_key ? undefined : form.api_key || undefined,
        clear_api_key: form.clear_api_key,
        fallback_provider: form.fallback_provider || null,
        fallback_model: form.fallback_model || null,
        fallback_base_url: form.fallback_base_url || null,
        fallback_api_key: form.clear_fallback_api_key
          ? undefined
          : form.fallback_api_key || undefined,
        clear_fallback_api_key: form.clear_fallback_api_key,
        use_json_mode: form.use_json_mode,
        temperature: Math.min(form.temperature, 0.5),
        max_tokens: form.max_tokens,
        top_p: form.top_p,
        image_provider: form.image_provider || null,
        image_model: form.image_model || null,
        image_base_url: form.image_base_url || null,
        image_api_key: form.clear_image_api_key
          ? undefined
          : form.image_api_key || undefined,
        clear_image_api_key: form.clear_image_api_key,
        image_size: form.image_size || "1024x1024",
        image_quality: form.image_quality || "standard",
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    const s = data.settings ?? data;
    setForm((prev) => ({
      ...prev,
      api_key: "",
      api_key_set: Boolean(s.api_key_set),
      clear_api_key: false,
      fallback_api_key: "",
      fallback_api_key_set: Boolean(s.fallback_api_key_set),
      clear_fallback_api_key: false,
      image_api_key: "",
      image_api_key_set: Boolean(s.image_api_key_set),
      clear_image_api_key: false,
    }));
    setMessage(
      data.warning
        ? `Pengaturan LLM disimpan. ${data.warning}`
        : "Pengaturan LLM disimpan."
    );
  }

  async function fetchImageModels() {
    setImageModelsLoading(true);
    setImageModelsNote(null);
    try {
      const res = await fetch("/api/settings/llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: "image",
          provider: form.image_provider || form.provider,
          base_url: form.image_base_url || form.base_url || null,
          api_key: form.image_api_key || form.api_key || undefined,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.presets)) setImagePresets(data.presets);
      setImageModels(data.models ?? []);
      setImageModelsNote(
        data.note ||
          data.hint ||
          (data.ok
            ? `${data.count ?? 0} image model terdeteksi`
            : data.error || null)
      );
    } catch (e) {
      setImageModelsNote(
        e instanceof Error ? e.message : "Gagal load model image"
      );
    } finally {
      setImageModelsLoading(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/llm/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.provider,
        model: form.model,
        base_url: form.base_url || null,
        api_key: form.api_key || undefined,
      }),
    });
    const data = await res.json();
    setTesting(false);
    if (!data.ok) {
      setError(data.error || t("llm.testFail"));
      return;
    }
    setMessage(
      `Koneksi OK · ${data.provider}/${data.model} · ${data.latency_ms}ms${
        data.base_url ? ` · ${data.base_url}` : ""
      }`
    );
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </p>
    );
  }

  const grouped = ["first_party", "third_party", "local", "custom"]
    .map((g) => ({
      group: g,
      items: providers.filter((p) => p.group === g),
    }))
    .filter((g) => g.items.length > 0);

  const modelInList = models.some((m) => m.id === form.model);

  return (
    <div>
      <PageHeader
        title={t("llm.title")}
        description={t("llm.desc")}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="max-w-2xl space-y-4 p-4 sm:p-6">
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">{t("llm.primary")}</h3>

          <div>
            <Label>{t("llm.provider")}</Label>
            <Select
              value={form.provider}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {grouped.map((g) => (
                <optgroup
                  key={g.group}
                  label={
                    t(
                      `llm.group.${g.group}` as
                        | "llm.group.first_party"
                        | "llm.group.third_party"
                        | "llm.group.local"
                        | "llm.group.custom"
                    ) || g.group
                  }
                >
                  {g.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {selected?.help ? (
              <p className="mt-1.5 text-xs text-slate-500">{selected.help}</p>
            ) : null}
          </div>

          <div>
            <Label>
              {t("llm.baseUrl")}{" "}
              {form.provider === "custom" ? (
                <span className="text-rose-500">*</span>
              ) : (
                <span className="font-normal text-slate-400">
                  ({t("common.optional")})
                </span>
              )}
            </Label>
            <Input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder={
                selected?.defaultBaseUrl ||
                "https://your-gateway.example.com/v1"
              }
              required={form.provider === "custom"}
            />
            <p className="mt-1 text-xs text-slate-500">
              Endpoint OpenAI-compatible (harus ada{" "}
              <code className="text-[11px]">/models</code>
              ). Kosongkan = default provider
              {selected?.defaultBaseUrl ? ` (${selected.defaultBaseUrl})` : ""}.
            </p>
          </div>

          <div>
            <Label>
              {t("llm.apiKey")}{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </Label>
            <Input
              type="password"
              value={form.api_key}
              onChange={(e) =>
                setForm({
                  ...form,
                  api_key: e.target.value,
                  clear_api_key: false,
                })
              }
              placeholder={
                form.api_key_set
                  ? "Tersimpan — isi untuk ganti"
                  : selected?.envApiKey
                    ? `Kosong = pakai env ${selected.envApiKey}`
                    : "sk-..."
              }
              autoComplete="off"
            />
            {form.api_key_set ? (
              <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={form.clear_api_key}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      clear_api_key: e.target.checked,
                      api_key: e.target.checked ? "" : form.api_key,
                    })
                  }
                />
                {t("llm.apiKey.clear")}
              </label>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <Label className="mb-0">Model *</Label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:underline"
                  onClick={() =>
                    setModelMode((m) =>
                      m === "select" ? "manual" : "select"
                    )
                  }
                >
                  {modelMode === "select" ? t("llm.model.manual") : t("llm.model.fromList")}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={modelsLoading}
                  onClick={() => fetchModels({ target: "primary" })}
                >
                  {modelsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {t("llm.model.fetch")}
                </Button>
              </div>
            </div>

            {modelMode === "select" && models.length > 0 ? (
              <Select
                value={modelInList ? form.model : ""}
                onChange={(e) => {
                  if (e.target.value === "__manual__") {
                    setModelMode("manual");
                    return;
                  }
                  setForm({ ...form, model: e.target.value });
                }}
                required
              >
                {!modelInList && form.model ? (
                  <option value={form.model}>{form.model} (tersimpan)</option>
                ) : (
                  <option value="" disabled>
                    Pilih model…
                  </option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.owned_by ? ` · ${m.owned_by}` : ""}
                  </option>
                ))}
                <option value="__manual__">— ketik manual —</option>
              </Select>
            ) : (
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={selected?.defaultModel || "model-id"}
                required
                list="llm-model-suggestions"
              />
            )}

            {models.length > 0 ? (
              <datalist id="llm-model-suggestions">
                {models.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
            ) : null}

            <div className="mt-1.5 space-y-1 text-xs text-slate-500">
              {modelsLoading ? (
                <p className="flex items-center gap-1.5 text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Mengambil daftar model…
                </p>
              ) : null}
              {modelsMeta ? (
                <p className="text-emerald-700">{modelsMeta}</p>
              ) : null}
              {modelsError ? (
                <p className="text-amber-700">
                  Auto-get gagal: {modelsError}. Isi model manual atau cek Base
                  URL / API key.
                </p>
              ) : null}
              {!modelsLoading && !modelsError && models.length === 0 ? (
                <p>
                  Klik <strong>{t("llm.model.fetch")}</strong> untuk auto-get dari{" "}
                  <code className="text-[11px]">GET /v1/models</code>.
                </p>
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.use_json_mode}
              onChange={(e) =>
                setForm({ ...form, use_json_mode: e.target.checked })
              }
            />
            JSON mode (
            <code className="text-xs">response_format: json_object</code>)
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>{t("llm.temperature")}</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={0.5}
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>{t("llm.maxTokens")}</Label>
              <Input
                type="number"
                value={form.max_tokens}
                onChange={(e) =>
                  setForm({ ...form, max_tokens: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Top P</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={form.top_p}
                onChange={(e) =>
                  setForm({ ...form, top_p: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </Card>

        <Card className="max-w-2xl space-y-4 p-4 sm:p-6">
          <h3 className="font-semibold text-slate-900 dark:text-slate-50">
            {t("llm.fallback")}
          </h3>
          <p className="text-xs text-slate-500">
            Dipakai otomatis jika provider utama gagal/timeout.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("llm.fallbackProvider")}</Label>
              <Select
                value={form.fallback_provider}
                onChange={(e) =>
                  setForm({ ...form, fallback_provider: e.target.value })
                }
              >
                <option value="">— tidak ada —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label className="mb-0">{t("llm.fallbackModel")}</Label>
                {form.fallback_provider ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={fbModelsLoading}
                    onClick={() => fetchModels({ target: "fallback" })}
                  >
                    {fbModelsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Ambil
                  </Button>
                ) : null}
              </div>
              {fbModelMode === "select" && fbModels.length > 0 ? (
                <Select
                  value={form.fallback_model}
                  onChange={(e) =>
                    setForm({ ...form, fallback_model: e.target.value })
                  }
                >
                  <option value="">— pilih —</option>
                  {fbModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.fallback_model}
                  onChange={(e) =>
                    setForm({ ...form, fallback_model: e.target.value })
                  }
                  placeholder="model-id"
                />
              )}
              {fbModelsError ? (
                <p className="mt-1 text-xs text-amber-700">{fbModelsError}</p>
              ) : null}
            </div>
          </div>

          <div>
            <Label>
              {t("llm.fallbackBaseUrl")}{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </Label>
            <Input
              value={form.fallback_base_url}
              onChange={(e) =>
                setForm({ ...form, fallback_base_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>
              {t("llm.fallbackApiKey")}{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
            </Label>
            <Input
              type="password"
              value={form.fallback_api_key}
              onChange={(e) =>
                setForm({
                  ...form,
                  fallback_api_key: e.target.value,
                  clear_fallback_api_key: false,
                })
              }
              placeholder={
                form.fallback_api_key_set
                  ? "Tersimpan — isi untuk ganti"
                  : "opsional"
              }
              autoComplete="off"
            />
          </div>
        </Card>

        <Card className="max-w-2xl space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-50">
              Featured image (generate)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Model chat ≠ model gambar. Pilih model yang mendukung Images API
              (DALL·E, GPT Image, FLUX, dll). Pollinations gratis tanpa API key
              (tanpa edit). Edit/image-to-image butuh DALL·E 2 / GPT Image 1.
              Default ini dipakai saat Generate &amp; publish auto-image.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Image provider</Label>
              <Select
                value={form.image_provider}
                onChange={(e) =>
                  setForm({ ...form, image_provider: e.target.value })
                }
              >
                <option value="pollinations">pollinations (free)</option>
                <option value="openai">openai</option>
                <option value="together">together</option>
                <option value="openrouter">openrouter</option>
                <option value="custom">custom / same as chat</option>
                {providers.map((p) => (
                  <option key={`img-${p.id}`} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label className="mb-0">Image model</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={imageModelsLoading}
                  onClick={() => void fetchImageModels()}
                >
                  {imageModelsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  List image
                </Button>
              </div>
              <Select
                value={form.image_model}
                onChange={(e) => {
                  const id = e.target.value;
                  const preset = imagePresets.find((p) => p.id === id);
                  setForm({
                    ...form,
                    image_model: id,
                    image_provider: preset?.providerHint || form.image_provider,
                  });
                }}
              >
                {imagePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.free ? " · free" : ""}
                    {p.supportsEdit ? " · edit" : ""}
                  </option>
                ))}
                {imageModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </Select>
              <Input
                className="mt-2"
                value={form.image_model}
                onChange={(e) =>
                  setForm({ ...form, image_model: e.target.value })
                }
                placeholder="atau ketik model id manual"
              />
              {imageModelsNote ? (
                <p className="mt-1 text-xs text-slate-500">{imageModelsNote}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Image size default</Label>
              <Select
                value={form.image_size}
                onChange={(e) =>
                  setForm({ ...form, image_size: e.target.value })
                }
              >
                <option value="1024x1024">1024×1024</option>
                <option value="1280x720">1280×720</option>
                <option value="1792x1024">1792×1024</option>
                <option value="1024x1792">1024×1792</option>
                <option value="512x512">512×512</option>
              </Select>
            </div>
            <div>
              <Label>Quality</Label>
              <Select
                value={form.image_quality}
                onChange={(e) =>
                  setForm({ ...form, image_quality: e.target.value })
                }
              >
                <option value="standard">standard</option>
                <option value="hd">hd (DALL·E 3)</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>
              Image base URL{" "}
              <span className="font-normal text-slate-400">
                (opsional — default pakai Base URL chat)
              </span>
            </Label>
            <Input
              value={form.image_base_url}
              onChange={(e) =>
                setForm({ ...form, image_base_url: e.target.value })
              }
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div>
            <Label>
              Image API key{" "}
              <span className="font-normal text-slate-400">
                (opsional — default pakai API key chat / env)
              </span>
            </Label>
            <Input
              type="password"
              value={form.image_api_key}
              onChange={(e) =>
                setForm({
                  ...form,
                  image_api_key: e.target.value,
                  clear_image_api_key: false,
                })
              }
              placeholder={
                form.image_api_key_set
                  ? "Tersimpan — isi untuk ganti"
                  : "opsional"
              }
              autoComplete="off"
            />
            {form.image_api_key_set ? (
              <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={form.clear_image_api_key}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      clear_image_api_key: e.target.checked,
                    })
                  }
                />
                Hapus image API key tersimpan
              </label>
            ) : null}
          </div>
        </Card>

        {error ? (
          <div className="max-w-2xl rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="max-w-2xl rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="flex max-w-2xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? t("llm.saving") : t("llm.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={testing}
            className="w-full sm:w-auto"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            {t("llm.test")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchModels({ target: "primary" })}
            disabled={modelsLoading}
            className="w-full sm:w-auto"
          >
            {modelsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh model
          </Button>
        </div>

        <Card className="max-w-2xl space-y-2 p-4 text-xs text-slate-500 sm:p-5">
          <p className="font-medium text-slate-700">Auto-get model</p>
          <p>
            Memanggil <code className="text-[11px]">GET {"{base}"}/models</code>{" "}
            (OpenAI-compatible). Berhasil di OmniRoute, Ollama, OpenAI,
            OpenRouter, dll. Jika gagal, ketik model manual.
          </p>
        </Card>
      </form>
    </div>
  );
}
