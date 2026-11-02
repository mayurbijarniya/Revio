import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonSuccess, jsonError, checkPlanLimit } from "@/lib/api-utils";
import { createConversationSchema } from "@/types/chat";
import { generateChatResponse, type ChatMessage } from "@/lib/services/gemini";
import { CHAT_SYSTEM_PROMPT, buildChatUserMessage } from "@/lib/prompts/chat";
import {
  combineFullRepoContext,
  getFullRepoContext,
  formatFullRepoContextForStorage,
} from "@/lib/services/full-repo-context";
import {
  EMPTY_REPLY_TEXT,
  checkChatRateLimit,
  isRepositoryChatReady,
  retrieveChatContext,
  streamChatReply,
} from "@/lib/services/chat-service";
import { Prisma } from "@prisma/client";

/**
 * GET /api/chat/conversations - List user's conversations
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repositoryId");

  const where = {
    userId: session.userId,
    // Multi-repo conversations list the repository in repositoryIds
    ...(repositoryId && {
      OR: [{ repositoryId }, { repositoryIds: { has: repositoryId } }],
    }),
  };

  const conversations = await db.conversation.findMany({
    where,
    include: {
      repository: {
        select: { id: true, fullName: true },
      },
      messages: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { content: true },
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const formattedConversations = conversations.map((conv) => ({
    id: conv.id,
    repositoryId: conv.repositoryId,
    repositoryIds: conv.repositoryIds,
    repositoryName: conv.repository.fullName,
    title: conv.title,
    isPinned: conv.isPinned,
    mode: conv.mode,
    lastMessage: conv.messages[0]?.content?.slice(0, 100),
    messageCount: conv._count.messages,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  }));

  return jsonSuccess({ conversations: formattedConversations });
}

/**
 * POST /api/chat/conversations - Create a new conversation with initial message
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "VALIDATION_001",
        parsed.error.errors[0]?.message ?? "Validation error",
        400
      );
    }

    const { repositoryIds, message, title, mode } = parsed.data;

    const limit = await checkPlanLimit(session.userId, "messages");
    if (!limit.allowed) return limit.error!;
    const rateLimitError = await checkChatRateLimit(session.userId);
    if (rateLimitError) return rateLimitError;

    // Verify all repositories are accessible
    const repositories = await db.repository.findMany({
      where: {
        id: { in: repositoryIds },
        userId: session.userId,
      },
    });

    if (repositories.length !== repositoryIds.length) {
      return jsonError("REPO_001", "One or more repositories not found", 404);
    }

    // Repositories need an index (an older index is fine while re-indexing)
    const notReady = repositories.filter((r) => !isRepositoryChatReady(r));
    if (notReady.length > 0) {
      const names = notReady.map((r) => r.fullName).join(", ");
      return jsonError(
        "INDEX_003",
        `The following repos must be indexed before chatting: ${names}`,
        400
      );
    }

    // Relevant code for the question (same settings as follow-up messages)
    const retrieval = await retrieveChatContext(repositoryIds, message);

    let formattedContext = retrieval.formatted ?? "No relevant code was found for this question.";
    let fullRepoContextData = null;
    let contextChunksForStorage: unknown = retrieval.storage;

    if (mode === "full_repo") {
      // Full repo mode: repository structure + relevant code
      const fileList = await getFullRepoContext(repositoryIds);
      formattedContext = combineFullRepoContext(fileList, retrieval.formatted);
      fullRepoContextData = formatFullRepoContextForStorage(fileList);
      contextChunksForStorage = {
        type: "full_repo",
        fileCount: repositories.reduce((acc, r) => acc + r.fileCount, 0),
        relevantCode: retrieval.storage,
      };
    }

    const chatMessages: ChatMessage[] = [
      { role: "user", content: buildChatUserMessage(message, formattedContext) },
    ];

    const conversationTitle = title ?? generateTitle(message);
    const isStreaming = request.headers.get("accept")?.includes("text/event-stream");

    if (isStreaming) {
      // Create conversation with only the user message first
      const conversation = await db.conversation.create({
        data: {
          userId: session.userId,
          repositoryId: repositoryIds[0]!,
          repositoryIds,
          title: conversationTitle,
          mode,
          fullRepoContext: (fullRepoContextData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          messages: {
            create: [{
              role: "user",
              content: message,
              contextChunks: (contextChunksForStorage ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            }],
          },
        },
      });

      return streamChatReply({
        messages: chatMessages,
        // Sent first so the frontend can select the conversation immediately
        meta: {
          conversationId: conversation.id,
          title: conversation.title,
          repositoryIds: conversation.repositoryIds,
        },
        saveReply: async (reply) => {
          const assistantMessage = await db.message.create({
            data: { conversationId: conversation.id, role: "assistant", content: reply },
          });
          return assistantMessage.id;
        },
      });
    }

    // Non-streaming fallback
    const aiResponse = await generateChatResponse(CHAT_SYSTEM_PROMPT, chatMessages);

    const conversation = await db.conversation.create({
      data: {
        userId: session.userId,
        repositoryId: repositoryIds[0]!,
        repositoryIds,
        title: conversationTitle,
        mode,
        fullRepoContext: (fullRepoContextData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        messages: {
          create: [
            { role: "user", content: message, contextChunks: (contextChunksForStorage ?? Prisma.JsonNull) as Prisma.InputJsonValue },
            { role: "assistant", content: aiResponse.trim() ? aiResponse : EMPTY_REPLY_TEXT },
          ],
        },
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        repository: { select: { id: true, fullName: true, language: true } },
      },
    });

    return jsonSuccess(
      {
        conversation: {
          id: conversation.id,
          repositoryId: conversation.repositoryId,
          repositoryIds: conversation.repositoryIds,
          userId: conversation.userId,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            contextChunks: m.contextChunks,
            createdAt: m.createdAt,
          })),
          repository: conversation.repository,
        },
      },
      201
    );
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return jsonError("INTERNAL_001", "Failed to create conversation", 500);
  }
}

/**
 * Generate a title from the first message
 */
function generateTitle(message: string): string {
  // Take first 50 characters, trim to last complete word
  const truncated = message.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 30) {
    return truncated.slice(0, lastSpace) + "...";
  }
  return truncated + (message.length > 50 ? "..." : "");
}
