import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate, statusBadge } from "@/lib/utils";
import { FileText, Flag, Send, Sparkles } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const ctx = await getAuthedContext();
  if (ctx.error || !ctx.user) redirect("/login");
  const { user, db } = ctx;
  const { t } = await getServerT();

  const ws = await getUserWorkspace(db, user.id);

  let all: Array<{
    id: string;
    title: string | null;
    status: string;
    flagged_for_review: boolean;
    created_at: string;
    published_at: string | null;
  }> = [];
  let counts = { total: 0, ready: 0, flagged: 0, published: 0 };

  if (ws) {
    const wid = ws.workspace_id;
    // Parallel: recent list + 4 head-counts (no sequential waterfall)
    const [recent, total, ready, flagged, published] = await Promise.all([
      db
        .from("articles")
        .select(
          "id, title, status, flagged_for_review, created_at, published_at"
        )
        .eq("workspace_id", wid)
        .order("created_at", { ascending: false })
        .limit(8),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .eq("status", "ready"),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .eq("flagged_for_review", true),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .eq("status", "published"),
    ]);

    all = recent.data ?? [];
    counts = {
      total: total.count ?? 0,
      ready: ready.count ?? 0,
      flagged: flagged.count ?? 0,
      published: published.count ?? 0,
    };
  }

  const name = user.user_metadata?.full_name
    ? `, ${user.user_metadata.full_name}`
    : "";

  return (
    <div>
      <PageHeader
        title={`${t("dashboard.hello")}${name}`}
        description={
          ws?.workspace
            ? `${t("dashboard.workspace")}: ${ws.workspace.name}`
            : t("dashboard.workspaceMissing")
        }
        actions={
          <>
            <Link
              href="/docs"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:h-10 sm:w-auto"
            >
              {t("dashboard.docs")}
            </Link>
            <Link
              href="/articles/new"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 sm:h-10 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" /> {t("dashboard.newArticle")}
            </Link>
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t("dashboard.total"),
            value: counts.total,
            icon: FileText,
            color: "text-slate-700 dark:text-slate-200",
          },
          {
            label: t("dashboard.ready"),
            value: counts.ready,
            icon: Sparkles,
            color: "text-emerald-600",
          },
          {
            label: t("dashboard.flagged"),
            value: counts.flagged,
            icon: Flag,
            color: "text-amber-600",
          },
          {
            label: t("dashboard.published"),
            value: counts.published,
            icon: Send,
            color: "text-violet-600",
          },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div
              className={`mt-2 text-3xl font-semibold tabular-nums ${s.color}`}
            >
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">
            {t("dashboard.recent")}
          </h2>
          <Link
            href="/articles"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {t("dashboard.viewAll")}
          </Link>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {all.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              {t("dashboard.empty")}{" "}
              <Link
                href="/articles/new"
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t("dashboard.newArticle")}
              </Link>
            </div>
          ) : (
            all.map((a) => (
              <Link
                key={a.id}
                href={`/articles/${a.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900 dark:text-slate-50">
                    {a.title || t("articles.untitled")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDate(a.created_at)}
                  </div>
                </div>
                <Badge className={statusBadge(a.status)}>{a.status}</Badge>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
