import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ChatLayout } from "./chat-layout";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const conversationId = params.id as string | undefined;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedConversations = conversations.map((conv: any) => ({
    id: conv.id,
    title: conv.title ?? "New conversation",
    repositoryName: conv.repository.fullName,
    lastMessage: conv.messages[0]?.content?.slice(0, 60),
    updatedAt: conv.updatedAt,
    isPinned: conv.isPinned ?? false,
    mode: (conv.mode as "indexed" | "full_repo") ?? "indexed",
  }));

  // If conversation ID is provided, load that conversation
  let initialConversationId: string | undefined;
  let initialMessages: { id: string; role: "user" | "assistant"; content: string; createdAt: Date }[] | undefined;
  let initialSelectedRepos: { id: string; fullName: string; language: string | null }[] | undefined;
  let initialMode: "indexed" | "full_repo" | undefined;

  if (conversationId) {
    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.userId,
      },
      include: {
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

    if (conversation) {
      initialConversationId = conversation.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialMode = ((conversation as any).mode as "indexed" | "full_repo") || "indexed";
      initialMessages = conversation.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        createdAt: msg.createdAt,
      }));

      // Load the repos that were used in this conversation
      const repositoryIds = conversation.repositoryIds?.length > 0
        ? conversation.repositoryIds
        : [conversation.repositoryId];

      initialSelectedRepos = repositories.filter((r) =>
        repositoryIds.includes(r.id)
      );
    }
  }

  return (
    <ChatLayout
      repositories={repositories}
      conversations={formattedConversations}
      initialConversationId={initialConversationId}
      initialMessages={initialMessages}
      initialSelectedRepos={initialSelectedRepos}
      initialMode={initialMode}
    />
  );
}
