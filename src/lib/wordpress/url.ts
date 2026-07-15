/**
 * WordPress base URL helpers — including localhost for local testing.
 */

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "host.docker.internal", // Docker Desktop → host machine
  "wordpress", // docker-compose service name
  "wp",
]);

/** Hosts commonly used by local WP stacks (suffix match) */
const LOCAL_SUFFIXES = [
  ".local",
  ".test",
  ".localhost",
  ".internal",
  ".lan",
  ".home",
];

export function isLocalWordPressHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (LOCAL_HOSTS.has(h)) return true;
  if (LOCAL_HOSTS.has(hostname.toLowerCase())) return true;
  // 127.x.x.x loopback
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  // Private LAN (common for local network testing)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return LOCAL_SUFFIXES.some((s) => h.endsWith(s));
}

export function isLocalWordPressUrl(raw: string): boolean {
  try {
    const u = new URL(normalizeWordPressBaseUrl(raw));
    return isLocalWordPressHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Normalize WP base URL:
 * - trim, strip trailing slash
 * - strip /wp-admin, /wp-json, /index.php
 * - default http:// for bare localhost hostnames
 */
export function normalizeWordPressBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s) throw new Error("Base URL wajib diisi");

  // Bare host without scheme → assume http for local, https otherwise
  if (!/^https?:\/\//i.test(s)) {
    const hostPart = s.split("/")[0].split(":")[0].toLowerCase();
    const scheme = isLocalWordPressHost(hostPart) ? "http" : "https";
    s = `${scheme}://${s}`;
  }

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error("Base URL tidak valid");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Hanya http:// atau https:// yang diizinkan");
  }

  // Production HTTPS preferred — but local HTTP is explicitly allowed
  const local = isLocalWordPressHost(url.hostname);
  if (!local && url.protocol === "http:") {
    // Soft upgrade hint only in message; still allow for staging without SSL
  }

  // Strip WP path suffixes
  let path = url.pathname.replace(/\/+$/, "");
  path = path
    .replace(/\/wp-admin$/i, "")
    .replace(/\/wp-login\.php$/i, "")
    .replace(/\/wp-json(\/.*)?$/i, "")
    .replace(/\/index\.php$/i, "");
  path = path.replace(/\/+$/, "");

  const port =
    url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
  const base = `${url.protocol}//${url.hostname}${port}${path}`;
  return base.replace(/\/+$/, "");
}

export type WordPressUrlCheck = {
  base_url: string;
  is_local: boolean;
  protocol: "http" | "https";
  host: string;
  hints: string[];
};

export function validateWordPressBaseUrl(raw: string): WordPressUrlCheck {
  const base_url = normalizeWordPressBaseUrl(raw);
  const u = new URL(base_url);
  const is_local = isLocalWordPressHost(u.hostname);
  const protocol = u.protocol === "https:" ? "https" : "http";
  const hints: string[] = [];

  if (is_local) {
    hints.push(
      "Mode lokal: HTTP diizinkan. Pastikan REST API aktif (…/wp-json/)."
    );
    if (protocol === "http") {
      hints.push(
        "Application Password di HTTP butuh WP lokal: di wp-config.php set define('WP_ENVIRONMENT_TYPE', 'local'); atau define('WP_DEBUG', true);"
      );
    }
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      hints.push(
        "Jika Aieo jalan di Docker, pakai http://host.docker.internal:PORT (bukan localhost)."
      );
    }
  }

  return {
    base_url,
    is_local,
    protocol,
    host: u.hostname + (u.port ? `:${u.port}` : ""),
    hints,
  };
}

/** Local WP presets for testing UI */
export const LOCAL_WP_PRESETS = [
  {
    id: "localhost-80",
    label: "localhost (port 80)",
    name: "WP Local :80",
    base_url: "http://localhost",
  },
  {
    id: "localhost-8080",
    label: "localhost:8080",
    name: "WP Local :8080",
    base_url: "http://localhost:8080",
  },
  {
    id: "127-8888",
    label: "127.0.0.1:8888 (MAMP)",
    name: "WP MAMP",
    base_url: "http://127.0.0.1:8888",
  },
  {
    id: "docker-host",
    label: "host.docker.internal:8080",
    name: "WP Docker host",
    base_url: "http://host.docker.internal:8080",
  },
  {
    id: "wp-env",
    label: "localhost:8888 (wp-env)",
    name: "WP-Env",
    base_url: "http://localhost:8888",
  },
  {
    id: "localwp",
    label: "*.local (LocalWP)",
    name: "LocalWP",
    base_url: "http://mysite.local",
  },
] as const;
