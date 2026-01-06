"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const statusColors = {
    pending: "text-gray-500 bg-gray-100 dark:bg-gray-700",
    indexing: "text-blue-500 bg-blue-100 dark:bg-blue-900",
    indexed: "text-green-500 bg-green-100 dark:bg-green-900",
    failed: "text-red-500 bg-red-100 dark:bg-red-900",
    stale: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900",
  };

  const statusIcons = {
    pending: Clock,
    indexing: Loader2,
    indexed: CheckCircle,
    failed: AlertCircle,
    stale: RefreshCw,
  };

  const StatusIcon = statusIcons[repository.indexStatus];

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

  async function handleDelete() {
    if (!confirm("Are you sure you want to disconnect this repository? This will delete all indexed data and PR reviews.")) {
      return;
    }
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
      }
    } catch {
      setError("Failed to disconnect repository");
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
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
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
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                repository.indexStatus === "indexed"
                  ? "text-gray-600 border hover:bg-gray-50"
                  : "bg-blue-600 text-white hover:bg-blue-700",
                (isIndexing || repository.indexStatus === "indexing") &&
                  "opacity-50 cursor-not-allowed"
              )}
            >
              {isIndexing || repository.indexStatus === "indexing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {repository.indexStatus === "indexed" ? "Reindex" : "Index"}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
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
          <div className="text-center">
            <div className="text-2xl font-bold">{repository.fileCount}</div>
            <div className="text-sm text-gray-500">Files Indexed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{repository.chunkCount}</div>
            <div className="text-sm text-gray-500">Code Chunks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{counts.prReviews}</div>
            <div className="text-sm text-gray-500">PR Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{counts.conversations}</div>
            <div className="text-sm text-gray-500">Conversations</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </h2>

          <div className="space-y-4">
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
                className="text-blue-600"
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
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {repository.webhookId ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href={`/dashboard/chat?repo=${repository.id}`}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with this codebase
            </Link>
          </div>
        </div>

        {/* Recent PR Reviews */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <GitPullRequest className="w-5 h-5" />
            Recent PR Reviews
          </h2>

          {prReviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitPullRequest className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No PR reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prReviews.map((pr) => (
                <a
                  key={pr.id}
                  href={pr.prUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">#{pr.prNumber}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        pr.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : pr.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
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
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Indexed Files */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            Indexed Files
            <span className="text-sm font-normal text-gray-500">
              ({counts.indexedFiles})
            </span>
          </h2>

          {indexedFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files indexed yet</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {indexedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <FileCode className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate" title={file.filePath}>
                    {file.filePath}
                  </span>
                  {file.language && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {file.language}
                    </span>
                  )}
                </div>
              ))}
              {counts.indexedFiles > 50 && (
                <div className="text-center text-sm text-gray-500 py-2">
                  +{counts.indexedFiles - 50} more files
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
