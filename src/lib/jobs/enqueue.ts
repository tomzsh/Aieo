import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processOptimizeJob } from "@/lib/jobs/optimize";
import {
  PROMPT_TEMPLATE_V4_NAME,
  PROMPT_TEMPLATE_V4_SYSTEM,
} from "@/lib/llm/prompt";

export type ProcessMode = "optimize" | "paraphrase";

export type EnqueueOptimizeInput = {
  workspaceId: string;
  userId: string;
  rawDraft: string;
  title?: string | null;
  categories?: string[];
  promptTemplateId?: string | null;
  /** Override workspace default model for this job */
  model?: string | null;
  sourceUrl?: string | null;
  sourceType?: "paste" | "url" | "rss" | "batch" | null;
  batchId?: string | null;
  /** optimize (default) | paraphrase */
  mode?: ProcessMode;
};

export type EnqueuedJob = {
  job_id: string;
  article_id: string;
  status: string;
  mode: ProcessMode;
  prompt_template: { id: string; name: string; version: number } | null;
};

async function resolveTemplate(
  db: SupabaseClient,
  workspaceId: string,
  promptTemplateId?: string | null
) {
  let q = db
    .from("prompt_templates")
    .select("id, version, name, is_active")
    .eq("workspace_id", workspaceId);

  if (promptTemplateId) q = q.eq("id", promptTemplateId);
  else q = q.eq("is_active", true);

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Ensure paraphrase-v4 template exists in workspace (does not force-activate).
 */
export async function ensureParaphraseTemplate(
  db: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<{ id: string; version: number; name: string; is_active: boolean }> {
  const { data: existing } = await db
    .from("prompt_templates")
    .select("id, version, name, is_active")
    .eq("workspace_id", workspaceId)
    .eq("name", PROMPT_TEMPLATE_V4_NAME)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: latest } = await db
    .from("prompt_templates")
    .select("version")
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data, error } = await db
    .from("prompt_templates")
    .insert({
      workspace_id: workspaceId,
      version: nextVersion,
      name: PROMPT_TEMPLATE_V4_NAME,
      system_prompt: PROMPT_TEMPLATE_V4_SYSTEM,
      is_active: false,
      created_by: userId,
    })
    .select("id, version, name, is_active")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "Gagal menyiapkan template parafrase"
    );
  }
  return data;
}

/**
 * Create article + queued job, then schedule processing (after + durable pickup).
 */
export async function enqueueOptimize(
  db: SupabaseClient,
  input: EnqueueOptimizeInput
): Promise<EnqueuedJob> {
  const rawDraft = input.rawDraft.trim();
  if (rawDraft.length < 50) {
    throw new Error("Draf artikel wajib diisi (min. 50 karakter).");
  }

  const mode: ProcessMode =
    input.mode === "paraphrase" ? "paraphrase" : "optimize";

  let template =
    mode === "paraphrase"
      ? await ensureParaphraseTemplate(db, input.workspaceId, input.userId)
      : await resolveTemplate(db, input.workspaceId, input.promptTemplateId);

  // Allow explicit template override even in paraphrase (advanced)
  if (mode === "paraphrase" && input.promptTemplateId) {
    const override = await resolveTemplate(
      db,
      input.workspaceId,
      input.promptTemplateId
    );
    if (override) template = override;
  }

  if (!template) {
    throw new Error(
      input.promptTemplateId
        ? "Template yang dipilih tidak ditemukan."
        : "Belum ada prompt template aktif. Impor preset di Settings → Prompt."
    );
  }

  const articleRow: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    created_by: input.userId,
    title: input.title?.trim() || rawDraft.slice(0, 80),
    raw_draft: rawDraft,
    categories_input: input.categories ?? [],
    status: "processing",
  };
  if (input.sourceUrl) articleRow.source_url = input.sourceUrl;
  if (input.sourceType) articleRow.source_type = input.sourceType;

  let article: { id: string } | null = null;
  let articleError: { message: string } | null = null;

  {
    const res = await db.from("articles").insert(articleRow).select("id").single();
    article = res.data;
    articleError = res.error;
    // Fallback if source_* columns missing (migration 006 not applied)
    if (articleError && /source_/i.test(articleError.message)) {
      delete articleRow.source_url;
      delete articleRow.source_type;
      const retry = await db
        .from("articles")
        .insert(articleRow)
        .select("id")
        .single();
      article = retry.data;
      articleError = retry.error;
    }
  }

  if (articleError || !article) {
    throw new Error(articleError?.message ?? "Gagal membuat artikel");
  }

  const requestMeta = {
    prompt_template_id: template.id,
    model: input.model || null,
    source_url: input.sourceUrl || null,
    source_type: input.sourceType || null,
    batch_id: input.batchId || null,
    mode,
  };

  const jobRow: Record<string, unknown> = {
    workspace_id: input.workspaceId,
    article_id: article.id,
    type: "optimize",
    status: "queued",
    attempts: 0,
    max_attempts: 3,
    prompt_version: template.version,
    llm_model: input.model || null,
    request_meta: requestMeta,
  };

  let job: { id: string; status: string } | null = null;
  let jobError: { message: string } | null = null;

  {
    const res = await db.from("jobs").insert(jobRow).select("id, status").single();
    job = res.data;
    jobError = res.error;
    if (jobError && /request_meta/i.test(jobError.message)) {
      delete jobRow.request_meta;
      const retry = await db
        .from("jobs")
        .insert(jobRow)
        .select("id, status")
        .single();
      job = retry.data;
      jobError = retry.error;
    }
  }

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Gagal membuat job");
  }

  scheduleJobProcessing(job.id, template.id);

  return {
    job_id: job.id,
    article_id: article.id,
    status: job.status,
    mode,
    prompt_template: {
      id: template.id,
      name: template.name,
      version: template.version,
    },
  };
}

/** Fire-and-forget processing; safe to call multiple times (claim lock inside). */
export function scheduleJobProcessing(
  jobId: string,
  promptTemplateId?: string | null
) {
  after(async () => {
    try {
      const sb = createServiceClient();
      await processOptimizeJob(sb, jobId, {
        promptTemplateId: promptTemplateId ?? undefined,
      });
    } catch (e) {
      console.error("[scheduleJobProcessing]", jobId, e);
    }
  });
}
