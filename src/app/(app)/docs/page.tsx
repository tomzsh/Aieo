"use client";

import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/ui";
import {
  BookOpen,
  CalendarClock,
  ClipboardPaste,
  Globe,
  Link2,
  MessageSquareCode,
  Rss,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getDocsCopy, getDocsToc } from "@/lib/i18n/docs-content";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
        {n}
      </div>
      <div>
        <div className="font-medium text-slate-900 dark:text-slate-50">{title}</div>
        <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const { t, locale } = useLocale();
  const toc = getDocsToc(locale);
  const c = getDocsCopy(locale);
  const sourceIcons = [ClipboardPaste, Link2, Rss];

  return (
    <div>
      <PageHeader title={t("docs.title")} description={t("docs.desc")} />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card className="p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <BookOpen className="h-3.5 w-3.5" />
              {t("docs.toc")}
            </div>
            <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="shrink-0 rounded-full bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-900 dark:text-slate-300 lg:block lg:rounded-md lg:bg-transparent lg:px-2 lg:py-1.5 lg:text-sm"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 hidden border-t border-slate-100 pt-3 dark:border-slate-800 lg:block">
              <Link
                href="/articles/new"
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
              >
                {t("docs.startOpt")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </aside>

        <div className="space-y-10">
          <Section id="apa-itu" title={c.whatTitle}>
            <p>
              <strong className="text-slate-800 dark:text-slate-100">Aieo</strong>{" "}
              {c.whatBody}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {c.cards.map((card, i) => {
                const Icon = [Sparkles, MessageSquareCode, Globe][i] ?? Sparkles;
                return (
                  <div
                    key={card.t}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <Icon className="h-5 w-5 text-indigo-600" />
                    <div className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                      {card.t}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{card.d}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section id="mulai" title={c.startTitle}>
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              {c.steps.map((s, i) => (
                <Step key={s.title} n={i + 1} title={s.title}>
                  {s.body}
                </Step>
              ))}
            </div>
          </Section>

          <Section id="sumber-draf" title={c.sourcesTitle}>
            <p>{c.sourcesIntro}</p>
            <div className="table-scroll overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
                  <tr>
                    <th className="px-3 py-2.5 font-medium sm:px-4">Tab</th>
                    <th className="px-3 py-2.5 font-medium sm:px-4">
                      {locale === "en" ? "Use" : "Kegunaan"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {c.sourcesTable.map((row, i) => {
                    const Icon = sourceIcons[i] ?? ClipboardPaste;
                    return (
                      <tr key={row.tab}>
                        <td className="px-3 py-3 sm:px-4">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
                            <Icon className="h-4 w-4 shrink-0 text-indigo-600" />
                            {row.tab}
                          </span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">{row.use}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">{c.sourcesWarn}</p>
            </div>
          </Section>

          <Section id="template" title={c.templateTitle}>
            <p>{c.templateBody[0]}</p>
            <ul className="list-inside list-disc space-y-1">
              {c.templateBody.slice(1, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{c.templateBody[4]}</p>
          </Section>

          <Section id="optimasi" title={c.optimTitle}>
            <ol className="list-decimal space-y-2 pl-5">
              {c.optimSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p>{c.optimNote}</p>
          </Section>

          <Section id="review" title={c.reviewTitle}>
            <p>{c.reviewIntro}</p>
            <ul className="list-inside list-disc space-y-1">
              {c.reviewTabs.map((tab) => (
                <li key={tab}>{tab}</li>
              ))}
            </ul>
            <p>{c.reviewNote}</p>
          </Section>

          <Section id="wordpress" title={c.wpTitle}>
            <p>{c.wpIntro}</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {c.wpModesTitle}
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">
                      {locale === "en" ? "Mode" : "Mode"}
                    </th>
                    <th className="px-4 py-2.5 font-medium">
                      {locale === "en" ? "Result in WordPress" : "Hasil di WordPress"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {c.wpModes.map((m) => (
                    <tr key={m.mode}>
                      <td className="px-4 py-2.5 font-medium">
                        {m.mode.includes("Auto") || m.mode.includes("jadwal") ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5 text-sky-600" />
                            {m.mode}
                          </span>
                        ) : (
                          m.mode
                        )}
                      </td>
                      <td className="px-4 py-2.5">{m.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">{c.wpCron}</p>
            </div>
          </Section>

          <Section id="llm" title={c.llmTitle}>
            <p>{c.llmIntro}</p>
            <ul className="list-inside list-disc space-y-1">
              {c.llmBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p>{c.llmOmni}</p>
            <p>{c.llmTemp}</p>
          </Section>

          <Section id="status" title={c.statusTitle}>
            <div className="flex flex-wrap gap-2">
              {[
                ["draft", "bg-slate-100 text-slate-700"],
                ["processing", "bg-blue-100 text-blue-700"],
                ["ready", "bg-emerald-100 text-emerald-700"],
                ["flagged", "bg-amber-100 text-amber-800"],
                ["scheduled", "bg-sky-100 text-sky-800"],
                ["published", "bg-violet-100 text-violet-700"],
                ["failed", "bg-rose-100 text-rose-700"],
              ].map(([s, cls]) => (
                <Badge key={s} className={cls}>
                  {s}
                </Badge>
              ))}
            </div>
            <ul className="mt-3 list-inside list-disc space-y-1">
              {c.statusItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="tips" title={c.tipsTitle}>
            <div className="space-y-3">
              {c.tips.map((tip) => (
                <div
                  key={tip.t}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    {tip.t}
                  </div>
                  <p className="mt-1">{tip.d}</p>
                </div>
              ))}
            </div>
          </Section>

          <Card className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-50">
                {t("docs.ready")}
              </div>
              <p className="text-sm text-slate-500">{t("docs.ready.sub")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/articles/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <Sparkles className="h-4 w-4" />
                {t("nav.new")}
              </Link>
              <Link
                href="/settings"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {t("nav.settings")}
              </Link>
            </div>
          </Card>

          <p className="text-center text-xs text-slate-400">{t("docs.footer")}</p>
        </div>
      </div>
    </div>
  );
}
