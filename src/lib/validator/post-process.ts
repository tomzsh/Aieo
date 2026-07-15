import type { OptimizedArticle, ValidationResult } from "@/lib/types";
import { optimizedArticleSchema } from "@/lib/llm/schema";
import { slugify, truncate, wordCount } from "@/lib/utils";

/** Extract likely entities: capitalized names, numbers, dates-ish tokens */
function extractEntities(text: string): Set<string> {
  const entities = new Set<string>();

  // Numbers (including decimals and percentages)
  for (const m of text.matchAll(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?%?\b/g)) {
    entities.add(m[0].replace(/\s/g, ""));
  }

  // Indonesian / ISO-ish dates
  for (const m of text.matchAll(
    /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}\b/gi
  )) {
    entities.add(m[0].toLowerCase());
  }
  for (const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    entities.add(m[0]);
  }

  // Multi-word capitalized phrases (simple NER proxy)
  for (const m of text.matchAll(
    /\b(?:[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+){1,4})\b/g
  )) {
    const name = m[0].trim();
    if (name.length > 3) entities.add(name.toLowerCase());
  }

  // Common Indonesian titles + name patterns
  for (const m of text.matchAll(
    /\b(?:Presiden|Menteri|Gubernur|Bupati|Wali Kota|Dirjen|Kapolda|Kapolri|Jenderal|Dr\.?|Prof\.?)\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+)*/g
  )) {
    entities.add(m[0].toLowerCase());
  }

  return entities;
}

function enforceLengthLimits(data: OptimizedArticle): OptimizedArticle {
  const next = { ...data };

  if (next.title.length > 70) {
    next.title = truncate(next.title, 60);
  }
  if (!next.meta_title) {
    next.meta_title = next.title;
  }
  if (next.meta_title.length > 60) {
    next.meta_title = truncate(next.meta_title, 60);
  }
  if (next.meta_description.length > 155) {
    next.meta_description = truncate(next.meta_description, 155);
  }
  if (next.featured_image_alt.length > 125) {
    next.featured_image_alt = truncate(next.featured_image_alt, 125);
  }
  if (wordCount(next.excerpt) > 30) {
    next.excerpt = next.excerpt.split(/\s+/).slice(0, 30).join(" ");
  }
  if (wordCount(next.summary) > 40) {
    next.summary = next.summary.split(/\s+/).slice(0, 40).join(" ");
  }
  if (!next.slug) {
    next.slug = slugify(next.title);
  } else {
    next.slug = slugify(next.slug);
  }

  next.alternative_titles = (next.alternative_titles ?? []).slice(0, 5);
  next.secondary_keywords = (next.secondary_keywords ?? []).slice(0, 10);
  next.long_tail_keywords = (next.long_tail_keywords ?? []).slice(0, 5);
  next.lsi_keywords = (next.lsi_keywords ?? []).slice(0, 10);
  next.tags = (next.tags ?? []).slice(0, 15);
  next.internal_link_anchors = (next.internal_link_anchors ?? []).slice(0, 5);
  next.suggestions = (next.suggestions ?? []).slice(0, 10);

  if (!next.wordpress) {
    next.wordpress = {
      status: "draft",
      allow_comments: true,
      allow_ping: false,
    };
  } else {
    // v1 default: always draft unless user explicitly publishes later
    next.wordpress = {
      ...next.wordpress,
      status: next.wordpress.status || "draft",
    };
  }

  if (!next.schema) next.schema = "NewsArticle";

  return next;
}

/**
 * Post-processing validator:
 * - Schema validation
 * - Length enforcement
 * - Lightweight entity novelty check vs source draft
 */
export function validateOptimizedOutput(
  raw: unknown,
  sourceDraft: string
): ValidationResult {
  const errors: string[] = [];
  const flagReasons: string[] = [];

  const parsed = optimizedArticleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      data: null,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      ),
      flagged_for_review: true,
      flag_reasons: ["schema_validation_failed"],
    };
  }

  let data = enforceLengthLimits(parsed.data as OptimizedArticle);

  // Heading check: if draft ≤ 600 words, strip H2/H3 if LLM added them
  const sourceWords = wordCount(sourceDraft);
  if (sourceWords <= 600) {
    const hasHeadings = /<h[23][\s>]/i.test(data.content);
    if (hasHeadings) {
      data = {
        ...data,
        content: data.content
          .replace(/<\/?h[23][^>]*>/gi, "")
          .replace(/\n{3,}/g, "\n\n"),
      };
      flagReasons.push("headings_removed_short_article");
    }
  }

  // Entity novelty check
  const sourceEntities = extractEntities(sourceDraft);
  const outputEntities = extractEntities(
    `${data.title}\n${data.content}\n${data.lead}`
  );

  const novel: string[] = [];
  for (const e of outputEntities) {
    if (!sourceEntities.has(e) && e.length > 2) {
      // allow entities that appear as substrings in source (normalization)
      const inSource = sourceDraft.toLowerCase().includes(e);
      if (!inSource) {
        novel.push(e);
      }
    }
  }

  // Flag only if multiple novel entities (reduce false positives)
  if (novel.length >= 3) {
    flagReasons.push(
      `possible_new_entities: ${novel.slice(0, 8).join(", ")}`
    );
  }

  // Category fallback
  if (!data.category?.trim()) {
    data.category = "Lainnya";
  }

  // Required content
  if (!data.content?.trim()) {
    errors.push("content kosong");
  }
  if (!data.title?.trim()) {
    errors.push("title kosong");
  }

  const flagged = flagReasons.length > 0 || errors.length > 0;

  return {
    valid: errors.length === 0,
    data,
    errors,
    flagged_for_review: flagged,
    flag_reasons: flagReasons,
  };
}
