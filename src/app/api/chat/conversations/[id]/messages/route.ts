import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonSuccess, jsonError, checkPlanLimit } from "@/lib/api-utils";
import { sendMessageSchema } from "@/types/chat";
import type { SearchFilters } from "@/lib/services/retriever";
import { generateChatResponse, type ChatMessage } from "@/lib/services/gemini";
import { CHAT_SYSTEM_PROMPT, buildFollowUpMessage } from "@/lib/prompts/chat";
import {
  combineFullRepoContext,
  extractFullRepoContext,
  formatFullRepoContextForStorage,
  getFullRepoContext,
  isFullRepoContextStale,
} from "@/lib/services/full-repo-context";
import {
  EMPTY_REPLY_TEXT,
  buildChatHistory,
  buildRetrievalQuery,
  checkChatRateLimit,
  isRepositoryChatReady,
  retrieveChatContext,
  streamChatReply,
} from "@/lib/services/chat-service";
import { AI_CONFIG } from "@/lib/constants";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/chat/conversations/[id]/messages - Send a message
 * Supports streaming with Accept: text/event-stream header
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "VALIDATION_001",
        parsed.error.errors[0]?.message ?? "Validation error",
        400
      );
    }

    const { content, filters } = parsed.data;
    const isStreaming = request.headers.get("accept")?.includes("text/event-stream");

    const searchFilters: SearchFilters | undefined = filters
      ? { extensions: filters.extensions, paths: filters.paths, types: filters.types }
      : undefined;

    // Verify conversation ownership; load the most recent messages for history
    const conversation = await db.conversation.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: AI_CONFIG.chat.historyMessages,
        },
      },
    });

    if (!conversation) {
      return jsonError("CHAT_002", "Conversation not found", 404);
    }

    const limit = await checkPlanLimit(session.userId, "messages");
    if (!limit.allowed) return limit.error!;
    const rateLimitError = await checkChatRateLimit(session.userId);
    if (rateLimitError) return rateLimitError;

    const repositoryIds = conversation.repositoryIds?.length > 0
      ? conversation.repositoryIds
      : [conversation.repositoryId];

    const repos = await db.repository.findMany({
      where: { id: { in: repositoryIds }, userId: session.userId },
      select: { id: true, indexStatus: true, chunkCount: true, fullName: true, indexedAt: true },
    });

    if (repos.length === 0) {
      return jsonError(
        "REPO_001",
        "The repositories for this conversation are no longer connected.",
        404
      );
    }

    const notReady = repos.filter((r) => !isRepositoryChatReady(r));
    if (notReady.length > 0) {
      const names = notReady.map((r) => r.fullName).join(", ");
      return jsonError(
        "INDEX_003",
        `All repositories must be indexed before chatting. Not indexed: ${names}`,
        400
      );
    }

    const availableRepoIds = repos.map((r) => r.id);
    // Loaded newest-first; history needs oldest-first
    const previousUserMessage = conversation.messages.find((m) => m.role === "user")?.content;
    const recentMessages = [...conversation.messages].reverse();

    // Relevant code for this question (both modes)
    const retrieval = await retrieveChatContext(
      availableRepoIds,
      buildRetrievalQuery(content, previousUserMessage),
      conversation.mode === "full_repo" ? undefined : searchFilters
    );

    let formattedContext = retrieval.formatted;
    let contextChunksForStorage = retrieval.storage;

    if (conversation.mode === "full_repo") {
      // Full repo mode: repository structure (refreshed after re-indexing) + relevant code
      let fileList = extractFullRepoContext(conversation.fullRepoContext);
      if (!fileList || isFullRepoContextStale(conversation.fullRepoContext, repos)) {
        fileList = await getFullRepoContext(availableRepoIds);
        await db.conversation.update({
          where: { id },
          data: {
            fullRepoContext: formatFullRepoContextForStorage(fileList) as Prisma.InputJsonValue,
          },
        });
      }
      formattedContext = combineFullRepoContext(fileList, retrieval.formatted);
      contextChunksForStorage = { type: "full_repo", relevantCode: retrieval.storage };
    }

    const chatMessages: ChatMessage[] = [
      ...buildChatHistory(recentMessages),
      { role: "user", content: buildFollowUpMessage(content, formattedContext) },
    ];

    // Save user message
    const userMessage = await db.message.create({
      data: {
        conversationId: id,
        role: "user",
        content,
        contextChunks: (contextChunksForStorage ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    // Update conversation timestamp
    await db.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const saveReply = async (reply: string) => {
      const assistantMessage = await db.message.create({
        data: { conversationId: id, role: "assistant", content: reply },
      });
      return assistantMessage.id;
    };

    if (isStreaming) {
      return streamChatReply({ messages: chatMessages, saveReply });
    }

    // Non-streaming response
    const aiResponse = await generateChatResponse(CHAT_SYSTEM_PROMPT, chatMessages);
    const replyContent = aiResponse.trim() ? aiResponse : EMPTY_REPLY_TEXT;
    const assistantMessage = await db.message.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: replyContent,
      },
    });

    return jsonSuccess({
      userMessage: {
        id: userMessage.id,
        conversationId: userMessage.conversationId,
        role: userMessage.role,
        content: userMessage.content,
        contextChunks: userMessage.contextChunks,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        conversationId: assistantMessage.conversationId,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to send message:", error);
    return jsonError("INTERNAL_001", "Failed to send message", 500);
  }
}
