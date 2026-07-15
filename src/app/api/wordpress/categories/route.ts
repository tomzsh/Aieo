import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { WordPressClient } from "@/lib/wordpress/client";
import { decryptSecret } from "@/lib/crypto/secrets";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("site_id");
    const sync = searchParams.get("sync") === "1";

    let siteQuery = db
      .from("wordpress_sites")
      .select("*")
      .eq("workspace_id", ws.workspace_id);

    if (siteId) siteQuery = siteQuery.eq("id", siteId);
    else siteQuery = siteQuery.order("is_default", { ascending: false });

    const { data: site } = await siteQuery.limit(1).maybeSingle();

    if (!site) {
      return NextResponse.json({ categories: [], site: null });
    }

    if (sync) {
      const client = new WordPressClient(
        site.base_url,
        site.username,
        decryptSecret(site.app_password) ?? ""
      );
      const remote = await client.listCategories();

      for (const cat of remote) {
        await db.from("wordpress_categories").upsert(
          {
            site_id: site.id,
            wp_id: cat.id,
            name: cat.name,
            slug: cat.slug,
            parent_wp_id: cat.parent || null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "site_id,wp_id" }
        );
      }
    }

    const { data: categories } = await db
      .from("wordpress_categories")
      .select("*")
      .eq("site_id", site.id)
      .order("name");

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        base_url: site.base_url,
      },
      categories: categories ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
