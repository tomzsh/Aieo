import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

const ARTICLE_STATUSES = new Set([
  "draft",
  "processing",
  "ready",
  "flagged",
  "published",
  "failed",
]);

const JOB_STATUSES = new Set(["queued", "running", "completed", "failed"]);

type CleanupBody = {
  /** What to clean */
  target: "articles" | "jobs" | "both";
  /** Filter by status (required for safety unless older_than_days set with jobs completed/failed) */
  statuses?: string[];
  /** Only rows created before now - N days */
  older_than_days?: number;
  /** Allow deleting published articles (default false) */
  include_published?: boolean;
  /** Preview only — no delete */
  dry_run?: boolean;
  /** Hard cap per request */
  limit?: number;
};

/**
 * POST /api/data/cleanup
 * Bersihkan artikel dan/atau job yang menumpuk.
 *
 * Examples:
 * - Hapus job completed/failed > 7 hari
 * - Hapus artikel failed/draft > 30 hari
 * - Hapus semua job selesai (tanpa sentuh artikel)
 */
export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as CleanupBody;
    const target = body.target;
    if (target !== "articles" && target !== "jobs" && target !== "both") {
      return NextResponse.json(
        { error: "target harus: articles | jobs | both" },
        { status: 400 }
      );
    }

    const dryRun = Boolean(body.dry_run);
    const includePublished = Boolean(body.include_published);
    const olderDays =
      body.older_than_days != null && Number.isFinite(Number(body.older_than_days))
        ? Math.max(0, Math.floor(Number(body.older_than_days)))
        : null;
    const limit = Math.min(
      Math.max(1, Number(body.limit) || 200),
      500
    );

    const statuses = Array.isArray(body.statuses)
      ? body.statuses.filter((s) => typeof s === "string")
      : [];

    const cutoffIso =
      olderDays != null
        ? new Date(Date.now() - olderDays * 86400000).toISOString()
        : null;

    const result: {
      dry_run: boolean;
      articles_matched: number;
      articles_deleted: number;
      jobs_matched: number;
      jobs_deleted: number;
      cutoff: string | null;
    } = {
      dry_run: dryRun,
      articles_matched: 0,
      articles_deleted: 0,
      jobs_matched: 0,
      jobs_deleted: 0,
      cutoff: cutoffIso,
    };

    // ---- ARTICLES ----
    if (target === "articles" || target === "both") {
      let articleStatuses = statuses.filter((s) => ARTICLE_STATUSES.has(s));

      // Default safe set if none provided
      if (articleStatuses.length === 0) {
        articleStatuses = ["draft", "failed", "ready", "flagged"];
      }

      if (!includePublished) {
        articleStatuses = articleStatuses.filter((s) => s !== "published");
      }

      // Never bulk-delete processing by default unless explicitly listed
      // (already handled if user passed statuses)

      if (articleStatuses.length === 0) {
        return NextResponse.json(
          {
            error:
              "Tidak ada status artikel yang diizinkan. Aktifkan include_published jika ingin hapus published.",
          },
          { status: 400 }
        );
      }

      let q = db
        .from("articles")
        .select("id")
        .eq("workspace_id", ws.workspace_id)
        .in("status", articleStatuses)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (cutoffIso) {
        q = q.lt("created_at", cutoffIso);
      }

      const { data: matched, error: matchErr } = await q;
      if (matchErr) {
        return NextResponse.json({ error: matchErr.message }, { status: 500 });
      }

      const ids = (matched ?? []).map((r) => r.id);
      result.articles_matched = ids.length;

      if (!dryRun && ids.length > 0) {
        const { data: deleted, error: delErr } = await db
          .from("articles")
          .delete()
          .eq("workspace_id", ws.workspace_id)
          .in("id", ids)
          .select("id");

        if (delErr) {
          return NextResponse.json({ error: delErr.message }, { status: 500 });
        }
        result.articles_deleted = deleted?.length ?? 0;
      }
    }

    // ---- JOBS ----
    if (target === "jobs" || target === "both") {
      // Prefer explicit job statuses; default to terminal only (safe)
      let jobStatuses = statuses.filter((s) => JOB_STATUSES.has(s));
      if (jobStatuses.length === 0) {
        jobStatuses = ["completed", "failed"];
      }
      // Never bulk-delete running unless explicitly requested
      if (!statuses.includes("running")) {
        jobStatuses = jobStatuses.filter((s) => s !== "running");
      }

      let q = db
        .from("jobs")
        .select("id")
        .eq("workspace_id", ws.workspace_id)
        .in("status", jobStatuses)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (cutoffIso) {
        q = q.lt("created_at", cutoffIso);
      }

      const { data: matched, error: matchErr } = await q;
      if (matchErr) {
        return NextResponse.json({ error: matchErr.message }, { status: 500 });
      }

      const ids = (matched ?? []).map((r) => r.id);
      result.jobs_matched = ids.length;

      if (!dryRun && ids.length > 0) {
        const { data: deleted, error: delErr } = await db
          .from("jobs")
          .delete()
          .eq("workspace_id", ws.workspace_id)
          .in("id", ids)
          .select("id");

        if (delErr) {
          return NextResponse.json({ error: delErr.message }, { status: 500 });
        }
        result.jobs_deleted = deleted?.length ?? 0;
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      message: dryRun
        ? `Preview: ${result.articles_matched} artikel, ${result.jobs_matched} job cocok`
        : `Dihapus: ${result.articles_deleted} artikel, ${result.jobs_deleted} job`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
