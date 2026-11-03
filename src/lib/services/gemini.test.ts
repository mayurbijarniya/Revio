import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: {}, requireEnv: () => "test-key" }));

import { generateReviewResponse } from "./gemini";
import { AI_CONFIG } from "@/lib/constants";

describe("generateReviewResponse", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the thinking level to the Gemini API and no temperature", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { role: "model", parts: [{ text: '{"summary":"ok"}' }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 300, totalTokenCount: 420 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await generateReviewResponse("system", "review this");

    // The request body the SDK actually sent to Google
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: AI_CONFIG.review.maxOutputTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "medium" },
    });
    expect(body.generationConfig.temperature).toBeUndefined();

    expect(result.text).toBe('{"summary":"ok"}');
    expect(log).toHaveBeenCalledWith(expect.stringContaining("thinking 300"));
  });
});
