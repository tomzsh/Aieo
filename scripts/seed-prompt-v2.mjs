/**
 * Activate prompt template v2 on all workspaces (via service role).
 * Usage: node --env-file=.env.local scripts/seed-prompt-v2.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tplPath = join(
  __dirname,
  "../src/lib/llm/templates/v2-news-seo-editor.ts"
);
const src = readFileSync(tplPath, "utf8");
const m = src.match(
  /export const PROMPT_TEMPLATE_V2_SYSTEM = `([\s\S]*?)`;/
);
if (!m) {
  console.error("Cannot parse PROMPT_TEMPLATE_V2_SYSTEM");
  process.exit(1);
}
const systemPrompt = m[1].trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: workspaces, error: werr } = await sb
  .from("workspaces")
  .select("id, name");
if (werr) throw werr;

for (const ws of workspaces ?? []) {
  await sb
    .from("prompt_templates")
    .update({ is_active: false })
    .eq("workspace_id", ws.id)
    .eq("is_active", true);

  const { data: latest } = await sb
    .from("prompt_templates")
    .select("version")
    .eq("workspace_id", ws.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data, error } = await sb
    .from("prompt_templates")
    .insert({
      workspace_id: ws.id,
      version: nextVersion,
      name: "news-seo-editor-v2",
      system_prompt: systemPrompt,
      is_active: true,
    })
    .select("id, version, name, is_active")
    .single();

  if (error) {
    console.error("FAIL", ws.name, error.message);
  } else {
    console.log("OK", ws.name, data);
  }
}

console.log("Done. Active template: news-seo-editor-v2");
