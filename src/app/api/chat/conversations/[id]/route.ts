import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { updateConversationSchema } from "@/types/chat";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/chat/conversations/[id] - Get conversation with messages
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await context.params;

  const conversation = await db.conversation.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      repository: {
        select: { id: true, fullName: true, language: true },
      },
    },
  });

  if (!conversation) {
    return jsonError("CHAT_002", "Conversation not found", 404);
  }

  return jsonSuccess({
    conversation: {
      id: conversation.id,
      repositoryId: conversation.repositoryId,
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
  });
}

/**
 * PATCH /api/chat/conversations/[id] - Update conversation title
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "VALIDATION_001",
        parsed.error.errors[0]?.message ?? "Validation error",
        400
      );
    }

    // Verify ownership
    const existing = await db.conversation.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!existing) {
      return jsonError("CHAT_002", "Conversation not found", 404);
    }

    const updateData: { title?: string; isPinned?: boolean } = {};
    if (parsed.data.title !== undefined) {
      updateData.title = parsed.data.title;
    }
    if (parsed.data.isPinned !== undefined) {
      updateData.isPinned = parsed.data.isPinned;
    }

    const conversation = await db.conversation.update({
      where: { id },
      data: updateData,
    });

    return jsonSuccess({ conversation });
  } catch (error) {
    console.error("Failed to update conversation:", error);
    return jsonError("INTERNAL_001", "Failed to update conversation", 500);
  }
}

/**
 * DELETE /api/chat/conversations/[id] - Delete conversation
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await context.params;

  try {
    // Verify ownership
    const existing = await db.conversation.findFirst({
      where: {
        id,
        userId: session.userId,
      },
    });

    if (!existing) {
      return jsonError("CHAT_002", "Conversation not found", 404);
    }

    // Delete conversation (messages will cascade)
    await db.conversation.delete({
      where: { id },
    });

    return jsonSuccess({ deleted: true });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    return jsonError("INTERNAL_001", "Failed to delete conversation", 500);
  }
}
