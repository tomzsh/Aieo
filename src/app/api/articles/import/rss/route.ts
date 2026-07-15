import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { importRssItem, parseRssFeed } from "@/lib/import/rss";

/**
 * POST /api/articles/import/rss
 * Actions:
 *  - { action: "parse", feed_url } → list items
 *  - { action: "import", link, title?, summary? } → full draft text
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "parse");

    if (action === "parse") {
      const feedUrl = String(body.feed_url ?? body.url ?? "").trim();
      if (!feedUrl) {
        return NextResponse.json({ error: "feed_url wajib" }, { status: 400 });
      }
      const limit = Math.min(Number(body.limit ?? 25), 50);
      const feed = await parseRssFeed(feedUrl, limit);
      return NextResponse.json({ ok: true, ...feed });
    }

    if (action === "import") {
      const article = await importRssItem({
        title: body.title,
        link: body.link,
        summary: body.summary,
      });
      return NextResponse.json({
        ok: true,
        title: article.title,
        content: article.content,
        source_url: article.source_url,
        excerpt: article.excerpt ?? null,
        method: article.method,
        from: article.from,
        word_count: article.content.trim().split(/\s+/).filter(Boolean).length,
      });
    }

    return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Gagal memproses RSS",
      },
      { status: 400 }
    );
  }
}
