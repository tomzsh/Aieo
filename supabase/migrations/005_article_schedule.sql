-- Support auto-publish / scheduled posts

-- Expand article status
alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles
  add constraint articles_status_check
  check (status in (
    'draft', 'processing', 'ready', 'flagged',
    'published', 'failed', 'scheduled'
  ));

alter table public.articles
  add column if not exists scheduled_at timestamptz;

comment on column public.articles.scheduled_at is
  'When the post is scheduled to go live (WordPress future or Aieo cron)';

create index if not exists articles_scheduled_at_idx
  on public.articles (scheduled_at)
  where status = 'scheduled';
