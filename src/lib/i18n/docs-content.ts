import type { Locale } from "@/lib/i18n/messages";

export type DocsTocItem = { id: string; label: string };

export function getDocsToc(locale: Locale): DocsTocItem[] {
  if (locale === "en") {
    return [
      { id: "apa-itu", label: "What is Aieo?" },
      { id: "mulai", label: "Quick start" },
      { id: "sumber-draf", label: "Draft sources (text / URL / RSS)" },
      { id: "template", label: "Prompt templates" },
      { id: "optimasi", label: "Optimization flow" },
      { id: "review", label: "Review & edit" },
      { id: "wordpress", label: "WordPress & auto-publish" },
      { id: "llm", label: "LLM settings" },
      { id: "status", label: "Article status" },
      { id: "tips", label: "Tips & troubleshooting" },
    ];
  }
  return [
    { id: "apa-itu", label: "Apa itu Aieo?" },
    { id: "mulai", label: "Mulai cepat" },
    { id: "sumber-draf", label: "Sumber draf (teks / URL / RSS)" },
    { id: "template", label: "Prompt template" },
    { id: "optimasi", label: "Alur optimasi" },
    { id: "review", label: "Review & edit" },
    { id: "wordpress", label: "WordPress & auto-publish" },
    { id: "llm", label: "Pengaturan LLM" },
    { id: "status", label: "Status artikel" },
    { id: "tips", label: "Tips & troubleshooting" },
  ];
}

export type DocsCopy = {
  whatTitle: string;
  whatBody: string;
  cards: { t: string; d: string }[];
  startTitle: string;
  steps: { title: string; body: string }[];
  sourcesTitle: string;
  sourcesIntro: string;
  sourcesTable: { tab: string; use: string }[];
  sourcesWarn: string;
  templateTitle: string;
  templateBody: string[];
  optimTitle: string;
  optimSteps: string[];
  optimNote: string;
  reviewTitle: string;
  reviewIntro: string;
  reviewTabs: string[];
  reviewNote: string;
  wpTitle: string;
  wpIntro: string;
  wpModesTitle: string;
  wpModes: { mode: string; result: string }[];
  wpCron: string;
  llmTitle: string;
  llmIntro: string;
  llmBullets: string[];
  llmOmni: string;
  llmTemp: string;
  statusTitle: string;
  statusItems: string[];
  tipsTitle: string;
  tips: { t: string; d: string }[];
};

export function getDocsCopy(locale: Locale): DocsCopy {
  if (locale === "en") {
    return {
      whatTitle: "What is Aieo?",
      whatBody:
        "Aieo (AI News SEO Optimizer & WordPress Publisher) turns raw news drafts into publish-ready articles: clean structure, SEO metadata, keywords, quality scores, social captions — then send to WordPress without inventing facts.",
      cards: [
        { t: "Rewrite + SEO", d: "Lead, headings, meta, keywords, 0–100 scores" },
        { t: "Templates & models", d: "Swap prompts & LLMs per workspace / article" },
        { t: "WordPress", d: "Draft, publish, or schedule auto-publish" },
      ],
      startTitle: "Quick start",
      steps: [
        {
          title: "Sign in to the dashboard",
          body: "Log in at /login. After sign-in, open the Dashboard.",
        },
        {
          title: "Configure LLM (admin)",
          body: "Settings → LLM — pick a provider (local OmniRoute, Dahl, OpenAI, custom endpoint, etc.) then Test connection.",
        },
        {
          title: "Activate a prompt template",
          body: "Settings → Prompt templates — use nasional-media-v3 / news-seo-editor-v2 or import a preset.",
        },
        {
          title: "Optimize an article",
          body: "New optimize — paste / URL / RSS → pick template → Start optimization (or Paraphrase mode).",
        },
        {
          title: "Review & publish",
          body: "Edit on the article detail page, save, then send to WordPress (draft / publish / schedule).",
        },
      ],
      sourcesTitle: "Draft sources (text / URL / RSS)",
      sourcesIntro: "On New optimize there are three source tabs:",
      sourcesTable: [
        {
          tab: "Paste text",
          use: "Paste a manual draft from Word/Google Docs/your editor.",
        },
        {
          tab: "From URL",
          use: "Enter a public article URL → Fetch content. The system extracts title + main body.",
        },
        {
          tab: "From RSS",
          use: "RSS/Atom feed URL → Load feed → pick items → Use. If full content fails, feed summary is used.",
        },
      ],
      sourcesWarn:
        "Paywalls, login walls, or bot-blocking sites often fail. Use open canonical URLs. Private hosts/IPs are blocked for security (SSRF).",
      templateTitle: "Prompt templates",
      templateBody: [
        "Templates define the rules the AI must follow (facts, SEO, tone). You can:",
        "Set the workspace default in Settings → Prompt templates",
        "Pick a template per article on New optimize",
        "Import built-in presets (paraphrase-v4, nasional-media-v3, …)",
        "Templates stress: no fact hallucination, non-clickbait titles, headings only if >600 words, FAQ only for explainers, WordPress status default draft.",
      ],
      optimTitle: "Optimization flow",
      optimSteps: [
        "Provide a draft (paste / URL / RSS) — at least ~50 characters.",
        "Choose a prompt template (or use Paraphrase mode).",
        "Optional: WordPress or manual categories.",
        "Click Start optimization — an async LLM job runs.",
        "Wait for ready (or flagged if review is needed).",
      ],
      optimNote:
        "Runs may take 1–3+ minutes depending on the provider. Status updates automatically. On failure (e.g. timeout 524), open the article → Retry.",
      reviewTitle: "Review & edit",
      reviewIntro: "On the article detail page:",
      reviewTabs: [
        "Preview — title, lead, HTML content + preview",
        "SEO — meta title/description, slug, keywords, tags, suggestions",
        "Social — Facebook / X / LinkedIn captions + image prompt",
        "Compare — word-level diff + originality score",
        "Versions — history + restore",
        "Draft — original source for fact-checking",
      ],
      reviewNote:
        "The right panel shows SEO scores 0–100. Save edits before publish. If flagged, review the yellow banner reasons.",
      wpTitle: "WordPress & auto-publish",
      wpIntro:
        "Connect a site in Settings → WordPress (Base URL + Application Password). Optional: Sync categories. SEO meta is sent for Yoast / Rank Math when available.",
      wpModesTitle: "Publish modes on article detail:",
      wpModes: [
        { mode: "Save as draft", result: "Draft post" },
        { mode: "Pending review", result: "Awaiting review in WP" },
        { mode: "Publish now", result: "Live immediately" },
        {
          mode: "Auto-publish (schedule)",
          result: "Status future — WP publishes at the chosen date/time",
        },
      ],
      wpCron:
        "Schedule at least 2 minutes ahead. Timezone follows the WordPress site. Ensure WP-Cron is active so scheduled posts actually go live.",
      llmTitle: "LLM settings",
      llmIntro: "In Settings → LLM:",
      llmBullets: [
        "Provider — first-party, third-party (Dahl, OpenRouter, …), or local (OmniRoute, Ollama, LM Studio)",
        "Base URL — OpenAI-compatible override (required for Custom)",
        "API key — workspace or server env (encrypted at rest)",
        "Fallback — backup provider if primary fails",
        "JSON mode — disable if the gateway rejects it",
      ],
      llmOmni:
        "OmniRoute default: http://127.0.0.1:20128/v1. The gateway must run on the same machine as the Aieo server.",
      llmTemp: "Temperature is capped ≤ 0.5 so rewrites stay faithful to facts.",
      statusTitle: "Article status",
      statusItems: [
        "processing — LLM is working",
        "ready — ready to review / publish",
        "flagged — needs manual review (new entities, near-duplicate paraphrase, etc.)",
        "scheduled — scheduled on WordPress",
        "failed — failed (timeout/provider); use Retry",
      ],
      tipsTitle: "Tips & troubleshooting",
      tips: [
        {
          t: "Slow / stuck processing",
          d: "Slow provider or timeout (e.g. HTTP 524). Open detail → Retry, switch to a faster model, or lower max tokens.",
        },
        {
          t: "Stack depth / 54001",
          d: "Supabase RLS recursion. The app uses the service role after auth; ensure migration 003_fix_rls_recursion.sql is applied.",
        },
        {
          t: "URL/RSS import fails",
          d: "Use public URLs, not paywalls. Feed must be valid RSS/Atom. Summary is used if full page fails.",
        },
        {
          t: "Schedule does not go live",
          d: "Check Application Password, Scheduled status in WP Admin, and WP-Cron (or system cron to wp-cron.php).",
        },
        {
          t: "Editorial principle",
          d: "Aieo polishes; it does not invent. Always compare with the original draft before publish.",
        },
      ],
    };
  }

  return {
    whatTitle: "Apa itu Aieo?",
    whatBody:
      "Aieo (AI News SEO Optimizer & WordPress Publisher) mengubah draf berita mentah menjadi artikel siap tayang: struktur rapi, metadata SEO, keyword, skor kualitas, caption sosial, lalu bisa dikirim ke WordPress — tanpa mengubah fakta dari sumber.",
    cards: [
      { t: "Rewrite + SEO", d: "Lead, heading, meta, keyword, skor 0–100" },
      { t: "Template & model", d: "Ganti prompt & LLM per workspace / artikel" },
      { t: "WordPress", d: "Draft, publish, atau jadwal auto-publish" },
    ],
    startTitle: "Mulai cepat",
    steps: [
      {
        title: "Masuk ke dashboard",
        body: "Login di /login. Setelah masuk, buka Dashboard.",
      },
      {
        title: "Siapkan LLM (admin)",
        body: "Settings → LLM — pilih provider (OmniRoute lokal, Dahl, OpenAI, custom endpoint, dll.) lalu Tes koneksi.",
      },
      {
        title: "Pastikan prompt template aktif",
        body: "Settings → Prompt Template — gunakan nasional-media-v3 / news-seo-editor-v2 atau impor preset.",
      },
      {
        title: "Optimasi artikel",
        body: "Optimasi Baru — tempel draf / URL / RSS → pilih template → Mulai optimasi (atau mode Parafrase).",
      },
      {
        title: "Review & publish",
        body: "Edit hasil di detail artikel, simpan, lalu kirim ke WordPress (draft / publish / jadwal).",
      },
    ],
    sourcesTitle: "Sumber draf (teks / URL / RSS)",
    sourcesIntro: "Di halaman Optimasi Baru ada tiga tab sumber:",
    sourcesTable: [
      {
        tab: "Tempel teks",
        use: "Paste draf manual dari Word/Google Docs/editor.",
      },
      {
        tab: "Dari URL",
        use: "Masukkan URL artikel publik → Ambil konten. Sistem mengekstrak judul + isi utama.",
      },
      {
        tab: "Dari RSS",
        use: "URL feed RSS/Atom → Muat feed → pilih item → Pakai. Jika full content gagal, ringkasan feed dipakai.",
      },
    ],
    sourcesWarn:
      "Paywall, login wall, atau situs yang memblokir bot sering gagal diekstrak. Pakai URL artikel terbuka (canonical). Host lokal/IP privat diblokir demi keamanan (SSRF).",
    templateTitle: "Prompt template",
    templateBody: [
      "Template menentukan aturan yang dipatuhi AI (fakta, SEO, gaya bahasa). Anda bisa:",
      "Set default workspace di Settings → Prompt Template",
      "Pilih template per artikel di form Optimasi Baru",
      "Impor preset bawaan (paraphrase-v4, nasional-media-v3, …)",
      "Template menekankan: nol halusinasi fakta, judul non-clickbait, heading hanya jika >600 kata, FAQ hanya untuk explainer, status WordPress default draft.",
    ],
    optimTitle: "Alur optimasi",
    optimSteps: [
      "Isi draf (tempel / URL / RSS) — minimal ~50 karakter.",
      "Pilih prompt template (atau mode Parafrase).",
      "Opsional: kategori WordPress atau kategori manual.",
      "Klik Mulai optimasi — job async diproses LLM.",
      "Tunggu status ready (atau flagged jika perlu review).",
    ],
    optimNote:
      "Proses bisa 1–3+ menit tergantung provider. Status di-update otomatis. Jika gagal (mis. timeout 524), buka detail artikel → Coba lagi.",
    reviewTitle: "Review & edit",
    reviewIntro: "Di halaman detail artikel ada tab:",
    reviewTabs: [
      "Preview — judul, lead, konten HTML + pratinjau",
      "SEO — meta title/description, slug, keyword, tags, saran",
      "Sosial — caption Facebook / X / LinkedIn + prompt gambar",
      "Bandingkan — diff kata + skor orisinalitas",
      "Versi — histori + restore",
      "Draf — sumber fakta untuk dibandingkan",
    ],
    reviewNote:
      "Panel kanan menampilkan skor SEO 0–100. Simpan edit sebelum publish. Jika berstatus flagged, review alasan di banner kuning.",
    wpTitle: "WordPress & auto-publish",
    wpIntro:
      "Hubungkan situs di Settings → WordPress (Base URL + Application Password). Opsional: Sync kategori. Meta SEO dikirim ke Yoast / Rank Math jika tersedia.",
    wpModesTitle: "Mode publish di detail artikel:",
    wpModes: [
      { mode: "Simpan draft", result: "Post draft" },
      { mode: "Pending review", result: "Menunggu review di WP" },
      { mode: "Publish sekarang", result: "Langsung live" },
      {
        mode: "Auto-publish (jadwalkan)",
        result: "Status future — WP mempublish otomatis pada tanggal/jam yang dipilih",
      },
    ],
    wpCron:
      "Jadwal minimal 2 menit ke depan. Zona waktu mengikuti pengaturan situs WordPress. Pastikan WP-Cron aktif agar post terjadwal benar-benar tayang.",
    llmTitle: "Pengaturan LLM",
    llmIntro: "Di Settings → LLM:",
    llmBullets: [
      "Provider — first-party, third-party (Dahl, OpenRouter, …), atau local (OmniRoute, Ollama, LM Studio)",
      "Base URL — override endpoint OpenAI-compatible (wajib untuk Custom)",
      "API key — workspace atau env server (dienkripsi at-rest)",
      "Fallback — provider cadangan jika yang utama gagal",
      "JSON mode — matikan jika gateway menolak",
    ],
    llmOmni:
      "OmniRoute default: http://127.0.0.1:20128/v1. Gateway harus berjalan di mesin yang sama dengan server Aieo.",
    llmTemp: "Temperature dibatasi ≤ 0.5 agar rewrite lebih setia pada fakta.",
    statusTitle: "Status artikel",
    statusItems: [
      "processing — LLM sedang bekerja",
      "ready — siap review / publish",
      "flagged — perlu review manual (entitas baru, near-duplicate parafrase, dll.)",
      "scheduled — terjadwal di WordPress",
      "failed — gagal (timeout/provider); gunakan Coba lagi",
    ],
    tipsTitle: "Tips & troubleshooting",
    tips: [
      {
        t: "Optimasi lama / stuck processing",
        d: "Provider lambat atau timeout (mis. HTTP 524). Buka detail → Coba lagi, ganti model yang lebih cepat, atau turunkan max tokens.",
      },
      {
        t: "Error stack depth / 54001",
        d: "Rekursi RLS Supabase. App memakai service role setelah auth; pastikan migrasi 003_fix_rls_recursion.sql dijalankan.",
      },
      {
        t: "Impor URL/RSS gagal",
        d: "Cek URL publik, bukan paywall. Feed harus RSS/Atom valid. Ringkasan RSS dipakai jika full page gagal.",
      },
      {
        t: "Jadwal tidak tayang di WordPress",
        d: "Cek Application Password, status Scheduled di WP Admin, dan WP-Cron (atau system cron ke wp-cron.php).",
      },
      {
        t: "Prinsip editorial",
        d: "Aieo merapikan, tidak mengarang. Selalu bandingkan dengan draf asli sebelum publish.",
      },
    ],
  };
}
