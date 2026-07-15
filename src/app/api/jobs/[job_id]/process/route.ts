import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { createServiceClient } from "@/lib/supabase/server";
import { processOptimizeJob } from "@/lib/jobs/optimize";

/**
 * POST /api/jobs/{job_id}/process
 * Kick / resume a queued (or stuck) optimize job.
 */
export async function POST(
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

    const { data: job } = await db
      .from("jobs")
      .select("id, status, workspace_id, request_meta")
      .eq("id", job_id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ error: "Job tidak ditemukan" }, { status: 404 });
    }

    if (job.status === "completed") {
      return NextResponse.json({ ok: true, status: "completed", skipped: true });
    }

    // Reset failed → queued so claim works
    if (job.status === "failed") {
      await db
        .from("jobs")
        .update({
          status: "queued",
          attempts: 0,
          error: null,
          completed_at: null,
        })
        .eq("id", job_id);
    }

    const meta = (job.request_meta ?? {}) as { prompt_template_id?: string };
    const sb = createServiceClient();

    // Process inline so client gets reliable kick (long request ok for dev)
    try {
      await processOptimizeJob(sb, job_id, {
        promptTemplateId: meta.prompt_template_id,
      });
    } catch (e) {
      // processOptimizeJob already marks failed; return status
      const { data: after } = await sb
        .from("jobs")
        .select("status, error, attempts")
        .eq("id", job_id)
        .single();
      return NextResponse.json({
        ok: after?.status === "completed",
        status: after?.status,
        error: after?.error || (e instanceof Error ? e.message : String(e)),
        attempts: after?.attempts,
      });
    }

    const { data: done } = await sb
      .from("jobs")
      .select("status, error, llm_model, completed_at")
      .eq("id", job_id)
      .single();

    return NextResponse.json({
      ok: true,
      status: done?.status,
      llm_model: done?.llm_model,
      completed_at: done?.completed_at,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
