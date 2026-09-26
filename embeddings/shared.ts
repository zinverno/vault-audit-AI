import { requestUrl } from "obsidian";
import type { RequestUrlResponse } from "obsidian";
import { EmbeddingError } from "./errors";
import type { EmbeddingRequestOptions } from "./types";
import { t as tr } from "../i18n";
import type {
  EmbeddingProvider,
  EmbeddingProviderId,
} from "./types";

const EMBEDDING_TIMEOUT_MS = 30_000;
const EMBEDDING_BATCH_SIZE = 64;
const FLOAT32_MAX = 3.4028234663852886e38;

export function parseEmbeddingBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(
      tr("Base URL embeddings должен быть корректным HTTP(S)-адресом."),
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      tr("Base URL embeddings должен быть корректным HTTP(S)-адресом."),
    );
  }
  if (url.search) {
    throw new Error(
      tr("Base URL embeddings не должен содержать query parameters."),
    );
  }
  if (url.hash) {
    throw new Error(tr("Base URL embeddings не должен содержать fragment."));
  }
  return url;
}

export function buildEmbeddingEndpoint(
  baseUrl: string,
  endpoint: string,
): string {
  const url = parseEmbeddingBaseUrl(baseUrl);
  const baseParts = url.pathname.split("/").filter(Boolean);
  const endpointParts = endpoint.split("/").filter(Boolean);
  const alreadyHasEndpoint =
    endpointParts.length <= baseParts.length &&
    endpointParts.every(
      (part, index) =>
        baseParts[baseParts.length - endpointParts.length + index] === part,
    );

  const resultParts = alreadyHasEndpoint
    ? baseParts
    : [...baseParts, ...endpointParts];
  url.pathname = `/${resultParts.join("/")}`;
  return url.toString();
}

function httpError(status: number): EmbeddingError {
  const code = status === 401 || status === 403 ? "auth"
    : status === 429 ? "rate-limit"
    : status >= 500 && status < 600 ? "server" : "request";
  return new EmbeddingError(code, status);
}

/**
 * requestUrl avoids browser CORS restrictions in desktop and mobile Obsidian.
 * requestUrl cannot abort an in-flight request. The timeout only limits how
 * long the caller waits; the HTTP operation may still settle in the background.
 * Promise.race keeps rejection handlers attached, so a late success or failure
 * cannot update the caller and does not become an unhandled rejection.
 */
export async function requestEmbeddingJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number = EMBEDDING_TIMEOUT_MS,
): Promise<unknown> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new EmbeddingError("timeout"));
    }, timeoutMs);
  });

  const requestPromise: Promise<RequestUrlResponse> = Promise.resolve().then(
    () =>
      requestUrl({
        url,
        method: "POST",
        contentType: "application/json",
        headers,
        body: JSON.stringify(body),
        throw: false,
      }),
  );

  let response: RequestUrlResponse;
  try {
    response = await Promise.race([requestPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error;
    }
    throw new EmbeddingError("network");
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }

  if (!response || !Number.isInteger(response.status) || response.status <= 0) throw new EmbeddingError("network");
  if (response.status < 200 || response.status >= 300) {
    throw httpError(response.status);
  }

  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    throw new EmbeddingError("invalid-response");
  }
}

export function validateEmbeddingVectors(
  rawVectors: unknown,
  expectedCount: number,
  expectedDimensions?: number,
): Float32Array[] {
  if (!Array.isArray(rawVectors) || rawVectors.length === 0) {
    throw new EmbeddingError("invalid-response");
  }
  if (rawVectors.length !== expectedCount) {
    throw new EmbeddingError("invalid-response");
  }

  let dimensions = expectedDimensions;
  const validatedVectors: number[][] = rawVectors.map(
    (rawVector) => {
      if (!Array.isArray(rawVector) || rawVector.length === 0) {
        throw new EmbeddingError("invalid-response");
      }

      if (dimensions === undefined) dimensions = rawVector.length;
      if (rawVector.length !== dimensions) {
        throw new EmbeddingError("invalid-response");
      }

      const vector: number[] = [];
      for (let valueIndex = 0; valueIndex < rawVector.length; valueIndex++) {
        const value: unknown = rawVector[valueIndex];
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new EmbeddingError("invalid-response");
        }
        if (Math.abs(value) > FLOAT32_MAX) {
          throw new EmbeddingError("invalid-response");
        }
        vector.push(value);
      }
      return vector;
    },
  );

  return validatedVectors.map((vector) => Float32Array.from(vector));
}

export function parseOpenAIEmbeddingResponse(
  payload: unknown,
  expectedCount: number,
): unknown[] {
  if (!payload || typeof payload !== "object") {
    throw new EmbeddingError("invalid-response");
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new EmbeddingError("invalid-response");
  }
  if (data.length !== expectedCount) {
    throw new EmbeddingError("invalid-response");
  }

  const items = data.map((item) => {
    if (!item || typeof item !== "object") {
      throw new EmbeddingError("invalid-response");
    }
    return item as { index?: unknown; embedding?: unknown };
  });

  const hasIndices = items.some((item) => item.index !== undefined);
  if (!hasIndices) return items.map((item) => item.embedding);

  const ordered = new Array<unknown>(expectedCount);
  const seenIndices = new Set<number>();
  for (const item of items) {
    if (
      !Number.isInteger(item.index) ||
      (item.index as number) < 0 ||
      (item.index as number) >= expectedCount ||
      seenIndices.has(item.index as number)
    ) {
      throw new EmbeddingError("invalid-response");
    }
    seenIndices.add(item.index as number);
    ordered[item.index as number] = item.embedding;
  }

  if (seenIndices.size !== expectedCount) {
    throw new EmbeddingError("invalid-response");
  }
  return ordered;
}

export function parseOllamaEmbeddingResponse(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new EmbeddingError("invalid-response");
  }
  return (payload as { embeddings?: unknown }).embeddings;
}

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract readonly id: EmbeddingProviderId;
  readonly model: string;
  private cachedDimensions: number | undefined;

  protected constructor(model: string) {
    this.model = model;
  }

  protected abstract embedBatch(texts: string[], options?: EmbeddingRequestOptions): Promise<unknown>;

  async embed(texts: string[], options?: EmbeddingRequestOptions): Promise<Float32Array[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error(tr("Передайте хотя бы один текст для embeddings."));
    }
    if (texts.some((text) => typeof text !== "string")) {
      throw new Error(tr("Все входы embeddings должны быть строками."));
    }

    const result: Float32Array[] = [];
    for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
      const rawVectors = await this.embedBatch(batch, options);
      const vectors = validateEmbeddingVectors(
        rawVectors,
        batch.length,
        this.cachedDimensions,
      );
      if (this.cachedDimensions === undefined) {
        this.cachedDimensions = vectors[0].length;
      }
      result.push(...vectors);
    }
    return result;
  }

  async dimensions(options?: EmbeddingRequestOptions): Promise<number> {
    if (this.cachedDimensions !== undefined) return this.cachedDimensions;
    const [vector] = await this.embed(["Vault Audit AI embedding test"], options);
    return vector.length;
  }
}
