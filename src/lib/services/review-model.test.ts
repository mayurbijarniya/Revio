import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, constructorMock, dbMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  constructorMock: vi.fn(),
  dbMock: { user: { findUnique: vi.fn() } },
}));

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: createMock } };
    constructor(options: unknown) {
      constructorMock(options);
    }
  },
}));
vi.mock("@/lib/env", () => ({ env: { SUBCONSCIOUS_API_KEY: "sub-test-key" }, requireEnv: () => "test-key" }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  createReviewGenerator,
  generateReviewWithDeepSeek,
  getUserReviewProvider,
  isReviewProvider,
} from "./review-model";
import { AI_CONFIG } from "@/lib/constants";

const validReview = JSON.stringify({
  summary: "Looks risky",
  riskLevel: "high",
  issues: [],
  positives: [],
  recommendation: "request_changes",
});

const geminiResult = { text: '{"summary":"from gemini","riskLevel":"low","issues":[],"positives":[]}', usageMetadata: null };

describe("generateReviewWithDeepSeek", () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("asks for JSON from the configured model and maps usage", async () => {
    createMock.mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: validReview, reasoning_content: "thinking..." } }],
      usage: { prompt_tokens: 120, completion_tokens: 900, total_tokens: 1020 },
    });

    const result = await generateReviewWithDeepSeek("system", "review this");

    expect(constructorMock).toHaveBeenCalledWith({
      apiKey: "sub-test-key",
      baseURL: AI_CONFIG.review.deepseek.baseURL,
    });
    const [body, requestOptions] = createMock.mock.calls[0] ?? [];
    expect(body).toEqual({
      model: AI_CONFIG.review.deepseek.model,
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "review this" },
      ],
      response_format: { type: "json_object" },
      max_tokens: AI_CONFIG.review.deepseek.maxOutputTokens,
    });
    expect(requestOptions).toEqual({ timeout: AI_CONFIG.review.deepseek.timeoutMs, maxRetries: 0 });

    // Only the answer is used, never the reasoning text
    expect(result.text).toBe(validReview);
    expect(result.usageMetadata).toEqual({
      promptTokenCount: 120,
      candidatesTokenCount: 900,
      totalTokenCount: 1020,
    });
  });

  it("rejects an empty answer", async () => {
    createMock.mockResolvedValue({ choices: [{ finish_reason: "length", message: { content: "" } }] });
    await expect(generateReviewWithDeepSeek("s", "u")).rejects.toThrow("finish_reason: length");
  });
});

describe("createReviewGenerator", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses Gemini for the google provider", async () => {
    const google = vi.fn().mockResolvedValue(geminiResult);
    const deepseek = vi.fn();
    const generate = createReviewGenerator("google", { google, deepseek, deepSeekAvailable: true });

    await expect(generate("s", "u", { isComplex: true })).resolves.toBe(geminiResult);
    expect(google).toHaveBeenCalledWith("s", "u", { isComplex: true });
    expect(deepseek).not.toHaveBeenCalled();
  });

  it("uses DeepSeek when chosen and its answer is a readable review", async () => {
    const deepSeekResult = { text: validReview, usageMetadata: null };
    const google = vi.fn();
    const deepseek = vi.fn().mockResolvedValue(deepSeekResult);
    const generate = createReviewGenerator("deepseek", { google, deepseek, deepSeekAvailable: true });

    await expect(generate("s", "u", {})).resolves.toBe(deepSeekResult);
    expect(google).not.toHaveBeenCalled();
  });

  it("falls back to Gemini when DeepSeek fails", async () => {
    const google = vi.fn().mockResolvedValue(geminiResult);
    const deepseek = vi.fn().mockRejectedValue(new Error("Request timed out."));
    const generate = createReviewGenerator("deepseek", { google, deepseek, deepSeekAvailable: true });

    await expect(generate("s", "u", { isComplex: false })).resolves.toBe(geminiResult);
    expect(google).toHaveBeenCalledWith("s", "u", { isComplex: false });
  });

  it("falls back to Gemini when the DeepSeek answer is not a review", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const google = vi.fn().mockResolvedValue(geminiResult);
    const deepseek = vi.fn().mockResolvedValue({ text: "I cannot help with that.", usageMetadata: null });
    const generate = createReviewGenerator("deepseek", { google, deepseek, deepSeekAvailable: true });

    await expect(generate("s", "u", {})).resolves.toBe(geminiResult);
  });

  it("uses Gemini when DeepSeek is chosen but the server has no key", async () => {
    const google = vi.fn().mockResolvedValue(geminiResult);
    const deepseek = vi.fn();
    const generate = createReviewGenerator("deepseek", { google, deepseek, deepSeekAvailable: false });

    await generate("s", "u", {});
    expect(deepseek).not.toHaveBeenCalled();
    expect(google).toHaveBeenCalled();
  });
});

describe("getUserReviewProvider", () => {
  beforeEach(() => {
    dbMock.user.findUnique.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns the saved provider", async () => {
    dbMock.user.findUnique.mockResolvedValue({ reviewProvider: "deepseek" });
    await expect(getUserReviewProvider("user-1")).resolves.toBe("deepseek");
  });

  it("defaults to google for unknown values and read errors", async () => {
    dbMock.user.findUnique.mockResolvedValueOnce({ reviewProvider: "something-else" });
    await expect(getUserReviewProvider("user-1")).resolves.toBe("google");

    dbMock.user.findUnique.mockRejectedValueOnce(new Error('column "review_provider" does not exist'));
    await expect(getUserReviewProvider("user-1")).resolves.toBe("google");
  });

  it("accepts only known providers", () => {
    expect(isReviewProvider("google")).toBe(true);
    expect(isReviewProvider("deepseek")).toBe(true);
    expect(isReviewProvider("openai")).toBe(false);
    expect(isReviewProvider(undefined)).toBe(false);
  });
});
