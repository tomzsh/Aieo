# Aieo

**AI News SEO Optimizer & WordPress Publisher**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Status](https://img.shields.io/badge/status-early%20%2F%20alpha-orange)](#disclaimer)
[![GitHub](https://img.shields.io/badge/github-tomzsh%2FAieo-181717?logo=github)](https://github.com/tomzsh/Aieo)

> **Bahasa Indonesia:** see [README.id.md](./README.id.md)  
> **AI coding agents:** see [AGENTS.md](./AGENTS.md) (Claude: [CLAUDE.md](./CLAUDE.md))

Turn **raw news drafts** into **SEO-ready articles**, then **publish or schedule to WordPress** — one editorial workflow.

| | |
|---|---|
| **Repository** | https://github.com/tomzsh/Aieo |
| **UI languages** | English (EN) · Indonesian (ID) |
| **Stack** | Next.js 16 · React 19 · Supabase · Tailwind 4 · WordPress REST |
| **Version** | `0.1.0` (early development) |

---

## Table of contents

1. [Disclaimer](#disclaimer)
2. [What is Aieo?](#what-is-aieo)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Requirements](#requirements)
6. [Installation & setup](#installation--setup)
7. [Environment variables](#environment-variables)
8. [Database migrations](#database-migrations)
9. [LLM configuration](#llm-configuration)
10. [WordPress configuration](#wordpress-configuration)
11. [Featured image](#featured-image)
12. [Daily workflow](#daily-workflow)
13. [npm scripts](#npm-scripts)
14. [Repository layout](#repository-layout)
15. [Troubleshooting](#troubleshooting)
16. [Security](#security)
17. [Contributing](#contributing)
18. [License](#license)

---

## Disclaimer

> **Early / alpha — not production-hardened.**  
> Expect **bugs**, incomplete features, rough edges, and **breaking changes**.  
> Review carefully before publishing to a **live** WordPress site or spending paid LLM credits.  
> Use at your own risk.

Areas that often need extra care:

| Area | Risk |
|------|------|
| Local WordPress (HTTP / plain permalinks) | REST `/wp-json/` may 404; Application Passwords need `WP_ENVIRONMENT_TYPE=local` |
| Free image generation (Pollinations) | Rate limits; sometimes JSON metadata instead of an image file |
| Multi-provider LLM gateways | Inconsistent endpoints/models; long timeouts on large models |
| Long optimize jobs | Keep the app/job worker alive until the job finishes |

---

## What is Aieo?

Aieo is an **internal newsroom tool**:

```
Raw draft  →  Optimize / paraphrase (LLM)  →  Review + SEO  →  WordPress
 (paste / URL / RSS)      (async job)         (edit, image)    (draft / publish / schedule)
```

It is **not** a WordPress replacement. Aieo prepares the manuscript, then sends it to WordPress via the REST API.

---

## Features

### Content & SEO

| Feature | Description |
|---------|-------------|
| **SEO optimize** | Title, slug, meta, outline, body, keywords, SEO scores |
| **Paraphrase** | Stronger rewrite mode (template v4) |
| **Prompt templates** | Per-workspace template versions (v2/v3 seed scripts) |
| **Post-LLM validation** | Post-processing to reduce invented facts |
| **Draft vs result diff** | Word-level highlight + similarity / originality score |
| **Version history** | Save optimization versions + restore |

### Input

| Source | Description |
|--------|-------------|
| Paste text | New optimize form |
| Article URL | Extract content (with SSRF guard) |
| RSS | Feed import + optional batch |

### WordPress

| Feature | Description |
|---------|-------------|
| Draft / Publish / Pending | WP post status modes |
| Schedule | `future` posts with date/time |
| Categories & tags | Sync categories; auto-create tags |
| SEO meta | Yoast + Rank Math (if exposed on REST) |
| Featured image | URL, upload, generate, edit (image-to-image) |
| Multi-site | Multiple sites per workspace; one default |
| Local testing | HTTP + localhost supported |

### Operations

| Feature | Description |
|---------|-------------|
| Job queue | queued / running / completed / failed |
| Claim-lock | One worker processes one job |
| Retry | Re-run failed optimizations |
| Data management | Stats + cleanup jobs/articles |
| Bulk delete | Delete many articles |
| Dark / light theme | `html.light` / `html.dark` |
| UI language | **EN \| ID** toggle (cookie + localStorage) |
| Secret encryption | WP app passwords & API keys at rest |

---

## Architecture

```
Browser (Next.js App Router)
    │
    ├─ Auth session ──────────► Supabase Auth
    ├─ Data (RLS) ────────────► Supabase Postgres
    ├─ LLM optimize ──────────► OpenAI-compatible API (xAI, OpenAI, OpenRouter, Ollama, …)
    └─ Publish / media ───────► WordPress REST (/wp-json or ?rest_route=)
```

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS 4 |
| Auth & DB | Supabase (Postgres, Auth, RLS, service role server-only) |
| LLM | OpenAI-compatible SDK (`openai` package) |
| WordPress | REST API + Application Passwords |
| Secrets | `AIEO_ENCRYPTION_KEY` (at-rest encryption in app) |

---

## Requirements

- **Node.js** 20+ (22 recommended)
- **npm** 10+
- A **Supabase** project (with SQL Editor)
- Optional: **WordPress** 6.x (local or remote) + Editor/Admin user
- Optional: LLM API keys (xAI, OpenAI, …) or a local gateway (Ollama / OmniRoute)

---

## Installation & setup

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

Minimum required:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Recommended:

```env
AIEO_ENCRYPTION_KEY=   # openssl rand -hex 32
XAI_API_KEY=           # or OPENAI_API_KEY / another provider
```

### 3. Database migrations

In **Supabase → SQL Editor**, run files under `supabase/migrations/` **in order** from `001` through `008` (see [Database migrations](#database-migrations)).

### 4. Supabase Auth

1. Supabase → **Authentication** → enable Email/Password  
2. (Dev) Disable “Confirm email” if you want immediate login after signup  
3. Create the first user via Aieo `/signup`  

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

| Page | Path |
|------|------|
| Landing | `/` |
| Login / sign up | `/login` · `/signup` |
| Dashboard | `/dashboard` |
| Articles | `/articles` · `/articles/new` |
| Jobs | `/jobs` |
| Settings | `/settings/llm` · `/settings/wordpress` · … |
| In-app docs | `/docs` |

### 6. Production build

```bash
npm run build
npm run start
```

---

## Environment variables

Reference file: [`.env.example`](./.env.example)  
**Never commit** `.env.local`.

### Required

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key (browser + middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (**server only**) |

### Recommended

| Variable | Purpose |
|----------|---------|
| `AIEO_ENCRYPTION_KEY` | Encrypt WP passwords & API keys in DB. Generate: `openssl rand -hex 32` |

### LLM (set what you use)

| Variable | Notes |
|----------|-------|
| `XAI_API_KEY` | xAI Grok |
| `OPENAI_API_KEY` | OpenAI (chat + images) |
| `OPENROUTER_API_KEY` | OpenRouter multi-model |
| `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`, … | Third-party |
| `OMNIROUTE_BASE_URL` | Local gateway (default `http://127.0.0.1:20128/v1`) |
| `OLLAMA_BASE_URL` | Ollama OpenAI-compatible endpoint |
| `LLM_TIMEOUT_MS` | LLM request timeout (ms) |

### Optional UI

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GITHUB_URL` | Footer GitHub link (default: this repo) |

Per-workspace provider/model can also be set in the UI: **Settings → LLM**.

---

## Database migrations

Run **in order** in the Supabase SQL Editor:

| # | File | Contents |
|---|------|----------|
| 1 | `001_initial_schema.sql` | Core schema: workspace, articles, jobs, WP sites, RLS, seed settings |
| 2 | `002_llm_custom_endpoint.sql` | `base_url`, `api_key`, LLM fallback |
| 3 | `003_fix_rls_recursion.sql` | RLS membership recursion fix |
| 4 | `004_prompt_template_v2.sql` | Prompt template v2 + seed |
| 5 | `005_article_schedule.sql` | Publish schedule columns |
| 6 | `006_sources_and_job_meta.sql` | Import sources + job meta |
| 7 | `007_featured_image.sql` | Featured image URL / media id |
| 8 | `008_llm_image_settings.sql` | Image model settings (separate from chat) |

If you see “column does not exist”, a later migration was probably skipped.

---

## LLM configuration

1. Open **Settings → LLM**  
2. Choose a **provider** (xAI, OpenAI, OpenRouter, custom, Ollama, …)  
3. Set **Base URL** for custom/proxy endpoints  
4. Set **API key** (workspace) **or** rely on env vars  
5. Choose a **model** (list from `GET /models` when supported)  
6. **Test connection**  
7. Optional: fallback provider/model  

### Featured image (generate)

On the same LLM page, configure a separate **image model** (chat models ≠ image models):

| Option | Examples |
|--------|----------|
| Free | `pollinations/flux` (no API key; rate limits) |
| OpenAI | `dall-e-3`, `gpt-image-1`, `dall-e-2` (edit) |
| Other | FLUX on Together, image models on your gateway |

**Edit / image-to-image** needs a model that supports the Images Edit API (e.g. DALL·E 2 / GPT Image 1), not Pollinations.

---

## WordPress configuration

### Remote (HTTPS)

1. User role **Editor** or **Administrator**  
2. **Users → Profile → Application Passwords** → create an app password (not the login password)  
3. In Aieo → **Settings → WordPress**:  
   - Base URL: `https://yoursite.com` (no `/wp-admin`)  
   - Username + Application Password  
4. **Test** → green **CONNECTED · READY TO PUBLISH**  
5. **Save** (set as default)

### Local (HTTP, e.g. Docker `localhost:8080`)

1. In `wp-config.php`:

   ```php
   define('WP_ENVIRONMENT_TYPE', 'local');
   ```

2. Permalinks: **Settings → Permalinks → Post name → Save**  
   (so `/wp-json/` works; Aieo also falls back to `/?rest_route=` / `index.php/wp-json`)  
3. Application Password on the user profile  
4. Aieo Base URL: `http://localhost:8080`  
5. **Test** → green **CONNECTED · LOCAL · READY TO PUBLISH**

### After publish

| Mode | Where to look |
|------|----------------|
| **Draft** | WP Admin → Posts → **Drafts** (not the homepage) |
| **Publish** | Posts → Published + “Open post” link in Aieo |
| **Schedule** | Posts → Scheduled |

---

## Featured image

Publish priority (when featured image is enabled):

1. Existing WordPress media id  
2. URL / file already set on the Social tab  
3. **Auto-generate** from `featured_image_prompt` using the image model in Settings  

On the article **Social** tab:

| Action | Purpose |
|--------|---------|
| Image model + size | Generate with that model |
| Generate | Text-to-image from prompt |
| Upload as featured | Set file directly |
| Upload & edit | Image-to-image (model must support edit) |
| URL | Public image URL |

Generation validates magic bytes (JPEG/PNG/WebP/GIF) so JSON error bodies (e.g. Pollinations rate-limit) are **not** uploaded as “images”.

---

## Daily workflow

1. **Settings → LLM** — optimize model + (optional) image model  
2. **Settings → WordPress** — Test until green  
3. **Articles → New** — paste draft / import URL / RSS  
4. Choose **Optimize** or **Paraphrase** → run  
5. Watch **Jobs** until completed  
6. Open the article → review title, body, scores, diff, social captions  
7. Set / generate **featured image**  
8. **Publish** with the desired mode  
9. Check WordPress Admin via Aieo success links  

Longer docs inside the app: **`/docs`**.

---

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run seed:prompt-v2` | Seed prompt template v2 (needs `.env.local`) |
| `npm run seed:prompt-v3` | Seed prompt template v3 |

---

## Repository layout

```
Aieo/
├── README.md                 # English (this file)
├── README.id.md              # Indonesian
├── AGENTS.md                 # AI coding agents (canonical)
├── CLAUDE.md                 # Claude Code → AGENTS.md
├── LICENSE                   # MIT
├── package.json
├── .env.example              # env template (no secrets)
├── .github/copilot-instructions.md
├── public/
├── scripts/                  # prompt template seeds
├── supabase/
│   ├── config.toml
│   └── migrations/           # 001 … 008 (run in order)
└── src/
    ├── middleware.ts         # Supabase session + route protection
    ├── app/
    │   ├── (app)/            # dashboard, articles, jobs, settings, docs
    │   ├── api/              # REST handlers
    │   ├── login/ signup/
    │   ├── layout.tsx
    │   └── page.tsx          # landing
    ├── components/           # shell, footer, theme, locale, UI
    └── lib/
        ├── i18n/             # EN/ID messages
        ├── llm/              # providers, schema, image generation
        ├── jobs/             # enqueue + process optimize
        ├── wordpress/        # REST client, featured image, URL helpers
        ├── import/           # URL / RSS + SSRF guard
        ├── supabase/         # client, server, middleware helpers
        └── crypto/           # at-rest secret encryption
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| **Blank white page** for a long time | First dev compile can take 10–40s; hard refresh (`Ctrl+Shift+R`). Middleware must not hang on Supabase (timeout is in place). |
| Signup/login fails | Supabase Auth Email enabled; verify URL + anon key |
| Optimize fails | LLM settings: key, base URL, model; see Jobs tab for error |
| WP **NOT CONNECTED** | Base URL, REST (`/wp-json/` or `?rest_route=/`), Application Password, user role |
| App Password “requires HTTPS” on local | `define('WP_ENVIRONMENT_TYPE', 'local');` in `wp-config.php` |
| Publish “doesn’t appear” | **Draft** mode → Posts → Drafts, not the homepage |
| Generated image becomes JSON text | Pollinations rate-limit; switch image model (e.g. DALL·E) or retry |
| DB column errors | Run any missing migrations 001→008 |

Health check (no auth):

```bash
curl -s http://localhost:3000/api/health
```

---

## Security

- Do not commit `.env.local` or the service role key  
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (API routes)  
- URL/RSS import blocks private hosts (SSRF guard)  
- WP Application Passwords & LLM API keys are encrypted at rest when `AIEO_ENCRYPTION_KEY` (or a key derived from the service role) is available  
- Supabase RLS scopes data per workspace  

---

## AI agents

This repo is **agent-friendly**. Coding agents should start with:

| File | Purpose |
|------|---------|
| **[AGENTS.md](./AGENTS.md)** | Canonical map: stack, commands, architecture, conventions, gotchas |
| [CLAUDE.md](./CLAUDE.md) | Short pointer for Claude Code |
| [.github/copilot-instructions.md](./.github/copilot-instructions.md) | GitHub Copilot project instructions |

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/tomzsh/Aieo).

When reporting bugs, include:

- OS / Node version  
- LLM provider & model  
- WordPress local or remote  
- Error from UI / Jobs / Network  

Never paste API keys or Application Passwords.

---

## License

[MIT](./LICENSE) © [tomzsh](https://github.com/tomzsh) and contributors.

---

**Aieo** · early release · [github.com/tomzsh/Aieo](https://github.com/tomzsh/Aieo)  
**Indonesian docs:** [README.id.md](./README.id.md)
