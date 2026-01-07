import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reviews/[id]
 * Get detailed PR review information
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;

  try {
    const review = await db.prReview.findFirst({
      where: {
        id,
        repository: {
          userId: session.userId,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            githubUsername: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!review) {
      return jsonError("REVIEW_001", "Review not found", 404);
    }

    // Parse JSON fields
    const issues = review.issues as Array<{
      file?: string;
      filePath?: string;
      line?: number;
      severity?: string;
      category?: string;
      title?: string;
      description?: string;
      suggestion?: string;
      ruleId?: string;
    }> | null;

    const suggestions = review.suggestions as Array<{
      title?: string;
      description?: string;
      priority?: string;
    }> | null;

    const filesAnalyzed = review.filesAnalyzed as Array<{
      path?: string;
      changes?: number;
      additions?: number;
      deletions?: number;
    }> | null;

    // Group issues by file
    const issuesByFile: Record<string, typeof issues> = {};
    const severityCounts = { critical: 0, high: 0, warning: 0, medium: 0, low: 0, info: 0, suggestion: 0 };
    const categoryCounts: Record<string, number> = {};

    if (issues && Array.isArray(issues)) {
      for (const issue of issues) {
        const file = issue.file || issue.filePath || "unknown";
        if (!issuesByFile[file]) {
          issuesByFile[file] = [];
        }
        issuesByFile[file]!.push(issue);

        // Count severities
        const severity = (issue.severity || "info").toLowerCase();
        if (severity in severityCounts) {
          severityCounts[severity as keyof typeof severityCounts]++;
        }

        // Count categories
        const category = issue.category || "other";
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    }

    return jsonSuccess({
      id: review.id,
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      prUrl: review.prUrl,
      prAuthor: review.prAuthor,
      status: review.status,
      summary: review.summary,
      issues: issues || [],
      issuesByFile,
      issueCount: issues?.length || 0,
      severityCounts,
      categoryCounts,
      suggestions: suggestions || [],
      filesAnalyzed: filesAnalyzed || [],
      feedback: review.feedback,
      feedbackComment: review.feedbackComment,
      feedbackAt: review.feedbackAt,
      processingTimeMs: review.processingTimeMs,
      tokensUsed: review.tokensUsed,
      githubCommentId: review.githubCommentId,
      createdAt: review.createdAt,
      repository: review.repository,
      requestedBy: review.requestedBy ? {
        id: review.requestedBy.id,
        githubUsername: review.requestedBy.githubUsername,
        avatarUrl: review.requestedBy.avatarUrl,
      } : null,
      assignedTo: review.assignedTo ? {
        id: review.assignedTo.id,
        githubUsername: review.assignedTo.githubUsername,
        avatarUrl: review.assignedTo.avatarUrl,
      } : null,
    });
  } catch (error) {
    console.error("Failed to get review:", error);
    return jsonError("INTERNAL_001", "Failed to get review", 500);
  }
}
