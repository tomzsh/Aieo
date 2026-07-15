"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Newspaper,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppFooter } from "@/components/app-footer";
import { GithubIcon } from "@/components/github-icon";
import { useLocale } from "@/lib/i18n/locale-provider";
import { SITE } from "@/lib/site";

export default function HomePage() {
  const { t, locale } = useLocale();

  const features =
    locale === "en"
      ? [
          {
            icon: Shield,
            title: "No fact hallucination",
            desc: "Prompt guardrails + post-processing validator cross-check entities against the original draft.",
          },
          {
            icon: Zap,
            title: "Model-agnostic",
            desc: "Switch LLM providers, third-party gateways, or custom OpenAI-compatible endpoints per workspace.",
          },
          {
            icon: CheckCircle2,
            title: "WordPress-ready",
            desc: "Draft, publish, or schedule — with SEO meta for Yoast / Rank Math.",
          },
        ]
      : [
          {
            icon: Shield,
            title: "Nol halusinasi fakta",
            desc: "Guardrail prompt + post-processing validator membandingkan entitas dengan draf asli.",
          },
          {
            icon: Zap,
            title: "Model-agnostic",
            desc: "Ganti provider LLM, third-party gateway, atau custom endpoint OpenAI-compatible per workspace.",
          },
          {
            icon: CheckCircle2,
            title: "Siap WordPress",
            desc: "Draft, publish, atau jadwalkan — plus meta SEO Yoast / Rank Math.",
          },
        ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Newspaper className="h-5 w-5" />
          </div>
          <span className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">
            Aieo
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LocaleToggle compact />
          <ThemeToggle compact className="hidden sm:inline-flex" />
          <Link
            href="/login"
            className="px-2 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:px-0"
          >
            {t("landing.login")}
          </Link>
          <a
            href={SITE.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 sm:inline-flex"
            aria-label="GitHub"
          >
            <GithubIcon className="h-4 w-4" />
            <span className="hidden md:inline">GitHub</span>
          </a>
          <Link
            href="/signup"
            className="inline-flex h-10 min-h-10 items-center rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-500 sm:px-4"
          >
            {t("landing.signup")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t("app.tagline")} & WordPress</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl lg:text-5xl">
            {t("landing.hero")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:mt-5 sm:text-lg">
            {t("landing.hero.sub")}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href="/signup"
              className="inline-flex h-12 min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-500 sm:h-11"
            >
              {t("landing.getStarted")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:h-11"
            >
              {t("landing.login")}
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-12 min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:h-11"
            >
              {t("nav.docs")}
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:mt-16 sm:grid-cols-3 sm:gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <f.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-50">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 sm:mt-12">
          <strong className="font-semibold">
            {locale === "en" ? "Disclaimer" : "Disclaimer"}
          </strong>
          <span className="mt-1 block text-xs leading-relaxed opacity-90 sm:mt-0 sm:ml-1 sm:inline">
            {t("footer.disclaimer")}
          </span>
        </div>
      </main>

      <AppFooter variant="full" />
    </div>
  );
}
