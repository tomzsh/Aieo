import type { LlmProvider } from "@/lib/types";

export interface ProviderDefinition {
  id: LlmProvider;
  label: string;
  /** Default OpenAI-compatible base URL (may be overridden) */
  defaultBaseUrl?: string;
  /** Suggested default model id */
  defaultModel: string;
  /** Env var name for API key */
  envApiKey?: string;
  /** Env var name for base URL override */
  envBaseUrl?: string;
  /** Placeholder when key is optional (local) */
  allowEmptyKey?: boolean;
  /** Whether json_object mode usually works */
  supportsJsonMode?: boolean;
  /** Short help text for the settings UI */
  help?: string;
  /** Group for UI */
  group: "first_party" | "third_party" | "local" | "custom";
}

/**
 * Catalog of built-in + third-party OpenAI-compatible providers.
 * Custom endpoint uses provider id "custom" with free-form base_url.
 */
export const LLM_PROVIDERS: ProviderDefinition[] = [
  {
    id: "xai",
    label: "xAI (Grok)",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.5",
    envApiKey: "XAI_API_KEY",
    envBaseUrl: "XAI_BASE_URL",
    supportsJsonMode: true,
    group: "first_party",
    help: "Default Aieo. OpenAI-compatible API.",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    envApiKey: "OPENAI_API_KEY",
    envBaseUrl: "OPENAI_BASE_URL",
    supportsJsonMode: true,
    group: "first_party",
  },
  {
    id: "anthropic",
    label: "Anthropic (compatible proxy)",
    defaultBaseUrl: undefined,
    defaultModel: "anthropic/claude-sonnet-4",
    envApiKey: "ANTHROPIC_API_KEY",
    envBaseUrl: "ANTHROPIC_BASE_URL",
    supportsJsonMode: true,
    group: "first_party",
    help: "Pakai OpenRouter / LiteLLM / proxy OpenAI-compatible. Isi Base URL jika tidak lewat OpenRouter.",
  },
  {
    id: "google",
    label: "Google Gemini (compatible proxy)",
    defaultBaseUrl: undefined,
    defaultModel: "google/gemini-2.0-flash",
    envApiKey: "GOOGLE_API_KEY",
    envBaseUrl: "GOOGLE_BASE_URL",
    supportsJsonMode: true,
    group: "first_party",
    help: "Pakai OpenRouter / LiteLLM / proxy OpenAI-compatible.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4",
    envApiKey: "OPENROUTER_API_KEY",
    envBaseUrl: "OPENROUTER_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
    help: "Router multi-model (Claude, GPT, Gemini, dll).",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    envApiKey: "DEEPSEEK_API_KEY",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
  },
  {
    id: "groq",
    label: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    envApiKey: "GROQ_API_KEY",
    envBaseUrl: "GROQ_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
  },
  {
    id: "together",
    label: "Together AI",
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    envApiKey: "TOGETHER_API_KEY",
    envBaseUrl: "TOGETHER_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    envApiKey: "MISTRAL_API_KEY",
    envBaseUrl: "MISTRAL_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    envApiKey: "FIREWORKS_API_KEY",
    envBaseUrl: "FIREWORKS_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    defaultBaseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    envApiKey: "PERPLEXITY_API_KEY",
    envBaseUrl: "PERPLEXITY_BASE_URL",
    supportsJsonMode: false,
    group: "third_party",
    help: "Beberapa model Perplexity tidak mendukung json_object mode — matikan JSON mode jika error.",
  },
  {
    id: "litellm",
    label: "LiteLLM Proxy",
    defaultBaseUrl: "http://127.0.0.1:4000/v1",
    defaultModel: "gpt-4o-mini",
    envApiKey: "LITELLM_API_KEY",
    envBaseUrl: "LITELLM_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
    help: "Proxy lokal/self-host yang me-route ke banyak provider.",
  },
  {
    id: "dahl",
    label: "Dahl Global Inference",
    defaultBaseUrl: "https://inference.dahl.global/v1",
    defaultModel: "moonshotai/Kimi-K2.6",
    envApiKey: "DAHL_API_KEY",
    envBaseUrl: "DAHL_BASE_URL",
    supportsJsonMode: true,
    group: "third_party",
    help: "OpenAI-compatible gateway (inference.dahl.global). Default model: moonshotai/Kimi-K2.6.",
  },
  {
    id: "omniroute",
    label: "OmniRoute (local gateway)",
    defaultBaseUrl: "http://127.0.0.1:20128/v1",
    defaultModel: "auto/best-coding",
    envApiKey: "OMNIROUTE_API_KEY",
    envBaseUrl: "OMNIROUTE_BASE_URL",
    allowEmptyKey: true,
    supportsJsonMode: true,
    group: "local",
    help: "Local AI gateway OpenAI-compatible (default http://127.0.0.1:20128/v1). Contoh model: auto/best-coding, auto/best-reasoning. API key opsional (dashboard key OmniRoute).",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2",
    envApiKey: "OLLAMA_API_KEY",
    envBaseUrl: "OLLAMA_BASE_URL",
    allowEmptyKey: true,
    supportsJsonMode: true,
    group: "local",
    help: "Model lokal. Base URL default http://127.0.0.1:11434/v1",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    defaultModel: "local-model",
    envApiKey: "LMSTUDIO_API_KEY",
    envBaseUrl: "LMSTUDIO_BASE_URL",
    allowEmptyKey: true,
    supportsJsonMode: true,
    group: "local",
    help: "LM Studio local server (default http://127.0.0.1:1234/v1). API key biasanya tidak diperlukan.",
  },
  {
    id: "custom",
    label: "Custom endpoint (OpenAI-compatible)",
    defaultBaseUrl: undefined,
    defaultModel: "",
    envApiKey: "CUSTOM_LLM_API_KEY",
    envBaseUrl: "CUSTOM_LLM_BASE_URL",
    allowEmptyKey: true,
    supportsJsonMode: true,
    group: "custom",
    help: "Endpoint OpenAI-compatible apa pun: vLLM, Azure OpenAI proxy, gateway internal, dll. Wajib isi Base URL.",
  },
];

export const PROVIDER_MAP = Object.fromEntries(
  LLM_PROVIDERS.map((p) => [p.id, p])
) as Record<LlmProvider, ProviderDefinition>;

export function getProviderDef(id: string): ProviderDefinition | undefined {
  return PROVIDER_MAP[id as LlmProvider];
}

export function isKnownProvider(id: string): id is LlmProvider {
  return id in PROVIDER_MAP;
}

export function normalizeBaseUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}
