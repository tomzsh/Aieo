"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppFooter } from "@/components/app-footer";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Newspaper } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-5 sm:p-8">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Newspaper className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-50">
            {t("login.title")} — Aieo
          </div>
          <div className="text-xs text-slate-500">{t("app.tagline")}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="editor@media.id"
          />
        </div>
        <div>
          <Label htmlFor="password">{t("login.password")}</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? `${t("login.submit")}…` : t("login.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t("login.noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {t("login.signup")}
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 items-center justify-center px-3 py-8 sm:px-4">
        <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-6 sm:top-6">
          <LocaleToggle compact />
          <ThemeToggle compact />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <AppFooter variant="full" />
    </div>
  );
}
