/** Shared domain types for Aieo */

export type UserRole = "admin" | "editor" | "seo" | "social";

export type ArticleStatus =
  | "draft"
  | "processing"
  | "ready"
  | "flagged"
  | "published"
  | "failed"
  | "scheduled";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type LlmProvider =
  | "xai"
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "omniroute"
  | "lmstudio"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "together"
  | "mistral"
  | "fireworks"
  | "perplexity"
  | "litellm"
  | "dahl"
  | "custom";

export type SearchIntent =
  | "Informational"
  | "Navigational"
  | "Commercial"
  | "Transactional"
  | "";

export type SchemaType =
  | "NewsArticle"
  | "Article"
  | "Report"
  | "LiveBlogPosting";

export interface SeoScore {
  seo: number;
  readability: number;
  content_quality: number;
  ctr: number;
  eeat: number;
  keyword: number;
  heading: number;
  meta: number;
  internal_link: number;
}

export interface OptimizedArticle {
  title: string;
  alternative_titles: string[];
  meta_title: string;
  content: string;
  summary: string;
  excerpt: string;
  lead: string;
  meta_description: string;
  slug: string;
  primary_keyword: string;
  secondary_keywords: string[];
  long_tail_keywords: string[];
  lsi_keywords: string[];
  search_intent: SearchIntent | string;
  category: string;
  tags: string[];
  faq: Array<{ question: string; answer: string } | string>;
  internal_link_anchors: string[];
  featured_image_prompt: string;
  featured_image_alt: string;
  /** Optional source URL for featured image (Aieo extension) */
  featured_image_url?: string;
  featured_image_wp_media_id?: number | null;
  facebook_caption: string;
  twitter_caption: string;
  linkedin_caption: string;
  schema: SchemaType | string;
  seo_score: SeoScore;
  suggestions: string[];
  wordpress: {
    status: "draft" | "publish" | "future" | "pending";
    allow_comments: boolean;
    allow_ping: boolean;
    date?: string;
  };
  meta_processing: {
    llm_provider: string;
    llm_model: string;
    prompt_version: string;
    processed_at: string;
    mode?: "optimize" | "paraphrase";
    similarity?: {
      score: number;
      originality: number;
      verdict: "strong" | "moderate" | "weak" | "near_duplicate";
      method: string;
      token_jaccard?: number;
      trigram_jaccard?: number;
    };
  };
}

export interface Article {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string | null;
  raw_draft: string;
  categories_input: string[];
  optimized: OptimizedArticle | null;
  status: ArticleStatus;
  flagged_for_review: boolean;
  flag_reasons: string[];
  wordpress_site_id: string | null;
  wordpress_post_id: number | null;
  wordpress_url: string | null;
  published_at: string | null;
  published_by: string | null;
  /** ISO time when auto-publish / WP future is set */
  scheduled_at?: string | null;
  source_url?: string | null;
  source_type?: "paste" | "url" | "rss" | "batch" | null;
  /** Featured image preview URL (remote or WP media) */
  featured_image_url?: string | null;
  /** WP attachment ID after upload */
  featured_image_wp_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  workspace_id: string;
  article_id: string;
  type: "optimize" | "publish";
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  error: string | null;
  result: OptimizedArticle | null;
  llm_provider: string | null;
  llm_model: string | null;
  prompt_version: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface LlmSettings {
  id: string;
  workspace_id: string;
  provider: LlmProvider | string;
  model: string;
  /** OpenAI-compatible base URL override (required for custom) */
  base_url: string | null;
  /** Workspace API key override; masked in API responses */
  api_key?: string | null;
  api_key_set?: boolean;
  fallback_provider: LlmProvider | string | null;
  fallback_model: string | null;
  fallback_base_url: string | null;
  fallback_api_key?: string | null;
  fallback_api_key_set?: boolean;
  use_json_mode: boolean;
  temperature: number;
  max_tokens: number;
  top_p: number;
  updated_at: string;
}

export interface PromptTemplate {
  id: string;
  workspace_id: string;
  version: number;
  name: string;
  system_prompt: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface WordpressSite {
  id: string;
  workspace_id: string;
  name: string;
  base_url: string;
  username: string;
  app_password?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  data: OptimizedArticle | null;
  errors: string[];
  flagged_for_review: boolean;
  flag_reasons: string[];
}
