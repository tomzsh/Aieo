-- Expand LLM providers + per-workspace custom endpoint / API key override

-- Drop old provider checks so we can expand the set
alter table public.llm_settings drop constraint if exists llm_settings_provider_check;
alter table public.llm_settings drop constraint if exists llm_settings_fallback_provider_check;

alter table public.llm_settings
  add column if not exists base_url text,
  add column if not exists api_key text,
  add column if not exists fallback_base_url text,
  add column if not exists fallback_api_key text,
  add column if not exists use_json_mode boolean not null default true;

-- Keep provider as free text with soft validation in app layer.
-- Known values: xai, openai, anthropic, google, ollama, openrouter,
-- deepseek, groq, together, mistral, fireworks, perplexity, litellm, custom
comment on column public.llm_settings.base_url is
  'Optional OpenAI-compatible base URL override (required when provider=custom)';
comment on column public.llm_settings.api_key is
  'Optional workspace API key override; prefer env secrets in production';
comment on column public.llm_settings.fallback_base_url is
  'Optional base URL for fallback provider';
comment on column public.llm_settings.fallback_api_key is
  'Optional API key for fallback provider';
comment on column public.llm_settings.use_json_mode is
  'Send response_format=json_object when true; disable for gateways that reject it';
