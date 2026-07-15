"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

import { FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Textarea,
  Badge,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Check, Download, Loader2 } from "lucide-react";

type TemplateRow = {
  id: string;
  version: number;
  name: string;
  is_active: boolean;
  created_at: string;
  system_prompt?: string;
  preview?: string;
};

type Builtin = {
  id: string;
  name: string;
  label: string;
  description: string;
};

export default function PromptsPage() {
  const { t } = useLocale();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [name, setName] = useState("default");
  const [version, setVersion] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [builtins, setBuiltins] = useState<Builtin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const d = await fetch("/api/settings/prompt-template").then((r) =>
      r.json()
    );
    if (d.active) {
      setSystemPrompt(d.active.system_prompt);
      setName(d.active.name);
      setVersion(d.active.version);
      setActiveId(d.active.id);
    }
    setTemplates(d.options ?? d.history ?? []);
    setBuiltins(d.builtins ?? []);
    return d;
  }

  useEffect(() => {
    reload()
      .catch(() => setError("Gagal memuat template"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/prompt-template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        name,
        activate: true,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setVersion(data.version);
    setActiveId(data.id);
    setMessage(`Template v${data.version} disimpan & diaktifkan sebagai default.`);
    await reload();
  }

  async function activate(id: string) {
    setActingId(id);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/prompt-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", id }),
    });
    const data = await res.json();
    setActingId(null);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    if (data.active) {
      setSystemPrompt(data.active.system_prompt);
      setName(data.active.name);
      setVersion(data.active.version);
      setActiveId(data.active.id);
    }
    setMessage("Default workspace diganti ke template ini.");
    await reload();
  }

  async function loadIntoEditor(id: string) {
    // Full body may only be on templates array from GET
    const d = await fetch("/api/settings/prompt-template").then((r) =>
      r.json()
    );
    const full = (d.templates as TemplateRow[] | undefined)?.find(
      (t) => t.id === id
    );
    if (full?.system_prompt) {
      setSystemPrompt(full.system_prompt);
      setName(full.name);
      setVersion(full.version);
      setMessage(`Template v${full.version} dimuat ke editor (belum disimpan).`);
    }
  }

  async function importBuiltin(builtinId: string) {
    setActingId(builtinId);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/settings/prompt-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_builtin",
        builtin_id: builtinId,
      }),
    });
    const data = await res.json();
    setActingId(null);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    if (data.active) {
      setSystemPrompt(data.active.system_prompt);
      setName(data.active.name);
      setVersion(data.active.version);
      setActiveId(data.active.id);
    }
    setMessage("Preset diimpor & diaktifkan.");
    await reload();
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("prompts.loading")}
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("prompts.title")}
        description={t("prompts.desc")}
      />

      {error ? (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={onSubmit} className="lg:col-span-2">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[200px] flex-1">
                <Label>{t("prompts.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="text-right text-sm text-slate-500">
                {version != null ? (
                  <>
                    Editor:{" "}
                    <span className="font-semibold text-slate-800">
                      v{version}
                    </span>
                    {activeId ? (
                      <span className="ml-2 text-xs text-emerald-600">
                        · default aktif di workspace
                      </span>
                    ) : null}
                  </>
                ) : (
                  t("prompts.newTpl")
                )}
              </div>
            </div>
            <div>
              <Label>{t("prompts.system")}</Label>
              <Textarea
                rows={18}
                className="font-mono text-[13px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("prompts.saving") : t("prompts.save")}
            </Button>
          </Card>
        </form>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">{t("prompts.list")}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("prompts.list.hint")}
            </p>
            <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
              {templates.length === 0 ? (
                <li className="text-sm text-slate-500">{t("prompts.empty")}</li>
              ) : (
                templates.map((h) => (
                  <li
                    key={h.id}
                    className={`rounded-lg border px-3 py-2.5 text-sm ${
                      h.is_active
                        ? "border-indigo-200 bg-indigo-50/50"
                        : "border-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">
                          v{h.version} · {h.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatDate(h.created_at)}
                        </div>
                      </div>
                      {h.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          default
                        </Badge>
                      ) : null}
                    </div>
                    {h.preview ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                        {h.preview}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingId === h.id || h.is_active}
                        onClick={() => activate(h.id)}
                      >
                        {actingId === h.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {h.is_active ? t("prompts.active") : t("prompts.useDefault")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => loadIntoEditor(h.id)}
                      >
                        {t("prompts.load")}
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">{t("prompts.presets")}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("prompts.presets.hint")}
            </p>
            <ul className="mt-3 space-y-2">
              {builtins.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-slate-100 px-3 py-2.5 text-sm"
                >
                  <div className="font-medium text-slate-900">{b.label}</div>
                  <p className="mt-0.5 text-xs text-slate-500">{b.description}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={actingId === b.id}
                    onClick={() => importBuiltin(b.id)}
                  >
                    {actingId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Impor
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
