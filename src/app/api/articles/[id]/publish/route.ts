import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/data";
import { getUserWorkspace } from "@/lib/workspace";
import { WordPressClient } from "@/lib/wordpress/client";
import type { OptimizedArticle } from "@/lib/types";
import {
  assertScheduleInFuture,
  localDateTimeToIso,
  toWordPressDate,
} from "@/lib/publish/schedule";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  fetchImageFromUrl,
  imageFromDataUrl,
  prepareImageForUpload,
  stripAccidentalImageJsonFromContent,
} from "@/lib/wordpress/featured-image";
import {
  generateImage,
  resolveImageSettings,
} from "@/lib/llm/image-generate";
import { isLocalWordPressUrl } from "@/lib/wordpress/url";
import { normalizeWordPressBaseUrl } from "@/lib/wordpress/url";

/**
 * POST /api/articles/{id}/publish
 *
 * Body:
 *  - status: draft | publish | pending | future
 *  - date?: datetime-local string (required when status=future or schedule=true)
 *  - schedule?: boolean (shorthand → future)
 *  - force?: boolean (bypass flag review)
 *  - wordpress_site_id?: string
 *  - skip_featured_image?: boolean
 *  - auto_featured_image?: boolean (default true) — generate from prompt if no image yet
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
    const { user, db: supabase } = ctx;

    const ws = await getUserWorkspace(supabase, user.id);
    if (!ws) {
      return NextResponse.json(
        { error: "Workspace tidak ditemukan" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let status =
      (body.status as "draft" | "publish" | "future" | "pending") ?? "draft";
    const siteId = body.wordpress_site_id as string | undefined;
    const scheduleFlag = body.schedule === true || status === "future";
    const rawDate = (body.date || body.scheduled_at || "") as string;

    if (scheduleFlag) {
      status = "future";
    }

    let wpDate: string | undefined;
    let scheduledAtIso: string | null = null;

    if (status === "future") {
      if (!rawDate) {
        return NextResponse.json(
          { error: "Untuk penjadwalan, isi tanggal & jam (date)." },
          { status: 400 }
        );
      }
      try {
        assertScheduleInFuture(rawDate, 2);
        wpDate = toWordPressDate(rawDate);
        scheduledAtIso = localDateTimeToIso(rawDate);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Jadwal tidak valid" },
          { status: 400 }
        );
      }
    }

    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", ws.workspace_id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Artikel tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!article.optimized) {
      return NextResponse.json(
        { error: "Artikel belum dioptimasi" },
        { status: 400 }
      );
    }

    if (article.flagged_for_review && !body.force) {
      return NextResponse.json(
        {
          error:
            "Artikel di-flag untuk review manual. Set force=true setelah review untuk tetap publish.",
          flag_reasons: article.flag_reasons,
        },
        { status: 409 }
      );
    }

    let siteQuery = supabase
      .from("wordpress_sites")
      .select("*")
      .eq("workspace_id", article.workspace_id);

    if (siteId) {
      siteQuery = siteQuery.eq("id", siteId);
    } else {
      siteQuery = siteQuery.eq("is_default", true);
    }

    let { data: site } = await siteQuery.maybeSingle();

    if (!site) {
      const { data: anySite } = await supabase
        .from("wordpress_sites")
        .select("*")
        .eq("workspace_id", article.workspace_id)
        .limit(1)
        .maybeSingle();
      site = anySite;
    }

    if (!site) {
      return NextResponse.json(
        {
          error:
            "Belum ada situs WordPress. Tambahkan di Settings → WordPress.",
        },
        { status: 400 }
      );
    }

    const optimized = article.optimized as OptimizedArticle & {
      featured_image_url?: string;
      featured_image_wp_media_id?: number | null;
    };
    const client = new WordPressClient(
      site.base_url,
      site.username,
      decryptSecret(site.app_password) ?? ""
    );

    // Featured image → WP Media Library
    // Priority: existing WP media id → existing URL → auto-generate from prompt
    let featuredMediaId: number | undefined;
    let featuredUploaded = false;
    let featuredGenerated = false;
    let featuredImageError: string | null = null;
    const autoFeatured =
      body.auto_featured_image !== false && body.skip_featured_image !== true;

    if (!body.skip_featured_image) {
      const existingWpId =
        (typeof article.featured_image_wp_id === "number" &&
          article.featured_image_wp_id) ||
        (typeof optimized.featured_image_wp_media_id === "number" &&
          optimized.featured_image_wp_media_id) ||
        null;
      let imageUrl =
        (typeof article.featured_image_url === "string" &&
          article.featured_image_url.trim()) ||
        (typeof optimized.featured_image_url === "string" &&
          optimized.featured_image_url.trim()) ||
        null;

      if (existingWpId) {
        featuredMediaId = existingWpId;
      } else {
        // Auto-generate via image LLM when publishing and no image yet
        let imgBytes: Awaited<ReturnType<typeof fetchImageFromUrl>> | null =
          null;

        if (imageUrl) {
          try {
            if (imageUrl.startsWith("data:")) {
              imgBytes = imageFromDataUrl(imageUrl, "featured.png");
            } else {
              imgBytes = await fetchImageFromUrl(imageUrl, {
                allowLocal:
                  isLocalWordPressUrl(site.base_url) ||
                  /pollinations\.ai/i.test(imageUrl),
              });
            }
          } catch (e) {
            featuredImageError =
              e instanceof Error ? e.message : "Gagal unduh featured image";
            console.warn("[publish] featured fetch:", e);
          }
        } else if (autoFeatured) {
          const prompt =
            optimized.featured_image_prompt?.trim() ||
            optimized.title?.trim() ||
            "";
          if (prompt) {
            try {
              const { data: llmSettings } = await supabase
                .from("llm_settings")
                .select("*")
                .eq("workspace_id", article.workspace_id)
                .maybeSingle();
              const resolved = resolveImageSettings(
                llmSettings as Record<string, unknown> | null,
                {
                  model: body.image_model
                    ? String(body.image_model)
                    : undefined,
                  provider: body.image_provider
                    ? String(body.image_provider)
                    : undefined,
                }
              );
              let apiKey: string | null = null;
              if (llmSettings) {
                apiKey =
                  decryptSecret(
                    (llmSettings as { image_api_key?: string }).image_api_key
                  ) ||
                  decryptSecret(
                    (llmSettings as { api_key?: string }).api_key
                  );
              }
              const gen = await generateImage({
                provider: resolved.provider,
                model: resolved.model,
                baseUrl: resolved.baseUrl,
                apiKey,
                prompt,
                size: resolved.size,
                quality: resolved.quality,
              });
              imgBytes = {
                bytes: gen.bytes,
                mimeType: gen.mimeType,
                filename: gen.filename,
              };
              featuredGenerated = true;
            } catch (e) {
              featuredImageError =
                e instanceof Error
                  ? e.message
                  : "Gagal generate featured image";
              console.warn("[publish] featured generate:", e);
            }
          } else {
            featuredImageError =
              "Tidak ada featured image dan featured_image_prompt kosong";
          }
        }

        if (imgBytes) {
          try {
            const prepared = prepareImageForUpload(imgBytes);
            const safeSlug = (optimized.slug || "featured")
              .replace(/[^\w\-]+/g, "-")
              .slice(0, 60);
            const media = await client.uploadMedia(
              `${safeSlug || "featured"}.${prepared.filename.split(".").pop() || "jpg"}`,
              prepared.bytes,
              prepared.mimeType,
              optimized.featured_image_alt || optimized.title || "Featured"
            );
            featuredMediaId = media.id;
            featuredUploaded = true;
            const nextOpt = {
              ...optimized,
              featured_image_url: media.source_url,
              featured_image_wp_media_id: media.id,
            };
            Object.assign(optimized, nextOpt);
            const patch: Record<string, unknown> = {
              optimized: nextOpt,
              featured_image_url: media.source_url,
              featured_image_wp_id: media.id,
            };
            const { error: fiErr } = await supabase
              .from("articles")
              .update(patch)
              .eq("id", id);
            if (fiErr && /featured_image/i.test(fiErr.message)) {
              await supabase
                .from("articles")
                .update({ optimized: nextOpt })
                .eq("id", id);
            }
          } catch (e) {
            featuredImageError =
              e instanceof Error ? e.message : "Upload featured image gagal";
            console.warn("[publish] featured image skip:", e);
          }
        }
      }
    }

    let categoryIds: number[] = [];
    if (optimized.category) {
      const { data: cats } = await supabase
        .from("wordpress_categories")
        .select("wp_id, name")
        .eq("site_id", site.id);

      const match = (cats ?? []).find(
        (c) => c.name.toLowerCase() === optimized.category.toLowerCase()
      );
      if (match) categoryIds = [match.wp_id];
    }

    const tagIds: number[] = [];
    for (const tag of (optimized.tags ?? []).slice(0, 15)) {
      try {
        const tid = await client.findOrCreateTag(tag);
        tagIds.push(tid);
      } catch {
        // skip
      }
    }

    // SEO meta for Yoast SEO + Rank Math (ignored if plugin not installed / not in REST)
    const seoMeta: Record<string, string> = {};
    const metaTitle =
      optimized.meta_title?.trim() || optimized.title?.trim() || "";
    const metaDesc = optimized.meta_description?.trim() || "";
    const focusKw = optimized.primary_keyword?.trim() || "";
    if (metaTitle) {
      seoMeta._yoast_wpseo_title = metaTitle;
      seoMeta.rank_math_title = metaTitle;
    }
    if (metaDesc) {
      seoMeta._yoast_wpseo_metadesc = metaDesc;
      seoMeta.rank_math_description = metaDesc;
    }
    if (focusKw) {
      seoMeta._yoast_wpseo_focuskw = focusKw;
      seoMeta.rank_math_focus_keyword = focusKw;
    }

    const cleanContent = stripAccidentalImageJsonFromContent(
      optimized.content || ""
    );

    const basePayload = {
      title: optimized.title,
      content: cleanContent,
      status,
      excerpt: optimized.excerpt,
      slug: optimized.slug,
      categories: categoryIds.length ? categoryIds : undefined,
      tags: tagIds.length ? tagIds : undefined,
      featured_media: featuredMediaId,
      comment_status: optimized.wordpress?.allow_comments
        ? ("open" as const)
        : ("closed" as const),
      ping_status: optimized.wordpress?.allow_ping
        ? ("open" as const)
        : ("closed" as const),
      ...(wpDate ? { date: wpDate } : {}),
    };

    const payloadWithMeta = {
      ...basePayload,
      ...(Object.keys(seoMeta).length ? { meta: seoMeta } : {}),
    };

    let wpPost;
    let metaApplied = false;
    try {
      if (article.wordpress_post_id) {
        wpPost = await client.updatePost(
          article.wordpress_post_id,
          payloadWithMeta
        );
      } else {
        wpPost = await client.createPost(payloadWithMeta);
      }
      metaApplied = Object.keys(seoMeta).length > 0;
    } catch (wpErr) {
      const message = wpErr instanceof Error ? wpErr.message : String(wpErr);
      // Retry without meta if plugin meta keys rejected by REST
      if (
        Object.keys(seoMeta).length > 0 &&
        /meta|rest_invalid|forbidden|not allowed/i.test(message)
      ) {
        try {
          if (article.wordpress_post_id) {
            wpPost = await client.updatePost(
              article.wordpress_post_id,
              basePayload
            );
          } else {
            wpPost = await client.createPost(basePayload);
          }
          metaApplied = false;
        } catch (retryErr) {
          const msg2 =
            retryErr instanceof Error ? retryErr.message : String(retryErr);
          await supabase.from("publish_logs").insert({
            article_id: id,
            wordpress_site_id: site.id,
            status: "failed",
            request_payload: basePayload,
            error: msg2,
            published_by: user.id,
          });
          return NextResponse.json({ error: msg2 }, { status: 502 });
        }
      } else {
        await supabase.from("publish_logs").insert({
          article_id: id,
          wordpress_site_id: site.id,
          status: "failed",
          request_payload: payloadWithMeta,
          error: message,
          published_by: user.id,
        });
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const articleStatus =
      status === "future"
        ? "scheduled"
        : status === "publish"
          ? "published"
          : status === "draft" || status === "pending"
            ? "ready"
            : "published";

    const articleUpdate: Record<string, unknown> = {
      status: articleStatus,
      wordpress_site_id: site.id,
      wordpress_post_id: wpPost.id,
      wordpress_url: wpPost.link,
      published_by: user.id,
      flagged_for_review: false,
    };

    if (status === "future" && scheduledAtIso) {
      articleUpdate.scheduled_at = scheduledAtIso;
      articleUpdate.published_at = null;
    } else if (status === "publish") {
      articleUpdate.published_at = new Date().toISOString();
      articleUpdate.scheduled_at = null;
    } else {
      // draft/pending on WP — keep not fully published
      articleUpdate.published_at = null;
      articleUpdate.scheduled_at = null;
    }

    // If scheduled_at column missing, retry without it
    let { error: updErr } = await supabase
      .from("articles")
      .update(articleUpdate)
      .eq("id", id);

    if (updErr && /scheduled_at|status/i.test(updErr.message)) {
      // Fallback if migration 005 not applied
      const fallback = {
        status: status === "future" ? "published" : articleStatus,
        wordpress_site_id: site.id,
        wordpress_post_id: wpPost.id,
        wordpress_url: wpPost.link,
        published_at:
          status === "publish" || status === "future"
            ? scheduledAtIso || new Date().toISOString()
            : null,
        published_by: user.id,
        flagged_for_review: false,
      };
      const retry = await supabase
        .from("articles")
        .update(fallback)
        .eq("id", id);
      updErr = retry.error;
    }

    if (updErr) {
      console.warn("[publish] article update warning:", updErr.message);
    }

    await supabase.from("publish_logs").insert({
      article_id: id,
      wordpress_site_id: site.id,
      status: status === "future" ? "scheduled" : "success",
      request_payload: {
        ...basePayload,
        seo_meta: seoMeta,
        seo_meta_applied: metaApplied,
      },
      response_payload: wpPost,
      published_by: user.id,
    });

    if (!wpPost) {
      return NextResponse.json(
        { error: "WordPress tidak mengembalikan post" },
        { status: 502 }
      );
    }

    let siteBase = site.base_url;
    try {
      siteBase = normalizeWordPressBaseUrl(site.base_url);
    } catch {
      /* keep */
    }
    const adminEdit = `${siteBase}/wp-admin/post.php?post=${wpPost.id}&action=edit`;
    const adminList =
      status === "draft"
        ? `${siteBase}/wp-admin/edit.php?post_status=draft&post_type=post`
        : status === "publish"
          ? `${siteBase}/wp-admin/edit.php?post_status=publish&post_type=post`
          : `${siteBase}/wp-admin/edit.php?post_type=post`;

    const isLocal = isLocalWordPressUrl(siteBase);
    const whereNote =
      status === "draft"
        ? "Post tersimpan sebagai DRAFT — buka wp-admin → Posts → Drafts (bukan homepage)."
        : status === "publish"
          ? "Post PUBLISHED — cek link di bawah atau Posts → Published."
          : status === "future"
            ? "Post dijadwalkan (Scheduled) di wp-admin."
            : `Status WP: ${wpPost.status}`;

    return NextResponse.json({
      ok: true,
      wordpress_post_id: wpPost.id,
      wordpress_url: wpPost.link,
      wordpress_edit_url: adminEdit,
      wordpress_admin_list: adminList,
      status: wpPost.status,
      requested_status: status,
      is_local: isLocal,
      scheduled: status === "future",
      scheduled_at: scheduledAtIso,
      seo_meta_applied: metaApplied,
      featured_media: featuredMediaId ?? null,
      featured_image_uploaded: featuredUploaded,
      featured_image_generated: featuredGenerated,
      featured_image_error: featuredImageError,
      where_to_look: whereNote,
      message: (() => {
        const base =
          status === "future"
            ? `Dijadwalkan di WordPress: ${wpDate}`
            : status === "publish"
              ? "Langsung dipublish ke WordPress"
              : status === "draft"
                ? "Tersimpan sebagai DRAFT di WordPress (cek Posts → Drafts)"
                : `Tersimpan sebagai ${status}`;
        if (featuredUploaded && featuredGenerated) {
          return `${base}. Featured image di-generate & diunggah ke Media WP (#${featuredMediaId}).`;
        }
        if (featuredUploaded) {
          return `${base}. Featured image diunggah ke Media WP (#${featuredMediaId}).`;
        }
        if (featuredMediaId) {
          return `${base}. Featured image memakai media WP #${featuredMediaId}.`;
        }
        if (featuredImageError) {
          return `${base}. (Featured image dilewati: ${featuredImageError})`;
        }
        return base;
      })(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
