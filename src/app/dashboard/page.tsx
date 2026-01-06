import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderGit2, MessageSquare, GitPullRequest, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Get user stats
  const [user, repoCount, conversationCount, reviewCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { githubUsername: true, plan: true },
    }),
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
  ]);

  if (!user) {
    redirect("/login");
  }

  // Get recent activity
  const recentReviews = await db.prReview.findMany({
    where: {
      repository: { userId: session.userId },
    },
    include: {
      repository: {
        select: { fullName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {user.githubUsername}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your repositories
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/dashboard/repos"
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FolderGit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold">Repositories</h2>
                <p className="text-2xl font-bold">{repoCount}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link
          href="/dashboard/chat"
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="font-semibold">Conversations</h2>
                <p className="text-2xl font-bold">{conversationCount}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <Link
          href="/dashboard/reviews"
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-green-500 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <GitPullRequest className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="font-semibold">PR Reviews</h2>
                <p className="text-2xl font-bold">{reviewCount}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent PR Reviews</h2>

        {recentReviews.length === 0 ? (
          <div className="text-center py-8">
            <GitPullRequest className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No PR reviews yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect a repository and enable auto-review to get started
            </p>
            <Link
              href="/dashboard/repos"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentReviews.map((review) => (
              <a
                key={review.id}
                href={review.prUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div>
                  <div className="font-medium">
                    {review.repository.fullName} #{review.prNumber}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-md">
                    {review.prTitle}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    review.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : review.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {review.status}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
