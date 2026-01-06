import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ConversationView } from "./conversation-view";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Get the conversation with messages
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      userId: session.userId,
    },
    include: {
      repository: {
        select: { id: true, fullName: true, language: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    redirect("/dashboard/chat");
  }

  // Get all conversations for sidebar
  const conversations = await db.conversation.findMany({
    where: {
      userId: session.userId,
    },
    include: {
      repository: {
        select: { fullName: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const formattedConversations = conversations.map((conv) => ({
    id: conv.id,
    title: conv.title ?? "New conversation",
    repositoryName: conv.repository.fullName,
    lastMessage: conv.messages[0]?.content?.slice(0, 60),
    updatedAt: conv.updatedAt,
  }));

  const formattedMessages = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt,
  }));

  return (
    <ConversationView
      conversation={{
        id: conversation.id,
        title: conversation.title ?? "Conversation",
        repositoryName: conversation.repository.fullName,
      }}
      initialMessages={formattedMessages}
      conversations={formattedConversations}
    />
  );
}
