import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUserWorkspace(
  supabase: SupabaseClient,
  userId: string
) {
  // Prefer direct membership row (works with service-role or fixed RLS)
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!membership) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, owner_id, created_at")
    .eq("id", membership.workspace_id)
    .maybeSingle();

  return {
    workspace_id: membership.workspace_id as string,
    role: membership.role as string,
    workspace: workspace as {
      id: string;
      name: string;
      owner_id: string;
      created_at: string;
    } | null,
  };
}

export async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null as null, error: "Unauthorized" as const };
  }
  return { user, error: null };
}

/** Assert user is member of workspace (for service-role paths). */
export async function assertWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
