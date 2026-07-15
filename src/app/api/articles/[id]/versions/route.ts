import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

/**
 * GET /api/articles/:id/versions
 * List version history for an article.
 */
export async function GET(
  _request: Request,
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

    const { data: article } = await db
      .from("articles")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (!article) {
      return NextResponse.json(
        { error: "Artikel tidak ditemukan" },
        { status: 404 }
      );
    }

    // Avoid shipping full optimized JSON on list — title only via JSON path
    const { data, error } = await db
      .from("article_versions")
      .select(
        "id, version, change_note, changed_by, created_at, optimized->title, optimized->meta_processing"
      )
      .eq("article_id", id)
      .order("version", { ascending: false })
      .limit(30);

    if (error) {
      // Fallback if JSON path select unsupported
      const fallback = await db
        .from("article_versions")
        .select("id, version, change_note, changed_by, created_at")
        .eq("article_id", id)
        .order("version", { ascending: false })
        .limit(30);
      if (fallback.error) {
        return NextResponse.json(
          { error: fallback.error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        versions: (fallback.data ?? []).map((v) => ({
          id: v.id,
          version: v.version,
          change_note: v.change_note,
          changed_by: v.changed_by,
          created_at: v.created_at,
          title: null,
          llm_model: null,
          mode: null,
        })),
      });
    }

    const versions = (data ?? []).map((v) => {
      const row = v as Record<string, unknown>;
      const title =
        (typeof row.title === "string" && row.title) ||
        (typeof row.optimized === "object" &&
        row.optimized &&
        "title" in (row.optimized as object)
          ? String((row.optimized as { title?: string }).title ?? "")
          : null);
      const meta = row.meta_processing as
        | { llm_model?: string; mode?: string }
        | null
        | undefined;
      return {
        id: v.id,
        version: v.version,
        change_note: v.change_note,
        changed_by: v.changed_by,
        created_at: v.created_at,
        title: title || null,
        llm_model: meta?.llm_model ?? null,
        mode: meta?.mode ?? null,
      };
    });

    return NextResponse.json({ versions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles/:id/versions
 * Restore a version: { version: number }
 * Creates a new version snapshot of current state first, then applies restore.
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
    const versionNum = Number(body.version);
    if (!Number.isFinite(versionNum) || versionNum < 1) {
      return NextResponse.json(
        { error: "version (number) wajib" },
        { status: 400 }
      );
    }

    const { data: article } = await db
      .from("articles")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (!article) {
      return NextResponse.json(
        { error: "Artikel tidak ditemukan" },
        { status: 404 }
      );
    }

    const { data: target, error: verErr } = await db
      .from("article_versions")
      .select("*")
      .eq("article_id", id)
      .eq("version", versionNum)
      .maybeSingle();

    if (verErr || !target?.optimized) {
      return NextResponse.json(
        { error: "Versi tidak ditemukan" },
        { status: 404 }
      );
    }

    // Snapshot current before restore
    if (article.optimized) {
      const { count } = await db
        .from("article_versions")
        .select("*", { count: "exact", head: true })
        .eq("article_id", id);

      await db.from("article_versions").insert({
        article_id: id,
        version: (count ?? 0) + 1,
        optimized: article.optimized,
        changed_by: user.id,
        change_note: `Snapshot sebelum restore ke v${versionNum}`,
      });
    }

    const restored = target.optimized as {
      title?: string;
      [k: string]: unknown;
    };

    const { data: updated, error: updErr } = await db
      .from("articles")
      .update({
        title: restored.title ?? article.title,
        optimized: target.optimized,
        status:
          article.status === "published" || article.status === "scheduled"
            ? article.status
            : "ready",
        flagged_for_review: false,
        flag_reasons: [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Record restore as new version
    const { count: afterCount } = await db
      .from("article_versions")
      .select("*", { count: "exact", head: true })
      .eq("article_id", id);

    await db.from("article_versions").insert({
      article_id: id,
      version: (afterCount ?? 0) + 1,
      optimized: target.optimized,
      changed_by: user.id,
      change_note: `Restore dari v${versionNum}`,
    });

    return NextResponse.json({
      ok: true,
      restored_from: versionNum,
      article: updated,
      message: `Dikembalikan ke versi ${versionNum}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
