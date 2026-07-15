-- Track article source + flexible job request meta (model override, template id)

alter table public.articles
  add column if not exists source_url text,
  add column if not exists source_type text
    check (source_type is null or source_type in ('paste', 'url', 'rss', 'batch'));

comment on column public.articles.source_url is 'Original URL or feed item link';
comment on column public.articles.source_type is 'How the draft was ingested';

alter table public.jobs
  add column if not exists request_meta jsonb not null default '{}'::jsonb;

comment on column public.jobs.request_meta is
  'Enqueue options: prompt_template_id, model, source_url, batch_id';

create index if not exists jobs_queued_created_idx
  on public.jobs (workspace_id, created_at)
  where status = 'queued';
