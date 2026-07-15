# GitHub Copilot instructions — Aieo

Canonical agent guide: **[AGENTS.md](../AGENTS.md)** at the repo root.

## Quick rules

- Next.js 16 App Router under `src/app/`; secrets only in Route Handlers / server code.
- Supabase for auth + Postgres RLS; never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- UI is bilingual (ID + EN): update both sides in `src/lib/i18n/`.
- LLM via OpenAI-compatible API (`src/lib/llm/`); image models are separate from chat models.
- WordPress REST client in `src/lib/wordpress/client.ts` (REST path discovery for local WP).
- Validate image magic bytes before media upload (`src/lib/wordpress/featured-image.ts`).
- Run `npm run typecheck` after substantive TypeScript changes.
- Do not commit `.env.local` or rewrite applied SQL migrations; add new `00N_*.sql` files instead.

Read AGENTS.md for full architecture, commands, and checklists.
