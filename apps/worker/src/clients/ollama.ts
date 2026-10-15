// Ollama client — LOCAL only (PRD §2 data boundary, §9). Embeddings for the user's
// own code/READMEs and Gemma drafting never leave the machine. When Ollama isn't
// reachable these return null and callers fall back (heuristic estimate / template
// draft), keeping the product honest: no hidden cloud LLM calls.
import { config } from "../config.js";

async function post(path: string, body: unknown, timeoutMs: number): Promise<any | null> {
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

export async function embed(text: string): Promise<number[] | null> {
  const d = await post("/api/embeddings", { model: config.gemmaEmbedModel, prompt: text }, 20000);
  const v = d?.embedding;
  return Array.isArray(v) ? (v as number[]) : null;
}

export interface Estimate {
  hours: number;
  rationale: string;
}

/**
 * estimateHours via Gemma, validated strictly; malformed output or no Ollama ->
 * null so the caller uses the documented heuristic (PRD §9, §13 Gemma JSON flakiness).
 */
export async function estimateHours(title: string, body: string): Promise<Estimate | null> {
  const prompt =
    `You estimate open-source task effort. Reply ONLY with JSON ` +
    `{"hours": number, "rationale": string}.\n\nTitle: ${title}\nBody: ${body.slice(0, 800)}`;
  const d = await post("/api/generate", { model: config.gemmaChatModel, prompt, stream: false, format: "json" }, 30000);
  const raw = d?.response as string | undefined;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { hours?: unknown; rationale?: unknown };
    const hours = Number(parsed.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 400) return null;
    return { hours, rationale: String(parsed.rationale ?? "") };
  } catch {
    return null;
  }
}

export async function draft(text: string): Promise<string | null> {
  const d = await post("/api/generate", { model: config.gemmaChatModel, prompt: text, stream: false }, 45000);
  const out = d?.response as string | undefined;
  return out ? out.trim() : null;
}

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}
