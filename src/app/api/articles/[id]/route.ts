import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import type { OptimizedArticle } from "@/lib/types";

async function getOwnedArticle(
  db: Awaited<ReturnType<typeof getAuthedContext>> extends { db: infer D }
    ? NonNullable<D>
    : never,
  userId: string,
  id: string
) {
  const ws = await getUserWorkspace(db, userId);
  if (!ws) return { article: null, ws: null, error: "Workspace tidak ditemukan" };

  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.workspace_id)
    .maybeSingle();

  if (error) return { article: null, ws, error: error.message };
  if (!data) return { article: null, ws, error: "Artikel tidak ditemukan" };
  return { article: data, ws, error: null };
}

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

    const { article, error } = await getOwnedArticle(ctx.db, ctx.user.id, id);
    if (error || !article) {
      return NextResponse.json(
        { error: error ?? "Artikel tidak ditemukan" },
        { status: error === "Artikel tidak ditemukan" ? 404 : 400 }
      );
    }

    return NextResponse.json(article);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();
    const optimized = body.optimized as OptimizedArticle | undefined;

    const { article: existing, error: fetchError } = await getOwnedArticle(
      db,
      user.id,
      id
    );
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: fetchError ?? "Artikel tidak ditemukan" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (optimized) {
      updates.optimized = optimized;
      updates.title = optimized.title ?? existing.title;
      if (body.clear_flags) {
        updates.flagged_for_review = false;
        updates.flag_reasons = [];
        updates.status = "ready";
      } else if (
        existing.status === "flagged" ||
        existing.status === "ready"
      ) {
        updates.status = existing.flagged_for_review ? "flagged" : "ready";
      }
    }
    if (body.status) updates.status = body.status;

    const { data, error } = await db
      .from("articles")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", existing.workspace_id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (optimized) {
      const { count } = await db
        .from("article_versions")
        .select("*", { count: "exact", head: true })
        .eq("article_id", id);

      await db.from("article_versions").insert({
        article_id: id,
        version: (count ?? 0) + 1,
        optimized,
        changed_by: user.id,
        change_note: body.change_note ?? "Manual edit",
      });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/articles/:id — hapus artikel (+ jobs/versions/logs cascade) */
export async function DELETE(
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

    const { article, error: fetchError } = await getOwnedArticle(
      db,
      user.id,
      id
    );
    if (fetchError || !article) {
      return NextResponse.json(
        { error: fetchError ?? "Artikel tidak ditemukan" },
        { status: fetchError === "Artikel tidak ditemukan" ? 404 : 400 }
      );
    }

    const { error } = await db
      .from("articles")
      .delete()
      .eq("id", id)
      .eq("workspace_id", article.workspace_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted_id: id,
      title: article.title,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

