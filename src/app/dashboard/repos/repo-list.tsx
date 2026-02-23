"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderGit2,
  Lock,
  Globe,
  Check,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AvailableRepository, ConnectedRepository } from "@/types/repository";

type Tab = "connected" | "available";

export function RepoList() {
  const [activeTab, setActiveTab] = useState<Tab>("connected");
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepository[]>([]);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchConnectedRepos = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/repos/connected");
      const data = await res.json();
      if (data.success) {
        setConnectedRepos(data.data.repositories);
      } else {
        if (!silent) {
          setError(data.error?.message || "Failed to fetch repositories");
        }
      }
    } catch {
      if (!silent) {
        setError("Failed to fetch repositories");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  async function fetchAvailableRepos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (data.success) {
        setAvailableRepos(data.data.repositories);
      } else {
        setError(data.error?.message || "Failed to fetch repositories");
      }
    } catch {
      setError("Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    if (activeTab === "connected") {
      await fetchConnectedRepos();
    } else {
      await fetchAvailableRepos();
    }
    setRefreshing(false);
  }

  useEffect(() => {
    if (activeTab === "connected") {
      void fetchConnectedRepos();
    } else {
      void fetchAvailableRepos();
    }
  }, [activeTab, fetchConnectedRepos]);

  useEffect(() => {
    if (activeTab !== "connected") return;
    const hasActiveIndexing = connectedRepos.some(
      (repo) => repo.indexStatus === "pending" || repo.indexStatus === "indexing"
    );
    if (!hasActiveIndexing) return;

    const interval = setInterval(() => {
      void fetchConnectedRepos(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, connectedRepos, fetchConnectedRepos]);

  async function connectRepo(repo: AvailableRepository) {
    setConnecting(repo.id);
    try {
      const res = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          private: repo.private,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update available repos list
        setAvailableRepos((prev) =>
          prev.map((r) => (r.id === repo.id ? { ...r, isConnected: true } : r))
        );
        // Switch to connected tab
        setActiveTab("connected");
      } else {
        setError(data.error?.message || "Failed to connect repository");
      }
    } catch {
      setError("Failed to connect repository");
    } finally {
      setConnecting(null);
    }
  }

  function openDeleteDialog(repoId: string) {
    setRepoToDelete(repoId);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    setRepoToDelete(null);
  }

  async function handleConfirmDelete() {
    if (!repoToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/repos/${repoToDelete}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setConnectedRepos((prev) => prev.filter((r) => r.id !== repoToDelete));
        closeDeleteDialog();
      } else {
        setError(data.error?.message || "Failed to disconnect repository");
        closeDeleteDialog();
      }
    } catch {
      setError("Failed to disconnect repository");
      closeDeleteDialog();
    } finally {
      setIsDeleting(false);
    }
  }

  async function indexRepo(repoId: string) {
    setIndexing(repoId);
    setError(null);

    // Update local state to show indexing
    setConnectedRepos((prev) =>
      prev.map((r) =>
        r.id === repoId ? { ...r, indexStatus: "indexing" as const, indexProgress: 0 } : r
      )
    );

    try {
      const res = await fetch(`/api/repos/${repoId}/index`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the repos list
        fetchConnectedRepos();
      } else {
        setError(data.error?.message || "Failed to index repository");
        // Refresh to get actual status
        fetchConnectedRepos();
      }
    } catch {
      setError("Failed to index repository");
      fetchConnectedRepos();
    } finally {
      setIndexing(null);
    }
  }

  return (
    <div>
      {/* Tabs - Pill Style */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("connected")}
            className={cn(
              "px-5 py-2.5 text-sm font-medium rounded-xl transition-all",
              activeTab === "connected"
                ? "bg-[#4F46E5] text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            )}
          >
            Connected Repositories
          </button>
          <button
            onClick={() => setActiveTab("available")}
            className={cn(
              "px-5 py-2.5 text-sm font-medium rounded-xl transition-all",
              activeTab === "available"
                ? "bg-[#4F46E5] text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            )}
          >
            Available to Connect
          </button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-all disabled:opacity-50 w-full md:w-auto justify-center"
          title="Refresh repository list"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-[#FEF2F2] dark:bg-[#7F1D1D] border border-[#FECACA] dark:border-[#991B1B] rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444]" />
          <span className="text-[#991B1B] dark:text-[#FECACA]">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Connected repos */}
      {!loading && activeTab === "connected" && (
        <div className="space-y-3">
          {connectedRepos.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-2xl flex items-center justify-center">
                <FolderGit2 className="w-10 h-10 text-[#4F46E5]" />
              </div>
              <h3 className="text-xl font-semibold mb-3">No repositories connected</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                Connect your first repository to start using AI-powered code reviews and chat with your codebase.
              </p>
              <button
                onClick={() => setActiveTab("available")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-xl hover:bg-[#4338CA] transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Connect Repository
              </button>
            </div>
          ) : (
            connectedRepos.map((repo) => (
              <ConnectedRepoCard
                key={repo.id}
                repo={repo}
                onDisconnect={() => openDeleteDialog(repo.id)}
                onIndex={() => indexRepo(repo.id)}
                isIndexing={indexing === repo.id}
              />
            ))
          )}
        </div>
      )}

      {/* Available repos */}
      {!loading && activeTab === "available" && (
        <div className="space-y-3">
          {availableRepos.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <FolderGit2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No repositories found</h3>
              <p className="text-gray-500">
                We couldn&apos;t find any repositories in your GitHub account
              </p>
            </div>
          ) : (
            availableRepos.map((repo) => (
              <AvailableRepoCard
                key={repo.id}
                repo={repo}
                onConnect={() => connectRepo(repo)}
                isConnecting={connecting === repo.id}
              />
            ))
          )}
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Disconnect Repository"
        message="Are you sure you want to disconnect this repository? This will stop automatic PR reviews and remove all indexed data."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

function ConnectedRepoCard({
  repo,
  onDisconnect,
  onIndex,
  isIndexing,
}: {
  repo: ConnectedRepository;
  onDisconnect: () => void;
  onIndex: () => void;
  isIndexing: boolean;
}) {
  const statusColors = {
    pending: "text-gray-500 bg-gray-100 dark:bg-gray-700",
    indexing: "text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1E1B4B]",
    indexed: "text-[#10B981] bg-[#ECFDF5] dark:bg-[#064E3B]",
    failed: "text-[#EF4444] bg-[#FEF2F2] dark:bg-[#7F1D1D]",
    stale: "text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#78350F]",
  };

  const canIndex = repo.indexStatus === "pending" || repo.indexStatus === "failed" || repo.indexStatus === "stale";
  const showIndexButton = canIndex || repo.indexStatus === "indexed";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3 w-full sm:w-auto">
          <FolderGit2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/dashboard/repos/${repo.id}`}
                className="font-medium hover:text-[#4F46E5] break-all"
              >
                {repo.fullName}
              </a>
              {repo.private ? (
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              {repo.language && <span>{repo.language}</span>}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                  statusColors[repo.indexStatus]
                )}
              >
                {repo.indexStatus === "indexing"
                  ? `Indexing ${repo.indexProgress}%`
                  : repo.indexStatus}
              </span>
              {repo.indexedAt && repo.indexStatus === "indexed" && (
                <span className="whitespace-nowrap">
                  {repo.fileCount} files, {repo.chunkCount} chunks
                </span>
              )}
              {repo.indexError && (
                <span className="text-[#EF4444] text-xs">{repo.indexError}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {showIndexButton && (
            <button
              onClick={onIndex}
              disabled={isIndexing || repo.indexStatus === "indexing"}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex-1 sm:flex-none justify-center",
                canIndex
                  ? "bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                  : "text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700",
                (isIndexing || repo.indexStatus === "indexing") && "opacity-50 cursor-not-allowed"
              )}
              title={canIndex ? "Start Indexing" : "Reindex"}
            >
              {isIndexing || repo.indexStatus === "indexing" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {canIndex ? "Index" : "Reindex"}
            </button>
          )}
          <button
            onClick={onDisconnect}
            disabled={isIndexing || repo.indexStatus === "indexing"}
            className="px-3 py-1.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D] rounded-lg disabled:opacity-50 flex-1 sm:flex-none"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function AvailableRepoCard({
  repo,
  onConnect,
  isConnecting,
}: {
  repo: AvailableRepository;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3 w-full sm:w-auto">
          <FolderGit2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium break-all">{repo.fullName}</span>
              {repo.private ? (
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              )}
            </div>
            {repo.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                {repo.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              {repo.language && <span>{repo.language}</span>}
              {repo.stargazersCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5" />
                  {repo.stargazersCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="w-full sm:w-auto flex justify-end">
          {repo.isConnected ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[#10B981] bg-[#ECFDF5] dark:bg-[#064E3B] rounded-lg w-full sm:w-auto justify-center">
              <Check className="w-4 h-4" />
              Connected
            </span>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
