import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { getProviderDef, isKnownProvider } from "@/lib/llm/providers-catalog";
import { listProviders } from "@/lib/llm/provider";
import { encryptSecret } from "@/lib/crypto/secrets";
import { IMAGE_MODEL_PRESETS } from "@/lib/llm/image-models";

function maskSettings(row: Record<string, unknown> | null) {
  if (!row) return null;
  const apiKey = typeof row.api_key === "string" ? row.api_key : "";
  const fallbackKey =
    typeof row.fallback_api_key === "string" ? row.fallback_api_key : "";
  const imageKey =
    typeof row.image_api_key === "string" ? row.image_api_key : "";
  return {
    ...row,
    api_key: undefined,
    fallback_api_key: undefined,
    image_api_key: undefined,
    api_key_set: Boolean(apiKey),
    fallback_api_key_set: Boolean(fallbackKey),
    image_api_key_set: Boolean(imageKey),
  };
}

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
      .from("llm_settings")
      .select("*")
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: maskSettings(
        data ?? {
          workspace_id: ws.workspace_id,
          provider: "dahl",
          model: "moonshotai/Kimi-K2.6",
          base_url: "https://inference.dahl.global/v1",
          api_key: null,
          fallback_provider: null,
          fallback_model: null,
          fallback_base_url: null,
          fallback_api_key: null,
          use_json_mode: true,
          temperature: 0.2,
          max_tokens: 8192,
          top_p: 0.9,
          image_provider: "pollinations",
          image_model: "pollinations/flux",
          image_base_url: null,
          image_size: "1280x720",
          image_quality: "standard",
        }
      ),
      providers: listProviders(),
      image_model_presets: IMAGE_MODEL_PRESETS,
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
        { error: "Hanya admin yang dapat mengubah LLM settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const provider = String(body.provider ?? "xai").trim();
    const model = String(body.model ?? "").trim();
    const baseUrl = body.base_url ? String(body.base_url).trim() : null;
    const temperature = Math.min(Number(body.temperature ?? 0.2), 0.5);

    if (!model) {
      return NextResponse.json({ error: "Model wajib diisi" }, { status: 400 });
    }

    if (provider === "custom" && !baseUrl) {
      return NextResponse.json(
        { error: "Base URL wajib untuk provider Custom endpoint" },
        { status: 400 }
      );
    }

    if (!isKnownProvider(provider) && !baseUrl) {
      return NextResponse.json(
        {
          error: `Provider "${provider}" tidak dikenal. Pilih dari daftar atau set Base URL (custom).`,
        },
        { status: 400 }
      );
    }

    const { data: existing } = await db
      .from("llm_settings")
      .select("api_key, fallback_api_key, image_api_key")
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    let apiKey: string | null = existing?.api_key ?? null;
    if (body.clear_api_key === true) {
      apiKey = null;
    } else if (
      typeof body.api_key === "string" &&
      body.api_key.trim() &&
      body.api_key !== "********"
    ) {
      apiKey = encryptSecret(body.api_key.trim());
    }

    let fallbackApiKey: string | null = existing?.fallback_api_key ?? null;
    if (body.clear_fallback_api_key === true) {
      fallbackApiKey = null;
    } else if (
      typeof body.fallback_api_key === "string" &&
      body.fallback_api_key.trim() &&
      body.fallback_api_key !== "********"
    ) {
      fallbackApiKey = encryptSecret(body.fallback_api_key.trim());
    }

    let imageApiKey: string | null =
      (existing as { image_api_key?: string | null } | null)?.image_api_key ??
      null;
    if (body.clear_image_api_key === true) {
      imageApiKey = null;
    } else if (
      typeof body.image_api_key === "string" &&
      body.image_api_key.trim() &&
      body.image_api_key !== "********"
    ) {
      imageApiKey = encryptSecret(body.image_api_key.trim());
    }

    const fallbackProvider = body.fallback_provider
      ? String(body.fallback_provider).trim()
      : null;

    const payload: Record<string, unknown> = {
      workspace_id: ws.workspace_id,
      provider,
      model,
      base_url: baseUrl,
      api_key: apiKey,
      fallback_provider: fallbackProvider,
      fallback_model: body.fallback_model
        ? String(body.fallback_model).trim()
        : null,
      fallback_base_url: body.fallback_base_url
        ? String(body.fallback_base_url).trim()
        : null,
      fallback_api_key: fallbackApiKey,
      use_json_mode:
        body.use_json_mode === undefined
          ? (getProviderDef(provider)?.supportsJsonMode ?? true)
          : Boolean(body.use_json_mode),
      temperature,
      max_tokens: Number(body.max_tokens ?? 8192),
      top_p: Number(body.top_p ?? 0.9),
      updated_at: new Date().toISOString(),
    };

    // Image generation settings (migration 008) — optional
    if (body.image_provider !== undefined) {
      payload.image_provider = body.image_provider
        ? String(body.image_provider).trim()
        : null;
    }
    if (body.image_model !== undefined) {
      payload.image_model = body.image_model
        ? String(body.image_model).trim()
        : null;
    }
    if (body.image_base_url !== undefined) {
      payload.image_base_url = body.image_base_url
        ? String(body.image_base_url).trim()
        : null;
    }
    if (
      body.image_api_key !== undefined ||
      body.clear_image_api_key === true
    ) {
      payload.image_api_key = imageApiKey;
    }
    if (body.image_size !== undefined) {
      payload.image_size = body.image_size
        ? String(body.image_size).trim()
        : "1024x1024";
    }
    if (body.image_quality !== undefined) {
      payload.image_quality = body.image_quality
        ? String(body.image_quality).trim()
        : "standard";
    }

    let { data, error } = await db
      .from("llm_settings")
      .upsert(payload, { onConflict: "workspace_id" })
      .select("*")
      .single();

    // If image_* columns missing (migration 008 not applied), retry without them
    if (
      error &&
      (/image_/i.test(error.message) ||
        error.code === "PGRST204" ||
        error.message.includes("column"))
    ) {
      const {
        image_provider: _ip,
        image_model: _im,
        image_base_url: _ib,
        image_api_key: _ik,
        image_size: _is,
        image_quality: _iq,
        ...core
      } = payload;
      const retry = await db
        .from("llm_settings")
        .upsert(core, { onConflict: "workspace_id" })
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
      if (!error) {
        // still return success but note migration
        return NextResponse.json({
          settings: maskSettings(data),
          providers: listProviders(),
          image_model_presets: IMAGE_MODEL_PRESETS,
          warning:
            "Kolom image_* belum ada — jalankan migrasi 008_llm_image_settings.sql. Model gambar tetap bisa dipilih per-request di artikel.",
        });
      }
    }

    if (error) {
      if (
        error.message.includes("base_url") ||
        error.message.includes("column") ||
        error.code === "PGRST204"
      ) {
        return NextResponse.json(
          {
            error: `${error.message}. Pastikan migrasi 002/008 sudah dijalankan di Supabase.`,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: maskSettings(data),
      providers: listProviders(),
      image_model_presets: IMAGE_MODEL_PRESETS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
