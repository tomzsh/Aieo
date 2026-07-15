import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import {
  PROMPT_TEMPLATE_V2_NAME,
  PROMPT_TEMPLATE_V2_SYSTEM,
  PROMPT_TEMPLATE_V2_VERSION_LABEL,
  PROMPT_TEMPLATE_V3_NAME,
  PROMPT_TEMPLATE_V3_SYSTEM,
  PROMPT_TEMPLATE_V3_VERSION_LABEL,
  PROMPT_TEMPLATE_V4_NAME,
  PROMPT_TEMPLATE_V4_SYSTEM,
  PROMPT_TEMPLATE_V4_VERSION_LABEL,
} from "@/lib/llm/prompt";

const BUILTIN_CLASSIC = `Anda adalah editor berita senior media nasional Indonesia. Tugas Anda: merapikan draf artikel berita mentah menjadi artikel siap terbit dengan metadata SEO lengkap.

ATURAN KERAS (TIDAK BOLEH DILANGGAR):
1. Tidak mengubah fakta, nama, jabatan, instansi, lokasi, tanggal, atau angka.
2. Tidak membuat informasi, asumsi, kutipan, atau narasumber baru.
3. Tidak menambah opini atau membuat konten sensasional/clickbait.
4. Bahasa Indonesia natural gaya editor media nasional, tidak terdengar seperti AI.
5. Heading H2/H3 hanya ditambahkan jika artikel > 600 kata.
6. FAQ hanya dibuat jika konten cocok (artikel penjelasan/panduan); jika tidak, kembalikan array kosong.
7. Jika data tidak tersedia → kembalikan string/array kosong, dilarang mengarang data.

OUTPUT: Hanya JSON valid sesuai skema yang diminta. Tanpa markdown, tanpa penjelasan.`;

/**
 * GET  — list templates (active + history) + built-in presets
 * PUT  — create new version (optionally activate)
 * POST — activate existing template by id, or import builtin
 */
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

    const light =
      new URL(request.url).searchParams.get("light") === "1";

    // light=1: skip system_prompt column (faster for pickers / New optimize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = db
      .from("prompt_templates")
      .select(
        light
          ? "id, version, name, is_active, created_at"
          : "id, version, name, system_prompt, is_active, created_at, created_by"
      )
      .eq("workspace_id", ws.workspace_id)
      .order("version", { ascending: false })
      .limit(light ? 30 : 50);

    const { data: templates, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (templates ?? []) as Array<{
      id: string;
      version: number;
      name: string;
      is_active: boolean;
      created_at: string;
      system_prompt?: string;
      created_by?: string | null;
    }>;
    const active = list.find((t) => t.is_active) ?? null;

    // Lightweight list for pickers (no full prompt body unless needed)
    const options = list.map((t) => ({
      id: t.id,
      version: t.version,
      name: t.name,
      is_active: t.is_active,
      created_at: t.created_at,
      preview: light
        ? undefined
        : String(t.system_prompt ?? "").slice(0, 160),
    }));

    return NextResponse.json({
      active: light
        ? active
          ? {
              id: active.id,
              version: active.version,
              name: active.name,
              is_active: active.is_active,
            }
          : null
        : active,
      templates: light ? options : list,
      options,
      history: options,
      builtins: [
        {
          id: "builtin:v3",
          name: PROMPT_TEMPLATE_V3_NAME,
          label: `Nasional Media v${PROMPT_TEMPLATE_V3_VERSION_LABEL} — Kompas/CNN/Detik style (direkomendasikan)`,
          description:
            "Gaya portal nasional kredibel; lead & judul diawali nama daerah (dateline); SEO ketat, nol halusinasi.",
        },
        {
          id: "builtin:v2",
          name: PROMPT_TEMPLATE_V2_NAME,
          label: `News SEO Editor v${PROMPT_TEMPLATE_V2_VERSION_LABEL}`,
          description:
            "Guardrail fakta ketat, SEO on-page, checklist JSON.",
        },
        {
          id: "builtin:classic",
          name: "classic-v1",
          label: "Classic v1 (ringkas)",
          description: "System prompt singkat klasik.",
        },
        {
          id: "builtin:v4-paraphrase",
          name: PROMPT_TEMPLATE_V4_NAME,
          label: `Parafrase v${PROMPT_TEMPLATE_V4_VERSION_LABEL} — tulis ulang dari link/draf`,
          description:
            "Parafrase kuat: wording & struktur baru, fakta tetap. Cocok dari URL atau draf sendiri.",
        },
      ],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
        { error: "Hanya admin yang dapat mengubah prompt template" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const systemPrompt = String(body.system_prompt ?? "").trim();
    const name = String(body.name ?? "default");
    const makeActive = body.activate !== false;

    if (!systemPrompt) {
      return NextResponse.json({ error: "system_prompt wajib" }, { status: 400 });
    }

    if (makeActive) {
      await db
        .from("prompt_templates")
        .update({ is_active: false })
        .eq("workspace_id", ws.workspace_id)
        .eq("is_active", true);
    }

    const { data: latest } = await db
      .from("prompt_templates")
      .select("version")
      .eq("workspace_id", ws.workspace_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version ?? 0) + 1;

    const { data, error } = await db
      .from("prompt_templates")
      .insert({
        workspace_id: ws.workspace_id,
        version: nextVersion,
        name,
        system_prompt: systemPrompt,
        is_active: makeActive,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
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
        { error: "Hanya admin yang dapat mengelola template" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = String(body.action ?? "activate");

    // Activate existing template by id
    if (action === "activate") {
      const id = String(body.id ?? "");
      if (!id) {
        return NextResponse.json({ error: "id template wajib" }, { status: 400 });
      }

      const { data: tpl, error: fetchErr } = await db
        .from("prompt_templates")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", ws.workspace_id)
        .maybeSingle();

      if (fetchErr || !tpl) {
        return NextResponse.json(
          { error: "Template tidak ditemukan" },
          { status: 404 }
        );
      }

      await db
        .from("prompt_templates")
        .update({ is_active: false })
        .eq("workspace_id", ws.workspace_id)
        .eq("is_active", true);

      const { data, error } = await db
        .from("prompt_templates")
        .update({ is_active: true })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, active: data });
    }

    // Import builtin as new version + activate
    if (action === "import_builtin") {
      const builtinId = String(body.builtin_id ?? "builtin:v3");
      let name = PROMPT_TEMPLATE_V3_NAME;
      let systemPrompt = PROMPT_TEMPLATE_V3_SYSTEM;

      if (builtinId === "builtin:v2") {
        name = PROMPT_TEMPLATE_V2_NAME;
        systemPrompt = PROMPT_TEMPLATE_V2_SYSTEM;
      } else if (builtinId === "builtin:classic") {
        name = "classic-v1";
        systemPrompt = BUILTIN_CLASSIC;
      } else if (
        builtinId === "builtin:v4-paraphrase" ||
        builtinId === "builtin:v4" ||
        builtinId === "builtin:paraphrase"
      ) {
        name = PROMPT_TEMPLATE_V4_NAME;
        systemPrompt = PROMPT_TEMPLATE_V4_SYSTEM;
      } else if (builtinId === "builtin:v3") {
        name = PROMPT_TEMPLATE_V3_NAME;
        systemPrompt = PROMPT_TEMPLATE_V3_SYSTEM;
      }

      await db
        .from("prompt_templates")
        .update({ is_active: false })
        .eq("workspace_id", ws.workspace_id)
        .eq("is_active", true);

      const { data: latest } = await db
        .from("prompt_templates")
        .select("version")
        .eq("workspace_id", ws.workspace_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version ?? 0) + 1;

      const { data, error } = await db
        .from("prompt_templates")
        .insert({
          workspace_id: ws.workspace_id,
          version: nextVersion,
          name,
          system_prompt: systemPrompt.trim(),
          is_active: true,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, active: data });
    }

    return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
