import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { listRemoteModels } from "@/lib/llm/list-models";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  filterImageModels,
  IMAGE_MODEL_PRESETS,
} from "@/lib/llm/image-models";

/**
 * POST /api/settings/llm/models
 * Auto-fetch model list from OpenAI-compatible provider.
 *
 * Body (optional overrides):
 *  { provider?, base_url?, api_key?, use_saved?: boolean, filter?: "image" | "all" }
 *
 * If fields omitted, uses workspace llm_settings (+ env keys).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
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

    const { data: settings } = await db
      .from("llm_settings")
      .select("*")
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    const provider = String(
      body.provider ?? settings?.provider ?? "omniroute"
    ).trim();

    const baseUrl =
      body.base_url !== undefined
        ? body.base_url
          ? String(body.base_url).trim()
          : null
        : (settings?.base_url ?? null);

    let apiKey: string | null = null;
    if (
      typeof body.api_key === "string" &&
      body.api_key.trim() &&
      body.api_key !== "********"
    ) {
      apiKey = body.api_key.trim();
    } else if (settings?.api_key) {
      apiKey = decryptSecret(settings.api_key);
    }

    // Fallback section (optional)
    const forFallback = body.target === "fallback";
    const resolved = forFallback
      ? {
          provider: String(
            body.provider ?? settings?.fallback_provider ?? provider
          ),
          baseUrl:
            body.base_url !== undefined
              ? body.base_url
                ? String(body.base_url).trim()
                : null
              : (settings?.fallback_base_url ?? baseUrl),
          apiKey:
            typeof body.api_key === "string" &&
            body.api_key.trim() &&
            body.api_key !== "********"
              ? body.api_key.trim()
              : decryptSecret(settings?.fallback_api_key) ?? apiKey,
        }
      : { provider, baseUrl, apiKey };

    const result = await listRemoteModels({
      provider: resolved.provider,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
    });

    const filter = String(body.filter ?? "all").toLowerCase();
    if (filter === "image") {
      const imageModels = filterImageModels(result.models);
      return NextResponse.json({
        ok: true,
        provider: resolved.provider,
        base_url: result.baseUrl ?? null,
        count: imageModels.length,
        total_models: result.count,
        filter: "image",
        models: imageModels,
        presets: IMAGE_MODEL_PRESETS,
        note:
          imageModels.length === 0
            ? "Tidak ada model image terdeteksi dari /models. Pakai preset (DALL·E / Pollinations) atau ketik model manual."
            : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      provider: resolved.provider,
      base_url: result.baseUrl ?? null,
      count: result.count,
      models: result.models,
      presets: filter === "image" ? IMAGE_MODEL_PRESETS : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengambil model";
    const wantImage =
      String((body as { filter?: string }).filter ?? "").toLowerCase() ===
      "image";
    if (wantImage) {
      return NextResponse.json({
        ok: false,
        error: message,
        presets: IMAGE_MODEL_PRESETS,
        models: [],
        count: 0,
        hint:
          "Gagal list model remote. Pilih preset image (DALL·E 3, Pollinations, dll) atau ketik id model manual.",
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Pastikan Base URL benar (…/v1) dan API key valid. Endpoint harus mendukung GET /models.",
      },
      { status: 502 }
    );
  }
}
