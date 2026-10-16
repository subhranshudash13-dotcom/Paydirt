// Ollama client for the API — LOCAL only (PRD §2 data boundary, §9). Gemma drafts
// and EmbeddingGemma vectors never leave the machine. When Ollama isn't reachable
// these return null / false and callers fall back honestly (template draft, or a
// match computed from language+skill overlap without embeddings).
import { config } from "../config.js";

async function post(path: string, body: unknown, timeoutMs: number): Promise<unknown | null> {
  try {
    const res = await fetch(`${config.ollamaUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** EmbeddingGemma, 768-dim. null when offline. */
export async function embed(text: string): Promise<number[] | null> {
  const d = (await post("/api/embeddings", { model: config.gemmaEmbedModel, prompt: text }, 20000)) as
    | { embedding?: number[] }
    | null;
  const v = d?.embedding;
  return Array.isArray(v) && v.length > 0 ? v : null;
}

/** Gemma chat completion (plain text). null when offline or empty. */
export async function generate(prompt: string, timeoutMs = 45000): Promise<string | null> {
  const d = (await post("/api/generate", { model: config.gemmaChatModel, prompt, stream: false }, timeoutMs)) as
    | { response?: string }
    | null;
  const out = d?.response;
  return out && out.trim() ? out.trim() : null;
}

export async function available(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}
