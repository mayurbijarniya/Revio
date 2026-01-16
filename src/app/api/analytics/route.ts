import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";

/**
 * GET /api/analytics
 * Get analytics data for the authenticated user
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's repositories
    const repositories = await db.repository.findMany({
      where: { userId: session.userId },
      select: { id: true },
    });

    const repoIds = repositories.map((r) => r.id);

    // Get total stats
    const [
      totalRepos,
      totalIndexedFiles,
      totalReviews,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      db.repository.count({ where: { userId: session.userId } }),
      db.indexedFile.count({
        where: { repository: { userId: session.userId } },
      }),
      db.prReview.count({
        where: { repositoryId: { in: repoIds } },
      }),
      db.conversation.count({ where: { userId: session.userId } }),
      db.message.count({
        where: { conversation: { userId: session.userId } },
      }),
    ]);

    // Get reviews by status
    const reviewsByStatus = await db.prReview.groupBy({
      by: ["status"],
      where: { repositoryId: { in: repoIds } },
      _count: true,
    });

    // Get reviews over time (last N days)
    const reviewsOverTime = await db.prReview.findMany({
      where: {
        repositoryId: { in: repoIds },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group reviews by day
    const reviewsByDay: Record<string, { date: string; count: number; completed: number; failed: number }> = {};

    // Initialize all days in range with 0
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0] ?? "";
      if (dateStr) {
        reviewsByDay[dateStr] = { date: dateStr, count: 0, completed: 0, failed: 0 };
      }
    }

    reviewsOverTime.forEach((review) => {
      const dateParts = review.createdAt.toISOString().split("T");
      const date = dateParts[0] ?? "";
      if (!date || !reviewsByDay[date]) return;

      const dayStat = reviewsByDay[date];
      if (dayStat) {
        dayStat.count++;
        if (review.status === "completed") dayStat.completed++;
        if (review.status === "failed") dayStat.failed++;
      }
    });

    // Sort by date ascending for the graph
    const sortedReviewsByDay = Object.values(reviewsByDay).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Get top repositories by reviews
    const topReposByReviews = await db.prReview.groupBy({
      by: ["repositoryId"],
      where: { repositoryId: { in: repoIds } },
      _count: true,
      orderBy: { _count: { repositoryId: "desc" } },
      take: 5,
    });

    // Get repository names for top repos
    const topRepoIds = topReposByReviews.map((r) => r.repositoryId);
    const topRepos = await db.repository.findMany({
      where: { id: { in: topRepoIds } },
      select: { id: true, name: true, fullName: true },
    });

    const topReposWithNames = topReposByReviews.map((r) => {
      const repo = topRepos.find((tr) => tr.id === r.repositoryId);
      return {
        repositoryId: r.repositoryId,
        name: repo?.name || "Unknown",
        fullName: repo?.fullName || "Unknown",
        reviewCount: r._count,
      };
    });

    // Get review feedback stats
    const feedbackStats = await db.prReview.groupBy({
      by: ["feedback"],
      where: {
        repositoryId: { in: repoIds },
        feedback: { not: null },
      },
      _count: true,
    });

    // Get conversations over time
    const conversationsOverTime = await db.conversation.findMany({
      where: {
        userId: session.userId,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group conversations by day
    const conversationsByDay: Record<string, number> = {};
    conversationsOverTime.forEach((conv) => {
      const dateParts = conv.createdAt.toISOString().split("T");
      const date = dateParts[0] ?? "";
      if (!date) return;
      conversationsByDay[date] = (conversationsByDay[date] || 0) + 1;
    });

    // Get index status distribution
    const indexStatusDist = await db.repository.groupBy({
      by: ["indexStatus"],
      where: { userId: session.userId },
      _count: true,
    });

    // ===== CODE QUALITY METRICS =====
    // Get completed reviews with issues for code quality analysis
    const completedReviews = await db.prReview.findMany({
      where: {
        repositoryId: { in: repoIds },
        status: "completed",
        createdAt: { gte: startDate },
      },
      select: {
        issues: true,
        repositoryId: true,
        createdAt: true,
      },
    });

    // Aggregate issue metrics
    interface ReviewIssue {
      file?: string;
      line?: number;
      severity?: string;
      category?: string;
      title?: string;
    }

    const severityCounts: Record<string, number> = {
      critical: 0,
      warning: 0,
      suggestion: 0,
      info: 0,
    };

    const categoryCounts: Record<string, number> = {
      bug: 0,
      security: 0,
      performance: 0,
      style: 0,
      logic: 0,
      error_handling: 0,
      testing: 0,
      documentation: 0,
    };

    const fileCounts: Record<string, number> = {};
    let totalIssues = 0;

    // Track repo-level quality trend (first half vs second half)
    const midDate = new Date(startDate);
    midDate.setDate(midDate.getDate() + Math.floor(days / 2));
    const repoTrendAgg = new Map<
      string,
      { beforeSum: number; beforeCount: number; afterSum: number; afterCount: number }
    >();

    completedReviews.forEach((review) => {
      const issues = Array.isArray(review.issues) ? (review.issues as ReviewIssue[]) : [];

      issues.forEach((issue) => {
        totalIssues++;

        // Count by severity
        const sev = issue.severity;
        if (sev && sev in severityCounts) {
          severityCounts[sev] = (severityCounts[sev] ?? 0) + 1;
        }

        // Count by category
        const cat = issue.category;
        if (cat && cat in categoryCounts) {
          categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
        }

        // Count by file
        if (issue.file) {
          fileCounts[issue.file] = (fileCounts[issue.file] ?? 0) + 1;
        }
      });

      // Repo trend quality score per review: 100 - (issues * 10)
      const quality = Math.max(0, 100 - Math.round(issues.length * 10));
      const agg = repoTrendAgg.get(review.repositoryId) || {
        beforeSum: 0,
        beforeCount: 0,
        afterSum: 0,
        afterCount: 0,
      };
      if (review.createdAt < midDate) {
        agg.beforeSum += quality;
        agg.beforeCount++;
      } else {
        agg.afterSum += quality;
        agg.afterCount++;
      }
      repoTrendAgg.set(review.repositoryId, agg);
    });

    const repoIndex = new Map(topRepos.map((r) => [r.id, r]));

    const decliningRepositories = Array.from(repoTrendAgg.entries())
      .map(([repositoryId, agg]) => {
        const beforeAvg = agg.beforeCount > 0 ? agg.beforeSum / agg.beforeCount : null;
        const afterAvg = agg.afterCount > 0 ? agg.afterSum / agg.afterCount : null;
        const reviewCount = agg.beforeCount + agg.afterCount;
        if (beforeAvg === null || afterAvg === null) return null;
        if (reviewCount < 4) return null;

        const fromQuality = Math.round(beforeAvg * 10) / 10;
        const toQuality = Math.round(afterAvg * 10) / 10;
        const deltaQuality = Math.round((toQuality - fromQuality) * 10) / 10;

        const repo = repoIndex.get(repositoryId);
        return {
          repositoryId,
          name: repo?.name || "Unknown",
          fullName: repo?.fullName || "Unknown",
          reviewCount,
          fromQuality,
          toQuality,
          deltaQuality,
        };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((a, b) => a.deltaQuality - b.deltaQuality)
      .slice(0, 5)
      .filter((r) => r.deltaQuality < 0);

    // Get top files with most issues (top 10)
    const topFilesWithIssues = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count }));

    // Convert severity and category counts to arrays
    const bySeverity = Object.entries(severityCounts)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => {
        const order = ["critical", "warning", "suggestion", "info"];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      });

    const byCategory = Object.entries(categoryCounts)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return jsonSuccess({
      overview: {
        totalRepositories: totalRepos,
        totalIndexedFiles: totalIndexedFiles,
        totalReviews: totalReviews,
        totalConversations: totalConversations,
        totalMessages: totalMessages,
      },
      reviews: {
        byStatus: reviewsByStatus.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        byDay: sortedReviewsByDay,
        topRepositories: topReposWithNames,
        feedback: feedbackStats.map((f) => ({
          feedback: f.feedback,
          count: f._count,
        })),
      },
      conversations: {
        byDay: Object.entries(conversationsByDay).map(([date, count]) => ({
          date,
          count,
        })),
      },
      repositories: {
        byIndexStatus: indexStatusDist.map((s) => ({
          status: s.indexStatus,
          count: s._count,
        })),
      },
      codeQuality: {
        totalIssues,
        bySeverity,
        byCategory,
        topFilesWithIssues,
        decliningRepositories,
        avgIssuesPerReview: completedReviews.length > 0
          ? Math.round((totalIssues / completedReviews.length) * 10) / 10
          : 0,
      },
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    }, 200);
  } catch (error) {
    console.error("Failed to get analytics:", error);
    return jsonError("INTERNAL_001", "Failed to get analytics", 500);
  }
}
