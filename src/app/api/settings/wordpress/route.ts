import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { encryptSecret } from "@/lib/crypto/secrets";
import {
  isLocalWordPressUrl,
  validateWordPressBaseUrl,
} from "@/lib/wordpress/url";

export async function GET() {
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

    const { data, error } = await db
      .from("wordpress_sites")
      .select(
        "id, workspace_id, name, base_url, username, is_default, created_at, updated_at"
      )
      .eq("workspace_id", ws.workspace_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sites = (data ?? []).map((s) => ({
      ...s,
      is_local: isLocalWordPressUrl(s.base_url),
    }));

    return NextResponse.json({ sites });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

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

    if (ws.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang dapat menambah situs WP" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim();
    const app_password = String(body.app_password ?? "").trim();
    const is_default = Boolean(body.is_default);

    if (!name || !body.base_url || !username || !app_password) {
      return NextResponse.json(
        { error: "name, base_url, username, app_password wajib" },
        { status: 400 }
      );
    }

    let base_url: string;
    let is_local = false;
    let hints: string[] = [];
    try {
      const checked = validateWordPressBaseUrl(String(body.base_url));
      base_url = checked.base_url;
      is_local = checked.is_local;
      hints = checked.hints;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Base URL tidak valid" },
        { status: 400 }
      );
    }

    if (is_default) {
      await db
        .from("wordpress_sites")
        .update({ is_default: false })
        .eq("workspace_id", ws.workspace_id);
    }

    const { data, error } = await db
      .from("wordpress_sites")
      .insert({
        workspace_id: ws.workspace_id,
        name: is_local && !/local|localhost|dev|test/i.test(name)
          ? `${name} (local)`
          : name,
        base_url,
        username,
        app_password: encryptSecret(app_password),
        is_default,
      })
      .select(
        "id, workspace_id, name, base_url, username, is_default, created_at, updated_at"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...data,
        is_local: isLocalWordPressUrl(base_url),
        hints,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthedContext();
    if (ctx.error || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, db } = ctx;

    const ws = await getUserWorkspace(db, user.id);
    if (!ws || ws.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id wajib" }, { status: 400 });
    }

    const { error } = await db
      .from("wordpress_sites")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
