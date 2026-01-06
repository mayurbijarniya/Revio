import { GoogleGenerativeAI, type GenerateContentStreamResult } from "@google/generative-ai";
import { AI_CONFIG } from "@/lib/constants";

const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is required");
  }
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
): Promise<string> {
  const { isComplex = false } = options;

  const model = isComplex
    ? AI_CONFIG.review.complexModel
    : AI_CONFIG.review.model;

  const client = getGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: AI_CONFIG.review.maxOutputTokens,
      temperature: AI_CONFIG.review.temperature,
    },
  });

  const result = await genModel.generateContent(userPrompt);
  return result.response.text();
}

/**
 * Count tokens in text (approximate)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}
