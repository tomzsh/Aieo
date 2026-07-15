import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/workspace";

/**
 * After verifying the user session, use the service-role client for data access.
 * This avoids broken recursive RLS (error 54001 stack depth) while migrations catch up.
 * Always scope queries by workspace_id / user_id — service role bypasses RLS.
 */
export async function getAuthedContext(): Promise<
  | {
      user: User;
      /** User-scoped session client (auth / cookies) */
      auth: SupabaseClient;
      /** Service-role data client (bypasses RLS — scope manually) */
      db: SupabaseClient;
      error: null;
    }
  | { user: null; auth: null; db: null; error: "Unauthorized" }
> {
  const auth = await createClient();
  const { user, error } = await requireUser(auth);
  if (!user || error) {
    return { user: null, auth: null, db: null, error: "Unauthorized" };
  }

  let db: SupabaseClient;
  try {
    db = createServiceClient();
  } catch {
    // Fallback if service role missing — may still hit RLS recursion
    db = auth;
  }

  return { user, auth, db, error: null };
}
