import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { listRemoteModels } from "@/lib/llm/list-models";
import { WordPressClient } from "@/lib/wordpress/client";
import { decryptSecret } from "@/lib/crypto/secrets";

/**
 * GET /api/settings/diagnostics
 * Run quick connectivity checks: Supabase, LLM /models, WordPress default site.
 */
export async function GET() {
  const started = Date.now();
  const checks: Array<{
    id: string;
    label: string;
    ok: boolean;
    latency_ms?: number;
    detail?: string;
    error?: string;
  }> = [];

  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;
    const ws = await getUserWorkspace(db, user.id);

    // 1) Supabase
    {
      const t0 = Date.now();
      try {
        const { error, count } = await db
          .from("workspaces")
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        checks.push({
          id: "supabase",
          label: "Supabase (database)",
          ok: true,
          latency_ms: Date.now() - t0,
          detail: `Workspace OK${ws ? ` · ${ws.workspace?.name ?? ws.workspace_id}` : ""} · count probe ${count ?? 0}`,
        });
      } catch (e) {
        checks.push({
          id: "supabase",
          label: "Supabase (database)",
          ok: false,
          latency_ms: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 2) LLM models endpoint
    if (ws) {
      const t0 = Date.now();
      try {
        const { data: settings } = await db
          .from("llm_settings")
          .select("*")
          .eq("workspace_id", ws.workspace_id)
          .maybeSingle();

        const result = await listRemoteModels({
          provider: settings?.provider ?? "omniroute",
          baseUrl: settings?.base_url ?? null,
          apiKey: decryptSecret(settings?.api_key) ?? null,
        });
        checks.push({
          id: "llm",
          label: `LLM models (${settings?.provider ?? "omniroute"})`,
          ok: true,
          latency_ms: Date.now() - t0,
          detail: `${result.count} model · ${result.baseUrl ?? "default"} · default ${settings?.model ?? "—"}`,
        });
      } catch (e) {
        checks.push({
          id: "llm",
          label: "LLM models",
          ok: false,
          latency_ms: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 3) WordPress default / first site
    if (ws) {
      const t0 = Date.now();
      try {
        const { data: site } = await db
          .from("wordpress_sites")
          .select("*")
          .eq("workspace_id", ws.workspace_id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!site) {
          checks.push({
            id: "wordpress",
            label: "WordPress",
            ok: false,
            detail: "Belum ada situs dikonfigurasi",
            error: "Tambahkan di Settings → WordPress",
          });
        } else {
          const client = new WordPressClient(
            site.base_url,
            site.username,
            decryptSecret(site.app_password) ?? ""
          );
          const r = await client.testConnection();
          checks.push({
            id: "wordpress",
            label: `WordPress (${site.name})`,
            ok: r.ok,
            latency_ms: Date.now() - t0,
            detail: `${r.name ?? site.base_url} · user ${r.user?.name ?? "?"} · roles ${(r.user?.roles ?? []).join(",") || "—"} · can_edit=${r.can_create_posts}`,
          });
        }
      } catch (e) {
        checks.push({
          id: "wordpress",
          label: "WordPress",
          ok: false,
          latency_ms: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 4) App health self
    {
      const t0 = Date.now();
      checks.push({
        id: "app",
        label: "Aieo API",
        ok: true,
        latency_ms: Date.now() - t0,
        detail: `Authenticated as ${user.email ?? user.id}`,
      });
    }

    const allOk = checks.every((c) => c.ok);

    return NextResponse.json({
      ok: allOk,
      total_ms: Date.now() - started,
      checks,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Diagnostics failed",
        checks,
        total_ms: Date.now() - started,
      },
      { status: 500 }
    );
  }
}
