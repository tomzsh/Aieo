import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { scheduleJobProcessing } from "@/lib/jobs/enqueue";

/**
 * GET /api/jobs/{job_id}
 * Returns status; auto-kicks processing if still queued.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const { job_id } = await params;
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

    const { data: job, error } = await db
      .from("jobs")
      .select(
        "*, articles(id, title, status, flagged_for_review, flag_reasons, source_url)"
      )
      .eq("id", job_id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (error || !job) {
      // fallback without source_url
      const fb = await db
        .from("jobs")
        .select(
          "*, articles(id, title, status, flagged_for_review, flag_reasons)"
        )
        .eq("id", job_id)
        .eq("workspace_id", ws.workspace_id)
        .maybeSingle();
      if (fb.error || !fb.data) {
        return NextResponse.json(
          { error: "Job tidak ditemukan" },
          { status: 404 }
        );
      }
      return respondJob(fb.data);
    }

    // Kick worker if still queued
    if (job.status === "queued") {
      const meta = (job.request_meta ?? {}) as { prompt_template_id?: string };
      scheduleJobProcessing(job.id, meta.prompt_template_id);
    }

    return respondJob(job);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

function respondJob(job: Record<string, unknown>) {
  return NextResponse.json({
    id: job.id,
    article_id: job.article_id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    error: job.error,
    result: job.result,
    llm_provider: job.llm_provider,
    llm_model: job.llm_model,
    prompt_version: job.prompt_version,
    request_meta: job.request_meta ?? null,
    started_at: job.started_at,
    completed_at: job.completed_at,
    created_at: job.created_at,
    article: job.articles,
  });
}
