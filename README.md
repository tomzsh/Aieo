# Aieo

**AI News SEO Optimizer & WordPress Publisher**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Status](https://img.shields.io/badge/status-early%20development-orange)](#disclaimer--peringatan)

Internal editorial tool: raw news draft → SEO-ready article → publish/schedule to WordPress.  
Postgres & Auth via Supabase. UI: **Indonesia (ID)** | **English (EN)**.

**Repository:** [github.com/tomzsh/aieo](https://github.com/tomzsh/aieo)

---

## Disclaimer / Peringatan

> **This project is under active development (early / alpha).**  
> There may be **bugs**, incomplete features, rough edges, or **breaking changes**.  
> Do **not** treat it as production-hardened software without your own review, tests, and hardening.  
> Use at your own risk — especially when publishing to live WordPress sites or spending LLM API credits.

> **Proyek ini masih dalam pengembangan aktif (early / alpha).**  
> Mungkin ada **bug**, fitur belum selesai, UI kasar, atau **perubahan yang merusak**.  
> Jangan anggap siap produksi tanpa review, pengujian, dan pengamanan sendiri.  
> Gunakan dengan tanggung jawab sendiri — terutama saat publish ke WordPress live atau memakai kuota API LLM.

Known areas that can be finicky: WordPress REST on local/plain permalinks, free image providers (rate limits / metadata), multi-provider LLM gateways, and long-running optimize jobs.

---

## Bahasa Indonesia

Tool internal redaksi: draf berita mentah → artikel SEO-ready → publish/jadwalkan ke WordPress.

### Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Supabase (Postgres, Auth, RLS)
- LLM multi-provider (OpenAI-compatible, xAI, OpenRouter, Ollama, …)
- WordPress REST API (+ Application Passwords)

### Mulai cepat

```bash
cp .env.example .env.local
# isi NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY
# opsional: AIEO_ENCRYPTION_KEY, XAI_API_KEY / OPENAI_API_KEY, …

# Supabase SQL Editor — jalankan berurutan:
#   supabase/migrations/001_initial_schema.sql
#   … sampai 008_llm_image_settings.sql

npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) · Docs in-app: `/docs`

### Fitur utama

- Optimasi SEO & parafrase (job async + claim-lock)
- Import draf: tempel, URL, RSS (+ batch)
- Antrian job, cleanup data, multi-select hapus artikel
- Diff highlight draf vs hasil + skor kemiripan/orisinalitas
- Histori versi + restore
- WordPress draft / publish / schedule + meta Yoast/Rank Math
- Featured image (URL / upload / generate via model image atau Pollinations) → Media WP
- Cari & pagination daftar artikel
- Mode gelap/terang + switch bahasa **ID | EN**
- Enkripsi at-rest untuk kredensial (`AIEO_ENCRYPTION_KEY`)

### Keamanan

- Jangan commit `.env.local`
- Service role hanya server-side
- Impor URL/RSS memblokir host privat (SSRF)
- Password WP & API key LLM dienkripsi at-rest (jika key diset)

---

## English

Internal newsroom tool: raw draft → SEO-ready article → publish/schedule to WordPress.

### Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- Supabase (Postgres, Auth, RLS)
- Multi-provider LLM (OpenAI-compatible, xAI, OpenRouter, Ollama, …)
- WordPress REST API (+ Application Passwords)

### Quick start

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY
# optional: AIEO_ENCRYPTION_KEY, LLM API keys, …

# Run SQL migrations 001 → 008 in Supabase SQL Editor

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) · In-app docs: `/docs`

### Main features

- SEO optimize & paraphrase (async jobs with claim-lock)
- Ingest via paste, URL, RSS (+ batch)
- Job queue, data cleanup, bulk article delete
- Word-level diff + originality/similarity score
- Version history + restore
- WordPress draft / publish / schedule + Yoast/Rank Math meta
- Featured image (URL / upload / LLM or free image models) → WP Media
- Article search & pagination
- Dark/light theme + **ID | EN** language switch
- At-rest encryption for secrets (`AIEO_ENCRYPTION_KEY`)

### Security

- Do not commit `.env.local`
- Service role key is server-only
- URL/RSS import blocks private hosts (SSRF guard)
- WP app passwords & LLM API keys encrypted at rest when configured

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run seed:prompt-v2` | Seed prompt template v2 |
| `npm run seed:prompt-v3` | Seed prompt template v3 |

## Migrations

Run in order under `supabase/migrations/`:

1. `001_initial_schema.sql`
2. `002_llm_custom_endpoint.sql`
3. `003_fix_rls_recursion.sql`
4. `004_prompt_template_v2.sql`
5. `005_article_schedule.sql`
6. `006_sources_and_job_meta.sql`
7. `007_featured_image.sql`
8. `008_llm_image_settings.sql`

## Repo layout

```
src/
  app/                 # App Router + API routes
  components/          # Shell, footer, theme, locale
  lib/
    i18n/              # EN/ID messages
    llm/ jobs/ import/ wordpress/ crypto/ …
supabase/migrations/
scripts/
```

## Environment

See [`.env.example`](./.env.example). Optional:

```bash
# Public GitHub link in UI footer (default: https://github.com/tomzsh/aieo)
# NEXT_PUBLIC_GITHUB_URL=https://github.com/your-user/your-repo
```

## Contributing

Issues and PRs welcome on GitHub. Please keep secrets out of commits and describe environment (local WP, LLM provider) when reporting bugs.

## License

[MIT](./LICENSE) — © tomzsh / contributors.
