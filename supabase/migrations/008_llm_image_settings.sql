-- Optional dedicated image-generation model settings (separate from chat/optimize LLM)
alter table public.llm_settings
  add column if not exists image_provider text,
  add column if not exists image_model text,
  add column if not exists image_base_url text,
  add column if not exists image_api_key text,
  add column if not exists image_size text default '1024x1024',
  add column if not exists image_quality text default 'standard';

comment on column public.llm_settings.image_provider is
  'Provider for featured image generation (openai, together, pollinations, or same as chat)';
comment on column public.llm_settings.image_model is
  'Image model id e.g. dall-e-3, gpt-image-1, pollinations/flux';
comment on column public.llm_settings.image_base_url is
  'Optional OpenAI-compatible base URL for image API; falls back to base_url';
comment on column public.llm_settings.image_api_key is
  'Optional API key for image provider; falls back to api_key / env';
comment on column public.llm_settings.image_size is
  'Default size e.g. 1024x1024 or 1280x720';
comment on column public.llm_settings.image_quality is
  'Default quality: standard | hd | high | medium | low';
