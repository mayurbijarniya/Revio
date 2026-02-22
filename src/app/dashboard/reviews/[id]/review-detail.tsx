"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Zap,
  FileCode,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Shield,
  Bug,
  Gauge,
  Palette,
  Brain,
  AlertOctagon,
  TestTube,
  FileText,
  Loader2,
  GitPullRequest,
  GitMerge,
  User,
  Calendar,
  RefreshCw,
  Star,
} from "lucide-react";
import { BlastRadiusPanel } from "@/components/ui/blast-radius-panel";
import type { BlastRadiusData } from "@/types/blast-radius";
import { TestCoveragePanel } from "@/components/ui/test-coverage-panel";
import type { TestCoverageData } from "@/types/test-coverage";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";

interface ReviewIssue {
  file?: string;
  filePath?: string;
  line?: number;
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
  suggestion?: string;
  ruleId?: string;
}

interface ReviewSuggestion {
  title?: string;
  description?: string;
  priority?: string;
}

interface FileAnalyzed {
  path?: string;
  changes?: number;
  additions?: number;
  deletions?: number;
}

interface ReviewData {
  id: string;
  prNumber: number;
  prTitle: string | null;
  prUrl: string;
  prAuthor: string | null;
  status: string;
  queuedAt: string | null;
  startedAt: string | null;
  jobId: string | null;
  summary: string | null;
  issues: ReviewIssue[];
  issuesByFile: Record<string, ReviewIssue[]>;
  issueCount: number;
  severityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  suggestions: ReviewSuggestion[];
  filesAnalyzed: FileAnalyzed[];
  recommendation: string | null;
  riskLevel: string | null;
  confidenceScore: number | null;
  confidenceLevel: string | null;
  sequenceDiagram: string | null;
  blastRadius: BlastRadiusData | null;
  testCoverage: TestCoverageData | null;
  docstringSuggestions?: Array<{
    path: string;
    line: number;
    language?: string;
    docstring: string;
    signatureLine: string;
  }>;
  mergeVerdict: "ready" | "needs_changes" | "review" | "pending";
  mergeMessage: string;
  feedback: string | null;
  feedbackComment: string | null;
  feedbackAt: string | null;
  processingTimeMs: number | null;
  tokensUsed: number | null;
  githubCommentId: string | null;
  createdAt: string;
  repository: {
    id: string;
    name: string;
    fullName: string;
  };
  requestedBy: {
    id: string;
    githubUsername: string;
    avatarUrl: string | null;
  } | null;
  assignedTo: {
    id: string;
    githubUsername: string;
    avatarUrl: string | null;
  } | null;
}

interface ReviewDetailProps {
  reviewId: string;
}

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  critical: { icon: AlertOctagon, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  high: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  warning: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  medium: { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  low: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  info: { icon: Info, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  suggestion: { icon: Lightbulb, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
};

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  security: { icon: Shield, label: "Security" },
  bug: { icon: Bug, label: "Bug" },
  performance: { icon: Gauge, label: "Performance" },
  style: { icon: Palette, label: "Style" },
  logic: { icon: Brain, label: "Logic" },
  error_handling: { icon: AlertOctagon, label: "Error Handling" },
  testing: { icon: TestTube, label: "Testing" },
  documentation: { icon: FileText, label: "Documentation" },
  other: { icon: FileCode, label: "Other" },
};

export default function ReviewDetail({ reviewId }: ReviewDetailProps) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchReview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews/${reviewId}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to load review");
        return;
      }

      setReview(data.data);
      // Expand all files by default
      if (data.data.issuesByFile) {
        setExpandedFiles(new Set(Object.keys(data.data.issuesByFile)));
      }
    } catch {
      setError("Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const handleFeedback = async (feedback: "helpful" | "not_helpful") => {
    if (!review) return;

    try {
      setFeedbackLoading(true);

      // Toggle off if same feedback
      if (review.feedback === feedback) {
        await fetch(`/api/reviews/${reviewId}/feedback`, { method: "DELETE" });
        setReview({ ...review, feedback: null, feedbackAt: null });
      } else {
        const res = await fetch(`/api/reviews/${reviewId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        });
        const data = await res.json();
        if (data.success) {
          setReview({ ...review, feedback, feedbackAt: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedFiles(newExpanded);
  };

  const handleReview = async () => {
    if (!review) return;

    try {
      setReviewLoading(true);
      const res = await fetch(`/api/repos/${review.repository.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prNumber: review.prNumber }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh to get the updated review
        setTimeout(() => {
          fetchReview();
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to trigger review:", err);
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error || "Review not found"}
        </div>
        <Link
          href="/dashboard/reviews"
          className="mt-4 inline-flex items-center gap-2 text-[#4F46E5] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reviews
        </Link>
      </div>
    );
  }

  const statusConfig = {
    completed: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30", label: "Completed" },
    failed: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", label: "Failed" },
    pending: { icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Pending" },
  };

  const status = statusConfig[review.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/reviews"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reviews
        </Link>

        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <GitPullRequest className="h-6 w-6 text-[#4F46E5] flex-shrink-0" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                #{review.prNumber} {review.prTitle || "Pull Request"}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${status.bg} ${status.color} flex-shrink-0`}>
                <StatusIcon className="h-4 w-4" />
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <Link
                href={`/dashboard/repos/${review.repository.id}`}
                className="hover:text-[#4F46E5] truncate max-w-[200px]"
              >
                {review.repository.fullName}
              </Link>
              {review.prAuthor && (
                <span className="flex items-center gap-1 flex-shrink-0">
                  <User className="h-4 w-4" />
                  {review.prAuthor}
                </span>
              )}
              <span className="flex items-center gap-1 flex-shrink-0">
                <Calendar className="h-4 w-4" />
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
            <button
              onClick={handleReview}
              disabled={reviewLoading}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 h-10 whitespace-nowrap"
            >
              {reviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {review.status === "pending" ? "Review" : "Re-review"}
            </button>
            <a
              href={review.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 h-10 whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Issues</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{review.issueCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Files Analyzed</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{review.filesAnalyzed.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Processing Time</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            {review.processingTimeMs ? `${(review.processingTimeMs / 1000).toFixed(1)}s` : "-"}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tokens Used</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-400" />
            {review.tokensUsed?.toLocaleString() || "-"}
          </div>
        </div>
      </div>

      {/* Merge Readiness Verdict */}
      {review.status === "completed" && (
        <div
          className={`rounded-lg p-4 mb-6 border-2 ${review.mergeVerdict === "ready"
            ? "bg-green-50 border-green-300"
            : review.mergeVerdict === "needs_changes"
              ? "bg-red-50 border-red-300"
              : review.mergeVerdict === "review"
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800"
                : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
            }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div
              className={`p-3 rounded-full ${review.mergeVerdict === "ready"
                ? "bg-green-100"
                : review.mergeVerdict === "needs_changes"
                  ? "bg-red-100"
                  : review.mergeVerdict === "review"
                    ? "bg-amber-100 dark:bg-amber-900/40"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
            >
              {review.mergeVerdict === "ready" ? (
                <GitMerge className="h-6 w-6 text-green-600" />
              ) : review.mergeVerdict === "needs_changes" ? (
                <XCircle className="h-6 w-6 text-red-600" />
              ) : review.mergeVerdict === "review" ? (
                <AlertCircle className="h-6 w-6 text-amber-600" />
              ) : (
                <Clock className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div className="flex-1">
              <h3
                className={`text-lg font-semibold ${review.mergeVerdict === "ready"
                  ? "text-green-800"
                  : review.mergeVerdict === "needs_changes"
                    ? "text-red-800"
                    : review.mergeVerdict === "review"
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-gray-800 dark:text-gray-200"
                  }`}
              >
                {review.mergeVerdict === "ready"
                  ? "Ready to Merge"
                  : review.mergeVerdict === "needs_changes"
                    ? "Changes Required"
                    : review.mergeVerdict === "review"
                      ? "Review Recommended"
                      : "Review Pending"}
              </h3>
              <p
                className={`text-sm ${review.mergeVerdict === "ready"
                  ? "text-green-600"
                  : review.mergeVerdict === "needs_changes"
                    ? "text-red-600"
                    : review.mergeVerdict === "review"
                      ? "text-amber-600"
                      : "text-gray-600"
                  }`}
              >
                {review.mergeMessage}
              </p>
            </div>
            {review.recommendation && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">AI Recommendation</div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${review.recommendation === "approve"
                    ? "bg-green-100 text-green-700"
                    : review.recommendation === "request_changes"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                    }`}
                >
                  {review.recommendation === "approve"
                    ? "Approve"
                    : review.recommendation === "request_changes"
                      ? "Request Changes"
                      : "Comment"}
                </span>
              </div>
            )}
            {review.riskLevel && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Risk Level</div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${review.riskLevel === "critical"
                    ? "bg-red-100 text-red-700"
                    : review.riskLevel === "high"
                      ? "bg-orange-100 text-orange-700"
                      : review.riskLevel === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                >
                  {review.riskLevel.charAt(0).toUpperCase() + review.riskLevel.slice(1)}
                </span>
              </div>
            )}
            {review.confidenceScore && (
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">Confidence Score</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${star <= review.confidenceScore!
                        ? "text-amber-500 fill-amber-500"
                        : "text-gray-300 dark:text-gray-600"
                        }`}
                    />
                  ))}
                </div>
                {review.confidenceLevel && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {review.confidenceLevel.replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Severity Breakdown */}
      {review.issueCount > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Issue Severity Breakdown</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(review.severityCounts)
              .filter(([, count]) => count > 0)
              .map(([severity, count]) => {
                const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
                const SevIcon = config?.icon ?? Info;
                return (
                  <div key={severity} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config?.bg ?? "bg-blue-100"}`}>
                    <SevIcon className={`h-4 w-4 ${config?.color ?? "text-blue-600"}`} />
                    <span className={`font-medium ${config?.color ?? "text-blue-600"}`}>
                      {count} {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Summary */}
      {review.summary && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Review Summary</h2>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {review.summary}
          </div>
        </div>
      )}

      {/* Sequence Diagram */}
      {review.sequenceDiagram && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sequence Diagram
            </h2>
          </div>
          <MermaidDiagram chart={review.sequenceDiagram} />
        </div>
      )}

      {/* Blast Radius */}
      {review.blastRadius && (
        <BlastRadiusPanel blastRadius={review.blastRadius} />
      )}

      {/* Test Coverage */}
      {review.testCoverage && (
        <TestCoveragePanel testCoverage={review.testCoverage} />
      )}

      {/* Docstring Suggestions */}
      {review.docstringSuggestions && review.docstringSuggestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Docstring Suggestions ({review.docstringSuggestions.length})
          </h2>
          <div className="space-y-4">
            {review.docstringSuggestions.slice(0, 10).map((s, idx) => (
              <div
                key={`${s.path}:${s.line}:${idx}`}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-300 font-mono">
                  {s.path}:{s.line}
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 overflow-x-auto">
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre">
                    {s.docstring}
                  </pre>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            These are also posted as GitHub inline suggestions when possible.
          </p>
        </div>
      )}

      {/* Feedback Section */}
      {review.status === "completed" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Was this review helpful?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFeedback("helpful")}
                disabled={feedbackLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${review.feedback === "helpful"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                <ThumbsUp className="h-4 w-4" />
                Helpful
              </button>
              <button
                onClick={() => handleFeedback("not_helpful")}
                disabled={feedbackLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${review.feedback === "not_helpful"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                <ThumbsDown className="h-4 w-4" />
                Not Helpful
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issues by File */}
      {review.issueCount > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Issues Found ({review.issueCount})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {Object.entries(review.issuesByFile).map(([file, issues]) => (
              <div key={file}>
                {/* File Header */}
                <button
                  onClick={() => toggleFile(file)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                >
                  {expandedFiles.has(file) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <FileCode className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white flex-1">{file}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{issues?.length || 0} issues</span>
                </button>

                {/* Issues List */}
                {expandedFiles.has(file) && issues && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                    {issues.map((issue, idx) => {
                      const sevConfig = SEVERITY_CONFIG[issue.severity || "info"] ?? SEVERITY_CONFIG.info;
                      const SevIcon = sevConfig?.icon ?? Info;
                      const catConfig = CATEGORY_CONFIG[issue.category || "other"] ?? CATEGORY_CONFIG.other;
                      const CatIcon = catConfig?.icon ?? FileCode;
                      const sevBg = sevConfig?.bg ?? "bg-blue-100";
                      const sevColor = sevConfig?.color ?? "text-blue-600";
                      const catLabel = catConfig?.label ?? "Other";

                      return (
                        <div
                          key={idx}
                          className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded ${sevBg}`}>
                              <SevIcon className={`h-4 w-4 ${sevColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {issue.title || "Issue"}
                                </span>
                                {issue.line && (
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Line {issue.line}
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${sevBg} ${sevColor}`}>
                                  {issue.severity || "info"}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  <CatIcon className="h-3 w-3" />
                                  {catLabel}
                                </span>
                              </div>
                              {issue.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                  {issue.description}
                                </p>
                              )}
                              {issue.suggestion && (
                                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-1">
                                    <Lightbulb className="h-4 w-4" />
                                    Suggestion
                                  </div>
                                  <p className="text-sm text-green-800 dark:text-green-300">
                                    {issue.suggestion}
                                  </p>
                                </div>
                              )}
                              {issue.ruleId && (
                                <div className="mt-2 text-xs text-gray-400">
                                  Rule: {issue.ruleId}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Issues State */}
      {review.status === "completed" && review.issueCount === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-400 mb-1">No Issues Found!</h3>
          <p className="text-green-600 dark:text-green-300">This pull request looks good. Great job!</p>
        </div>
      )}

      {/* Suggestions */}
      {review.suggestions && review.suggestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Suggestions ({review.suggestions.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {review.suggestions.map((suggestion, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30">
                    <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                      {suggestion.title || `Suggestion ${idx + 1}`}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{suggestion.description}</p>
                    {suggestion.priority && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        Priority: {suggestion.priority}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Analyzed */}
      {review.filesAnalyzed && review.filesAnalyzed.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Files Analyzed ({review.filesAnalyzed.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
            {review.filesAnalyzed.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <FileCode className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                  {file.path || "Unknown file"}
                </span>
                {(file.additions !== undefined || file.deletions !== undefined) && (
                  <span className="text-xs text-gray-500">
                    {file.additions !== undefined && (
                      <span className="text-green-600">+{file.additions}</span>
                    )}
                    {file.additions !== undefined && file.deletions !== undefined && " / "}
                    {file.deletions !== undefined && (
                      <span className="text-red-600">-{file.deletions}</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
