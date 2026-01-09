"use client";

import { useState } from "react";
import Link from "next/link";
import {
  GitPullRequest,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  FolderGit2,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  name: string;
  fullName: string;
}

interface Review {
  id: string;
  prNumber: number;
  prTitle: string | null;
  prAuthor: string | null;
  prUrl: string | null;
  status: "completed" | "failed" | "pending";
  summary: string | null;
  feedback: "helpful" | "not_helpful" | null;
  createdAt: Date;
  repository: Repository;
}

interface ReviewsListProps {
  reviews: Review[];
  repositories: Repository[];
  counts: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
}

type StatusFilter = "all" | "completed" | "failed" | "pending";

export function ReviewsList({ reviews, repositories, counts }: ReviewsListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [repoFilter, setRepoFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<
    Record<string, "helpful" | "not_helpful" | null>
  >({});

  async function handleFeedback(
    reviewId: string,
    feedback: "helpful" | "not_helpful"
  ) {
    const currentFeedback = localFeedback[reviewId] ?? reviews.find((r) => r.id === reviewId)?.feedback;

    setFeedbackLoading(reviewId);
    try {
      // If clicking the same feedback, remove it
      if (currentFeedback === feedback) {
        const res = await fetch(`/api/reviews/${reviewId}/feedback`, {
          method: "DELETE",
        });
        if (res.ok) {
          setLocalFeedback((prev) => ({ ...prev, [reviewId]: null }));
        }
      } else {
        // Set new feedback
        const res = await fetch(`/api/reviews/${reviewId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        });
        if (res.ok) {
          setLocalFeedback((prev) => ({ ...prev, [reviewId]: feedback }));
        }
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setFeedbackLoading(null);
    }
  }

  function getReviewFeedback(review: Review): "helpful" | "not_helpful" | null {
    if (review.id in localFeedback) {
      return localFeedback[review.id] ?? null;
    }
    return review.feedback;
  }

  async function handleReview(review: Review) {
    setReviewLoading(review.id);
    try {
      const res = await fetch(`/api/repos/${review.repository.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prNumber: review.prNumber }),
      });
      if (res.ok) {
        // Reload page to get updated status
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to trigger review:", error);
    } finally {
      setReviewLoading(null);
    }
  }

  const filteredReviews = reviews.filter((review) => {
    if (statusFilter !== "all" && review.status !== statusFilter) {
      return false;
    }
    if (repoFilter !== "all" && review.repository.id !== repoFilter) {
      return false;
    }
    return true;
  });

  const statusConfig = {
    completed: {
      icon: CheckCircle,
      color: "text-[#10B981]",
      bg: "bg-[#ECFDF5] dark:bg-[#064E3B]",
      label: "Completed",
    },
    failed: {
      icon: XCircle,
      color: "text-[#EF4444]",
      bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]",
      label: "Failed",
    },
    pending: {
      icon: Clock,
      color: "text-[#F59E0B]",
      bg: "bg-[#FFFBEB] dark:bg-[#78350F]",
      label: "Pending",
    },
  };

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <GitPullRequest className="w-7 h-7" />
          PR Reviews
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View all automated code reviews across your repositories
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "group bg-white dark:bg-gray-800 rounded-xl border p-5 text-left transition-all",
            statusFilter === "all"
              ? "border-[#4F46E5] shadow-md"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              statusFilter === "all"
                ? "bg-[#4F46E5] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <GitPullRequest className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold">{counts.total}</div>
          <div className="text-sm text-gray-500">Total Reviews</div>
        </button>
        <button
          onClick={() => setStatusFilter("completed")}
          className={cn(
            "group bg-white dark:bg-gray-800 rounded-xl border p-5 text-left transition-all",
            statusFilter === "completed"
              ? "border-[#10B981] shadow-md"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              statusFilter === "completed"
                ? "bg-[#10B981] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#10B981]">{counts.completed}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </button>
        <button
          onClick={() => setStatusFilter("failed")}
          className={cn(
            "group bg-white dark:bg-gray-800 rounded-xl border p-5 text-left transition-all",
            statusFilter === "failed"
              ? "border-[#EF4444] shadow-md"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              statusFilter === "failed"
                ? "bg-[#EF4444] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#EF4444]">{counts.failed}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "group bg-white dark:bg-gray-800 rounded-xl border p-5 text-left transition-all",
            statusFilter === "pending"
              ? "border-[#F59E0B] shadow-md"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              statusFilter === "pending"
                ? "bg-[#F59E0B] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-500"
            )}>
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#F59E0B]">{counts.pending}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters</span>
            {(statusFilter !== "all" || repoFilter !== "all") && (
              <span className="px-2 py-0.5 bg-[#EEF2FF] text-[#4F46E5] rounded text-xs">
                Active
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              showFilters && "rotate-180"
            )}
          />
        </button>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Repository</label>
                <select
                  value={repoFilter}
                  onChange={(e) => setRepoFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="all">All Repositories</option>
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            {(statusFilter !== "all" || repoFilter !== "all") && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setRepoFilter("all");
                }}
                className="mt-3 text-sm text-[#4F46E5] hover:text-[#4338CA]"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[600px]">
        {filteredReviews.length === 0 ? (
          <div className="p-12 text-center h-full flex flex-col items-center justify-center">
            <div className="empty-state-icon pr-reviews">
              <GitPullRequest />
            </div>
            <h3 className="text-xl font-semibold mb-3">
              {reviews.length === 0 ? "No PR reviews yet" : "No reviews match filters"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
              {reviews.length === 0
                ? "Connect a repository and enable auto-review to automatically analyze pull requests and get AI-powered feedback."
                : "Try adjusting your filters to find what you're looking for."}
            </p>
            {reviews.length === 0 && (
              <Link
                href="/dashboard/repos"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-xl hover:bg-[#4338CA] transition-colors font-medium"
              >
                <FolderGit2 className="w-5 h-5" />
                Connect Repository
              </Link>
            )}
            {reviews.length > 0 && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setRepoFilter("all");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
            {filteredReviews.map((review) => {
              const status = statusConfig[review.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={review.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Link
                          href={`/dashboard/repos/${review.repository.id}`}
                          className="text-sm text-gray-500 hover:text-[#4F46E5]"
                        >
                          {review.repository.fullName}
                        </Link>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="font-medium">#{review.prNumber}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            status.bg,
                            status.color
                          )}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/reviews/${review.id}`}
                        className="font-medium truncate hover:text-[#4F46E5] transition-colors block text-base md:text-lg"
                      >
                        {review.prTitle || `Pull Request #${review.prNumber}`}
                      </Link>
                      {review.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {review.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {review.prAuthor && <span>by {review.prAuthor}</span>}
                        <span>{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      {/* Feedback buttons - only show for completed reviews */}
                      {review.status === "completed" && (
                        <div className="flex items-center gap-1 mr-2">
                          {feedbackLoading === review.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleFeedback(review.id, "helpful")}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  getReviewFeedback(review) === "helpful"
                                    ? "bg-[#ECFDF5] text-[#10B981]"
                                    : "text-gray-400 hover:text-[#10B981] hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title="Helpful review"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleFeedback(review.id, "not_helpful")}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  getReviewFeedback(review) === "not_helpful"
                                    ? "bg-[#FEF2F2] text-[#EF4444]"
                                    : "text-gray-400 hover:text-[#EF4444] hover:bg-gray-100 dark:hover:bg-gray-700"
                                )}
                                title="Not helpful"
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {/* Review/Re-review button */}
                      <button
                        onClick={() => handleReview(review)}
                        disabled={reviewLoading === review.id}
                        className="flex-1 md:flex-none justify-center flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-50"
                      >
                        {reviewLoading === review.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        {review.status === "pending" ? "Review" : "Re-review"}
                      </button>
                      <Link
                        href={`/dashboard/reviews/${review.id}`}
                        className="flex-1 md:flex-none justify-center flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors"
                      >
                        View Details
                      </Link>
                      {review.prUrl && (
                        <a
                          href={review.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 md:flex-none justify-center flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#4F46E5] border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#4F46E5]/30 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          GitHub
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show count */}
        {filteredReviews.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            Showing {filteredReviews.length} of {reviews.length} reviews
          </div>
        )}
      </div>
    </div>
  );
}
