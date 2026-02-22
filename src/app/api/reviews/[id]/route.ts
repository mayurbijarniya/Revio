import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";
import { getConfidenceLevel } from "@/lib/services/confidence-scorer";

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

    // Handle backward compatibility for suggestions (may be strings or objects)
    const rawSuggestions = review.suggestions as Array<string | { title?: string; description?: string; priority?: string }> | null;
    const suggestions = rawSuggestions?.map((s, idx) => {
      if (typeof s === "string") {
        // Old format: convert string to object
        return { title: `Positive #${idx + 1}`, description: s };
      }
      return s;
    }) || [];

    // Handle backward compatibility for filesAnalyzed (may be strings or objects)
    const rawFilesAnalyzed = review.filesAnalyzed as Array<string | { path?: string; changes?: number; additions?: number; deletions?: number }> | null;
    const filesAnalyzed = rawFilesAnalyzed?.map((f) => {
      if (typeof f === "string") {
        // Old format: convert string to object
        return { path: f };
      }
      return f;
    }) || [];

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

    // Determine merge readiness based on recommendation and issues
    const recommendation = (review as { recommendation?: string }).recommendation || null;
    const riskLevel = (review as { riskLevel?: string }).riskLevel || null;
    const confidenceScore = (review as { confidenceScore?: number }).confidenceScore || null;
    const confidenceLevel = confidenceScore ? getConfidenceLevel(confidenceScore) : null;
    const sequenceDiagram = (review as { sequenceDiagram?: string | null }).sequenceDiagram || null;
    const docstringSuggestions = (review as { docstringSuggestions?: unknown }).docstringSuggestions || [];
    const blastRadiusRaw = (review as { blastRadius?: unknown }).blastRadius;
    const blastRadius =
      blastRadiusRaw &&
      typeof blastRadiusRaw === "object" &&
      blastRadiusRaw !== null &&
      "mermaid" in blastRadiusRaw
        ? blastRadiusRaw
        : null;
    const testCoverageRaw = (review as { testCoverage?: unknown }).testCoverage;
    const testCoverage =
      testCoverageRaw &&
      typeof testCoverageRaw === "object" &&
      testCoverageRaw !== null &&
      "changedFiles" in testCoverageRaw
        ? testCoverageRaw
        : null;

    // Calculate merge readiness verdict
    let mergeVerdict: "ready" | "needs_changes" | "review" | "pending" = "pending";
    let mergeMessage = "Review is still in progress.";

    if (review.status === "completed") {
      const criticalCount = severityCounts.critical || 0;
      const highCount = severityCounts.high || 0;

      if (recommendation === "approve" && criticalCount === 0 && highCount === 0) {
        mergeVerdict = "ready";
        mergeMessage = "This PR looks good and is ready to merge!";
      } else if (recommendation === "request_changes" || criticalCount > 0 || highCount > 0) {
        mergeVerdict = "needs_changes";
        mergeMessage = `This PR requires changes before merging. Found ${criticalCount} critical and ${highCount} high severity issues.`;
      } else {
        mergeVerdict = "review";
        mergeMessage = "This PR has some items to address but may be mergeable after review.";
      }
    }

    return jsonSuccess({
      id: review.id,
      prNumber: review.prNumber,
      prTitle: review.prTitle,
      prUrl: review.prUrl,
      prAuthor: review.prAuthor,
      status: review.status,
      queuedAt: review.queuedAt,
      startedAt: review.startedAt,
      jobId: review.jobId,
      summary: review.summary,
      issues: issues || [],
      issuesByFile,
      issueCount: issues?.length || 0,
      severityCounts,
      categoryCounts,
      suggestions: suggestions || [],
      filesAnalyzed: filesAnalyzed || [],
      recommendation,
      riskLevel,
      confidenceScore,
      confidenceLevel,
      sequenceDiagram,
      docstringSuggestions,
      blastRadius,
      testCoverage,
      mergeVerdict,
      mergeMessage,
      feedback: review.feedback,
      feedbackComment: review.feedbackComment,
      feedbackAt: review.feedbackAt,
      processingTimeMs: review.processingTimeMs,
      tokensUsed: review.tokensUsed,
      githubCommentId: review.githubCommentId ? String(review.githubCommentId) : null,
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
