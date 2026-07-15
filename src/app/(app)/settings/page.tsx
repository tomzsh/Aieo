"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Button, Badge } from "@/components/ui";
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Loader2,
  MessageSquareCode,
  PlugZap,
  XCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { LucideIcon } from "lucide-react";

const items: {
  href: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  icon: LucideIcon;
}[] = [
  {
    href: "/settings/llm",
    titleKey: "settings.llm",
    descKey: "settings.llm.desc",
    icon: Cpu,
  },
  {
    href: "/settings/prompts",
    titleKey: "settings.prompts",
    descKey: "settings.prompts.desc",
    icon: MessageSquareCode,
  },
  {
    href: "/settings/wordpress",
    titleKey: "settings.wordpress",
    descKey: "settings.wordpress.desc",
    icon: Globe,
  },
  {
    href: "/settings/data",
    titleKey: "settings.data",
    descKey: "settings.data.desc",
    icon: Database,
  },
  {
    href: "/docs",
    titleKey: "settings.docs",
    descKey: "settings.docs.desc",
    icon: BookOpen,
  },
];

type Check = {
  id: string;
  label: string;
  ok: boolean;
  latency_ms?: number;
  detail?: string;
  error?: string;
};

export default function SettingsPage() {
  const { t } = useLocale();
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [allOk, setAllOk] = useState<boolean | null>(null);

  async function runDiagnostics() {
    setRunning(true);
    setChecks(null);
    setAllOk(null);
    try {
      const res = await fetch("/api/settings/diagnostics");
      const data = await res.json();
      setChecks(data.checks ?? []);
      setTotalMs(data.total_ms ?? null);
      setAllOk(Boolean(data.ok));
    } catch (e) {
      setChecks([
        {
          id: "error",
          label: "Diagnostics",
          ok: false,
          error: e instanceof Error ? e.message : t("common.error"),
        },
      ]);
      setAllOk(false);
    }
    setRunning(false);
  }

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.desc")}
        actions={
          <div className="flex gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full p-5 transition hover:border-indigo-200 hover:shadow-md dark:hover:border-indigo-800">
              <item.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-50">
                {t(item.titleKey)}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(item.descKey)}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">
              {t("settings.diagnostics")}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("settings.diagnostics.desc")}
            </p>
          </div>
          <Button
            type="button"
            onClick={runDiagnostics}
            disabled={running}
            className="w-full sm:w-auto"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            {running
              ? t("settings.diagnostics.running")
              : t("settings.diagnostics.run")}
          </Button>
        </div>

        {allOk != null ? (
          <div className="mt-4">
            <Badge
              className={
                allOk
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
              }
            >
              {allOk
                ? t("settings.diagnostics.allOk")
                : t("settings.diagnostics.someFail")}
              {totalMs != null ? ` · ${totalMs}ms` : ""}
            </Badge>
          </div>
        ) : null}

        {checks && checks.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {checks.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-50">
                        {c.label}
                      </span>
                      {c.latency_ms != null ? (
                        <span className="text-xs text-slate-400">
                          {c.latency_ms}ms
                        </span>
                      ) : null}
                    </div>
                    {c.detail ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {c.detail}
                      </p>
                    ) : null}
                    {c.error ? (
                      <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                        {c.error}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
