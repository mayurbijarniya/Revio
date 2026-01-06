import { z } from "zod";

/**
 * Conversation with repository
 */
export interface Conversation {
  id: string;
  repositoryId: string;
  repositoryIds: string[];
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message in a conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  context?: MessageContext;
  createdAt: Date;
}

/**
 * Context attached to a message
 */
export interface MessageContext {
  chunks: {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
  }[];
  totalTokens: number;
}

/**
 * Conversation list item (without messages)
 */
export interface ConversationListItem {
  id: string;
  repositoryId: string;
  repositoryIds: string[];
  repositoryName: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full conversation with messages
 */
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  repository: {
    id: string;
    fullName: string;
    language: string | null;
  };
}

// Zod Schemas

export const createConversationSchema = z.object({
  repositoryIds: z.array(z.string()).min(1, "At least one repository is required"),
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message is required").max(10000, "Message too long"),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
