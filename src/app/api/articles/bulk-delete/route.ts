import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";

const MAX_IDS = 100;

/**
 * POST /api/articles/bulk-delete
 * Body: { ids: string[] }
 * Hapus banyak artikel sekaligus (jobs/versions/logs cascade).
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
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = [
      ...new Set(
        rawIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      ),
    ].slice(0, MAX_IDS);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 artikel (ids[])" },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from("articles")
      .delete()
      .eq("workspace_id", ws.workspace_id)
      .in("id", ids)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const deleted = data?.length ?? 0;
    return NextResponse.json({
      ok: true,
      deleted,
      requested: ids.length,
      deleted_ids: (data ?? []).map((r) => r.id),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
