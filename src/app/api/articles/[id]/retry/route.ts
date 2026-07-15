import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { enqueueOptimize } from "@/lib/jobs/enqueue";

/**
 * POST /api/articles/{id}/retry
 * Body optional: { prompt_template_id?, model? }
 * Re-enqueues optimize using the same raw_draft.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json().catch(() => ({}));
    const promptTemplateId = body.prompt_template_id
      ? String(body.prompt_template_id)
      : null;
    const model = body.model ? String(body.model).trim() : null;

    const { data: article, error } = await db
      .from("articles")
      .select(
        "id, workspace_id, title, raw_draft, categories_input, source_url, source_type"
      )
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (error || !article) {
      return NextResponse.json(
        { error: "Artikel tidak ditemukan" },
        { status: 404 }
      );
    }

    // Prefer last job template if not specified
    let templateId = promptTemplateId;
    if (!templateId) {
      const { data: lastJob } = await db
        .from("jobs")
        .select("prompt_version, request_meta")
        .eq("article_id", article.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const meta = (lastJob?.request_meta ?? {}) as {
        prompt_template_id?: string;
      };
      if (meta.prompt_template_id) templateId = meta.prompt_template_id;
      else if (lastJob?.prompt_version != null) {
        const { data: tpl } = await db
          .from("prompt_templates")
          .select("id")
          .eq("workspace_id", ws.workspace_id)
          .eq("version", lastJob.prompt_version)
          .maybeSingle();
        templateId = tpl?.id ?? null;
      }
    }

    const enqueued = await enqueueOptimize(db, {
      workspaceId: ws.workspace_id,
      userId: user.id,
      rawDraft: article.raw_draft,
      title: article.title,
      categories: article.categories_input ?? [],
      promptTemplateId: templateId,
      model,
      sourceUrl: article.source_url ?? null,
      sourceType: (article.source_type as "paste" | "url" | "rss" | "batch") ?? "paste",
    });

    return NextResponse.json(enqueued);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
