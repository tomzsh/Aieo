import { extract } from "@extractus/article-extractor";
import { assertSafePublicUrl, fetchText } from "./ssrf";

export interface ImportedArticle {
  title: string;
  content: string;
  source_url: string;
  excerpt?: string;
  byline?: string | null;
  published?: string | null;
  method: "readability" | "fallback";
}

function htmlToPlainish(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function fallbackExtract(html: string, pageUrl: string): ImportedArticle {
  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").trim() || pageUrl;

  // Prefer article/main body chunks
  const articleChunk =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html;

  const content = htmlToPlainish(articleChunk);
  if (content.length < 80) {
    throw new Error(
      "Konten artikel tidak berhasil diekstrak dari halaman. Coba URL artikel lengkap."
    );
  }

  return {
    title,
    content,
    source_url: pageUrl,
    method: "fallback",
  };
}

/**
 * Fetch a public article URL and extract title + main text for use as raw_draft.
 */
export async function importFromUrl(rawUrl: string): Promise<ImportedArticle> {
  const safe = assertSafePublicUrl(rawUrl);

  // Prefer extractus (uses fetch internally); also do our own fetch as fallback body
  try {
    const article = await extract(
      safe.toString(),
      {},
      {
        headers: {
          "User-Agent":
            "AieoBot/1.0 (+https://localhost; URL importer for editorial tool)",
        },
      }
    );

    if (article?.content) {
      const content = htmlToPlainish(article.content);
      if (content.length >= 80) {
        return {
          title: (article.title ?? "").trim() || safe.toString(),
          content,
          source_url: article.url || safe.toString(),
          excerpt: article.description ?? undefined,
          byline: article.author ?? null,
          published: article.published ?? null,
          method: "readability",
        };
      }
    }
  } catch {
    // fall through to manual fetch
  }

  const { finalUrl, body } = await fetchText(safe.toString());
  return fallbackExtract(body, finalUrl);
}
