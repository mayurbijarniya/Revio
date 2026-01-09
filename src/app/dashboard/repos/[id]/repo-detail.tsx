"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderGit2,
  Lock,
  Globe,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileCode,
  GitPullRequest,
  MessageSquare,
  Settings,
  ExternalLink,
  ArrowLeft,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Sliders,
  GitPullRequestDraft,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReviewRulesEditor } from "@/components/ui/review-rules-editor";
import { type ReviewSettings, parseReviewSettings } from "@/types/review";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  indexStatus: "pending" | "indexing" | "indexed" | "failed" | "stale";
  indexProgress: number;
  indexedAt: Date | null;
  indexError: string | null;
  fileCount: number;
  chunkCount: number;
  autoReview: boolean;
  webhookId: number | null;
  ignoredPaths: string[];
  reviewRules: ReviewSettings | Record<string, unknown>;
  createdAt: Date;
}

interface IndexedFile {
  id: string;
  filePath: string;
  language: string | null;
  indexedAt: Date;
}

interface PrReview {
  id: string;
  prNumber: number;
  prTitle: string | null;
  prAuthor: string | null;
  prUrl: string | null;
  status: string;
  summary: string | null;
  createdAt: Date;
}

interface OpenPR {
  number: number;
  title: string;
  author: string;
  url: string;
  draft: boolean;
  createdAt: string;
  reviewStatus: string | null;
  lastReviewedAt: string | null;
}

interface RepoDetailProps {
  repository: Repository;
  indexedFiles: IndexedFile[];
  prReviews: PrReview[];
  counts: {
    indexedFiles: number;
    prReviews: number;
    conversations: number;
  };
}

export function RepoDetail({
  repository,
  indexedFiles,
  prReviews,
  counts,
}: RepoDetailProps) {
  const router = useRouter();
  const [isIndexing, setIsIndexing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoReview, setAutoReview] = useState(repository.autoReview);
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>(repository.ignoredPaths || []);
  const [newIgnoredPath, setNewIgnoredPath] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings>(
    parseReviewSettings(repository.reviewRules)
  );
  const [openPRs, setOpenPRs] = useState<OpenPR[]>([]);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [reviewingPR, setReviewingPR] = useState<number | null>(null);

  const statusColors = {
    pending: "text-gray-500 bg-gray-100 dark:bg-gray-700",
    indexing: "text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#4F46E5]/30",
    indexed: "text-[#10B981] bg-[#ECFDF5] dark:bg-[#10B981]/30",
    failed: "text-[#EF4444] bg-[#FEF2F2] dark:bg-[#EF4444]/30",
    stale: "text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#F59E0B]/30",
  };

  const statusIcons = {
    pending: Clock,
    indexing: Loader2,
    indexed: CheckCircle,
    failed: AlertCircle,
    stale: RefreshCw,
  };

  const StatusIcon = statusIcons[repository.indexStatus];

  // Fetch open PRs from GitHub
  const fetchOpenPRs = useCallback(async () => {
    setIsLoadingPRs(true);
    try {
      const res = await fetch(`/api/repos/${repository.id}/review`);
      const data = await res.json();
      if (data.success) {
        setOpenPRs(data.data.pullRequests);
      }
    } catch (err) {
      console.warn("Failed to fetch open PRs:", err);
    } finally {
      setIsLoadingPRs(false);
    }
  }, [repository.id]);

  // Fetch open PRs on mount
  useEffect(() => {
    fetchOpenPRs();
  }, [fetchOpenPRs]);

  // Trigger manual PR review
  async function handleReviewPR(prNumber: number) {
    setReviewingPR(prNumber);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prNumber }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the page to show the new review
        router.refresh();
        // Re-fetch open PRs to update review status
        fetchOpenPRs();
      } else {
        setError(data.error?.message || "Failed to trigger PR review");
      }
    } catch {
      setError("Failed to trigger PR review");
    } finally {
      setReviewingPR(null);
    }
  }

  async function handleIndex() {
    setIsIndexing(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}/index`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        setError(data.error?.message || "Failed to start indexing");
      }
    } catch {
      setError("Failed to start indexing");
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        router.push("/dashboard/repos");
      } else {
        setError(data.error?.message || "Failed to disconnect repository");
        setDeleteDialogOpen(false);
      }
    } catch {
      setError("Failed to disconnect repository");
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleAutoReview() {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReview: !autoReview }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoReview(!autoReview);
      } else {
        setError(data.error?.message || "Failed to update settings");
      }
    } catch {
      setError("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddIgnoredPath() {
    if (!newIgnoredPath.trim()) return;
    const trimmedPath = newIgnoredPath.trim();
    if (ignoredPaths.includes(trimmedPath)) {
      setNewIgnoredPath("");
      return;
    }

    const updatedPaths = [...ignoredPaths, trimmedPath];
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoredPaths: updatedPaths }),
      });
      const data = await res.json();
      if (data.success) {
        setIgnoredPaths(updatedPaths);
        setNewIgnoredPath("");
      } else {
        setError(data.error?.message || "Failed to update settings");
      }
    } catch {
      setError("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleRemoveIgnoredPath(pathToRemove: string) {
    const updatedPaths = ignoredPaths.filter((p) => p !== pathToRemove);
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoredPaths: updatedPaths }),
      });
      const data = await res.json();
      if (data.success) {
        setIgnoredPaths(updatedPaths);
      } else {
        setError(data.error?.message || "Failed to update settings");
      }
    } catch {
      setError("Failed to update settings");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleSaveReviewRules(newSettings: ReviewSettings) {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repository.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewRules: newSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewSettings(newSettings);
      } else {
        setError(data.error?.message || "Failed to update review rules");
      }
    } catch {
      setError("Failed to update review rules");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back button */}
      <Link
        href="/dashboard/repos"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to repositories
      </Link>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-[#FEF2F2] dark:bg-[#7F1D1D] border border-[#FECACA] dark:border-[#991B1B] rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444]" />
          <span className="text-[#991B1B] dark:text-[#FECACA]">{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <FolderGit2 className="w-10 h-10 text-gray-400" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{repository.fullName}</h1>
                {repository.private ? (
                  <Lock className="w-4 h-4 text-gray-400" />
                ) : (
                  <Globe className="w-4 h-4 text-gray-400" />
                )}
                <a
                  href={`https://github.com/${repository.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {repository.language && <span>{repository.language}</span>}
                <span>Branch: {repository.defaultBranch}</span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1",
                    statusColors[repository.indexStatus]
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "w-3 h-3",
                      repository.indexStatus === "indexing" && "animate-spin"
                    )}
                  />
                  {repository.indexStatus === "indexing"
                    ? `Indexing ${repository.indexProgress}%`
                    : repository.indexStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleIndex}
              disabled={isIndexing || repository.indexStatus === "indexing"}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                repository.indexStatus === "indexed"
                  ? "bg-white dark:bg-transparent border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-[#4F46E5] border-[#4F46E5] text-white hover:bg-[#4338CA] hover:border-[#4338CA]",
                (isIndexing || repository.indexStatus === "indexing") &&
                "opacity-50 cursor-not-allowed bg-[#4F46E5] border-[#4F46E5] text-white"
              )}
            >
              {isIndexing || repository.indexStatus === "indexing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {repository.indexStatus === "indexed" ? "Re-index" : "Index Repository"}
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#EF4444] border border-[#FEF2F2] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Disconnect
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center stat-item">
            <div className="stat-value">{repository.fileCount}</div>
            <div className="stat-label">Files Indexed</div>
          </div>
          <div className="text-center stat-item border-l border-gray-200 dark:border-gray-700">
            <div className="stat-value">{repository.chunkCount}</div>
            <div className="stat-label">Code Chunks</div>
          </div>
          <div className="text-center stat-item border-l border-gray-200 dark:border-gray-700">
            <div className="stat-value">{counts.prReviews}</div>
            <div className="stat-label">PR Reviews</div>
          </div>
          <div className="text-center stat-item border-l border-gray-200 dark:border-gray-700">
            <div className="stat-value">{counts.conversations}</div>
            <div className="stat-label">Conversations</div>
          </div>
        </div>
      </div>

      {/* Open PRs - Manual Review Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitPullRequest className="w-5 h-5" />
            Open Pull Requests
            {openPRs.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({openPRs.length})
              </span>
            )}
          </h2>
          <button
            onClick={fetchOpenPRs}
            disabled={isLoadingPRs}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoadingPRs ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>

        {isLoadingPRs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : openPRs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitPullRequest className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No open pull requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openPRs.map((pr) => (
              <div
                key={pr.number}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-1">
                    {pr.draft ? (
                      <GitPullRequestDraft className="w-5 h-5 text-gray-400" />
                    ) : (
                      <GitPullRequest className="w-5 h-5 text-[#10B981]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-[#4F46E5] truncate"
                      >
                        #{pr.number} {pr.title}
                      </a>
                      {pr.draft && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">
                          Draft
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {pr.author}
                      </span>
                      <span>
                        opened {new Date(pr.createdAt).toLocaleDateString()}
                      </span>
                      {pr.reviewStatus && (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            pr.reviewStatus === "completed"
                              ? "bg-[#ECFDF5] text-[#10B981]"
                              : pr.reviewStatus === "failed"
                                ? "bg-[#FEF2F2] text-[#EF4444]"
                                : pr.reviewStatus === "pending"
                                  ? "bg-[#EEF2FF] text-[#4F46E5]"
                                  : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {pr.reviewStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleReviewPR(pr.number)}
                    disabled={reviewingPR === pr.number || pr.reviewStatus === "pending"}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      pr.reviewStatus === "pending"
                        ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#10B981] border-[#10B981] text-white hover:bg-[#059669] hover:border-[#059669]",
                      reviewingPR === pr.number && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {reviewingPR === pr.number ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {pr.reviewStatus === "pending" ? "In Progress" : "Reviewing..."}
                      </>
                    ) : pr.reviewStatus === "pending" ? (
                      <>
                        <Clock className="w-4 h-4" />
                        In Progress
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {pr.reviewStatus === "completed" ? "Re-review" : "Review"}
                      </>
                    )}
                  </button>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-[#4F46E5] border border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#4F46E5]/30 transition-colors bg-white dark:bg-transparent"
                    title="View on GitHub"
                  >
                    <ExternalLink className="w-4 h-4" />
                    GitHub
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 h-[500px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 flex-shrink-0">
            <Settings className="w-5 h-5" />
            Review Settings
          </h2>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto Review PRs</div>
                <div className="text-sm text-gray-500">
                  Automatically review new pull requests
                </div>
              </div>
              <button
                onClick={handleToggleAutoReview}
                disabled={isUpdating}
                className="text-[#4F46E5]"
              >
                {autoReview ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Webhook Status</div>
                <div className="text-sm text-gray-500">
                  {repository.webhookId ? "Active" : "Not configured"}
                </div>
              </div>
              <span
                className={cn(
                  "px-2 py-1 rounded text-xs",
                  repository.webhookId
                    ? "bg-[#ECFDF5] text-[#10B981]"
                    : "status-disconnected"
                )}
              >
                {repository.webhookId ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Ignored Paths */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="font-medium mb-2">Ignored Paths</div>
              <div className="text-sm text-gray-500 mb-3">
                Files matching these patterns will be skipped during review
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newIgnoredPath}
                  onChange={(e) => setNewIgnoredPath(e.target.value)}
                  placeholder="e.g., *.test.ts, docs/*"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIgnoredPath();
                    }
                  }}
                />
                <button
                  onClick={handleAddIgnoredPath}
                  disabled={isUpdating || !newIgnoredPath.trim()}
                  className="px-3 py-1.5 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {ignoredPaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ignoredPaths.map((path) => (
                    <span
                      key={path}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {path}
                      <button
                        onClick={() => handleRemoveIgnoredPath(path)}
                        disabled={isUpdating}
                        className="hover:text-[#EF4444] disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Review Rules */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAdvancedRules(!showAdvancedRules)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">Advanced Review Rules</span>
                  {reviewSettings.customRules.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#4F46E5] text-white text-xs rounded-full">
                      {reviewSettings.customRules.filter((r) => r.enabled).length}
                    </span>
                  )}
                </div>
                {showAdvancedRules ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <p className="text-sm text-gray-500 mb-3">
                Configure custom review rules, severity thresholds, and focus areas
              </p>

              {showAdvancedRules && (
                <div className="mt-4">
                  <ReviewRulesEditor
                    settings={reviewSettings}
                    onSave={handleSaveReviewRules}
                    isLoading={isUpdating}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <Link
              href={`/dashboard/chat?repo=${repository.id}`}
              className="cta-link"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with this codebase
            </Link>
          </div>
        </div>

        {/* Recent PR Reviews */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 h-[500px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 flex-shrink-0">
            <GitPullRequest className="w-5 h-5" />
            Recent PR Reviews
          </h2>

          {prReviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex-1 flex flex-col items-center justify-center">
              <GitPullRequest className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No PR reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {prReviews.map((pr) => (
                <Link
                  key={pr.id}
                  href={`/dashboard/reviews/${pr.id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">#{pr.prNumber}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        pr.status === "completed"
                          ? "bg-[#ECFDF5] text-[#10B981]"
                          : pr.status === "failed"
                            ? "bg-[#FEF2F2] text-[#EF4444]"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                      )}
                    >
                      {pr.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 truncate mt-1">
                    {pr.prTitle}
                  </div>
                  {pr.prAuthor && (
                    <div className="text-xs text-gray-400 mt-1">
                      by {pr.prAuthor}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Indexed Files */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 h-[500px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 flex-shrink-0">
            <FileCode className="w-5 h-5" />
            Indexed Files
            <span className="text-sm font-normal text-gray-500">
              ({counts.indexedFiles})
            </span>
          </h2>

          {indexedFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500 flex-1 flex flex-col items-center justify-center">
              <FileCode className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No files indexed yet</p>
            </div>
          ) : (
            <div className="space-y-1 flex-1 overflow-y-auto pr-1">
              {indexedFiles.map((file) => (
                <div
                  key={file.id}
                  className="file-list-item"
                >
                  <FileCode className="file-icon flex-shrink-0" />
                  <span className="truncate" title={file.filePath}>
                    {file.filePath}
                  </span>
                  {file.language && (
                    <span className="file-extension flex-shrink-0">
                      {file.language}
                    </span>
                  )}
                </div>
              ))}
              {counts.indexedFiles > 50 && (
                <div className="text-center text-sm text-gray-500 py-2 flex-shrink-0">
                  +{counts.indexedFiles - 50} more files
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Disconnect Repository"
        message="Are you sure you want to disconnect this repository? This will delete all indexed data and PR reviews."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
