"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { AppFooter } from "@/components/app-footer";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Newspaper } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(
      "Akun dibuat. Jika konfirmasi email aktif di Supabase, cek inbox Anda. Jika tidak, silakan login."
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <div className="relative flex flex-1 items-center justify-center px-3 py-8 sm:px-4">
      <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-6 sm:top-6">
        <LocaleToggle compact />
        <ThemeToggle compact />
      </div>
      <Card className="w-full max-w-md p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Newspaper className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-50">
              {t("signup.title")} — Aieo
            </div>
            <div className="text-xs text-slate-500">{t("signup.subtitle")}</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t("signup.name")}</Label>
            <Input
              id="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("signup.name")}
            />
          </div>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? `${t("signup.submit")}…` : t("signup.submit")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {t("signup.hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {t("signup.login")}
          </Link>
        </p>
      </Card>
      </div>
      <AppFooter variant="full" />
    </div>
  );
}
