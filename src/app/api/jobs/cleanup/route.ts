import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

/**
 * POST /api/jobs/cleanup
 * Shortcut: hapus job terminal (completed/failed) yang menumpuk.
 * Body: { statuses?: ("completed"|"failed")[], older_than_days?: number, dry_run?: boolean }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;

    const ws = await getUserWorkspace(db, user.id);
    if (!ws) {
      return NextResponse.json(
        { error: "Workspace tidak ditemukan" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body.dry_run);
    const allowed = new Set(["completed", "failed"]);
    let statuses = Array.isArray(body.statuses)
      ? body.statuses.filter((s: string) => allowed.has(s))
      : ["completed", "failed"];
    if (statuses.length === 0) statuses = ["completed", "failed"];

    const olderDays =
      body.older_than_days != null && Number.isFinite(Number(body.older_than_days))
        ? Math.max(0, Math.floor(Number(body.older_than_days)))
        : null;
    const limit = Math.min(Math.max(1, Number(body.limit) || 300), 500);

    let q = db
      .from("jobs")
      .select("id")
      .eq("workspace_id", ws.workspace_id)
      .in("status", statuses)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (olderDays != null) {
      const cutoff = new Date(
        Date.now() - olderDays * 86400000
      ).toISOString();
      q = q.lt("created_at", cutoff);
    }

    const { data: matched, error: matchErr } = await q;
    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 500 });
    }

    const ids = (matched ?? []).map((r) => r.id);
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        matched: ids.length,
        deleted: 0,
        message: `Preview: ${ids.length} job cocok`,
      });
    }

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        dry_run: false,
        matched: 0,
        deleted: 0,
        message: "Tidak ada job yang cocok",
      });
    }

    const { data: deleted, error: delErr } = await db
      .from("jobs")
      .delete()
      .eq("workspace_id", ws.workspace_id)
      .in("id", ids)
      .select("id");

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      dry_run: false,
      matched: ids.length,
      deleted: deleted?.length ?? 0,
      message: `Dihapus ${deleted?.length ?? 0} job`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
