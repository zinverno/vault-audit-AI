import { requestUrl } from "obsidian";
import type { RequestUrlParam } from "obsidian";
import { RERANK_LIMITS } from "./types";
import type { RerankProvider, RerankScore, RerankSettings } from "./types";

export type RerankErrorCode = "configuration" | "auth" | "credits" | "rate-limit" |
  "server" | "request" | "network" | "timeout" | "cancelled" | "invalid-response";

/** Only fixed codes cross the boundary. Never retain provider bodies or causes. */
export class RerankError extends Error {
  constructor(readonly code: RerankErrorCode) {
    super(`Rerank: ${code}`);
    this.name = "RerankError";
  }
}

export type RerankTransport = (request: RequestUrlParam) => Promise<{ status: number; text: string }>;

export function rerankConfigured(settings: RerankSettings): boolean {
  return settings.provider === "openrouter" && /^[A-Za-z0-9._-]+\/[A-Za-z0-9._:/-]+$/.test(settings.model.trim()) &&
    settings.model.trim().length <= RERANK_LIMITS.modelLength &&
    /^[\x21-\x7e]+$/.test(settings.apiKey.trim());
}

export function rerankBody(model: string, query: string, documents: readonly string[]): string {
  return JSON.stringify({ model: model.trim(), query, documents, top_n: documents.length,
    provider: { allow_fallbacks: false } });
}

export function payloadFits(model: string, query: string, documents: readonly string[]): boolean {
  return new TextEncoder().encode(rerankBody(model, query, documents)).byteLength <= RERANK_LIMITS.payloadBytes;
}

export function validateRerankResponse(payload: unknown, count: number): RerankScore[] {
  const invalid = () => new RerankError("invalid-response");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalid();
  const { results, model } = payload as { results?: unknown; model?: unknown };
  if (typeof model !== "string" || !model.trim() || !Array.isArray(results) || results.length !== count) throw invalid();
  const seen = new Set<number>();
  return results.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid();
    const { index, relevance_score: score } = item as { index?: unknown; relevance_score?: unknown };
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || index >= count || seen.has(index) ||
      typeof score !== "number" || !Number.isFinite(score)) throw invalid();
    seen.add(index);
    return { index, relevanceScore: score };
  });
}

export class OpenRouterRerankProvider implements RerankProvider {
  private readonly settings: RerankSettings;
  constructor(settings: RerankSettings, private readonly transport: RerankTransport = requestUrl) {
    this.settings = { ...settings };
  }

  async rank(query: string, documents: readonly string[], signal: AbortSignal): Promise<RerankScore[]> {
    if (!rerankConfigured(this.settings)) throw new RerankError("configuration");
    if (!query.trim() || query.includes("\0") || Array.from(query).length > RERANK_LIMITS.queryCodePoints ||
      documents.length < 2 || documents.length > RERANK_LIMITS.candidates ||
      documents.some(text => !text.trim() || Array.from(text).length > RERANK_LIMITS.fragmentCodePoints) ||
      !payloadFits(this.settings.model, query, documents)) throw new RerankError("request");
    if (signal.aborted) throw new RerankError("cancelled");
    let timer: number | undefined;
    let cancel = () => {};
    const stopped = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(new RerankError("cancelled"));
      signal.addEventListener("abort", cancel, { once: true });
      timer = window.setTimeout(() => reject(new RerankError("timeout")), RERANK_LIMITS.timeoutMs);
    });
    try {
      // Obsidian requestUrl has no AbortSignal: cancellation/timeout stops waiting only.
      // The race retains handlers for late replies; no retries or metadata are added.
      const pending = Promise.resolve().then(() => {
        if (signal.aborted) throw new RerankError("cancelled");
        return this.transport({ url: "https://openrouter.ai/api/v1/rerank", method: "POST",
          contentType: "application/json", headers: { Authorization: `Bearer ${this.settings.apiKey.trim()}` },
          body: rerankBody(this.settings.model, query, documents), throw: false });
      });
      const response = await Promise.race([pending, stopped]);
      if (!response || !Number.isInteger(response.status) || response.status <= 0) throw new RerankError("network");
      const status = response.status;
      if (status < 200 || status >= 300) throw new RerankError(
        status === 401 || status === 403 ? "auth" : status === 402 ? "credits" :
          status === 429 ? "rate-limit" : status >= 500 ? "server" : "request");
      let payload: unknown;
      try { payload = JSON.parse(response.text); } catch { throw new RerankError("invalid-response"); }
      return validateRerankResponse(payload, documents.length);
    } catch (error) {
      throw error instanceof RerankError ? error : new RerankError("network");
    } finally {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
  }
}

/** An explicit paid API probe, independent of vault sources and enabled state. */
export async function testRerankConnection(settings: RerankSettings, signal: AbortSignal,
  provider: RerankProvider = new OpenRouterRerankProvider(settings)): Promise<void> {
  await provider.rank("Which fruit is yellow?",
    ["A banana is yellow.", "A bicycle has two wheels."], signal);
}
