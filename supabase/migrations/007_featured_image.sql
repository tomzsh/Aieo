-- Featured image metadata for WordPress publish

alter table public.articles
  add column if not exists featured_image_url text,
  add column if not exists featured_image_wp_id integer;

comment on column public.articles.featured_image_url is
  'Preview / source URL of featured image (remote or WP media URL)';
comment on column public.articles.featured_image_wp_id is
  'WordPress media attachment ID after upload';

create index if not exists articles_title_trgm_idx
  on public.articles (workspace_id, created_at desc);
