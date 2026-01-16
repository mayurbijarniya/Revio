/**
 * Bot Conversation Service
 *
 * Handles interactive @bot conversations in PR comments.
 * Supports commands: explain, why, ignore, re-review
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { recordIgnorePattern } from "./learning";

export interface BotMessage {
  role: "user" | "bot";
  content: string;
  timestamp: string;
  commentId?: number;
  userId?: string;
}

export interface BotCommand {
  command: "explain" | "why" | "ignore" | "re-review" | "unknown";
  args: string;
  rawContent: string;
}

/**
 * Parse @bot mention from GitHub comment
 */
export function parseBotCommand(commentBody: string): BotCommand | null {
  // Check for @revio-bot or @bot mentions
  const botMentionRegex = /@(?:revio-bot|bot)\s+([\s\S]+)/i;
  const match = commentBody.match(botMentionRegex);

  if (!match || !match[1]) {
    return null;
  }

  const rawContent = match[1].trim();
  const lowerContent = rawContent.toLowerCase();

  // Detect command
  let command: BotCommand["command"] = "unknown";
  let args = rawContent;

  if (lowerContent.startsWith("explain")) {
    command = "explain";
    args = rawContent.substring("explain".length).trim();
  } else if (lowerContent.startsWith("why did you suggest") || lowerContent.startsWith("why")) {
    command = "why";
    args = rawContent.substring(lowerContent.indexOf("why")).trim();
  } else if (lowerContent.startsWith("ignore")) {
    command = "ignore";
    args = rawContent.substring("ignore".length).trim();
  } else if (lowerContent.startsWith("re-review") || lowerContent.startsWith("review again")) {
    command = "re-review";
    args = "";
  }

  return {
    command,
    args,
    rawContent,
  };
}

/**
 * Get or create bot conversation for a PR review
 */
export async function getOrCreateConversation(
  prReviewId: string,
  repositoryId: string,
  prNumber: number
): Promise<{ id: string; messages: BotMessage[] }> {
  try {
    // Try to find existing conversation
    let conversation = await db.botConversation.findUnique({
      where: { prReviewId },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await db.botConversation.create({
        data: {
          prReviewId,
          repositoryId,
          prNumber,
          messages: [],
        },
      });

      logger.info("Created new bot conversation", {
        conversationId: conversation.id,
        prReviewId,
        prNumber,
      });
    }

    const messages = (conversation.messages as unknown as BotMessage[]) || [];

    return {
      id: conversation.id,
      messages,
    };
  } catch (error) {
    logger.error("Failed to get/create bot conversation", error as Error, {
      prReviewId,
      prNumber,
    });
    throw error;
  }
}

/**
 * Add message to bot conversation
 */
export async function addMessageToConversation(
  conversationId: string,
  message: BotMessage
): Promise<void> {
  try {
    const conversation = await db.botConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messages = (conversation.messages as unknown as BotMessage[]) || [];
    messages.push(message);

    await db.botConversation.update({
      where: { id: conversationId },
      data: {
        messages: messages as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info("Added message to bot conversation", {
      conversationId,
      role: message.role,
      messageLength: message.content.length,
    });
  } catch (error) {
    logger.error("Failed to add message to conversation", error as Error, {
      conversationId,
    });
    throw error;
  }
}

/**
 * Get conversation history formatted for AI context
 */
export function formatConversationHistory(messages: BotMessage[]): string {
  if (messages.length === 0) {
    return "No previous conversation.";
  }

  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Revio Bot";
      return `${role}: ${msg.content}`;
    })
    .join("\n\n");
}

/**
 * Handle "explain this" command
 */
export async function handleExplainCommand(
  args: string,
  prReviewId: string
): Promise<string> {
  // Get PR review to access code context
  const review = await db.prReview.findUnique({
    where: { id: prReviewId },
    include: { repository: true },
  });

  if (!review) {
    return "I couldn't find the PR review. Please try again.";
  }

  // If args is empty, explain the overall PR changes
  if (!args || args === "this") {
    return `Let me explain the changes in this PR:\n\n${review.summary || "No summary available yet."}`;
  }

  // Otherwise, try to explain specific code mentioned
  return `You asked me to explain: "${args}"\n\nBased on the PR review, this appears to be related to the changes in this pull request. ${review.summary || ""}`;
}

/**
 * Handle "why did you suggest X?" command
 */
export async function handleWhyCommand(
  args: string,
  prReviewId: string
): Promise<string> {
  // Get PR review to access issues and suggestions
  const review = await db.prReview.findUnique({
    where: { id: prReviewId },
  });

  if (!review) {
    return "I couldn't find the PR review. Please try again.";
  }

  const issues = (review.issues as Array<{ description: string; suggestion?: string }>) || [];
  const suggestions = (review.suggestions as Array<{ description: string }>) || [];

  // Try to find matching issue/suggestion
  const allItems = [
    ...issues.map((i) => ({ text: i.description, suggestion: i.suggestion })),
    ...suggestions.map((s) => ({ text: s.description, suggestion: undefined as string | undefined })),
  ];

  const argsLower = args.toLowerCase();
  const matchingItem = allItems.find((item) =>
    item.text.toLowerCase().includes(argsLower) || argsLower.includes(item.text.toLowerCase())
  );

  if (matchingItem) {
    let response = `I suggested this because: ${matchingItem.text}`;
    if (matchingItem.suggestion) {
      response += `\n\nRecommended fix: ${matchingItem.suggestion}`;
    }
    return response;
  }

  // Generic response if no match found
  return `You asked about: "${args}"\n\nI made this suggestion based on code analysis, security scanning, and coding standards. If you'd like more details about a specific issue, please quote the exact text from my review.`;
}

/**
 * Handle "ignore this" command
 */
export async function handleIgnoreCommand(
  args: string,
  prReviewId: string,
  repositoryId: string
): Promise<string> {
  // Get repository to access review rules
  const repository = await db.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    return "I couldn't find the repository settings. Please try again.";
  }

  // For now, just acknowledge - full implementation would update ReviewLearning
  logger.info("User requested to ignore pattern", {
    prReviewId,
    repositoryId,
    pattern: args,
  });

  try {
    await recordIgnorePattern({
      repositoryId,
      pattern: args || "this type of issue",
      reason: `Ignored via @revio-bot on review ${prReviewId}`,
    });
  } catch (error) {
    logger.error("Failed to record ignore pattern", error as Error, {
      prReviewId,
      repositoryId,
    });
  }

  return `Noted! I'll remember that you want to ignore: "${args || "this type of issue"}"\n\nThis feedback will help improve future reviews for this repository. You can also configure ignored patterns in the repository settings.`;
}

/**
 * Handle "re-review" command
 */
export async function handleReReviewCommand(
  prReviewId: string,
  prNumber: number,
  repositoryId: string
): Promise<string> {
  logger.info("User requested re-review via bot command", {
    prReviewId,
    prNumber,
    repositoryId,
  });

  // Trigger re-review will be handled by webhook handler
  return `I'll re-review this PR now. This may take a minute...`;
}

/**
 * Process bot command and generate response
 */
export async function processBotCommand(
  command: BotCommand,
  prReviewId: string,
  repositoryId: string,
  prNumber: number
): Promise<string> {
  try {
    let response: string;

    switch (command.command) {
      case "explain":
        response = await handleExplainCommand(command.args, prReviewId);
        break;

      case "why":
        response = await handleWhyCommand(command.args, prReviewId);
        break;

      case "ignore":
        response = await handleIgnoreCommand(command.args, prReviewId, repositoryId);
        break;

      case "re-review":
        response = await handleReReviewCommand(prReviewId, prNumber, repositoryId);
        break;

      default:
        response = `I didn't understand that command. Try:\n- \`@revio-bot explain this\` - Explain the PR changes\n- \`@revio-bot why did you suggest X?\` - Explain a specific suggestion\n- \`@revio-bot ignore this\` - Ignore this type of issue\n- \`@revio-bot re-review\` - Re-review the PR`;
    }

    return response;
  } catch (error) {
    logger.error("Failed to process bot command", error as Error, {
      command: command.command,
      prReviewId,
    });
    return "Sorry, I encountered an error processing your request. Please try again.";
  }
}
