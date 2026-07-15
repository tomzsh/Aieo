import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { createLlmClient } from "@/lib/llm/provider";
import { decryptSecret } from "@/lib/crypto/secrets";

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

    const { data: settings } = await db
      .from("llm_settings")
      .select("*")
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    const provider = String(body.provider ?? settings?.provider ?? "dahl");
    const model = String(
      body.model ?? settings?.model ?? "moonshotai/Kimi-K2.6"
    );
    const baseUrl =
      body.base_url !== undefined
        ? body.base_url
        : (settings?.base_url ?? null);
    const apiKey =
      typeof body.api_key === "string" &&
      body.api_key.trim() &&
      body.api_key !== "********"
        ? body.api_key.trim()
        : decryptSecret(settings?.api_key);

    const { client, baseUrl: resolvedBase, model: resolvedModel } =
      createLlmClient({
        provider,
        model,
        baseUrl,
        apiKey,
        useJsonMode: false,
      });

    const started = Date.now();
    const response = await client.chat.completions.create({
      model: resolvedModel,
      max_tokens: 16,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: 'Reply with exactly: {"ok":true}',
        },
      ],
    });
    const latencyMs = Date.now() - started;
    const content = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({
      ok: true,
      provider,
      model: resolvedModel,
      base_url: resolvedBase ?? null,
      latency_ms: latencyMs,
      sample: content.slice(0, 200),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Connection test failed",
      },
      { status: 502 }
    );
  }
}
