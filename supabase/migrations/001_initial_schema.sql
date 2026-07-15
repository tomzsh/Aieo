-- Aieo: AI News SEO Optimizer & WordPress Publisher
-- PostgreSQL schema for Supabase

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'editor'
    check (role in ('admin', 'editor', 'seo', 'social')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workspaces (multi-tenant ready)
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'editor'
    check (role in ('admin', 'editor', 'seo', 'social')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- LLM settings (per workspace)
-- ---------------------------------------------------------------------------
create table public.llm_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  provider text not null default 'xai'
    check (provider in ('xai', 'openai', 'anthropic', 'google', 'ollama', 'openrouter')),
  model text not null default 'grok-4.5',
  fallback_provider text
    check (fallback_provider is null or fallback_provider in ('xai', 'openai', 'anthropic', 'google', 'ollama', 'openrouter')),
  fallback_model text,
  temperature numeric not null default 0.2
    check (temperature >= 0 and temperature <= 0.5),
  max_tokens integer not null default 8192,
  top_p numeric not null default 0.9,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Prompt templates (versioned)
-- ---------------------------------------------------------------------------
create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null default 1,
  name text not null default 'default',
  system_prompt text not null,
  is_active boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index prompt_templates_one_active_per_workspace
  on public.prompt_templates (workspace_id)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- WordPress sites
-- ---------------------------------------------------------------------------
create table public.wordpress_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  base_url text not null,
  username text not null,
  -- Store app password encrypted at application layer before insert when possible.
  -- Column name reflects intent; never expose via public client without care.
  app_password text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wordpress_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wordpress_sites (id) on delete cascade,
  wp_id integer not null,
  name text not null,
  slug text,
  parent_wp_id integer,
  synced_at timestamptz not null default now(),
  unique (site_id, wp_id)
);

create table public.wordpress_tags (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wordpress_sites (id) on delete cascade,
  wp_id integer not null,
  name text not null,
  slug text,
  synced_at timestamptz not null default now(),
  unique (site_id, wp_id)
);

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text,
  raw_draft text not null,
  categories_input text[] not null default '{}',
  optimized jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'ready', 'flagged', 'published', 'failed')),
  flagged_for_review boolean not null default false,
  flag_reasons text[] not null default '{}',
  wordpress_site_id uuid references public.wordpress_sites (id) on delete set null,
  wordpress_post_id integer,
  wordpress_url text,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_workspace_idx on public.articles (workspace_id);
create index articles_status_idx on public.articles (status);
create index articles_created_at_idx on public.articles (created_at desc);

-- ---------------------------------------------------------------------------
-- Jobs (async optimize / publish pipeline)
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  type text not null default 'optimize'
    check (type in ('optimize', 'publish')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error text,
  result jsonb,
  llm_provider text,
  llm_model text,
  prompt_version integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index jobs_article_idx on public.jobs (article_id);
create index jobs_status_idx on public.jobs (status);

-- ---------------------------------------------------------------------------
-- Article versions (audit history)
-- ---------------------------------------------------------------------------
create table public.article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  version integer not null,
  optimized jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (article_id, version)
);

-- ---------------------------------------------------------------------------
-- Publish logs
-- ---------------------------------------------------------------------------
create table public.publish_logs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  wordpress_site_id uuid references public.wordpress_sites (id) on delete set null,
  status text not null,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger wordpress_sites_updated_at
  before update on public.wordpress_sites
  for each row execute function public.set_updated_at();

create trigger llm_settings_updated_at
  before update on public.llm_settings
  for each row execute function public.set_updated_at();

-- Auto-create profile + personal workspace on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  default_prompt text;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'admin'
  );

  insert into public.workspaces (name, owner_id)
  values ('Workspace ' || coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'admin');

  insert into public.llm_settings (workspace_id, provider, model, temperature, max_tokens, top_p)
  values (new_workspace_id, 'xai', 'grok-4.5', 0.2, 8192, 0.9);

  default_prompt := $prompt$
Anda adalah editor berita senior media nasional Indonesia. Tugas Anda: merapikan draf artikel berita mentah menjadi artikel siap terbit dengan metadata SEO lengkap.

ATURAN KERAS (TIDAK BOLEH DILANGGAR):
1. Tidak mengubah fakta, nama, jabatan, instansi, lokasi, tanggal, atau angka.
2. Tidak membuat informasi, asumsi, kutipan, atau narasumber baru.
3. Tidak menambah opini atau membuat konten sensasional/clickbait.
4. Bahasa Indonesia natural gaya editor media nasional, tidak terdengar seperti AI.
5. Heading H2/H3 hanya ditambahkan jika artikel > 600 kata.
6. FAQ hanya dibuat jika konten cocok (artikel penjelasan/panduan); jika tidak, kembalikan array kosong.
7. Jika data tidak tersedia → kembalikan string/array kosong, dilarang mengarang data.

OUTPUT: Hanya JSON valid sesuai skema yang diminta. Tanpa markdown, tanpa penjelasan.
$prompt$;

  insert into public.prompt_templates (workspace_id, version, name, system_prompt, is_active, created_by)
  values (new_workspace_id, 1, 'default', trim(default_prompt), true, new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Membership helper for RLS
-- SECURITY DEFINER required: SECURITY INVOKER re-enters workspace_members RLS
-- and causes 54001 stack depth limit exceeded (infinite recursion).
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.llm_settings enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.wordpress_sites enable row level security;
alter table public.wordpress_categories enable row level security;
alter table public.wordpress_tags enable row level security;
alter table public.articles enable row level security;
alter table public.jobs enable row level security;
alter table public.article_versions enable row level security;
alter table public.publish_logs enable row level security;

-- Profiles
create policy "profiles_select_own_or_workspace"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Workspaces
create policy "workspaces_select_member"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces_update_admin"
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy "workspaces_insert_authenticated"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Workspace members
create policy "workspace_members_select"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_admin_manage"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- LLM settings
create policy "llm_settings_select_member"
  on public.llm_settings for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "llm_settings_update_admin"
  on public.llm_settings for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "llm_settings_insert_admin"
  on public.llm_settings for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

-- Prompt templates
create policy "prompt_templates_select_member"
  on public.prompt_templates for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "prompt_templates_insert_admin"
  on public.prompt_templates for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy "prompt_templates_update_admin"
  on public.prompt_templates for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- WordPress sites (members can read; admins manage)
create policy "wp_sites_select_member"
  on public.wordpress_sites for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "wp_sites_insert_admin"
  on public.wordpress_sites for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy "wp_sites_update_admin"
  on public.wordpress_sites for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "wp_sites_delete_admin"
  on public.wordpress_sites for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

-- WP categories/tags via site membership
create policy "wp_categories_select"
  on public.wordpress_categories for select to authenticated
  using (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  );

create policy "wp_categories_manage"
  on public.wordpress_categories for all to authenticated
  using (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  );

create policy "wp_tags_select"
  on public.wordpress_tags for select to authenticated
  using (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  );

create policy "wp_tags_manage"
  on public.wordpress_tags for all to authenticated
  using (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.wordpress_sites s
      where s.id = site_id and public.is_workspace_member(s.workspace_id)
    )
  );

-- Articles
create policy "articles_select_member"
  on public.articles for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "articles_insert_member"
  on public.articles for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = (select auth.uid())
  );

create policy "articles_update_member"
  on public.articles for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "articles_delete_admin"
  on public.articles for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

-- Jobs
create policy "jobs_select_member"
  on public.jobs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "jobs_insert_member"
  on public.jobs for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "jobs_update_member"
  on public.jobs for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Article versions
create policy "article_versions_select"
  on public.article_versions for select to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_id and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "article_versions_insert"
  on public.article_versions for insert to authenticated
  with check (
    exists (
      select 1 from public.articles a
      where a.id = article_id and public.is_workspace_member(a.workspace_id)
    )
  );

-- Publish logs
create policy "publish_logs_select"
  on public.publish_logs for select to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_id and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "publish_logs_insert"
  on public.publish_logs for insert to authenticated
  with check (
    exists (
      select 1 from public.articles a
      where a.id = article_id and public.is_workspace_member(a.workspace_id)
    )
  );

-- Grants for Data API (RLS still applies)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
