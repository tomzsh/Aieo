import OpenAI from "openai";
import type { LlmProvider, OptimizedArticle } from "@/lib/types";
import { optimizedArticleSchema } from "./schema";
import {
  buildCorrectivePrompt,
  buildUserPrompt,
  DEFAULT_SYSTEM_PROMPT,
} from "./prompt";
import {
  getProviderDef,
  normalizeBaseUrl,
  PROVIDER_MAP,
} from "./providers-catalog";

export interface LlmConnection {
  provider: LlmProvider | string;
  model: string;
  /** Override / custom OpenAI-compatible base URL */
  baseUrl?: string | null;
  /** Override API key (workspace secret); falls back to env */
  apiKey?: string | null;
  /** Send response_format json_object when supported */
  useJsonMode?: boolean;
}

export interface LlmGenerateParams extends LlmConnection {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;
  rawDraft: string;
  categories: string[];
  promptVersion?: string;
  /** optimize = SEO editor; paraphrase = rewrite kuat */
  mode?: "optimize" | "paraphrase";
  sourceUrl?: string | null;
}

export interface LlmGenerateResult {
  data: OptimizedArticle;
  raw: string;
  provider: string;
  model: string;
  baseUrl?: string;
}

function resolveApiKey(
  provider: string,
  overrideKey?: string | null
): string {
  if (overrideKey?.trim()) return overrideKey.trim();

  const def = getProviderDef(provider);
  if (def?.envApiKey) {
    const fromEnv = process.env[def.envApiKey];
    if (fromEnv) return fromEnv;
  }

  // Generic fallbacks
  const upper = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const generic =
    process.env[`${upper}_API_KEY`] ??
    process.env.CUSTOM_LLM_API_KEY ??
    process.env.LLM_API_KEY ??
    "";

  if (
    def?.allowEmptyKey ||
    provider === "custom" ||
    provider === "ollama" ||
    provider === "omniroute" ||
    provider === "lmstudio"
  ) {
    return generic || "not-needed";
  }

  return generic;
}

function resolveBaseUrl(
  provider: string,
  overrideUrl?: string | null
): string | undefined {
  const fromOverride = normalizeBaseUrl(overrideUrl ?? undefined);
  if (fromOverride) return fromOverride;

  const def = getProviderDef(provider);
  if (def?.envBaseUrl) {
    const fromEnv = normalizeBaseUrl(process.env[def.envBaseUrl]);
    if (fromEnv) return fromEnv;
  }

  const upper = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const envGeneric = normalizeBaseUrl(
    process.env[`${upper}_BASE_URL`] ??
      process.env.CUSTOM_LLM_BASE_URL ??
      process.env.LLM_BASE_URL
  );
  if (envGeneric) return envGeneric;

  // Anthropic / Google without explicit URL → try OpenRouter as gateway
  if (
    (provider === "anthropic" || provider === "google") &&
    process.env.OPENROUTER_API_KEY
  ) {
    return "https://openrouter.ai/api/v1";
  }

  return def?.defaultBaseUrl;
}

export function createLlmClient(conn: LlmConnection): {
  client: OpenAI;
  baseUrl: string | undefined;
  model: string;
  useJsonMode: boolean;
} {
  const provider = conn.provider || "xai";
  const def = getProviderDef(provider);
  const baseURL = resolveBaseUrl(provider, conn.baseUrl);
  const apiKey = resolveApiKey(provider, conn.apiKey);

  if (provider === "custom" && !baseURL) {
    throw new Error(
      'Provider "custom" membutuhkan Base URL (OpenAI-compatible), mis. https://gateway.example.com/v1'
    );
  }

  const localNoKey =
    def?.allowEmptyKey ||
    provider === "custom" ||
    provider === "ollama" ||
    provider === "omniroute" ||
    provider === "lmstudio";

  if (!apiKey || (apiKey === "not-needed" && !localNoKey)) {
    const envHint = def?.envApiKey ?? `${provider.toUpperCase()}_API_KEY`;
    throw new Error(
      `API key tidak dikonfigurasi untuk provider "${provider}". Isi di Settings LLM atau set env ${envHint}.`
    );
  }

  if (!baseURL && (provider === "anthropic" || provider === "google")) {
    throw new Error(
      `Provider "${provider}" membutuhkan Base URL OpenAI-compatible, OpenRouter, atau LiteLLM.`
    );
  }

  const useJsonMode =
    conn.useJsonMode ?? def?.supportsJsonMode ?? true;

  // Local gateways (OmniRoute/Ollama) can be slow on big models; Dahl often 524 ~100s.
  const timeoutMs = Number(
    process.env.LLM_TIMEOUT_MS ??
      (provider === "omniroute" ||
      provider === "ollama" ||
      provider === "lmstudio" ||
      provider === "custom"
        ? 300_000
        : provider === "dahl"
          ? 180_000
          : 120_000)
  );

  const client = new OpenAI({
    apiKey: apiKey === "not-needed" ? "ollama" : apiKey,
    baseURL,
    timeout: timeoutMs,
    maxRetries: 1,
    defaultHeaders:
      provider === "openrouter"
        ? {
            "HTTP-Referer":
              process.env.OPENROUTER_HTTP_REFERER ?? "https://aieo.local",
            "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Aieo",
          }
        : undefined,
  });

  return {
    client,
    baseUrl: baseURL,
    model: conn.model || def?.defaultModel || "gpt-4o-mini",
    useJsonMode,
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

async function callModel(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  params: {
    temperature: number;
    maxTokens: number;
    topP: number;
    useJsonMode: boolean;
  }
): Promise<string> {
  const baseBody = {
    model,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
  };

  try {
    const response = await client.chat.completions.create({
      ...baseBody,
      ...(params.useJsonMode
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LLM mengembalikan respons kosong");
    return content;
  } catch (err) {
    // Retry without json_object if gateway rejects response_format
    if (params.useJsonMode) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /response_format|json_object|unsupported|invalid.*format/i.test(msg)
      ) {
        const response = await client.chat.completions.create(baseBody);
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("LLM mengembalikan respons kosong");
        return content;
      }
    }
    throw err;
  }
}

/**
 * LLM Abstraction Layer — multi-provider + custom OpenAI-compatible endpoints.
 */
export async function generateOptimizedArticle(
  params: LlmGenerateParams
): Promise<LlmGenerateResult> {
  const isParaphrase = params.mode === "paraphrase";
  // Parafrase slightly higher temp for lexical variety; still capped
  const temperature = Math.min(
    params.temperature ?? (isParaphrase ? 0.35 : 0.2),
    isParaphrase ? 0.55 : 0.5
  );
  const maxTokens = params.maxTokens ?? 8192;
  const topP = params.topP ?? 0.9;
  const systemPrompt = params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt({
    rawDraft: params.rawDraft,
    categories: params.categories,
    mode: params.mode,
    sourceUrl: params.sourceUrl,
  });

  const { client, baseUrl, model, useJsonMode } = createLlmClient(params);

  let raw = await callModel(client, model, systemPrompt, userPrompt, {
    temperature,
    maxTokens,
    topP,
    useJsonMode,
  });

  let parsed = tryParse(raw);

  if (!parsed.success) {
    const corrective = buildCorrectivePrompt(
      params.rawDraft,
      raw,
      parsed.errors
    );
    raw = await callModel(client, model, systemPrompt, corrective, {
      temperature: Math.min(temperature, 0.15),
      maxTokens,
      topP,
      useJsonMode,
    });
    parsed = tryParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Gagal mem-parse JSON dari LLM: ${parsed.errors.join("; ")}`
      );
    }
  }

  const data = parsed.data as OptimizedArticle;
  data.meta_processing = {
    llm_provider: String(params.provider),
    llm_model: model,
    prompt_version: params.promptVersion ?? "1",
    processed_at: new Date().toISOString(),
  };

  return {
    data,
    raw,
    provider: String(params.provider),
    model,
    baseUrl,
  };
}

function tryParse(
  raw: string
):
  | { success: true; data: OptimizedArticle }
  | { success: false; errors: string[] } {
  try {
    const json = JSON.parse(extractJson(raw));
    const result = optimizedArticleSchema.safeParse(json);
    if (!result.success) {
      return {
        success: false,
        errors: result.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`
        ),
      };
    }
    return { success: true, data: result.data as OptimizedArticle };
  } catch (e) {
    return {
      success: false,
      errors: [e instanceof Error ? e.message : "Invalid JSON"],
    };
  }
}

export type FallbackConnection = Partial<LlmConnection> & {
  provider: LlmProvider | string;
  model: string;
};

/** Generate with primary + optional fallback connection */
export async function generateWithFallback(
  primary: LlmGenerateParams,
  fallback?: FallbackConnection | null
): Promise<LlmGenerateResult> {
  try {
    return await generateOptimizedArticle(primary);
  } catch (primaryError) {
    if (!fallback?.provider || !fallback.model) {
      throw primaryError;
    }
    console.warn(
      `[llm] Primary ${primary.provider}/${primary.model} failed, trying fallback ${fallback.provider}/${fallback.model}`,
      primaryError
    );
    return generateOptimizedArticle({
      ...primary,
      provider: fallback.provider,
      model: fallback.model,
      baseUrl: fallback.baseUrl ?? null,
      apiKey: fallback.apiKey ?? null,
      useJsonMode: fallback.useJsonMode ?? primary.useJsonMode,
    });
  }
}

/** Public list for API / UI */
export function listProviders() {
  return Object.values(PROVIDER_MAP).map((p) => ({
    id: p.id,
    label: p.label,
    defaultBaseUrl: p.defaultBaseUrl ?? null,
    defaultModel: p.defaultModel,
    envApiKey: p.envApiKey ?? null,
    group: p.group,
    supportsJsonMode: p.supportsJsonMode ?? true,
    help: p.help ?? null,
    requiresBaseUrl: p.id === "custom" || !p.defaultBaseUrl,
  }));
}
