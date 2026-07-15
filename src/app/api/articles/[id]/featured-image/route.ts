import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { decryptSecret } from "@/lib/crypto/secrets";
import { WordPressClient } from "@/lib/wordpress/client";
import {
  fetchImageFromUrl,
  imageFromBuffer,
  imageFromDataUrl,
  prepareImageForUpload,
  type ImageBytes,
} from "@/lib/wordpress/featured-image";
import {
  generateImage,
  resolveImageSettings,
} from "@/lib/llm/image-generate";
import type { OptimizedArticle } from "@/lib/types";

/**
 * POST /api/articles/:id/featured-image
 *
 * JSON body:
 *  - { image_url } | { data_url, filename? } | { clear: true }
 *  - { generate: true, image_model?, image_provider?, image_size?, image_quality?,
 *      prompt?, edit?: boolean, reference_data_url? | reference_url? }
 *  - { upload_to_wp?: boolean }
 *
 * Multipart: file, generate, edit, image_model, image_provider, prompt, ...
 *   - file alone = set featured from upload
 *   - generate + file (or edit=true) = image-to-image edit with that file as reference
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: article, error: artErr } = await db
      .from("articles")
      .select(
        "id, workspace_id, optimized, featured_image_url, featured_image_wp_id"
      )
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .maybeSingle();

    let articleRow = article;
    if (artErr && /featured_image/i.test(artErr.message)) {
      const fb = await db
        .from("articles")
        .select("id, workspace_id, optimized")
        .eq("id", id)
        .eq("workspace_id", ws.workspace_id)
        .maybeSingle();
      if (fb.error || !fb.data) {
        return NextResponse.json(
          { error: "Artikel tidak ditemukan" },
          { status: 404 }
        );
      }
      articleRow = {
        ...fb.data,
        featured_image_url: null,
        featured_image_wp_id: null,
      };
    } else if (artErr || !articleRow) {
      return NextResponse.json(
        { error: artErr?.message ?? "Artikel tidak ditemukan" },
        { status: artErr ? 500 : 404 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let clear = false;
    let generate = false;
    let edit = false;
    let imageUrl: string | null = null;
    let dataUrl: string | null = null;
    let filename = "featured.jpg";
    let uploadToWp = true;
    let imageBytes: ImageBytes | null = null;
    let referenceBytes: ImageBytes | null = null;
    let promptOverride: string | null = null;
    let imageModel: string | null = null;
    let imageProvider: string | null = null;
    let imageSize: string | null = null;
    let imageQuality: string | null = null;
    let referenceDataUrl: string | null = null;
    let referenceUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      clear = form.get("clear") === "true" || form.get("clear") === "1";
      generate =
        form.get("generate") === "true" || form.get("generate") === "1";
      edit = form.get("edit") === "true" || form.get("edit") === "1";
      imageUrl = form.get("image_url") ? String(form.get("image_url")) : null;
      uploadToWp = form.get("upload_to_wp") !== "false";
      promptOverride = form.get("prompt")
        ? String(form.get("prompt"))
        : null;
      imageModel = form.get("image_model")
        ? String(form.get("image_model"))
        : null;
      imageProvider = form.get("image_provider")
        ? String(form.get("image_provider"))
        : null;
      imageSize = form.get("image_size")
        ? String(form.get("image_size"))
        : null;
      imageQuality = form.get("image_quality")
        ? String(form.get("image_quality"))
        : null;
      referenceDataUrl = form.get("reference_data_url")
        ? String(form.get("reference_data_url"))
        : null;
      referenceUrl = form.get("reference_url")
        ? String(form.get("reference_url"))
        : null;

      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        const f = file as File;
        const buf = Buffer.from(await f.arrayBuffer());
        const parsed = imageFromBuffer(
          buf,
          f.name || "featured.jpg",
          f.type || undefined
        );
        filename = parsed.filename;
        // With generate/edit → reference image; plain upload → featured bytes
        if (generate || edit) {
          referenceBytes = parsed;
          edit = true;
        } else {
          imageBytes = parsed;
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      clear = Boolean(body.clear);
      generate = Boolean(body.generate);
      edit = Boolean(body.edit);
      imageUrl = body.image_url ? String(body.image_url).trim() : null;
      dataUrl = body.data_url ? String(body.data_url) : null;
      filename = body.filename ? String(body.filename) : "featured.jpg";
      uploadToWp = body.upload_to_wp !== false;
      promptOverride = body.prompt ? String(body.prompt) : null;
      imageModel = body.image_model ? String(body.image_model).trim() : null;
      imageProvider = body.image_provider
        ? String(body.image_provider).trim()
        : null;
      imageSize = body.image_size ? String(body.image_size).trim() : null;
      imageQuality = body.image_quality
        ? String(body.image_quality).trim()
        : null;
      referenceDataUrl = body.reference_data_url
        ? String(body.reference_data_url)
        : null;
      referenceUrl = body.reference_url
        ? String(body.reference_url).trim()
        : null;
    }

    if (clear) {
      const optimized = (articleRow.optimized || {}) as OptimizedArticle & {
        featured_image_url?: string;
        featured_image_wp_media_id?: number | null;
      };
      optimized.featured_image_url = "";
      optimized.featured_image_wp_media_id = null;

      const update: Record<string, unknown> = {
        optimized,
        updated_at: new Date().toISOString(),
        featured_image_url: null,
        featured_image_wp_id: null,
      };

      let { error: upErr } = await db
        .from("articles")
        .update(update)
        .eq("id", id)
        .eq("workspace_id", ws.workspace_id);

      if (upErr && /featured_image/i.test(upErr.message)) {
        const retry = await db
          .from("articles")
          .update({ optimized, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("workspace_id", ws.workspace_id);
        upErr = retry.error;
      }
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        cleared: true,
        featured_image_url: null,
        featured_image_wp_id: null,
      });
    }

    let genMeta: {
      source?: string;
      model?: string;
      provider?: string;
      revised_prompt?: string;
    } = {};

    // Load reference for edit if not from multipart file
    if (generate || edit) {
      if (!referenceBytes && referenceDataUrl) {
        referenceBytes = imageFromDataUrl(referenceDataUrl, "reference.png");
        edit = true;
      } else if (!referenceBytes && referenceUrl) {
        referenceBytes = await fetchImageFromUrl(referenceUrl, {
          allowLocal: true,
        });
        edit = true;
      } else if (
        !referenceBytes &&
        edit &&
        typeof articleRow.featured_image_url === "string" &&
        articleRow.featured_image_url
      ) {
        const existing = articleRow.featured_image_url;
        if (existing.startsWith("data:")) {
          referenceBytes = imageFromDataUrl(existing, "reference.png");
        } else {
          try {
            referenceBytes = await fetchImageFromUrl(existing, {
              allowLocal: true,
            });
          } catch {
            /* ignore missing reference */
          }
        }
      }
    }

    // Generate via LLM / Pollinations
    if (generate && !imageBytes) {
      const optimizedRow = articleRow.optimized as OptimizedArticle | null;
      const prompt =
        promptOverride?.trim() ||
        optimizedRow?.featured_image_prompt?.trim() ||
        optimizedRow?.title?.trim() ||
        "";
      if (!prompt) {
        return NextResponse.json(
          {
            error:
              "Prompt gambar kosong. Isi featured_image_prompt di tab Sosial, atau kirim field prompt.",
          },
          { status: 400 }
        );
      }

      const { data: llmSettings } = await db
        .from("llm_settings")
        .select("*")
        .eq("workspace_id", ws.workspace_id)
        .maybeSingle();

      const resolved = resolveImageSettings(llmSettings as Record<string, unknown> | null, {
        provider: imageProvider,
        model: imageModel,
        size: imageSize,
        quality: imageQuality,
      });

      // Decrypt keys: image_api_key → api_key
      let apiKey: string | null = null;
      if (llmSettings) {
        const imgKey = decryptSecret(
          (llmSettings as { image_api_key?: string }).image_api_key
        );
        const mainKey = decryptSecret(
          (llmSettings as { api_key?: string }).api_key
        );
        apiKey = imgKey || mainKey;
      }

      try {
        const result = await generateImage({
          provider: resolved.provider,
          model: resolved.model,
          baseUrl: resolved.baseUrl,
          apiKey,
          prompt,
          size: resolved.size,
          quality: resolved.quality,
          reference: edit ? referenceBytes : null,
        });
        imageBytes = {
          bytes: result.bytes,
          mimeType: result.mimeType,
          filename: result.filename,
        };
        genMeta = {
          source: result.source,
          model: result.model,
          provider: result.provider,
          revised_prompt: result.revised_prompt,
        };
      } catch (e) {
        return NextResponse.json(
          {
            error: e instanceof Error ? e.message : "Generate gambar gagal",
            hint:
              "Pilih model image (bukan chat). Contoh: dall-e-3, gpt-image-1, atau pollinations/flux. " +
              "Edit butuh model yang support /images/edits (DALL·E 2 / GPT Image 1).",
          },
          { status: 502 }
        );
      }
    }

    // Resolve non-generate bytes
    if (!imageBytes) {
      if (dataUrl) {
        imageBytes = imageFromDataUrl(dataUrl, filename);
      } else if (imageUrl) {
        if (imageUrl.startsWith("data:")) {
          imageBytes = imageFromDataUrl(imageUrl, filename);
        } else {
          imageBytes = await fetchImageFromUrl(imageUrl);
        }
      } else {
        return NextResponse.json(
          {
            error:
              "Sertakan image_url, data_url, file upload, atau generate=true",
          },
          { status: 400 }
        );
      }
    }

    const optimized = {
      ...((articleRow.optimized || {}) as OptimizedArticle),
    } as OptimizedArticle & {
      featured_image_url?: string;
      featured_image_wp_media_id?: number | null;
      featured_image_gen?: {
        model?: string;
        provider?: string;
        source?: string;
        revised_prompt?: string;
      };
    };

    let wpMediaId: number | null = null;
    let finalUrl = imageUrl && !imageUrl.startsWith("data:") ? imageUrl : "";

    if (uploadToWp) {
      const { data: site } = await db
        .from("wordpress_sites")
        .select("*")
        .eq("workspace_id", ws.workspace_id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Always validate + strip Pollinations EXIF JSON before upload/store
      imageBytes = prepareImageForUpload(imageBytes);

      if (site) {
        try {
          const client = new WordPressClient(
            site.base_url,
            site.username,
            decryptSecret(site.app_password) ?? ""
          );
          const alt =
            optimized.featured_image_alt ||
            optimized.title ||
            "Featured image";
          const media = await client.uploadMedia(
            imageBytes.filename,
            imageBytes.bytes,
            imageBytes.mimeType,
            alt
          );
          wpMediaId = media.id;
          finalUrl = media.source_url;
          // Ensure caption/description empty (avoid prompt text leaking into media UI)
          await client.clearMediaText(media.id, alt).catch(() => undefined);
        } catch (e) {
          console.warn("[featured-image] WP upload failed", e);
          if (!finalUrl) {
            // Persist as data URL so UI still works; publish can re-upload
            const b64 = Buffer.from(imageBytes.bytes).toString("base64");
            finalUrl = `data:${imageBytes.mimeType};base64,${b64}`;
          }
        }
      } else if (!finalUrl) {
        const b64 = Buffer.from(imageBytes.bytes).toString("base64");
        finalUrl = `data:${imageBytes.mimeType};base64,${b64}`;
      }
    } else if (!finalUrl) {
      imageBytes = prepareImageForUpload(imageBytes);
      const b64 = Buffer.from(imageBytes.bytes).toString("base64");
      finalUrl = `data:${imageBytes.mimeType};base64,${b64}`;
    }

    if (!finalUrl) {
      return NextResponse.json(
        { error: "Gagal menentukan URL gambar" },
        { status: 500 }
      );
    }

    optimized.featured_image_url = finalUrl;
    optimized.featured_image_wp_media_id = wpMediaId;
    if (genMeta.model) {
      optimized.featured_image_gen = {
        model: genMeta.model,
        provider: genMeta.provider,
        source: genMeta.source,
        revised_prompt: genMeta.revised_prompt,
      };
    }

    const update: Record<string, unknown> = {
      optimized,
      updated_at: new Date().toISOString(),
      featured_image_url: finalUrl.startsWith("data:") ? null : finalUrl,
      featured_image_wp_id: wpMediaId,
    };
    // Keep data URL only in optimized JSON (column may be short text)
    if (!finalUrl.startsWith("data:")) {
      update.featured_image_url = finalUrl;
    } else {
      update.featured_image_url = null;
    }

    let { data: updated, error: upErr } = await db
      .from("articles")
      .update(update)
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .select(
        "id, featured_image_url, featured_image_wp_id, optimized, updated_at"
      )
      .single();

    if (upErr && /featured_image/i.test(upErr.message)) {
      const retry = await db
        .from("articles")
        .update({
          optimized,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", ws.workspace_id)
        .select("id, optimized, updated_at")
        .single();
      upErr = retry.error;
      updated = retry.data
        ? {
            ...retry.data,
            featured_image_url: finalUrl.startsWith("data:")
              ? null
              : finalUrl,
            featured_image_wp_id: wpMediaId,
          }
        : null;
    }

    if (upErr || !updated) {
      return NextResponse.json(
        { error: upErr?.message ?? "Gagal menyimpan" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      featured_image_url:
        (updated.optimized as { featured_image_url?: string } | null)
          ?.featured_image_url || finalUrl,
      featured_image_wp_id: wpMediaId,
      uploaded_to_wp: Boolean(wpMediaId),
      generated: generate,
      edited: edit && generate,
      generation: genMeta.model ? genMeta : undefined,
      article: updated,
    });
  } catch (e) {
    console.error("[featured-image]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
