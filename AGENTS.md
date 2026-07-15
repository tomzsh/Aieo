# AGENTS.md — AI agent guide for Aieo

This file is for **AI coding agents** (Cursor, Claude Code, Copilot, Grok, Codex, etc.).  
Human-facing docs: [README.md](./README.md) (English) · [README.id.md](./README.id.md) (Indonesian).

---

## Project identity

| | |
|---|---|
| **Name** | Aieo (AI News SEO Optimizer) |
| **Purpose** | Newsroom tool: raw draft → LLM SEO optimize/paraphrase → review → WordPress publish |
| **Repo** | https://github.com/tomzsh/Aieo |
| **Status** | Early / alpha — prefer safe, reversible changes |
| **License** | MIT |

**Not** a CMS. WordPress remains the CMS; Aieo prepares content and pushes via REST.

---

## Stack (do not reinvent)

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 16** App Router (`src/app/`) |
| UI | **React 19** + **Tailwind CSS 4** (`@import "tailwindcss"`, class dark mode) |
| Auth / DB | **Supabase** (Auth, Postgres, RLS) |
| LLM | **OpenAI-compatible** client (`openai` package) — multi-provider |
| WP | **WordPress REST** + Application Passwords |
| Validation | **Zod** (`src/lib/llm/schema.ts`) |
| i18n | Custom cookie + `LocaleProvider` (`src/lib/i18n/`) — **ID + EN** |

Package manager: **npm**. Node **20+**.

---

## Commands

```bash
npm install
cp .env.example .env.local   # never commit .env.local
npm run dev                  # http://localhost:3000
npm run build
npm run start
npm run lint
npm run typecheck            # tsc --noEmit
npm run seed:prompt-v2       # needs .env.local + Supabase
npm run seed:prompt-v3
```

After non-trivial edits, run **`npm run typecheck`**. Prefer `typecheck` over full `build` when iterating (build is slow).

---

## Environment (secrets)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only** — never expose to client |
| `AIEO_ENCRYPTION_KEY` | recommended | At-rest crypto for WP/LLM secrets |
| `*_API_KEY` / base URLs | optional | LLM providers; see `.env.example` |
| `NEXT_PUBLIC_GITHUB_URL` | optional | Footer link |

**Never** commit `.env.local`, service role keys, or Application Passwords.

---

## Architecture map

```
src/app/
  (app)/           # authenticated UI (dashboard, articles, jobs, settings, docs)
  api/             # Route Handlers — business logic entry for mutations
  login|signup/    # auth pages
  page.tsx         # public landing
src/components/    # shell, sidebar, footer, theme, locale, UI primitives
src/lib/
  llm/             # providers, optimize schema, image generate
  jobs/            # enqueue + processOptimizeJob
  wordpress/       # REST client, featured image, URL helpers
  supabase/        # client / server / middleware helpers
  i18n/            # messages + LocaleProvider
  crypto/          # encryptSecret / decryptSecret
  import/          # URL/RSS + SSRF guard
src/middleware.ts  # session + route protection (timeout-safe)
supabase/migrations/  # 001 → 008 SQL (run in order on Supabase)
```

### Data flow (optimize)

1. UI → `POST /api/articles/optimize`  
2. `enqueueOptimize` → row in `jobs` + article  
3. Worker `POST /api/jobs/[job_id]/process` → `processOptimizeJob`  
4. LLM via `generateWithFallback` → Zod schema → post-process validator  
5. Article `optimized` JSON + status `ready` / `flagged`

### Data flow (publish)

1. UI → `POST /api/articles/[id]/publish`  
2. Load default/selected `wordpress_sites`  
3. Featured image: existing media id → URL → auto-generate (image model)  
4. `WordPressClient` REST (discovers `/wp-json` | `index.php/wp-json` | `?rest_route=`)  
5. Create post + optional SEO meta (Yoast/Rank Math)

---

## Key modules (where to edit)

| Task | Start here |
|------|------------|
| New API endpoint | `src/app/api/**/route.ts` |
| Optimize pipeline | `src/lib/jobs/optimize.ts`, `src/lib/llm/provider.ts` |
| LLM JSON schema | `src/lib/llm/schema.ts` |
| Prompt templates | `src/lib/llm/templates/*`, settings prompts API |
| Image generate/edit | `src/lib/llm/image-generate.ts`, `image-models.ts` |
| Image bytes safety | `src/lib/wordpress/featured-image.ts` (magic bytes, strip EXIF) |
| WP REST client | `src/lib/wordpress/client.ts` |
| Auth middleware | `src/lib/supabase/middleware.ts` |
| i18n strings | `src/lib/i18n/messages.ts`, `page-messages.ts` |
| Domain types | `src/lib/types.ts` |
| Theme (no FOUC) | `src/components/theme-provider.tsx`, `layout.tsx` script |

---

## Conventions for agents

### Do

- Match existing patterns (App Router, server routes for secrets, client pages for UI).  
- Keep **UI bilingual**: add keys to both `id` and `en` in i18n files.  
- Use **`getAuthedContext`** / workspace helpers for API auth.  
- Decrypt secrets with `decryptSecret` only on server.  
- Prefer **small, focused diffs**; no drive-by refactors.  
- After schema SQL changes, add a new migration `00N_*.sql` — never rewrite old migrations that may already be applied.  
- For images: always validate **magic bytes** before WP upload.  
- For local WP: allow HTTP; support REST fallbacks (pretty / index.php / `rest_route`).

### Don’t

- Don’t put service role or raw API keys in client components.  
- Don’t assume every chat model can generate images.  
- Don’t use `Github` from `lucide-react` (not exported) — use `src/components/github-icon.tsx`.  
- Don’t commit `AGENTS.md` secrets or `.env.local`.  
- Don’t force-push / destructive git unless the user explicitly asks.

### Theme / CSS

- Dark mode is **class-based**: `html.light` | `html.dark` exclusively.  
- Tailwind v4: `@custom-variant dark (&:where(.dark, .dark *));`  
- Prefer `dark:` utilities + existing CSS variables in `globals.css`.

### i18n

- Cookie `aieo-locale` + `localStorage` key `aieo-locale`.  
- SSR reads cookie in root layout → `LocaleProvider initialLocale`.  
- New copy: update **both** locales or the UI will show raw keys / English only.

---

## Database

Migrations **must run in order** on Supabase SQL Editor:

1. `001_initial_schema.sql` — core tables, RLS  
2. `002_llm_custom_endpoint.sql`  
3. `003_fix_rls_recursion.sql`  
4. `004_prompt_template_v2.sql`  
5. `005_article_schedule.sql`  
6. `006_sources_and_job_meta.sql`  
7. `007_featured_image.sql`  
8. `008_llm_image_settings.sql`  

Core concepts: `workspaces`, `workspace_members`, `articles`, `jobs`, `wordpress_sites`, `llm_settings`, `prompt_templates`.

Article optimized payload is JSON (`OptimizedArticle` in `src/lib/types.ts`).

---

## WordPress gotchas (local)

1. `define('WP_ENVIRONMENT_TYPE', 'local');` for Application Passwords over HTTP.  
2. Permalinks → Post name (or use client REST discovery fallback).  
3. Draft posts do **not** appear on homepage → check WP Admin Drafts.  
4. Application Password ≠ login password.

---

## Image generation gotchas

- Chat models ≠ image models. Use `image_model` / Settings image section.  
- Pollinations free tier rate-limits; responses can be JSON — **reject non-image bytes**.  
- Strip JPEG EXIF before upload (Pollinations embeds prompt JSON in EXIF).  
- Edit/img2img needs models that support `/images/edits` (e.g. DALL·E 2, GPT Image 1).

---

## Auth & middleware

- `src/middleware.ts` → `updateSession` in `src/lib/supabase/middleware.ts`.  
- Public routes: `/`, `/login`, `/signup`, `/docs`, `/api/health`.  
- Skip Supabase network call when no auth cookie; **timeout** `getUser()` (~4s) to avoid blank hung pages.  
- Do not remove the timeout without a better hang-prevention strategy.

---

## Testing checklist (agent)

Before claiming done:

1. `npm run typecheck` clean  
2. No secrets in diff  
3. New UI strings in EN + ID  
4. API routes still auth-gated (except health)  
5. If touching WP/images: magic-byte validation still present  

Optional: `curl -s http://localhost:3000/api/health`

---

## Docs index

| Doc | Audience |
|-----|----------|
| [README.md](./README.md) | Humans (English, primary) |
| [README.id.md](./README.id.md) | Humans (Indonesian) |
| [AGENTS.md](./AGENTS.md) | AI coding agents (this file) |
| [CLAUDE.md](./CLAUDE.md) | Claude Code pointer → this file |
| In-app `/docs` | End-user product docs |
| `.env.example` | Env template |

---

## Preferred PR / commit style

- Imperative subject: `fix:`, `feat:`, `docs:`, `chore:`  
- Explain **why** in body when non-obvious.  
- One logical change per commit when possible.

When stuck, re-read this file and `src/lib/types.ts` before inventing new domain models.
