/**
 * Basic SSRF protection for user-supplied URLs.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIp(hostname: string): boolean {
  // IPv4
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  // IPv6 loopback / link-local rough checks
  const h = hostname.toLowerCase();
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  return false;
}

export function assertSafePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("URL tidak valid");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Hanya http/https yang diizinkan");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Host lokal/internal tidak diizinkan");
  }

  if (isPrivateIp(host)) {
    throw new Error("Alamat IP privat tidak diizinkan");
  }

  return url;
}

export async function fetchText(
  url: string,
  opts?: { timeoutMs?: number; accept?: string }
): Promise<{ finalUrl: string; contentType: string; body: string }> {
  const safe = assertSafePublicUrl(url);
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(safe.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "AieoBot/1.0 (+https://localhost; RSS/URL importer for editorial tool)",
        Accept: opts?.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal fetch (${res.status} ${res.statusText})`);
    }

    // Re-check final URL after redirects
    const finalUrl = res.url || safe.toString();
    assertSafePublicUrl(finalUrl);

    const contentType = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5_000_000) {
      throw new Error("Respons terlalu besar (maks 5MB)");
    }
    const body = new TextDecoder("utf-8").decode(buf);
    return { finalUrl, contentType, body };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Timeout mengambil URL");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
