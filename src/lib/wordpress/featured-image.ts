import { assertSafePublicUrl } from "@/lib/import/ssrf";
import { isLocalWordPressHost } from "@/lib/wordpress/url";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ImageBytes = {
  bytes: ArrayBuffer;
  mimeType: string;
  filename: string;
};

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function mimeFromExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Detect real image from magic bytes. Rejects JSON/HTML mistaken as images
 * (Pollinations sometimes returns application/json rate-limit or metadata).
 */
export function detectImageMime(
  bytes: ArrayBuffer | Uint8Array
): string | null {
  const u8 =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.byteLength < 12) return null;

  // JPEG
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return "image/jpeg";
  // PNG
  if (
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF
  if (
    u8[0] === 0x47 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x38
  ) {
    return "image/gif";
  }
  // WEBP: RIFF....WEBP
  if (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Throw if buffer is not a real raster image (catches JSON-as-image bugs). */
export function assertRealImageBytes(
  bytes: ArrayBuffer | Uint8Array,
  hint = "file"
): string {
  const u8 =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Quick reject: JSON / HTML / plain text error bodies
  const head = Buffer.from(u8.subarray(0, Math.min(64, u8.byteLength)))
    .toString("utf8")
    .trimStart();
  if (
    head.startsWith("{") ||
    head.startsWith("[") ||
    head.startsWith("<!DOCTYPE") ||
    head.startsWith("<html") ||
    head.startsWith("<?xml")
  ) {
    const snippet = head.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Respons bukan file gambar (dapat JSON/HTML). ${hint}: ${snippet}… ` +
        `Sering terjadi saat Pollinations rate-limit. Coba lagi atau ganti model image (DALL·E / OpenAI).`
    );
  }
  const mime = detectImageMime(u8);
  if (!mime) {
    throw new Error(
      `File bukan gambar valid (JPEG/PNG/WebP/GIF). ${hint}`
    );
  }
  return mime;
}

/**
 * Fetch image URL for WP media upload.
 * Local/private hosts allowed only when allowLocal=true (e.g. re-fetch from local WP media).
 */
export async function fetchImageFromUrl(
  url: string,
  opts?: { allowLocal?: boolean; timeoutMs?: number }
): Promise<ImageBytes> {
  let safe: URL;
  try {
    safe = new URL(url.trim());
  } catch {
    throw new Error("URL gambar tidak valid");
  }
  if (!["http:", "https:"].includes(safe.protocol)) {
    throw new Error("Hanya http/https untuk URL gambar");
  }
  const host = safe.hostname.toLowerCase();
  const local = isLocalWordPressHost(host);
  if (!local || !opts?.allowLocal) {
    // Public SSRF guard for remote URLs
    safe = assertSafePublicUrl(url);
  }
  const timeoutMs = opts?.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(safe.toString(), {
      signal: controller.signal,
      headers: {
        // Prefer binary image — avoid JSON error payloads when possible
        Accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8,*/*;q=0.1",
        "User-Agent": "Aieo-FeaturedImage/1.0",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const snip = errBody.slice(0, 180).replace(/\s+/g, " ");
      throw new Error(
        `Gagal unduh gambar: HTTP ${res.status}${snip ? ` — ${snip}` : ""}`
      );
    }
    const headerMime =
      res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
      "";
    // Reject obvious non-image content-types before reading large body
    if (
      headerMime &&
      (headerMime.includes("json") ||
        headerMime.includes("text/html") ||
        headerMime.includes("text/plain"))
    ) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `Server mengembalikan ${headerMime}, bukan gambar. ${errBody.slice(0, 160)}`
      );
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) throw new Error("Gambar kosong");
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Gambar terlalu besar (max 8MB)");
    }
    const realMime = assertRealImageBytes(buf, safe.hostname);
    const filename = `featured.${extFromMime(realMime)}`;
    return {
      bytes: buf,
      mimeType: realMime,
      filename,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse base64 data URL from browser upload */
export function imageFromDataUrl(
  dataUrl: string,
  filename = "featured.jpg"
): ImageBytes {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) throw new Error("Format data URL gambar tidak valid");
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(`Tipe gambar tidak didukung: ${mime}`);
  }
  const bin = Buffer.from(m[2], "base64");
  if (bin.byteLength > MAX_BYTES) {
    throw new Error("Gambar terlalu besar (max 8MB)");
  }
  const bytes = bin.buffer.slice(
    bin.byteOffset,
    bin.byteOffset + bin.byteLength
  );
  const realMime = assertRealImageBytes(bytes, "data URL");
  const base = filename.replace(/\.[^.]+$/, "") || "featured";
  return {
    bytes,
    mimeType: realMime,
    filename: `${base}.${extFromMime(realMime)}`,
  };
}

export function imageFromBuffer(
  buf: ArrayBuffer | Buffer,
  filename: string,
  mimeType?: string
): ImageBytes {
  let bytes: ArrayBuffer;
  if (buf instanceof ArrayBuffer) {
    bytes = buf;
  } else {
    const copy = new Uint8Array(buf.byteLength);
    copy.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    bytes = copy.buffer;
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Gambar terlalu besar (max 8MB)");
  }
  // Prefer magic bytes over claimed mime
  const realMime = assertRealImageBytes(bytes, filename);
  void mimeType;
  const base =
    filename.replace(/[^\w.\-]+/g, "_").replace(/\.[^.]+$/, "") || "featured";
  return {
    bytes,
    mimeType: realMime,
    filename: `${base}.${extFromMime(realMime)}`,
  };
}

/**
 * Build a Pollinations image URL from English prompt (no API key).
 * Uses random seed so retries don't stick to a bad cached error body.
 */
export function buildGeneratedImageUrl(
  prompt: string,
  opts?: { width?: number; height?: number; model?: string }
): string {
  const cleaned = prompt.trim().slice(0, 400);
  if (!cleaned) throw new Error("Prompt gambar kosong");
  const q = encodeURIComponent(cleaned);
  const width = opts?.width ?? 1280;
  const height = opts?.height ?? 720;
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const model = (opts?.model || "flux").replace(/[^\w.\-]/g, "");
  // Keep params simple — avoid enhance=true (slower / more rate-limits)
  return (
    `https://image.pollinations.ai/prompt/${q}` +
    `?width=${width}&height=${height}&nologo=true&seed=${seed}` +
    (model ? `&model=${encodeURIComponent(model)}` : "")
  );
}

/**
 * Remove accidental Pollinations / generator JSON blobs from post HTML/text.
 * Happens when a JSON error body was pasted or uploaded as "image" then inlined.
 */
export function stripAccidentalImageJsonFromContent(html: string): string {
  if (!html) return html;
  if (
    !html.includes("originalPrompt") &&
    !html.includes("trackingData") &&
    !html.includes("has_nsfw_concept")
  ) {
    return html;
  }
  // Greedy-ish removal of Pollinations-style tracking JSON objects
  let out = html.replace(
    /\{[\s\S]*?"originalPrompt"\s*:\s*"[\s\S]*?"trackingData"\s*:\s*\{[\s\S]*?\}\s*\}/g,
    ""
  );
  out = out.replace(
    /\{[\s\S]*?"prompt"\s*:\s*"[^"]{10,}"[\s\S]*?"has_nsfw_concept"\s*:\s*(true|false)[\s\S]*?\}/g,
    ""
  );
  out = out.replace(
    /<(pre|code)[^>]*>\s*\{[\s\S]*?"originalPrompt"[\s\S]*?\}\s*<\/\1>/gi,
    ""
  );
  // Also plain-text paragraph wrappers
  out = out.replace(
    /<p>\s*\{[\s\S]*?"originalPrompt"[\s\S]*?\}\s*<\/p>/gi,
    ""
  );
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Strip JPEG APP1 (EXIF) segments. Pollinations embeds full prompt JSON in EXIF;
 * some WP themes/plugins dump that into the post/media description as text.
 */
export function stripJpegExif(bytes: ArrayBuffer): ArrayBuffer {
  const u8 = new Uint8Array(bytes);
  if (u8.length < 4 || u8[0] !== 0xff || u8[1] !== 0xd8) {
    return bytes; // not JPEG
  }
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < u8.length - 1) {
    if (u8[i] !== 0xff) {
      // entropy-coded data — copy rest
      for (let j = i; j < u8.length; j++) out.push(u8[j]);
      break;
    }
    const marker = u8[i + 1];
    // Standalone markers
    if (marker === 0xd9 || marker === 0xda) {
      // EOI or SOS — copy rest including this marker
      for (let j = i; j < u8.length; j++) out.push(u8[j]);
      break;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    if (i + 3 >= u8.length) break;
    const len = (u8[i + 2] << 8) | u8[i + 3];
    const next = i + 2 + len;
    // Skip APP1 (EXIF / XMP) and APP13 (IPTC) — keep other APPn
    if (marker === 0xe1 || marker === 0xed) {
      i = next;
      continue;
    }
    for (let j = i; j < next && j < u8.length; j++) out.push(u8[j]);
    i = next;
  }
  return Uint8Array.from(out).buffer;
}

/** Prepare image bytes for WP upload (validate + strip Pollinations EXIF JSON). */
export function prepareImageForUpload(img: ImageBytes): ImageBytes {
  const real = assertRealImageBytes(img.bytes, img.filename);
  let bytes = img.bytes;
  if (real === "image/jpeg") {
    bytes = stripJpegExif(bytes);
  }
  return {
    bytes,
    mimeType: real,
    filename: img.filename.replace(/\.[^.]+$/, "") + `.${extFromMime(real)}`,
  };
}
