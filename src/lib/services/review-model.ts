/**
 * Review model selection. Each user picks the AI provider for their PR reviews in Settings:
 * Google (Gemini, the default) or DeepSeek (through Subconscious' OpenAI-compatible API).
 *
 * DeepSeek is best-effort: when its key is missing, or the call times out, fails or returns an
 * answer that is not a readable review, the review is generated with Gemini instead, so a
 * provider problem never leaves a review stuck or failed.
 */
import OpenAI from "openai";
import type { UsageMetadata } from "@google/generative-ai";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  AI_CONFIG,
  DEFAULT_REVIEW_PROVIDER,
  REVIEW_PROVIDERS,
  type ReviewProvider,
} from "@/lib/constants";
import { parseReviewResponse } from "@/lib/prompts/review";
import { generateReviewResponse, type ReviewGenerationResult } from "./gemini";

export type ReviewGenerator = (
  systemPrompt: string,
  userPrompt: string,
  options: { isComplex?: boolean }
) => Promise<ReviewGenerationResult>;

export function isReviewProvider(value: unknown): value is ReviewProvider {
  return typeof value === "string" && (REVIEW_PROVIDERS as readonly string[]).includes(value);
}

/** DeepSeek can be offered only when the server has a Subconscious key */
export function isDeepSeekAvailable(): boolean {
  return Boolean(env.SUBCONSCIOUS_API_KEY?.trim());
}

let deepSeekClient: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  const apiKey = env.SUBCONSCIOUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SUBCONSCIOUS_API_KEY is not configured");
  }
  deepSeekClient ??= new OpenAI({ apiKey, baseURL: AI_CONFIG.review.deepseek.baseURL });
  return deepSeekClient;
}

/**
 * Generate a review with DeepSeek. Only the answer (`content`) is used; the model's separate
 * reasoning text is ignored. Usage is mapped to the Gemini shape used for token tracking.
 */
export async function generateReviewWithDeepSeek(
  systemPrompt: string,
  userPrompt: string
): Promise<ReviewGenerationResult> {
  const config = AI_CONFIG.review.deepseek;

  const response = await getDeepSeekClient().chat.completions.create(
    {
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: config.maxOutputTokens,
    },
    // No retries: a failed attempt falls back to Gemini instead of using up the time limit
    { timeout: config.timeoutMs, maxRetries: 0 }
  );

  const choice = response.choices[0];
  const text = choice?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error(`DeepSeek returned an empty answer (finish_reason: ${choice?.finish_reason ?? "unknown"})`);
  }

  const usage = response.usage;
  const usageMetadata: UsageMetadata | null = usage
    ? {
        promptTokenCount: usage.prompt_tokens,
        candidatesTokenCount: usage.completion_tokens,
        totalTokenCount: usage.total_tokens,
      }
    : null;

  console.warn(
    `[DeepSeek] Review usage (${config.model}): prompt ${usage?.prompt_tokens ?? "?"}, ` +
      `output incl. reasoning ${usage?.completion_tokens ?? "?"}, finish ${choice?.finish_reason ?? "?"}`
  );

  return { text, usageMetadata };
}

interface GeneratorDeps {
  deepseek?: (systemPrompt: string, userPrompt: string) => Promise<ReviewGenerationResult>;
  google?: ReviewGenerator;
  deepSeekAvailable?: boolean;
}

/**
 * Model call for a provider. DeepSeek answers that are not readable reviews fall back to Gemini.
 */
export function createReviewGenerator(provider: ReviewProvider, deps: GeneratorDeps = {}): ReviewGenerator {
  const google = deps.google ?? generateReviewResponse;
  const deepseek = deps.deepseek ?? generateReviewWithDeepSeek;
  const deepSeekAvailable = deps.deepSeekAvailable ?? isDeepSeekAvailable();

  if (provider !== "deepseek") return google;
  if (!deepSeekAvailable) {
    console.warn("[ReviewModel] DeepSeek selected but SUBCONSCIOUS_API_KEY is not set; using Gemini");
    return google;
  }

  return async (systemPrompt, userPrompt, options) => {
    const startedAt = Date.now();
    try {
      const result = await deepseek(systemPrompt, userPrompt);
      if (parseReviewResponse(result.text)) {
        console.warn(`[ReviewModel] Review generated with DeepSeek in ${Date.now() - startedAt}ms`);
        return result;
      }
      console.warn("[ReviewModel] DeepSeek answer was not a readable review; falling back to Gemini");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ReviewModel] DeepSeek failed after ${Date.now() - startedAt}ms (${message}); falling back to Gemini`);
    }
    return google(systemPrompt, userPrompt, options);
  };
}

/**
 * The user's chosen review provider. Any read problem means the default (Google), so choosing
 * a model can never break a review.
 */
export async function getUserReviewProvider(userId: string): Promise<ReviewProvider> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { reviewProvider: true },
    });
    return isReviewProvider(user?.reviewProvider) ? user.reviewProvider : DEFAULT_REVIEW_PROVIDER;
  } catch (error) {
    console.warn("[ReviewModel] Could not read review provider; using default:", error);
    return DEFAULT_REVIEW_PROVIDER;
  }
}

/** Model call for reviews owned by this user */
export async function resolveReviewGenerator(userId: string): Promise<ReviewGenerator> {
  return createReviewGenerator(await getUserReviewProvider(userId));
}
