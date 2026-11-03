import {
  GoogleGenerativeAI,
  type GenerateContentStreamResult,
  type GenerationConfig,
  type UsageMetadata,
} from "@google/generative-ai";
import { AI_CONFIG } from "@/lib/constants";
import { requireEnv } from "@/lib/env";

const getGeminiClient = () => {
  const apiKey = requireEnv("GOOGLE_AI_API_KEY");
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Map our database roles to Gemini roles
 * Gemini uses "model" not "assistant"
 */
function mapToGeminiRole(role: string): "user" | "model" {
  return role === "assistant" || role === "model" ? "model" : "user";
}

/**
 * Chat message for Gemini
 */
export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ReviewGenerationResult {
  text: string;
  usageMetadata: UsageMetadata | null;
}

/**
 * Generate a chat response (non-streaming)
 */
export async function generateChatResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  const {
    model = AI_CONFIG.chat.model,
    maxTokens = AI_CONFIG.chat.maxOutputTokens,
    temperature = AI_CONFIG.chat.temperature,
  } = options;

  const client = getGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  // Convert messages to Gemini format (map "assistant" to "model")
  const history = messages.slice(0, -1).map((msg) => ({
    role: mapToGeminiRole(msg.role),
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    throw new Error("No messages provided");
  }

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);

  return result.response.text();
}

/**
 * Generate a streaming chat response
 */
export async function generateChatResponseStream(
  systemPrompt: string,
  messages: ChatMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<GenerateContentStreamResult> {
  const {
    model = AI_CONFIG.chat.model,
    maxTokens = AI_CONFIG.chat.maxOutputTokens,
    temperature = AI_CONFIG.chat.temperature,
  } = options;

  const client = getGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  // Convert messages to Gemini format (map "assistant" to "model")
  const history = messages.slice(0, -1).map((msg) => ({
    role: mapToGeminiRole(msg.role),
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    throw new Error("No messages provided");
  }

  const chat = genModel.startChat({ history });
  return chat.sendMessageStream(lastMessage.content);
}

/**
 * Generate a review response (for PR reviews)
 */
export async function generateReviewResponse(
  systemPrompt: string,
  userPrompt: string,
  options: {
    isComplex?: boolean;
  } = {}
): Promise<ReviewGenerationResult> {
  const { isComplex = false } = options;

  const model = isComplex
    ? AI_CONFIG.review.complexModel
    : AI_CONFIG.review.model;

  const client = getGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: buildReviewGenerationConfig(),
  });

  const result = await genModel.generateContent(userPrompt);
  const usageMetadata = result.response.usageMetadata ?? null;
  logReviewUsage(model, usageMetadata);

  return {
    text: result.response.text(),
    usageMetadata,
  };
}

/**
 * Review generation settings. `thinkingConfig` is not in this SDK version's types, but the SDK
 * sends generationConfig to the API unchanged, so the field reaches Gemini.
 */
export function buildReviewGenerationConfig(): GenerationConfig {
  return {
    maxOutputTokens: AI_CONFIG.review.maxOutputTokens,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: AI_CONFIG.review.thinkingLevel },
  } as GenerationConfig;
}

/**
 * Log token usage per review. thoughtsTokenCount > 0 confirms thinking is active.
 */
function logReviewUsage(model: string, usage: UsageMetadata | null): void {
  if (!usage) return;
  const thoughts = (usage as UsageMetadata & { thoughtsTokenCount?: number }).thoughtsTokenCount ?? 0;
  console.warn(
    `[Gemini] Review usage (${model}, thinking ${AI_CONFIG.review.thinkingLevel}): ` +
      `prompt ${usage.promptTokenCount}, output ${usage.candidatesTokenCount}, ` +
      `thinking ${thoughts}, total ${usage.totalTokenCount}`
  );
}

/**
 * Count tokens in text (approximate)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}
