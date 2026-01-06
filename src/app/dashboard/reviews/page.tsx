import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ReviewsList } from "./reviews-list";

export default async function ReviewsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Get all repositories for filter
  const repositories = await db.repository.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      name: true,
      fullName: true,
    },
    orderBy: { name: "asc" },
  });

  // Get all PR reviews with repository info
  const reviews = await db.prReview.findMany({
    where: {
      repository: { userId: session.userId },
    },
    include: {
      repository: {
        select: {
          id: true,
          name: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Get counts by status
  const [totalCount, completedCount, failedCount, pendingCount] = await Promise.all([
    db.prReview.count({
      where: { repository: { userId: session.userId } },
    }),
    db.prReview.count({
      where: {
        repository: { userId: session.userId },
        status: "completed",
      },
    }),
    db.prReview.count({
      where: {
        repository: { userId: session.userId },
        status: "failed",
      },
    }),
    db.prReview.count({
      where: {
        repository: { userId: session.userId },
        status: "pending",
      },
    }),
  ]);

  return (
    <ReviewsList
      reviews={reviews.map((r) => ({
        id: r.id,
        prNumber: r.prNumber,
        prTitle: r.prTitle,
        prAuthor: r.prAuthor,
        prUrl: r.prUrl,
        status: r.status,
        summary: r.summary,
        createdAt: r.createdAt,
        repository: r.repository,
      }))}
      repositories={repositories}
      counts={{
        total: totalCount,
        completed: completedCount,
        failed: failedCount,
        pending: pendingCount,
      }}
    />
  );
}
