import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { importFromUrl } from "@/lib/import/url";

/**
 * POST /api/articles/import/url
 * Body: { url: string }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const url = String(body.url ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "url wajib" }, { status: 400 });
    }

    const article = await importFromUrl(url);

    return NextResponse.json({
      ok: true,
      title: article.title,
      content: article.content,
      source_url: article.source_url,
      excerpt: article.excerpt ?? null,
      byline: article.byline ?? null,
      published: article.published ?? null,
      method: article.method,
      word_count: article.content.trim().split(/\s+/).filter(Boolean).length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Gagal mengimpor URL",
      },
      { status: 400 }
    );
  }
}
