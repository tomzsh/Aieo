import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { scheduleJobProcessing } from "@/lib/jobs/enqueue";

/**
 * GET /api/jobs?status=&limit=&kick=
 * List recent jobs. Optionally auto-kick a few stale queued jobs (default: yes, max 2).
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);
    const allowKick = searchParams.get("kick") !== "0";

    const selectCols =
      "id, article_id, type, status, attempts, max_attempts, error, llm_provider, llm_model, prompt_version, started_at, completed_at, created_at, request_meta, articles(id, title, status)";

    let q = db
      .from("jobs")
      .select(selectCols)
      .eq("workspace_id", ws.workspace_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jobs = data ?? [];

    // Auto-pickup: only kick a few oldest stale queued jobs (avoid hammering on poll)
    if (allowKick) {
      const now = Date.now();
      let kicked = 0;
      const MAX_KICK = 2;
      const STALE_MS = 8000;
      for (const j of jobs) {
        if (kicked >= MAX_KICK) break;
        if (j.status !== "queued") continue;
        const age = now - new Date(j.created_at).getTime();
        if (age > STALE_MS) {
          const meta = (j.request_meta ?? {}) as { prompt_template_id?: string };
          scheduleJobProcessing(j.id, meta.prompt_template_id);
          kicked += 1;
        }
      }
    }

    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
