import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/lib/llm/provider";
import { validateOptimizedOutput } from "@/lib/validator/post-process";
import type { OptimizedArticle } from "@/lib/types";
import { decryptSecret } from "@/lib/crypto/secrets";
import { computeSimilarity } from "@/lib/text/similarity";

async function resolvePromptTemplate(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: {
    templateId?: string | null;
    promptVersion?: number | null;
  }
) {
  if (opts.templateId) {
    const { data } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", opts.templateId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (data) return data;
  }

  if (opts.promptVersion != null) {
    const { data } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("version", opts.promptVersion)
      .maybeSingle();
    if (data) return data;
  }

  const { data: active } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  return active;
}

type JobMeta = {
  prompt_template_id?: string | null;
  model?: string | null;
  mode?: "optimize" | "paraphrase" | null;
  source_url?: string | null;
};

/**
 * Process an optimize job with claim-lock + in-process retries.
 * Safe to call concurrently — only one worker claims a queued job.
 */
export async function processOptimizeJob(
  supabase: SupabaseClient,
  jobId: string,
  options?: { promptTemplateId?: string | null }
): Promise<void> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`Job tidak ditemukan: ${jobId}`);
  }

  if (job.status === "completed") return;
  if (job.status === "failed" && (job.attempts ?? 0) >= (job.max_attempts ?? 3)) {
    return;
  }

  // Claim: only transition from queued → running (or re-enter if already running this process)
  if (job.status === "queued") {
    const { data: claimed, error: claimErr } = await supabase
      .from("jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobId)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) {
      // Another worker claimed it
      return;
    }
  }

  const maxAttempts = job.max_attempts ?? 3;
  let attempts = job.attempts ?? 0;
  let lastError = "";

  const meta = (job.request_meta ?? {}) as JobMeta;
  const templateIdFromMeta =
    options?.promptTemplateId ??
    meta.prompt_template_id ??
    null;
  const modelOverride =
    (typeof job.llm_model === "string" && job.llm_model.trim()
      ? job.llm_model.trim()
      : null) ||
    (typeof meta.model === "string" && meta.model.trim()
      ? meta.model.trim()
      : null);

  await supabase
    .from("articles")
    .update({ status: "processing" })
    .eq("id", job.article_id);

  while (attempts < maxAttempts) {
    attempts += 1;

    await supabase
      .from("jobs")
      .update({
        status: "running",
        attempts,
        started_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobId);

    try {
      const { data: article, error: articleError } = await supabase
        .from("articles")
        .select("*")
        .eq("id", job.article_id)
        .single();

      if (articleError || !article) {
        throw new Error("Artikel tidak ditemukan");
      }

      const { data: settings } = await supabase
        .from("llm_settings")
        .select("*")
        .eq("workspace_id", job.workspace_id)
        .maybeSingle();

      const promptTpl = await resolvePromptTemplate(
        supabase,
        job.workspace_id,
        {
          templateId: templateIdFromMeta,
          promptVersion: job.prompt_version,
        }
      );

      if (!promptTpl?.system_prompt) {
        throw new Error(
          "Prompt template tidak ditemukan. Pilih template di form optimasi atau aktifkan di Settings."
        );
      }

      const provider = (settings?.provider ?? "omniroute") as string;
      const maxTokens = Math.min(Number(settings?.max_tokens ?? 4096), 4096);
      const model =
        modelOverride || settings?.model || "auto/best-fast";
      const fallback =
        settings?.fallback_provider && settings?.fallback_model
          ? {
              provider: settings.fallback_provider as string,
              model: settings.fallback_model as string,
              baseUrl: settings.fallback_base_url ?? null,
              apiKey: decryptSecret(settings.fallback_api_key) ?? null,
            }
          : null;

      const processMode =
        meta.mode === "paraphrase" ? "paraphrase" : "optimize";
      const sourceUrl =
        (typeof meta.source_url === "string" && meta.source_url) ||
        (typeof article.source_url === "string" && article.source_url) ||
        null;

      // Parafrase: slightly higher temperature for variety unless user set custom
      const baseTemp = Number(settings?.temperature ?? 0.2);
      const temperature =
        processMode === "paraphrase"
          ? Math.min(Math.max(baseTemp, 0.32), 0.55)
          : baseTemp;

      const llmResult = await generateWithFallback(
        {
          provider,
          model,
          baseUrl: settings?.base_url ?? null,
          apiKey: decryptSecret(settings?.api_key) ?? null,
          useJsonMode: settings?.use_json_mode ?? true,
          temperature,
          maxTokens,
          topP: Number(settings?.top_p ?? 0.9),
          systemPrompt: promptTpl.system_prompt,
          rawDraft: article.raw_draft,
          categories: article.categories_input ?? [],
          promptVersion: String(promptTpl.version ?? 1),
          mode: processMode,
          sourceUrl,
        },
        fallback
      );

      const validation = validateOptimizedOutput(
        llmResult.data,
        article.raw_draft
      );

      if (!validation.valid || !validation.data) {
        throw new Error(
          `Validasi gagal: ${validation.errors.join("; ") || "unknown"}`
        );
      }

      const optimized: OptimizedArticle = validation.data;

      // Similarity vs source (useful for paraphrase; also shown for optimize)
      const sim = computeSimilarity(
        article.raw_draft,
        `${optimized.title}\n${optimized.content}`
      );
      const flagReasons = [...(validation.flag_reasons ?? [])];
      let flagged = validation.flagged_for_review;
      if (processMode === "paraphrase" && sim.verdict === "near_duplicate") {
        flagged = true;
        flagReasons.push(
          `Parafrase hampir duplikat (similarity ${sim.similarity}%) — periksa ulang atau jalankan ulang`
        );
      }

      optimized.meta_processing = {
        ...optimized.meta_processing,
        prompt_version: `${promptTpl.name}@v${promptTpl.version}`,
        llm_provider: llmResult.provider,
        llm_model: llmResult.model,
        processed_at: new Date().toISOString(),
        mode: processMode,
        similarity: {
          score: sim.similarity,
          originality: sim.originality,
          verdict: sim.verdict,
          method: sim.method,
          token_jaccard: sim.token_jaccard,
          trigram_jaccard: sim.trigram_jaccard,
        },
      };

      const status = flagged ? "flagged" : "ready";

      await supabase
        .from("articles")
        .update({
          title: optimized.title,
          optimized,
          status,
          flagged_for_review: flagged,
          flag_reasons: flagReasons,
        })
        .eq("id", article.id);

      const { count } = await supabase
        .from("article_versions")
        .select("*", { count: "exact", head: true })
        .eq("article_id", article.id);

      await supabase.from("article_versions").insert({
        article_id: article.id,
        version: (count ?? 0) + 1,
        optimized,
        change_note: `LLM ${processMode} · template ${promptTpl.name} v${promptTpl.version} · ${llmResult.model}`,
      });

      await supabase
        .from("jobs")
        .update({
          status: "completed",
          result: optimized,
          llm_provider: llmResult.provider,
          llm_model: llmResult.model,
          prompt_version: promptTpl.version ?? 1,
          completed_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", jobId);

      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[job ${jobId}] attempt ${attempts}/${maxAttempts} failed: ${lastError}`
      );

      await supabase
        .from("jobs")
        .update({
          status: attempts >= maxAttempts ? "failed" : "running",
          error: lastError,
          attempts,
        })
        .eq("id", jobId);

      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempts));
      }
    }
  }

  await supabase
    .from("jobs")
    .update({
      status: "failed",
      error: lastError || "Gagal setelah semua percobaan",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await supabase
    .from("articles")
    .update({ status: "failed" })
    .eq("id", job.article_id);

  throw new Error(lastError || "Optimize job failed");
}
