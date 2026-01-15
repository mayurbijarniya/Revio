/**
 * Confidence Scoring Service
 * Calculates a 1-5 confidence score for PR merge readiness based on multiple factors
 */

import type { ReviewResult } from "@/lib/prompts/review";
import type { SecurityIssue } from "./security-scanner";

export interface ConfidenceFactors {
  // Issue metrics
  criticalIssues: number;
  highSeverityIssues: number;
  totalIssues: number;

  // Security
  securityIssues: number;
  securityScore: number; // 0-100

  // Code quality
  filesChanged: number;
  linesChanged: number;

  // AI recommendation
  aiRecommendation: "approve" | "request_changes" | "comment" | null;
  riskLevel: "low" | "medium" | "high" | "critical" | null;

  // Standards compliance
  standardsViolations: number;
}

export interface ConfidenceResult {
  score: number; // 1-5
  level: "very_low" | "low" | "medium" | "high" | "very_high";
  reasoning: string[];
  factors: {
    issuesImpact: number; // -2 to 0
    securityImpact: number; // -2 to 0
    complexityImpact: number; // -1 to 0
    aiConfidence: number; // 0 to 2
    standardsImpact: number; // -1 to 0
  };
}

/**
 * Calculate confidence score for a PR review
 */
export function calculateConfidenceScore(
  reviewResult: ReviewResult,
  securityIssues: SecurityIssue[],
  filesChanged: number,
  linesChanged: number,
  standardsViolations: number = 0
): ConfidenceResult {
  // Count issues by severity
  const issues = reviewResult.issues || [];
  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const highIssues = issues.filter((i) => i.severity === "warning").length;

  // Security score (inverse: lower is worse)
  const securityScore = calculateSecurityScore(securityIssues);

  const factors: ConfidenceFactors = {
    criticalIssues,
    highSeverityIssues: highIssues,
    totalIssues: issues.length,
    securityIssues: securityIssues.length,
    securityScore,
    filesChanged,
    linesChanged,
    aiRecommendation: reviewResult.recommendation as "approve" | "request_changes" | "comment",
    riskLevel: reviewResult.riskLevel as "low" | "medium" | "high" | "critical",
    standardsViolations,
  };

  return calculateScore(factors);
}

/**
 * Core confidence scoring algorithm
 */
function calculateScore(factors: ConfidenceFactors): ConfidenceResult {
  const reasoning: string[] = [];
  const baseScore = 5; // Start with perfect score

  // Factor 1: Issues Impact (-2 to 0)
  let issuesImpact = 0;
  if (factors.criticalIssues > 0) {
    issuesImpact = -2;
    reasoning.push(`${factors.criticalIssues} critical issue(s) found`);
  } else if (factors.highSeverityIssues > 2) {
    issuesImpact = -1;
    reasoning.push(`${factors.highSeverityIssues} high-severity issues found`);
  } else if (factors.totalIssues > 5) {
    issuesImpact = -0.5;
    reasoning.push(`${factors.totalIssues} total issues to address`);
  } else if (factors.totalIssues === 0) {
    reasoning.push("No issues detected");
  }

  // Factor 2: Security Impact (-2 to 0)
  let securityImpact = 0;
  if (factors.securityIssues > 0) {
    // Use security score to determine impact (score is 0-100, lower is worse)
    if (factors.securityScore < 50) {
      securityImpact = -2;
      reasoning.push(`Critical security issues detected (score: ${factors.securityScore}/100)`);
    } else if (factors.securityScore < 70) {
      securityImpact = -1.5;
      reasoning.push(`High severity security issues (score: ${factors.securityScore}/100)`);
    } else if (factors.securityScore < 90) {
      securityImpact = -0.5;
      reasoning.push(`Moderate security concerns (score: ${factors.securityScore}/100)`);
    } else {
      securityImpact = -0.25;
      reasoning.push(`Minor security issues (score: ${factors.securityScore}/100)`);
    }
  } else {
    reasoning.push("No security issues detected");
  }

  // Factor 3: Complexity Impact (-1 to 0)
  let complexityImpact = 0;
  if (factors.filesChanged > 20 || factors.linesChanged > 500) {
    complexityImpact = -1;
    reasoning.push(
      `Large PR: ${factors.filesChanged} files, ${factors.linesChanged} lines changed`
    );
  } else if (factors.filesChanged > 10 || factors.linesChanged > 200) {
    complexityImpact = -0.5;
    reasoning.push(
      `Moderate size: ${factors.filesChanged} files, ${factors.linesChanged} lines`
    );
  }

  // Factor 4: AI Confidence (0 to 2)
  let aiConfidence = 0;
  if (factors.aiRecommendation === "approve" && factors.riskLevel === "low") {
    aiConfidence = 2;
    reasoning.push("AI recommends approval with low risk");
  } else if (factors.aiRecommendation === "approve") {
    aiConfidence = 1;
    reasoning.push("AI recommends approval");
  } else if (factors.aiRecommendation === "comment") {
    aiConfidence = 0.5;
    reasoning.push("AI suggests review with comments");
  } else if (factors.aiRecommendation === "request_changes") {
    aiConfidence = 0;
    reasoning.push("AI recommends requesting changes");
  }

  // Adjust AI confidence based on risk level
  if (factors.riskLevel === "critical") {
    aiConfidence = Math.max(0, aiConfidence - 1.5);
    reasoning.push("Critical risk level detected");
  } else if (factors.riskLevel === "high") {
    aiConfidence = Math.max(0, aiConfidence - 1);
    reasoning.push("High risk level detected");
  }

  // Factor 5: Standards Compliance (-1 to 0)
  let standardsImpact = 0;
  if (factors.standardsViolations > 3) {
    standardsImpact = -1;
    reasoning.push(`${factors.standardsViolations} coding standards violations`);
  } else if (factors.standardsViolations > 0) {
    standardsImpact = -0.5;
    reasoning.push(`${factors.standardsViolations} minor standards violations`);
  }

  // Calculate final score
  const rawScore =
    baseScore +
    issuesImpact +
    securityImpact +
    complexityImpact +
    aiConfidence +
    standardsImpact;

  // Clamp to 1-5 range
  const score = Math.max(1, Math.min(5, Math.round(rawScore)));

  // Determine level
  const level = getConfidenceLevel(score);

  return {
    score,
    level,
    reasoning,
    factors: {
      issuesImpact,
      securityImpact,
      complexityImpact,
      aiConfidence,
      standardsImpact,
    },
  };
}

/**
 * Calculate security score (inverse of issue severity)
 */
function calculateSecurityScore(issues: SecurityIssue[]): number {
  if (issues.length === 0) return 100;

  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case "critical":
        score -= 30;
        break;
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 5;
        break;
      case "low":
        score -= 2;
        break;
    }
  }

  return Math.max(0, score);
}

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(
  score: number
): "very_low" | "low" | "medium" | "high" | "very_high" {
  if (score >= 5) return "very_high";
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  if (score >= 2) return "low";
  return "very_low";
}

/**
 * Get human-readable confidence level description
 */
export function getConfidenceLevelDescription(
  level: "very_low" | "low" | "medium" | "high" | "very_high"
): string {
  switch (level) {
    case "very_high":
      return "Very High - Safe to merge";
    case "high":
      return "High - Likely safe to merge";
    case "medium":
      return "Medium - Review recommended";
    case "low":
      return "Low - Changes likely needed";
    case "very_low":
      return "Very Low - Do not merge";
  }
}

/**
 * Get color for confidence level
 */
export function getConfidenceLevelColor(
  level: "very_low" | "low" | "medium" | "high" | "very_high"
): { bg: string; text: string; border: string } {
  switch (level) {
    case "very_high":
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
        border: "border-green-200 dark:border-green-800",
      };
    case "high":
      return {
        bg: "bg-green-50 dark:bg-green-900/20",
        text: "text-green-600 dark:text-green-500",
        border: "border-green-200 dark:border-green-700",
      };
    case "medium":
      return {
        bg: "bg-amber-50 dark:bg-amber-900/20",
        text: "text-amber-600 dark:text-amber-500",
        border: "border-amber-200 dark:border-amber-700",
      };
    case "low":
      return {
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-600 dark:text-red-500",
        border: "border-red-200 dark:border-red-700",
      };
    case "very_low":
      return {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
      };
  }
}
