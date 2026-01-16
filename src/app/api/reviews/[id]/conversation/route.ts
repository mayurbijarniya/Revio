/**
 * GET/POST /api/reviews/[id]/conversation - Bot conversation management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { z } from "zod";
import {
  getOrCreateConversation,
  addMessageToConversation,
  processBotCommand,
  type BotMessage,
} from "@/lib/services/bot-conversation";

const sendMessageSchema = z.object({
  message: z.string().min(1),
  command: z.enum(["explain", "why", "ignore", "re-review", "unknown"]).optional(),
  args: z.string().optional(),
});

/**
 * GET /api/reviews/[id]/conversation - Get bot conversation history
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewId = params.id;

    // Get PR review
    const review = await db.prReview.findUnique({
      where: { id: reviewId },
      include: {
        repository: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Check authorization
    if (review.repository.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get bot conversation
    const conversation = await db.botConversation.findUnique({
      where: { prReviewId: reviewId },
    });

    if (!conversation) {
      return NextResponse.json({
        success: true,
        data: {
          messages: [],
        },
      });
    }

    const messages = (conversation.messages as unknown as BotMessage[]) || [];

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to get bot conversation:", error);
    return NextResponse.json(
      { error: "Failed to get conversation" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews/[id]/conversation - Send message to bot
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewId = params.id;
    const body = await request.json();

    // Validate request
    const result = sendMessageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.issues },
        { status: 400 }
      );
    }

    const { message, command, args } = result.data;

    // Get PR review
    const review = await db.prReview.findUnique({
      where: { id: reviewId },
      include: {
        repository: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Check authorization
    if (review.repository.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      reviewId,
      review.repository.id,
      review.prNumber
    );

    // Add user message
    const userMessage: BotMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      userId: session.userId,
    };

    await addMessageToConversation(conversation.id, userMessage);

    // Process bot command if provided
    let botResponse: string;

    if (command) {
      botResponse = await processBotCommand(
        { command, args: args || "", rawContent: message },
        reviewId,
        review.repository.id,
        review.prNumber
      );
    } else {
      // Generic response if no specific command
      botResponse =
        "I'm here to help! Try:\n- `explain this` - Explain the PR changes\n- `why did you suggest X?` - Explain a specific suggestion\n- `ignore this` - Ignore this type of issue\n- `re-review` - Re-review the PR";
    }

    // Add bot response
    const botMessage: BotMessage = {
      role: "bot",
      content: botResponse,
      timestamp: new Date().toISOString(),
    };

    await addMessageToConversation(conversation.id, botMessage);

    return NextResponse.json({
      success: true,
      data: {
        userMessage,
        botResponse: botMessage,
      },
    });
  } catch (error) {
    console.error("Failed to send message to bot:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
