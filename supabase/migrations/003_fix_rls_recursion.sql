-- Fix 54001 stack depth limit exceeded
-- Cause: is_workspace_member / is_workspace_admin were SECURITY INVOKER and
-- queried workspace_members, whose RLS called the same functions → infinite recursion.

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

-- Ensure authenticated can still call them for RLS policies
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_member(uuid) to service_role;
grant execute on function public.is_workspace_admin(uuid) to service_role;

-- Harden profiles policy: avoid nested workspace_members RLS where possible
drop policy if exists "profiles_select_own_or_workspace" on public.profiles;
create policy "profiles_select_own_or_workspace"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = (select auth.uid())
        and b.user_id = profiles.id
    )
  );
