import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

/**
 * GET /api/data/stats
 * Lightweight HEAD counts — no full table download.
 */
export async function GET() {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;

    const ws = await getUserWorkspace(db, user.id);
    if (!ws) {
      return NextResponse.json(
        { error: "Workspace tidak ditemukan" },
        { status: 400 }
      );
    }

    const wid = ws.workspace_id;
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const d30 = new Date(now - 30 * 86400000).toISOString();

    const articleStatuses = [
      "draft",
      "processing",
      "ready",
      "flagged",
      "published",
      "failed",
      "scheduled",
    ] as const;
    const jobStatuses = ["queued", "running", "completed", "failed"] as const;

    const [
      totalArticles,
      articleStatusRows,
      last7,
      d8to30,
      older30,
      totalJobs,
      jobStatusRows,
      oldestArticle,
      oldestJob,
    ] = await Promise.all([
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid),
      Promise.all(
        articleStatuses.map((s) =>
          db
            .from("articles")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", wid)
            .eq("status", s)
            .then((r) => ({ status: s, count: r.count ?? 0, error: r.error }))
        )
      ),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .gte("created_at", d7),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .gte("created_at", d30)
        .lt("created_at", d7),
      db
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid)
        .lt("created_at", d30),
      db
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wid),
      Promise.all(
        jobStatuses.map((s) =>
          db
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", wid)
            .eq("status", s)
            .then((r) => ({ status: s, count: r.count ?? 0, error: r.error }))
        )
      ),
      db
        .from("articles")
        .select("created_at")
        .eq("workspace_id", wid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from("jobs")
        .select("created_at")
        .eq("workspace_id", wid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (totalArticles.error) {
      return NextResponse.json(
        { error: totalArticles.error.message },
        { status: 500 }
      );
    }

    const byArticleStatus: Record<string, number> = {};
    for (const row of articleStatusRows) {
      if (!row.error) byArticleStatus[row.status] = row.count;
    }

    const byJobStatus: Record<string, number> = {};
    for (const row of jobStatusRows) {
      if (!row.error) byJobStatus[row.status] = row.count;
    }

    return NextResponse.json({
      articles: {
        total: totalArticles.count ?? 0,
        by_status: byArticleStatus,
        age: {
          last_7_days: last7.count ?? 0,
          days_8_to_30: d8to30.count ?? 0,
          older_than_30: older30.count ?? 0,
        },
        oldest_at: oldestArticle.data?.created_at ?? null,
      },
      jobs: {
        total: totalJobs.count ?? 0,
        by_status: byJobStatus,
        oldest_at: oldestJob.data?.created_at ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
