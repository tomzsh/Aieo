import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { enqueueOptimize } from "@/lib/jobs/enqueue";

/**
 * POST /api/articles/optimize
 * Body: {
 *   raw_draft, title?, categories?, prompt_template_id?, model?,
 *   source_url?, source_type?, mode?: "optimize" | "paraphrase"
 * }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;

    const body = await request.json();
    const rawDraft = String(body.raw_draft ?? body.rawDraft ?? "").trim();
    const categories: string[] = Array.isArray(body.categories)
      ? body.categories.map(String)
      : [];
    const title = body.title ? String(body.title) : null;
    const promptTemplateId = body.prompt_template_id
      ? String(body.prompt_template_id)
      : body.promptTemplateId
        ? String(body.promptTemplateId)
        : null;
    const model = body.model ? String(body.model).trim() : null;
    const sourceUrl = body.source_url ? String(body.source_url).trim() : null;
    const sourceType = body.source_type
      ? (String(body.source_type) as "paste" | "url" | "rss" | "batch")
      : sourceUrl
        ? "url"
        : "paste";
    const mode =
      body.mode === "paraphrase" || body.mode === "parafrase"
        ? "paraphrase"
        : "optimize";

    const ws = await getUserWorkspace(db, user.id);
    if (!ws) {
      return NextResponse.json(
        { error: "Workspace tidak ditemukan. Coba logout/login ulang." },
        { status: 400 }
      );
    }

    const enqueued = await enqueueOptimize(db, {
      workspaceId: ws.workspace_id,
      userId: user.id,
      rawDraft,
      title,
      categories,
      promptTemplateId: mode === "paraphrase" ? null : promptTemplateId,
      model,
      sourceUrl,
      sourceType,
      mode,
    });

    return NextResponse.json({
      ...enqueued,
      model: model || null,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = /wajib|tidak ditemukan|Belum ada|template/i.test(msg)
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
