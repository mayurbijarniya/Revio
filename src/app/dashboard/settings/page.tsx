import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { countMcpReviewsSince } from "@/lib/plan-limits";
import { DEFAULT_REVIEW_PROVIDER } from "@/lib/constants";
import { isDeepSeekAvailable, isReviewProvider } from "@/lib/services/review-model";
import { SettingsPage } from "./settings-page";

export default async function Settings() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      githubId: true,
      githubUsername: true,
      email: true,
      avatarUrl: true,
      plan: true,
      reviewProvider: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Get usage stats
  const [repoCount, conversationCount, reviewCount, messageCount] = await Promise.all([
    db.repository.count({
      where: { userId: session.userId },
    }),
    db.conversation.count({
      where: { userId: session.userId },
    }),
    db.prReview.count({
      where: {
        repository: { userId: session.userId },
      },
    }),
    db.message.count({
      where: {
        conversation: { userId: session.userId },
      },
    }),
  ]);

  // Get current month usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthlyPrReviews, monthlyMcpReviews] = await Promise.all([
    db.prReview.count({
      where: {
        repository: { userId: session.userId },
        createdAt: { gte: startOfMonth },
      },
    }),
    // Reviews requested through MCP count toward the same monthly review limit
    countMcpReviewsSince(session.userId, startOfMonth),
  ]);
  const monthlyReviews = monthlyPrReviews + monthlyMcpReviews;

  const monthlyMessages = await db.message.count({
    where: {
      conversation: { userId: session.userId },
      createdAt: { gte: startOfMonth },
    },
  });

  return (
    <SettingsPage
      user={{
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        email: user.email,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        reviewProvider: isReviewProvider(user.reviewProvider) ? user.reviewProvider : DEFAULT_REVIEW_PROVIDER,
        createdAt: user.createdAt,
      }}
      deepSeekAvailable={isDeepSeekAvailable()}
      stats={{
        repositories: repoCount,
        conversations: conversationCount,
        reviews: reviewCount,
        messages: messageCount,
      }}
      monthlyUsage={{
        reviews: monthlyReviews,
        messages: monthlyMessages,
      }}
    />
  );
}
