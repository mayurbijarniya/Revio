import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { sendMessageSchema } from "@/types/chat";
import { retrieveContext, retrieveMultiRepoContext, formatContextForPrompt, type SearchFilters } from "@/lib/services/retriever";
import {
  generateChatResponse,
  generateChatResponseStream,
  type ChatMessage,
} from "@/lib/services/gemini";
import { CHAT_SYSTEM_PROMPT, buildFollowUpMessage } from "@/lib/prompts/chat";

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

    // Convert filters from Zod type to retriever type
    const searchFilters: SearchFilters | undefined = filters ? {
      extensions: filters.extensions,
      paths: filters.paths,
      types: filters.types,
    } : undefined;

    // Verify conversation ownership and get repository
    const conversation = await db.conversation.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      include: {
        repository: {
          select: { id: true, indexStatus: true, fullName: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20, // Get last 20 messages for context
        },
      },
    });

    if (!conversation) {
      return jsonError("CHAT_002", "Conversation not found", 404);
    }

    // Get all repos in this conversation to check indexing status
    const repositoryIds = conversation.repositoryIds?.length > 0
      ? conversation.repositoryIds
      : [conversation.repositoryId];

    const repos = await db.repository.findMany({
      where: { id: { in: repositoryIds } },
      select: { id: true, indexStatus: true, fullName: true },
    });

    // Check if all repos are indexed
    const notIndexed = repos.filter((r) => r.indexStatus !== "indexed");
    if (notIndexed.length > 0) {
      const names = notIndexed.map((r) => r.fullName).join(", ");
      return jsonError(
        "INDEX_003",
        `All repositories must be indexed before chatting. Not indexed: ${names}`,
        400
      );
    }

    // Retrieve relevant context for this message
    // Use low score threshold for complex cross-file queries
    const newContext = repositoryIds.length === 1
      ? await retrieveContext(repositoryIds[0]!, content, {
          maxChunks: 15,
          scoreThreshold: 0.1,
          filters: searchFilters,
        })
      : await retrieveMultiRepoContext(repositoryIds, content, {
          maxChunks: 15,
          scoreThreshold: 0.1,
          filters: searchFilters,
        });
    const formattedContext =
      newContext.chunks.length > 0
        ? formatContextForPrompt(newContext.chunks)
        : undefined;

    // Build chat history
    const chatMessages: ChatMessage[] = conversation.messages.map((m) => ({
      role: m.role as "user" | "model",
      content: m.content,
    }));

    // Add the new user message
    chatMessages.push({
      role: "user",
      content: buildFollowUpMessage(content, formattedContext),
    });

    // Save user message
    const userMessage = await db.message.create({
      data: {
        conversationId: id,
        role: "user",
        content,
        contextChunks:
          newContext.chunks.length > 0
            ? {
                chunks: newContext.chunks.map((c) => ({
                  filePath: c.filePath,
                  startLine: c.startLine,
                  endLine: c.endLine,
                  content: c.content.slice(0, 500),
                })),
                totalTokens: newContext.totalTokens,
              }
            : undefined,
      },
    });

    // Update conversation timestamp
    await db.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    if (isStreaming) {
      // Return streaming response
      const stream = await generateChatResponseStream(
        CHAT_SYSTEM_PROMPT,
        chatMessages
      );

      const encoder = new TextEncoder();
      let fullResponse = "";

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream.stream) {
              const text = chunk.text();
              fullResponse += text;

              // Send SSE event
              const data = JSON.stringify({ content: text, done: false });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Save assistant message
            const assistantMessage = await db.message.create({
              data: {
                conversationId: id,
                role: "assistant",
                content: fullResponse,
              },
            });

            // Send final event with message ID
            const finalData = JSON.stringify({
              done: true,
              messageId: assistantMessage.id,
            });
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
            const errorData = JSON.stringify({ error: "Stream error", done: true });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
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

    // Non-streaming response
    const aiResponse = await generateChatResponse(CHAT_SYSTEM_PROMPT, chatMessages);

    // Save assistant message
    const assistantMessage = await db.message.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: aiResponse,
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
