import {
  pageMessagesEn,
  pageMessagesId,
} from "@/lib/i18n/page-messages";

export type Locale = "id" | "en";

export const LOCALES: Locale[] = ["id", "en"];
export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_STORAGE_KEY = "aieo-locale";
export const LOCALE_COOKIE = "aieo-locale";

/** Flat message catalog — keep keys stable */
const baseMessages = {
  id: {
    // Brand / meta
    "app.tagline": "AI News SEO Optimizer",
    "app.description":
      "Ubah draf berita mentah menjadi artikel siap terbit di WordPress dengan optimasi SEO.",
    "footer.disclaimer":
      "Proyek ini masih dalam pengembangan aktif. Mungkin ada bug, fitur belum stabil, atau perubahan yang merusak. Gunakan dengan hati-hati di produksi.",
    "footer.rights": "Kode sumber di GitHub.",

    // Nav
    "nav.dashboard": "Dashboard",
    "nav.dashboard.short": "Home",
    "nav.articles": "Artikel",
    "nav.articles.short": "Artikel",
    "nav.new": "Optimasi Baru",
    "nav.new.short": "Baru",
    "nav.jobs": "Antrian Job",
    "nav.jobs.short": "Job",
    "nav.docs": "Dokumentasi",
    "nav.docs.short": "Docs",
    "nav.llm": "LLM Settings",
    "nav.prompts": "Prompt Template",
    "nav.wordpress": "WordPress",
    "nav.data": "Kelola data",
    "nav.settings": "Settings",
    "nav.settings.short": "Setelan",
    "nav.signOut": "Keluar",
    "nav.openMenu": "Buka menu",
    "nav.closeMenu": "Tutup menu",
    "nav.closeOverlay": "Tutup overlay",
    "nav.main": "Navigasi utama",

    // Common
    "common.loading": "Memuat…",
    "common.save": "Simpan",
    "common.cancel": "Batal",
    "common.delete": "Hapus",
    "common.refresh": "Refresh",
    "common.error": "Terjadi kesalahan",
    "common.back": "Kembali",
    "common.optional": "opsional",
    "common.required": "wajib",
    "common.language": "Bahasa",
    "common.theme.light": "Terang",
    "common.theme.dark": "Gelap",
    "common.theme.toLight": "Aktifkan mode terang",
    "common.theme.toDark": "Aktifkan mode gelap",
    "common.locale.switch": "Ganti bahasa",
    "common.locale.id": "Indonesia",
    "common.locale.en": "English",

    // Auth
    "login.title": "Masuk",
    "login.subtitle": "Masuk ke workspace Aieo",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Masuk",
    "login.noAccount": "Belum punya akun?",
    "login.signup": "Daftar",
    "signup.title": "Daftar",
    "signup.subtitle": "Buat akun & workspace baru",
    "signup.name": "Nama lengkap",
    "signup.submit": "Buat akun",
    "signup.hasAccount": "Sudah punya akun?",
    "signup.login": "Masuk",

    // Dashboard
    "dashboard.hello": "Halo",
    "dashboard.workspace": "Workspace",
    "dashboard.workspaceMissing":
      "Workspace belum siap — pastikan migrasi Supabase sudah dijalankan.",
    "dashboard.docs": "Dokumentasi",
    "dashboard.newArticle": "Optimasi artikel",
    "dashboard.total": "Total artikel",
    "dashboard.ready": "Siap review",
    "dashboard.flagged": "Perlu review",
    "dashboard.published": "Terbit",
    "dashboard.recent": "Artikel terbaru",
    "dashboard.empty": "Belum ada artikel.",
    "dashboard.viewAll": "Lihat semua",

    // Articles
    "articles.title": "Artikel",
    "articles.desc":
      "Histori draf. Pilih lalu hapus agar data tidak menumpuk.",
    "articles.new": "Baru",
    "articles.empty": "Belum ada artikel.",
    "articles.createFirst": "Buat optimasi baru",
    "articles.allStatus": "Semua status",
    "articles.selected": "artikel dipilih",
    "articles.clearSelection": "Batal pilih",
    "articles.deleteSelected": "Hapus terpilih",
    "articles.col.title": "Judul",
    "articles.col.status": "Status",
    "articles.col.seo": "SEO",
    "articles.col.created": "Dibuat",
    "articles.col.actions": "Aksi",
    "articles.untitled": "Tanpa judul",
    "articles.needsReview": "perlu review",
    "articles.selectAll": "Pilih semua",
    "articles.loading": "Memuat artikel…",
    "articles.cleanupLink": "Pembersihan massal & filter umur:",
    "articles.cleanupSettings": "Settings → Kelola data",
    "articles.deleteConfirm":
      "Hapus artikel terpilih?\n\nJob, versi, dan log terkait ikut terhapus. Tindakan ini tidak bisa dibatalkan.",
    "articles.deleteOneConfirm":
      "Hapus artikel ini?\n\nData terkait ikut terhapus.",
    "articles.deleted": "Artikel dihapus.",
    "articles.deletedN": "artikel dihapus.",

    // New article
    "new.title.optimize": "Optimasi artikel baru",
    "new.title.paraphrase": "Parafrase artikel",
    "new.desc.optimize":
      "Impor dari URL/RSS atau tempel draf, pilih template, lalu optimasi SEO.",
    "new.desc.paraphrase":
      "Tulis ulang dari link artikel lain atau draf buatan sendiri — wording baru, fakta tetap.",
    "new.mode.optimize": "Optimasi SEO",
    "new.mode.optimize.desc":
      "Rapikan draf + metadata SEO (template workspace)",
    "new.mode.paraphrase": "Parafrase",
    "new.mode.paraphrase.desc": "Tulis ulang dari URL atau draf sendiri",
    "new.tab.paste": "Tempel teks",
    "new.tab.own": "Draf sendiri",
    "new.tab.url": "Dari URL",
    "new.tab.rss": "Dari RSS",
    "new.start.optimize": "Mulai optimasi",
    "new.start.paraphrase": "Mulai parafrase",
    "new.processing": "Memproses...",
    "new.template": "Prompt template",
    "new.manageTemplates": "Kelola template",
    "new.categories": "Kategori WordPress",
    "new.model": "Model LLM",
    "new.model.hint": "(opsional, override workspace)",
    "new.draft": "Draf artikel mentah *",
    "new.sourceText": "Teks sumber / draf sendiri *",
    "new.titleOptional": "Judul sementara (opsional)",

    // Jobs
    "jobs.title": "Antrian job",
    "jobs.desc":
      "Pantau optimasi async. Job queued yang macet akan di-kick otomatis; bisa juga dijalankan manual.",
    "jobs.allStatus": "Semua status",
    "jobs.clean": "Bersihkan",
    "jobs.run": "Jalankan",
    "jobs.article": "Artikel",
    "jobs.empty": "Belum ada job.",
    "jobs.loading": "Memuat antrian…",
    "jobs.queued": "Queued",
    "jobs.running": "Running",
    "jobs.completed": "Selesai",
    "jobs.failed": "Gagal",
    "jobs.manageData": "Kelola data",

    // Settings
    "settings.title": "Settings",
    "settings.desc": "Konfigurasi workspace Aieo.",
    "settings.llm": "LLM Provider",
    "settings.llm.desc": "Provider, model auto-get, temperature, fallback",
    "settings.prompts": "Prompt Template",
    "settings.prompts.desc": "Versioning system prompt & hard constraints",
    "settings.wordpress": "WordPress",
    "settings.wordpress.desc":
      "Situs, Application Password, tes koneksi, sync",
    "settings.data": "Kelola data",
    "settings.data.desc":
      "Hapus artikel & job menumpuk, statistik storage",
    "settings.docs": "Dokumentasi",
    "settings.docs.desc": "Panduan lengkap alur editor & admin",
    "settings.diagnostics": "Tes API & koneksi",
    "settings.diagnostics.desc":
      "Cek Supabase, daftar model LLM, dan WordPress default dalam satu klik.",
    "settings.diagnostics.run": "Jalankan diagnostics",
    "settings.diagnostics.running": "Menjalankan…",
    "settings.diagnostics.allOk": "Semua cek lulus",
    "settings.diagnostics.someFail": "Ada cek yang gagal",

    // Data settings
    "data.title": "Kelola data",
    "data.desc":
      "Hapus artikel dan job yang menumpuk agar workspace tetap rapi.",
    "data.articles": "Artikel",
    "data.jobs": "Job",
    "data.quick": "Pembersihan cepat",
    "data.custom": "Filter kustom",
    "data.previewDelete": "Preview & hapus",
    "data.manualSelect": "Pilih manual di daftar artikel",
    "data.warning":
      "Penghapusan permanen. Job/versi/log terkait artikel ikut terhapus (cascade). Artikel di WordPress tidak dihapus otomatis — hanya data di Aieo.",

    // Article detail
    "detail.notFound": "Artikel tidak ditemukan.",
    "detail.loading": "Memuat artikel…",
    "detail.save": "Simpan",
    "detail.publish": "Publish",
    "detail.retry": "Coba lagi",
    "detail.delete": "Hapus",
    "detail.tab.preview": "Preview",
    "detail.tab.seo": "SEO",
    "detail.tab.social": "Sosial",
    "detail.tab.compare": "Bandingkan",
    "detail.tab.versions": "Versi",
    "detail.tab.raw": "Draf",
    "detail.score": "Skor kualitas",
    "detail.similarity": "Kemiripan sumber",
    "detail.original": "% orisinal",
    "detail.versions": "Histori versi",
    "detail.restore": "Restore",
    "detail.needsReview": "Perlu review manual",
    "detail.processing":
      "Sedang diproses LLM. Status diperbarui otomatis — tidak perlu refresh manual.",

    // Landing
    "landing.getStarted": "Mulai",
    "landing.login": "Masuk",
    "landing.signup": "Daftar gratis",
    "landing.hero":
      "Draf berita mentah menjadi artikel SEO-ready, siap WordPress.",
    "landing.hero.sub":
      "Optimasi, parafrase, skor SEO, caption sosial, dan publish terjadwal — dalam satu alur redaksi.",

    // Diff
    "diff.removed": "Dihapus dari draf",
    "diff.added": "Ditambah di hasil",
    "diff.change": "Perubahan",
    "diff.source": "Draf asli",
    "diff.result": "Hasil",

    // Similarity verdicts
    "verdict.strong": "Parafrase kuat",
    "verdict.moderate": "Parafrase sedang",
    "verdict.weak": "Masih mirip sumber",
    "verdict.near_duplicate": "Hampir duplikat",
  },
  en: {
    "app.tagline": "AI News SEO Optimizer",
    "app.description":
      "Turn raw news drafts into WordPress-ready SEO articles.",
    "footer.disclaimer":
      "This project is under active development. Expect bugs, unstable features, and breaking changes. Use with care in production.",
    "footer.rights": "Source on GitHub.",

    "nav.dashboard": "Dashboard",
    "nav.dashboard.short": "Home",
    "nav.articles": "Articles",
    "nav.articles.short": "Articles",
    "nav.new": "New optimize",
    "nav.new.short": "New",
    "nav.jobs": "Job queue",
    "nav.jobs.short": "Jobs",
    "nav.docs": "Documentation",
    "nav.docs.short": "Docs",
    "nav.llm": "LLM Settings",
    "nav.prompts": "Prompt templates",
    "nav.wordpress": "WordPress",
    "nav.data": "Data cleanup",
    "nav.settings": "Settings",
    "nav.settings.short": "Settings",
    "nav.signOut": "Sign out",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",
    "nav.closeOverlay": "Close overlay",
    "nav.main": "Main navigation",

    "common.loading": "Loading…",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.refresh": "Refresh",
    "common.error": "Something went wrong",
    "common.back": "Back",
    "common.optional": "optional",
    "common.required": "required",
    "common.language": "Language",
    "common.theme.light": "Light",
    "common.theme.dark": "Dark",
    "common.theme.toLight": "Switch to light mode",
    "common.theme.toDark": "Switch to dark mode",
    "common.locale.switch": "Switch language",
    "common.locale.id": "Indonesia",
    "common.locale.en": "English",

    "login.title": "Sign in",
    "login.subtitle": "Sign in to your Aieo workspace",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.noAccount": "No account yet?",
    "login.signup": "Sign up",
    "signup.title": "Sign up",
    "signup.subtitle": "Create a new account & workspace",
    "signup.name": "Full name",
    "signup.submit": "Create account",
    "signup.hasAccount": "Already have an account?",
    "signup.login": "Sign in",

    "dashboard.hello": "Hello",
    "dashboard.workspace": "Workspace",
    "dashboard.workspaceMissing":
      "Workspace not ready — run Supabase migrations first.",
    "dashboard.docs": "Documentation",
    "dashboard.newArticle": "Optimize article",
    "dashboard.total": "Total articles",
    "dashboard.ready": "Ready for review",
    "dashboard.flagged": "Needs review",
    "dashboard.published": "Published",
    "dashboard.recent": "Recent articles",
    "dashboard.empty": "No articles yet.",
    "dashboard.viewAll": "View all",

    "articles.title": "Articles",
    "articles.desc":
      "Draft history. Select and delete to keep the workspace tidy.",
    "articles.new": "New",
    "articles.empty": "No articles yet.",
    "articles.createFirst": "Create a new optimization",
    "articles.allStatus": "All statuses",
    "articles.selected": "articles selected",
    "articles.clearSelection": "Clear selection",
    "articles.deleteSelected": "Delete selected",
    "articles.col.title": "Title",
    "articles.col.status": "Status",
    "articles.col.seo": "SEO",
    "articles.col.created": "Created",
    "articles.col.actions": "Actions",
    "articles.untitled": "Untitled",
    "articles.needsReview": "needs review",
    "articles.selectAll": "Select all",
    "articles.loading": "Loading articles…",
    "articles.cleanupLink": "Bulk cleanup & age filters:",
    "articles.cleanupSettings": "Settings → Data cleanup",
    "articles.deleteConfirm":
      "Delete selected articles?\n\nRelated jobs, versions, and logs will be removed. This cannot be undone.",
    "articles.deleteOneConfirm":
      "Delete this article?\n\nRelated data will be removed.",
    "articles.deleted": "Article deleted.",
    "articles.deletedN": "articles deleted.",

    "new.title.optimize": "New article optimization",
    "new.title.paraphrase": "Paraphrase article",
    "new.desc.optimize":
      "Import from URL/RSS or paste a draft, pick a template, then optimize SEO.",
    "new.desc.paraphrase":
      "Rewrite from another article link or your own draft — new wording, same facts.",
    "new.mode.optimize": "SEO optimize",
    "new.mode.optimize.desc":
      "Polish draft + SEO metadata (workspace template)",
    "new.mode.paraphrase": "Paraphrase",
    "new.mode.paraphrase.desc": "Rewrite from URL or your own draft",
    "new.tab.paste": "Paste text",
    "new.tab.own": "Own draft",
    "new.tab.url": "From URL",
    "new.tab.rss": "From RSS",
    "new.start.optimize": "Start optimization",
    "new.start.paraphrase": "Start paraphrase",
    "new.processing": "Processing...",
    "new.template": "Prompt template",
    "new.manageTemplates": "Manage templates",
    "new.categories": "WordPress categories",
    "new.model": "LLM model",
    "new.model.hint": "(optional, override workspace)",
    "new.draft": "Raw article draft *",
    "new.sourceText": "Source text / own draft *",
    "new.titleOptional": "Temporary title (optional)",

    "jobs.title": "Job queue",
    "jobs.desc":
      "Monitor async optimization. Stuck queued jobs are auto-kicked; you can also run them manually.",
    "jobs.allStatus": "All statuses",
    "jobs.clean": "Clean up",
    "jobs.run": "Run",
    "jobs.article": "Article",
    "jobs.empty": "No jobs yet.",
    "jobs.loading": "Loading queue…",
    "jobs.queued": "Queued",
    "jobs.running": "Running",
    "jobs.completed": "Completed",
    "jobs.failed": "Failed",
    "jobs.manageData": "Manage data",

    "settings.title": "Settings",
    "settings.desc": "Configure your Aieo workspace.",
    "settings.llm": "LLM Provider",
    "settings.llm.desc": "Provider, auto-fetch models, temperature, fallback",
    "settings.prompts": "Prompt templates",
    "settings.prompts.desc": "Versioned system prompts & hard constraints",
    "settings.wordpress": "WordPress",
    "settings.wordpress.desc":
      "Sites, Application Passwords, connection tests, sync",
    "settings.data": "Data cleanup",
    "settings.data.desc": "Delete piled-up articles & jobs, storage stats",
    "settings.docs": "Documentation",
    "settings.docs.desc": "Full guide for editors & admins",
    "settings.diagnostics": "API & connection tests",
    "settings.diagnostics.desc":
      "Check Supabase, LLM model list, and default WordPress in one click.",
    "settings.diagnostics.run": "Run diagnostics",
    "settings.diagnostics.running": "Running…",
    "settings.diagnostics.allOk": "All checks passed",
    "settings.diagnostics.someFail": "Some checks failed",

    "data.title": "Data cleanup",
    "data.desc": "Delete piled-up articles and jobs to keep the workspace tidy.",
    "data.articles": "Articles",
    "data.jobs": "Jobs",
    "data.quick": "Quick cleanup",
    "data.custom": "Custom filters",
    "data.previewDelete": "Preview & delete",
    "data.manualSelect": "Select manually in articles list",
    "data.warning":
      "Deletion is permanent. Related jobs/versions/logs are cascade-deleted. WordPress posts are not removed — only Aieo data.",

    "detail.notFound": "Article not found.",
    "detail.loading": "Loading article…",
    "detail.save": "Save",
    "detail.publish": "Publish",
    "detail.retry": "Retry",
    "detail.delete": "Delete",
    "detail.tab.preview": "Preview",
    "detail.tab.seo": "SEO",
    "detail.tab.social": "Social",
    "detail.tab.compare": "Compare",
    "detail.tab.versions": "Versions",
    "detail.tab.raw": "Draft",
    "detail.score": "Quality scores",
    "detail.similarity": "Source similarity",
    "detail.original": "% original",
    "detail.versions": "Version history",
    "detail.restore": "Restore",
    "detail.needsReview": "Needs manual review",
    "detail.processing":
      "LLM is processing. Status updates automatically — no need to refresh.",

    "landing.getStarted": "Get started",
    "landing.login": "Sign in",
    "landing.signup": "Sign up free",
    "landing.hero": "Raw news drafts into SEO-ready, WordPress-ready articles.",
    "landing.hero.sub":
      "Optimize, paraphrase, SEO scores, social captions, and scheduled publish — one editorial workflow.",

    "diff.removed": "Removed from draft",
    "diff.added": "Added in result",
    "diff.change": "Change",
    "diff.source": "Original draft",
    "diff.result": "Result",

    "verdict.strong": "Strong paraphrase",
    "verdict.moderate": "Moderate paraphrase",
    "verdict.weak": "Still close to source",
    "verdict.near_duplicate": "Near duplicate",
  },
} as const;

export const messages = {
  id: { ...baseMessages.id, ...pageMessagesId },
  en: { ...baseMessages.en, ...pageMessagesEn },
} as const;

export type MessageKey = keyof (typeof messages)["id"];

export function translate(
  locale: Locale,
  key: MessageKey | string,
  vars?: Record<string, string | number>
): string {
  const table = messages[locale] ?? messages.id;
  let text: string =
    (table as Record<string, string>)[key] ??
    (messages.id as Record<string, string>)[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

export function isLocale(v: unknown): v is Locale {
  return v === "id" || v === "en";
}
