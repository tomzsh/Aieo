# Aieo

**AI News SEO Optimizer & WordPress Publisher**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Status](https://img.shields.io/badge/status-early%20%2F%20alpha-orange)](#disclaimer)
[![GitHub](https://img.shields.io/badge/github-tomzsh%2FAieo-181717?logo=github)](https://github.com/tomzsh/Aieo)

Aieo membantu redaksi mengubah **draf berita mentah** menjadi **artikel SEO-ready**, lalu **publish / jadwalkan ke WordPress** — dalam satu alur kerja.

| | |
|---|---|
| **Repo** | https://github.com/tomzsh/Aieo |
| **Bahasa UI** | Indonesia (ID) · English (EN) |
| **Stack** | Next.js 16 · React 19 · Supabase · Tailwind 4 · WordPress REST |
| **Versi** | `0.1.0` (early development) |

---

## Daftar isi

1. [Disclaimer](#disclaimer)
2. [Apa itu Aieo?](#apa-itu-aieo)
3. [Fitur](#fitur)
4. [Arsitektur singkat](#arsitektur-singkat)
5. [Persyaratan](#persyaratan)
6. [Instalasi & setup](#instalasi--setup)
7. [Variabel lingkungan](#variabel-lingkungan)
8. [Migrasi database](#migrasi-database)
9. [Konfigurasi LLM](#konfigurasi-llm)
10. [Konfigurasi WordPress](#konfigurasi-wordpress)
11. [Featured image](#featured-image)
12. [Alur kerja harian](#alur-kerja-harian)
13. [Script npm](#script-npm)
14. [Struktur repo](#struktur-repo)
15. [Troubleshooting](#troubleshooting)
16. [Keamanan](#keamanan)
17. [Kontribusi](#kontribusi)
18. [Lisensi](#lisensi)

---

## Disclaimer

> **Early / alpha — belum production-hardened.**  
> Masih ada bug, fitur belum stabil, dan perubahan bisa merusak (breaking).  
> Review sendiri sebelum publish ke WordPress **live** atau memakai kuota API berbayar.  
> Gunakan dengan tanggung jawab sendiri.

**English:** This project is under active development. Expect bugs, incomplete features, and breaking changes. Do not treat it as production-ready without your own review and hardening.

Area yang sering rewel:

| Area | Risiko |
|------|--------|
| WordPress lokal (HTTP / Plain permalinks) | REST `/wp-json/` 404; Application Passwords butuh `WP_ENVIRONMENT_TYPE=local` |
| Generate gambar gratis (Pollinations) | Rate limit; kadang JSON metadata, bukan file gambar |
| Gateway LLM multi-provider | Endpoint/model tidak seragam; timeout model besar |
| Job optimasi panjang | Butuh tab/job worker tetap hidup sampai selesai |

---

## Apa itu Aieo?

Aieo (AI News SEO Optimizer) adalah **tool internal redaksi**:

```
Draf mentah  →  Optimasi / parafrase (LLM)  →  Review + SEO  →  WordPress
   (paste / URL / RSS)     (job async)         (edit, image)    (draft / publish / schedule)
```

**Bukan** CMS pengganti WordPress. Aieo fokusiapkan naskah, lalu mengirim ke WP lewat REST API.

### English summary

Internal newsroom tool: paste or import a draft → run SEO optimize or paraphrase via your LLM → review scores, diff, social captions, featured image → publish or schedule to WordPress.

---

## Fitur

### Konten & SEO

| Fitur | Keterangan |
|-------|------------|
| **Optimasi SEO** | Judul, slug, meta, outline, body, keyword, skor SEO |
| **Parafrase** | Mode rewrite lebih kuat (template v4) |
| **Prompt template** | Versi template per workspace (v2/v3 seed scripts) |
| **Validasi pasca-LLM** | Post-process + jaga agar tidak mengarang fakta liar |
| **Diff draf vs hasil** | Highlight kata + skor kemiripan / orisinalitas |
| **Histori versi** | Simpan versi optimasi + restore |

### Input

| Sumber | Keterangan |
|--------|------------|
| Tempel teks | Form optimasi baru |
| URL artikel | Extract isi (dengan guard SSRF) |
| RSS | Import feed + opsi batch |

### WordPress

| Fitur | Keterangan |
|-------|------------|
| Draft / Publish / Pending | Mode status WP |
| Schedule | Post `future` + tanggal |
| Kategori & tag | Sync kategori; auto create tag |
| Meta SEO | Yoast + Rank Math (jika plugin aktif di REST) |
| Featured image | URL, upload, generate, edit (image-to-image) |
| Multi-situs | Beberapa site per workspace; satu default |
| Lokal | HTTP + localhost didukung untuk testing |

### Operasional

| Fitur | Keterangan |
|-------|------------|
| Antrian job | Status queued / running / completed / failed |
| Claim-lock | Satu worker proses satu job |
| Retry | Ulang optimasi yang gagal |
| Kelola data | Stats + cleanup job/artikel |
| Bulk delete | Hapus banyak artikel |
| Tema gelap/terang | Class `html.light` / `html.dark` |
| Bahasa UI | Toggle **ID \| EN** (cookie + localStorage) |
| Enkripsi rahasia | WP app password & API key at-rest |

---

## Arsitektur singkat

```
Browser (Next.js App Router)
    │
    ├─ Auth session ──────────► Supabase Auth
    ├─ Data (RLS) ────────────► Supabase Postgres
    ├─ LLM optimize ──────────► OpenAI-compatible API (xAI, OpenAI, OpenRouter, Ollama, …)
    └─ Publish / media ───────► WordPress REST (/wp-json or ?rest_route=)
```

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS 4 |
| Auth & DB | Supabase (Postgres, Auth, RLS, service role server-only) |
| LLM | SDK OpenAI-compatible (`openai` package) |
| WP | REST API + Application Passwords |
| Secrets | `AIEO_ENCRYPTION_KEY` (AES-style at-rest di app) |

---

## Persyaratan

- **Node.js** 20+ (disarankan 22)
- **npm** 10+
- Akun **Supabase** (project + SQL Editor)
- Opsional: **WordPress** 6.x (lokal atau remote) + user Editor/Admin
- Opsional: API key LLM (xAI, OpenAI, dll.) atau gateway lokal (Ollama / OmniRoute)

---

## Instalasi & setup

### 1. Clone & install

```bash
git clone https://github.com/tomzsh/Aieo.git
cd Aieo
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Isi minimal (wajib):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Opsional tapi disarankan:

```env
AIEO_ENCRYPTION_KEY=   # openssl rand -hex 32
XAI_API_KEY=           # atau OPENAI_API_KEY / provider lain
```

### 3. Database (migrasi)

Di **Supabase → SQL Editor**, jalankan file di `supabase/migrations/` **berurutan** dari `001` sampai `008` (lihat [Migrasi database](#migrasi-database)).

### 4. Auth Supabase

1. Supabase → **Authentication** → aktifkan Email/Password  
2. (Dev) Nonaktifkan “Confirm email” jika ingin signup langsung login  
3. Daftar user pertama lewat `/signup` di Aieo  

### 5. Jalankan app

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

| Halaman | Path |
|---------|------|
| Landing | `/` |
| Login / daftar | `/login` · `/signup` |
| Dashboard | `/dashboard` |
| Artikel | `/articles` · `/articles/new` |
| Job | `/jobs` |
| Settings | `/settings/llm` · `/settings/wordpress` · … |
| Docs in-app | `/docs` |

### 6. Production build

```bash
npm run build
npm run start
```

---

## Variabel lingkungan

File referensi: [`.env.example`](./.env.example)  
**Jangan commit** `.env.local`.

### Wajib

| Variabel | Fungsi |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key (browser + middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (**server only**) |

### Disarankan

| Variabel | Fungsi |
|----------|--------|
| `AIEO_ENCRYPTION_KEY` | Enkripsi password WP & API key di DB. Generate: `openssl rand -hex 32` |

### LLM (pilih yang dipakai)

| Variabel | Provider / catatan |
|----------|-------------------|
| `XAI_API_KEY` | xAI Grok |
| `OPENAI_API_KEY` | OpenAI (chat + image) |
| `OPENROUTER_API_KEY` | OpenRouter multi-model |
| `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`, … | Third-party |
| `OMNIROUTE_BASE_URL` | Gateway lokal (default `http://127.0.0.1:20128/v1`) |
| `OLLAMA_BASE_URL` | Ollama OpenAI-compat |
| `LLM_TIMEOUT_MS` | Timeout request LLM (ms) |

### Opsional UI

| Variabel | Fungsi |
|----------|--------|
| `NEXT_PUBLIC_GITHUB_URL` | Link footer GitHub (default: repo ini) |

Pengaturan provider/model **per workspace** juga bisa diisi di UI: **Settings → LLM** (tanpa hardcode di env).

---

## Migrasi database

Jalankan **urut** di Supabase SQL Editor:

| # | File | Isi |
|---|------|-----|
| 1 | `001_initial_schema.sql` | Schema inti: workspace, artikel, job, WP sites, RLS, seed settings |
| 2 | `002_llm_custom_endpoint.sql` | `base_url`, `api_key`, fallback LLM |
| 3 | `003_fix_rls_recursion.sql` | Perbaikan rekursi RLS membership |
| 4 | `004_prompt_template_v2.sql` | Template prompt v2 + seed |
| 5 | `005_article_schedule.sql` | Kolom jadwal publish |
| 6 | `006_sources_and_job_meta.sql` | Sumber import + meta job |
| 7 | `007_featured_image.sql` | URL / media id featured image |
| 8 | `008_llm_image_settings.sql` | Model image terpisah dari chat |

Kalau error “column does not exist”, biasanya migrasi belakangan belum dijalankan.

---

## Konfigurasi LLM

1. Buka **Settings → LLM**  
2. Pilih **provider** (xAI, OpenAI, OpenRouter, custom, Ollama, …)  
3. Isi **Base URL** jika custom / proxy  
4. Isi **API key** (workspace) **atau** andalkan env  
5. Pilih **model** (list dari `GET /models` jika endpoint support)  
6. **Tes koneksi**  
7. Opsional: fallback provider/model  

### Section Featured image (generate)

Di halaman LLM yang sama ada pengaturan **image model** terpisah (chat ≠ image):

| Opsi | Contoh |
|------|--------|
| Gratis | `pollinations/flux` (tanpa API key; rate limit) |
| OpenAI | `dall-e-3`, `gpt-image-1`, `dall-e-2` (edit) |
| Lain | FLUX di Together, model image di gateway kamu |

**Edit / image-to-image** butuh model yang support Images Edit API (mis. DALL·E 2 / GPT Image 1), bukan Pollinations.

---

## Konfigurasi WordPress

### Remote (HTTPS)

1. User **Editor** atau **Administrator**  
2. **Users → Profile → Application Passwords** → buat password app (bukan password login)  
3. Di Aieo → **Settings → WordPress**:  
   - Base URL: `https://situsmu.com` (tanpa `/wp-admin`)  
   - Username + Application Password  
4. **Tes** → harus hijau **TERHUBUNG · SIAP PUBLISH**  
5. **Simpan** (set default)

### Lokal (HTTP, mis. Docker `localhost:8080`)

1. Di `wp-config.php`:

   ```php
   define('WP_ENVIRONMENT_TYPE', 'local');
   ```

2. Permalinks: **Settings → Permalinks → Post name → Save**  
   (supaya `/wp-json/` hidup; Aieo juga fallback `/?rest_route=` / `index.php/wp-json`)  
3. Application Password di profil user  
4. Base URL Aieo: `http://localhost:8080`  
5. **Tes** → hijau **TERHUBUNG · LOKAL · SIAP PUBLISH**

### Setelah publish

| Mode | Di mana cari post |
|------|-------------------|
| **Draft** | WP Admin → Posts → **Drafts** (bukan homepage) |
| **Publish** | Posts → Published + link “Buka post” di Aieo |
| **Schedule** | Posts → Scheduled |

---

## Featured image

Urutan prioritas saat publish (jika centang featured image aktif):

1. Media WP id yang sudah tersimpan  
2. URL / file yang sudah di-set di tab Sosial  
3. **Auto-generate** dari `featured_image_prompt` pakai model image di Settings  

Di tab **Sosial** artikel:

| Aksi | Fungsi |
|------|--------|
| Pilih model image + size | Generate pakai model itu |
| Generate | Text-to-image dari prompt |
| Upload jadi featured | Set file langsung |
| Upload & edit | Image-to-image (model harus support edit) |
| URL | Tempel URL gambar publik |

Generate divalidasi magic-bytes (JPEG/PNG/WebP/GIF) agar JSON error (mis. Pollinations rate-limit) **tidak** ter-upload sebagai “gambar”.

---

## Alur kerja harian

1. **Settings → LLM** — model optimasi + (opsional) model image  
2. **Settings → WordPress** — Tes sampai hijau  
3. **Artikel → Baru** — tempel draf / import URL / RSS  
4. Pilih mode **Optimasi** atau **Parafrase** → jalankan  
5. Pantau **Jobs** sampai completed  
6. Buka artikel → review judul, body, skor, diff, caption sosial  
7. Set / generate **featured image**  
8. **Publish** dengan mode yang diinginkan  
9. Cek di WP Admin lewat tombol sukses di Aieo  

Dokumentasi lebih panjang ada di app: **`/docs`**.

---

## Script npm

| Perintah | Keterangan |
|----------|------------|
| `npm run dev` | Dev server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve hasil build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run seed:prompt-v2` | Seed template prompt v2 (butuh `.env.local`) |
| `npm run seed:prompt-v3` | Seed template prompt v3 |

---

## Struktur repo

```
Aieo/
├── README.md
├── LICENSE                 # MIT
├── package.json
├── .env.example            # template env (tanpa secret)
├── public/
├── scripts/                # seed prompt templates
├── supabase/
│   ├── config.toml
│   └── migrations/         # 001 … 008 (jalankan berurutan)
└── src/
    ├── middleware.ts       # session Supabase + proteksi route
    ├── app/
    │   ├── (app)/          # dashboard, articles, jobs, settings, docs
    │   ├── api/            # REST handlers (articles, jobs, settings, WP)
    │   ├── login/ signup/
    │   ├── layout.tsx
    │   └── page.tsx        # landing
    ├── components/         # shell, footer, theme, locale, UI
    └── lib/
        ├── i18n/           # pesan ID/EN
        ├── llm/            # provider, schema, image generate
        ├── jobs/           # enqueue + process optimize
        ├── wordpress/      # client REST, featured image, URL helpers
        ├── import/         # URL / RSS + SSRF guard
        ├── supabase/       # client, server, middleware helpers
        └── crypto/         # enkripsi secret at-rest
```

---

## Troubleshooting

| Gejala | Cek |
|--------|-----|
| Halaman **blank putih** lama | Compile dev pertama bisa 10–40 dtk; hard refresh (`Ctrl+Shift+R`). Middleware tidak boleh hang di Supabase (sudah ada timeout). |
| Signup/login gagal | Supabase Auth Email aktif; cek URL + anon key |
| Optimasi gagal | Settings LLM: key, base URL, model; cek tab Jobs untuk error |
| WP **GAGAL TERHUBUNG** | Base URL, REST (`/wp-json/` atau `?rest_route=/`), Application Password, role user |
| App Password “butuh HTTPS” di lokal | `define('WP_ENVIRONMENT_TYPE', 'local');` di `wp-config.php` |
| Publish “tidak muncul” | Mode **Draft** → cek Posts → Drafts, bukan homepage |
| Generate gambar jadi teks JSON | Rate-limit Pollinations; ganti model image (mis. DALL·E) atau coba lagi |
| Kolom DB error | Jalankan migrasi 001→008 yang belum dijalankan |

Health check (tanpa auth):

```bash
curl -s http://localhost:3000/api/health
```

---

## Keamanan

- Jangan commit `.env.local` atau service role key  
- `SUPABASE_SERVICE_ROLE_KEY` hanya di server (API routes)  
- Import URL/RSS memblokir host privat (SSRF)  
- Application Password WP & API key LLM dienkripsi di DB jika `AIEO_ENCRYPTION_KEY` (atau turunan service role) tersedia  
- RLS Supabase membatasi data per workspace  

---

## Kontribusi

Issue & PR dipersilakan di [GitHub](https://github.com/tomzsh/Aieo).

Saat melapor bug, sertakan:

- OS / Node version  
- Provider LLM & model  
- WordPress lokal atau remote  
- Log error dari UI / Jobs / Network  

Jangan lampirkan API key atau Application Password.

---

## Lisensi

[MIT](./LICENSE) © [tomzsh](https://github.com/tomzsh) and contributors.

---

**Aieo** · early release · [github.com/tomzsh/Aieo](https://github.com/tomzsh/Aieo)
