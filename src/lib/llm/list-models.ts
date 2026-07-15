import { createLlmClient, type LlmConnection } from "@/lib/llm/provider";

export type RemoteModel = {
  id: string;
  owned_by?: string | null;
  created?: number | null;
};

/**
 * List models from an OpenAI-compatible provider via GET /v1/models.
 */
export async function listRemoteModels(
  conn: Pick<LlmConnection, "provider" | "baseUrl" | "apiKey">
): Promise<{
  models: RemoteModel[];
  baseUrl?: string;
  count: number;
}> {
  const { client, baseUrl } = createLlmClient({
    provider: conn.provider,
    model: "placeholder",
    baseUrl: conn.baseUrl,
    apiKey: conn.apiKey,
    useJsonMode: false,
  });

  const page = await client.models.list();
  const models: RemoteModel[] = (page.data ?? [])
    .map((m) => ({
      id: m.id,
      owned_by: (m as { owned_by?: string }).owned_by ?? null,
      created: typeof m.created === "number" ? m.created : null,
    }))
    .filter((m) => Boolean(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Dedupe by id
  const seen = new Set<string>();
  const unique = models.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  return {
    models: unique,
    baseUrl,
    count: unique.length,
  };
}
