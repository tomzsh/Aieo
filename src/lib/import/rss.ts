import Parser from "rss-parser";
import { assertSafePublicUrl, fetchText } from "./ssrf";
import { importFromUrl, type ImportedArticle } from "./url";

export interface RssFeedItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  published: string | null;
  author: string | null;
}

export interface RssFeedResult {
  feed_url: string;
  title: string;
  description: string;
  items: RssFeedItem[];
}

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "AieoBot/1.0 (+https://localhost; RSS importer for editorial tool)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse an RSS/Atom feed URL and return recent items (no full article body yet).
 */
export async function parseRssFeed(
  feedUrl: string,
  limit = 30
): Promise<RssFeedResult> {
  const safe = assertSafePublicUrl(feedUrl);
  const { body, finalUrl } = await fetchText(safe.toString(), {
    accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    timeoutMs: 20_000,
  });

  const feed = await parser.parseString(body);
  const items: RssFeedItem[] = (feed.items ?? [])
    .slice(0, Math.min(limit, 50))
    .map((item, idx) => {
      const link = (item.link || item.guid || "").toString().trim();
      const title = (item.title || "Tanpa judul").toString().trim();
      const summary = stripHtml(
        (item.contentSnippet ||
          item.summary ||
          item.content ||
          item.description ||
          "") as string
      ).slice(0, 400);

      return {
        id: `${idx}-${link || title}`.slice(0, 200),
        title,
        link,
        summary,
        published: item.isoDate || item.pubDate || null,
        author: (item.creator || item.author || null) as string | null,
      };
    })
    .filter((i) => i.link || i.summary.length > 40);

  return {
    feed_url: finalUrl,
    title: feed.title || "RSS Feed",
    description: feed.description || "",
    items,
  };
}

/**
 * Load full article text for one RSS item (prefer full page extract; fall back to summary).
 */
export async function importRssItem(item: {
  title?: string;
  link?: string;
  summary?: string;
}): Promise<ImportedArticle & { from: "url" | "summary" }> {
  const link = (item.link || "").trim();
  const title = (item.title || "").trim();
  const summary = (item.summary || "").trim();

  if (link) {
    try {
      assertSafePublicUrl(link);
      const article = await importFromUrl(link);
      return {
        ...article,
        title: article.title || title || article.source_url,
        from: "url",
      };
    } catch {
      // fall back to RSS summary
    }
  }

  if (summary.length < 50 && !link) {
    throw new Error("Item RSS tidak punya konten cukup untuk diimpor");
  }

  const content =
    summary.length >= 50
      ? summary
      : `${title}\n\n${summary}`.trim();

  if (content.length < 50) {
    throw new Error(
      "Gagal mengambil isi lengkap dari link item, dan ringkasan RSS terlalu pendek."
    );
  }

  return {
    title: title || "Tanpa judul",
    content,
    source_url: link || "",
    excerpt: summary.slice(0, 200),
    method: "fallback",
    from: "summary",
  };
}
