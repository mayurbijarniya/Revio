import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ChatLayout } from "../chat-layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

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

  // Get the specific conversation
  const conversation = await db.conversation.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    include: {
      repository: {
        select: { fullName: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    notFound();
  }

  // Get the repositories that were used in this conversation
  const repositoryIds = conversation.repositoryIds?.length > 0
    ? conversation.repositoryIds
    : [conversation.repositoryId];

  const conversationRepos = repositories.filter((r) =>
    repositoryIds.includes(r.id)
  );

  // Get recent conversations for sidebar
  const recentConversations = await db.conversation.findMany({
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

  const formattedConversations = recentConversations.map((conv) => ({
    id: conv.id,
    title: conv.title ?? "New conversation",
    repositoryName: conv.repository.fullName,
    lastMessage: conv.messages[0]?.content?.slice(0, 60),
    updatedAt: conv.updatedAt,
  }));

  const formattedMessages = conversation.messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    createdAt: msg.createdAt,
  }));

  return (
    <ChatLayout
      repositories={repositories}
      conversations={formattedConversations}
      initialConversationId={conversation.id}
      initialMessages={formattedMessages}
      initialSelectedRepos={conversationRepos}
    />
  );
}
