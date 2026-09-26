import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => ({ requestUrl: vi.fn(), getLanguage: () => "en" }));
import { requestUrl } from "obsidian";
import { EmbeddingError } from "./errors";
import { requestEmbeddingJson, parseOpenAIEmbeddingResponse, validateEmbeddingVectors } from "./shared";
import { OpenAICompatibleEmbeddingProvider, OllamaEmbeddingProvider } from "./providers";
import { testEmbeddingConnection } from "./factory";
import { DEFAULT_EMBEDDING_SETTINGS } from "./types";

const request = vi.mocked(requestUrl);
const call = (timeout?: number) => requestEmbeddingJson("https://example.test", { Authorization: "private-key" }, { input: "private-note" }, timeout);
const response = (status: number, text = "private-response") => ({ status, text, json: {}, headers: {}, arrayBuffer: new ArrayBuffer(0) });
beforeEach(() => { vi.stubGlobal("window", {
  setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
}); request.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("safe embedding errors", () => {
  it.each([[401, "auth"], [403, "auth"], [429, "rate-limit"], [500, "server"], [503, "server"], [400, "request"], [404, "request"], [302, "request"]])("HTTP %s -> %s without retaining payloads", async (status, code) => {
    request.mockResolvedValue(response(Number(status)));
    const error = await call().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(EmbeddingError);
    expect(error).toMatchObject({ code, status });
    expect(JSON.stringify(error) + String(error)).not.toMatch(/private-|Authorization|input/u);
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  });
  it("discards raw network rejection and handles no response", async () => {
    for (const missing of [false, true]) {
      if (missing) request.mockResolvedValueOnce(undefined!);
      else request.mockRejectedValueOnce(new Error("private-key private-note private-response"));
      const error = await call().catch((error: unknown) => error);
      expect(error).toMatchObject({ code: "network" });
      expect(JSON.stringify(error) + String(error)).not.toContain("private-");
    }
  });
  it("classifies invalid JSON without the response body", async () => {
    request.mockResolvedValue(response(200));
    await expect(call()).rejects.toMatchObject({ code: "invalid-response" });
  });
  it.each([
    [[], 1, 3], [[[1, 2, 3]], 2, 3], [[[]], 1, 3], [[[1, 2]], 1, 3],
    [[[1, NaN, 3]], 1, 3], [[[1, Infinity, 3]], 1, 3], [[[1, 1e100, 3]], 1, 3],
  ])("keeps vector validation strict", (vectors, count, dimensions) => {
    expect(() => validateEmbeddingVectors(vectors, count, dimensions)).toThrow(EmbeddingError);
  });
  it.each([{}, { data: [] }, { data: [{ index: 1, embedding: [1] }] }, { data: [{ index: -1 }] },
    { data: [{ index: 0 }, { index: 0 }] }, { data: [null] }])("rejects invalid result/index shapes", (payload) => {
    expect(() => parseOpenAIEmbeddingResponse(payload, "data" in payload && payload.data?.length === 2 ? 2 : 1)).toThrow(EmbeddingError);
  });
});

describe("caller-specific timeouts", () => {
  it.each([undefined, 90_000])("times out at %s and never retries a pending request", async (timeout) => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    request.mockImplementation(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }) as ReturnType<typeof requestUrl>);
    const settled = call(timeout).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync((timeout ?? 30_000) - 1);
    const marker = vi.fn(); void settled.then(marker);
    await Promise.resolve(); expect(marker).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toMatchObject({ code: "timeout" });
    expect(request).toHaveBeenCalledTimes(1);
    reject(new Error("late private-response")); await Promise.resolve();
  });
  it.each(["openai", "ollama"])("%s forwards the explicit batch timeout", async (kind) => {
    vi.useFakeTimers(); request.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof requestUrl>);
    const provider = kind === "ollama" ? new OllamaEmbeddingProvider({ model: "test", baseUrl: "http://localhost" })
      : new OpenAICompatibleEmbeddingProvider({ provider: "openrouter", model: "test", baseUrl: "https://example.test", apiKey: "" });
    const pending = provider.embed(["test"], { timeoutMs: 90_000 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000); expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000); expect(await pending).toMatchObject({ code: "timeout" });
  });
  it("connection test retains the 30 second default and fixed phrase", async () => {
    vi.useFakeTimers(); request.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof requestUrl>);
    const pending = testEmbeddingConnection({ ...DEFAULT_EMBEDDING_SETTINGS, embeddingProvider: "ollama" }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toMatchObject({ code: "timeout" });
    const input = request.mock.calls[0][0];
    if (typeof input === "string") throw new Error("Expected structured request");
    expect((JSON.parse(input.body as string) as { input: string[] }).input).toEqual(["Vault Audit AI embedding test"]);
  });
});
