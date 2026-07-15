import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { enqueueOptimize } from "@/lib/jobs/enqueue";
import { randomUUID } from "crypto";

type BatchItem = {
  raw_draft?: string;
  title?: string;
  source_url?: string;
  summary?: string;
  link?: string;
};

/**
 * POST /api/articles/optimize/batch
 * Body: {
 *   items: [{ title, raw_draft? | summary?, source_url? | link? }],
 *   prompt_template_id?, categories?, model?, fetch_full?: boolean
 * }
 *
 * For RSS bulk: pass title + link (+ summary). Worker uses raw_draft if present,
 * else builds from summary (full URL fetch should be done client-side first ideally).
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;

    const body = await request.json();
    const items: BatchItem[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "items wajib (array tidak kosong)" },
        { status: 400 }
      );
    }
    if (items.length > 20) {
      return NextResponse.json(
        { error: "Maksimal 20 item per batch" },
        { status: 400 }
      );
    }

    const ws = await getUserWorkspace(db, user.id);
    if (!ws) {
      return NextResponse.json(
        { error: "Workspace tidak ditemukan" },
        { status: 400 }
      );
    }

    const promptTemplateId = body.prompt_template_id
      ? String(body.prompt_template_id)
      : null;
    const categories: string[] = Array.isArray(body.categories)
      ? body.categories.map(String)
      : [];
    const model = body.model ? String(body.model).trim() : null;
    const batchId = randomUUID();

    const results: Array<{
      ok: boolean;
      job_id?: string;
      article_id?: string;
      title?: string;
      error?: string;
    }> = [];

    for (const item of items) {
      const title = (item.title || "").trim();
      const sourceUrl = (item.source_url || item.link || "").trim() || null;
      let raw =
        (item.raw_draft || item.summary || "").trim() ||
        (title ? `${title}\n\n${item.summary || ""}`.trim() : "");

      if (sourceUrl && !raw.includes(sourceUrl)) {
        raw = `${raw}\n\n[Sumber: ${sourceUrl}]`.trim();
      }

      try {
        if (raw.length < 50) {
          throw new Error("Konten terlalu pendek untuk dioptimasi");
        }
        const enqueued = await enqueueOptimize(db, {
          workspaceId: ws.workspace_id,
          userId: user.id,
          rawDraft: raw,
          title: title || null,
          categories,
          promptTemplateId,
          model,
          sourceUrl,
          sourceType: "batch",
          batchId,
        });
        results.push({
          ok: true,
          job_id: enqueued.job_id,
          article_id: enqueued.article_id,
          title: title || undefined,
        });
      } catch (e) {
        results.push({
          ok: false,
          title: title || undefined,
          error: e instanceof Error ? e.message : "Gagal enqueue",
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      ok: okCount > 0,
      batch_id: batchId,
      total: items.length,
      enqueued: okCount,
      failed: items.length - okCount,
      results,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
