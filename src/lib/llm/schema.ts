import { z } from "zod";

const scoreField = z.number().min(0).max(100);

export const seoScoreSchema = z.object({
  seo: scoreField,
  readability: scoreField,
  content_quality: scoreField,
  ctr: scoreField,
  eeat: scoreField,
  keyword: scoreField,
  heading: scoreField,
  meta: scoreField,
  internal_link: scoreField,
});

export const optimizedArticleSchema = z.object({
  title: z.string(),
  alternative_titles: z.array(z.string()).default([]),
  meta_title: z.string().default(""),
  content: z.string(),
  summary: z.string().default(""),
  excerpt: z.string().default(""),
  lead: z.string().default(""),
  meta_description: z.string().default(""),
  slug: z.string().default(""),
  primary_keyword: z.string().default(""),
  secondary_keywords: z.array(z.string()).default([]),
  long_tail_keywords: z.array(z.string()).default([]),
  lsi_keywords: z.array(z.string()).default([]),
  search_intent: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  faq: z
    .array(
      z.union([
        z.string(),
        z.object({ question: z.string(), answer: z.string() }),
      ])
    )
    .default([]),
  internal_link_anchors: z.array(z.string()).default([]),
  featured_image_prompt: z.string().default(""),
  featured_image_alt: z.string().default(""),
  facebook_caption: z.string().default(""),
  twitter_caption: z.string().default(""),
  linkedin_caption: z.string().default(""),
  schema: z.string().default("NewsArticle"),
  seo_score: seoScoreSchema.default({
    seo: 0,
    readability: 0,
    content_quality: 0,
    ctr: 0,
    eeat: 0,
    keyword: 0,
    heading: 0,
    meta: 0,
    internal_link: 0,
  }),
  suggestions: z.array(z.string()).default([]),
  wordpress: z
    .object({
      status: z
        .enum(["draft", "publish", "future", "pending"])
        .default("draft"),
      allow_comments: z.boolean().default(true),
      allow_ping: z.boolean().default(false),
      date: z.string().optional(),
    })
    .default({
      status: "draft",
      allow_comments: true,
      allow_ping: false,
    }),
  meta_processing: z
    .object({
      llm_provider: z.string().default(""),
      llm_model: z.string().default(""),
      prompt_version: z.string().default(""),
      processed_at: z.string().default(""),
      mode: z.enum(["optimize", "paraphrase"]).optional(),
      similarity: z
        .object({
          score: z.number(),
          originality: z.number(),
          verdict: z.enum([
            "strong",
            "moderate",
            "weak",
            "near_duplicate",
          ]),
          method: z.string(),
          token_jaccard: z.number().optional(),
          trigram_jaccard: z.number().optional(),
        })
        .optional(),
    })
    .passthrough()
    .default({
      llm_provider: "",
      llm_model: "",
      prompt_version: "",
      processed_at: "",
    }),
});

export type OptimizedArticleParsed = z.infer<typeof optimizedArticleSchema>;

export const OUTPUT_JSON_SCHEMA_DESCRIPTION = `{
  "title": "string — judul utama SEO (ideal ≤60 karakter, non-clickbait)",
  "alternative_titles": ["tepat 4 string alternatif judul SEO"],
  "meta_title": "string — ≤60 karakter; samakan dengan title jika sudah pendek",
  "content": "string — HTML sederhana: hanya <p> dan opsional <h2>/<h3> jika diizinkan",
  "summary": "string — ringkasan maks 40 kata",
  "excerpt": "string — cuplikan maks 30 kata",
  "lead": "string — paragraf pembuka langsung ke inti berita",
  "meta_description": "string — maks 155 karakter, sertakan primary keyword",
  "slug": "string — lowercase-dash, singkat, ASCII",
  "primary_keyword": "string — 1 frasa utama dari topik draf",
  "secondary_keywords": ["5-10 string"],
  "long_tail_keywords": ["3-5 string"],
  "lsi_keywords": ["5-10 string semantik dari draf"],
  "search_intent": "Informational | Navigational | Commercial | Transactional",
  "category": "string — SATU dari daftar kategori user, atau Lainnya",
  "tags": ["10-15 tag: tokoh/lokasi/instansi/topik/peristiwa dari draf"],
  "faq": [{"question":"string","answer":"string"}] atau [],
  "internal_link_anchors": ["maks 5 anchor text, tanpa URL"],
  "featured_image_prompt": "string — English realistic editorial news photography",
  "featured_image_alt": "string — ID, maks 125 karakter",
  "facebook_caption": "string",
  "twitter_caption": "string — paling ringkas",
  "linkedin_caption": "string",
  "schema": "NewsArticle | Article | Report | LiveBlogPosting",
  "seo_score": {
    "seo": 0-100, "readability": 0-100, "content_quality": 0-100,
    "ctr": 0-100, "eeat": 0-100, "keyword": 0-100,
    "heading": 0-100, "meta": 0-100, "internal_link": 0-100
  },
  "suggestions": ["0-10 saran konkret untuk editor"],
  "wordpress": {
    "status": "draft",
    "allow_comments": true,
    "allow_ping": false
  }
}`;
