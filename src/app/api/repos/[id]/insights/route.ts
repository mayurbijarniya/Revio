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
 * GET /api/repos/[id]/insights
 * Get detailed insights for a repository
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
    // Get repository
    const repo = await db.repository.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      include: {
        indexedFiles: {
          select: {
            filePath: true,
            language: true,
            chunkCount: true,
          },
        },
      },
    });

    if (!repo) {
      return jsonError("REPO_001", "Repository not found", 404);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get PR reviews for this repo
    const reviews = await db.prReview.findMany({
      where: {
        repositoryId: id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate code quality metrics
    const qualityMetrics = calculateQualityMetrics(reviews);

    // Calculate issue breakdown
    const issueBreakdown = calculateIssueBreakdown(reviews);

    // Calculate hotspots (files with most issues)
    const hotspots = calculateHotspots(reviews);

    // Calculate trends
    const trends = calculateTrends(reviews, days);

    // Language distribution
    const filesWithLanguage = repo.indexedFiles
      .filter((f): f is { filePath: string; language: string; chunkCount: number } => f.language !== null);
    const languageDistribution = calculateLanguageDistribution(filesWithLanguage);

    // Calculate security metrics from issues
    const securityMetrics = calculateSecurityMetrics(reviews);

    return jsonSuccess({
      repository: {
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        indexStatus: repo.indexStatus,
        fileCount: repo.fileCount,
        chunkCount: repo.chunkCount,
        lastIndexed: repo.indexedAt,
      },
      period: { days, startDate: startDate.toISOString() },
      quality: qualityMetrics,
      issues: issueBreakdown,
      hotspots,
      trends,
      languages: languageDistribution,
      security: securityMetrics,
    });
  } catch (error) {
    console.error("Failed to get repo insights:", error);
    return jsonError("INTERNAL_001", "Failed to get insights", 500);
  }
}

interface ReviewData {
  id: string;
  status: string;
  createdAt: Date;
  processingTimeMs: number | null;
  issues: unknown;
  filesAnalyzed: unknown;
  feedback: string | null;
}

function calculateQualityMetrics(reviews: ReviewData[]) {
  const completed = reviews.filter((r) => r.status === "completed");

  let totalIssues = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const review of completed) {
    const issues = review.issues as Array<{ severity?: string }> | null;
    if (Array.isArray(issues)) {
      totalIssues += issues.length;
      for (const issue of issues) {
        switch (issue.severity) {
          case "critical":
            criticalCount++;
            break;
          case "high":
            highCount++;
            break;
          case "medium":
          case "warning":
            mediumCount++;
            break;
          case "low":
          case "info":
          case "suggestion":
            lowCount++;
            break;
        }
      }
    }
  }

  const avgIssuesPerReview =
    completed.length > 0
      ? Math.round((totalIssues / completed.length) * 10) / 10
      : 0;

  // Calculate quality score (100 - weighted issues)
  const weightedIssues =
    criticalCount * 10 + highCount * 5 + mediumCount * 2 + lowCount * 0.5;
  const qualityScore = Math.max(
    0,
    Math.min(100, 100 - Math.round(weightedIssues / Math.max(1, completed.length)))
  );

  return {
    totalReviews: reviews.length,
    completedReviews: completed.length,
    totalIssues,
    avgIssuesPerReview,
    qualityScore,
    severityBreakdown: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
  };
}

function calculateIssueBreakdown(reviews: ReviewData[]) {
  const categories: Record<string, number> = {};

  for (const review of reviews.filter((r) => r.status === "completed")) {
    const issues = review.issues as Array<{ category?: string }> | null;
    if (Array.isArray(issues)) {
      for (const issue of issues) {
        const category = issue.category || "other";
        categories[category] = (categories[category] || 0) + 1;
      }
    }
  }

  // Convert to sorted array
  return Object.entries(categories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function calculateHotspots(reviews: ReviewData[]) {
  const fileIssues: Record<string, { issues: number; critical: number }> = {};

  for (const review of reviews.filter((r) => r.status === "completed")) {
    const issues = review.issues as Array<{
      file?: string;
      filePath?: string;
      severity?: string;
    }> | null;

    if (Array.isArray(issues)) {
      for (const issue of issues) {
        const file = issue.file || issue.filePath || "unknown";
        if (!fileIssues[file]) {
          fileIssues[file] = { issues: 0, critical: 0 };
        }
        fileIssues[file].issues++;
        if (issue.severity === "critical" || issue.severity === "high") {
          fileIssues[file].critical++;
        }
      }
    }
  }

  // Return top 10 hotspots
  return Object.entries(fileIssues)
    .map(([file, data]) => ({ file, ...data }))
    .sort((a, b) => b.issues - a.issues)
    .slice(0, 10);
}

function calculateTrends(reviews: ReviewData[], days: number) {
  const trends: Record<
    string,
    { date: string; reviews: number; issues: number; avgQuality: number }
  > = {};

  // Initialize days
  for (let i = 0; i < Math.min(days, 30); i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0] || "";
    trends[dateStr] = { date: dateStr, reviews: 0, issues: 0, avgQuality: 100 };
  }

  // Fill in data
  for (const review of reviews.filter((r) => r.status === "completed")) {
    const dateStr = review.createdAt.toISOString().split("T")[0] || "";
    if (trends[dateStr]) {
      trends[dateStr].reviews++;
      const issues = review.issues as Array<unknown> | null;
      if (Array.isArray(issues)) {
        trends[dateStr].issues += issues.length;
      }
    }
  }

  // Calculate average quality per day
  for (const key of Object.keys(trends)) {
    const t = trends[key];
    if (t && t.reviews > 0) {
      // Simple quality score: 100 - (issues per review * 10)
      t.avgQuality = Math.max(0, 100 - Math.round((t.issues / t.reviews) * 10));
    }
  }

  return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateLanguageDistribution(
  files: Array<{ language: string; chunkCount: number }>
) {
  const languages: Record<string, { files: number; chunks: number }> = {};

  for (const file of files) {
    const existing = languages[file.language];
    if (!existing) {
      languages[file.language] = { files: 1, chunks: file.chunkCount };
    } else {
      existing.files++;
      existing.chunks += file.chunkCount;
    }
  }

  return Object.entries(languages)
    .map(([language, data]) => ({ language, ...data }))
    .sort((a, b) => b.files - a.files);
}

function calculateSecurityMetrics(reviews: ReviewData[]) {
  let totalSecurityIssues = 0;
  let criticalSecurityIssues = 0;
  const securityCategories: Record<string, number> = {};

  for (const review of reviews.filter((r) => r.status === "completed")) {
    const issues = review.issues as Array<{
      category?: string;
      severity?: string;
    }> | null;

    if (Array.isArray(issues)) {
      for (const issue of issues) {
        if (issue.category === "security") {
          totalSecurityIssues++;
          if (issue.severity === "critical" || issue.severity === "high") {
            criticalSecurityIssues++;
          }
        }
      }
    }
  }

  // Calculate security score
  const securityScore =
    totalSecurityIssues === 0
      ? 100
      : Math.max(0, 100 - criticalSecurityIssues * 20 - (totalSecurityIssues - criticalSecurityIssues) * 5);

  return {
    totalIssues: totalSecurityIssues,
    criticalIssues: criticalSecurityIssues,
    securityScore,
    categories: Object.entries(securityCategories)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}
