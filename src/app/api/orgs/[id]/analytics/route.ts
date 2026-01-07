import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { jsonSuccess, jsonError } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

/**
 * GET /api/orgs/[id]/analytics
 * Get team analytics for an organization
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return jsonError("AUTH_002", "Not authenticated", 401);
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const { days } = querySchema.parse({
    days: searchParams.get("days") || 30,
  });

  try {
    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: {
        organizationId: id,
        userId: session.userId,
      },
    });

    if (!membership) {
      return jsonError("ORG_002", "Not a member of this organization", 403);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get organization with repos
    const org = await db.organization.findUnique({
      where: { id },
      include: {
        repositories: {
          select: { id: true, name: true, fullName: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                githubUsername: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!org) {
      return jsonError("ORG_001", "Organization not found", 404);
    }

    const repoIds = org.repositories.map((r) => r.id);

    // Get PR reviews for org repos
    const reviews = await db.prReview.findMany({
      where: {
        repositoryId: { in: repoIds },
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        prNumber: true,
        prTitle: true,
        prAuthor: true,
        status: true,
        createdAt: true,
        processingTimeMs: true,
        issues: true,
        feedback: true,
        requestedById: true,
        assignedToId: true,
        repository: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate team performance metrics
    const teamMetrics = calculateTeamMetrics(reviews, org.members);

    // Calculate per-developer metrics
    const developerMetrics = calculateDeveloperMetrics(reviews, org.members);

    // Calculate repository metrics
    const repoMetrics = calculateRepoMetrics(reviews, org.repositories);

    // Calculate review trends over time
    const reviewTrends = calculateReviewTrends(reviews, days);

    // Calculate code quality trends
    const qualityTrends = calculateQualityTrends(reviews, days);

    return jsonSuccess({
      period: { days, startDate: startDate.toISOString() },
      team: teamMetrics,
      developers: developerMetrics,
      repositories: repoMetrics,
      trends: {
        reviews: reviewTrends,
        quality: qualityTrends,
      },
    });
  } catch (error) {
    console.error("Failed to get org analytics:", error);
    return jsonError("INTERNAL_001", "Failed to get analytics", 500);
  }
}

interface ReviewData {
  id: string;
  prNumber: number;
  prTitle: string | null;
  prAuthor: string | null;
  status: string;
  createdAt: Date;
  processingTimeMs: number | null;
  issues: unknown;
  feedback: string | null;
  requestedById: string | null;
  assignedToId: string | null;
  repository: { id: string; name: string };
}

interface MemberData {
  userId: string;
  role: string;
  user: {
    id: string;
    githubUsername: string | null;
    avatarUrl: string | null;
  };
}

interface RepoData {
  id: string;
  name: string;
  fullName: string;
}

function calculateTeamMetrics(reviews: ReviewData[], members: MemberData[]) {
  const completed = reviews.filter((r) => r.status === "completed");
  const withFeedback = completed.filter((r) => r.feedback);
  const helpful = withFeedback.filter((r) => r.feedback === "helpful");

  // Calculate average processing time
  const processingTimes = completed
    .filter((r) => r.processingTimeMs)
    .map((r) => r.processingTimeMs as number);
  const avgProcessingTime =
    processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;

  // Calculate total issues found
  let totalIssues = 0;
  let criticalIssues = 0;
  for (const review of completed) {
    const issues = review.issues as Array<{ severity?: string }> | null;
    if (Array.isArray(issues)) {
      totalIssues += issues.length;
      criticalIssues += issues.filter(
        (i) => i.severity === "critical" || i.severity === "high"
      ).length;
    }
  }

  return {
    totalReviews: reviews.length,
    completedReviews: completed.length,
    pendingReviews: reviews.filter((r) => r.status === "pending").length,
    failedReviews: reviews.filter((r) => r.status === "failed").length,
    avgProcessingTimeMs: Math.round(avgProcessingTime),
    totalIssuesFound: totalIssues,
    criticalIssuesFound: criticalIssues,
    feedbackRate:
      completed.length > 0
        ? Math.round((withFeedback.length / completed.length) * 100)
        : 0,
    satisfactionRate:
      withFeedback.length > 0
        ? Math.round((helpful.length / withFeedback.length) * 100)
        : 0,
    activeMembers: members.length,
  };
}

function calculateDeveloperMetrics(
  reviews: ReviewData[],
  members: MemberData[]
) {
  const metrics: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    reviewsRequested: number;
    reviewsAssigned: number;
    prsAuthored: number;
    issuesInPrs: number;
    avgIssuesPerPr: number;
  }> = [];

  for (const member of members) {
    const requested = reviews.filter(
      (r) => r.requestedById === member.userId
    );
    const assigned = reviews.filter(
      (r) => r.assignedToId === member.userId
    );
    const authored = reviews.filter(
      (r) => r.prAuthor === member.user.githubUsername
    );

    // Count issues in authored PRs
    let issuesInPrs = 0;
    for (const review of authored) {
      const issues = review.issues as Array<unknown> | null;
      if (Array.isArray(issues)) {
        issuesInPrs += issues.length;
      }
    }

    metrics.push({
      userId: member.userId,
      username: member.user.githubUsername || "Unknown",
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      reviewsRequested: requested.length,
      reviewsAssigned: assigned.length,
      prsAuthored: authored.length,
      issuesInPrs,
      avgIssuesPerPr:
        authored.length > 0
          ? Math.round((issuesInPrs / authored.length) * 10) / 10
          : 0,
    });
  }

  // Sort by PRs authored (most active first)
  return metrics.sort((a, b) => b.prsAuthored - a.prsAuthored);
}

function calculateRepoMetrics(reviews: ReviewData[], repos: RepoData[]) {
  const metrics: Array<{
    id: string;
    name: string;
    fullName: string;
    totalReviews: number;
    completedReviews: number;
    totalIssues: number;
    criticalIssues: number;
    avgIssuesPerReview: number;
  }> = [];

  for (const repo of repos) {
    const repoReviews = reviews.filter((r) => r.repository.id === repo.id);
    const completed = repoReviews.filter((r) => r.status === "completed");

    let totalIssues = 0;
    let criticalIssues = 0;
    for (const review of completed) {
      const issues = review.issues as Array<{ severity?: string }> | null;
      if (Array.isArray(issues)) {
        totalIssues += issues.length;
        criticalIssues += issues.filter(
          (i) => i.severity === "critical" || i.severity === "high"
        ).length;
      }
    }

    metrics.push({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      totalReviews: repoReviews.length,
      completedReviews: completed.length,
      totalIssues,
      criticalIssues,
      avgIssuesPerReview:
        completed.length > 0
          ? Math.round((totalIssues / completed.length) * 10) / 10
          : 0,
    });
  }

  // Sort by total reviews (most active first)
  return metrics.sort((a, b) => b.totalReviews - a.totalReviews);
}

function calculateReviewTrends(reviews: ReviewData[], days: number) {
  const trends: Record<string, { date: string; count: number; completed: number }> = {};

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0] || "";
    trends[dateStr] = { date: dateStr, count: 0, completed: 0 };
  }

  // Fill in review counts
  for (const review of reviews) {
    const dateStr = review.createdAt.toISOString().split("T")[0] || "";
    if (trends[dateStr]) {
      trends[dateStr].count++;
      if (review.status === "completed") {
        trends[dateStr].completed++;
      }
    }
  }

  // Convert to sorted array
  return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateQualityTrends(reviews: ReviewData[], days: number) {
  const trends: Record<
    string,
    { date: string; issues: number; critical: number; reviews: number }
  > = {};

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0] || "";
    trends[dateStr] = { date: dateStr, issues: 0, critical: 0, reviews: 0 };
  }

  // Fill in issue counts
  for (const review of reviews.filter((r) => r.status === "completed")) {
    const dateStr = review.createdAt.toISOString().split("T")[0] || "";
    if (trends[dateStr]) {
      trends[dateStr].reviews++;
      const issues = review.issues as Array<{ severity?: string }> | null;
      if (Array.isArray(issues)) {
        trends[dateStr].issues += issues.length;
        trends[dateStr].critical += issues.filter(
          (i) => i.severity === "critical" || i.severity === "high"
        ).length;
      }
    }
  }

  // Convert to sorted array with averages
  return Object.values(trends)
    .map((t) => ({
      ...t,
      avgIssues: t.reviews > 0 ? Math.round((t.issues / t.reviews) * 10) / 10 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
