import OpenAI, { toFile } from "openai";
import { createLlmClient, type LlmConnection } from "@/lib/llm/provider";
import {
  assertRealImageBytes,
  fetchImageFromUrl,
  type ImageBytes,
} from "@/lib/wordpress/featured-image";
import {
  getImagePreset,
  isPollinationsModel,
  pollinationsStyle,
} from "@/lib/llm/image-models";

export type ImageGenParams = {
  provider: string;
  model: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  prompt: string;
  /** e.g. 1024x1024 */
  size?: string;
  /** standard | hd | high | medium | low (depends on model) */
  quality?: string;
  /**
   * Optional reference image for edit / image-to-image.
   * Uses OpenAI /images/edits when supported.
   */
  reference?: ImageBytes | null;
};

export type ImageGenResult = ImageBytes & {
  revised_prompt?: string;
  source: "openai_images" | "openai_edits" | "pollinations";
  model: string;
  provider: string;
};

function parseSize(size?: string): string {
  const s = (size || "1024x1024").trim();
  if (/^\d{2,4}x\d{2,4}$/i.test(s)) return s;
  return "1024x1024";
}

function b64ToImageBytes(
  b64: string,
  mimeType = "image/png",
  filename = "generated.png"
): ImageBytes {
  const bin = Buffer.from(b64, "base64");
  const bytes = bin.buffer.slice(
    bin.byteOffset,
    bin.byteOffset + bin.byteLength
  );
  const real = assertRealImageBytes(bytes, "LLM image response");
  void mimeType;
  const ext = real.includes("png")
    ? "png"
    : real.includes("webp")
      ? "webp"
      : real.includes("gif")
        ? "gif"
        : "jpg";
  return {
    bytes,
    mimeType: real,
    filename: filename.replace(/\.[^.]+$/, "") + `.${ext}`,
  };
}

async function fetchUrlToBytes(url: string): Promise<ImageBytes> {
  return fetchImageFromUrl(url, { allowLocal: false });
}

/**
 * Free Pollinations path (text-to-image only).
 * Validates binary is a real image (never upload JSON error bodies to WP).
 */
async function generatePollinations(
  prompt: string,
  modelId: string,
  size?: string
): Promise<ImageGenResult> {
  const style = pollinationsStyle(modelId);
  // Prefer flux; "sana" often rate-limits and previously returned JSON metadata
  const model =
    !style || style === "sana" || style === "default" ? "flux" : style;
  const [w, h] = parseSize(size || "1280x720").split("x").map(Number);
  const width = Number.isFinite(w) && w >= 256 ? Math.min(w, 1440) : 1280;
  const height = Number.isFinite(h) && h >= 256 ? Math.min(h, 1440) : 720;
  const cleaned = prompt.trim().slice(0, 400);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(cleaned)}` +
    `?width=${width}&height=${height}&nologo=true&seed=${seed}` +
    `&model=${encodeURIComponent(model)}`;

  let lastErr: Error | null = null;
  // One retry with different seed if rate-limited / non-image
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tryUrl =
        attempt === 0
          ? url
          : url.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 1e9)}`);
      const img = await fetchImageFromUrl(tryUrl, { timeoutMs: 60_000 });
      return {
        ...img,
        source: "pollinations",
        model: modelId,
        provider: "pollinations",
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // brief backoff
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastErr ?? new Error("Pollinations generate gagal");
}

/**
 * OpenAI-compatible Images API — generate or edit.
 */
async function generateOpenAiImages(
  conn: LlmConnection & { model: string },
  prompt: string,
  opts: {
    size: string;
    quality?: string;
    reference?: ImageBytes | null;
  }
): Promise<ImageGenResult> {
  const { client, model, baseUrl } = createLlmClient({
    ...conn,
    useJsonMode: false,
  });

  // Prefer longer timeout for image gen
  const openai = client as OpenAI;

  if (opts.reference) {
    const preset = getImagePreset(model);
    if (preset && !preset.supportsEdit && !/gpt-image|dall-e-2|edit/i.test(model)) {
      throw new Error(
        `Model "${model}" biasanya tidak mendukung image edit. Pilih DALL·E 2 / GPT Image 1, atau generate tanpa gambar referensi.`
      );
    }

    const file = await toFile(
      Buffer.from(opts.reference.bytes),
      opts.reference.filename || "reference.png",
      { type: opts.reference.mimeType || "image/png" }
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        model,
        image: file,
        prompt: prompt.slice(0, 32000),
        n: 1,
        size: opts.size as "1024x1024",
      };
      // dall-e-2 uses response_format; gpt-image-1 may not
      if (/dall-e-2/i.test(model)) {
        body.response_format = "b64_json";
      }

      const res = await openai.images.edit(body);
      const item = res.data?.[0];
      if (!item) throw new Error("API edit tidak mengembalikan gambar");

      if (item.b64_json) {
        return {
          ...b64ToImageBytes(item.b64_json),
          revised_prompt: item.revised_prompt,
          source: "openai_edits",
          model,
          provider: conn.provider,
        };
      }
      if (item.url) {
        const img = await fetchUrlToBytes(item.url);
        return {
          ...img,
          revised_prompt: item.revised_prompt,
          source: "openai_edits",
          model,
          provider: conn.provider,
        };
      }
      throw new Error("Respons edit tanpa b64/url");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Image edit gagal (${model} @ ${baseUrl || "default"}): ${msg}`
      );
    }
  }

  // Text-to-image
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      model,
      prompt: prompt.slice(0, 32000),
      n: 1,
      size: opts.size,
    };

    if (/dall-e-3/i.test(model)) {
      body.quality =
        opts.quality === "hd" || opts.quality === "high" ? "hd" : "standard";
      body.response_format = "b64_json";
    } else if (/dall-e-2/i.test(model)) {
      body.response_format = "b64_json";
    } else if (/gpt-image/i.test(model)) {
      if (opts.quality) body.quality = opts.quality;
    } else {
      // Many gateways accept response_format
      body.response_format = "b64_json";
      if (opts.quality) body.quality = opts.quality;
    }

    const res = await openai.images.generate(body);
    const item = res.data?.[0];
    if (!item) throw new Error("API generate tidak mengembalikan gambar");

    if (item.b64_json) {
      return {
        ...b64ToImageBytes(item.b64_json),
        revised_prompt: item.revised_prompt,
        source: "openai_images",
        model,
        provider: conn.provider,
      };
    }
    if (item.url) {
      const img = await fetchUrlToBytes(item.url);
      return {
        ...img,
        revised_prompt: item.revised_prompt,
        source: "openai_images",
        model,
        provider: conn.provider,
      };
    }
    throw new Error("Respons generate tanpa b64/url");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Image generate gagal (${model} @ ${baseUrl || "default"}): ${msg}. ` +
        `Pastikan model mendukung Images API (/v1/images/generations), bukan chat-only.`
    );
  }
}

/**
 * Generate or edit an image using selected LLM/image model.
 */
export async function generateImage(
  params: ImageGenParams
): Promise<ImageGenResult> {
  const prompt = params.prompt.trim();
  if (!prompt) throw new Error("Prompt gambar kosong");

  const model = params.model.trim();
  if (!model) throw new Error("Model gambar wajib dipilih");

  const size = parseSize(params.size);
  const provider = (params.provider || "openai").trim();

  if (isPollinationsModel(model, provider)) {
    if (params.reference) {
      throw new Error(
        "Pollinations (gratis) tidak mendukung edit dari upload. Pilih model LLM image (DALL·E 2 / GPT Image 1) untuk edit."
      );
    }
    return generatePollinations(prompt, model, size);
  }

  return generateOpenAiImages(
    {
      provider,
      model,
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
    },
    prompt,
    {
      size,
      quality: params.quality,
      reference: params.reference,
    }
  );
}

/**
 * Resolve image connection from llm_settings row + optional overrides.
 */
export function resolveImageSettings(
  settings: Record<string, unknown> | null | undefined,
  overrides?: {
    provider?: string | null;
    model?: string | null;
    base_url?: string | null;
    api_key?: string | null;
    size?: string | null;
    quality?: string | null;
  }
): {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
  size: string;
  quality: string;
} {
  const s = settings ?? {};
  const imageProvider =
    (overrides?.provider && String(overrides.provider).trim()) ||
    (typeof s.image_provider === "string" && s.image_provider.trim()) ||
    (typeof s.provider === "string" && s.provider.trim()) ||
    "openai";

  const imageModel =
    (overrides?.model && String(overrides.model).trim()) ||
    (typeof s.image_model === "string" && s.image_model.trim()) ||
    "pollinations/flux";

  // If using pollinations, ignore keys
  if (isPollinationsModel(imageModel, imageProvider)) {
    return {
      provider: "pollinations",
      model: imageModel.startsWith("pollinations/")
        ? imageModel
        : `pollinations/${pollinationsStyle(imageModel)}`,
      baseUrl: null,
      apiKey: null,
      size:
        (overrides?.size && String(overrides.size)) ||
        (typeof s.image_size === "string" && s.image_size) ||
        "1280x720",
      quality:
        (overrides?.quality && String(overrides.quality)) ||
        (typeof s.image_quality === "string" && s.image_quality) ||
        "standard",
    };
  }

  // Prefer dedicated image_* credentials, else fall back to primary LLM
  const baseUrl =
    overrides?.base_url !== undefined && overrides.base_url !== null
      ? String(overrides.base_url).trim() || null
      : (typeof s.image_base_url === "string" && s.image_base_url.trim()) ||
        (typeof s.base_url === "string" && s.base_url.trim()) ||
        null;

  return {
    provider: imageProvider,
    model: imageModel,
    baseUrl,
    apiKey: overrides?.api_key ? String(overrides.api_key) : null, // caller decrypts saved keys
    size:
      (overrides?.size && String(overrides.size)) ||
      (typeof s.image_size === "string" && s.image_size) ||
      "1024x1024",
    quality:
      (overrides?.quality && String(overrides.quality)) ||
      (typeof s.image_quality === "string" && s.image_quality) ||
      "standard",
  };
}
