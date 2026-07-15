import {
  isLocalWordPressUrl,
  normalizeWordPressBaseUrl,
} from "@/lib/wordpress/url";

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

export interface WpTag {
  id: number;
  name: string;
  slug: string;
}

export interface WpPostPayload {
  title: string;
  content: string;
  status: "draft" | "publish" | "future" | "pending";
  excerpt?: string;
  slug?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  comment_status?: "open" | "closed";
  ping_status?: "open" | "closed";
  date?: string;
  meta?: Record<string, string>;
}

export interface WpPost {
  id: number;
  link: string;
  status: string;
  title: { rendered: string };
}

/** How REST is reached — many local WP installs use Plain permalinks */
export type RestStyle = "pretty" | "index" | "query";

function authHeader(username: string, appPassword: string): string {
  const token = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Build full REST URL for a path like `/wp/v2/posts` or `/wp/v2/users/me?context=edit`
 */
export function buildWordPressRestUrl(
  baseUrl: string,
  path: string,
  style: RestStyle
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const raw = path.startsWith("/") ? path : `/${path}`;
  const qIdx = raw.indexOf("?");
  const route = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const search = qIdx >= 0 ? raw.slice(qIdx + 1) : "";

  if (style === "pretty") {
    return search
      ? `${base}/wp-json${route}?${search}`
      : `${base}/wp-json${route}`;
  }
  if (style === "index") {
    return search
      ? `${base}/index.php/wp-json${route}?${search}`
      : `${base}/index.php/wp-json${route}`;
  }
  // Plain permalinks: /?rest_route=/wp/v2/...&other=params
  const params = new URLSearchParams();
  params.set("rest_route", route === "" ? "/" : route);
  if (search) {
    const extra = new URLSearchParams(search);
    extra.forEach((v, k) => params.append(k, v));
  }
  return `${base}/?${params.toString()}`;
}

function restStyleLabel(style: RestStyle): string {
  if (style === "pretty") return "/wp-json/ (pretty permalinks)";
  if (style === "index") return "/index.php/wp-json/ (PATHINFO)";
  return "/?rest_route=/ (Plain permalinks)";
}

export class WordPressClient {
  private baseUrl: string;
  private auth: string;
  private isLocal: boolean;
  /** Cached after first successful discover */
  private restStyle: RestStyle | null = null;

  constructor(baseUrl: string, username: string, appPassword: string) {
    this.baseUrl = normalizeWordPressBaseUrl(baseUrl);
    this.auth = authHeader(username, appPassword);
    this.isLocal = isLocalWordPressUrl(this.baseUrl);
  }

  get siteBaseUrl(): string {
    return this.baseUrl;
  }

  get local(): boolean {
    return this.isLocal;
  }

  get activeRestStyle(): RestStyle | null {
    return this.restStyle;
  }

  /** Public REST index URL (for UI links) */
  restIndexUrl(style?: RestStyle): string {
    const s = style ?? this.restStyle ?? "pretty";
    return buildWordPressRestUrl(this.baseUrl, "/", s);
  }

  /**
   * Probe which REST base works. Order: pretty → index.php → rest_route.
   */
  async discoverRestStyle(): Promise<{
    style: RestStyle;
    index: { name?: string; description?: string; namespaces?: string[] };
    tried: Array<{ style: RestStyle; ok: boolean; status?: number; error?: string }>;
  }> {
    if (this.restStyle) {
      // re-validate cached style lightly by using it
      const index = await this.requestWithStyle<{
        name?: string;
        description?: string;
        namespaces?: string[];
      }>("/", undefined, this.restStyle);
      return { style: this.restStyle, index, tried: [{ style: this.restStyle, ok: true }] };
    }

    const order: RestStyle[] = this.isLocal
      ? ["pretty", "index", "query"]
      : ["pretty", "index", "query"];

    const tried: Array<{
      style: RestStyle;
      ok: boolean;
      status?: number;
      error?: string;
    }> = [];

    for (const style of order) {
      try {
        const url = buildWordPressRestUrl(this.baseUrl, "/", style);
        const controller = new AbortController();
        const timeoutMs = this.isLocal ? 20_000 : 15_000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res: Response;
        try {
          res = await fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              // no auth needed for index
            },
          });
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) {
          tried.push({ style, ok: false, status: res.status });
          continue;
        }

        const ct = res.headers.get("content-type") || "";
        const text = await res.text();
        // Apache 404 HTML is not REST
        if (!ct.includes("json") && !text.trimStart().startsWith("{")) {
          tried.push({
            style,
            ok: false,
            status: res.status,
            error: "Response bukan JSON (kemungkinan 404 HTML)",
          });
          continue;
        }

        let index: { name?: string; description?: string; namespaces?: string[] };
        try {
          index = JSON.parse(text) as typeof index;
        } catch {
          tried.push({ style, ok: false, error: "JSON parse gagal" });
          continue;
        }

        if (!index || typeof index !== "object") {
          tried.push({ style, ok: false, error: "Body tidak valid" });
          continue;
        }

        this.restStyle = style;
        tried.push({ style, ok: true, status: res.status });
        return { style, index, tried };
      } catch (e) {
        tried.push({
          style,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const detail = tried
      .map(
        (t) =>
          `${t.style}:${t.ok ? "ok" : "fail"}${t.status ? `(${t.status})` : ""}${t.error ? ` ${t.error}` : ""}`
      )
      .join("; ");
    throw new Error(
      `REST API WordPress tidak bisa dijangkau di ${this.baseUrl}. Dicoba: ${detail}. ` +
        `Buka di browser: ${this.baseUrl}/?rest_route=/ atau Settings → Permalinks → Post name → Save.`
    );
  }

  private async requestWithStyle<T>(
    path: string,
    init: RequestInit | undefined,
    style: RestStyle
  ): Promise<T> {
    const url = buildWordPressRestUrl(this.baseUrl, path, style);
    const controller = new AbortController();
    const timeoutMs = this.isLocal ? 45_000 : 25_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? controller.signal,
        headers: {
          Authorization: this.auth,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let hint = "";
        if (res.status === 401 || res.status === 403) {
          hint = this.isLocal
            ? " (Lokal: cek Application Password; di HTTP set WP_ENVIRONMENT_TYPE=local di wp-config.php)"
            : " (Cek username & Application Password)";
        } else if (res.status === 404) {
          hint =
            " (REST path 404 — coba Permalinks → Post name, atau Aieo akan fallback rest_route)";
        }
        throw new Error(
          `WordPress API ${res.status} ${res.statusText}${hint}: ${body.slice(0, 400)}`
        );
      }

      return res.json() as Promise<T>;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(
          this.isLocal
            ? `Timeout koneksi WordPress lokal (${timeoutMs}ms). Pastikan WP jalan di ${this.baseUrl}`
            : `Timeout koneksi WordPress (${timeoutMs}ms)`
        );
      }
      if (
        e instanceof Error &&
        /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(e.message)
      ) {
        throw new Error(
          this.isLocal
            ? `Tidak bisa menjangkau WordPress di ${this.baseUrl}. Pastikan server lokal aktif. Jika Aieo di Docker, coba http://host.docker.internal:PORT`
            : `Tidak bisa menjangkau WordPress di ${this.baseUrl}: ${e.message}`
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.restStyle) {
      await this.discoverRestStyle();
    }
    const style = this.restStyle!;
    try {
      return await this.requestWithStyle<T>(path, init, style);
    } catch (e) {
      // If cached style dies (e.g. permalinks changed), rediscover once
      const msg = e instanceof Error ? e.message : "";
      if (/404|REST path/.test(msg)) {
        this.restStyle = null;
        await this.discoverRestStyle();
        return this.requestWithStyle<T>(path, init, this.restStyle!);
      }
      throw e;
    }
  }

  /**
   * Step-by-step connectivity check for clear UI feedback.
   */
  async testConnection(): Promise<{
    ok: boolean;
    connected: boolean;
    site_url: string;
    is_local?: boolean;
    wp_version?: string;
    name?: string;
    description?: string;
    user?: { id: number; name: string; slug: string; roles?: string[] };
    can_create_posts?: boolean;
    categories_count?: number;
    latency_ms: number;
    rest_url: string;
    rest_style?: RestStyle;
    admin_url: string;
    steps: Array<{
      id: string;
      label: string;
      ok: boolean;
      detail?: string;
      error?: string;
    }>;
  }> {
    const started = Date.now();
    const site_url = this.baseUrl;
    const admin_url = `${this.baseUrl}/wp-admin/`;
    const steps: Array<{
      id: string;
      label: string;
      ok: boolean;
      detail?: string;
      error?: string;
    }> = [];

    // 1) Discover REST (pretty / index.php / rest_route)
    let index: {
      name?: string;
      description?: string;
      namespaces?: string[];
    } | null = null;
    let restStyle: RestStyle | null = null;
    try {
      const discovered = await this.discoverRestStyle();
      index = discovered.index;
      restStyle = discovered.style;
      const triedSummary = discovered.tried
        .map((t) => `${t.style}${t.ok ? "✓" : "✗"}`)
        .join(" ");
      steps.push({
        id: "rest",
        label: "REST API",
        ok: true,
        detail: `Situs: ${index.name || "—"} · mode: ${restStyleLabel(discovered.style)} · ${triedSummary}`,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      steps.push({
        id: "rest",
        label: "REST API",
        ok: false,
        error: err,
      });
      return {
        ok: false,
        connected: false,
        site_url,
        is_local: this.isLocal,
        rest_url: buildWordPressRestUrl(this.baseUrl, "/", "query"),
        admin_url,
        steps,
        latency_ms: Date.now() - started,
      };
    }

    const rest_url = this.restIndexUrl(restStyle);

    // 2) Auth
    let me: {
      id: number;
      name: string;
      slug: string;
      roles?: string[];
      capabilities?: Record<string, boolean>;
    };
    try {
      me = await this.request<{
        id: number;
        name: string;
        slug: string;
        roles?: string[];
        capabilities?: Record<string, boolean>;
      }>(`/wp/v2/users/me?context=edit`);
      steps.push({
        id: "auth",
        label: "Login Application Password",
        ok: true,
        detail: `User: ${me.name} · roles: ${(me.roles ?? []).join(", ") || "—"}`,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      steps.push({
        id: "auth",
        label: "Login Application Password",
        ok: false,
        error: err,
      });
      return {
        ok: false,
        connected: false,
        site_url,
        is_local: this.isLocal,
        name: index?.name,
        description: index?.description,
        rest_url,
        rest_style: restStyle ?? undefined,
        admin_url,
        steps,
        latency_ms: Date.now() - started,
      };
    }

    // 3) Capability
    const can_create_posts = Boolean(
      me.capabilities?.edit_posts ||
        me.capabilities?.publish_posts ||
        me.roles?.some((r) =>
          ["administrator", "editor", "author"].includes(r)
        )
    );
    steps.push({
      id: "capability",
      label: "Izin membuat post",
      ok: can_create_posts,
      detail: can_create_posts
        ? "edit_posts / publish_posts tersedia"
        : "Role user tidak bisa membuat post — ganti ke Editor/Administrator",
      error: can_create_posts
        ? undefined
        : "Naikkan role user di WordPress (Editor/Admin)",
    });

    // 4) Categories (non-fatal)
    let categories_count = 0;
    try {
      const page = await this.request<WpCategory[]>(
        `/wp/v2/categories?per_page=100`
      );
      categories_count = page.length;
      steps.push({
        id: "categories",
        label: "Kategori",
        ok: true,
        detail: `${categories_count} kategori terbaca`,
      });
    } catch (e) {
      steps.push({
        id: "categories",
        label: "Kategori",
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const connected = steps
      .filter((s) => s.id === "rest" || s.id === "auth")
      .every((s) => s.ok);

    return {
      ok: connected && can_create_posts,
      connected,
      site_url,
      is_local: this.isLocal,
      name: index?.name,
      description: index?.description,
      user: {
        id: me.id,
        name: me.name,
        slug: me.slug,
        roles: me.roles,
      },
      can_create_posts,
      categories_count,
      latency_ms: Date.now() - started,
      rest_url,
      rest_style: restStyle ?? undefined,
      admin_url,
      steps,
    };
  }

  async listCategories(): Promise<WpCategory[]> {
    const all: WpCategory[] = [];
    let page = 1;
    while (page <= 20) {
      const batch = await this.request<WpCategory[]>(
        `/wp/v2/categories?per_page=100&page=${page}`
      );
      all.push(...batch);
      if (batch.length < 100) break;
      page += 1;
    }
    return all;
  }

  async listTags(): Promise<WpTag[]> {
    const all: WpTag[] = [];
    let page = 1;
    while (page <= 20) {
      const batch = await this.request<WpTag[]>(
        `/wp/v2/tags?per_page=100&page=${page}`
      );
      all.push(...batch);
      if (batch.length < 100) break;
      page += 1;
    }
    return all;
  }

  async findOrCreateTag(name: string): Promise<number> {
    const search = await this.request<WpTag[]>(
      `/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=10`
    );
    const exact = search.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (exact) return exact.id;

    const created = await this.request<WpTag>(`/wp/v2/tags`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return created.id;
  }

  async createPost(payload: WpPostPayload): Promise<WpPost> {
    return this.request<WpPost>(`/wp/v2/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updatePost(
    id: number,
    payload: Partial<WpPostPayload>
  ): Promise<WpPost> {
    return this.request<WpPost>(`/wp/v2/posts/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** Admin edit URL for a post ID */
  editPostUrl(postId: number): string {
    return `${this.baseUrl}/wp-admin/post.php?post=${postId}&action=edit`;
  }

  /** Posts list in admin (where drafts live) */
  adminPostsUrl(status?: string): string {
    const st = status ? `&post_status=${encodeURIComponent(status)}` : "";
    return `${this.baseUrl}/wp-admin/edit.php?post_type=post${st}`;
  }

  async uploadMedia(
    filename: string,
    bytes: ArrayBuffer,
    mimeType: string,
    altText?: string
  ): Promise<{ id: number; source_url: string }> {
    if (!this.restStyle) {
      await this.discoverRestStyle();
    }
    const url = buildWordPressRestUrl(
      this.baseUrl,
      "/wp/v2/media",
      this.restStyle!
    );
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.auth,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": mimeType,
        Accept: "application/json",
      },
      body: bytes,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WordPress media upload failed: ${body.slice(0, 500)}`);
    }

    const media = (await res.json()) as { id: number; source_url: string };

    // Always set clean alt; clear caption/description so EXIF prompt JSON
    // (e.g. from Pollinations) never leaks into WP media fields / post UI.
    await this.request(`/wp/v2/media/${media.id}`, {
      method: "POST",
      body: JSON.stringify({
        alt_text: altText || "",
        caption: "",
        description: "",
      }),
    }).catch(() => undefined);

    return media;
  }

  /** Clear caption/description on a media item (keep alt). */
  async clearMediaText(mediaId: number, altText?: string): Promise<void> {
    await this.request(`/wp/v2/media/${mediaId}`, {
      method: "POST",
      body: JSON.stringify({
        alt_text: altText ?? "",
        caption: "",
        description: "",
      }),
    });
  }
}
