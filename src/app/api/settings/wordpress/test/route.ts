import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { WordPressClient } from "@/lib/wordpress/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  isLocalWordPressUrl,
  validateWordPressBaseUrl,
} from "@/lib/wordpress/url";

/**
 * POST /api/settings/wordpress/test
 * Body:
 *  - { site_id } — test saved site
 *  - { base_url, username, app_password } — test form credentials before save
 */
export async function POST(request: Request) {
  // Declared outside try so catch can reference base_url safely
  let base_url = "";
  let username = "";
  let app_password = "";
  let site_name = "";

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

    if (body.site_id) {
      const { data: site, error } = await db
        .from("wordpress_sites")
        .select("*")
        .eq("id", body.site_id)
        .eq("workspace_id", ws.workspace_id)
        .maybeSingle();
      if (error || !site) {
        return NextResponse.json(
          { ok: false, error: "Situs tidak ditemukan" },
          { status: 404 }
        );
      }
      base_url = site.base_url;
      username = site.username;
      app_password = decryptSecret(site.app_password) ?? "";
      site_name = site.name;
    } else {
      username = String(body.username ?? "").trim();
      app_password = String(body.app_password ?? "").trim();
      site_name = String(body.name ?? "draft").trim();
      if (!body.base_url || !username || !app_password) {
        return NextResponse.json(
          {
            ok: false,
            error: "base_url, username, dan app_password wajib (atau site_id)",
          },
          { status: 400 }
        );
      }
      try {
        const checked = validateWordPressBaseUrl(String(body.base_url));
        base_url = checked.base_url;
      } catch (e) {
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "Base URL tidak valid",
          },
          { status: 400 }
        );
      }
    }

    // Normalize saved sites too
    try {
      base_url = validateWordPressBaseUrl(base_url).base_url;
    } catch {
      /* keep as-is if already stored */
    }

    const client = new WordPressClient(base_url, username, app_password);
    const result = await client.testConnection();
    const local = isLocalWordPressUrl(base_url) || Boolean(result.is_local);

    const fullyOk = result.connected && result.can_create_posts;
    const statusLabel = !result.connected
      ? "GAGAL TERHUBUNG"
      : !result.can_create_posts
        ? "TERHUBUNG (izin terbatas)"
        : local
          ? "TERHUBUNG · LOKAL · SIAP PUBLISH"
          : "TERHUBUNG · SIAP PUBLISH";

    return NextResponse.json({
      site_name,
      ...result,
      is_local: local,
      ok: fullyOk,
      // connected even if capability weak — UI shows partial green
      connected: result.connected,
      status_label: statusLabel,
      message: !result.connected
        ? "Tidak terhubung ke WordPress. Perbaiki langkah yang merah di bawah."
        : local
          ? result.can_create_posts
            ? "✓ WordPress LOKAL terhubung. Anda bisa publish dari Aieo."
            : "✓ REST + login OK, tapi role user kurang — naikkan ke Editor/Admin."
          : result.can_create_posts
            ? "✓ WordPress terhubung. Siap publish."
            : "✓ Login OK, tapi role user mungkin tidak bisa publish.",
      rest_style: result.rest_style,
      where_to_look: {
        rest: result.rest_url,
        admin: result.admin_url,
        posts_all: `${base_url}/wp-admin/edit.php`,
        posts_draft: `${base_url}/wp-admin/edit.php?post_status=draft&post_type=post`,
        posts_publish: `${base_url}/wp-admin/edit.php?post_status=publish&post_type=post`,
      },
      hints: local
        ? fullyOk
          ? [
              "✓ Siap publish. Di halaman artikel pilih mode “Publish sekarang” (bukan Draft).",
              "Setelah publish: buka wp-admin → Posts → Published (atau Drafts), bukan hanya homepage.",
              result.rest_style === "query"
                ? "Catatan: REST pakai mode Plain (?rest_route=). Opsional: Settings → Permalinks → Post name → Save agar /wp-json/ juga jalan."
                : "REST mode: " + (result.rest_style || "pretty"),
            ]
          : [
              "1) Pastikan WP buka di browser: " + base_url,
              "2) REST coba: " + base_url + "/?rest_route=/  (atau /index.php/wp-json/)",
              "3) wp-config.php: define('WP_ENVIRONMENT_TYPE', 'local');",
              "4) Users → Profile → Application Passwords (bukan password login)",
              "5) Role user: Administrator / Editor",
              "6) Docker: base URL = http://host.docker.internal:PORT jika Aieo di container",
            ]
        : [
            "Pastikan Application Password (bukan password login).",
            "Cek REST: " + (result.rest_url || base_url + "/wp-json/"),
          ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tes koneksi WordPress gagal";
    const localHint = /local|127\.0\.0\.1|docker|localhost/i.test(
      msg + base_url
    );
    const fallbackRest = base_url
      ? `${base_url.replace(/\/+$/, "")}/?rest_route=/`
      : "http://localhost:8080/?rest_route=/";
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        status_label: "GAGAL TERHUBUNG",
        error: msg,
        site_url: base_url || undefined,
        steps: [
          {
            id: "connect",
            label: "Koneksi ke server",
            ok: false,
            error: msg,
          },
        ],
        where_to_look: base_url
          ? {
              rest: fallbackRest,
              admin: `${base_url.replace(/\/+$/, "")}/wp-admin/`,
              posts_draft: `${base_url.replace(/\/+$/, "")}/wp-admin/edit.php?post_status=draft&post_type=post`,
              posts_publish: `${base_url.replace(/\/+$/, "")}/wp-admin/edit.php?post_status=publish&post_type=post`,
            }
          : undefined,
        hints: localHint
          ? [
              "Pastikan WordPress lokal sedang jalan (buka di browser).",
              "Coba REST: " + fallbackRest,
              "Atau: " + (base_url || "http://localhost:8080") + "/index.php/wp-json/",
              "wp-config: define('WP_ENVIRONMENT_TYPE', 'local');",
              "Jika Aieo di Docker → host.docker.internal, bukan localhost",
              "WP kamu terdeteksi di port 8080 (docker wp-app) — base URL: http://localhost:8080",
            ]
          : [
              "Pastikan Base URL benar, REST API aktif, Application Password valid.",
            ],
        hint: localHint
          ? "WP lokal: server jalan? REST (?rest_route=/ atau /wp-json)? Application Password + WP_ENVIRONMENT_TYPE=local?"
          : "Pastikan Base URL benar, REST API aktif, dan Application Password valid.",
      },
      { status: 502 }
    );
  }
}
