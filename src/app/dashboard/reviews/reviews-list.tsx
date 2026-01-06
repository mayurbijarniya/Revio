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
  status: string;
  summary: string | null;
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
      color: "text-green-600",
      bg: "bg-green-100 dark:bg-green-900",
      label: "Completed",
    },
    failed: {
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-100 dark:bg-red-900",
      label: "Failed",
    },
    pending: {
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-100 dark:bg-yellow-900",
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "bg-white dark:bg-gray-800 rounded-lg border p-4 text-left transition-colors",
            statusFilter === "all"
              ? "border-blue-500 ring-2 ring-blue-200"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="text-2xl font-bold">{counts.total}</div>
          <div className="text-sm text-gray-500">Total Reviews</div>
        </button>
        <button
          onClick={() => setStatusFilter("completed")}
          className={cn(
            "bg-white dark:bg-gray-800 rounded-lg border p-4 text-left transition-colors",
            statusFilter === "completed"
              ? "border-green-500 ring-2 ring-green-200"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="text-2xl font-bold text-green-600">{counts.completed}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </button>
        <button
          onClick={() => setStatusFilter("failed")}
          className={cn(
            "bg-white dark:bg-gray-800 rounded-lg border p-4 text-left transition-colors",
            statusFilter === "failed"
              ? "border-red-500 ring-2 ring-red-200"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="text-2xl font-bold text-red-600">{counts.failed}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "bg-white dark:bg-gray-800 rounded-lg border p-4 text-left transition-colors",
            statusFilter === "pending"
              ? "border-yellow-500 ring-2 ring-yellow-200"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
          )}
        >
          <div className="text-2xl font-bold text-yellow-600">{counts.pending}</div>
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
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
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
            <div className="flex gap-4">
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
                className="mt-3 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12">
            <GitPullRequest className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No PR reviews found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {reviews.length === 0
                ? "Connect a repository and enable auto-review to get started"
                : "No reviews match the selected filters"}
            </p>
            {reviews.length === 0 && (
              <Link
                href="/dashboard/repos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect Repository
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredReviews.map((review) => {
              const status = statusConfig[review.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <div
                  key={review.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <Link
                          href={`/dashboard/repos/${review.repository.id}`}
                          className="text-sm text-gray-500 hover:text-blue-600"
                        >
                          {review.repository.fullName}
                        </Link>
                        <span className="text-gray-300">|</span>
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
                      <h3 className="font-medium truncate pr-4">
                        {review.prTitle || `Pull Request #${review.prNumber}`}
                      </h3>
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
                    {review.prUrl && (
                      <a
                        href={review.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View PR
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Show count */}
        {filteredReviews.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
            Showing {filteredReviews.length} of {reviews.length} reviews
          </div>
        )}
      </div>
    </div>
  );
}
