import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderGit2, MessageSquare, GitPullRequest, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

interface RecentReview {
  id: string;
  prNumber: number;
  prTitle: string | null;
  prUrl: string | null;
  status: string;
  repository: {
    fullName: string;
  };
}

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
  const recentReviews: RecentReview[] = await db.prReview.findMany({
    where: {
      repository: { userId: session.userId },
    },
    include: {
      repository: {
        select: { fullName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
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
          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-[#4F46E5] hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#4F46E5] rounded-xl flex items-center justify-center shadow-sm">
              <FolderGit2 className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#4F46E5] transition-colors" />
          </div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Repositories</h2>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{repoCount}</p>
        </Link>

        <Link
          href="/dashboard/chat"
          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-[#14B8A6] hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#14B8A6] rounded-xl flex items-center justify-center shadow-sm">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#14B8A6] transition-colors" />
          </div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Conversations</h2>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{conversationCount}</p>
        </Link>

        <Link
          href="/dashboard/reviews"
          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:border-[#10B981] hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#10B981] rounded-xl flex items-center justify-center shadow-sm">
              <GitPullRequest className="w-6 h-6 text-white" />
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#10B981] transition-colors" />
          </div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">PR Reviews</h2>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{reviewCount}</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[500px]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold">Recent PR Reviews</h2>
        </div>

        {recentReviews.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 mb-6 bg-[#ECFDF5] dark:bg-[#064E3B] rounded-2xl flex items-center justify-center">
              <GitPullRequest className="w-10 h-10 text-[#10B981]" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No PR reviews yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
              Connect a repository and enable auto-review to automatically analyze pull requests and get AI-powered feedback.
            </p>
            <Link
              href="/dashboard/repos"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-xl hover:bg-[#4338CA] transition-colors font-medium"
            >
              <FolderGit2 className="w-5 h-5" />
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {recentReviews.map((review) => (
              <Link
                key={review.id}
                href={`/dashboard/reviews/${review.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-100 dark:border-gray-700/50"
              >
                <div className="min-w-0 pr-4">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {review.repository.fullName} <span className="text-gray-500">#{review.prNumber}</span>
                  </div>
                  <div className="text-sm text-gray-500 truncate mt-0.5">
                    {review.prTitle || "No title"}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${review.status === "completed"
                    ? "bg-[#ECFDF5] text-[#10B981]"
                    : review.status === "failed"
                      ? "bg-[#FEF2F2] text-[#EF4444]"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                >
                  {review.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
