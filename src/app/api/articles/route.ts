import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

/** GET /api/articles — list workspace articles (search + pagination) */
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
    const q = (searchParams.get("q") || searchParams.get("search") || "")
      .trim()
      .slice(0, 120);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);
    const offset = (page - 1) * limit;

    // Total count (for pagination)
    let countQ = db
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.workspace_id);
    if (status) countQ = countQ.eq("status", status);
    if (q) countQ = countQ.ilike("title", `%${q}%`);

    let query = db
      .from("articles")
      .select(
        "id, title, status, flagged_for_review, wordpress_url, created_at, updated_at, published_at, optimized, featured_image_url"
      )
      .eq("workspace_id", ws.workspace_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (q) query = query.ilike("title", `%${q}%`);

    const [countRes, listRes] = await Promise.all([countQ, query]);

    // Fallback if featured_image_url column missing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] | null = listRes.data;
    let listError = listRes.error;
    if (listError && /featured_image/i.test(listError.message)) {
      let q2 = db
        .from("articles")
        .select(
          "id, title, status, flagged_for_review, wordpress_url, created_at, updated_at, published_at, optimized"
        )
        .eq("workspace_id", ws.workspace_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q2 = q2.eq("status", status);
      if (q) q2 = q2.ilike("title", `%${q}%`);
      const retry = await q2;
      rows = retry.data;
      listError = retry.error;
    }

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const total = countRes.count ?? rows?.length ?? 0;
    const articles = (rows ?? []).map((a) => {
      const optimized = a.optimized as {
        seo_score?: unknown;
        featured_image_url?: string;
      } | null;
      return {
        id: a.id as string,
        title: a.title as string | null,
        status: a.status as string,
        flagged_for_review: a.flagged_for_review as boolean,
        wordpress_url: a.wordpress_url as string | null,
        created_at: a.created_at as string,
        updated_at: a.updated_at as string,
        published_at: a.published_at as string | null,
        seo_score: optimized?.seo_score ?? null,
        featured_image_url:
          (a.featured_image_url as string | null | undefined) ||
          optimized?.featured_image_url ||
          null,
      };
    });

    return NextResponse.json({
      articles,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      q: q || null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
