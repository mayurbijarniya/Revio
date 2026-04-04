import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { createConversationSchema } from "@/types/chat";
import { retrieveContext, retrieveMultiRepoContext, formatContextForPrompt } from "@/lib/services/retriever";
import { generateChatResponse, generateChatResponseStream, type ChatMessage } from "@/lib/services/gemini";
import { CHAT_SYSTEM_PROMPT, buildChatUserMessage } from "@/lib/prompts/chat";
import { getFullRepoContext, formatFullRepoContextForStorage } from "@/lib/services/full-repo-context";
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
    ...(repositoryId && { repositoryId }),
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

    // Check if all repositories are indexed
    const notIndexed = repositories.filter((r) => r.indexStatus !== "indexed");
    if (notIndexed.length > 0) {
      const names = notIndexed.map((r) => r.fullName).join(", ");
      return jsonError(
        "INDEX_003",
        `The following repos must be indexed before chatting: ${names}`,
        400
      );
    }

    // Get context based on mode
    let formattedContext: string;
    let fullRepoContextData = null;
    let contextChunksForStorage: unknown = null;

    if (mode === "full_repo") {
      // Full repo mode: Get complete file list
      const fullContext = await getFullRepoContext(repositoryIds);
      formattedContext = fullContext;
      fullRepoContextData = formatFullRepoContextForStorage(fullContext);
      contextChunksForStorage = { type: "full_repo", fileCount: repositories.reduce((acc, r) => acc + r.fileCount, 0) };
    } else {
      // Indexed mode: Vector search (default)
      const context = repositoryIds.length === 1
        ? await retrieveContext(repositoryIds[0]!, message)
        : await retrieveMultiRepoContext(repositoryIds, message);
      formattedContext = formatContextForPrompt(context.chunks);
      contextChunksForStorage = {
        chunks: context.chunks.map((c) => ({
          filePath: c.filePath,
          startLine: c.startLine,
          endLine: c.endLine,
          content: c.content.slice(0, 500),
        })),
        totalTokens: context.totalTokens,
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
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          repository: { select: { id: true, fullName: true, language: true } },
        },
      });

      const encoder = new TextEncoder();
      let fullResponse = "";

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send conversation metadata first so frontend can set selectedConversation
            const meta = JSON.stringify({
              conversationId: conversation.id,
              title: conversation.title,
              repositoryIds: conversation.repositoryIds,
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

            const stream = await generateChatResponseStream(CHAT_SYSTEM_PROMPT, chatMessages);

            for await (const chunk of stream.stream) {
              const text = chunk.text();
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text, done: false })}\n\n`));
            }

            const assistantMessage = await db.message.create({
              data: { conversationId: conversation.id, role: "assistant", content: fullResponse },
            });

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id })}\n\n`));
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error", done: true })}\n\n`));
            controller.close();
          }
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
            { role: "assistant", content: aiResponse },
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
          messages: (conversation as never as { messages: {id: string; conversationId: string; role: string; content: string; contextChunks: unknown; createdAt: Date}[] }).messages.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            contextChunks: m.contextChunks,
            createdAt: m.createdAt,
          })),
          repository: (conversation as never as { repository: {id: string; fullName: string; language: string | null} }).repository,
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
