/**
 * Shared chat logic used by both chat routes (new conversation and follow-up message),
 * so first answers and follow-ups get the same context, history and streaming behaviour.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/api-utils";
import { AI_CONFIG, RATE_LIMITS } from "@/lib/constants";
import { getUserPlan } from "@/lib/plan-limits";
import {
  formatContextForPrompt,
  retrieveContext,
  retrieveMultiRepoContext,
  type SearchFilters,
} from "./retriever";
import { generateChatResponseStream, type ChatMessage } from "./gemini";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts/chat";

export const EMPTY_REPLY_TEXT =
  "I couldn't generate a response to that. Please try rephrasing your question.";
export const FAILED_REPLY_TEXT =
  "Sorry, something went wrong while generating this response. Please try again.";
const INTERRUPTED_NOTE = "_(Response interrupted. Please try again for the full answer.)_";

/**
 * A repository can be chatted with once it has an index, even while it is being re-indexed
 */
export function isRepositoryChatReady(repo: { indexStatus: string; chunkCount: number }): boolean {
  return repo.indexStatus === "indexed" || repo.chunkCount > 0;
}

/**
 * Hourly chat rate limit per plan (RATE_LIMITS.chatMessagesPerHour)
 */
export async function checkChatRateLimit(userId: string): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId);
  const limit = RATE_LIMITS[plan].chatMessagesPerHour;
  if (limit === -1) return null;

  const sent = await db.message.count({
    where: {
      conversation: { userId },
      role: "user",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (sent >= limit) {
    return jsonError(
      "LIMIT_004",
      `Hourly chat limit reached (${limit} messages per hour on ${plan.toUpperCase()} plan). Please wait a bit or upgrade.`,
      429
    );
  }
  return null;
}

export interface ChatContextResult {
  /** Formatted code context for the prompt, or undefined when nothing relevant was found */
  formatted?: string;
  /** Compact copy stored on the user message */
  storage: unknown;
}

/**
 * Vector search over one or more repositories with the shared chat settings
 */
export async function retrieveChatContext(
  repositoryIds: string[],
  query: string,
  filters?: SearchFilters
): Promise<ChatContextResult> {
  const options = {
    maxChunks: AI_CONFIG.chat.retrievalMaxChunks,
    scoreThreshold: AI_CONFIG.chat.retrievalScoreThreshold,
    filters,
  };
  const context =
    repositoryIds.length === 1 && repositoryIds[0]
      ? await retrieveContext(repositoryIds[0], query, options)
      : await retrieveMultiRepoContext(repositoryIds, query, options);

  if (context.chunks.length === 0) {
    return { formatted: undefined, storage: null };
  }

  return {
    formatted: formatContextForPrompt(context.chunks),
    storage: {
      chunks: context.chunks.map((c) => ({
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
        content: c.content.slice(0, 500),
      })),
      totalTokens: context.totalTokens,
    },
  };
}

/**
 * Search query for a follow-up: short follow-ups ("what about the second one?") are
 * searched together with the previous question so retrieval keeps the topic.
 */
export function buildRetrievalQuery(content: string, previousUserMessage?: string): string {
  if (!previousUserMessage || content.length >= 200) return content;
  return `${previousUserMessage.slice(0, 500)}\n${content}`;
}

/**
 * Convert stored messages to Gemini history: skips empty messages, merges consecutive
 * messages from the same role, and makes sure history starts with a user turn.
 */
export function buildChatHistory(messages: Array<{ role: string; content: string }>): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (const message of messages) {
    const content = message.content?.trim();
    if (!content) continue;
    const role: ChatMessage["role"] = message.role === "user" ? "user" : "model";
    const last = history[history.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      history.push({ role, content });
    }
  }
  while (history[0] && history[0].role !== "user") history.shift();
  return history;
}

/**
 * Stream a model reply as server-sent events and always persist an assistant message,
 * so a failed or interrupted stream never leaves a question without an answer in history.
 *
 * Events: optional `meta` first, then {content, done:false} chunks, then
 * {done:true, messageId, finalContent, error?}. finalContent is what was saved.
 */
export function streamChatReply(params: {
  messages: ChatMessage[];
  meta?: Record<string, unknown>;
  saveReply: (content: string) => Promise<string>;
}): NextResponse {
  const { messages, meta, saveReply } = params;
  const encoder = new TextEncoder();
  let clientConnected = true;

  const readableStream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (!clientConnected) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          clientConnected = false;
        }
      };

      let fullResponse = "";
      try {
        if (meta) send(meta);

        const stream = await generateChatResponseStream(CHAT_SYSTEM_PROMPT, messages);
        for await (const chunk of stream.stream) {
          const text = chunk.text();
          if (!text) continue;
          fullResponse += text;
          send({ content: text, done: false });
        }

        const finalContent = fullResponse.trim() ? fullResponse : EMPTY_REPLY_TEXT;
        const messageId = await saveReply(finalContent);
        send({ done: true, messageId, finalContent });
      } catch (error) {
        console.error("Streaming error:", error);
        const finalContent = fullResponse.trim()
          ? `${fullResponse}\n\n${INTERRUPTED_NOTE}`
          : FAILED_REPLY_TEXT;
        let messageId: string | undefined;
        try {
          messageId = await saveReply(finalContent);
        } catch (saveError) {
          console.error("Failed to save assistant reply after stream error:", saveError);
        }
        send({ error: "The response could not be completed.", done: true, messageId, finalContent });
      } finally {
        if (clientConnected) {
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      }
    },
    cancel() {
      // Client went away: keep generating so the reply is still saved
      clientConnected = false;
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
