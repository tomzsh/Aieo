import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * GET /api/health — app + Supabase connectivity (no secrets leaked)
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const hasAnon = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const supabase: {
    configured: boolean;
    reachable: boolean | null;
    tables: Record<string, boolean> | null;
    llm_custom_endpoint: boolean | null;
    error: string | null;
  } = {
    configured: Boolean(url && hasAnon),
    reachable: null,
    tables: null,
    llm_custom_endpoint: null,
    error: null,
  };

  if (url && hasService) {
    try {
      const sb = createSupabaseClient(
        url,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const expected = [
        "profiles",
        "workspaces",
        "workspace_members",
        "articles",
        "jobs",
        "llm_settings",
        "prompt_templates",
        "wordpress_sites",
        "wordpress_categories",
        "wordpress_tags",
        "article_versions",
        "publish_logs",
      ];

      const tables: Record<string, boolean> = {};
      for (const t of expected) {
        const { error } = await sb.from(t).select("*", { count: "exact", head: true });
        tables[t] = !error;
      }
      supabase.tables = tables;
      supabase.reachable = Object.values(tables).some(Boolean);

      // Migration 002: base_url on llm_settings
      const { error: colErr } = await sb
        .from("llm_settings")
        .select("base_url")
        .limit(1);
      supabase.llm_custom_endpoint = !colErr;
      if (colErr && /base_url|column/i.test(colErr.message)) {
        supabase.llm_custom_endpoint = false;
      }
    } catch (e) {
      supabase.reachable = false;
      supabase.error = e instanceof Error ? e.message : String(e);
    }
  } else if (url && hasAnon) {
    supabase.error =
      "SUPABASE_SERVICE_ROLE_KEY missing — only basic config check performed";
  } else {
    supabase.error = "Supabase env not configured (.env.local)";
  }

  const ok =
    supabase.configured &&
    supabase.reachable !== false &&
    (supabase.tables
      ? Object.values(supabase.tables).every(Boolean)
      : true);

  return NextResponse.json(
    {
      ok,
      service: "aieo",
      time: new Date().toISOString(),
      supabase: {
        url_host: url ? new URL(url).host : null,
        has_anon_or_publishable_key: hasAnon,
        has_service_role_key: hasService,
        ...supabase,
      },
    },
    { status: ok ? 200 : 503 }
  );
}
