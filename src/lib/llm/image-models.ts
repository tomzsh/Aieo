/**
 * Catalog of image-capable models + helpers to filter remote model lists.
 * Not every chat model can generate images — quality & edit support vary.
 */

export type ImageModelPreset = {
  id: string;
  label: string;
  /** Suggested provider id in Aieo */
  providerHint: string;
  /** Supports OpenAI-style /images/edits */
  supportsEdit: boolean;
  /** Free / no API key path */
  free?: boolean;
  /** Notes for UI */
  note?: string;
  sizes?: string[];
};

/** Curated presets shown even if /models doesn't list them */
export const IMAGE_MODEL_PRESETS: ImageModelPreset[] = [
  {
    id: "dall-e-3",
    label: "DALL·E 3 (OpenAI)",
    providerHint: "openai",
    supportsEdit: false,
    note: "Kualitas tinggi, text-to-image only",
    sizes: ["1024x1024", "1792x1024", "1024x1792"],
  },
  {
    id: "dall-e-2",
    label: "DALL·E 2 (OpenAI, edit)",
    providerHint: "openai",
    supportsEdit: true,
    note: "Mendukung image edit / variation",
    sizes: ["256x256", "512x512", "1024x1024"],
  },
  {
    id: "gpt-image-1",
    label: "GPT Image 1 (OpenAI)",
    providerHint: "openai",
    supportsEdit: true,
    note: "Generate + edit (butuh akses model image)",
    sizes: ["1024x1024", "1536x1024", "1024x1536"],
  },
  {
    id: "black-forest-labs/FLUX.1-schnell-Free",
    label: "FLUX.1 Schnell (Together free tier)",
    providerHint: "together",
    supportsEdit: false,
    note: "Cepat; cek ketersediaan di Together",
    sizes: ["1024x1024"],
  },
  {
    id: "black-forest-labs/FLUX.1-dev",
    label: "FLUX.1 Dev (Together)",
    providerHint: "together",
    supportsEdit: false,
    sizes: ["1024x1024"],
  },
  {
    id: "pollinations/flux",
    label: "Pollinations Flux (gratis)",
    providerHint: "pollinations",
    supportsEdit: false,
    free: true,
    note: "Tanpa API key — kualitas bervariasi, tidak support edit",
    sizes: ["1280x720", "1024x1024"],
  },
  {
    id: "pollinations/turbo",
    label: "Pollinations Turbo (gratis)",
    providerHint: "pollinations",
    supportsEdit: false,
    free: true,
    note: "Cepat, gratis",
    sizes: ["1280x720", "1024x1024"],
  },
];

/** Heuristic: model id looks like an image model */
const IMAGE_MODEL_RE =
  /image|dall-?e|dalle|flux|sdxl|stable.?diff|imagen|gpt-image|midjourney|recraft|ideogram|kandinsky|wanx|firefly|seedream|kolors|playground|photon|nova-canvas|canvas|img2img|text.?to.?image|t2i|i2i|diffusion|dreamshaper|juggernaut|realvis|pixart|aura-flow|hidream|luma|runway|gemini-.*image|grok-.*image/i;

/** Chat-only models that must not be offered for image gen */
const CHAT_ONLY_RE =
  /^(gpt-4|gpt-3|o1|o3|o4|claude|gemini-2\.|gemini-1|llama|mistral|mixtral|deepseek|qwen|kimi|sonar|command-r|grok-4|grok-3|grok-2)(?!.*image)/i;

export function looksLikeImageModel(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  if (IMAGE_MODEL_RE.test(id)) return true;
  // OpenRouter style: provider/name with image keywords already covered
  return false;
}

export function filterImageModels(
  models: Array<{ id: string; owned_by?: string | null }>
): Array<{ id: string; owned_by?: string | null; likely_image: boolean }> {
  return models
    .filter((m) => looksLikeImageModel(m.id) && !CHAT_ONLY_RE.test(m.id))
    .map((m) => ({ ...m, likely_image: true }));
}

export function getImagePreset(modelId: string): ImageModelPreset | undefined {
  const id = modelId.trim();
  return IMAGE_MODEL_PRESETS.find(
    (p) => p.id === id || p.id.toLowerCase() === id.toLowerCase()
  );
}

export function isPollinationsModel(modelId: string, provider?: string): boolean {
  if (provider === "pollinations") return true;
  return /^pollinations\//i.test(modelId.trim());
}

export function pollinationsStyle(modelId: string): string {
  // pollinations/flux → flux
  const m = modelId.trim().match(/^pollinations\/(.+)$/i);
  return m?.[1] || "flux";
}

export const DEFAULT_IMAGE_SIZES = [
  "1024x1024",
  "1280x720",
  "1792x1024",
  "1024x1792",
  "512x512",
] as const;
