import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ChatLayout } from "./chat-layout";

export default async function ChatPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Get user's repositories that are indexed
  const repositories = await db.repository.findMany({
    where: {
      userId: session.userId,
      indexStatus: "indexed",
    },
    select: {
      id: true,
      fullName: true,
      language: true,
    },
    orderBy: { fullName: "asc" },
  });

  // Get recent conversations
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

  return (
    <ChatLayout
      repositories={repositories}
      conversations={formattedConversations}
    />
  );
}
